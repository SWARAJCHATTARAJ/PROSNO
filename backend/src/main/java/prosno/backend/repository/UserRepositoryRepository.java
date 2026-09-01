package prosno.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import prosno.backend.entity.UserRepository;

@Repository
public interface UserRepositoryRepository extends JpaRepository<UserRepository, UUID> {
    Optional<UserRepository> findByUserIdAndRepoId(UUID userId, UUID repoId);
    List<UserRepository> findByUserId(UUID userId);
    List<UserRepository> findByRepoId(UUID repoId);
    boolean existsByUserIdAndRepoId(UUID userId, UUID repoId);
    void deleteByRepoId(UUID repoId);
}
