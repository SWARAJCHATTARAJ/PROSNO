package prosno.backend.services.indexing;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import org.springframework.ai.document.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import prosno.backend.services.ai.RagSettings;

@Component
public class CodeChunker {
    private final CodeFileFilter fileFilter;
    private final int maxChars;

    public CodeChunker(
            @Value("${app.indexing.chunk-size:800}") int chunkSize,
            CodeFileFilter fileFilter) {
        // Chunk size here is approximate token count, so maxChars = tokens * 4
        this.maxChars = chunkSize * 4;
        this.fileFilter = fileFilter;
    }

    public List<Document> chunkFile(String repoId, String filePath, String content) {
        if (content == null || content.isBlank()) {
            return List.of();
        }

        String language = fileFilter.detectLanguage(filePath);
        String header = "// File: " + filePath + "\n";
        
        List<String> chunks = chunkCode(content, maxChars);
        
        return IntStream.range(0, chunks.size())
                .mapToObj(i -> {
                    Document doc = new Document(header + chunks.get(i), baseMetadata(repoId, filePath, language));
                    return withChunkIndex(doc, repoId, filePath, language, i, content);
                })
                .toList();
    }

    private static List<String> chunkCode(String code, int maxChars) {
        // Split by end of blocks `\n}` or double newlines (blank lines)
        String[] blocks = code.split("(?<=\\n\\})\\s*\\n|\\n\\s*\\n");
        List<String> chunks = new java.util.ArrayList<>();
        StringBuilder currentChunk = new StringBuilder();

        for (String block : blocks) {
            if (currentChunk.length() + block.length() > maxChars && !currentChunk.isEmpty()) {
                chunks.add(currentChunk.toString().trim());
                currentChunk.setLength(0);
            }
            
            if (block.length() > maxChars) {
                // If a single block is still too large, split by individual lines
                String[] lines = block.split("\\n");
                for (String line : lines) {
                    if (currentChunk.length() + line.length() > maxChars && !currentChunk.isEmpty()) {
                        chunks.add(currentChunk.toString().trim());
                        currentChunk.setLength(0);
                    }
                    currentChunk.append(line).append("\n");
                }
            } else {
                currentChunk.append(block).append("\n\n");
            }
        }
        
        if (!currentChunk.isEmpty()) {
            chunks.add(currentChunk.toString().trim());
        }
        return chunks;
    }

    private static Map<String, Object> baseMetadata(String repoId, String filePath, String language) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put(RagSettings.METADATA_REPO_ID, repoId);
        metadata.put("filePath", filePath);
        metadata.put("language", language);
        return metadata;
    }

    private static Document withChunkIndex(
            Document chunk,
            String repoId,
            String filePath,
            String language,
            int chunkIndex,
            String fullContent) {
        Map<String, Object> metadata = new HashMap<>(chunk.getMetadata());
        metadata.put(RagSettings.METADATA_REPO_ID, repoId);
        metadata.put("filePath", filePath);
        metadata.put("language", language);
        metadata.put("chunkIndex", chunkIndex);

        String text = chunk.getText();
        String header = "// File: " + filePath + "\n";
        if (text.startsWith(header)) {
            text = text.substring(header.length());
        }
        // Basic indexOf - might be slightly off if there are overlaps/duplicates, 
        // but sufficient for citation links.
        int idx = fullContent.indexOf(text);
        if (idx >= 0) {
            int startLine = 1;
            for (int i = 0; i < idx; i++) {
                if (fullContent.charAt(i) == '\n') startLine++;
            }
            int endLine = startLine;
            for (int i = 0; i < text.length(); i++) {
                if (text.charAt(i) == '\n') endLine++;
            }
            metadata.put("startLine", startLine);
            metadata.put("endLine", endLine);
        }

        return new Document(chunk.getText(), metadata);
    }
}
