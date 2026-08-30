# Prosno Backend

This is the Spring Boot backend for the Prosno application.

## Tech Stack
- Java 21
- Spring Boot 4.1.1
- Spring Security (OAuth2 Client)
- Spring AI 2.0.1 (OpenAI & Vector Store)
- PostgreSQL & pgvector
- Lombok

## Run Locally
1. Start the database via Docker Compose in the root folder.
2. Ensure environment variables (`GROQ_API_KEY`, `GITHUB_CLIENT_ID`, etc.) are configured.
3. Run the application:
   ```bash
   ./mvnw spring-boot:run
   ```

*Note: This repository has been recently cleaned of any unused components, dead code, and unused boilerplate files to maintain a lean structure.*
