package prosno.backend.services.github;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class GithubApiClient {

    private static final String API_BASE = "https://api.github.com";

    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST_MAP = new ParameterizedTypeReference<>() {
    };
    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {
    };

    private final RestClient.Builder restClientBuilder;

    public List<Map<String, Object>> listUserRepos(String accessToken) {
        List<Map<String, Object>> all = new ArrayList<>();
        int page = 1;
        while (page <= 10) {
            final int currentPage = page;
            List<Map<String, Object>> pageRepos = client(accessToken)
                    .get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/user/repos")
                            .queryParam("affiliation", "owner,collaborator,organization_member")
                            .queryParam("sort", "updated")
                            .queryParam("per_page", 100)
                            .queryParam("page", currentPage)
                            .build())
                    .retrieve()
                    .body(LIST_MAP);
            if (pageRepos == null || pageRepos.isEmpty()) {
                break;
            }
            all.addAll(pageRepos);
            if (pageRepos.size() < 100) {
                break;
            }
            page++;
        }
        return all;
    }

    public Map<String, Object> getRepoTree(String accessToken, String owner, String repo, String branch) {
        return client(accessToken)
                .get()
                .uri("/repos/{owner}/{repo}/git/trees/{branch}?recursive=1", owner, repo, branch)
                .retrieve()
                .body(MAP);
    }

    public String getFileContent(String accessToken, String owner, String repo, String path) {
        Map<String, Object> body = client(accessToken)
                .get()
                .uri("/repos/{owner}/{repo}/contents/{path}", owner, repo, path)
                .retrieve()
                .body(MAP);
        if (body == null) {
            return null;
        }
        Object encoding = body.get("encoding");
        Object content = body.get("content");
        if (content == null) {
            return null;
        }
        if ("base64".equals(String.valueOf(encoding))) {
            String raw = String.valueOf(content).replaceAll("\\s", "");
            return new String(Base64.getDecoder().decode(raw), StandardCharsets.UTF_8);
        }
        return String.valueOf(content);
    }

    public byte[] downloadRepoZip(String accessToken, String owner, String repo, String branch) {
        return client(accessToken)
                .get()
                .uri("/repos/{owner}/{repo}/zipball/{branch}", owner, repo, branch)
                .exchange((request, response) -> {
                    if (response.getStatusCode().is3xxRedirection()) {
                        String location = response.getHeaders().getFirst(HttpHeaders.LOCATION);
                        if (location != null) {
                            return client(accessToken).get().uri(location).retrieve().body(byte[].class);
                        }
                    }
                    return response.bodyTo(byte[].class);
                });
    }

    public String getLatestCommitSha(String accessToken, String owner, String repo, String branch) {
        Map<String, Object> body = client(accessToken)
                .get()
                .uri("/repos/{owner}/{repo}/commits/{branch}", owner, repo, branch)
                .retrieve()
                .body(MAP);
        if (body != null && body.containsKey("sha")) {
            return String.valueOf(body.get("sha"));
        }
        return null;
    }

    public Map<String, Object> getRepo(String accessToken, String owner, String repo) {
        return client(accessToken)
                .get()
                .uri("/repos/{owner}/{repo}", owner, repo)
                .retrieve()
                .onStatus(status -> status.isSameCodeAs(org.springframework.http.HttpStatus.NOT_FOUND), (req, res) -> {
                    throw new prosno.backend.exceptions.NotFoundException("Repository not found or not accessible");
                })
                .onStatus(status -> status.isSameCodeAs(org.springframework.http.HttpStatus.FORBIDDEN), (req, res) -> {
                    throw new prosno.backend.exceptions.ForbiddenException("Access to this repository is forbidden");
                })
                .body(MAP);
    }

    private RestClient client(String accessToken) {
        return restClientBuilder.clone()
                .baseUrl(API_BASE)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json")
                .defaultHeader("X-GitHub-Api-Version", "2022-11-28")
                .defaultHeader(HttpHeaders.USER_AGENT, "prosno")
                .build();
    }
}
