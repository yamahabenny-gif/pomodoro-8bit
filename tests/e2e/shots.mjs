// Screenshots (and an optional GIF) for the README, captured from the shipped bundle.
// Usage: node tests/e2e/shots.mjs [--gif]
// Writes docs/img/issue-9/menu.png, kampf.png, rast.png, lange-rast.png and (with --gif) kampf.gif.

import { chromium } from "@playwright/test";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 4200;
const BASE = `http://127.0.0.1:${PORT}/`;
const OUT = "docs/img/issue-9";
const WANT_GIF = process.argv.includes("--gif");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, timeout = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`preview server did not start: ${url}`);
}

execFileSync("npm", ["run", "build"], { stdio: "ignore" });
const server = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
  stdio: "ignore",
});
const browser = await chromium.launch();
const frames = mkdtempSync(join(tmpdir(), "pomodoro-frames-"));

try {
  await waitForServer(BASE);
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const shot = async (name) => {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(OUT, `${name}.png`) });
    console.log(`wrote ${OUT}/${name}.png`);
  };

  await page.goto(BASE);
  await page.waitForSelector('[data-part="menu"] .card');
  await sleep(400);
  await shot("menu");

  // Fight: wait until a foe is on stage, then take a burst and keep the frame where the fight is busiest.
  await page.goto(BASE + "?speed=60");
  await page.getByRole("option", { name: /^Klassisch:/ }).click();
  await sleep(2500);
  let best = 0;
  for (let i = 0; i < 10; i++) {
    const file = join(frames, `fight-${String(i).padStart(2, "0")}.png`);
    await page.screenshot({ path: file });
    const size = execFileSync("stat", ["-f", "%z", file]).toString().trim();
    if (Number(size) > best) {
      best = Number(size);
      await page.screenshot({ path: join(OUT, "kampf.png") });
    }
    if (WANT_GIF) await sleep(125);
    else await sleep(700);
  }
  console.log(`wrote ${OUT}/kampf.png`);

  if (WANT_GIF) {
    // Frame-perfect little loop: 6 s of fighting at ~8 fps, 480 x 270, no dithering.
    for (let i = 0; i < 48; i++) {
      await page.screenshot({ path: join(frames, `gif-${String(i).padStart(3, "0")}.png`) });
      await sleep(125);
    }
    execFileSync("ffmpeg", ["-y", "-framerate", "8", "-i", join(frames, "gif-%03d.png"), "-vf", "scale=480:-1:flags=neighbor,palettegen=max_colors=96", join(frames, "palette.png")], { stdio: "ignore" });
    execFileSync("ffmpeg", ["-y", "-framerate", "8", "-i", join(frames, "gif-%03d.png"), "-i", join(frames, "palette.png"), "-lavfi", "scale=480:-1:flags=neighbor[x];[x][1:v]paletteuse=dither=none", "-loop", "0", join(OUT, "kampf.gif")], { stdio: "ignore" });
    console.log(`wrote ${OUT}/kampf.gif`);
  }

  // Short break: pause the moment it starts, then let her walk to the fire and sit down.
  await page.waitForFunction(
    () => document.querySelector('[data-el="phase"]')?.dataset.phase === "short",
    undefined,
    { polling: "raf", timeout: 40_000 },
  );
  await page.keyboard.press(" ");
  await sleep(5200);
  await shot("rast");

  // Long break: speed through four cycles, freeze on the break, let the night fade finish.
  await page.goto(BASE + "?speed=600");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("option", { name: /^Klassisch:/ }).click();
  await page.waitForFunction(
    () => document.querySelector('[data-el="phase"]')?.dataset.phase === "long",
    undefined,
    { polling: "raf", timeout: 40_000 },
  );
  await page.keyboard.press(" ");
  await sleep(5200);
  await shot("lange-rast");

  await context.close();
} finally {
  await browser.close();
  server.kill();
  rmSync(frames, { recursive: true, force: true });
}
