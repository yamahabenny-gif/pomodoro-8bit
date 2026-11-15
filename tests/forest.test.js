import { describe, it, expect } from "vitest";
import { createFrame } from "pixelfx/core/index.js";
import { createForest } from "../src/game/scene/forest.js";
import { W, H, GROUND_Y } from "../src/engine/stage.js";

const settle = (forest, seconds = 2.5, step = 1 / 30) => {
  for (let t = 0; t < seconds; t += step) forest.update(step);
};

const modeBytes = (forest) => {
  const bg = forest.background();
  return bg;
};

describe("forest scene", () => {
  it("follows the contract and starts in the afternoon fight", () => {
    const forest = createForest();
    expect(forest.mode).toBe("fight");
    expect(typeof forest.setMode).toBe("function");
    expect(typeof forest.scroll).toBe("function");
    expect(typeof forest.update).toBe("function");
    expect(typeof forest.drawBack).toBe("function");
    expect(typeof forest.drawFront).toBe("function");
    expect(forest.campfireX).toBeGreaterThan(0);
    expect(forest.campfireX).toBeLessThan(W);

    const bg = modeBytes(forest);
    expect(bg).toBeInstanceOf(Uint32Array);
    expect(bg).toHaveLength(W * H);
    let lit = 0;
    for (const c of bg) if (c) lit++;
    expect(lit).toBe(W * H);
  });

  it("gives every mode its own sky and crossfades instead of cutting", () => {
    const forest = createForest();
    const fight = forest.background().slice();

    forest.setMode("camp");
    expect(forest.mode).toBe("camp");
    forest.update(0.5);
    const midFade = forest.background();
    expect(midFade).not.toEqual(fight);

    settle(forest);
    const camp = modeBytes(forest);
    expect(camp).not.toEqual(fight);
    expect(forest.background()).toBe(camp); // baked per mode, not rebuilt every frame

    forest.setMode("night", { instant: true });
    settle(forest);
    const night = modeBytes(forest);
    expect(night).not.toEqual(camp);
    expect(night).toHaveLength(W * H);
  });

  it("ignores unknown modes instead of switching silently", () => {
    const forest = createForest();
    expect(() => forest.setMode("dawn")).toThrow(/unknown mode/);
    expect(forest.mode).toBe("fight");
  });

  it("keeps the journey deterministic and wraps after all three sections", () => {
    const forest = createForest();
    const before = forest.background().slice();
    forest.scroll(3000); // One far-layer period advances to the glade.
    expect(forest.background()).not.toEqual(before);
    const glade = forest.background().slice();
    expect(createForest().background()).toEqual(before);
    const sameGlade = createForest();
    sameGlade.scroll(3000);
    expect(sameGlade.background()).toEqual(glade);
    forest.scroll(3000); // The bridge is the third section.
    expect(forest.background()).not.toEqual(glade);
    forest.scroll(3000); // The complete 1,440 px journey repeats seamlessly.
    expect(forest.background()).toEqual(before);
    forest.scroll(120);
    expect(forest.background()).not.toEqual(before);
    expect(forest.background()).toHaveLength(W * H);
  });

  it("moves the parallax layers as the world scrolls", () => {
    const forest = createForest();
    settle(forest, 0.5);
    const before = createFrame(W, H);
    forest.drawBack(before);
    forest.scroll(50);
    const after = createFrame(W, H);
    forest.drawBack(after);
    let moved = 0;
    for (let i = 0; i < before.color.length; i++) if (before.color[i] !== after.color[i]) moved++;
    expect(moved).toBeGreaterThan(100);
  });

  it("draws back and front layers, the front grass below the floor line", () => {
    const forest = createForest();
    settle(forest, 1);
    const frame = createFrame(W, H);
    forest.drawBack(frame);
    let back = 0;
    for (const c of frame.color) if (c) back++;
    expect(back).toBeGreaterThan(500);

    const front = createFrame(W, H);
    forest.drawFront(front);
    let grass = 0;
    for (let y = GROUND_Y; y < H; y++) for (let x = 0; x < W; x++) if (front.color[y * W + x]) grass++;
    expect(grass).toBeGreaterThan(200);
  });

  it("never paints fight foreground or glow across the character area", () => {
    const forest = createForest();
    const marker = 0xffaf37bd;
    for (const scroll of [0, 120, 2800, 3480, 2600, -9000]) {
      forest.scroll(scroll);
      forest.update(1.7);
      const frame = createFrame(W, H);
      forest.drawBack(frame);
      // An opaque actor can occupy any pixel above the two-pixel grass fringe.
      frame.color.fill(marker, 0, W * (GROUND_Y - 2));
      const light = frame.light.slice();
      forest.drawFront(frame);
      expect(frame.color.subarray(0, W * (GROUND_Y - 2)).every((c) => c === marker)).toBe(true);
      expect(frame.light).toEqual(light);
    }
  });

  it("keeps mist in the lower third and moves it without moving the camera", () => {
    const forest = createForest();
    const a = createFrame(W, H), b = createFrame(W, H);
    forest.drawBack(a);
    forest.update(4);
    forest.drawBack(b);
    expect(a.color.subarray(0, W * 103)).toEqual(b.color.subarray(0, W * 103));
    let changed = 0;
    for (let y = 108; y < GROUND_Y; y++) for (let x = 0; x < W; x++) {
      if (a.color[y * W + x] !== b.color[y * W + x]) changed++;
    }
    expect(changed).toBeGreaterThan(200);
  });

  it("puts a lit fire and fireflies at the campfire in camp and night", () => {
    const forest = createForest();
    forest.setMode("night", { instant: true });
    settle(forest, 2);
    const frame = createFrame(W, H);
    forest.drawBack(frame);
    forest.drawFront(frame);
    let warm = 0;
    for (let y = GROUND_Y - 50; y < GROUND_Y; y++)
      for (let x = Math.max(0, forest.campfireX - 40); x < Math.min(W, forest.campfireX + 40); x++)
        if (frame.color[y * W + x] || frame.light[y * W + x]) warm++;
    expect(warm).toBeGreaterThan(100);
  });
});
