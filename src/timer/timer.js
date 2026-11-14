// CONTRACT (owned by issue "Timer-Kern"). Pure logic, no DOM, no rendering: testable in node.
//
// Phases: "focus" | "short" | "long". A session runs focus -> short -> focus -> ... and every
// preset.longBreakEvery-th focus is followed by "long" (if the preset has one).
// Time is wall-clock based (endsAt timestamps), never accumulated from frame deltas, so throttled
// background tabs and sleep stay correct.
//
// createTimer(preset, { now = Date.now, autoStart = true, speed = 1 }) returns:
//   state(): { phase, running, remainingMs, totalMs, cycle (1-based focus count), completedFocus }
//   start(), pause(), resume(), skip(), reset()
//   tick(): call often (each frame or on an interval); fires events when a phase ends
//   on(event, fn) -> off; events:
//     "phase"   ({ phase, cycle, totalMs })  a phase began
//     "end"     ({ phase, cycle })           a phase finished on time (not on skip)
//     "change"  (state)                      anything changed (start/pause/resume/skip/reset/phase)
//   serialize() / static restore(preset, data, opts): survive reloads via localStorage
// speed: debug multiplier (?speed=60 makes a minute a second).
//
// Details callers may rely on:
// - cycle counts focus periods 1-based. During a break it is the focus the break belongs to, so the
//   HUD can say "cycle 3, rest". A break is "long" iff the focus it follows is a multiple of
//   longBreakEvery and the preset has a long break.
// - completedFocus counts focus phases that ran out on time; skipped focus phases are not completed.
// - remainingMs/totalMs are logical (preset) milliseconds, not wall-clock: at speed 60 a 25 min focus
//   lasts 25 s and still reports 25 min left at the start.
// - skip() fires "phase" and "change" but never "end", and keeps the running/paused state.
// - reset() starts over at focus 1 (running when autoStart), fires "phase" and "change".
// - "phase" fires on every transition and on reset, never on start/resume of the current phase.
// - restore() catches up silently (no events) so a reload lands on the right phase immediately.
// - a tick that catches up several phases fires each "end" and "phase" in order, but only one "change"
//   at the end: listeners only need the state the tab lands on.
// - on() throws for an unknown event name, to catch typos early.

const MINUTE = 60_000;
const PHASES = ["focus", "short", "long"];
const EVENTS = ["phase", "end", "change"];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// one phase in logical ms; presets are in minutes. A floor of 1 ms keeps a zero duration from spinning.
const toMs = (minutes) => Math.max(1, Math.round((Number(minutes) || 0) * MINUTE));

function durationOf(preset, phase) {
  if (phase === "short") return toMs(preset?.shortBreak);
  if (phase === "long") return toMs(preset?.longBreak);
  return toMs(preset?.focus);
}

/** The break that follows a focus: "long" on every longBreakEvery-th one, if the preset has one. */
function breakAfter(preset, cycle) {
  const every = Number(preset?.longBreakEvery);
  const hasLong = Number(preset?.longBreak) > 0;
  return hasLong && Number.isFinite(every) && every > 0 && cycle % every === 0 ? "long" : "short";
}

/** The next phase. Breaks stay in the cycle of the focus they follow; the next focus increments it. */
function nextPhase(preset, phase, cycle) {
  if (phase === "focus") return { phase: breakAfter(preset, cycle), cycle };
  return { phase: "focus", cycle: cycle + 1 };
}

