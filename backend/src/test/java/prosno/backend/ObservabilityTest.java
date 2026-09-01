package prosno.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.slf4j.MDC;
import prosno.backend.config.CorrelationIdFilter;
import prosno.backend.exceptions.GlobalExceptionHandler;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.UUID;

public class ObservabilityTest {

    @Test
    public void testCorrelationIdFilter_GeneratesNewId() throws Exception {
        CorrelationIdFilter filter = new CorrelationIdFilter();
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        String generatedId = response.getHeader(CorrelationIdFilter.CORRELATION_ID_HEADER);
        assertThat(generatedId).isNotBlank();
        assertThat(MDC.getCopyOfContextMap()).isNullOrEmpty(); // Should be cleared after chain
    }

    @Test
    public void testCorrelationIdFilter_ReusesExistingId() throws Exception {
        String testId = "test-existing-123";
        CorrelationIdFilter filter = new CorrelationIdFilter();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(CorrelationIdFilter.CORRELATION_ID_HEADER, testId);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        String generatedId = response.getHeader(CorrelationIdFilter.CORRELATION_ID_HEADER);
        assertThat(generatedId).isEqualTo(testId);
    }

    @Test
    public void testErrorHandlingDoesNotLeakTracesButIncludesCorrelationId() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        
        try {
            MDC.put(CorrelationIdFilter.CORRELATION_ID_LOG_VAR, "test-err-123");
            
            Exception ex = new RuntimeException("secret stack trace or database error");
            var response = handler.handleGeneric(ex);
            
            assertThat(response.getStatusCode().value()).isEqualTo(500);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().get("status")).isEqualTo(500);
            assertThat(response.getBody().get("error")).isEqualTo("Internal Server Error");
            assertThat(response.getBody().get("message").toString()).doesNotContain("secret stack trace");
            assertThat(response.getBody().get("correlationId")).isEqualTo("test-err-123");
        } finally {
            MDC.clear();
        }
    }
}
