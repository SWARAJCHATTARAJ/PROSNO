package prosno.backend.services;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import prosno.backend.dto.IndexStatusResponse;
import prosno.backend.dto.RepositoryResponse;
import prosno.backend.entity.Repository;
import prosno.backend.entity.User;
import prosno.backend.exceptions.NotFoundException;
import prosno.backend.repository.RepositoryRepository;
import prosno.backend.services.github.GithubApiClient;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class RepoService {
    private final RepositoryRepository repositoryRepository;
    private final prosno.backend.repository.UserRepositoryRepository userRepositoryRepository;
    private final UserService userService;
    private final GithubApiClient gitHubApiClient;

    @Transactional
    public List<RepositoryResponse> syncAndListRepos(UUID userId) {
        User user = userService.requiredById(userId);
        String token = userService.decryptAccessToken(user);
        List<Map<String, Object>> remoteRepos = gitHubApiClient.listUserRepos(token);

        List<Repository> saved = new ArrayList<>();

        for (Map<String, Object> remote : remoteRepos) {
            Long githubRepoId = toLong(remote.get("id"));
            Repository repo = repositoryRepository
                    .findByGithubRepoId(githubRepoId)
                    .orElseGet(Repository::new);

            String fullName = String.valueOf(remote.get("full_name"));
            String[] parts = fullName.split("/", 2);

            repo.setGithubRepoId(githubRepoId);
            repo.setOwner(parts.length > 0 ? parts[0] : String.valueOf(remote.get("owner")));
            repo.setName(parts.length > 1 ? parts[1] : String.valueOf(remote.get("name")));
            repo.setFullName(fullName);
            repo.setPrivate(Boolean.TRUE.equals(remote.get("private")));
            repo.setDefaultBranch(remote.get("default_branch") != null
                    ? String.valueOf(remote.get("default_branch"))
                    : "main");
            repo.setLanguage(remote.get("language") != null ? String.valueOf(remote.get("language")) : null);
            repo.setHtmlUrl(remote.get("html_url") != null ? String.valueOf(remote.get("html_url")) : null);
            repo.setDescription(remote.get("description") != null ? String.valueOf(remote.get("description")) : null);
            repo.setUpdatedAt(Instant.now());
            if (repo.getOwner() == null || repo.getOwner().isBlank()) {
                Object ownerObj = remote.get("owner");
                if (ownerObj instanceof Map<?, ?> ownerMap && ownerMap.get("login") != null) {
                    repo.setOwner(String.valueOf(ownerMap.get("login")));
                }
            }
            Repository savedRepo = repositoryRepository.save(repo);
            saved.add(savedRepo);
            
            if (!userRepositoryRepository.existsByUserIdAndRepoId(userId, savedRepo.getId())) {
                userRepositoryRepository.save(
                    prosno.backend.entity.UserRepository.builder()
                        .userId(userId)
                        .repoId(savedRepo.getId())
                        .build()
                );
            }
        }

        return saved.stream()
                .sorted((a, b) -> a.getFullName().compareToIgnoreCase(b.getFullName()))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RepositoryResponse> listStored(UUID userId) {
        return repositoryRepository.findByUserIdOrderByFullNameAsc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Repository requireOwned(UUID repoId, UUID userId) {
        return repositoryRepository.findByIdAndUserId(repoId, userId)
                .orElseThrow(() -> new NotFoundException("Repository not found"));
    }

    @Transactional(readOnly = true)
    public IndexStatusResponse status(UUID repoId, UUID userId) {
        Repository repo = requireOwned(repoId, userId);
        return new IndexStatusResponse(
                repo.getId(),
                repo.getIndexStatus(),
                repo.getFilesTotal(),
                repo.getFilesProcessed(),
                repo.getChunkCount(),
                repo.getIndexedAt(),
                repo.getErrorMessage());
    }

    public RepositoryResponse toResponse(Repository repo) {
        return new RepositoryResponse(
                repo.getId(),
                repo.getGithubRepoId(),
                repo.getOwner(),
                repo.getName(),
                repo.getFullName(),
                repo.isPrivate(),
                repo.getDefaultBranch(),
                repo.getLanguage(),
                repo.getHtmlUrl(),
                repo.getDescription(),
                repo.getIndexStatus(),
                repo.getIndexedAt(),
                repo.getChunkCount(),
                repo.getFilesTotal(),
                repo.getFilesProcessed(),
                repo.getErrorMessage());
    }

    public record AddRepoResult(Repository repo, boolean isNew) {}

    @Transactional
    public AddRepoResult addPublicRepo(UUID userId, String input) {
        if (input == null || input.isBlank()) {
            throw new prosno.backend.exceptions.BadRequestException("Input cannot be empty");
        }

        String cleanInput = input.trim();
        if (cleanInput.startsWith("https://github.com/")) {
            cleanInput = cleanInput.substring("https://github.com/".length());
            if (cleanInput.endsWith(".git")) {
                cleanInput = cleanInput.substring(0, cleanInput.length() - 4);
            }
        } else if (cleanInput.startsWith("http://github.com/")) {
            cleanInput = cleanInput.substring("http://github.com/".length());
            if (cleanInput.endsWith(".git")) {
                cleanInput = cleanInput.substring(0, cleanInput.length() - 4);
            }
        }

        String[] parts = cleanInput.split("/");
        if (parts.length < 2) {
            throw new prosno.backend.exceptions.BadRequestException("Invalid repository format. Use 'owner/repo' or a GitHub URL.");
        }
        String owner = parts[0];
        String repoName = parts[1];

        User user = userService.requiredById(userId);
        String token = userService.decryptAccessToken(user);

        Map<String, Object> remote = gitHubApiClient.getRepo(token, owner, repoName);

        Long githubRepoId = toLong(remote.get("id"));

        boolean isNew = false;
        Repository repo = repositoryRepository.findByGithubRepoId(githubRepoId).orElse(null);
        if (repo == null) {
            repo = new Repository();
            repo.setGithubRepoId(githubRepoId);
            repo.setOwner(String.valueOf(remote.get("owner") instanceof Map<?, ?> ownerMap && ownerMap.get("login") != null ? ownerMap.get("login") : owner));
            repo.setName(String.valueOf(remote.get("name") != null ? remote.get("name") : repoName));
            repo.setFullName(repo.getOwner() + "/" + repo.getName());
            repo.setPrivate(Boolean.TRUE.equals(remote.get("private")));
            repo.setDefaultBranch(remote.get("default_branch") != null
                    ? String.valueOf(remote.get("default_branch"))
                    : "main");
            repo.setLanguage(remote.get("language") != null ? String.valueOf(remote.get("language")) : null);
            repo.setHtmlUrl(remote.get("html_url") != null ? String.valueOf(remote.get("html_url")) : null);
            repo.setDescription(remote.get("description") != null ? String.valueOf(remote.get("description")) : null);
            repo.setUpdatedAt(Instant.now());
            repo.setIndexStatus(prosno.backend.entity.IndexStatus.PENDING);
            repo = repositoryRepository.save(repo);
            isNew = true;
        }

        if (!userRepositoryRepository.existsByUserIdAndRepoId(userId, repo.getId())) {
            userRepositoryRepository.save(
                prosno.backend.entity.UserRepository.builder()
                    .userId(userId)
                    .repoId(repo.getId())
                    .build()
            );
        }

        return new AddRepoResult(repo, isNew);
    }

    @Transactional
    public void updateLastAccessedAt(UUID repoId) {
        repositoryRepository.findById(repoId).ifPresent(repo -> {
            repo.setLastAccessedAt(Instant.now());
            repositoryRepository.save(repo);
        });
    }

    private static Long toLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(String.valueOf(value));
    }
}
