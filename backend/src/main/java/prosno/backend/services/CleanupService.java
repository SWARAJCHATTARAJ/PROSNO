package prosno.backend.services;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import prosno.backend.entity.IndexStatus;
import prosno.backend.entity.Repository;
import prosno.backend.repository.RepositoryRepository;
import prosno.backend.repository.UserRepositoryRepository;
import prosno.backend.repository.ChatSessionRepository;
import prosno.backend.repository.ChatMessageRepository;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.ai.vectorstore.filter.FilterExpressionBuilder;
import prosno.backend.services.ai.RagSettings;

@Service
@RequiredArgsConstructor
@Slf4j
public class CleanupService {

    private final RepositoryRepository repositoryRepository;
    private final UserRepositoryRepository userRepositoryRepository;
    private final prosno.backend.repository.ChatSessionRepository chatSessionRepository;
    private final prosno.backend.repository.ChatMessageRepository chatMessageRepository;
    
    @org.springframework.context.annotation.Lazy
    @org.springframework.beans.factory.annotation.Autowired
    private CleanupService self;
    private final VectorStore vectorStore;

    @Value("${app.cleanup.soft-expiry-days:30}")
    private int softExpiryDays;

    @Value("${app.cleanup.hard-delete-days:60}")
    private int hardDeleteDays;

    @Value("${app.cleanup.dry-run:true}")
    private boolean dryRun;

    @Value("${app.cleanup.batch-size:100}")
    private int batchSize;

    // Run every day at 3 AM
    @Scheduled(cron = "${app.cleanup.cron:0 0 3 * * ?}")
    public void scheduledCleanup() {
        String correlationId = "sys-clean-" + UUID.randomUUID().toString().substring(0, 8);
        org.slf4j.MDC.put(prosno.backend.config.CorrelationIdFilter.CORRELATION_ID_LOG_VAR, correlationId);
        try {
            long t0 = System.currentTimeMillis();
            log.info("cleanup run started (dryRun={})", dryRun);
            runCleanup(dryRun);
            log.info("cleanup run completed in {}ms", (System.currentTimeMillis() - t0));
        } finally {
            org.slf4j.MDC.remove(prosno.backend.config.CorrelationIdFilter.CORRELATION_ID_LOG_VAR);
        }
    }

    public void runCleanup(boolean isDryRun) {
        Instant now = Instant.now();
        Instant softThreshold = now.minus(softExpiryDays, ChronoUnit.DAYS);
        Instant hardThreshold = now.minus(hardDeleteDays, ChronoUnit.DAYS);

        log.info("Cleanup thresholds: softExpiry (lastAccessedAt) before {}, hardDelete (expiredAt) before {}", softThreshold, hardThreshold);

        org.springframework.data.domain.Pageable page = org.springframework.data.domain.PageRequest.of(0, batchSize);
        List<Repository> hardDeleteCandidates = repositoryRepository.findCandidatesForHardDelete(hardThreshold, IndexStatus.EXPIRED, page);
        List<Repository> softExpiryCandidates = repositoryRepository.findCandidatesForSoftExpiry(softThreshold, IndexStatus.INDEXING, IndexStatus.EXPIRED, page);

        log.info("Cleanup parameters - dryRun: {}, batch size: {}, hard-delete candidates: {}, soft-expiry candidates: {}", 
            isDryRun, batchSize, hardDeleteCandidates.size(), softExpiryCandidates.size());

        int hardDeleted = 0;
        for (Repository repo : hardDeleteCandidates) {
            try {
                if (isDryRun) {
                    log.info("[DRY RUN] WOULD DELETE repository: {}", repo.getId()); // Using ID to avoid logging repo names
                } else {
                    self.hardDeleteRepository(repo);
                    log.info("Hard-deleted repository: {}", repo.getId());
                }
                hardDeleted++;
            } catch (Exception e) {
                log.error("Failed to hard-delete repository {}", repo.getId(), e);
            }
        }

        int softExpired = 0;
        int skippedIndexing = 0;
        for (Repository repo : softExpiryCandidates) {
            if (repo.getIndexStatus() == IndexStatus.INDEXING) {
                skippedIndexing++;
                continue;
            }
            try {
                if (isDryRun) {
                    log.info("[DRY RUN] WOULD EXPIRE repository: {}", repo.getId());
                } else {
                    self.softExpireRepository(repo);
                    log.info("Soft-expired repository: {}", repo.getId());
                }
                softExpired++;
            } catch (Exception e) {
                log.error("Failed to soft-expire repository {}", repo.getId(), e);
            }
        }

        log.info("Cleanup summary - soft-expired count: {}, hard-deleted count: {}, skipped INDEXING count: {}", 
            softExpired, hardDeleted, skippedIndexing);
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void softExpireRepository(Repository repo) {
        Repository current = repositoryRepository.findByIdWithLock(repo.getId()).orElse(null);
        if (current == null || current.getIndexStatus() == IndexStatus.INDEXING || current.getIndexStatus() == IndexStatus.EXPIRED) {
            log.info("Skipping soft expiry for {} as its status is {}", repo.getFullName(), current != null ? current.getIndexStatus() : "null");
            return;
        }

        // 1. Delete vectors
        try {
            var filter = new FilterExpressionBuilder().eq(RagSettings.METADATA_REPO_ID, current.getId().toString()).build();
            vectorStore.delete(filter);
        } catch (Exception ex) {
            log.warn("Could not delete vectors during soft expiry for {}: {}", current.getFullName(), ex.getMessage());
            // Proceed anyway to mark it EXPIRED, since we might have already deleted them
        }

        // 2. Mark as EXPIRED, reset chunks
        current.setIndexStatus(IndexStatus.EXPIRED);
        current.setExpiredAt(Instant.now());
        current.setChunkCount(0);
        current.setFilesProcessed(0);
        current.setFilesTotal(0);
        current.setUpdatedAt(Instant.now());
        repositoryRepository.save(current);
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void hardDeleteRepository(Repository repo) {
        Repository current = repositoryRepository.findByIdWithLock(repo.getId()).orElse(null);
        if (current == null || current.getIndexStatus() != IndexStatus.EXPIRED || current.getExpiredAt() == null) {
            log.info("Skipping hard delete for {} as it is no longer EXPIRED", repo.getFullName());
            return;
        }

        userRepositoryRepository.deleteByRepoId(current.getId());
        
        // Explicitly cascade delete chat sessions and messages since there is no DB-level FK constraint.
        // If we don't do this, they safely float (unreachable via UI due to requireOwned checks),
        // but it's better to clean them up so they don't take up space when the repository is gone.
        List<prosno.backend.entity.ChatSession> sessions = chatSessionRepository.findByRepositoryId(current.getId());
        for (prosno.backend.entity.ChatSession session : sessions) {
            chatMessageRepository.deleteBySessionId(session.getId());
        }
        if (!sessions.isEmpty()) {
            chatSessionRepository.deleteByRepositoryId(current.getId());
        }

        repositoryRepository.delete(current);
    }
}
