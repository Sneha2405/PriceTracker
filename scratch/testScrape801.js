require('dotenv').config();
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://demo.inelabteamdev.com/product/801', { waitUntil: 'domcontentloaded' });
  const priceBlock = page.locator('.price-block');
  await priceBlock.waitFor({ state: 'visible', timeout: 10000 });

  const box = await priceBlock.boundingBox();
  if (box) {
    for (let i = 0; i < 15; i++) {
      await page.mouse.move(box.x + 25 + i * 10, box.y + 20);
      await page.waitForTimeout(55);
    }
    await page.waitForTimeout(750);
  }

  const btn = page.locator('button[aria-label="Reveal price"]');
  await btn.waitFor({ state: 'visible' });
  await btn.click();
  await page.waitForTimeout(2000);

  const tryAgainBtn = page.locator('button:has-text("TRY AGAIN"), button:has-text("Try again")');
  if (await tryAgainBtn.isVisible().catch(() => false)) {
    console.log('Detected challenge_failed! Clicking TRY AGAIN...');
    await tryAgainBtn.click();
    await page.waitForTimeout(2000);
  }

  await page.waitForSelector('.price-success', { timeout: 10000 });
  console.log('SUCCESS DECRYPTED PRICE:', await page.locator('.price-success').innerText());

  await browser.close();
})();
