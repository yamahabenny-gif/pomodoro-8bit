// One-minute performance sample of the shipped bundle: fps per second, longest frame, JS heap and DOM size.
// Usage: node tests/e2e/perf.mjs   (builds dist first, starts vite preview on port 4199)
// Headless Chromium numbers are a reference, not a middle-class laptop benchmark.

import { chromium } from "@playwright/test";
import { execFileSync, spawn } from "node:child_process";

const PORT = 4199;
const BASE = `http://127.0.0.1:${PORT}/`;
const SECONDS = Number(process.env.PERF_SECONDS ?? 60);
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

try {
  await waitForServer(BASE);
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  // ?speed=60: the one-minute sample covers two focus phases and two breaks.
  await page.goto(BASE + "?speed=60");
  await page.getByRole("option", { name: /^Klassisch:/ }).click();

  await page.evaluate(() => {
    window.__perf = { windows: [], maxFrameMs: 0 };
    let last = performance.now();
    let start = last;
    let count = 0;
    let worst = 0;
    const loop = (t) => {
      const dt = t - last;
      if (dt > worst) worst = dt;
      last = t;
      count += 1;
      if (t - start >= 1000) {
        window.__perf.windows.push({ fps: Math.round((count * 1000) / (t - start)), worstMs: Math.round(worst) });
        start = t;
        count = 0;
        worst = 0;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  const memory = () =>
    page.evaluate(() => {
      const heap = performance.memory?.usedJSHeapSize ?? 0;
      return { heap, nodes: document.querySelectorAll("*").length };
    });

  const first = await memory();
  const samples = [first];
  for (let i = 0; i < SECONDS / 10; i++) {
    await sleep(10_000);
    samples.push(await memory());
  }
  const perf = await page.evaluate(() => window.__perf);
  const phase = await page.locator('[data-el="phase"]').innerText();
  const clock = await page.locator('[data-el="clock"]').innerText();

  const fps = perf.windows.map((w) => w.fps);
  const avg = fps.reduce((sum, value) => sum + value, 0) / Math.max(1, fps.length);
  const min = Math.min(...fps);
  const maxFrame = Math.max(...perf.windows.map((w) => w.worstMs));
  const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);
  const heapStart = samples[0].heap;
  const heapEnd = samples.at(-1).heap;
  const heapPeak = Math.max(...samples.map((s) => s.heap));

  console.log(`Phase nach ${SECONDS}s: ${phase} (${clock})`);
  console.log(`fps: Ø ${avg.toFixed(1)} · min ${min} · längster Frame ${maxFrame} ms (${fps.length} Sekundenfenster)`);
  console.log(`JS-Heap: Start ${mb(heapStart)} MB · Peak ${mb(heapPeak)} MB · Ende ${mb(heapEnd)} MB · Δ ${mb(heapEnd - heapStart)} MB`);
  console.log(`DOM-Knoten: ${samples[0].nodes} → ${samples.at(-1).nodes}`);
  console.log(`Fehler: ${errors.length ? errors.slice(0, 3).join(" | ") : "keine"}`);
  console.log(
    `Bewertung: ${avg >= 55 && min >= 30 && heapEnd - heapStart < 8 * 1024 * 1024 ? "unauffällig" : "auffällig – Werte prüfen"}`,
  );

  process.exitCode = errors.length ? 1 : 0;
} finally {
  await browser.close();
  server.kill();
}
