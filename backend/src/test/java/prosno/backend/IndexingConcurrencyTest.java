package prosno.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import prosno.backend.entity.IndexStatus;
import prosno.backend.entity.Repository;
import prosno.backend.entity.UserRepository;
import prosno.backend.repository.RepositoryRepository;
import prosno.backend.repository.UserRepositoryRepository;
import prosno.backend.services.indexing.IndexingService;

@SpringBootTest(properties = {
    "HUGGINGFACE_API_KEY=dummy",
    "GROQ_API_KEY=dummy",
    "GITHUB_CLIENT_ID=dummy",
    "GITHUB_CLIENT_SECRET=dummy",
    "app.token-encryptor-password=dummy-password",
    "app.token-encryptor-salt=deadbeef"
})
public class IndexingConcurrencyTest {

    @Autowired
    private RepositoryRepository repositoryRepository;

    @Autowired
    private UserRepositoryRepository userRepositoryRepository;

    @MockitoSpyBean
    private IndexingService indexingService;

    @Autowired
    private prosno.backend.services.RateLimitingService rateLimitingService;

    @Test
    public void testConcurrentFirstTimeIndexing() throws Exception {
        // 1. Setup a dummy repository in PENDING state
        Repository repo = Repository.builder()
                .githubRepoId(999999L)
                .owner("testowner")
                .name("testrepo")
                .fullName("testowner/testrepo")
                .isPrivate(false)
                .defaultBranch("main")
                .indexStatus(IndexStatus.PENDING)
                .build();
        repo = repositoryRepository.save(repo);

        // 2. Setup 10 dummy users linked to this repository
        int concurrentUsers = 10;
        List<UUID> userIds = new ArrayList<>();
        for (int i = 0; i < concurrentUsers; i++) {
            UUID userId = UUID.randomUUID(); 
            userIds.add(userId);
            
            UserRepository ur = UserRepository.builder()
                    .userId(userId)
                    .repoId(repo.getId())
                    .build();
            userRepositoryRepository.save(ur);
        }

        // 3. Fire concurrent calls simulating the Controller logic
        ExecutorService executor = Executors.newFixedThreadPool(concurrentUsers);
        List<Callable<Boolean>> tasks = new ArrayList<>();
        
        final UUID targetRepoId = repo.getId();
        
        // Unwrap the Spring AOP proxy (which wraps @Async) to get to the actual Mockito Spy
        IndexingService rawSpy = org.springframework.test.util.AopTestUtils.getTargetObject(indexingService);
        
        // STUB: Prevent the actual background work from running so it doesn't race against test cleanup!
        org.mockito.Mockito.doNothing().when(rawSpy).indexAsync(eq(targetRepoId), any(UUID.class));
        
        for (UUID userId : userIds) {
            tasks.add(() -> {
                String outcome = indexingService.tryStartIndexing(targetRepoId, userId);
                if ("STARTED_INDEXING".equals(outcome)) {
                    indexingService.indexAsync(targetRepoId, userId);
                }
                return "STARTED_INDEXING".equals(outcome);
            });
        }

        // Execute all concurrently
        List<Future<Boolean>> results = executor.invokeAll(tasks);
        
        // 4. Assertions
        int trueCount = 0;
        int falseCount = 0;
        for (Future<Boolean> res : results) {
            if (res.get()) {
                trueCount++;
            } else {
                falseCount++;
            }
        }
        
        // Only exactly ONE call should have returned true (started indexing)
        assertEquals(1, trueCount, "Only one thread should return true");
        assertEquals(concurrentUsers - 1, falseCount, "All other threads should return false");
        
        // Verify indexAsync was called EXACTLY ONCE
        verify(indexingService, times(1)).indexAsync(eq(targetRepoId), any(UUID.class));

        // Verify Rate Limiting token consumption
        int consumedCount = 0;
        int untouchedCount = 0;
        for (UUID userId : userIds) {
            long tokens = rateLimitingService.resolveBucket(userId).getAvailableTokens();
            if (tokens == 4) { // Assuming max-requests defaults to 5
                consumedCount++;
            } else if (tokens == 5) {
                untouchedCount++;
            }
        }
        assertEquals(1, consumedCount, "Exactly one user should have consumed a rate limit token in first-time indexing");
        assertEquals(concurrentUsers - 1, untouchedCount, "All other users should not have consumed a rate limit token in first-time indexing");

        // Verify users are still correctly linked 
        for (UUID userId : userIds) {
            boolean linked = userRepositoryRepository.existsByUserIdAndRepoId(userId, targetRepoId);
            assertEquals(true, linked, "User should still be linked to the repository");
        }

        // Clean up
        userRepositoryRepository.deleteAllById(userRepositoryRepository.findByRepoId(targetRepoId).stream().map(UserRepository::getId).toList());
        repositoryRepository.deleteById(targetRepoId);
        executor.shutdown();
    }

    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean
    private prosno.backend.services.UserService userService;

    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean
    private prosno.backend.services.github.GithubApiClient gitHubApiClient;

