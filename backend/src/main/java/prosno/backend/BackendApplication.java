package prosno.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

import io.github.cdimascio.dotenv.Dotenv;

@SpringBootApplication
@EnableAsync
@org.springframework.scheduling.annotation.EnableScheduling
public class BackendApplication {

	public static void main(String[] args) {
		try {
			String envDir = new java.io.File(".env").exists() ? "./" : "../";
			Dotenv dotenv = Dotenv.configure().directory(envDir).ignoreIfMissing().load();
			dotenv.entries().forEach(entry -> System.setProperty(entry.getKey(), entry.getValue()));
		} catch (Exception e) {
			// fallback if anything goes wrong
		}
		SpringApplication.run(BackendApplication.class, args);
	}

}
