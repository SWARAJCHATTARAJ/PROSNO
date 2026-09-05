package prosno.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
@org.springframework.test.context.ContextConfiguration(initializers = prosno.backend.config.EnvInitializer.class)
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
