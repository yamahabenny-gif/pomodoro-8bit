import { describe, it, expect } from "vitest";
import { createTimer } from "../src/timer/timer.js";

const MIN = 60_000;

const CLASSIC = { id: "classic", focus: 25, shortBreak: 5, longBreak: 20, longBreakEvery: 4 };
const DEEP = { id: "deep", focus: 52, shortBreak: 17, longBreak: null, longBreakEvery: null };

function fakeClock(start = Date.UTC(2026, 0, 5, 9, 0, 0)) {
  let t = start;
  return {
    now: () => t,
    advance(ms) {
      t += ms;
      return t;
    },
  };
}

/** Subscribe to phase/end in one ordered log, e.g. "end:focus:1", "phase:short:1". */
function log(timer) {
  const seen = [];
  timer.on("end", (e) => seen.push(`end:${e.phase}:${e.cycle}`));
  timer.on("phase", (e) => seen.push(`phase:${e.phase}:${e.cycle}:${e.totalMs}`));
  return seen;
}

describe("timer: phases and cycles", () => {
  it("starts a classic focus right away and reports the full time", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now });
    expect(timer.state()).toEqual({
      phase: "focus",
      running: true,
      remainingMs: 25 * MIN,
      totalMs: 25 * MIN,
      cycle: 1,
      completedFocus: 0,
    });
  });

  it("runs a full classic cycle and puts the long break after the fourth focus", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now });
    const seen = log(timer);

    const steps = [
      [25, "short", 1, 5],
      [5, "focus", 2, 25],
      [25, "short", 2, 5],
      [5, "focus", 3, 25],
      [25, "short", 3, 5],
      [5, "focus", 4, 25],
      [25, "long", 4, 20],
      [20, "focus", 5, 25],
    ];
    for (const [ran, phase, cycle, left] of steps) {
      clock.advance(ran * MIN);
      const s = timer.tick();
      expect({ phase: s.phase, cycle: s.cycle }).toEqual({ phase, cycle });
      expect(s.remainingMs).toBe(left * MIN);
    }

    expect(timer.state().completedFocus).toBe(4);
    expect(seen.filter((e) => e.startsWith("end:"))).toEqual([
      "end:focus:1",
      "end:short:1",
      "end:focus:2",
      "end:short:2",
      "end:focus:3",
      "end:short:3",
      "end:focus:4",
      "end:long:4",
    ]);
    expect(seen.map((e) => e.split(":").slice(0, 3).join(":"))).toEqual([
      "end:focus:1",
      "phase:short:1",
      "end:short:1",
      "phase:focus:2",
      "end:focus:2",
      "phase:short:2",
      "end:short:2",
      "phase:focus:3",
      "end:focus:3",
      "phase:short:3",
      "end:short:3",
      "phase:focus:4",
      "end:focus:4",
      "phase:long:4",
      "end:long:4",
      "phase:focus:5",
    ]);
  });

  it("never takes a long break in a preset without one", () => {
    const clock = fakeClock();
    const timer = createTimer(DEEP, { now: clock.now });
    expect(timer.state().totalMs).toBe(52 * MIN);

    for (let focus = 1; focus <= 5; focus++) {
      clock.advance(52 * MIN);
      let s = timer.tick();
      expect({ phase: s.phase, cycle: s.cycle }).toEqual({ phase: "short", cycle: focus });
      clock.advance(17 * MIN);
      s = timer.tick();
      expect({ phase: s.phase, cycle: s.cycle }).toEqual({ phase: "focus", cycle: focus + 1 });
    }
  });

  it("does not start while autoStart is false", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now, autoStart: false });
    expect(timer.state().running).toBe(false);
    clock.advance(5 * MIN);
    timer.tick();
    expect(timer.state().remainingMs).toBe(25 * MIN);

    timer.start();
    expect(timer.state().running).toBe(true);
    clock.advance(5 * MIN);
    expect(timer.tick().remainingMs).toBe(20 * MIN);
  });
});

