import { describe, expect, it, vi } from "vitest";
import { createFrame, hex } from "pixelfx/core/index.js";
import { createHeroine, heroinePose, swordPose } from "../src/game/heroine/heroine.js";

const ANIMS = ["idle", "walk", "attack1", "attack2", "attack3", "hurt", "victory", "sitDown", "sit", "standUp", "lightFire", "levelUp"];
const ANIM_DURATIONS = { attack1: 0.68, attack2: 0.72, attack3: 0.84, hurt: 0.38, victory: 0.9, sitDown: 0.65, standUp: 0.62, lightFire: 1.25, levelUp: 1.2 };

describe("heroine", () => {
  it.each(ANIMS)("draws %s without throwing", (name) => {
    const heroine = createHeroine({ x: 80, y: 150 });
    heroine.play(name);
    heroine.update(0.24);
    expect(() => heroine.draw(createFrame(320, 180))).not.toThrow();
    expect(heroine.anim).toBe(name);
  });

  it.each(["attack1", "attack2", "attack3"])("fires %s callbacks exactly once", (name) => {
    const onHit = vi.fn(), onDone = vi.fn();
    const heroine = createHeroine();
    heroine.play(name, { onHit, onDone });
    for (let i = 0; i < 20; i++) heroine.update(1 / 12);
    expect(onHit).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(heroine.anim).toBe("idle");
    heroine.update(1);
    expect(onHit).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it.each(["hurt", "victory", "sitDown", "standUp"])("fires %s onDone exactly once", (name) => {
    const onDone = vi.fn(), heroine = createHeroine();
    heroine.play(name, { onDone });
    for (let i = 0; i < 20; i++) heroine.update(1 / 12);
    expect(onDone).toHaveBeenCalledTimes(1);
    heroine.update(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("lights the fire at the spark and returns to sit once", () => {
    const onHit = vi.fn(), onDone = vi.fn(), heroine = createHeroine();
    heroine.play("lightFire", { onHit, onDone });
    for (let i = 0; i < 20; i++) heroine.update(0.1);
    expect(onHit).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(heroine.anim).toBe("sit");
    heroine.update(1);
    expect(onHit).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("finishes the level-up pose after its glow", () => {
    const onDone = vi.fn(), heroine = createHeroine();
    heroine.play("levelUp", { onDone });
    for (let i = 0; i < 16; i++) heroine.update(0.1);
    expect(heroine.anim).toBe("idle");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("transitions sitDown to sit and calls onDone once", () => {
    const onDone = vi.fn(), heroine = createHeroine();
    heroine.play("sitDown", { onDone });
    for (let i = 0; i < 10; i++) heroine.update(0.1);
    expect(heroine.anim).toBe("sit");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("gives the three attacks distinct contact silhouettes", () => {
    const pixels = ["attack1", "attack2", "attack3"].map((name) => {
      const heroine = createHeroine({ x: 120, y: 120 }), frame = createFrame(320, 180);
      heroine.play(name);
      heroine.update(0.4);
      heroine.draw(frame);
      return Array.from(frame.color).join(",");
    });
    expect(new Set(pixels).size).toBe(3);
  });

  it("draws the stump seat and leaves the sword beside a seated heroine", () => {
    const heroine = createHeroine({ x: 120, y: 120 }), frame = createFrame(320, 180);
    heroine.play("sit");
    heroine.draw(frame);
    const pixels = Array.from(frame.color);
    expect(pixels.filter((pixel) => pixel === (hex("#754a35") >>> 0)).length).toBeGreaterThan(0);
    expect(pixels.filter((pixel) => pixel === (hex("#c9d4e0") >>> 0)).length).toBeGreaterThan(0);
  });

  it("keeps the sword grip within one pixel of the hand at every animation sample", () => {
    const durations = { attack1: 0.68, attack2: 0.72, attack3: 0.84, hurt: 0.38, victory: 0.9, sitDown: 0.65, standUp: 0.62, lightFire: 1.25, levelUp: 1.2 };
    for (const name of ANIMS) for (const sample of [0, 0.25, 0.5, 0.75, 1]) {
      const elapsed = (durations[name] ?? 0.34) * sample;
      const pose = heroinePose(name, elapsed);
      const weapon = swordPose(name, sample, pose.hand, pose.seated);
      if (pose.seated) {
        expect(weapon).toBeNull();
        continue;
      }
      expect(Math.hypot(weapon.grip.x - pose.hand.x, weapon.grip.y - pose.hand.y)).toBeLessThanOrEqual(1);
      expect(pose.rows[pose.hand.y][pose.hand.x]).not.toBe(".");
    }
  });

  it("uses four distinct held drawings in the walk cycle", () => {
    const frames = [0, 1, 2, 3].map((step) => heroinePose("walk", step / 12).rows.join(""));
    expect(new Set(frames).size).toBe(4);
  });

  it("updates reach for the longer knight sword", () => {
    expect(createHeroine().reach).toBe(40);
  });
});

// The old row remapping left four transparent rows between head and armour.
describe("heroine silhouette regression", () => {
  it.each(ANIMS)("keeps %s continuous and inside its sprite canvas", (name) => {
    for (let step = 0; step < 16; step++) {
      const duration = ANIM_DURATIONS[name] ?? 0.34;
      const { rows } = heroinePose(name, duration * step / 15);
      const occupied = rows.map((row, y) => row.includes("k") ? y : -1).filter((y) => y >= 0);
      expect(occupied[0]).toBeGreaterThan(0);
      expect(occupied.at(-1)).toBeLessThan(rows.length - 1);
      for (let y = occupied[0]; y <= occupied.at(-1); y++) {
        expect(rows[y]).not.toMatch(/^\.+$/);
        expect(rows[y].slice(14, 28)).not.toMatch(/^\.+$/);
      }
      for (const row of rows) {
        expect(row[0]).toBe(".");
        expect(row.at(-1)).toBe(".");
      }
    }
  });

  it("stands 36 pixels tall with a large blue-eyed face", () => {
    const { rows } = heroinePose("idle");
    const occupied = rows.map((row, y) => row !== ".".repeat(row.length) ? y : -1).filter((y) => y >= 0);
    expect(occupied.at(-1) - occupied[0] + 1).toBe(36);
    expect(rows.join("").split("E").length - 1).toBeGreaterThanOrEqual(4);
  });

  it("keeps the same sword length through combat and celebration", () => {
    for (const name of ["idle", "walk", "attack1", "attack2", "attack3", "hurt", "victory", "levelUp"]) {
      for (const progress of [0, 0.25, 0.5, 0.75]) {
        const { hand } = heroinePose(name, progress * 0.6);
        const { grip, tip } = swordPose(name, progress, hand);
        expect(Math.hypot(tip.x - grip.x, tip.y - grip.y)).toBeGreaterThan(17);
        expect(Math.hypot(tip.x - grip.x, tip.y - grip.y)).toBeLessThan(19);
      }
    }
  });
});
