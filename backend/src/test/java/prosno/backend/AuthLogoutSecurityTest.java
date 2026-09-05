package prosno.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import prosno.backend.entity.User;
import prosno.backend.repository.UserRepository;
import prosno.backend.security.AppUserPrincipal;

@SpringBootTest(properties = {
    "HUGGINGFACE_API_KEY=dummy",
    "GROQ_API_KEY=dummy",
    "GITHUB_CLIENT_ID=dummy",
    "GITHUB_CLIENT_SECRET=dummy",
    "app.token-encryptor-password=dummy-password",
    "app.token-encryptor-salt=deadbeef",
    "app.cookie-domain=swarajchattaraj.tech"
})
@org.springframework.test.context.ContextConfiguration(initializers = prosno.backend.config.EnvInitializer.class)
public class AuthLogoutSecurityTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private UserRepository userRepository;

    private MockMvc mockMvc;
    private User testUser;
    private AppUserPrincipal principal;

    @org.junit.jupiter.api.AfterEach
    void tearDown() {
        userRepository.findByGithubId(999888L).ifPresent(u -> userRepository.delete(u));
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(context)
                .apply(springSecurity())
                .build();

        userRepository.findByGithubId(999888L).ifPresent(u -> userRepository.delete(u));

        testUser = userRepository.save(User.builder()
                .githubId(999888L)
                .githubUsername("test-logout-user")
                .displayName("Logout User")
                .avatarUrl("https://example.com/avatar.png")
                .accessToken("dummy-access-token")
                .tokenScopes("read:user,repo")
                .createdAt(Instant.now())
                .isAdmin(false)
                .build());

        principal = new AppUserPrincipal(testUser, Map.of(
                "id", 999888,
                "login", "test-logout-user"
        ));
    }

    private MockHttpSession createAuthenticatedSession() {
        MockHttpSession session = new MockHttpSession();
        OAuth2AuthenticationToken token = new OAuth2AuthenticationToken(
                principal,
                principal.getAuthorities(),
                "github"
        );
        SecurityContext securityContext = new SecurityContextImpl(token);
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, securityContext);
        return session;
    }

    @Test
    public void testCsrfEndpointReturnsValidToken() throws Exception {
        mockMvc.perform(get("/api/auth/csrf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.headerName").value("X-XSRF-TOKEN"))
                .andExpect(header().exists("X-CSRF-TOKEN"));
    }

    @Test
    public void testLogoutWithoutCsrfTokenIsRejectedWith403() throws Exception {
        MockHttpSession session = createAuthenticatedSession();

        mockMvc.perform(post("/api/auth/logout")
                .session(session))
                .andExpect(status().isForbidden());

        // Session should remain valid because logout was rejected
        assertThat(session.isInvalid()).isFalse();
    }

    @Test
    public void testLogoutWithValidCsrfTokenSucceedsAndInvalidatesSession() throws Exception {
        MockHttpSession session = createAuthenticatedSession();

        // 1. Get CSRF token
        MvcResult csrfResult = mockMvc.perform(get("/api/auth/csrf").session(session))
                .andExpect(status().isOk())
                .andReturn();

        String rawJson = csrfResult.getResponse().getContentAsString();
        String csrfToken = rawJson.split("\"token\":\"")[1].split("\"")[0];
        Cookie xsrfCookie = csrfResult.getResponse().getCookie("XSRF-TOKEN");
        String cookieVal = (xsrfCookie != null) ? xsrfCookie.getValue() : csrfToken;

        // 2. Perform logout with token and cookie
        MvcResult logoutResult = mockMvc.perform(post("/api/auth/logout")
                .session(session)
                .cookie(new Cookie("XSRF-TOKEN", cookieVal))
                .header("X-XSRF-TOKEN", csrfToken))
                .andExpect(status().isNoContent())
                .andReturn();

        // 3. Verify session invalidation
        assertThat(session.isInvalid()).isTrue();

        // 4. Verify cookies cleared
        assertThat(logoutResult.getResponse().getHeaders("Set-Cookie"))
                .anyMatch(h -> h.contains("PROSNO_SESSION=") && h.contains("Max-Age=0"))
                .anyMatch(h -> h.contains("XSRF-TOKEN=") && h.contains("Max-Age=0"));
    }

    @Test
    public void testRepeatedLogoutIsSafeAndIdempotent() throws Exception {
        MockHttpSession session = createAuthenticatedSession();

        MvcResult csrfResult = mockMvc.perform(get("/api/auth/csrf").session(session))
                .andExpect(status().isOk())
                .andReturn();

        String rawJson = csrfResult.getResponse().getContentAsString();
        String csrfToken = rawJson.split("\"token\":\"")[1].split("\"")[0];
        Cookie xsrfCookie = csrfResult.getResponse().getCookie("XSRF-TOKEN");
        String cookieVal = (xsrfCookie != null) ? xsrfCookie.getValue() : csrfToken;

        // First logout
        mockMvc.perform(post("/api/auth/logout")
                .session(session)
                .cookie(new Cookie("XSRF-TOKEN", cookieVal))
                .header("X-XSRF-TOKEN", csrfToken))
                .andExpect(status().isNoContent());

        // Second logout attempt with same tokens
        mockMvc.perform(post("/api/auth/logout")
                .cookie(new Cookie("XSRF-TOKEN", cookieVal))
                .header("X-XSRF-TOKEN", csrfToken))
                .andExpect(status().isNoContent());
    }
}
