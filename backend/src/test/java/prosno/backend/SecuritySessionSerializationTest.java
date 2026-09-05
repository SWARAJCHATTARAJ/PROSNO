package prosno.backend;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;

import prosno.backend.entity.User;
import prosno.backend.security.AppUserPrincipal;

import static org.assertj.core.api.Assertions.assertThat;

public class SecuritySessionSerializationTest {

    @Test
    public void testPrincipalAndSecurityContextAreSerializableForSpringSession() throws Exception {
        User user = User.builder()
                .id(UUID.randomUUID())
                .githubId(123456L)
                .githubUsername("testuser")
                .displayName("Test User")
                .avatarUrl("https://avatars.githubusercontent.com/u/123456")
                .accessToken("enc-gho-token")
                .tokenScopes("read:user,repo")
                .createdAt(Instant.now())
                .isAdmin(false)
                .build();

        Map<String, Object> attributes = Map.of(
                "id", 123456,
                "login", "testuser",
                "name", "Test User"
        );

        AppUserPrincipal principal = new AppUserPrincipal(user, attributes);

        OAuth2AuthenticationToken authToken = new OAuth2AuthenticationToken(
                principal,
                principal.getAuthorities(),
                "github"
        );

        SecurityContext context = new SecurityContextImpl(authToken);

        // Serialize
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ObjectOutputStream oos = new ObjectOutputStream(baos)) {
            oos.writeObject(context);
        }

        byte[] bytes = baos.toByteArray();
        assertThat(bytes).isNotEmpty();

        // Deserialize
        SecurityContext deserializedContext;
        try (ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(bytes))) {
            deserializedContext = (SecurityContext) ois.readObject();
        }

        assertThat(deserializedContext).isNotNull();
        assertThat(deserializedContext.getAuthentication()).isNotNull();
        assertThat(deserializedContext.getAuthentication().getPrincipal()).isInstanceOf(AppUserPrincipal.class);

        AppUserPrincipal deserializedPrincipal = (AppUserPrincipal) deserializedContext.getAuthentication().getPrincipal();
        assertThat(deserializedPrincipal.getId()).isEqualTo(user.getId());
        assertThat(deserializedPrincipal.getUser().getGithubUsername()).isEqualTo("testuser");
        assertThat(deserializedPrincipal.getAttributes()).containsKey("login");
    }
}
