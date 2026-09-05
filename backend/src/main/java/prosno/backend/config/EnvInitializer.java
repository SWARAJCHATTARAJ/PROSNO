package prosno.backend.config;

import java.io.File;
import java.util.HashMap;
import java.util.Map;

import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.MapPropertySource;

import io.github.cdimascio.dotenv.Dotenv;

public class EnvInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {
    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        try {
            String envDir = new File(".env").exists() ? "./" : (new File("../.env").exists() ? "../" : "../../");
            Dotenv dotenv = Dotenv.configure().directory(envDir).ignoreIfMissing().load();
            Map<String, Object> props = new HashMap<>();
            dotenv.entries().forEach(entry -> {
                props.put(entry.getKey(), entry.getValue());
                if (System.getProperty(entry.getKey()) == null) {
                    System.setProperty(entry.getKey(), entry.getValue());
                }
            });
            applicationContext.getEnvironment().getPropertySources().addFirst(new MapPropertySource("dotenvProperties", props));
        } catch (Exception ignored) {
        }
    }
}
