import { describe, it, expect, afterEach, vi } from "vitest";
import { createTimer } from "../src/timer/timer.js";
import { save, load, clear, STORAGE_KEY } from "../src/timer/persist.js";

const MIN = 60_000;
const CLASSIC = { id: "classic", focus: 25, shortBreak: 5, longBreak: 20, longBreakEvery: 4 };
const DEEP = { id: "deep", focus: 52, shortBreak: 17, longBreak: null, longBreakEvery: null };

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    get size() {
      return map.size;
    },
  };
}

function fakeClock(start = Date.UTC(2026, 0, 5, 9, 0, 0)) {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("persist", () => {
  it("stores a running timer and restores it after a reload", () => {
    const clock = fakeClock();
    vi.stubGlobal("localStorage", memoryStorage());

    const timer = createTimer(CLASSIC, { now: clock.now });
    clock.advance(10 * MIN);
    timer.tick();
    expect(save(timer)).toBe(true);

    const data = load(CLASSIC);
    expect(data).toMatchObject({ preset: "classic", phase: "focus", remainingMs: 15 * MIN });

    clock.advance(3 * MIN);
    const restored = createTimer.restore(CLASSIC, data, { now: clock.now });
    expect(restored.state()).toMatchObject({ phase: "focus", running: true, remainingMs: 12 * MIN });
  });

  it("ignores a session saved for another preset", () => {
    const clock = fakeClock();
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    save(createTimer(CLASSIC, { now: clock.now }));
    expect(load(DEEP)).toBeNull();
    expect(load(CLASSIC)).not.toBeNull();
  });

  it("returns null for missing or corrupt data instead of throwing", () => {
    vi.stubGlobal("localStorage", memoryStorage({ [STORAGE_KEY]: "{not json" }));
    expect(load(CLASSIC)).toBeNull();

    vi.stubGlobal("localStorage", memoryStorage({ [STORAGE_KEY]: "null" }));
    expect(load(CLASSIC)).toBeNull();

    vi.stubGlobal("localStorage", memoryStorage());
    expect(load(CLASSIC)).toBeNull();
  });

  it("survives running in node without any storage", () => {
    expect(() => save(createTimer(CLASSIC, { now: fakeClock().now }))).not.toThrow();
    expect(save(createTimer(CLASSIC, { now: fakeClock().now }))).toBe(false);
    expect(load(CLASSIC)).toBeNull();
    expect(clear()).toBe(false);
  });

  it("survives a storage that throws (private mode, quota)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    });
    expect(load(CLASSIC)).toBeNull();
    expect(save(createTimer(CLASSIC, { now: fakeClock().now }))).toBe(false);
    expect(clear()).toBe(false);
  });

  it("clears the saved session", () => {
    const clock = fakeClock();
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    save(createTimer(CLASSIC, { now: clock.now }));
    expect(storage.size).toBe(1);
    expect(clear()).toBe(true);
    expect(load(CLASSIC)).toBeNull();
  });

  it("refuses a timer without serialize()", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    expect(save({})).toBe(false);
  });
});
