import { test, expect } from '@playwright/test';

test.describe('Landing Page Gap Regression', () => {
  test('verifies no large empty gap between workflow and dependency sections', async ({ page, isMobile }) => {
    await page.goto('/');

    const howItWorks = page.locator('#how-it-works');
    await expect(howItWorks).toBeVisible();

    // To properly check the gap, we scroll to the end of the container
    await page.evaluate(() => {
        const dep = document.querySelectorAll('section')[2]; // 0: hero, 1: workflow, 2: dependency
        if (dep) dep.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await page.waitForTimeout(500); // Wait for scroll and unpin to settle

    const gapInfo = await page.evaluate(() => {
      const isMobile = window.innerWidth < 768;
      const howItWorks = document.querySelector('#how-it-works');
      
      const sections = Array.from(document.querySelectorAll('section'));
      const dependency = sections[sections.findIndex(s => s.id === 'how-it-works') + 1];
      
      if (!howItWorks || !dependency) return { error: 'Sections not found' };
      
      const workflowContent = isMobile 
        ? Array.from(howItWorks.children).find(el => el.classList.contains('md:hidden'))
        : howItWorks.querySelector('.sticky');
        
      if (!workflowContent) return { error: 'Workflow content not found' };

      const wRect = workflowContent.getBoundingClientRect();
      const dRect = dependency.getBoundingClientRect();

      return {
        workflowBottom: wRect.bottom,
        nextTop: dRect.top,
        gap: dRect.top - wRect.bottom
      };
    });

    console.log('Gap info:', gapInfo);
    expect(gapInfo.error).toBeUndefined();
    
    // The visual gap between the bottom of the workflow content and the top of the next section
    // For desktop (sticky h-screen), it should be <= 0 (since they touch exactly, and nextTop might be slightly above if scrolled).
    // For mobile, it's just normal layout flow, which might have some padding.
    // The previous bug had 150px-350px gap. We assert it's strictly < 10px on desktop.
    if (!isMobile) {
        expect(gapInfo.gap).toBeLessThanOrEqual(5);
    } else {
        expect(gapInfo.gap).toBeLessThanOrEqual(5); // On mobile, they are adjacent in the DOM with no margin, except padding inside. Wait, pt-16 is on the inner div! So the sections touch!
    }
  });
});
