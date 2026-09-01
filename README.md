# Prosno

Prosno lets you ask questions about a GitHub repository and trace answers back to the code.

## What Prosno does

It downloads your repository, breaks the code into syntax-aware chunks, and stores them in PostgreSQL with pgvector. When you ask a question, it uses hybrid search (exact vector similarity + full-text search) to find relevant code, and streams an answer back from an LLM with precise file and line-number citations.

## Architecture

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, React Query
- **Backend**: Java 21, Spring Boot 4.1.1, Spring AI 2.0.1
- **Database**: PostgreSQL 16 + pgvector
- **AI Models**: Groq (`llama-3.3-70b-versatile`) for generation, HuggingFace (`all-MiniLM-L6-v2` / 384d) for embeddings

## Main flow

1. **GitHub repository**: You provide a GitHub URL.
2. **Indexing**: The backend downloads the tarball in memory (bypassing the 5,000 req/hr API limit of recursive fetches).
3. **Chunking**: Code is chunked using an AST-approximate regex to keep function blocks intact.
4. **Embeddings**: Chunks are embedded and stored in PostgreSQL.
5. **Retrieval**: Questions trigger a hybrid search. We use EXACT KNN vector search alongside PostgreSQL `to_tsvector` text search.
6. **RRF**: Reciprocal Rank Fusion combines the vector and text scores.
7. **Grounded answer**: The LLM answers the question using only the retrieved context.
8. **Citations**: The response streams back via SSE with accurate file and line references.

## Local development

### 1. Prerequisites
- Docker & Docker Compose
- Java 21 & Maven
- Node.js 18+ & npm

### 2. Environment variables

Create a `.env` file in the project root (`/prosno/.env`).

**Required:**
```env
GROQ_API_KEY=your_groq_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key

# GitHub OAuth app configuration
# Set the authorization callback URL in GitHub to: http://localhost:8080/login/oauth2/code/github
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

**Optional local defaults:**
```env
DB_URL=jdbc:postgresql://localhost:5433/prosno
DB_USERNAME=postgres
DB_PASSWORD=postgres
TOKEN_ENCRYPTOR_PASSWORD=your_encryption_password
```

### 3. Start PostgreSQL
The database runs on port `5433` (mapped from 5432 internally).
```bash
docker compose up -d
```

### 4. Start the backend
Ensure Docker is up first so Flyway can initialize the database.
```bash
cd backend
./mvnw spring-boot:run
```

### 5. Start the frontend
```bash
cd client
npm install
npm run dev
```

Visit `http://localhost:3000` to log in via GitHub.

## Database

We use PostgreSQL with the `pgvector` extension. 

**Vector search strategy:** We rely on EXACT KNN (K-Nearest Neighbors) combined with a standard B-tree index on the `repository_id` column. We do *not* use HNSW or IVFFlat indexes, as exact KNN with repository-level filtering is fast enough for our chunk volumes and avoids recall degradation.

## Indexing

When a repository is added, it enters a `PENDING` state and moves to `INDEXING`. The backend downloads the tarball, chunks the files, generates embeddings, and inserts them. If the Java process crashes during indexing, an `ApplicationReadyEvent` listener catches orphaned jobs on startup and resets them to `FAILED`. Once finished, the repository becomes `READY`.

## Retention

Repositories go through a strict lifecycle to manage database growth:
- **READY / PENDING**: Active states.
- **EXPIRED**: If a repository hasn't been queried for a configured number of days, it enters soft expiry. The raw code chunks and vectors are deleted from the database to save space, but the repository metadata remains.
- **Hard delete**: If an `EXPIRED` repository remains unused beyond the hard-cleanup threshold (based on `expiredAt`), it is completely deleted from the database.

A background scheduled task manages this cleanup. If you query an `EXPIRED` repository, Prosno will wake it up by re-indexing it from scratch.

## Chat / SSE

Chat runs over Server-Sent Events (SSE). The LLM response streams in real-time alongside a custom payload format that includes metadata like citation coordinates. 

## Testing

**Frontend:**
```bash
cd client
npm run build
npx playwright test
```

**Backend:**
```bash
cd backend
./mvnw test
```

## Security

- **Authentication**: Standard GitHub OAuth2 flow.
- **Sessions**: Managed via `PROSNO_SESSION` HTTP-only cookies.
- **CSRF**: Enforced using `CookieCsrfTokenRepository` adapted for SPAs (Next.js manually attaches the `X-XSRF-TOKEN` header).
- **OAuth Tokens**: Encrypted at rest using AES via `CryptoConfig`.
- **Isolation**: Vector searches are strictly filtered by the authenticated user's repository IDs.