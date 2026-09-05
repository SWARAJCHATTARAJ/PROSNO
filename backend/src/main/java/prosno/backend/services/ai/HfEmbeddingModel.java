package prosno.backend.services.ai;

import java.util.List;
import java.util.Map;

import org.springframework.ai.document.Document;
import org.springframework.ai.embedding.AbstractEmbeddingModel;
import org.springframework.ai.embedding.Embedding;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.ai.embedding.EmbeddingResponse;
import org.springframework.ai.embedding.EmbeddingResponseMetadata;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
@Primary
public class HfEmbeddingModel extends AbstractEmbeddingModel {

    private final RestClient restClient;

    public HfEmbeddingModel(
            @Value("${HUGGINGFACE_API_KEY:mock_key}") String apiKey) {
        org.springframework.http.client.SimpleClientHttpRequestFactory requestFactory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(java.time.Duration.ofSeconds(15));
        requestFactory.setReadTimeout(java.time.Duration.ofSeconds(45));

        this.restClient = RestClient.builder()
                .requestFactory(requestFactory)
                .baseUrl("https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction")
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, "application/json")
                .build();
    }

    public List<float[]> embed(List<String> texts) {
        var body = Map.of("inputs", texts);
        
        List<List<Double>> response = restClient.post()
                .body(body)
                .retrieve()
                .onStatus(status -> status.isError(), (req, res) -> {
                    String err = "";
                    try {
                        err = new String(res.getBody().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
                    } catch (Exception ignored) {}
                    throw new RuntimeException("Hugging Face API error (" + res.getStatusCode() + "): " + err);
                })
                .body(new ParameterizedTypeReference<List<List<Double>>>() {});

        if (response == null) {
            throw new RuntimeException("HuggingFace returned null embedding");
        }

        return response.stream().map(list -> {
            float[] arr = new float[list.size()];
            for (int i = 0; i < list.size(); i++) {
                arr[i] = list.get(i).floatValue();
            }
            return arr;
        }).toList();
    }

    @Override
    public float[] embed(String text) {
        return embed(List.of(text)).get(0);
    }

    @Override
    public float[] embed(Document document) {
        return embed(List.of(document.getText())).get(0);
    }

    @Override
    public EmbeddingResponse call(EmbeddingRequest request) {
        List<float[]> embeddings = embed(request.getInstructions());
        List<Embedding> result = new java.util.ArrayList<>();
        for (int i = 0; i < embeddings.size(); i++) {
            result.add(new Embedding(embeddings.get(i), i));
        }
        return new EmbeddingResponse(result, new EmbeddingResponseMetadata());
    }

    // AbstractEmbeddingModel method (Spring AI recent versions may have dimensions())
    public int dimensions() {
        return 384;
    }
}
