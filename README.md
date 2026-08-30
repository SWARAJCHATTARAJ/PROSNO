# Prosno

Prosno is a tool that lets developers chat with their GitHub repositories. It integrates directly with GitHub to pull your code, parses the syntax, and allows you to query the codebase using Retrieval-Augmented Generation (RAG).

## How It Works

1. **Auth & Setup**: Users authenticate via GitHub OAuth.
2. **Repo Indexing**: The backend downloads the target repository as a `.zip` stream directly from GitHub (bypassing REST API rate limits that usually choke recursive tree fetching).
3. **Syntax-Aware Chunking**: The Java backend chunks the codebase. Instead of naive token splitting, it uses AST-approximate regex (splitting on C-style closing braces and double newlines) to keep function blocks intact.
4. **Vector & Keyword Storage**: Chunks are embedded using HuggingFace and inserted into a PostgreSQL database running `pgvector`.
5. **Hybrid Search RAG**: When a user asks a question, the backend performs a hybrid search (semantic cosine similarity via `pgvector` + full-text BM25 via Postgres `to_tsvector`).
6. **LLM Answering**: Groq evaluates the retrieved chunks and streams a response back via Server-Sent Events (SSE), complete with file and line-number citations.

## Tech Stack

### Frontend
- **Framework**: Next.js 16.3.2 (App Router) + React 19.2.8
- **Styling**: Tailwind CSS v4 + Shadcn UI v4.19 (optimized) + Base UI v1.7.0
- **State & Fetching**: React Query v5
- **Markdown**: `streamdown` v2.6.0 (handles real-time markdown streaming and syntax highlighting via Shiki)

### Backend
- **Framework**: Java 21 + Spring Boot 4.1.1
- **AI Framework**: Spring AI 2.0.1
- **Database**: PostgreSQL 16 + `pgvector` extension
- **Security**: Spring Security (OAuth2 Client)
- **LLM / Embedding**: Groq (`llama-3.3-70b-versatile`) + HuggingFace (`all-MiniLM-L6-v2` / 384 dimensions)

## Implementation Notes

- **GitHub Rate Limits**: Standard recursive file-fetching exhausts GitHub's 5,000 req/hr API limit instantly. Prosno works around this by downloading the repository tarball in a single in-memory stream.
- **Job Recovery**: If the Java process crashes while indexing a large codebase, the repository gets permanently stuck in an `INDEXING` state. An `ApplicationReadyEvent` listener catches these orphaned jobs on startup and resets them to `FAILED` to unlock them.
- **Auth & Session**: Sessions use standard `PROSNO_SESSION` HTTP-only cookies. CSRF is enforced using `CookieCsrfTokenRepository` adapted for Single Page Applications (Next.js manually attaches the `X-XSRF-TOKEN` header on requests). GitHub OAuth tokens are encrypted at rest using AES via `CryptoConfig`.

## Local Setup

### 1. Prerequisites
- Docker & Docker Compose
- Java 21 & Maven
- Node.js 18+ & npm

### 2. Environment Variables
Create a `.env` file in the project root (`/prosno/.env`) with the following variables. 

```env
GROQ_API_KEY=your_groq_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key

# GitHub OAuth app configuration
# Set the authorization callback URL in GitHub to: http://localhost:8080/login/oauth2/code/github
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

*(Optional variables for local testing)*:
- `DB_URL` (Defaults to `jdbc:postgresql://localhost:5433/prosno`)
- `DB_USERNAME` / `DB_PASSWORD` (Defaults to `postgres` / `postgres`)
- `TOKEN_ENCRYPTOR_PASSWORD` (Used to encrypt OAuth tokens in DB)

### 3. Start PostgreSQL
The database runs on port `5433` (mapped from 5432 internally) to avoid conflicting with any native Postgres installations you might have.
```bash
docker compose up -d
```

### 4. Start the Backend (Spring Boot)
The backend runs on port `8080`. Ensure Docker is up first so Flyway/Hibernate can connect and initialize the `vector_store` schema.
```bash
cd backend
./mvnw spring-boot:run
```

### 5. Start the Frontend (Next.js)
The frontend runs on port `3000`.
```bash
cd client
npm install
npm run dev
```

Visit `http://localhost:3000` to log in via GitHub and use the application.