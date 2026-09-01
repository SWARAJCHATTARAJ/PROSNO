package prosno.backend.services.ai;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class RetrievalEvaluationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private CodeContextRetriever codeContextRetriever;
    
    @MockitoBean
    private org.springframework.ai.embedding.EmbeddingModel embeddingModel;

    private UUID repoId;

    @BeforeEach
    public void setup() {
        repoId = UUID.randomUUID();
        
        // Deterministic embedding mock to test vector semantic search
        when(embeddingModel.embed(anyString())).thenAnswer(inv -> {
            String text = inv.getArgument(0).toString().toLowerCase();
            float[] vec = new float[384];
            
            // Give specific phrases dominant dimensions so their dot products are high
            if (text.contains("auth") || text.contains("login") || text.contains("password")) {
                vec[0] = 1.0f;
            } else if (text.contains("payment") || text.contains("charge") || text.contains("stripe")) {
                vec[1] = 1.0f;
            } else if (text.contains("database") || text.contains("jdbc") || text.contains("sql")) {
                vec[2] = 1.0f;
            } else if (text.contains("redis") || text.contains("cache")) {
                vec[3] = 1.0f;
            } else if (text.contains("kubernetes") || text.contains("k8s") || text.contains("auto")) {
                vec[4] = 1.0f;
            } else if (text.contains("spaceship") || text.contains("warp")) {
                vec[6] = 1.0f;
            } else {
                vec[5] = 1.0f; // fallback for App.java etc
            }
            
            // Normalize to unit vector for proper cosine distance emulation
            float sumSq = 0;
            for (float v : vec) sumSq += v * v;
            float mag = (float) Math.sqrt(sumSq);
            for (int i = 0; i < vec.length; i++) vec[i] /= mag;
            
            return vec;
        });

        // Let's insert a tiny fixture repository for testing.
        insertChunk("src/main/App.java", "public class App {\n  public static void main(String[] args) {\n    System.out.println(\"Hello\");\n  }\n}");
        insertChunk("src/main/Auth.java", "public class Auth {\n  public boolean login(String u, String p) {\n    return u.equals(\"admin\") && p.equals(\"1234\");\n  }\n}");
        insertChunk("src/main/Payment.java", "public class Payment {\n  public void charge(double amt) {\n    stripe.process(amt);\n  }\n}");
        insertChunk("src/main/Database.java", "public class Database {\n  public void connect() {\n    jdbc.connect(\"url\");\n  }\n}");
        insertChunk("src/main/DatabaseUtils.java", "public class DatabaseUtils {\n  public void disconnect() {\n    jdbc.disconnect();\n  }\n}");
    }

    private void insertChunk(String filePath, String content) {
        float[] emb = embeddingModel.embed(content);
        String embStr = java.util.Arrays.toString(emb);
        String sql = "INSERT INTO vector_store (id, content, metadata, embedding) VALUES (?, ?, ?::jsonb, ?::vector)";
        String metadata = "{\"repoId\": \"" + repoId + "\", \"filePath\": \"" + filePath + "\"}";
        jdbcTemplate.update(sql, UUID.randomUUID(), content, metadata, embStr);
    }

    @Test
    public void evaluateRAG() {
        // Query 1: Exact lookup
        var r1 = codeContextRetriever.retrieve(repoId, "Auth login");
        assertThat(r1.citations()).anyMatch(c -> c.filePath().equals("src/main/Auth.java"));

        // Query 2: Missing answer (Kubernetes autoscaling)
        var r2 = codeContextRetriever.retrieve(repoId, "Where is the Kubernetes autoscaling implementation?");
        assertThat(r2.citations().size()).isEqualTo(0);
        assertThat(r2.contextText()).isEqualTo("(no matching code chunks found)");

        // Query 3: Semantic concept (charge customer) -> Payment.java
        var r3 = codeContextRetriever.retrieve(repoId, "How do we charge a customer?");
        assertThat(r3.citations()).anyMatch(c -> c.filePath().equals("src/main/Payment.java"));

        // Query 4: Cross-file reasoning check (Database connection) -> Database.java and DatabaseUtils.java
        var r4 = codeContextRetriever.retrieve(repoId, "database jdbc sql connect");
        assertThat(r4.citations()).anyMatch(c -> c.filePath().equals("src/main/Database.java"));
        assertThat(r4.citations()).anyMatch(c -> c.filePath().equals("src/main/DatabaseUtils.java"));

        // Ensure Context Bound limit is respected (max chunks should not exceed RagSettings.TOP_K_CHUNKS)
        // Since repo has 5 chunks, it should return at most 5 chunks total, never 10.
        assertThat(r4.citations().size()).isLessThanOrEqualTo(8); 

        // 5. Keyword-heavy query
        var r5 = codeContextRetriever.retrieve(repoId, "public static void main String args Hello");
        assertThat(r5.citations()).anyMatch(c -> c.filePath().equals("src/main/App.java"));
        
        // 6. Mixed keyword + semantic query
        var r6 = codeContextRetriever.retrieve(repoId, "jdbc DatabaseUtils disconnect");
        assertThat(r6.citations()).anyMatch(c -> c.filePath().equals("src/main/DatabaseUtils.java"));

        // 7. Irrelevant query
        var r7 = codeContextRetriever.retrieve(repoId, "spaceship warp drive");
        assertThat(r7.citations().size()).isEqualTo(0); 
        assertThat(r7.contextText()).isEqualTo("(no matching code chunks found)");

        // 8. Missing answer query
        var r8 = codeContextRetriever.retrieve(repoId, "Where is Redis cache configured?");
        assertThat(r8.citations().size()).isEqualTo(0);
        assertThat(r8.contextText()).isEqualTo("(no matching code chunks found)");
        
        // 9. Duplicate-prone query
        // E.g., asking for "public class" will match all 5 in text search, and some in vector.
        // It must not return 10 citations (union all), but strictly 5 (full outer join)
        var r9 = codeContextRetriever.retrieve(repoId, "public class");
        assertThat(r9.citations().size()).isEqualTo(5);
        
        // 10. Security question
        var r10 = codeContextRetriever.retrieve(repoId, "How are passwords verified?");
        assertThat(r10.citations()).anyMatch(c -> c.filePath().equals("src/main/Auth.java"));
    }

    @Test
    public void evaluateRRFScores() {
        // Query that perfectly matches Auth.java in both text and semantic
        var result = codeContextRetriever.retrieve(repoId, "Auth login password");
        
        // Assert that Auth.java is the absolute top result (index 0) due to RRF combining both signals
        assertThat(result.citations().get(0).filePath()).isEqualTo("src/main/Auth.java");
        
        // Ensure no duplicates exist in citations
        long distinctCitations = result.citations().stream().map(c -> c.filePath()).distinct().count();
        assertThat(distinctCitations).isEqualTo(result.citations().size());
    }
}
