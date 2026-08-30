package prosno.backend.services.ai;

import java.util.List;

import prosno.backend.dto.CitationDto;

public record RetrievedContext(
        List<CitationDto> citations,
        String contextText) {
}
