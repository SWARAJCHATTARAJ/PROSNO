import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('loads and displays main sections', async ({ page, isMobile }) => {
    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle(/prosno/i);

    // Hero visible
    const headline = page.getByRole('heading', { level: 1 }).first();
    await expect(headline).toBeVisible();
    await expect(headline).toContainText(/Turn your/i);

    // Primary CTA works
    const primaryCta = page.getByRole('link', { name: /Connect GitHub/i }).first();
    await expect(primaryCta).toBeVisible();

    // Cinematic scroll section renders
    await expect(page.locator('#how-it-works')).toBeVisible();
    const qText = page.getByText('From question');
    await expect(isMobile ? qText.last() : qText.first()).toBeVisible();

    // Hero demo renders
    await expect(page.getByText('acme / e-commerce').first()).toBeVisible();
  });

  test('navbar works', async ({ page, isMobile }) => {
    await page.goto('/');
    
    if (!isMobile) {
      // Desktop Nav
      const nav = page.locator('nav').first();
      await expect(nav).toBeVisible();
      await expect(nav.getByRole('link', { name: /How it works/i })).toBeVisible();
    }
    
    // Wait for scrolled state
    await page.evaluate(() => window.scrollBy(0, 100));
    await page.waitForTimeout(500); // allow transition
    
    await expect(page.locator('header').first()).toBeVisible();
  });

  test('no console and hydration errors, hero animation progresses and rests', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.text().includes('Hydration') || msg.text().includes('hydrated')) {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify no hydration errors
    const hydrationErrors = errors.filter(e => e.includes('Hydration') || e.includes('hydrated') || e.includes('mismatch'));
    expect(hydrationErrors.length, `Hydration errors found: ${hydrationErrors.join(', ')}`).toBe(0);
    
    // Total errors shouldn't exist
    expect(errors.length, `Console errors found: ${errors.join(', ')}`).toBe(0);

    // Verify HeroInteractive renders and animates
    // Wait 12 seconds for the animation to hit the REST / HOLD period.
    await page.waitForTimeout(12000);
    
    // The answer should be visible
    const answerElement = page.getByText('The refreshed token is not propagated to the checkout client').first();
    await expect(answerElement).toBeVisible();
    
    // Should still be resting after a few more seconds (20s total rest)
    await page.waitForTimeout(3000);
    await expect(answerElement).toBeVisible();
  });

  test('mobile workflow constraints', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    
    // Verify no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(windowWidth);

    // Use .last() since the mobile version is rendered after the desktop version
    await expect(page.getByText('01').last()).toBeVisible();
    await expect(page.getByText('CONNECT').last()).toBeVisible();
    await expect(page.getByText('06').last()).toBeVisible();
    await expect(page.getByText('VERIFY').last()).toBeVisible();
    
    // Verify vertical scrolling works and container isn't clamped to h-screen
    const howItWorks = page.locator('#how-it-works');
    const height = await howItWorks.evaluate((node) => node.clientHeight);
    expect(height).toBeGreaterThan(844);
  });

  test('mobile citation interaction', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    
    const citationSection = page.getByText('ASK THE CODE.').locator('..').locator('..');
    const citationBtn = citationSection.getByRole('button', { name: /\[checkout\/client.ts:84\]/ });
    const sourceRevealLine = citationSection.locator('span', { hasText: 'client.headers.Authorization' });
    
    await expect(sourceRevealLine).not.toHaveClass(/text-primary/);
    
    // Click works for both touch and mouse in Playwright
    await citationBtn.click();
    await expect(citationBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(sourceRevealLine.locator('..')).toHaveClass(/text-primary/);
    
    await page.locator('body').click();
    await expect(citationBtn).toHaveAttribute('aria-expanded', 'false');
  });
});
