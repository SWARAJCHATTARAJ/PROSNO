package prosno.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import prosno.backend.entity.IndexStatus;
import prosno.backend.entity.Repository;

public interface RepositoryRepository extends JpaRepository<Repository, UUID> {
    @Query("SELECT r FROM Repository r JOIN UserRepository ur ON r.id = ur.repoId WHERE ur.userId = :userId ORDER BY r.fullName ASC")
    List<Repository> findByUserIdOrderByFullNameAsc(@Param("userId") UUID userId);

    @Query("SELECT r FROM Repository r JOIN UserRepository ur ON r.id = ur.repoId WHERE r.id = :id AND ur.userId = :userId")
    Optional<Repository> findByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM Repository r WHERE r.id = :id")
    Optional<Repository> findByIdWithLock(@Param("id") UUID id);

    @Modifying
    @Query("UPDATE Repository r SET r.indexStatus = :indexing, r.expiredAt = null, r.filesProcessed = 0, r.filesTotal = 0, r.chunkCount = 0, r.errorMessage = null, r.updatedAt = CURRENT_TIMESTAMP WHERE r.id = :id AND r.indexStatus IN (:pending, :failed, :ready, :expired)")
    int tryStartJob(
        @Param("id") UUID id, 
        @Param("indexing") IndexStatus indexing, 
        @Param("pending") IndexStatus pending, 
        @Param("failed") IndexStatus failed,
        @Param("ready") IndexStatus ready,
        @Param("expired") IndexStatus expired);

    Optional<Repository> findByGithubRepoId(Long githubRepoId);

    List<Repository> findByIndexStatus(IndexStatus status);

    @Query("SELECT r FROM Repository r WHERE r.lastAccessedAt < :threshold AND r.indexStatus NOT IN (:indexing, :expired)")
    List<Repository> findCandidatesForSoftExpiry(
        @Param("threshold") java.time.Instant threshold,
        @Param("indexing") IndexStatus indexing,
        @Param("expired") IndexStatus expired,
        org.springframework.data.domain.Pageable pageable);

    @Query("SELECT r FROM Repository r WHERE r.expiredAt < :threshold AND r.indexStatus = :expired")
    List<Repository> findCandidatesForHardDelete(
        @Param("threshold") java.time.Instant threshold,
        @Param("expired") IndexStatus expired,
        org.springframework.data.domain.Pageable pageable);
}
