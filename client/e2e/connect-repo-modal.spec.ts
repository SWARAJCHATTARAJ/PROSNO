import { test, expect, type Route, type Page } from '@playwright/test';

const mockRepos = [
  {
    id: 1,
    name: 'ultra-long-repository-name-without-spaces-testing-wrapping-and-overflow-safety-in-prosno',
    fullName: 'enterprise-org-super-long-name/ultra-long-repository-name-without-spaces-testing-wrapping-and-overflow-safety-in-prosno',
    owner: 'enterprise-org-super-long-name',
    isPrivate: true,
    htmlUrl: 'https://github.com/enterprise-org-super-long-name/ultra-long-repository-name-without-spaces-testing-wrapping-and-overflow-safety-in-prosno',
    description: 'This is a deliberately extremely long repository description created to verify that the Connect Repository modal safely constrains text, applies line clamping to at most 2 lines on desktop, and wraps long text without pushing the right edge outside the modal boundary.',
    defaultBranch: 'main',
    language: 'TypeScript',
    connected: false,
    connectedRepoId: null,
    indexStatus: null,
  },
  {
    id: 2,
    name: 'connected-repo',
    fullName: 'acme/connected-repo',
    owner: 'acme',
    isPrivate: false,
    htmlUrl: 'https://github.com/acme/connected-repo',
    description: 'A connected repository to test checkbox alignment and badge positioning.',
    defaultBranch: 'main',
    language: 'Go',
    connected: true,
    connectedRepoId: 'repo-2',
    indexStatus: 'READY',
  },
  ...Array.from({ length: 13 }, (_, i) => ({
    id: i + 3,
    name: `repo-item-${i + 3}`,
    fullName: `test-org/repo-item-${i + 3}`,
    owner: 'test-org',
    isPrivate: i % 2 === 0,
    htmlUrl: `https://github.com/test-org/repo-item-${i + 3}`,
    description: `Standard description for repository item number ${i + 3} with various metadata.`,
    defaultBranch: 'main',
    language: i % 3 === 0 ? 'Python' : i % 3 === 1 ? 'Rust' : 'JavaScript',
    connected: false,
    connectedRepoId: null,
    indexStatus: null,
  })),
];

async function setupApiMocks(page: Page) {
  await page.route('**/api/**', async (route: Route) => {
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
      return route.fulfill({
        json: { id: 'user-1', displayName: 'Test User', githubUsername: 'testuser' },
        headers,
      });
    }

    if (url.includes('/api/auth/csrf')) {
      return route.fulfill({
        json: { token: 'mock-csrf-token', headerName: 'X-CSRF-TOKEN' },
        headers,
      });
    }

    if (url.includes('/api/repos/github')) {
      return route.fulfill({ json: mockRepos, headers });
    }

    if (url.includes('/api/repos')) {
      return route.fulfill({ json: [], headers });
    }

    return route.continue();
  });
}

