import { describe, expect, it } from "vitest";
import { createProgress, xpForLevel } from "../src/game/progress/progress.js";

const MINUTE = 60_000;

/** In-memory localStorage stand-in, so the store never touches the test runner globals. */
function memoryStorage() {
  const map = new Map();
  return {
    map,
    writes: 0,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem(key, value) {
      this.writes += 1;
      map.set(key, String(value));
    },
    removeItem: (key) => map.delete(key),
  };
}

const focus = (minutesLeft, running = true) => ({
  phase: "focus",
  running,
  remainingMs: minutesLeft * MINUTE,
  totalMs: 25 * MINUTE,
});
const phase = (name, minutesLeft, running = true) => ({
  phase: name,
  running,
  remainingMs: minutesLeft * MINUTE,
  totalMs: 5 * MINUTE,
});

describe("xpForLevel", () => {
  it("asks for 15, 20, 25 ... focus minutes", () => {
    expect(xpForLevel(1)).toBe(15);
    expect(xpForLevel(2)).toBe(20);
    expect(xpForLevel(3)).toBe(25);
    expect(xpForLevel(10)).toBe(60);
  });

  it("never asks for less than a level 1", () => {
    expect(xpForLevel(0)).toBe(15);
    expect(xpForLevel(-3)).toBe(15);
  });
});

