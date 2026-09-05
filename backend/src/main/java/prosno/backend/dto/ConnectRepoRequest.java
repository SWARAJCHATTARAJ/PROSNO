package prosno.backend.dto;

public record ConnectRepoRequest(
    Long githubRepoId,
    String fullName
) {}