test.describe('Connect Repository Modal UI & Layout', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('verifies responsive width, max height, no horizontal overflow, and scrollable list with 10+ repos', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dashboard');

    const connectButton = page.getByRole('button', { name: /connect repository/i }).first();
    await expect(connectButton).toBeVisible();
    await connectButton.click();

    const dialog = page.locator('[data-slot="dialog-content"]');
    await expect(dialog).toBeVisible();

    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    if (dialogBox) {
      expect(Math.round(dialogBox.width)).toBeLessThanOrEqual(760);
      expect(Math.round(dialogBox.width)).toBeGreaterThanOrEqual(750);
      expect(dialogBox.height).toBeLessThanOrEqual(800 * 0.8 + 2);
    }

    const hasHorizontalOverflow = await dialog.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);

    const repoRows = dialog.locator('.divide-y > div');
    await expect(repoRows).toHaveCount(15);

    const longNameEl = dialog.locator('text=enterprise-org-super-long-name/ultra-long-repository-name');
    await expect(longNameEl).toBeVisible();
    const longNameBox = await longNameEl.boundingBox();
    if (longNameBox && dialogBox) {
      expect(longNameBox.x + longNameBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width + 1);
    }

    const longDescEl = dialog.locator('text=This is a deliberately extremely long repository description');
    await expect(longDescEl).toBeVisible();
    const longDescBox = await longDescEl.boundingBox();
    if (longDescBox && dialogBox) {
      expect(longDescBox.x + longDescBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width + 1);
      expect(longDescBox.height).toBeLessThanOrEqual(48);
    }

    const scrollContainer = dialog.locator('.overflow-y-auto');
    await expect(scrollContainer).toBeVisible();

    const isScrollable = await scrollContainer.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(isScrollable).toBe(true);

    const header = dialog.locator('[data-slot="dialog-header"]');
    const headerInitialBox = await header.boundingBox();

    await scrollContainer.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(100);

    const headerAfterScrollBox = await header.boundingBox();
    expect(headerAfterScrollBox?.y).toBe(headerInitialBox?.y);

    const lastItem = dialog.locator('text=test-org/repo-item-15');
    await expect(lastItem).toBeVisible();
    const lastItemBox = await lastItem.boundingBox();
    if (lastItemBox && dialogBox) {
      expect(lastItemBox.y + lastItemBox.height).toBeLessThanOrEqual(dialogBox.y + dialogBox.height);
    }
  });

  test('verifies alignment between connected and unconnected rows', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dashboard');

    await page.getByRole('button', { name: /connect repository/i }).first().click();
    const dialog = page.locator('[data-slot="dialog-content"]');
    await expect(dialog).toBeVisible();

    const firstRowTextContainer = dialog.locator('.divide-y > div').nth(0).locator('.min-w-0.flex-1').first();
    const secondRowTextContainer = dialog.locator('.divide-y > div').nth(1).locator('.min-w-0.flex-1').first();

    const box1 = await firstRowTextContainer.boundingBox();
    const box2 = await secondRowTextContainer.boundingBox();

    expect(box1).not.toBeNull();
    expect(box2).not.toBeNull();
    if (box1 && box2) {
      expect(Math.round(box1.x)).toBe(Math.round(box2.x));
    }
  });

  test('verifies modal responsiveness at 1440px, 1920px, and mobile viewports', async ({ page }) => {
    const viewports = [
      { width: 1440, height: 900, expectedMaxWidth: 760 },
      { width: 1920, height: 1080, expectedMaxWidth: 760 },
      { width: 390, height: 844, expectedMaxWidth: 390 * 0.92 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/dashboard');

      const btn = page.getByRole('button', { name: /connect repository/i }).first();
      await btn.click();

      const dialog = page.locator('[data-slot="dialog-content"]');
      await expect(dialog).toBeVisible();

      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(vp.expectedMaxWidth + 2);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
        expect(box.height).toBeLessThanOrEqual(vp.height * 0.8 + 2);
      }

      const hasHorizontalOverflow = await dialog.evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(hasHorizontalOverflow).toBe(false);

      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
    }
  });

  test('verifies repository search filter and selection banner interaction', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dashboard');

    await page.getByRole('button', { name: /connect repository/i }).first().click();
    const dialog = page.locator('[data-slot="dialog-content"]');
    await expect(dialog).toBeVisible();

    const searchInput = dialog.locator('input[placeholder*="Filter repositories"]');
    await searchInput.fill('ultra-long');

    const filteredRows = dialog.locator('.divide-y > div');
    await expect(filteredRows).toHaveCount(1);
    await expect(dialog.locator('text=enterprise-org-super-long-name')).toBeVisible();

    await searchInput.clear();
    await expect(filteredRows).toHaveCount(15);

    const firstCheckbox = dialog.locator('input[type="checkbox"]').first();
    await firstCheckbox.check();

    await expect(dialog.locator('text=1 selected')).toBeVisible();
    await expect(dialog.locator('button:has-text("Connect selected (1)")')).toBeVisible();

    await dialog.locator('button:has-text("Clear")').click();
    await expect(dialog.locator('text=1 selected')).not.toBeVisible();
  });
});