describe("createProgress", () => {
  it("starts at level 1 with an empty bar", () => {
    const progress = createProgress({ storage: null });
    expect(progress.state()).toEqual({ level: 1, xp: 0, need: 15, ratio: 0, totalMinutes: 0 });
  });

  it("fills the bar with the focus minutes that pass", () => {
    const progress = createProgress({ storage: null });
    progress.sync(focus(25));
    progress.sync(focus(18)); // 7 minutes of focus
    expect(progress.state()).toMatchObject({ level: 1, xp: 7, need: 15, totalMinutes: 7 });
    expect(progress.state().ratio).toBeCloseTo(7 / 15, 6);
  });

  it("reaches level 2 after 15 minutes, then needs 20 more", () => {
    const progress = createProgress({ storage: null });
    progress.sync(focus(25));
    expect(progress.sync(focus(10))).toEqual([2]); // exactly 15 minutes
    expect(progress.state()).toMatchObject({ level: 2, xp: 0, need: 20 });
    progress.sync(focus(0)); // 10 more minutes
    expect(progress.state()).toMatchObject({ level: 2, xp: 10, need: 20, totalMinutes: 25 });
    expect(progress.state().ratio).toBeCloseTo(0.5, 6);
  });

  it("counts nothing on the first sync, after a break, or while paused", () => {
    const progress = createProgress({ storage: null });
    expect(progress.sync(focus(25))).toEqual([]);
    expect(progress.state().xp).toBe(0);

    // paused: the remaining time does not move on its own, and a jump in it is not work either
    progress.sync(focus(20, false));
    progress.sync(focus(12, false));
    expect(progress.state().xp).toBe(0);

    // break, then the next focus starts from the top: the jump to 25 minutes gives nothing
    progress.sync(phase("short", 5));
    progress.sync(phase("short", 1));
    expect(progress.state().xp).toBe(0);
    progress.sync(focus(25));
    expect(progress.state().xp).toBe(0);

    // a resume only starts counting from the next frame on
    progress.sync(focus(24));
    expect(progress.state().xp).toBeCloseTo(1, 6);
  });

  it("never counts the rest of a focus phase that was skipped", () => {
    const progress = createProgress({ storage: null });
    progress.sync(focus(25));
    progress.sync(focus(20)); // 5 minutes done
    progress.sync(phase("short", 5)); // skip: focus 20 min left, break begins
    expect(progress.state().xp).toBeCloseTo(5, 6);
    expect(progress.state().totalMinutes).toBeCloseTo(5, 6);
  });

  it("fires every level of a long jump in order", () => {
    const progress = createProgress({ storage: null });
    const gained = [];
    const off = progress.on("levelup", ({ level }) => gained.push(level));
    progress.sync({ ...focus(60), totalMs: 60 * MINUTE });
    // 60 minutes in one step: 15 -> L2, 20 -> L3, 25 -> L4, nothing left over
    expect(progress.sync({ ...focus(0), totalMs: 60 * MINUTE })).toEqual([2, 3, 4]);
    expect(gained).toEqual([2, 3, 4]);
    expect(progress.state()).toMatchObject({ level: 4, xp: 0, need: 30, totalMinutes: 60 });
    off();
    progress.sync({ ...focus(0), totalMs: 60 * MINUTE });
    expect(gained).toEqual([2, 3, 4]);
  });

  it("carries leftover minutes into the next level", () => {
    const progress = createProgress({ storage: null });
    progress.sync(focus(25));
    expect(progress.sync(focus(0))).toEqual([2]);
    const state = progress.state();
    expect(state.level).toBe(2);
    expect(state.xp).toBeCloseTo(10, 6);
    expect(state.totalMinutes).toBeCloseTo(25, 6);
  });

  it("persists after a level-up and otherwise at most every 5 s", () => {
    let clock = 0;
    const storage = memoryStorage();
    const progress = createProgress({ storage, now: () => clock });
    progress.sync(focus(25));
    progress.sync(focus(21)); // 4 minutes, no save yet
    expect(storage.writes).toBe(0);
    clock = 4_000;
    progress.sync(focus(18)); // 3 minutes, still under the 5 s mark since creation
    expect(storage.writes).toBe(0);
    clock = 5_000;
    progress.sync(focus(17));
    expect(storage.writes).toBe(1);
    progress.sync(focus(10)); // crosses level 2 after 15 minutes
    expect(storage.writes).toBe(2);
  });

  it("survives a reload with the same store", () => {
    const storage = memoryStorage();
    const first = createProgress({ storage });
    first.sync(focus(25));
    first.sync(focus(8)); // 17 minutes -> level 2, 2/20
    const before = first.state();

    const second = createProgress({ storage });
    expect(second.state()).toEqual(before);
    // the first sync after a reload only takes a bearing
    second.sync(focus(20));
    expect(second.state()).toEqual(before);
    second.sync(focus(19));
    expect(second.state().xp).toBeCloseTo(before.xp + 1, 6);
  });

  it("ignores a broken store instead of throwing", () => {
    const throwing = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    };
    const progress = createProgress({ storage: throwing });
    expect(progress.state().level).toBe(1);
    progress.sync(focus(25));
    progress.sync(focus(0));
    expect(progress.state().level).toBe(2);

    const garbage = memoryStorage();
    garbage.setItem("k", "{not json");
    expect(createProgress({ storage: garbage, key: "k" }).state().level).toBe(1);
  });

  it("settles stored XP that already covers more than one level", () => {
    const storage = memoryStorage();
    storage.setItem(
      "pomodoro8bit.progress.v1",
      JSON.stringify({ v: 1, level: 1, xp: 40, totalMinutes: 40 }),
    );
    const progress = createProgress({ storage });
    expect(progress.state()).toMatchObject({ level: 3, xp: 5, need: 25, totalMinutes: 40 });
  });

  it("resets back to level 1 and forgets the stored value", () => {
    const storage = memoryStorage();
    const progress = createProgress({ storage });
    progress.sync(focus(25));
    progress.sync(focus(0));
    expect(progress.state().level).toBe(2);
    const state = progress.reset();
    expect(state).toEqual({ level: 1, xp: 0, need: 15, ratio: 0, totalMinutes: 0 });
    expect(createProgress({ storage }).state().level).toBe(1);
  });

  it("rejects unknown events", () => {
    const progress = createProgress({ storage: null });
    expect(() => progress.on("levelup!", () => {})).toThrow(/unknown event/);
    expect(() => progress.on("levelup", null)).toThrow(/listener/);
  });

  it("ignores rubbish timer states", () => {
    const progress = createProgress({ storage: null });
    expect(progress.sync(null)).toEqual([]);
    expect(progress.sync({ phase: "focus", running: true })).toEqual([]);
    expect(progress.state().level).toBe(1);
  });
});
