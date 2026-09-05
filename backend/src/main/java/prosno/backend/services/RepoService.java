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
    private final prosno.backend.repository.ChatSessionRepository chatSessionRepository;
    private final prosno.backend.repository.ChatMessageRepository chatMessageRepository;

    @Transactional(readOnly = true)
    public List<prosno.backend.dto.GithubRepoResponse> listUserGithubRepos(UUID userId) {
        User user = userService.requiredById(userId);
        String token = userService.decryptAccessToken(user);
        List<Map<String, Object>> remoteRepos = gitHubApiClient.listUserRepos(token);

        List<Repository> storedRepos = repositoryRepository.findByUserIdOrderByFullNameAsc(userId);
        Map<Long, Repository> storedByGithubId = storedRepos.stream()
                .filter(r -> r.getGithubRepoId() != null)
                .collect(java.util.stream.Collectors.toMap(Repository::getGithubRepoId, r -> r, (a, b) -> a));
        Map<String, Repository> storedByFullName = storedRepos.stream()
                .filter(r -> r.getFullName() != null)
                .collect(java.util.stream.Collectors.toMap(r -> r.getFullName().toLowerCase(), r -> r, (a, b) -> a));

        List<prosno.backend.dto.GithubRepoResponse> results = new ArrayList<>();
        for (Map<String, Object> remote : remoteRepos) {
            Long githubRepoId = toLong(remote.get("id"));
            String fullName = String.valueOf(remote.get("full_name"));
            String name = String.valueOf(remote.get("name"));
            String owner = remote.get("owner") instanceof Map<?, ?> om && om.get("login") != null 
                    ? String.valueOf(om.get("login")) : fullName.split("/")[0];
            boolean isPrivate = Boolean.TRUE.equals(remote.get("private"));
            String htmlUrl = remote.get("html_url") != null ? String.valueOf(remote.get("html_url")) : null;
            String description = remote.get("description") != null ? String.valueOf(remote.get("description")) : null;
            String defaultBranch = remote.get("default_branch") != null ? String.valueOf(remote.get("default_branch")) : "main";
            String language = remote.get("language") != null ? String.valueOf(remote.get("language")) : null;

            Repository connected = storedByGithubId.get(githubRepoId);
            if (connected == null && fullName != null) {
                connected = storedByFullName.get(fullName.toLowerCase());
            }

            boolean isConnected = connected != null;
            UUID connectedId = isConnected ? connected.getId() : null;
            prosno.backend.entity.IndexStatus status = isConnected ? connected.getIndexStatus() : null;

            results.add(new prosno.backend.dto.GithubRepoResponse(
                    githubRepoId,
                    name,
                    fullName,
                    owner,
                    isPrivate,
                    htmlUrl,
                    description,
                    defaultBranch,
                    language,
                    isConnected,
                    connectedId,
                    status
            ));
        }
        return results;
    }

    @Transactional
    public AddRepoResult connectRepo(UUID userId, Long githubRepoId, String fullName) {
        if (githubRepoId == null && (fullName == null || fullName.isBlank())) {
            throw new prosno.backend.exceptions.BadRequestException("Repository ID or full name must be provided");
        }

        User user = userService.requiredById(userId);
        String token = userService.decryptAccessToken(user);

        Map<String, Object> remote = null;
        if (githubRepoId != null) {
            try {
                remote = gitHubApiClient.getRepoById(token, githubRepoId);
            } catch (Exception ex) {
                if (fullName == null || fullName.isBlank()) {
                    throw ex;
                }
            }
        }

        if (remote == null && fullName != null && !fullName.isBlank()) {
            String[] parts = fullName.trim().split("/", 2);
            if (parts.length < 2) {
                throw new prosno.backend.exceptions.BadRequestException("Invalid repository format. Expected 'owner/name'.");
            }
            remote = gitHubApiClient.getRepo(token, parts[0], parts[1]);
        }

        if (remote == null) {
            throw new prosno.backend.exceptions.NotFoundException("Repository not found or not accessible on GitHub");
        }

        Long actualGithubRepoId = toLong(remote.get("id"));
        String actualFullName = String.valueOf(remote.get("full_name"));
        String[] parts = actualFullName.split("/", 2);
        String owner = remote.get("owner") instanceof Map<?, ?> om && om.get("login") != null 
                ? String.valueOf(om.get("login")) : (parts.length > 0 ? parts[0] : "unknown");
        String name = remote.get("name") != null ? String.valueOf(remote.get("name")) : (parts.length > 1 ? parts[1] : actualFullName);

        boolean isNew = false;
        Repository repo = repositoryRepository.findByGithubRepoId(actualGithubRepoId).orElse(null);
        if (repo == null) {
            repo = new Repository();
            repo.setGithubRepoId(actualGithubRepoId);
            repo.setOwner(owner);
            repo.setName(name);
            repo.setFullName(actualFullName);
            repo.setPrivate(Boolean.TRUE.equals(remote.get("private")));
            repo.setDefaultBranch(remote.get("default_branch") != null ? String.valueOf(remote.get("default_branch")) : "main");
            repo.setLanguage(remote.get("language") != null ? String.valueOf(remote.get("language")) : null);
            repo.setHtmlUrl(remote.get("html_url") != null ? String.valueOf(remote.get("html_url")) : null);
            repo.setDescription(remote.get("description") != null ? String.valueOf(remote.get("description")) : null);
            repo.setUpdatedAt(Instant.now());
            repo.setIndexStatus(prosno.backend.entity.IndexStatus.PENDING);
            repo = repositoryRepository.save(repo);
            isNew = true;
        } else {
            repo.setOwner(owner);
            repo.setName(name);
            repo.setFullName(actualFullName);
            repo.setPrivate(Boolean.TRUE.equals(remote.get("private")));
            repo.setDefaultBranch(remote.get("default_branch") != null ? String.valueOf(remote.get("default_branch")) : repo.getDefaultBranch());
            repo.setLanguage(remote.get("language") != null ? String.valueOf(remote.get("language")) : repo.getLanguage());
            repo.setHtmlUrl(remote.get("html_url") != null ? String.valueOf(remote.get("html_url")) : repo.getHtmlUrl());
            repo.setDescription(remote.get("description") != null ? String.valueOf(remote.get("description")) : repo.getDescription());
            repo.setUpdatedAt(Instant.now());
            repo = repositoryRepository.save(repo);
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
    public void disconnectRepo(UUID userId, UUID repoId) {
        Repository repo = requireOwned(repoId, userId);
        List<prosno.backend.entity.ChatSession> sessions = chatSessionRepository.findByUserIdAndRepositoryIdOrderByCreatedAtDesc(userId, repoId);
        for (prosno.backend.entity.ChatSession session : sessions) {
            chatMessageRepository.deleteBySessionId(session.getId());
            chatSessionRepository.delete(session);
        }
        userRepositoryRepository.deleteByUserIdAndRepoId(userId, repoId);
    }

    @Transactional
    public List<RepositoryResponse> refreshConnectedRepos(UUID userId) {
        User user = userService.requiredById(userId);
        String token = userService.decryptAccessToken(user);
        List<Repository> stored = repositoryRepository.findByUserIdOrderByFullNameAsc(userId);

        for (Repository repo : stored) {
            try {
                Map<String, Object> remote = gitHubApiClient.getRepo(token, repo.getOwner(), repo.getName());
                if (remote != null) {
                    repo.setDescription(remote.get("description") != null ? String.valueOf(remote.get("description")) : repo.getDescription());
                    repo.setDefaultBranch(remote.get("default_branch") != null ? String.valueOf(remote.get("default_branch")) : repo.getDefaultBranch());
                    repo.setLanguage(remote.get("language") != null ? String.valueOf(remote.get("language")) : repo.getLanguage());
                    repo.setUpdatedAt(Instant.now());
                    repositoryRepository.save(repo);
                }
            } catch (Exception ignored) {
            }
        }
        return listStored(userId);
    }

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
