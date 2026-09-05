package prosno.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

import io.github.cdimascio.dotenv.Dotenv;

@SpringBootApplication
@EnableAsync
@org.springframework.scheduling.annotation.EnableScheduling
public class BackendApplication {

	static {
		try {
			String envDir = new java.io.File(".env").exists() ? "./" : (new java.io.File("../.env").exists() ? "../" : "../../");
			Dotenv dotenv = Dotenv.configure().directory(envDir).ignoreIfMissing().load();
			dotenv.entries().forEach(entry -> {
				if (System.getProperty(entry.getKey()) == null && System.getenv(entry.getKey()) == null) {
					System.setProperty(entry.getKey(), entry.getValue());
				}
			});
		} catch (Exception ignored) {
		}
	}

	public static void main(String[] args) {
		SpringApplication.run(BackendApplication.class, args);
	}

}
