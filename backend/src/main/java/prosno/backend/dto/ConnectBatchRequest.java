package prosno.backend.dto;

import java.util.List;

public record ConnectBatchRequest(
    List<ConnectRepoRequest> repositories
) {}
