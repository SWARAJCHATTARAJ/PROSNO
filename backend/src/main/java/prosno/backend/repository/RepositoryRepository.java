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

    @Modifying
    @Query("UPDATE Repository r SET r.indexStatus = :indexing, r.filesProcessed = 0, r.filesTotal = 0, r.chunkCount = 0, r.errorMessage = null, r.updatedAt = CURRENT_TIMESTAMP WHERE r.id = :id AND r.indexStatus IN (:pending, :failed, :ready)")
    int tryStartJob(
        @Param("id") UUID id, 
        @Param("indexing") IndexStatus indexing, 
        @Param("pending") IndexStatus pending, 
        @Param("failed") IndexStatus failed,
        @Param("ready") IndexStatus ready);

    Optional<Repository> findByGithubRepoId(Long githubRepoId);

    List<Repository> findByIndexStatus(IndexStatus status);
}
