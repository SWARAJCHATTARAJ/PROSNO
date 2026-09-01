package prosno.backend;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import java.util.Optional;
import java.util.List;
import java.util.Map;
import org.mockito.Mockito;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import prosno.backend.entity.ChatSession;
import prosno.backend.entity.IndexStatus;
import prosno.backend.entity.Repository;
import prosno.backend.entity.User;
import prosno.backend.entity.UserRepository;
import prosno.backend.repository.ChatMessageRepository;
import prosno.backend.repository.ChatSessionRepository;
import prosno.backend.repository.RepositoryRepository;
import prosno.backend.repository.UserRepositoryRepository;
import prosno.backend.services.CleanupService;
import prosno.backend.services.RepoService;
import prosno.backend.services.indexing.IndexingService;
import prosno.backend.services.UserService;

@SpringBootTest(properties = {
    "HUGGINGFACE_API_KEY=dummy",
    "GROQ_API_KEY=dummy",
    "GITHUB_CLIENT_ID=dummy",
    "GITHUB_CLIENT_SECRET=dummy",
    "app.token-encryptor-password=dummy-password",
    "app.token-encryptor-salt=deadbeef"
})
public class E2ERegressionTests {

    @Autowired private RepositoryRepository repositoryRepository;
    @Autowired private UserRepositoryRepository userRepositoryRepository;
    @Autowired private ChatSessionRepository chatSessionRepository;
    @Autowired private ChatMessageRepository chatMessageRepository;
    @Autowired private CleanupService cleanupService;
    @Autowired private RepoService repoService;
    
    @MockitoSpyBean private prosno.backend.services.github.GithubApiClient gitHubApiClient;
    @MockitoSpyBean private UserService userService;
    @MockitoSpyBean private IndexingService indexingService;

    @BeforeEach
    void setUp() {
        chatMessageRepository.deleteAll();
        chatSessionRepository.deleteAll();
        userRepositoryRepository.deleteAll();
        repositoryRepository.deleteAll();
        
        doReturn("dummy-token").when(userService).decryptAccessToken(any());
        User mockUser = new User();
        mockUser.setId(UUID.randomUUID());
        doReturn(mockUser).when(userService).requiredById(any());
    }

    // @Test
    // @WithMockUser(username = "user-1", roles = {"USER"})
    // public void testScenarioI_AdminEndpointsForbidden() throws Exception {
    //     mockMvc.perform(post("/api/admin/force-reindex-all"))
    //            .andExpect(status().isForbidden());
    //     mockMvc.perform(post("/api/admin/cleanup"))
    //            .andExpect(status().isForbidden());
    // }

    @Test
    public void testScenarioE_SoftExpiry() {
        Repository repo = repositoryRepository.save(Repository.builder()
                .githubRepoId(111L).owner("test").name("repo").fullName("test/repo")
                .isPrivate(false).defaultBranch("main").indexStatus(IndexStatus.READY)
                .lastAccessedAt(Instant.now().minus(40, ChronoUnit.DAYS)).build());
                
        cleanupService.runCleanup(false);
        
        Repository expired = repositoryRepository.findById(repo.getId()).orElseThrow();
        assertEquals(IndexStatus.EXPIRED, expired.getIndexStatus());
    }

    @Test
    public void testScenarioH_HardDeleteCascade() {
        Repository repo = repositoryRepository.save(Repository.builder()
                .githubRepoId(222L).owner("test").name("repo2").fullName("test/repo2")
                .isPrivate(false).defaultBranch("main").indexStatus(IndexStatus.EXPIRED)
                .lastAccessedAt(Instant.now().minus(100, ChronoUnit.DAYS))
                .expiredAt(Instant.now().minus(70, ChronoUnit.DAYS)).build());
                
        ChatSession session = chatSessionRepository.save(ChatSession.builder()
                .userId(UUID.randomUUID()).repositoryId(repo.getId()).title("Test").build());
                
        cleanupService.runCleanup(false);
        
        assertTrue(repositoryRepository.findById(repo.getId()).isEmpty());
        assertTrue(chatSessionRepository.findById(session.getId()).isEmpty());
    }

