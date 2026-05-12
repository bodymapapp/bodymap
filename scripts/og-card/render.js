// Render template.html to og-card.png at 1200x630 (2x retina).
// To ship: node scripts/og-card/render.js && cp /tmp/og-card.png public/og-card.png

const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const templatePath = path.resolve(__dirname, 'template.html');
  await page.goto(`file://${templatePath}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.screenshot({
    path: '/tmp/og-card.png',
    type: 'png',
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  });
  await browser.close();
  console.log('Saved /tmp/og-card.png. Copy to public/og-card.png to ship.');
})();
