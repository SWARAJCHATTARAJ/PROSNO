package prosno.backend.services.indexing;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.ai.vectorstore.filter.FilterExpressionBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;

import prosno.backend.entity.IndexStatus;
import prosno.backend.entity.Repository;
import prosno.backend.exceptions.BadRequestException;
import prosno.backend.exceptions.NotFoundException;
import prosno.backend.repository.RepositoryRepository;
import prosno.backend.services.UserService;
import prosno.backend.services.RateLimitingService;
import prosno.backend.services.ai.RagSettings;
import prosno.backend.services.github.GithubApiClient;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class IndexingService {
    private static final int VECTOR_BATCH_SIZE = 32;
    private static final int PROGRESS_EVERY_N_FILES = 5;

    private final RepositoryRepository repositoryRepository;
    private final UserService userService;
    private final GithubApiClient gitHubApiClient;
    private final CodeFileFilter fileFilter;
    private final CodeChunker codeChunker;
    private final VectorStore vectorStore;
    private final prosno.backend.repository.UserRepositoryRepository userRepositoryRepository;

    private final RateLimitingService rateLimitingService;

    @Value("${app.indexing.max-file-bytes:102400}")
    private long maxFileBytes;

    @Transactional(rollbackFor = prosno.backend.exceptions.RateLimitExceededException.class)
    public String tryStartIndexing(UUID repoId, UUID userId) {
        Repository repo = repositoryRepository.findByIdAndUserId(repoId, userId)
                .orElseThrow(() -> new NotFoundException("Repository not found"));

        if (repo.getIndexStatus() == IndexStatus.INDEXING) {
            return "ALREADY_IN_PROGRESS"; // Fast path: already indexing
        }
        
        if (repo.getIndexStatus() == IndexStatus.READY) {
            String token = userService.decryptAccessToken(userService.requiredById(userId));
            String latestSha = gitHubApiClient.getLatestCommitSha(token, repo.getOwner(), repo.getName(), repo.getDefaultBranch());
            if (latestSha != null && latestSha.equals(repo.getLastIndexedSha())) {
                return "ALREADY_UP_TO_DATE"; // Fast path: already up to date
            }
        }

        io.github.bucket4j.Bucket bucket = rateLimitingService.resolveBucket(userId);
        
        // Peek first: if no tokens, reject immediately without touching the DB
        if (bucket.getAvailableTokens() <= 0) {
            io.github.bucket4j.ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
            throw new prosno.backend.exceptions.RateLimitExceededException(
                    "You have reached your indexing limit. Please try again later.", 
                    probe.getNanosToWaitForRefill() / 1_000_000_000L);
        }

        int updatedCount = repositoryRepository.tryStartJob(repoId, IndexStatus.INDEXING, IndexStatus.PENDING, IndexStatus.FAILED, IndexStatus.READY, IndexStatus.EXPIRED);
        if (updatedCount > 0) {
            // We won the lock, now actually consume the token!
            io.github.bucket4j.ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
            if (!probe.isConsumed()) {
                // Highly unlikely edge case: token was consumed between peek and here by another thread for this user.
                // Throwing this exception will rollback the DB update (since this method is @Transactional)
                throw new prosno.backend.exceptions.RateLimitExceededException(
                        "You have reached your indexing limit. Please try again later.", 
                        probe.getNanosToWaitForRefill() / 1_000_000_000L);
            }
            return "STARTED_INDEXING";
        }
        
        return "ALREADY_IN_PROGRESS";
    }

    @Async("indexingExecutor")
    public void indexAsync(UUID repoId, UUID userId) {
        long startTime = System.currentTimeMillis();
        log.info("Indexing async task started - repoId: {}, userId: {}", repoId, userId);
        try {
            doIndex(repoId, userId);
        } catch (Throwable ex) {
            long duration = System.currentTimeMillis() - startTime;
            String safeMsg = sanitizeErrorMessage(ex.getMessage());
            log.error("Indexing failed for repoId: {} after {}ms: {}", repoId, duration, safeMsg, ex);
            
            try {
                log.info("Cleaning up partial vectors for failed repoId: {}", repoId);
                deleteExistingVectors(repoId.toString());
            } catch (Throwable cleanupEx) {
                log.warn("Failed to clean up vectors for repoId {}: {}", repoId, cleanupEx.getMessage());
            }
            
            try {
                markFailed(repoId, safeMsg);
            } catch (Throwable markEx) {
                log.error("FATAL: Could not mark repoId {} as FAILED: {}", repoId, markEx.getMessage(), markEx);
            }
        }
    }

    private void doIndex(UUID repoId, UUID userId) {
        long t0 = System.currentTimeMillis();
        Repository repo = repositoryRepository.findById(repoId)
                .orElseThrow(() -> new NotFoundException("Repository not found"));
        
        log.info("STAGE 1 [METADATA]: Fetching repository metadata for {} ({})", repo.getFullName(), repoId);

        String token = userService.decryptAccessToken(userService.requiredById(userId));
        
        String targetSha = gitHubApiClient.getLatestCommitSha(token, repo.getOwner(), repo.getName(), repo.getDefaultBranch());
        log.info("STAGE 1 [METADATA]: Target commit SHA for {}: {}", repo.getFullName(), targetSha);

        log.info("STAGE 2 [CLEANUP]: Deleting existing vectors for repoId: {}", repoId);
        deleteExistingVectors(repoId.toString());

        log.info("STAGE 3 [DOWNLOAD]: Downloading repo zip from GitHub for {} (branch: {})", repo.getFullName(), repo.getDefaultBranch());
        byte[] zipBytes = gitHubApiClient.downloadRepoZip(
                token, repo.getOwner(), repo.getName(), repo.getDefaultBranch());
                
        if (zipBytes == null || zipBytes.length == 0) {
            throw new RuntimeException("Failed to download repo zip: received empty response from GitHub");
        }
        log.info("STAGE 3 [DOWNLOAD]: Downloaded {} bytes of repo zip for {}", zipBytes.length, repo.getFullName());

        log.info("STAGE 4 [SCAN]: Scanning zip archive for eligible files in {}", repo.getFullName());
        int totalFiles = 0;
        try (java.util.zip.ZipInputStream zis = new java.util.zip.ZipInputStream(new java.io.ByteArrayInputStream(zipBytes))) {
            java.util.zip.ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (entry.isDirectory()) continue;
                String path = entry.getName();
                int firstSlash = path.indexOf('/');
                if (firstSlash >= 0) path = path.substring(firstSlash + 1);
                long size = entry.getSize() != -1 ? entry.getSize() : 0;
                if (fileFilter.isEligible(path, size, maxFileBytes)) {
                    totalFiles++;
                }
            }
        } catch (Exception ex) {
            throw new RuntimeException("Failed to scan repository zip: " + ex.getMessage(), ex);
        }

        log.info("STAGE 4 [SCAN]: Found {} eligible files in {}", totalFiles, repo.getFullName());
        updateProgress(repoId, totalFiles, 0, 0, IndexStatus.INDEXING, null);

        if (totalFiles == 0) {
            log.warn("Repository {} contains no eligible code files to index", repo.getFullName());
            markReady(repoId, 0, 0, 0, repo.getFullName(), targetSha);
            log.info("INDEXING_COMPLETED [EMPTY] - repoId: {}, durationMs: {}", repoId, (System.currentTimeMillis() - t0));
            return;
        }

        List<Document> batch = new ArrayList<>();
        int processed = 0;
        int totalChunks = 0;

        log.info("STAGE 5 [CHUNKING & EMBEDDINGS]: Processing files and creating embeddings for {}", repo.getFullName());

        try (java.util.zip.ZipInputStream zis = new java.util.zip.ZipInputStream(new java.io.ByteArrayInputStream(zipBytes))) {
            java.util.zip.ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (entry.isDirectory()) continue;
                String path = entry.getName();
                int firstSlash = path.indexOf('/');
                if (firstSlash >= 0) path = path.substring(firstSlash + 1);
                
                long size = entry.getSize() != -1 ? entry.getSize() : 0;
                if (!fileFilter.isEligible(path, size, maxFileBytes)) {
                    continue;
                }

                try {
                    java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
                    byte[] data = new byte[1024];
                    int read;
                    int bytesRead = 0;
                    boolean tooLarge = false;
                    
                    while ((read = zis.read(data, 0, data.length)) != -1) {
                        bytesRead += read;
                        if (bytesRead > maxFileBytes) {
                            tooLarge = true;
                            break; // Stop reading this file, it's too large
                        }
                        buffer.write(data, 0, read);
                    }
                    
                    if (tooLarge) {
                        log.warn("Skipping file {} in {}: Exceeds max file size limit during extraction", path, repo.getFullName());
                        continue;
                    }
                    
                    String content = new String(buffer.toByteArray(), java.nio.charset.StandardCharsets.UTF_8);

                    List<Document> chunks = codeChunker.chunkFile(repoId.toString(), path, content);
                    
                    for (Document chunk : chunks) {
                        batch.add(chunk);
                        totalChunks++;
                        if (batch.size() >= VECTOR_BATCH_SIZE) {
                            insertVectorBatch(repo.getFullName(), batch);
                            batch.clear();
                        }
                    }
                } catch (Exception ex) {
                    log.warn("Skipping file {} in {}: {}", path, repo.getFullName(), ex.getMessage());
                }

                processed++;
                if (processed % PROGRESS_EVERY_N_FILES == 0 || processed == totalFiles) {
                    updateProgress(repoId, totalFiles, processed, totalChunks, IndexStatus.INDEXING, null);
                }
            }
        } catch (Exception ex) {
            throw new RuntimeException("Failed to extract and process repo zip: " + ex.getMessage(), ex);
        }

        if (!batch.isEmpty()) {
            insertVectorBatch(repo.getFullName(), batch);
            batch.clear();
        }

        markReady(repoId, totalFiles, processed, totalChunks, repo.getFullName(), targetSha);
        log.info("STAGE 6 [COMPLETED]: repoId: {}, filesProcessed: {}/{}, totalChunks: {}, durationMs: {}", 
            repoId, processed, totalFiles, totalChunks, (System.currentTimeMillis() - t0));
    }

    private void insertVectorBatch(String repoFullName, List<Document> batch) {
        log.info("Generating embeddings and inserting {} vectors for {}", batch.size(), repoFullName);
        long t = System.currentTimeMillis();
        try {
            vectorStore.add(batch);
            log.info("Successfully inserted {} vectors for {} in {}ms", batch.size(), repoFullName, (System.currentTimeMillis() - t));
        } catch (Exception e) {
            log.error("Failed to add vector batch for {}: {}", repoFullName, e.getMessage(), e);
            throw new RuntimeException("Vector store insertion failed: " + sanitizeErrorMessage(e.getMessage()), e);
        }
    }

    private void deleteExistingVectors(String repoId) {
        try {
            var filter = new FilterExpressionBuilder().eq(RagSettings.METADATA_REPO_ID, repoId).build();
            vectorStore.delete(filter);
        } catch (Exception ex) {
            log.warn("Could not delete existing vectors for repo {}: {}", repoId, ex.getMessage());
        }
    }

    @Transactional
    public void updateProgress(
            UUID repoId,
            int total,
            int processed,
            int chunks,
            IndexStatus status,
            String error) {
        repositoryRepository.findById(repoId).ifPresent(repo -> {
            repo.setFilesTotal(total);
            repo.setFilesProcessed(processed);
            repo.setChunkCount(chunks);
            repo.setIndexStatus(status);
            repo.setErrorMessage(error);
            repo.setUpdatedAt(Instant.now());
            repositoryRepository.saveAndFlush(repo);
        });
    }

    @Transactional
    public void markReady(UUID repoId, int totalFiles, int processedFiles, int totalChunks, String fullName, String targetSha) {
        repositoryRepository.findById(repoId).ifPresent(repo -> {
            repo.setIndexStatus(IndexStatus.READY);
            repo.setFilesTotal(totalFiles);
            repo.setFilesProcessed(processedFiles);
            repo.setChunkCount(totalChunks);
            repo.setIndexedAt(Instant.now());
            repo.setLastIndexedSha(targetSha);
            repo.setErrorMessage(null);
            repo.setUpdatedAt(Instant.now());
            repositoryRepository.saveAndFlush(repo);
        });
        log.info("Indexed {} files ({} chunks) for {}", processedFiles, totalChunks, fullName);
    }

    @Transactional
    public void markFailed(UUID repoId, String message) {
        repositoryRepository.findById(repoId).ifPresent(repo -> {
            repo.setIndexStatus(IndexStatus.FAILED);
            String safeMsg = sanitizeErrorMessage(message);
            repo.setErrorMessage(safeMsg != null && safeMsg.length() > 2000
                    ? safeMsg.substring(0, 2000)
                    : safeMsg);
            repo.setUpdatedAt(Instant.now());
            repositoryRepository.saveAndFlush(repo);
        });
        log.warn("Marked repo {} as FAILED: {}", repoId, sanitizeErrorMessage(message));
    }

    private String sanitizeErrorMessage(String message) {
        if (message == null || message.isBlank()) {
            return "Unknown indexing error occurred.";
        }
        String clean = message
            .replaceAll("(?i)bearer\\s+[a-zA-Z0-9_\\-\\.]+", "Bearer [REDACTED]")
            .replaceAll("(?i)(gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{22,})", "[REDACTED_TOKEN]")
            .replaceAll("(?i)hf_[A-Za-z0-9]{16,}", "[REDACTED_TOKEN]")
            .replaceAll("(?i)(token|key|secret|password|auth)=([^& \\s]+)", "$1=[REDACTED]");
        if (clean.length() > 2000) {
            clean = clean.substring(0, 2000);
        }
        return clean;
    }

    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    @Transactional
    public void resetStuckJobs() {
        List<Repository> stuckRepos = repositoryRepository.findByIndexStatus(IndexStatus.INDEXING);
        for (Repository repo : stuckRepos) {
            log.info("Resetting stuck indexing job for repo {}", repo.getFullName());
            repo.setIndexStatus(IndexStatus.FAILED);
            repo.setErrorMessage("Indexing was interrupted because the server restarted.");
            repo.setUpdatedAt(Instant.now());
            repositoryRepository.saveAndFlush(repo);
        }
    }

    @Async
    public void forceReindexAllReadyRepos() {
        List<Repository> readyRepos = repositoryRepository.findByIndexStatus(IndexStatus.READY);
        log.info("Starting forced re-index of {} READY repos", readyRepos.size());
        int count = 0;
        
        for (Repository repo : readyRepos) {
            count++;
            log.info("Re-indexing {}/{} repos, current: {}", count, readyRepos.size(), repo.getFullName());
            try {
                // Get a valid user to download the zip
                List<prosno.backend.entity.UserRepository> userLinks = userRepositoryRepository.findByRepoId(repo.getId());
                if (userLinks.isEmpty()) {
                    log.warn("Skipping {}: no associated users to provide GitHub token", repo.getFullName());
                    continue;
                }
                UUID userId = userLinks.get(0).getUserId();
                
                // Try to grab the lock
                int updatedCount = repositoryRepository.tryStartJob(repo.getId(), IndexStatus.INDEXING, IndexStatus.PENDING, IndexStatus.FAILED, IndexStatus.READY, IndexStatus.EXPIRED);
                if (updatedCount == 0) {
                    log.warn("Skipping {}: could not acquire indexing lock (already indexing?)", repo.getFullName());
                    continue;
                }
                
                // We have the lock, bypass tryStartIndexing and rate limiting, call doIndex directly sequentially
                doIndex(repo.getId(), userId);
                
            } catch (Exception e) {
                log.error("Failed to force re-index repo {}", repo.getFullName(), e);
                log.info("Cleaning up partial vectors for failed repo {}", repo.getId());
                deleteExistingVectors(repo.getId().toString());
                markFailed(repo.getId(), e.getMessage());
            }
        }
        log.info("Finished forced re-index of all READY repos.");
    }

}