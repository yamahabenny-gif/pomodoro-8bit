import { describe, it, expect } from "vitest";
import { createHeroine } from "../src/game/heroine/heroine.js";
import { createDirector } from "../src/game/director/director.js";

function makeHarness(phase = "focus") {
  const listeners = new Map([["phase", new Set()], ["end", new Set()]]);
  const state = { phase, running: true, remainingMs: 60_000, totalMs: 60_000, cycle: 1, completedFocus: 0 };
  const timer = {
    state: () => ({ ...state }),
    on(event, fn) {
      listeners.get(event)?.add(fn);
      return () => listeners.get(event)?.delete(fn);
    },
    changePhase(next) {
      state.phase = next;
      state.totalMs = next === "long" ? 1_200_000 : next === "short" ? 300_000 : 1_500_000;
      state.remainingMs = state.totalMs;
      for (const fn of listeners.get("phase")) fn({ phase: next, cycle: 1, totalMs: state.totalMs });
    },
  };
  const forest = {
    mode: "fight", campfireX: 228, scrollDistance: 0,
    setMode(mode) { this.mode = mode; }, scroll(px) { this.scrollDistance += px; }, update() {},
    drawBack() {}, drawFront() {},
  };
  const heroine = createHeroine({ x: 112, y: 150 });
  const sounds = [];
  const sfx = { play: (name) => sounds.push(name), ambience() {}, notify: (...args) => sounds.push(args) };
  const director = createDirector({ stage: { frame: {} }, forest, heroine, timer, sfx });
  return { director, timer, state, forest, heroine, sounds };
}

describe("director", () => {
  it("starts in the matching forest mode and puts a break heroine beside the fire", () => {
    const { forest, heroine } = makeHarness("long");
    expect(forest.mode).toBe("night");
    expect(heroine.x).toBe(198);
    expect(heroine.y).toBe(150);
    expect(heroine.anim).toBe("sit");
  });

  it("moves to camp and night on timer phase events", () => {
    const { director, timer, forest, heroine, sounds } = makeHarness();
    timer.changePhase("short");
    expect(forest.mode).toBe("camp");
    for (let i = 0; i < 40; i++) director.update(0.1);
    expect(heroine.x).toBe(198);
    expect(heroine.anim).toBe("sit");
    expect(sounds).toContain("phaseBreak");
    timer.changePhase("long");
    expect(forest.mode).toBe("night");
  });

  it("paces encounters from logical timer time and cycles through every enemy kind", () => {
    const { director, state, sounds } = makeHarness();
    state.totalMs = 900_000;
    state.remainingMs = 900_000;
    for (let i = 0; i < 700; i++) {
      state.remainingMs = Math.max(0, state.remainingMs - 6_000); // ?speed=60 at 10 fps
      director.update(0.1);
    }
    const { kills } = director.stats();
    expect(kills.gnome).toBeGreaterThan(0);
    expect(kills.orc, JSON.stringify({ kills, sounds: sounds.slice(-30) })).toBeGreaterThan(0);
    expect(kills.ogre).toBeGreaterThan(0);
  });
});
