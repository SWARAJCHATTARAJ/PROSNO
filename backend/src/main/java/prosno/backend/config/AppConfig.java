package prosno.backend.config;

import java.util.concurrent.Executor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.client.RestClient;

import org.slf4j.MDC;
import java.util.Map;
import org.springframework.core.task.TaskDecorator;

@Configuration
@EnableAsync
public class AppConfig {
    @Bean
    RestClient.Builder restClientBuilder() {
        org.springframework.http.client.SimpleClientHttpRequestFactory requestFactory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(java.time.Duration.ofSeconds(15));
        requestFactory.setReadTimeout(java.time.Duration.ofSeconds(60));
        return RestClient.builder().requestFactory(requestFactory);
    }

    @Bean(name = "indexingExecutor")
    Executor indexingExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("index-");
        executor.setTaskDecorator(new MdcTaskDecorator());
        executor.initialize();
        return executor;
    }

    public static class MdcTaskDecorator implements TaskDecorator {
        @Override
        public Runnable decorate(Runnable runnable) {
            Map<String, String> contextMap = MDC.getCopyOfContextMap();
            return () -> {
                if (contextMap != null) {
                    MDC.setContextMap(contextMap);
                } else {
                    MDC.clear();
                }
                try {
                    runnable.run();
                } finally {
                    MDC.clear();
                }
            };
        }
    }
}