package prosno.backend.dto;

import java.util.List;

public record ConnectBatchResponse(
    List<ConnectBatchItemResult> results
) {
    public record ConnectBatchItemResult(
        Long githubRepoId,
        String fullName,
        boolean success,
        RepositoryResponse repository,
        String outcome,
        String error
    ) {}
}
