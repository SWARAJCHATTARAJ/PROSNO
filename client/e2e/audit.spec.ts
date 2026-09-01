import { test, expect } from '@playwright/test';

test('Audit landing page', async ({ page }) => {
  const errors: string[] = [];
  const consoleLogs: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  
  page.on('pageerror', exception => {
    errors.push(exception.message);
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  
  console.log("=== HYDRATION & RUNTIME ERRORS ===");
  console.log("Page Errors:", errors);
  console.log("Console Warnings/Errors:", consoleLogs);
  
  const viewports = [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 }
  ];
  
  console.log("\n=== MOBILE / LAYOUT OVERFLOW AUDIT ===");
  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(1000); // Wait for relayout
    
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    
    if (bodyWidth > windowWidth) {
      console.log(`Viewport ${vp.width}x${vp.height} -> Horizontal Overflow Detected! (Body: ${bodyWidth}, Window: ${windowWidth})`);
    } else {
      console.log(`Viewport ${vp.width}x${vp.height} -> No horizontal overflow.`);
    }
  }
});
