package prosno.backend.services.ai;

import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.ai.document.Document;

import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.jdbc.core.JdbcTemplate;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CodeContextRetriever {
    private static final String NO_MATCHES = "(no matching code chunks found)";

    private final JdbcTemplate jdbcTemplate;
    private final EmbeddingModel embeddingModel;
    private final CitationMapper citationMapper;

    public RetrievedContext retrieve(UUID repositoryId, String question) {
        // Generate embedding for the question
        float[] queryEmbedding = embeddingModel.embed(question);
        
        // Convert float array to pgvector string format: "[val1,val2,...]"
        String embeddingStr = java.util.Arrays.toString(queryEmbedding);

        // Execute Hybrid Search: Semantic Similarity (cosine distance) + Full-Text Search (BM25)
        // We use a simplified RRF (Reciprocal Rank Fusion) approximation by combining scores or just unioning results.
        // For simplicity and speed, we do a UNION of the top K vector matches and top K text matches.
        String sql = """
            WITH vector_matches AS (
                SELECT id, content, metadata, embedding <=> ?::vector AS distance
                FROM vector_store
                WHERE metadata->>'repoId' = ?
                ORDER BY distance ASC
                LIMIT ?
            ),
            text_matches AS (
                SELECT id, content, metadata, ts_rank(to_tsvector('english', content), plainto_tsquery('english', ?)) AS rank
                FROM vector_store
                WHERE metadata->>'repoId' = ?
                  AND to_tsvector('english', content) @@ plainto_tsquery('english', ?)
                ORDER BY rank DESC
                LIMIT ?
            )
            SELECT id, content, metadata FROM vector_matches
            UNION ALL
            SELECT id, content, metadata FROM text_matches
            LIMIT ?
        """;

        List<Document> documents = jdbcTemplate.query(
                sql,
                (rs, rowNum) -> {
                    String content = rs.getString("content");
                    String metadataJson = rs.getString("metadata");
                    // Parse metadata back to map
                    java.util.Map<String, Object> metadata = new java.util.HashMap<>();
                    try {
                        metadata = new com.fasterxml.jackson.databind.ObjectMapper().readValue(
                            metadataJson,
                            new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>() {}
                        );
                    } catch (Exception e) {}
                    return new Document(content, metadata);
                },
                embeddingStr, repositoryId.toString(), RagSettings.TOP_K_CHUNKS,
                question, repositoryId.toString(), question, RagSettings.TOP_K_CHUNKS,
                RagSettings.TOP_K_CHUNKS * 2
        );

        var citations = documents.stream()
                .map(citationMapper::fromDocument)
                .distinct()
                .toList();

        var contextText = documents.stream()
                .map(Document::getText)
                .collect(Collectors.joining("\n\n---\n\n"));

        if (contextText.isBlank()) {
            contextText = NO_MATCHES;
        }

        return new RetrievedContext(citations, contextText);
    }
}