describe("timer: controls", () => {
  it("keeps the remaining time while paused, however long the wall clock runs", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now });
    const seen = log(timer);

    clock.advance(10 * MIN);
    timer.tick();
    expect(timer.pause().remainingMs).toBe(15 * MIN);

    clock.advance(3 * 60 * MIN);
    expect(timer.tick().remainingMs).toBe(15 * MIN);
    expect(timer.state().running).toBe(false);
    expect(seen).toEqual([]);

    timer.resume();
    clock.advance(14 * MIN);
    expect(timer.tick().phase).toBe("focus");
    clock.advance(1 * MIN);
    expect(timer.tick().phase).toBe("short");
    expect(seen[0]).toBe("end:focus:1");
  });

  it("skips without an end event and keeps running", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now });
    const seen = log(timer);
    clock.advance(10 * MIN);
    timer.tick();

    const afterSkip = timer.skip();
    expect({ phase: afterSkip.phase, cycle: afterSkip.cycle, running: afterSkip.running }).toEqual({
      phase: "short",
      cycle: 1,
      running: true,
    });
    expect(afterSkip.remainingMs).toBe(5 * MIN);
    expect(seen).toEqual(["phase:short:1:300000"]);

    // the skipped focus was not completed, the following break still runs out normally
    clock.advance(5 * MIN);
    timer.tick();
    expect(timer.state().completedFocus).toBe(0);
    expect(seen).toContain("end:short:1");
    expect(seen.some((e) => e.startsWith("end:focus"))).toBe(false);
  });

  it("skips a paused phase into a paused phase", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now });
    timer.pause();
    const s = timer.skip();
    expect({ phase: s.phase, running: s.running, remainingMs: s.remainingMs }).toEqual({
      phase: "short",
      running: false,
      remainingMs: 5 * MIN,
    });
    clock.advance(99 * MIN);
    timer.tick();
    expect(timer.state().remainingMs).toBe(5 * MIN);
  });

  it("does not count skipped focus phases as completed", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now });
    for (let i = 0; i < 3; i++) {
      timer.skip(); // focus -> short
      timer.skip(); // short -> next focus
    }
    expect(timer.state()).toMatchObject({ phase: "focus", cycle: 4 });
    timer.skip();
    // the fourth focus is followed by the long break even when every focus was skipped
    expect(timer.state()).toMatchObject({ phase: "long", cycle: 4, completedFocus: 0 });
  });

  it("resets to a fresh first focus", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now });
    const seen = log(timer);
    clock.advance(30 * MIN);
    timer.tick();

    const s = timer.reset();
    expect(s).toEqual({
      phase: "focus",
      running: true,
      remainingMs: 25 * MIN,
      totalMs: 25 * MIN,
      cycle: 1,
      completedFocus: 0,
    });
    expect(seen.at(-1)).toBe(`phase:focus:1:${25 * MIN}`);
  });

  it("resets paused when autoStart is false", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now, autoStart: false });
    timer.start();
    clock.advance(5 * MIN);
    timer.tick();
    expect(timer.reset()).toMatchObject({ running: false, remainingMs: 25 * MIN, cycle: 1 });
  });

  it("unsubscribes with the function on() returns", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now });
    let count = 0;
    const off = timer.on("phase", () => count++);
    timer.skip();
    off();
    timer.skip();
    expect(count).toBe(1);
    expect(() => timer.on("tick", () => {})).toThrow(/unknown event/);
  });
});

describe("timer: catch-up after the tab slept", () => {
  it("walks every missed phase in order and lands on the right one", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now });
    const seen = log(timer);
    const changes = [];
    timer.on("change", (s) => changes.push({ phase: s.phase, cycle: s.cycle }));

    clock.advance(40 * MIN); // focus 1 (25) ran out, short 1 (5) ran out, focus 2 is 10 min in
    const s = timer.tick();
    expect({ phase: s.phase, cycle: s.cycle, remainingMs: s.remainingMs }).toEqual({
      phase: "focus",
      cycle: 2,
      remainingMs: 15 * MIN,
    });
    expect(s.completedFocus).toBe(1);
    expect(seen).toEqual([
      "end:focus:1",
      "phase:short:1:300000",
      "end:short:1",
      "phase:focus:2:1500000",
    ]);
    expect(changes).toEqual([{ phase: "focus", cycle: 2 }]);
  });

  it("crosses the long break when the sleep spans the fourth focus", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now });
    clock.advance(3 * (25 + 5) * MIN); // three focus breaks done, the fourth focus begins
    timer.tick();
    clock.advance(10 * (25 + 20) * MIN);
    // t = 540: the long break after focus 16 just ended, focus 17 begins
    const s = timer.tick();
    expect(s.phase).toBe("focus");
    expect(s.cycle).toBe(17);
    expect(s.completedFocus).toBe(16);
  });

  it("is not fooled by a running countdown when nothing has expired", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now });
    clock.advance(1 * MIN);
    expect(timer.tick().remainingMs).toBe(24 * MIN);
  });
});

