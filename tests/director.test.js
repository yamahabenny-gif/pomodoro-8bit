import { describe, it, expect } from "vitest";
import { createHeroine } from "../src/game/heroine/heroine.js";
import { createDirector } from "../src/game/director/director.js";
import { loadSavedSession } from "../src/game/director/session.js";
import { PRESETS } from "../src/config/presets.js";
import { createTimer } from "../src/timer/timer.js";
import { clear, load, STORAGE_KEY } from "../src/timer/persist.js";

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

  it("notifies when either break ends and focus resumes", () => {
    const { timer, sounds } = makeHarness();
    timer.changePhase("short");
    timer.changePhase("focus");
    timer.changePhase("long");
    timer.changePhase("focus");

    const notices = sounds.filter(Array.isArray);
    expect(notices).toEqual([
      ["Kampf vorbei", "Kurze Rast: 5 Minuten."],
      ["Pause vorbei", "Kampf: 25 Minuten."],
      ["Kampf vorbei", "Lange Rast: 20 Minuten."],
      ["Pause vorbei", "Kampf: 25 Minuten."],
    ]);
    expect(sounds.filter((name) => name === "phaseFocus")).toHaveLength(2);
  });

  it("resolves a saved preset and restores a break scene on boot", () => {
    const values = new Map();
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key),
      },
    });

    try {
      const data = {
        v: 1, preset: "classic", phase: "short", cycle: 2, completedFocus: 1,
        running: true, remainingMs: 180_000, speed: 1, savedAt: Date.now(),
      };
      values.set(STORAGE_KEY, JSON.stringify(data));
      const calls = [];
      const saved = loadSavedSession(PRESETS, (preset) => {
        calls.push(preset);
        return load(preset);
      });

      expect(calls).toEqual([undefined, PRESETS[0]]);
      expect(saved).toEqual({ preset: PRESETS[0], data });
      const timer = createTimer.restore(saved.preset, saved.data, { now: () => data.savedAt });
      const forest = {
        mode: "fight", campfireX: 228,
        setMode(mode) { this.mode = mode; }, scroll() {}, update() {}, drawBack() {}, drawFront() {},
      };
      const heroine = createHeroine();
      createDirector({ stage: { frame: {} }, forest, heroine, timer, sfx: null });
      expect(timer.state().phase).toBe("short");
      expect(forest.mode).toBe("camp");
      expect(heroine.anim).toBe("sit");
      expect(heroine.x).toBe(198);
      clear();
      expect(loadSavedSession(PRESETS, load)).toBeNull();
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else delete globalThis.localStorage;
    }
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
