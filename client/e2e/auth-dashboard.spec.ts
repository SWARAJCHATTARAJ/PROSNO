import { test, expect, type Route, type Page } from '@playwright/test';

async function mockApi(page: Page, url: string | RegExp, response: unknown, status = 200, isStream = false, method?: string) {
  await page.route(url, async (route: Route) => {
    if (method && route.request().method() !== method && route.request().method() !== 'OPTIONS') {
      return route.fallback();
    }
    const headers = {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
    } else if (isStream) {
      await route.fulfill({
        body: response as string,
        headers: { ...headers, 'Content-Type': 'text/event-stream' }
      });
    } else {
      await route.fulfill({ json: response, status, headers });
    }
  });
}

test.describe('Dashboard and Repository States', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      const headers = {
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Access-Control-Allow-Credentials': 'true',
      };
      
      if (method === 'OPTIONS') {
        return route.fulfill({ status: 204, headers });
      }

      if (url.includes('/api/auth/me')) {
        return route.fulfill({ json: { id: '1', displayName: 'Test', githubUsername: 'test' }, headers });
      }

      if (url.includes('/api/repos/1')) {
        return route.fulfill({ json: { id: '1', fullName: 'test/repo-ready', indexStatus: 'READY' }, headers });
      }
      if (url.includes('/api/repos/3')) {
        return route.fulfill({ json: { id: '3', fullName: 'test/repo-expired', indexStatus: 'EXPIRED' }, headers });
      }
      if (url.includes('/api/repos')) {
        return route.fulfill({ json: [
          { id: '1', fullName: 'test/repo-ready', indexStatus: 'READY' },
          { id: '2', fullName: 'test/repo-indexing', indexStatus: 'INDEXING' },
          { id: '3', fullName: 'test/repo-expired', indexStatus: 'EXPIRED' }
        ], headers });
      }

      if (url.includes('/api/auth/csrf')) {
        return route.fulfill({ json: { token: 'mock-csrf-token', headerName: 'X-XSRF-TOKEN' }, headers });
      }

      if (url.includes('/messages')) {
        if (method === 'GET') {
          return route.fulfill({ json: [], headers });
        }
        if (method === 'POST') {
          if (url.includes('session-456')) {
            return route.fulfill({
              headers: { ...headers, 'Content-Type': 'text/event-stream' },
              body: 'event: token\ndata:```python\n\nevent: token\ndata:print("hello")\n\nevent: token\ndata:```\n\nevent: assistant_message\ndata: {"id": "msg-2", "role": "ASSISTANT", "content": "```python\\nprint(\\"hello\\")\\n```", "citations": []}\n\nevent: done\ndata: [DONE]\n\n'
            });
          }
          if (url.includes('session-123')) {
            return route.fulfill({
              headers: { ...headers, 'Content-Type': 'text/event-stream' },
              body: 'event: token\ndata: Hello World\n\nevent: assistant_message\ndata: {"id":"msg-1","role":"ASSISTANT","content":"Hello World","citations":[{"filePath":"src/main.ts","startLine":1,"endLine":1}]}\n\nevent: done\ndata: [DONE]\n\n'
            });
          }
        }
      }

      if (url.includes('/api/chat/sessions')) {
        if (method === 'POST') {
          if (url.includes('repositoryId=1') || route.request().postDataJSON()?.repositoryId === '1') {
            return route.fulfill({ json: { id: 'session-456', title: 'New chat', createdAt: new Date().toISOString() }, headers });
          }
          return route.fulfill({ json: { id: 'session-123', title: 'New chat', createdAt: new Date().toISOString() }, headers });
        }
        if (url.includes('session-123') || url.includes('session-456')) {
          return route.fulfill({ json: [], headers });
        }
        return route.fulfill({ json: [], headers });
      }

      return route.continue();
    });
  });

  test('verifies dashboard renders empty state and sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('text=~/workspaces')).toBeVisible();
  });

  test('verifies chat interface and EXPIRED wake-up flow', async ({ page }) => {
    await page.goto('/chat/3');
    await expect(page.locator('text=Repository sleeping')).toBeVisible();
    await page.fill('textarea', 'Wake up test');
    await page.click('button[aria-label="Send message"]');
    await expect(page.locator('text=Wake up test')).toBeVisible();
    // It should stream a fake answer
    await expect(page.locator('text=Hello World')).toBeVisible();
  });

  test('verifies normal chat streaming', async ({ page }) => {
    await page.goto('/chat/1');
    await expect(page.locator('text=ASK YOUR CODEBASE')).toBeVisible();
    await page.fill('textarea', 'Write some code');
    await page.click('button[aria-label="Send message"]');
    await expect(page.locator('text=Write some code')).toBeVisible();
    await expect(page.locator('pre')).toBeVisible();
  });
});
