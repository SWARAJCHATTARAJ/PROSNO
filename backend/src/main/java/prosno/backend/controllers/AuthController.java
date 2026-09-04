package prosno.backend.controllers;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import prosno.backend.dto.UserResponse;
import prosno.backend.entity.User;
import prosno.backend.security.AppUserPrincipal;
import prosno.backend.security.CurrentUser;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private static final Logger log = LoggerFactory.getLogger(AuthController.class);
    private final CurrentUser currentUser;

    @GetMapping("/login-url")
    public Map<String, String> loginUrl() {
        return Map.of("url", "/oauth2/authorization/github");
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(jakarta.servlet.http.HttpServletRequest request) {
        jakarta.servlet.http.HttpSession session = request.getSession(false);
        String sessionId = session != null ? session.getId() : "none";
        boolean authPresent = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() != null;
        log.info("/api/auth/me called: sessionId={}, authPresent={}", sessionId, authPresent);
        AppUserPrincipal principal = currentUser.require();
        User user = principal.getUser();
        log.info("/api/auth/me authenticated: userId={}, githubUsername={}", user.getId(), user.getGithubUsername());
        return ResponseEntity.ok(new UserResponse(
                user.getId(),
                user.getGithubId(),
                user.getGithubUsername(),
                user.getDisplayName(),
                user.getAvatarUrl()));
    }

}