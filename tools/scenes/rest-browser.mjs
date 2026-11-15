// CONTRACT: verify the real game at ?speed=60 against a running Vite server.
// Run npm run dev -- --port 4252, then node tools/scenes/rest-browser.mjs.
// Captures desktop/mobile rest scenes and records steady-state rAF throughput.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const browser = await chromium.launch();
const out = 'docs/img/issue-52';
const results = [];
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://127.0.0.1:4252/?speed=60');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('option', { name: /^Klassisch:/ }).click();
  const phase = async name => page.waitForFunction(expected => document.querySelector('[data-el="phase"]')?.dataset.phase === expected, name);
  const skip = async name => { await page.keyboard.press('s'); await phase(name); };
  const measure = async name => {
    await page.waitForTimeout(6500);
    const perf = await page.evaluate(() => new Promise(resolve => {
      const windows = [];
      let start, previous, count = 0, worst = 0;
      function tick(t) {
        if (start === undefined) { start = previous = t; requestAnimationFrame(tick); return; }
        count++; worst = Math.max(worst, t - previous); previous = t;
        if (t - start >= 1000) {
          windows.push({ fps: count * 1000 / (t - start), worstMs: worst });
          start = t; count = 0; worst = 0;
        }
        if (windows.length === 12) resolve(windows); else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }));
    await page.screenshot({ path: `${out}/browser-${name}.png` });
    const avg = perf.reduce((sum, entry) => sum + entry.fps, 0) / perf.length;
    const min = Math.min(...perf.map(entry => entry.fps));
    results.push({ scene: name, averageFps: avg, minimumFps: min, windows: perf });
    console.log(`${name}: avg ${avg.toFixed(1)} fps, min ${min.toFixed(1)} fps`);
    assert(avg >= 55 && min >= 55, `${name} missed 55 fps`);
  };
  await skip('short');
  await page.keyboard.press(' ');
  await measure('gewitter');
  await page.keyboard.press(' ');
  await skip('focus');
  await page.waitForTimeout(400);
  await skip('short');
  await page.keyboard.press(' ');
  await measure('see');
  await page.setViewportSize({ width: 812, height: 375 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/browser-see-mobil.png` });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.keyboard.press(' ');
  await skip('focus');
  await page.waitForTimeout(400);
  await skip('short');
  await skip('focus');
  await page.waitForTimeout(400);
  await skip('long');
  await page.keyboard.press(' ');
  await measure('nacht');
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/browser-report.json`, JSON.stringify({ url: '?speed=60', viewport: [1280, 900], errors, results }, null, 2) + '\n');
} finally {
  await browser.close();
}
