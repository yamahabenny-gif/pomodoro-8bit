// CONTRACT: browser QA of the real ?speed=60 game; dev server must already run.
// Usage: node tools/scenes/enemies-browser.mjs [http://127.0.0.1:4251]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const out = 'docs/img/issue-51';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:4251'}/?speed=60`);
  await page.getByRole('option', { name: /^Klassisch:/ }).click();
  const captured = new Set();
  const palette = await page.evaluate(async () => {
    const { palettes } = await import('/src/game/enemies/sprites.js');
    return Object.fromEntries(Object.entries(palettes).map(([kind, colors]) => [kind,
      [colors.G ?? colors.l, colors.g ?? colors.S].map(hex => parseInt(hex.slice(1), 16))]));
  });
  for (let step = 0; step < 130; step++) {
    await page.waitForTimeout(200);
    const counts = await page.evaluate(palette => {
      const canvas = document.querySelector('#stage');
      const { data } = canvas.getContext('2d').getImageData(0, 0, 320, 180);
      const counts = Object.fromEntries(Object.keys(palette).map(kind => [kind, 0]));
      for (let y = 90; y < 150; y++) for (let x = 135; x < 300; x++) {
        const i = (y * 320 + x) * 4, rgb = data[i] * 65536 + data[i + 1] * 256 + data[i + 2];
        for (const [kind, colors] of Object.entries(palette)) if (colors.includes(rgb)) counts[kind]++;
      }
      return counts;
    }, palette);
    for (const [kind, count] of Object.entries(counts)) if (count > 45 && !captured.has(kind)) {
      await page.screenshot({ path: `${out}/browser-${kind}.png` });
      captured.add(kind);
      console.log(`Captured ${kind}: ${count} material pixels`);
    }
  }
  console.log(JSON.stringify({ errors, captured: [...captured], phase: await page.locator('[data-el="phase"]').getAttribute('data-phase') }));
  if (errors.length) throw new Error(errors.join('\n'));
  if (!captured.has('orc') || !captured.has('golem')) throw new Error('Orc/golem not observed in live demo');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.reload();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/browser-mobile.png` });
} finally {
  await browser.close();
}
