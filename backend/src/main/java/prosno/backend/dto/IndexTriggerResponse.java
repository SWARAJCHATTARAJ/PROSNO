package prosno.backend.dto;

public record IndexTriggerResponse(
        RepositoryResponse repository,
        String outcome
) {}