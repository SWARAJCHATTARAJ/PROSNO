package prosno.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import prosno.backend.dto.GithubRepoResponse;
import prosno.backend.entity.IndexStatus;
import prosno.backend.entity.Repository;
import prosno.backend.entity.User;
import prosno.backend.exceptions.NotFoundException;
import prosno.backend.repository.ChatMessageRepository;
import prosno.backend.repository.ChatSessionRepository;
import prosno.backend.repository.RepositoryRepository;
import prosno.backend.repository.UserRepositoryRepository;
import prosno.backend.services.RepoService;
import prosno.backend.services.UserService;
import prosno.backend.services.github.GithubApiClient;
import prosno.backend.services.indexing.IndexingService;

@SpringBootTest(properties = {
    "HUGGINGFACE_API_KEY=dummy",
    "GROQ_API_KEY=dummy",
    "GITHUB_CLIENT_ID=dummy",
    "GITHUB_CLIENT_SECRET=dummy",
    "app.token-encryptor-password=dummy-password",
    "app.token-encryptor-salt=deadbeef"
})
@org.springframework.test.context.ContextConfiguration(initializers = prosno.backend.config.EnvInitializer.class)
public class RepoConnectionTest {

    @Autowired private RepositoryRepository repositoryRepository;
    @Autowired private UserRepositoryRepository userRepositoryRepository;
    @Autowired private ChatSessionRepository chatSessionRepository;
    @Autowired private ChatMessageRepository chatMessageRepository;
    @Autowired private RepoService repoService;

    @MockitoSpyBean private GithubApiClient gitHubApiClient;
    @MockitoSpyBean private UserService userService;
    @MockitoSpyBean private IndexingService indexingService;

    private User user1;
    private User user2;

    @BeforeEach
    void setUp() {
        chatMessageRepository.deleteAll();
        chatSessionRepository.deleteAll();
        userRepositoryRepository.deleteAll();
        repositoryRepository.deleteAll();

        user1 = new User();
        user1.setId(UUID.randomUUID());
        user1.setGithubId(101L);
        user1.setGithubUsername("dev-one");
        user1.setDisplayName("Developer One");
        user1.setAccessToken("enc-token-1");
        user1.setTokenScopes("read:user,repo");
        user1.setCreatedAt(Instant.now());

        user2 = new User();
        user2.setId(UUID.randomUUID());
        user2.setGithubId(102L);
        user2.setGithubUsername("dev-two");
        user2.setDisplayName("Developer Two");
        user2.setAccessToken("enc-token-2");
        user2.setTokenScopes("read:user,repo");
        user2.setCreatedAt(Instant.now());

        doReturn("decrypted-token-1").when(userService).decryptAccessToken(user1);
        doReturn("decrypted-token-2").when(userService).decryptAccessToken(user2);
        doReturn(user1).when(userService).requiredById(user1.getId());
        doReturn(user2).when(userService).requiredById(user2.getId());
    }

    @Test
    public void testConnectRepositoryCreatesCorrectRecords() {
        Map<String, Object> repoData = Map.of(
                "id", 12345L,
                "full_name", "octocat/Hello-World",
                "name", "Hello-World",
                "owner", Map.of("login", "octocat"),
                "default_branch", "main",
                "private", false,
                "language", "Java",
                "description", "My first repo",
                "html_url", "https://github.com/octocat/Hello-World"
        );
        doReturn(repoData).when(gitHubApiClient).getRepoById(any(), eq(12345L));

        RepoService.AddRepoResult result = repoService.connectRepo(user1.getId(), 12345L, null);

        assertThat(result.isNew()).isTrue();
        Repository repo = result.repo();
        assertThat(repo.getGithubRepoId()).isEqualTo(12345L);
        assertThat(repo.getFullName()).isEqualTo("octocat/Hello-World");
        assertThat(repo.getOwner()).isEqualTo("octocat");
        assertThat(repo.getName()).isEqualTo("Hello-World");
        assertThat(repo.getDefaultBranch()).isEqualTo("main");
        assertThat(repo.getIndexStatus()).isEqualTo(IndexStatus.PENDING);

        // Verify UserRepository relationship exists
        assertThat(userRepositoryRepository.existsByUserIdAndRepoId(user1.getId(), repo.getId())).isTrue();
        // Verify only 1 repository and 1 relationship
        assertThat(repositoryRepository.count()).isEqualTo(1);
        assertThat(userRepositoryRepository.count()).isEqualTo(1);
    }

