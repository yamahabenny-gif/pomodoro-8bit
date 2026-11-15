import { test, expect } from "@playwright/test";

// Smoke test for the shipped bundle: menu -> Klassisch -> HUD -> XP bar and level-up -> focus ends -> break with
// the rest scene and a lit fire, without console errors.
// ?speed=600 turns the 25 minute focus into 2.5 s, so the phase change is observable in a few seconds. The break is
// paused as soon as it starts; the scene keeps animating, so the heroine can walk over and light the fire.

/** Warm pixels around either campfire position (storm x≈219, lake x≈78). */
const warmPixels = (page) =>
  page.evaluate(() => {
    const canvas = document.querySelector("canvas#stage");
    const d = canvas.getContext("2d").getImageData(0, 0, 320, 180).data;
    let warm = 0;
    for (let y = 110; y < 155; y++) {
      for (let x = 0; x < 320; x++) {
        const i = (y * 320 + x) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (r > 170 && r > b + 55 && g > 60) warm += 1;
      }
    }
    return warm;
  });

test("menu starts a classic session, HUD counts down, XP grows and the break follows", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  // Remember whether the LEVEL UP! banner ever opened; it closes after 2 s, which is easy to miss.
  await page.addInitScript(() => {
    window.__sawLevelUp = false;
    const tick = () => {
      if (document.querySelector('[data-el="levelup"]')?.classList.contains("is-open")) window.__sawLevelUp = true;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await page.goto("/?speed=600");

  // Menu: three variants, Klassisch is the first card.
  await expect(page.locator('[data-part="menu"]')).toBeVisible();
  await expect(page.locator("[data-el=cards] .card")).toHaveCount(3);
  await page.getByRole("option", { name: /^Klassisch:/ }).click();

  // HUD: clock, phase, cycle pips, kill counter, XP bar and controls appear.
  await expect(page.locator('[data-part="hud"]')).toBeVisible();
  await expect(page.locator('[data-el="clock"]')).toHaveText(/^\d{2}:\d{2}$/);
  await expect(page.locator('[data-el="phase"]')).toHaveText("Kampf");
  await expect(page.locator('[data-el="kills"] .kill')).toHaveCount(3);
  await expect(page.locator('[data-act="skip"]')).toBeVisible();
  await expect(page.locator("canvas#stage")).toBeVisible();

  // The XP bar is part of the HUD and grows with the focus minutes (at this speed a whole level lands in 1.5 s).
  await expect(page.locator('[data-el="xp"]')).toBeVisible();
  await expect(page.locator('[data-el="xp-bar"]')).toHaveAttribute("aria-valuemin", "0");
  await page.waitForFunction(
    () => Number(document.querySelector('[data-el="xp-bar"]')?.getAttribute("aria-valuenow")) > 0,
    undefined,
    { timeout: 4000, polling: 100 },
  );

  // A level-up shows the banner. The focus (2.5 s) is long enough for level 2 (15 focus minutes).
  await expect
    .poll(() => page.evaluate(() => window.__sawLevelUp), { timeout: 5000, intervals: [100] })
    .toBe(true);
  await expect(page.locator('[data-el="levelup"]')).toContainText("LEVEL UP!");

  // The focus phase runs out and the HUD switches to the break. Poll on rAF so the short
  // break (0.5 s at this speed) cannot be missed between two assertions.
  await page.waitForFunction(
    () => document.querySelector('[data-el="phase"]')?.dataset.phase === "short",
    undefined,
    { timeout: 15_000, polling: "raf" },
  );
  await expect(page.locator('[data-el="phase"]')).toHaveText("Rast");

  // Freeze the clock on the break; the rest scene keeps playing, so the fire is lit after a few seconds.
  await page.locator('[data-act="pause"]').click();
  await expect(page.locator('[data-el="pause"]')).toHaveAttribute("aria-label", /Weiter/);
  await expect
    .poll(() => warmPixels(page), { timeout: 12_000, intervals: [500] })
    .toBeGreaterThan(250);

  // Pause keeps the phase and the clock.
  await page.waitForTimeout(200); // let the pause settle one frame before sampling the clock
  const frozen = await page.locator('[data-el="clock"]').textContent();
  await page.waitForTimeout(600);
  await expect(page.locator('[data-el="clock"]')).toHaveText(frozen);
  await expect(page.locator('[data-el="phase"]')).toHaveText("Rast");

  expect(errors, `console/page errors:\n${errors.join("\n")}`).toEqual([]);
});