    @Test
    public void testScenarioA_And_B() throws Exception {
        UUID user1 = UUID.randomUUID();
        UUID user2 = UUID.randomUUID();

        User u1 = new User(); u1.setId(user1);
        User u2 = new User(); u2.setId(user2);
        
        doReturn(u1).when(userService).requiredById(user1);
        doReturn(u2).when(userService).requiredById(user2);
        
        org.mockito.Mockito.doReturn(Map.of(
                "id", 555L, "full_name", "test/fresh", "name", "fresh", "owner", Map.of("login", "test"), "default_branch", "main", "private", false, "language", "Java", "description", "desc", "html_url", "url"))
                .when(gitHubApiClient).getRepo(any(), eq("test"), eq("fresh"));
        org.mockito.Mockito.doReturn("fresh-sha").when(gitHubApiClient).getLatestCommitSha(any(), eq("test"), eq("fresh"), eq("main"));

        prosno.backend.services.RepoService.AddRepoResult result1 = repoService.addPublicRepo(user1, "test/fresh");
        Repository res1 = result1.repo();
        assertEquals(IndexStatus.PENDING, res1.getIndexStatus());

        Repository r = repositoryRepository.findById(res1.getId()).get();
        r.setIndexStatus(IndexStatus.READY);
        r.setLastIndexedSha("fresh-sha");
        repositoryRepository.save(r);

        prosno.backend.services.RepoService.AddRepoResult result2 = repoService.addPublicRepo(user2, "test/fresh");
        Repository res2 = result2.repo();
        assertEquals(IndexStatus.READY, res2.getIndexStatus());
        
        assertTrue(userRepositoryRepository.existsByUserIdAndRepoId(user1, res1.getId()));
        assertTrue(userRepositoryRepository.existsByUserIdAndRepoId(user2, res2.getId()));
        assertEquals(res1.getId(), res2.getId()); 
    }

    @Test
    public void testScenarioF_WakeUpFlow() throws Exception {
        UUID userId = UUID.randomUUID();
        User mockUser = new User();
        mockUser.setId(userId);
        doReturn(mockUser).when(userService).requiredById(any());

        Repository repo = repositoryRepository.save(Repository.builder()
                .githubRepoId(333L).owner("test").name("repo3").fullName("test/repo3")
                .isPrivate(false).defaultBranch("main").indexStatus(IndexStatus.EXPIRED)
                .build());
                
        userRepositoryRepository.save(UserRepository.builder()
                .repoId(repo.getId()).userId(userId).build());
        
        ChatSession session = chatSessionRepository.save(ChatSession.builder()
                .userId(userId).repositoryId(repo.getId()).title("Test").build());


        prosno.backend.services.ai.ChatPromptBuilder pb = mock(prosno.backend.services.ai.ChatPromptBuilder.class);
        prosno.backend.services.ai.ChatStreamHandler ch = mock(prosno.backend.services.ai.ChatStreamHandler.class);
        prosno.backend.services.ai.CodeContextRetriever ccr = mock(prosno.backend.services.ai.CodeContextRetriever.class);
        prosno.backend.services.ai.CitationMapper cm = mock(prosno.backend.services.ai.CitationMapper.class);
        
        doReturn(new prosno.backend.services.ai.RetrievedContext(List.of(), "context"))
            .when(ccr).retrieve(any(), any());
        doReturn("sys").when(pb).systemPrompt(any());
        doReturn("user").when(pb).userPrompt(any(), any());

        org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter = 
            new prosno.backend.services.ChatService(
                chatSessionRepository, chatMessageRepository, repoService, indexingService, 
                ccr, pb, ch, cm
            ).streamReply(userId, session.getId(), "Hello");

        Thread.sleep(2500); 

        repo.setIndexStatus(IndexStatus.READY);
        repositoryRepository.save(repo);

        Thread.sleep(3000); 
    }

