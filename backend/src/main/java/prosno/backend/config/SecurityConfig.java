package prosno.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;

import prosno.backend.security.GithubOAuth2UserService;
import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

        private final GithubOAuth2UserService gitHubOAuth2UserService;

        @Bean
        SecurityFilterChain securityFilterChain(
                        HttpSecurity http,
                        AuthenticationSuccessHandler oauth2SuccessHandler,
                        AuthenticationFailureHandler oauth2FailureHandler) throws Exception {
                org.springframework.security.web.context.HttpSessionSecurityContextRepository securityContextRepository =
                                new org.springframework.security.web.context.HttpSessionSecurityContextRepository();

                http
                                .cors(Customizer.withDefaults())
                                .csrf(csrf -> csrf
                                                .csrfTokenRepository(cookieCsrfTokenRepository())
                                                .csrfTokenRequestHandler(new org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler()))
                                .securityContext(sc -> sc
                                                .securityContextRepository(securityContextRepository))
                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                                .authorizeHttpRequests(auth -> auth
                                                .requestMatchers(
                                                                "/api/auth/login-url",
                                                                "/oauth2/**",
                                                                "/login/oauth2/**",
                                                                "/error",
                                                                "/actuator/health")
                                                .permitAll()
                                                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                                                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                                                .requestMatchers("/api/**").authenticated()
                                                .anyRequest().permitAll())
                                .exceptionHandling(ex -> ex
                                                .authenticationEntryPoint(
                                                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                                .oauth2Login(oauth -> oauth
                                                .userInfoEndpoint(userInfo -> userInfo
                                                                .userService(gitHubOAuth2UserService))
                                                .successHandler(oauth2SuccessHandler)
                                                .failureHandler(oauth2FailureHandler))
                                .logout(logout -> logout
                                                .logoutUrl("/api/auth/logout")
                                                .logoutSuccessHandler((request, response, authentication) -> response
                                                                .setStatus(HttpStatus.NO_CONTENT.value()))
                                                .invalidateHttpSession(true)
                                                .clearAuthentication(true)
                                                .deleteCookies("PROSNO_SESSION"))
                                .addFilterAfter(new CsrfCookieFilter(), org.springframework.security.web.authentication.www.BasicAuthenticationFilter.class);

                return http.build();
        }

        private static org.springframework.security.web.csrf.CookieCsrfTokenRepository cookieCsrfTokenRepository() {
                org.springframework.security.web.csrf.CookieCsrfTokenRepository repository =
                                org.springframework.security.web.csrf.CookieCsrfTokenRepository.withHttpOnlyFalse();
                repository.setCookieCustomizer(customizer -> customizer.sameSite("None").secure(true).path("/"));
                return repository;
        }

        private static final class CsrfCookieFilter extends org.springframework.web.filter.OncePerRequestFilter {
                @Override
                protected void doFilterInternal(jakarta.servlet.http.HttpServletRequest request, jakarta.servlet.http.HttpServletResponse response, jakarta.servlet.FilterChain filterChain)
                                throws jakarta.servlet.ServletException, java.io.IOException {
                        org.springframework.security.web.csrf.CsrfToken csrfToken = (org.springframework.security.web.csrf.CsrfToken) request.getAttribute(org.springframework.security.web.csrf.CsrfToken.class.getName());
                        if (csrfToken != null) {
                                // Render the token value to a cookie by causing the deferred token to be resolved
                                csrfToken.getToken();
                        }
                        filterChain.doFilter(request, response);
                }
        }

        @Bean
        AuthenticationSuccessHandler oauth2SuccessHandler(
                        @Value("${app.frontend-url}") String frontendUrl) {
                String targetUrl = frontendUrl + "/auth/callback";
                return new SimpleUrlAuthenticationSuccessHandler(targetUrl) {
                        @Override
                        public void onAuthenticationSuccess(jakarta.servlet.http.HttpServletRequest request,
                                        jakarta.servlet.http.HttpServletResponse response,
                                        org.springframework.security.core.Authentication authentication)
                                        throws java.io.IOException, jakarta.servlet.ServletException {
                                org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(SecurityConfig.class);
                                jakarta.servlet.http.HttpSession session = request.getSession(false);
                                String sessionId = session != null ? session.getId() : "no-session";
                                log.info("OAuth2 login success - principal: {}, redirecting to: {}, sessionId: {}",
                                                authentication.getName(), targetUrl, sessionId);
                                super.onAuthenticationSuccess(request, response, authentication);
                        }
                };
        }

        @Bean
        AuthenticationFailureHandler oauth2FailureHandler(
                        @Value("${app.frontend-url}") String frontendUrl) {
                String failureUrl = frontendUrl + "/login?error=oauth_failed";
                return new SimpleUrlAuthenticationFailureHandler(failureUrl) {
                        @Override
                        public void onAuthenticationFailure(jakarta.servlet.http.HttpServletRequest request,
                                        jakarta.servlet.http.HttpServletResponse response,
                                        org.springframework.security.core.AuthenticationException exception)
                                        throws java.io.IOException, jakarta.servlet.ServletException {
                                org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(SecurityConfig.class);
                                log.warn("OAuth2 login failure - redirecting to: {}, error: {}", failureUrl, exception.getMessage(), exception);
                                super.onAuthenticationFailure(request, response, exception);
                        }
                };
        }
}