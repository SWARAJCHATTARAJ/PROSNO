# Prosno Backend

This is the Spring Boot backend for Prosno. It handles OAuth2 authentication, repository ingestion, chunking, and RAG retrieval over PostgreSQL `pgvector`.

For the complete architecture, lifecycle, and design decisions, see the [main README](../README.md).

## Local development

1. Start the database from the project root:
   ```bash
   cd ..
   docker compose up -d
   ```
2. Configure `.env` in the project root (see the main README).
3. Run the application:
   ```bash
   ./mvnw spring-boot:run
   ```

## Testing

```bash
./mvnw test
```
