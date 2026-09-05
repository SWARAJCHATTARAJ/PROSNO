package prosno.backend.dto;

import java.util.UUID;
import prosno.backend.entity.IndexStatus;

public record GithubRepoResponse(
    Long id,
    String name,
    String fullName,
    String owner,
    boolean isPrivate,
    String htmlUrl,
    String description,
    String defaultBranch,
    String language,
    boolean connected,
    UUID connectedRepoId,
    IndexStatus indexStatus
) {}
