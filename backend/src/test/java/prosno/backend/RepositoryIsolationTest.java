package prosno.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
import java.util.List;

import org.springframework.test.context.bean.override.mockito.MockitoBean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import static org.assertj.core.api.Assertions.assertThat;
import prosno.backend.services.ai.CodeContextRetriever;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class RepositoryIsolationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private CodeContextRetriever codeContextRetriever;

    @MockitoBean
    private org.springframework.ai.embedding.EmbeddingModel embeddingModel;

    @Test
    public void testVectorSearchIsIsolatedByRepository() {
        UUID repoA = UUID.randomUUID();
        UUID repoB = UUID.randomUUID();

        // Setup mock embedding model
        float[] mockEmbedding = new float[384];
        when(embeddingModel.embed(anyString())).thenReturn(mockEmbedding);

        // Generate synthetic embedding string (all zeros) for the test
        StringBuilder embeddingStr = new StringBuilder("[");
        for (int i = 0; i < 384; i++) {
            embeddingStr.append("0.0");
            if (i < 383) embeddingStr.append(",");
        }
        embeddingStr.append("]");

        // Insert mock vectors for Repo A
        String sql = "INSERT INTO vector_store (id, content, metadata, embedding) VALUES (?, ?, ?::jsonb, ?::vector)";
        jdbcTemplate.update(sql, UUID.randomUUID(), "Hello from Repo A", "{\"repoId\": \"" + repoA + "\"}", embeddingStr.toString());
        jdbcTemplate.update(sql, UUID.randomUUID(), "Goodbye from Repo A", "{\"repoId\": \"" + repoA + "\"}", embeddingStr.toString());

        // Insert mock vectors for Repo B
        jdbcTemplate.update(sql, UUID.randomUUID(), "Hello from Repo B", "{\"repoId\": \"" + repoB + "\"}", embeddingStr.toString());
        jdbcTemplate.update(sql, UUID.randomUUID(), "Top secret Repo B data", "{\"repoId\": \"" + repoB + "\"}", embeddingStr.toString());

        // Query Repo A
        var result = codeContextRetriever.retrieve(repoA, "Hello");

        // Assert that ONLY Repo A content is returned
        String contextText = result.contextText();
        assertThat(contextText).contains("Repo A");
        assertThat(contextText).doesNotContain("Repo B");
    }
}
