package prosno.backend.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import prosno.backend.exceptions.UnauthorizedException;

@Component
public class CurrentUser {
    private static final Logger log = LoggerFactory.getLogger(CurrentUser.class);

    public AppUserPrincipal require() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            log.warn("/api/auth/me - No authentication in SecurityContext");
            throw new UnauthorizedException("Not authenticated");
        }
        if (!(auth.getPrincipal() instanceof AppUserPrincipal principal)) {
            log.warn("/api/auth/me - Principal is not AppUserPrincipal: {}", auth.getPrincipal().getClass().getName());
            throw new UnauthorizedException("Not authenticated");
        }
        log.debug("/api/auth/me - Authentication found: userId={}", principal.getId());
        return principal;
    }
}