describe("timer: speed debug multiplier", () => {
  it("makes a minute a second but still reports the preset time", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now, speed: 60 });
    expect(timer.state().remainingMs).toBe(25 * MIN);

    clock.advance(12_500);
    expect(timer.tick().remainingMs).toBe(Math.round(12.5 * MIN));

    clock.advance(12_500);
    const s = timer.tick();
    expect({ phase: s.phase, cycle: s.cycle, remainingMs: s.remainingMs }).toEqual({
      phase: "short",
      cycle: 1,
      remainingMs: 5 * MIN,
    });
  });

  it("ignores a nonsense speed", () => {
    const clock = fakeClock();
    for (const speed of [0, -5, "fast", NaN, undefined]) {
      const timer = createTimer(CLASSIC, { now: clock.now, speed });
      clock.advance(1 * MIN);
      expect(timer.tick().remainingMs).toBe(24 * MIN);
    }
  });
});

describe("timer: serialize and restore", () => {
  it("round-trips a paused timer without spending its time", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now });
    clock.advance(10 * MIN);
    timer.tick();
    timer.pause();

    const data = timer.serialize();
    expect(data).toMatchObject({ v: 1, preset: "classic", phase: "focus", cycle: 1, running: false });
    expect(data.remainingMs).toBe(15 * MIN);

    clock.advance(60 * MIN); // reload an hour later
    const restored = createTimer.restore(CLASSIC, data, { now: clock.now });
    expect(restored.state()).toMatchObject({
      phase: "focus",
      cycle: 1,
      running: false,
      remainingMs: 15 * MIN,
    });
  });

  it("keeps a running timer running and subtracts the time the page was gone", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now });
    clock.advance(10 * MIN);
    timer.tick();
    const data = timer.serialize();

    clock.advance(2 * MIN);
    const restored = createTimer.restore(CLASSIC, data, { now: clock.now });
    expect(restored.state()).toMatchObject({ phase: "focus", running: true, remainingMs: 13 * MIN });
  });

  it("catches up phases that expired while the page was closed", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now });
    clock.advance(10 * MIN);
    timer.tick();
    const data = timer.serialize(); // 15 min of focus 1 left

    clock.advance(60 * MIN);
    const restored = createTimer.restore(CLASSIC, data, { now: clock.now });
    expect(restored.state()).toEqual({
      phase: "focus",
      cycle: 3,
      running: true,
      remainingMs: 15 * MIN,
      totalMs: 25 * MIN,
      completedFocus: 2,
    });
  });

  it("moves on when the saved phase ended exactly at reload", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now });
    clock.advance(10 * MIN);
    timer.tick();
    const data = timer.serialize();

    clock.advance(15 * MIN);
    const restored = createTimer.restore(CLASSIC, data, { now: clock.now });
    expect(restored.state()).toMatchObject({ phase: "short", cycle: 1, running: true, remainingMs: 5 * MIN });
  });

  it("stays put for a paused timer even when the wall clock moved a lot", () => {
    const clock = fakeClock();
    const timer = createTimer(CLASSIC, { now: clock.now });
    clock.advance(4 * MIN);
    timer.pause();
    const data = timer.serialize();
    clock.advance(24 * 60 * MIN);
    expect(createTimer.restore(CLASSIC, data, { now: clock.now }).state().remainingMs).toBe(21 * MIN);
  });

  it("falls back to a fresh timer for unusable data", () => {
    const clock = fakeClock();
    for (const data of [null, undefined, {}, { phase: "nap" }, { phase: "focus", cycle: -2 }]) {
      const t = createTimer.restore(CLASSIC, data, { now: clock.now });
      expect(t.state()).toMatchObject({ phase: "focus", cycle: 1, running: true, remainingMs: 25 * MIN });
    }
  });

  it("keeps the saved run's speed when the page reopens without the debug flag", () => {
    const clock = fakeClock();
    const fast = createTimer(CLASSIC, { now: clock.now, speed: 60 });
    clock.advance(5_000);
    fast.tick();
    const data = fast.serialize(); // 20 min logical left, saved with speed 60
    expect(data.speed).toBe(60);

    clock.advance(30_000); // 30 s = 30 logical minutes at the saved speed
    const restored = createTimer.restore(CLASSIC, data, { now: clock.now, speed: 1 });
    expect(restored.state()).toMatchObject({ phase: "focus", cycle: 2, running: true, remainingMs: 20 * MIN });
  });

  it("keeps a restored paused timer at the preset duration if the data claims more", () => {
    const clock = fakeClock();
    const data = { v: 1, preset: "classic", phase: "short", cycle: 2, completedFocus: 1, running: false, remainingMs: 99 * MIN };
    const t = createTimer.restore(CLASSIC, data, { now: clock.now });
    expect(t.state()).toMatchObject({ phase: "short", cycle: 2, completedFocus: 1, remainingMs: 5 * MIN });
  });
});