    @Test
    public void testScenarioG_WakeUpFailure() throws Exception {
        UUID userId = UUID.randomUUID();
        User mockUser = new User();
        mockUser.setId(userId);
        doReturn(mockUser).when(userService).requiredById(any());

        Repository repo = repositoryRepository.save(Repository.builder()
                .githubRepoId(444L).owner("test").name("repo4").fullName("test/repo4")
                .isPrivate(false).defaultBranch("main").indexStatus(IndexStatus.EXPIRED)
                .build());
                
        userRepositoryRepository.save(UserRepository.builder()
                .repoId(repo.getId()).userId(userId).build());
        
        ChatSession session = chatSessionRepository.save(ChatSession.builder()
                .userId(userId).repositoryId(repo.getId()).title("Test").build());


        prosno.backend.services.ai.ChatPromptBuilder pb = mock(prosno.backend.services.ai.ChatPromptBuilder.class);
        prosno.backend.services.ai.ChatStreamHandler ch = mock(prosno.backend.services.ai.ChatStreamHandler.class);
        prosno.backend.services.ai.CodeContextRetriever ccr = mock(prosno.backend.services.ai.CodeContextRetriever.class);
        prosno.backend.services.ai.CitationMapper cm = mock(prosno.backend.services.ai.CitationMapper.class);

        org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter = 
            new prosno.backend.services.ChatService(
                chatSessionRepository, chatMessageRepository, repoService, indexingService, 
                ccr, pb, ch, cm
            ).streamReply(userId, session.getId(), "Hello");

        Thread.sleep(1000);

        repo.setIndexStatus(IndexStatus.FAILED);
        repo.setErrorMessage("Simulated index failure");
        repositoryRepository.save(repo);

        Thread.sleep(3000); 
    }

    @Test
    public void testScenarioH_TwoStageSequence() {
        // Day 0: Create repo at READY status
        Instant day0 = Instant.now().minus(95, ChronoUnit.DAYS); // arbitrarily long ago for setup
        
        Repository repo = repositoryRepository.save(Repository.builder()
                .githubRepoId(999L).owner("test").name("twostage").fullName("test/twostage")
                .isPrivate(false).defaultBranch("main").indexStatus(IndexStatus.READY)
                .lastAccessedAt(day0).build());
                
        // Day 30: cleanup() 
        // We set lastAccessedAt to 30 days ago to simulate reaching Stage 1
        Instant day30 = Instant.now().minus(30, ChronoUnit.DAYS);
        repo.setLastAccessedAt(day30);
        repositoryRepository.save(repo);

        cleanupService.runCleanup(false);
        
        Repository afterDay30 = repositoryRepository.findById(repo.getId()).orElseThrow();
        assertEquals(IndexStatus.EXPIRED, afterDay30.getIndexStatus());
        assertNotNull(afterDay30.getExpiredAt());
        assertTrue(afterDay30.getExpiredAt().isAfter(Instant.now().minusSeconds(10)));
        
        // Day 89 (59 days after expiry): cleanup()
        // We simulate 59 days passing by setting expiredAt back 59 days
        Instant day89 = Instant.now().minus(59, ChronoUnit.DAYS);
        afterDay30.setExpiredAt(day89);
        repositoryRepository.save(afterDay30);

        cleanupService.runCleanup(false);
        
        Repository afterDay89 = repositoryRepository.findById(repo.getId()).orElse(null);
        assertNotNull(afterDay89, "Repository should not be hard-deleted yet (only 59 days since expired)");
        
        // Day 90 (60 days after expiry): cleanup()
        Instant day90 = Instant.now().minus(60, ChronoUnit.DAYS).minusSeconds(60); // slightly more than 60 days
        afterDay89.setExpiredAt(day90);
        repositoryRepository.save(afterDay89);

        cleanupService.runCleanup(false);
        
        assertTrue(repositoryRepository.findById(repo.getId()).isEmpty(), "Repository should be hard-deleted now");
    }
}
