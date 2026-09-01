const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000');
  
  const css = await page.evaluate(() => {
    const howItWorks = document.querySelector('#how-it-works');
    const sticky = howItWorks.children[0].children[0];
    const computed = window.getComputedStyle(sticky);
    return {
      position: computed.position,
      top: computed.top,
      height: computed.height,
      className: sticky.className
    };
  });
  console.log(css);
  await browser.close();
})();
