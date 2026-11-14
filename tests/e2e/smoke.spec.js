import { test, expect } from "@playwright/test";

// Smoke test for the shipped bundle: menu -> Klassisch -> HUD -> focus ends -> break, without console errors.
// ?speed=600 turns the 25 minute focus into 2.5 s, so the phase change is observable in a few seconds.

test("menu starts a classic session, HUD counts down and the break follows", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await page.goto("/?speed=600");

  // Menu: three variants, Klassisch is the first card.
  await expect(page.locator('[data-part="menu"]')).toBeVisible();
  await expect(page.locator("[data-el=cards] .card")).toHaveCount(3);
  await page.getByRole("option", { name: /^Klassisch:/ }).click();

  // HUD: clock, phase, cycle pips, kill counter and controls appear.
  await expect(page.locator('[data-part="hud"]')).toBeVisible();
  await expect(page.locator('[data-el="clock"]')).toHaveText(/^\d{2}:\d{2}$/);
  await expect(page.locator('[data-el="phase"]')).toHaveText("Kampf");
  await expect(page.locator('[data-el="kills"] .kill')).toHaveCount(3);
  await expect(page.locator('[data-act="skip"]')).toBeVisible();
  await expect(page.locator("canvas#stage")).toBeVisible();

  // The focus phase runs out and the HUD switches to the break. Poll on rAF so the short
  // break (0.5 s at this speed) cannot be missed between two assertions.
  await page.waitForFunction(
    () => document.querySelector('[data-el="phase"]')?.dataset.phase === "short",
    undefined,
    { timeout: 15_000, polling: "raf" },
  );
  await expect(page.locator('[data-el="phase"]')).toHaveText("Rast");

  // Freeze the clock on the break and make sure pause keeps the phase.
  await page.locator('[data-act="pause"]').click();
  await expect(page.locator('[data-el="pause"]')).toHaveAttribute("aria-label", /Weiter/);
  await page.waitForTimeout(200); // let the pause settle one frame before sampling the clock
  const frozen = await page.locator('[data-el="clock"]').textContent();
  await page.waitForTimeout(600);
  await expect(page.locator('[data-el="clock"]')).toHaveText(frozen);
  await expect(page.locator('[data-el="phase"]')).toHaveText("Rast");

  expect(errors, `console/page errors:\n${errors.join("\n")}`).toEqual([]);
});
