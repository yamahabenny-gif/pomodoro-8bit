import { describe, expect, it, vi } from "vitest";
import { createFrame } from "pixelfx/core/index.js";
import { createHeroine } from "../src/game/heroine/heroine.js";

const ANIMS = ["idle", "walk", "attack1", "attack2", "attack3", "hurt", "victory", "sitDown", "sit", "standUp"];

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

  it("transitions sitDown to sit and calls onDone once", () => {
    const onDone = vi.fn(), heroine = createHeroine();
    heroine.play("sitDown", { onDone });
    for (let i = 0; i < 10; i++) heroine.update(0.1);
    expect(heroine.anim).toBe("sit");
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
