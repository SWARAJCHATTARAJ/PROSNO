# Prosno Frontend

This is the Next.js frontend for Prosno. It provides the landing page, GitHub OAuth integration, and the authenticated chat interface.

For the complete architecture, SSE streaming behavior, and design decisions, see the [main README](../README.md).

## Local development

1. Ensure the backend is running (port 8080).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

Visit [http://localhost:3000](http://localhost:3000) to log in.

## Testing

```bash
npm run build
npx playwright test
```
