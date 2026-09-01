package prosno.backend.services.ai;

import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.ai.document.Document;

import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.jdbc.core.JdbcTemplate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class CodeContextRetriever {
    private static final String NO_MATCHES = "(no matching code chunks found)";

    private final JdbcTemplate jdbcTemplate;
    private final EmbeddingModel embeddingModel;
    private final CitationMapper citationMapper;

    public RetrievedContext retrieve(UUID repositoryId, String question) {
        long t0 = System.currentTimeMillis();
        // Generate embedding for the question
        float[] queryEmbedding = embeddingModel.embed(question);
        long t1 = System.currentTimeMillis();
        
        // Convert float array to pgvector string format: "[val1,val2,...]"
        String embeddingStr = java.util.Arrays.toString(queryEmbedding);

        // Execute Hybrid Search: Semantic Similarity (cosine distance) + Full-Text Search (BM25)
        // We use a simplified RRF (Reciprocal Rank Fusion) approximation by combining scores or just unioning results.
        // For simplicity and speed, we do a UNION of the top K vector matches and top K text matches.
        String sql = """
            WITH vector_matches AS (
                SELECT id, content, metadata,
                       ROW_NUMBER() OVER (ORDER BY embedding <=> ?::vector ASC) as rn
                FROM vector_store
                WHERE metadata->>'repoId' = ?
                  AND embedding <=> ?::vector < 0.6
                ORDER BY embedding <=> ?::vector ASC
                LIMIT ?
            ),
            text_matches_raw AS (
                SELECT id, content, metadata,
                       ts_rank(to_tsvector('english', content), plainto_tsquery('english', ?)) AS rank
                FROM vector_store
                WHERE metadata->>'repoId' = ?
                  AND to_tsvector('english', content) @@ plainto_tsquery('english', ?)
            ),
            text_matches AS (
                SELECT id, content, metadata,
                       ROW_NUMBER() OVER (ORDER BY rank DESC) as rn
                FROM text_matches_raw
                ORDER BY rank DESC
                LIMIT ?
            )
            SELECT COALESCE(v.id, t.id) as id,
                   COALESCE(v.content, t.content) as content,
                   COALESCE(v.metadata, t.metadata) as metadata,
                   (COALESCE(1.0 / (60 + v.rn), 0.0) + COALESCE(1.0 / (60 + t.rn), 0.0)) AS rrf_score
            FROM vector_matches v
            FULL OUTER JOIN text_matches t ON v.id = t.id
            ORDER BY rrf_score DESC
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
                embeddingStr, repositoryId.toString(), embeddingStr, embeddingStr, RagSettings.TOP_K_CHUNKS,
                question, repositoryId.toString(), question,
                RagSettings.TOP_K_CHUNKS,
                RagSettings.TOP_K_CHUNKS
        );
        long t2 = System.currentTimeMillis();

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
        long t3 = System.currentTimeMillis();
        
        log.info("RAG Retrieval completed - repoId: {}, chunkCount: {}, contextSizeBytes: {}, embeddingMs: {}, dbHybridSearchMs: {}, contextBuildMs: {}", 
            repositoryId, documents.size(), contextText.length(), (t1 - t0), (t2 - t1), (t3 - t2));

        return new RetrievedContext(citations, contextText);
    }
}
