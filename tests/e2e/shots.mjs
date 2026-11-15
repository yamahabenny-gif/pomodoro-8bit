// Screenshots (and a GIF) for the README, captured from the shipped bundle.
// Usage: node tests/e2e/shots.mjs [--gif]
// Writes docs/img/issue-31/menu.png, kampf-wald.png, golem.png, levelup.png,
// rast-gewitter.png, rast-see.png, lange-rast.png and (with --gif) kampf.gif.
//
// The Ausbau foes only appear late in a focus phase (the golem at ~74 % of the encounters), so the fight run
// uses ?speed=4: the timer races four times, while the fight animations keep real time and the encounter index
// can still reach the golem. ?speed=60 would end the phase after a handful of fights.

import { chromium } from "@playwright/test";
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 4200;
const BASE = `http://127.0.0.1:${PORT}/`;
const OUT = "docs/img/issue-31";
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

const stateOf = (page) =>
  page.evaluate(() => ({
    phase: document.querySelector('[data-el="phase"]')?.dataset.phase ?? null,
    clock: document.querySelector('[data-el="clock"]')?.textContent ?? "",
    kills: [...document.querySelectorAll('[data-el="kills"] .kill-count')].reduce((sum, el) => sum + Number(el.textContent), 0),
    level: document.querySelector('[data-el="xp-level"]')?.textContent ?? "",
    banner: document.querySelector('[data-el="levelup"]')?.classList.contains("is-open") ?? false,
  }));

mkdirSync(OUT, { recursive: true });
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
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  const shot = async (name) => {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(OUT, `${name}.png`) });
    console.log(`wrote ${OUT}/${name}.png`);
  };

  await page.goto(BASE);
  await page.waitForSelector('[data-part="menu"] .card');
  await sleep(400);
  await shot("menu");

  // ---------- fight run: forest, a late golem, a level-up, the storm shelter ----------
  await page.goto(BASE + "?speed=4");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("option", { name: /^Klassisch:/ }).click();

  let forestShot = false, levelShot = false, golemShot = false;
  const golemCandidates = [];
  for (let i = 0; i < 1200; i++) {
    const state = await stateOf(page);
    if (state.phase !== "focus") {
      console.log(`focus ended at ${state.clock}, ${state.kills} kills, ${state.level}`);
      break;
    }
    if (!forestShot && state.clock <= "23:20") {
      await shot("kampf-wald");
      forestShot = true;
    }
    if (!levelShot && state.banner) {
      await shot("levelup");
      levelShot = true;
    }
    // The golem is encounter 35 of 48: after 34 kills the next foe is stone. It walks in from x=270 at speed 7,
    // so wait for the approach before the GIF starts – otherwise the loop only shows it walking.
    if (state.kills >= 34 && !golemShot) {
      await sleep(16_000);
      for (let f = 0; f < 48; f++) {
        const frame = join(frames, `gif-${String(f).padStart(3, "0")}.png`);
        await page.screenshot({ path: frame });
        if (f % 3 === 0) {
          // A clean still: the golem flashes white for 0.12 s on every hit, so prefer a frame with little white
          // and plenty of stone in the area where it stands (the screenshot itself has no clean-frame hint).
          const look = await page.evaluate(() => {
            const d = document.querySelector("canvas#stage").getContext("2d").getImageData(0, 0, 320, 180).data;
            let white = 0, stone = 0;
            for (let y = 85; y < 152; y++) {
              for (let x = 112; x < 216; x++) {
                const i = (y * 320 + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
                if (r > 232 && g > 232 && b > 232) white += 1;
                if (Math.abs(r - g) < 30 && Math.abs(g - b) < 34 && r > 60 && r < 210) stone += 1;
              }
            }
            return { white, stone };
          });
          golemCandidates.push({ file: frame, ...look });
        }
        await sleep(125);
      }
      golemShot = true;
      console.log("captured golem frames");
      continue;
    }
    await sleep(400);
  }
  if (!forestShot) await shot("kampf-wald");
  if (!levelShot) console.log("warning: no level-up banner seen");

  if (WANT_GIF && golemShot) {
    // 6 s of stone-golem fighting at ~8 fps, 480 x 270, nearest-neighbour, no dithering.
    execFileSync("ffmpeg", ["-y", "-framerate", "8", "-i", join(frames, "gif-%03d.png"), "-vf", "scale=480:-1:flags=neighbor,palettegen=max_colors=96", join(frames, "palette.png")], { stdio: "ignore" });
    execFileSync("ffmpeg", ["-y", "-framerate", "8", "-i", join(frames, "gif-%03d.png"), "-i", join(frames, "palette.png"), "-lavfi", "scale=480:-1:flags=neighbor[x];[x][1:v]paletteuse=dither=none", "-loop", "0", join(OUT, "kampf.gif")], { stdio: "ignore" });
    console.log(`wrote ${OUT}/kampf.gif`);
  }

  // The break starts as soon as the focus runs out: freeze it, let her walk over and light the fire.
  await page.keyboard.press(" ");
  await sleep(6000);
  await shot("rast-gewitter");

  // Resume, skip the rest, skip the next focus: the second break is the lake.
  await page.keyboard.press(" ");
  await page.keyboard.press("s");
  await sleep(1200);
  await page.keyboard.press("s");
  await page.waitForFunction(
    () => document.querySelector('[data-el="phase"]')?.dataset.phase === "short",
    undefined,
    { polling: "raf", timeout: 15_000 },
  );
  await page.keyboard.press(" ");
  await sleep(6000);
  await shot("rast-see");

  // ---------- long break at night ----------
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
  await sleep(6000);
  await shot("lange-rast");

  if (errors.length) console.log(`console/page errors: ${errors.slice(0, 3).join(" | ")}`);
  await context.close();

  // Pick a clean golem frame (no white hit flash) with a lot of stone on stage.
  if (golemShot && golemCandidates.length) {
    const clean = golemCandidates.filter((candidate) => candidate.white < 140 && candidate.stone > 250);
    const pool = clean.length ? clean : golemCandidates;
    pool.sort((a, b) => b.stone - a.stone || a.white - b.white);
    copyFileSync(pool[0].file, join(OUT, "golem.png"));
    console.log(`wrote ${OUT}/golem.png (white ${pool[0].white}, stone ${pool[0].stone})`);
  }
} finally {
  await browser.close();
  server.kill();
  rmSync(frames, { recursive: true, force: true });
}