    @Test
    public void testConcurrentStaleShaRefresh() throws Exception {
        // 1. Setup a dummy repository in READY state with a stale SHA
        Repository repo = Repository.builder()
                .githubRepoId(888888L)
                .owner("testowner")
                .name("testrepo")
                .fullName("testowner/testrepo")
                .isPrivate(false)
                .defaultBranch("main")
                .indexStatus(IndexStatus.READY)
                .lastIndexedSha("old-sha-123")
                .build();
        repo = repositoryRepository.save(repo);

        // 2. Setup 10 dummy users linked to this repository
        int concurrentUsers = 10;
        List<UUID> userIds = new ArrayList<>();
        for (int i = 0; i < concurrentUsers; i++) {
            UUID userId = UUID.randomUUID(); 
            userIds.add(userId);
            
            UserRepository ur = UserRepository.builder()
                    .userId(userId)
                    .repoId(repo.getId())
                    .build();
            userRepositoryRepository.save(ur);
        }

        // Mock GitHubApiClient to return a NEW sha, triggering the refresh
        org.mockito.Mockito.doReturn("new-sha-456").when(gitHubApiClient)
            .getLatestCommitSha(any(), eq("testowner"), eq("testrepo"), eq("main"));

        // Mock UserService so it doesn't try to look up the dummy UUIDs in the database
        prosno.backend.entity.User dummyUser = new prosno.backend.entity.User();
        org.mockito.Mockito.doReturn(dummyUser).when(userService).requiredById(any());
        org.mockito.Mockito.doReturn("dummy-token").when(userService).decryptAccessToken(any());

        // 3. Fire concurrent calls simulating the Controller logic
        ExecutorService executor = Executors.newFixedThreadPool(concurrentUsers);
        List<Callable<Boolean>> tasks = new ArrayList<>();
        
        final UUID targetRepoId = repo.getId();
        
        // Unwrap the Spring AOP proxy (which wraps @Async) to get to the actual Mockito Spy
        IndexingService rawSpy = org.springframework.test.util.AopTestUtils.getTargetObject(indexingService);
        
        // STUB: Prevent the actual background work from running so it doesn't race against test cleanup!
        org.mockito.Mockito.doNothing().when(rawSpy).indexAsync(eq(targetRepoId), any(UUID.class));
        
        for (UUID userId : userIds) {
            tasks.add(() -> {
                String outcome = indexingService.tryStartIndexing(targetRepoId, userId);
                if ("STARTED_INDEXING".equals(outcome)) {
                    indexingService.indexAsync(targetRepoId, userId);
                }
                return "STARTED_INDEXING".equals(outcome);
            });
        }

        // Execute all concurrently
        List<Future<Boolean>> results = executor.invokeAll(tasks);
        
        // 4. Assertions
        int trueCount = 0;
        int falseCount = 0;
        for (Future<Boolean> res : results) {
            if (res.get()) {
                trueCount++;
            } else {
                falseCount++;
            }
        }
        
        // Only exactly ONE call should have returned true (started indexing)
        assertEquals(1, trueCount, "Only one thread should return true");
        assertEquals(concurrentUsers - 1, falseCount, "All other threads should return false");
        
        // Verify indexAsync was called EXACTLY ONCE
        verify(indexingService, times(1)).indexAsync(eq(targetRepoId), any(UUID.class));

        // Verify Rate Limiting token consumption
        int consumedCount = 0;
        int untouchedCount = 0;
        for (UUID userId : userIds) {
            long tokens = rateLimitingService.resolveBucket(userId).getAvailableTokens();
            if (tokens == 4) { // Assuming max-requests defaults to 5
                consumedCount++;
            } else if (tokens == 5) {
                untouchedCount++;
            }
        }
        assertEquals(1, consumedCount, "Exactly one user should have consumed a rate limit token");
        assertEquals(concurrentUsers - 1, untouchedCount, "All other users should not have consumed a rate limit token");

        // Clean up
        userRepositoryRepository.deleteAllById(userRepositoryRepository.findByRepoId(targetRepoId).stream().map(UserRepository::getId).toList());
        repositoryRepository.deleteById(targetRepoId);
        executor.shutdown();
    }
}