    @Test
    public void testDuplicateConnectIsIdempotent() {
        Map<String, Object> repoData = Map.of(
                "id", 54321L,
                "full_name", "octocat/Spoon-Knife",
                "name", "Spoon-Knife",
                "owner", Map.of("login", "octocat"),
                "default_branch", "main",
                "private", false,
                "language", "HTML",
                "description", "Clone of Spoon-Knife",
                "html_url", "https://github.com/octocat/Spoon-Knife"
        );
        doReturn(repoData).when(gitHubApiClient).getRepoById(any(), eq(54321L));

        // Connect first time
        RepoService.AddRepoResult r1 = repoService.connectRepo(user1.getId(), 54321L, null);
        assertThat(r1.isNew()).isTrue();

        // Connect second time
        RepoService.AddRepoResult r2 = repoService.connectRepo(user1.getId(), 54321L, null);
        assertThat(r2.isNew()).isFalse();
        assertThat(r2.repo().getId()).isEqualTo(r1.repo().getId());

        // Assert DB counts: still exactly 1 repo and 1 link
        assertThat(repositoryRepository.count()).isEqualTo(1);
        assertThat(userRepositoryRepository.count()).isEqualTo(1);
    }

    @Test
    public void testInaccessibleRepositoryIsRejectedCleanly() {
        doThrow(new NotFoundException("Repository not found or not accessible"))
                .when(gitHubApiClient).getRepoById(any(), eq(99999L));

        assertThrows(NotFoundException.class, () -> {
            repoService.connectRepo(user1.getId(), 99999L, null);
        });

        // DB state should remain untouched
        assertThat(repositoryRepository.count()).isEqualTo(0);
        assertThat(userRepositoryRepository.count()).isEqualTo(0);
    }

    @Test
    public void testOwnershipIsEnforced() {
        Map<String, Object> repoData = Map.of(
                "id", 777L,
                "full_name", "user1/private-repo",
                "name", "private-repo",
                "owner", Map.of("login", "user1"),
                "default_branch", "main",
                "private", true,
                "html_url", "https://github.com/user1/private-repo"
        );
        doReturn(repoData).when(gitHubApiClient).getRepoById(any(), eq(777L));

        RepoService.AddRepoResult res = repoService.connectRepo(user1.getId(), 777L, null);
        UUID repoId = res.repo().getId();

        // User 1 can access it
        Repository owned = repoService.requireOwned(repoId, user1.getId());
        assertThat(owned).isNotNull();

        // User 2 CANNOT access it
        assertThrows(NotFoundException.class, () -> {
            repoService.requireOwned(repoId, user2.getId());
        });
    }

    @Test
    public void testListUserGithubReposAnnotatesConnectedState() {
        Map<String, Object> gRepo1 = Map.of(
                "id", 11L, "name", "r1", "full_name", "user1/r1", "owner", Map.of("login", "user1"),
                "private", false, "default_branch", "main", "language", "TypeScript"
        );
        Map<String, Object> gRepo2 = Map.of(
                "id", 22L, "name", "r2", "full_name", "user1/r2", "owner", Map.of("login", "user1"),
                "private", false, "default_branch", "main", "language", "Java"
        );
        doReturn(List.of(gRepo1, gRepo2)).when(gitHubApiClient).listUserRepos(any());
        doReturn(gRepo1).when(gitHubApiClient).getRepoById(any(), eq(11L));

        // User connects repo 11 only
        repoService.connectRepo(user1.getId(), 11L, null);

        List<GithubRepoResponse> githubList = repoService.listUserGithubRepos(user1.getId());
        assertThat(githubList).hasSize(2);

        GithubRepoResponse item1 = githubList.stream().filter(r -> r.id() == 11L).findFirst().orElseThrow();
        assertThat(item1.connected()).isTrue();
        assertThat(item1.connectedRepoId()).isNotNull();

        GithubRepoResponse item2 = githubList.stream().filter(r -> r.id() == 22L).findFirst().orElseThrow();
        assertThat(item2.connected()).isFalse();
        assertThat(item2.connectedRepoId()).isNull();
    }

    @Test
    public void testDisconnectRepositoryRemovesRelationship() {
        Map<String, Object> repoData = Map.of(
                "id", 888L, "full_name", "octocat/disconnect-me", "name", "disconnect-me",
                "owner", Map.of("login", "octocat"), "default_branch", "main", "private", false
        );
        doReturn(repoData).when(gitHubApiClient).getRepoById(any(), eq(888L));

        RepoService.AddRepoResult res = repoService.connectRepo(user1.getId(), 888L, null);
        UUID repoId = res.repo().getId();
        assertThat(userRepositoryRepository.existsByUserIdAndRepoId(user1.getId(), repoId)).isTrue();

        repoService.disconnectRepo(user1.getId(), repoId);

        assertThat(userRepositoryRepository.existsByUserIdAndRepoId(user1.getId(), repoId)).isFalse();
        assertThrows(NotFoundException.class, () -> {
            repoService.requireOwned(repoId, user1.getId());
        });
    }
}
