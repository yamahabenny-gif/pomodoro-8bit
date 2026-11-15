// Screenshots for issue #28 (XP bar + LEVEL UP! banner), taken from the real HUD in a dev harness.
// Usage: node docs/img/issue-28/hud-shots.mjs
// Writes docs/img/issue-28/hud-*.png, desktop (1280 x 720) and phone landscape (844 x 390).

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

const PORT = 4318;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = `${BASE}/docs/img/issue-28/hud-harness.html`;
const OUT = "docs/img/issue-28";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, timeout = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`dev server did not start: ${url}`);
}

mkdirSync(OUT, { recursive: true });
const server = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
  stdio: "ignore",
});
const browser = await chromium.launch();

const VIEWS = [
  { name: "hud-levelbar-desktop", width: 1280, height: 720, query: "?xp=47" },
  { name: "hud-levelup-desktop", width: 1280, height: 720, query: "?xp=34&levelUp=1&freeze=1" },
  { name: "hud-levelbar-phone", width: 844, height: 390, query: "?xp=47" },
  { name: "hud-levelup-phone", width: 844, height: 390, query: "?xp=34&levelUp=1&freeze=1" },
  // Stats without a golem keep the old three-row kill counter (the row only appears with the golem).
  { name: "hud-kills-ohne-golem", width: 844, height: 390, query: "?xp=47&golem=0" },
];

try {
  await waitFor(`${BASE}/docs/img/issue-28/hud-harness.html`);
  for (const view of VIEWS) {
    const context = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => console.error(`pageerror ${view.name}:`, error.message));
    await page.goto(PAGE + view.query);
    await page.waitForFunction(() => window.hudReady === true, undefined, { timeout: 20_000 });
    await sleep(900); // let the forest settle into a nice frame
    await page.screenshot({ path: `${OUT}/${view.name}.png` });
    console.log(`wrote ${OUT}/${view.name}.png`);
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}
