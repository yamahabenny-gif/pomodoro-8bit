// CONTRACT: capture the real Vite game at ?speed=60; optional origin defaults to port 4249.
// Usage: node tools/scenes/forest-browser-check.mjs [origin]
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const origin = process.argv[2] ?? "http://127.0.0.1:4249";
const out = "docs/img/issue-49";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${origin}/?speed=60`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("option", { name: /^Klassisch:/ }).click();
  for (const [name, delay] of [["browser-start", 1200], ["browser-kampf", 6000], ["browser-spaet", 6000]]) {
    await page.waitForTimeout(delay);
    await page.screenshot({ path: `${out}/${name}.png` });
    await page.locator("#stage").screenshot({ path: `${out}/${name}-buehne.png` });
    console.log(name, await page.locator('[data-el="clock"]').textContent());
  }
  // Same walking pose as the isolated scene, with every sprite row inspected directly.
  const diagnosis = await page.evaluate(async () => {
    const { heroinePose } = await import("/src/game/heroine/heroine.js");
    const { createForest } = await import("/src/game/scene/forest.js");
    const { createFrame } = await import("/vendor/pixelfx/src/core/index.js");
    const rows = heroinePose("walk", 2).rows;
    const emptyRows = rows.map((r, i) => /^\.+$/.test(r) ? i : -1).filter((i) => i >= 0);
    const f = createForest(), frame = createFrame(320, 180);
    f.update(2);
    f.drawFront(frame);
    let foregroundAboveFeet = 0;
    for (let i = 0; i < 320 * 148; i++) if (frame.color[i] || frame.light[i]) foregroundAboveFeet++;
    return { emptySpriteRows: emptyRows, foregroundAboveFeet };
  });
  const result = { url: `${origin}/?speed=60`, errors, ...diagnosis };
  writeFileSync(`${out}/browser-check.json`, JSON.stringify(result, null, 2) + "\n");
  console.log(result);
  if (errors.length || diagnosis.foregroundAboveFeet) process.exitCode = 1;
} finally {
  await browser.close();
}
