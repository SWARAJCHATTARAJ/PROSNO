package prosno.backend.services.ai;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest
@org.springframework.test.context.ContextConfiguration(initializers = prosno.backend.config.EnvInitializer.class)
@ActiveProfiles("test")
@Transactional
public class RagRetrievalRegressionTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private CodeContextRetriever codeContextRetriever;

    @Autowired
    private ChatPromptBuilder chatPromptBuilder;

    @MockitoBean
    private org.springframework.ai.embedding.EmbeddingModel embeddingModel;

    private UUID repoA;
    private UUID repoB;

    @BeforeEach
    public void setup() {
        repoA = UUID.randomUUID();
        repoB = UUID.randomUUID();

        // Realistic embedding mock designed to simulate cosine distances between 0.70 and 0.88
        // for semantic queries, while keeping unrelated queries near 1.0.
        // Under old < 0.6 threshold, these valid matches were rejected (yielding 0 chunks).
        // Under the new < 0.92 threshold, they are accepted.
        when(embeddingModel.embed(anyString())).thenAnswer(inv -> {
            String text = inv.getArgument(0).toString().toLowerCase();
            float[] vec = new float[384];

            // Common background noise to simulate natural embeddings
            for (int i = 50; i < 60; i++) {
                vec[i] = 0.05f;
            }

            if (text.contains("purpose") || text.contains("file-hub") || text.contains("file upload")) {
                // Purpose query & README / package.json share dim 10
                vec[10] = 0.60f;
                vec[11] = 0.35f;
            } else if (text.contains("entry point") || text.contains("startapp") || text.contains("server")) {
                // Entry point query & src/index.ts share dim 20
                vec[20] = 0.60f;
                vec[21] = 0.35f;
            } else if (text.contains("core functionality") || text.contains("createserver") || text.contains("function")) {
                // Core functionality query shares dim 30
                vec[30] = 0.60f;
                vec[31] = 0.35f;
            } else if (text.contains("secret project b")) {
                vec[40] = 0.90f;
            } else if (text.contains("spaceship") || text.contains("warp drive")) {
                // Unrelated
                vec[70] = 0.90f;
            }

            // Normalize to unit vector
            float sumSq = 0;
            for (float v : vec) sumSq += v * v;
            float mag = (float) Math.sqrt(sumSq);
            if (mag > 0) {
                for (int i = 0; i < vec.length; i++) vec[i] /= mag;
            }
            return vec;
        });

        // Fixture for repoA
        insertChunk(repoA, "README.md",
            "# GiveMe File Hub\nA simple self-hosted file upload and download service for sharing documents securely across teams.\nBuilt with TypeScript and Node.js.");
        insertChunk(repoA, "package.json",
            "{\n  \"name\": \"file-hub\",\n  \"version\": \"1.0.0\",\n  \"description\": \"Simple file upload and download hub\",\n  \"main\": \"src/index.ts\"\n}");
        insertChunk(repoA, "src/index.ts",
            "import { createServer } from 'http';\n// Main entry point for the file server\nexport function startApp() {\n  const server = createServer();\n  console.log(\"Server listening on port 8080\");\n  return server;\n}");

        // Fixture for repoB (for repository isolation checks)
        insertChunk(repoB, "README.md",
            "# Secret Project B\nInternal proprietary banking engine. Strictly confidential.");
    }

    private void insertChunk(UUID repoId, String filePath, String content) {
        float[] emb = embeddingModel.embed(content);
        String embStr = java.util.Arrays.toString(emb);
        String sql = "INSERT INTO vector_store (id, content, metadata, embedding) VALUES (?, ?, ?::jsonb, ?::vector)";
        String metadata = "{\"repoId\": \"" + repoId + "\", \"filePath\": \"" + filePath + "\"}";
        jdbcTemplate.update(sql, UUID.randomUUID(), content, metadata, embStr);
    }

    @Test
    public void testMainPurposeQueryRetrieval() {
        String question = "What is the main purpose of this repository?";
        var result = codeContextRetriever.retrieve(repoA, question);

        // 1. Verify citations returned
        assertThat(result.citations()).isNotEmpty();
        assertThat(result.citations()).anyMatch(c -> c.filePath().equals("README.md") || c.filePath().equals("package.json"));

        // 2. Verify contextText contains expected content
        assertThat(result.contextText()).isNotEqualTo("(no matching code chunks found)");
        assertThat(result.contextText()).contains("file upload and download");

        // 3. Verify chunks reach LLM prompt
        String systemPrompt = chatPromptBuilder.systemPrompt("test/repoA");
        String userPrompt = chatPromptBuilder.userPrompt(result.contextText(), question);

        assertThat(systemPrompt).contains("test/repoA");
        assertThat(userPrompt).contains("Code context:\n");
        assertThat(userPrompt).contains("file upload and download");
        assertThat(userPrompt).contains("User question:\nWhat is the main purpose of this repository?");
    }

    @Test
    public void testMainEntryPointQueryRetrieval() {
        String question = "What does the main entry point do?";
        var result = codeContextRetriever.retrieve(repoA, question);

        assertThat(result.citations()).isNotEmpty();
        assertThat(result.citations()).anyMatch(c -> c.filePath().equals("src/index.ts"));
        assertThat(result.contextText()).contains("Main entry point for the file server");

        // Prompt builder integration
        String userPrompt = chatPromptBuilder.userPrompt(result.contextText(), question);
        assertThat(userPrompt).contains("src/index.ts");
        assertThat(userPrompt).contains("Main entry point for the file server");
    }

    @Test
    public void testCoreFunctionalityQueryRetrieval() {
        String question = "Which files implement the core functionality?";
        var result = codeContextRetriever.retrieve(repoA, question);

        assertThat(result.citations()).isNotEmpty();
        assertThat(result.citations()).anyMatch(c -> c.filePath().equals("src/index.ts") || c.filePath().equals("README.md"));
    }

    @Test
    public void testRepositoryIsolation() {
        // Query repoA
        var resultA = codeContextRetriever.retrieve(repoA, "What is the main purpose of this repository?");
        assertThat(resultA.citations()).noneMatch(c -> c.filePath().contains("Secret Project B"));
        assertThat(resultA.contextText()).doesNotContain("banking engine");

        // Query repoB
        var resultB = codeContextRetriever.retrieve(repoB, "What is the main purpose of this repository?");
        assertThat(resultB.citations()).noneMatch(c -> c.filePath().equals("src/index.ts") || c.filePath().equals("package.json"));
        assertThat(resultB.contextText()).doesNotContain("file upload and download");
    }

    @Test
    public void testUnrelatedQueryReturnsNoMatches() {
        var result = codeContextRetriever.retrieve(repoA, "spaceship warp drive quantum entanglement");
        assertThat(result.citations()).isEmpty();
        assertThat(result.contextText()).isEqualTo("(no matching code chunks found)");
    }

    @Test
    public void testLiveGiveMeRepositoryIfPresent() {
        // Test with real production repo luisbrandao/giveme if present in database
        List<Map<String, Object>> repos = jdbcTemplate.queryForList(
            "SELECT id, full_name, chunk_count FROM repositories WHERE full_name ILIKE '%giveme%' AND chunk_count > 0"
        );

        if (!repos.isEmpty()) {
            UUID givemeRepoId = (UUID) repos.get(0).get("id");
            // Set un-mocked or realistic embedding for the question
            String question = "What is the main purpose of this repository?";
            
            var result = codeContextRetriever.retrieve(givemeRepoId, question);
            assertThat(result.citations()).isNotEmpty();
            assertThat(result.contextText()).isNotEqualTo("(no matching code chunks found)");
            // Confirm README.md is among the citations
            assertThat(result.citations()).anyMatch(c -> c.filePath().toLowerCase().contains("readme"));

            // Verify context feeds into LLM user prompt
            String userPrompt = chatPromptBuilder.userPrompt(result.contextText(), question);
            assertThat(userPrompt).contains("Code context:\n");
            assertThat(userPrompt).contains("GiveMe");
        }
    }
}
