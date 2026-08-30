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
import prosno.backend.services.ai.RagSettings;
import prosno.backend.services.github.GithubApiClient;
import jakarta.transaction.Transactional;
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

    @Value("${app.indexing.max-file-bytes:102400}")
    private long maxFileBytes;

    public Repository startIndexing(UUID repoId, UUID userId) {
        Repository repo = repositoryRepository.findByIdAndUserId(repoId, userId)
                .orElseThrow(() -> new NotFoundException("Repository not found"));

        if (repo.getIndexStatus() == IndexStatus.INDEXING) {
            throw new BadRequestException("Repository is already being indexed");
        }

        repo.setIndexStatus(IndexStatus.INDEXING);
        repo.setFilesProcessed(0);
        repo.setFilesTotal(0);
        repo.setChunkCount(0);
        repo.setErrorMessage(null);
        repo.setUpdatedAt(Instant.now());
        return repositoryRepository.save(repo);
    }

    @Async("indexingExecutor")
    public void indexAsync(UUID repoId, UUID userId) {
        try {
            doIndex(repoId, userId);
        } catch (Exception ex) {
            log.error("Indexing failed for repo {}", repoId, ex);
            markFailed(repoId, ex.getMessage());
        }
    }

    private void doIndex(UUID repoId, UUID userId) {
        Repository repo = repositoryRepository.findById(repoId)
                .orElseThrow(() -> new NotFoundException("Repository not found"));
        String token = userService.decryptAccessToken(userService.requiredById(userId));

        deleteExistingVectors(repoId.toString());

        byte[] zipBytes = gitHubApiClient.downloadRepoZip(
                token, repo.getOwner(), repo.getName(), repo.getDefaultBranch());
                
        if (zipBytes == null) {
            throw new RuntimeException("Failed to download repo zip: received null from GitHub");
        }

        int totalFiles = 0;
        try (java.util.zip.ZipInputStream zis = new java.util.zip.ZipInputStream(new java.io.ByteArrayInputStream(zipBytes))) {
            java.util.zip.ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (entry.isDirectory()) continue;
                String path = entry.getName();
                int firstSlash = path.indexOf('/');
                if (firstSlash >= 0) path = path.substring(firstSlash + 1);
                // Uncompressed size might be -1 if unknown in ZIP header, but usually present. If -1, we pass 0 and let filter handle it.
                long size = entry.getSize() != -1 ? entry.getSize() : 0;
                if (fileFilter.isEligible(path, size, maxFileBytes)) {
                    totalFiles++;
                }
            }
        } catch (Exception ex) {
            throw new RuntimeException("Failed to parse repo zip", ex);
        }

        updateProgress(repoId, totalFiles, 0, 0, IndexStatus.INDEXING, null);

        List<Document> batch = new ArrayList<>();
        int processed = 0;
        int totalChunks = 0;

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
                            try {
                                vectorStore.add(batch);
                            } catch (Exception e) {
                                log.warn("Failed to add vector batch for {}: {}", repo.getFullName(), e.getMessage());
                            } finally {
                                batch.clear(); // Always clear to prevent OOM
                            }
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
            throw new RuntimeException("Failed to extract repo zip", ex);
        }

        if (!batch.isEmpty()) {
            try {
                vectorStore.add(batch);
            } catch (Exception e) {
                log.warn("Failed to add final vector batch for {}: {}", repo.getFullName(), e.getMessage());
            } finally {
                batch.clear();
            }
        }

        markReady(repoId, totalFiles, processed, totalChunks, repo.getFullName());
    }

    private void deleteExistingVectors(String repoId) {
        try {
            var filter = new FilterExpressionBuilder().eq(RagSettings.METADATA_REPO_ID, repoId).build();
            vectorStore.delete(filter);
        } catch (Exception ex) {
            log.warn("Could not delete existing vectors for repo {}: {}", repoId, ex.getMessage());
        }
    };

    @Transactional
    protected void updateProgress(
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
            repositoryRepository.save(repo);
        });
    }

    @Transactional
    protected void markReady(UUID repoId, int totalFiles, int processedFiles, int totalChunks, String fullName) {
        repositoryRepository.findById(repoId).ifPresent(repo -> {
            repo.setIndexStatus(IndexStatus.READY);
            repo.setFilesTotal(totalFiles);
            repo.setFilesProcessed(processedFiles);
            repo.setChunkCount(totalChunks);
            repo.setIndexedAt(Instant.now());
            repo.setErrorMessage(null);
            repo.setUpdatedAt(Instant.now());
            repositoryRepository.save(repo);
        });
        log.info("Indexed {} files ({} chunks) for {}", processedFiles, totalChunks, fullName);
    }

    @Transactional
    protected void markFailed(UUID repoId, String message) {
        repositoryRepository.findById(repoId).ifPresent(repo -> {
            repo.setIndexStatus(IndexStatus.FAILED);
            repo.setErrorMessage(message != null && message.length() > 2000
                    ? message.substring(0, 2000)
                    : message);
            repo.setUpdatedAt(Instant.now());
            repositoryRepository.save(repo);
        });
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
            repositoryRepository.save(repo);
        }
    }

}