export function createTimer(preset, opts = {}) {
  const now = typeof opts.now === "function" ? opts.now : Date.now;
  const rawSpeed = Number(opts.speed);
  const speed = Number.isFinite(rawSpeed) && rawSpeed > 0 ? rawSpeed : 1;
  const autoStart = opts.autoStart !== false;

  const listeners = new Map(EVENTS.map((event) => [event, new Set()]));

  let phase = "focus";
  let cycle = 1;
  let completedFocus = 0;
  let running = false;
  let endsAt = 0; // wall-clock timestamp of the phase end, only while running
  let pausedRemaining = durationOf(preset, "focus"); // logical ms, only while paused

  const total = () => durationOf(preset, phase);
  const remainingAt = (at) => (running ? Math.max(0, (endsAt - at) * speed) : Math.max(0, pausedRemaining));

  function snapshot(at = now()) {
    return {
      phase,
      running,
      remainingMs: remainingAt(at),
      totalMs: total(),
      cycle,
      completedFocus,
    };
  }

  function emit(event, payload) {
    // copy: a listener may unsubscribe itself while we iterate
    for (const fn of [...listeners.get(event)]) fn(payload);
  }

  function startClock(at) {
    running = true;
    endsAt = at + pausedRemaining / speed;
  }

  /** Complete every phase whose end lies at or before `at`, chaining on the exact boundaries. */
  function advance(at) {
    if (!running) return;
    let moved = false;
    let transitions = 0;
    while (endsAt <= at) {
      const ended = phase;
      const endedCycle = cycle;
      const boundary = endsAt;
      if (ended === "focus") completedFocus += 1;
      const next = nextPhase(preset, ended, endedCycle);
      emit("end", { phase: ended, cycle: endedCycle });
      phase = next.phase;
      cycle = next.cycle;
      endsAt = boundary + total() / speed;
      emit("phase", { phase, cycle, totalMs: total() });
      moved = true;
      // a degenerate preset (sub-millisecond phases) must not lock the tab up
      if (++transitions >= 10_000) {
        endsAt = at;
        break;
      }
    }
    if (moved) emit("change", snapshot(at));
  }

  function start() {
    if (running) return snapshot();
    pausedRemaining = clamp(pausedRemaining, 0, total());
    startClock(now());
    emit("change", snapshot());
    return snapshot();
  }

  function pause() {
    if (!running) return snapshot();
    const at = now();
    advance(at);
    pausedRemaining = remainingAt(at);
    running = false;
    endsAt = 0;
    emit("change", snapshot(at));
    return snapshot(at);
  }

  function resume() {
    if (running) return snapshot();
    pausedRemaining = clamp(pausedRemaining, 0, total());
    startClock(now());
    emit("change", snapshot());
    return snapshot();
  }

  function skip() {
    const at = now();
    // time that already ran out must fire its "end" events before the skip takes over
    advance(at);
    const next = nextPhase(preset, phase, cycle);
    phase = next.phase;
    cycle = next.cycle;
    const duration = total();
    if (running) endsAt = at + duration / speed;
    else pausedRemaining = duration;
    emit("phase", { phase, cycle, totalMs: duration });
    emit("change", snapshot(at));
    return snapshot(at);
  }

  function reset() {
    const at = now();
    phase = "focus";
    cycle = 1;
    completedFocus = 0;
    pausedRemaining = durationOf(preset, "focus");
    running = false;
    endsAt = 0;
    if (autoStart) startClock(at);
    emit("phase", { phase, cycle, totalMs: total() });
    emit("change", snapshot(at));
    return snapshot(at);
  }

  function tick() {
    advance(now());
    return snapshot();
  }

  function on(event, fn) {
    const set = listeners.get(event);
    if (!set) throw new Error(`createTimer: unknown event "${event}"`);
    if (typeof fn !== "function") throw new TypeError("createTimer: listener must be a function");
    set.add(fn);
    return () => set.delete(fn);
  }

  function serialize() {
    const at = now();
    return {
      v: 1,
      preset: preset?.id ?? null,
      phase,
      cycle,
      completedFocus,
      running,
      remainingMs: Math.round(remainingAt(at)),
      speed,
      savedAt: at,
    };
  }

  /** Take over saved data. Returns false (and leaves the fresh state alone) for anything unusable. */
  function hydrate(data, at) {
    if (!data || typeof data !== "object" || !PHASES.includes(data.phase)) return false;
    if (data.remainingMs == null || !Number.isFinite(Number(data.remainingMs))) return false;
    const savedCycle = Number.isInteger(data.cycle) && data.cycle >= 1 ? data.cycle : 1;
    const savedDone = Number.isInteger(data.completedFocus) && data.completedFocus >= 0 ? data.completedFocus : 0;
    let left = clamp(Number(data.remainingMs), 0, durationOf(preset, data.phase));
    let p = data.phase;
    let c = savedCycle;
    let done = savedDone;

    // A running timer kept counting while the page was gone; walk the phases it lived through.
    const wasRunning =
      data.running === true && data.savedAt != null && Number.isFinite(Number(data.savedAt));
    if (wasRunning) {
      // the elapsed wall time counts in the logical time of the run it was saved from, so reopening
      // without ?speed=60 (or with another speed) still adds up
      const savedSpeed = Number.isFinite(Number(data.speed)) && Number(data.speed) > 0 ? Number(data.speed) : speed;
      left -= Math.max(0, (at - Number(data.savedAt)) * savedSpeed);
      let transitions = 0;
      while (left <= 0 && transitions++ < 10_000) {
        if (p === "focus") done += 1;
        const next = nextPhase(preset, p, c);
        p = next.phase;
        c = next.cycle;
        left += durationOf(preset, p);
      }
      if (left <= 0) left = 1;
    }

    phase = p;
    cycle = c;
    completedFocus = done;
    if (wasRunning) {
      pausedRemaining = 0;
      running = true;
      endsAt = at + left / speed;
    } else {
      running = false;
      endsAt = 0;
      pausedRemaining = clamp(left, 0, durationOf(preset, phase));
    }
    return true;
  }

  if (!hydrate(opts.restore, now()) && autoStart) {
    pausedRemaining = durationOf(preset, "focus");
    startClock(now());
  }

  return { state: () => snapshot(), start, pause, resume, skip, reset, tick, on, serialize };
}

/** Rebuild a timer from serialize() data, catching up on phases that expired while the page was closed. */
createTimer.restore = (preset, data, opts = {}) => createTimer(preset, { ...opts, restore: data });
