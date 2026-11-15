// CONTRACT (owned by issue "Level-Up"). Experience timed to focus minutes: the bar fills while you focus, a level
// is reached after a set number of focus minutes, and the next level takes a little longer. Pure logic, no DOM.
//
// XP = focus minutes (fractional; breaks and paused time give nothing). Level L -> L+1 needs xpForLevel(L) minutes:
//   xpForLevel(L) = 15 + 5 * (L - 1)   (15, 20, 25, ... minutes), exported.
// createProgress({ storage = localStorage-or-null, key = "pomodoro8bit.progress.v1" }) returns:
//   state(): { level, xp (minutes into this level), need (xpForLevel(level)), ratio 0..1, totalMinutes }
//   sync(timerState)             call every frame with timer.state(); adds the focus time that passed since the
//                                last call (only while phase === "focus" and running). A manual skip still counts
//                                nothing of the skipped remainder, but a focus phase that ran out while the tab was
//                                in the background is credited in full: if completedFocus grew between two samples
//                                the phase ended on time, and without that counter a switch focus -> break is read
//                                as a normal end. Returns the levels gained this call ([] usually).
//   on("levelup", fn) -> off     fn({ level }) once per level gained, in order
//   reset()                      back to level 1 (for tests/debug only, the UI does not offer it)
// Persists after every level-up and at most every 5 s of progress (storage errors are swallowed).
//
// Notes for callers:
// - Time is read from the timer's own remainingMs, never from the wall clock, so ?speed=60 fills the bar exactly
//   as fast as the clock runs and a paused timer gives nothing.
// - After a reload (or a long background gap) the first sync only takes a bearing; the next sync sees the jump and
//   emits every level it crossed, in order.
// - Background tabs stop requestAnimationFrame, so one sync can span a finished focus phase (or several phases).
//   completedFocus tells an on-time end apart from a skip; without it the state is assumed to have run out.
// - opts.now (default Date.now) only paces the persistence, it does not add XP.

const DEFAULT_KEY = "pomodoro8bit.progress.v1";
const MINUTE_MS = 60_000;
const SAVE_EVERY_MS = 5_000;
const EPSILON = 1e-9;

/** Minutes of focus needed to go from `level` to `level + 1`. */
export const xpForLevel = (level) => 15 + 5 * (Math.max(1, level) - 1);

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // A blocked store throws on access, not only on read.
    return null;
  }
}

const finite = (value) => Number.isFinite(Number(value));
const nonNegative = (value) => (finite(value) ? Math.max(0, Number(value)) : 0);

export function createProgress(opts = {}) {
  const key = typeof opts.key === "string" && opts.key ? opts.key : DEFAULT_KEY;
  const now = typeof opts.now === "function" ? opts.now : Date.now;
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;

  const listeners = new Set();

  let level = 1;
  let xp = 0; // minutes into the current level
  let totalMinutes = 0;
  let lastSample = null; // { remainingMs, phase, running, completedFocus, totalMs }
  let focusMs = 0; // duration of the last focus phase seen, for phases that both start and end between samples
  let lastSaveAt = 0;
  let dirty = false;

  function read() {
    try {
      const raw = storage?.getItem?.(key);
      const data = raw ? JSON.parse(raw) : null;
      if (!data || typeof data !== "object") return;
      const savedLevel = Number(data.level);
      const savedXp = Number(data.xp);
      const savedTotal = Number(data.totalMinutes);
      level = Number.isInteger(savedLevel) && savedLevel >= 1 ? savedLevel : 1;
      xp = nonNegative(savedXp);
      totalMinutes = Math.max(nonNegative(savedTotal), xp);
      // A store from an older version could hold more XP than this level allows: settle it quietly.
      while (xp >= xpForLevel(level) - EPSILON) {
        xp -= xpForLevel(level);
        level += 1;
      }
    } catch {
      // Garbage in the store just means a fresh level 1.
    }
  }

  function persist() {
    try {
      storage?.setItem?.(
        key,
        JSON.stringify({ v: 1, level, xp, totalMinutes, savedAt: now() }),
      );
    } catch {
      // A blocked or full store must not affect the timer.
    }
    lastSaveAt = now();
    dirty = false;
  }

  function state() {
    const need = xpForLevel(level);
    const ratio = need > 0 ? Math.min(1, Math.max(0, xp / need)) : 0;
    return { level, xp, need, ratio, totalMinutes };
  }

  function emit(payload) {
    for (const fn of [...listeners]) fn(payload);
  }

  function grant(minutes) {
    if (!(minutes > 0)) return [];
    totalMinutes += minutes;
    xp += minutes;
    const gained = [];
    let need = xpForLevel(level);
    while (xp >= need - EPSILON) {
      xp = Math.max(0, xp - need);
      level += 1;
      gained.push(level);
      need = xpForLevel(level);
    }
    dirty = true;
    return gained;
  }

  function sync(timerState) {
    const sample = timerState && typeof timerState === "object" ? timerState : null;
    if (!sample || !finite(sample.remainingMs)) {
      lastSample = null;
      return [];
    }
    const current = {
      remainingMs: Math.max(0, Number(sample.remainingMs)),
      phase: sample.phase ?? "focus",
      running: Boolean(sample.running),
      completedFocus: finite(sample.completedFocus) ? Number(sample.completedFocus) : null,
      totalMs: finite(sample.totalMs) && Number(sample.totalMs) > 0 ? Number(sample.totalMs) : null,
    };
    const previous = lastSample;
    lastSample = current;
    if (current.phase === "focus" && current.totalMs) focusMs = current.totalMs;
    if (!previous) return [];

    const gained = grant(focusMinutesBetween(previous, current));
    if (!gained.length) {
      if (dirty && now() - lastSaveAt >= SAVE_EVERY_MS) persist();
      return gained;
    }
    persist();
    for (const reached of gained) emit({ level: reached });
    return gained;
  }

  /**
   * Focus minutes between two samples. While the same focus runs this is just the drop of remainingMs; a phase
   * change in between (background tab, requestAnimationFrame stopped) is settled with the focus time that was
   * still on the clock, provided the focus ended on time.
   */
  function focusMinutesBetween(previous, current) {
    // Paused time, and a resumed run whose first frame still carries the paused sample, give nothing.
    if (!previous.running || !current.running) return 0;

    const ended = focusPhasesEnded(previous, current);
    if (previous.phase === "focus" && current.phase === "focus" && ended === 0) {
      return Math.max(0, (previous.remainingMs - current.remainingMs) / MINUTE_MS);
    }

    let workedMs = 0;
    if (previous.phase === "focus") {
      // A skip reports the same phase switch without growing completedFocus, so `ended` stays 0 and the
      // skipped remainder counts nothing.
      if (ended === 0) return 0;
      // The focus we sat in ran out: credit what was left of it, plus every further focus phase that ended.
      workedMs = previous.remainingMs + (ended - 1) * focusMs;
    } else {
      // We came back from a break: any focus phase that already ended while we were away is complete work.
      workedMs = ended * focusMs;
    }
    if (current.phase === "focus") workedMs += elapsedFocusMs(current);
    return Math.max(0, workedMs / MINUTE_MS);
  }

  /**
   * How many focus phases ran out between two samples. completedFocus is the timer's own count and settles it;
   * a state without that counter is assumed to have ended the phase normally (a skip can only happen on screen,
   * where the frames do run, so the counter is there whenever a skip is possible).
   */
  function focusPhasesEnded(previous, current) {
    if (previous.completedFocus !== null && current.completedFocus !== null) {
      return Math.max(0, current.completedFocus - previous.completedFocus);
    }
    return previous.phase === "focus" && current.phase !== "focus" ? 1 : 0;
  }

  /** Focus time already run inside `sample`'s focus phase, in ms. */
  function elapsedFocusMs(sample) {
    if (sample.phase !== "focus" || !sample.totalMs) return 0;
    return Math.max(0, sample.totalMs - sample.remainingMs);
  }

  function on(event, fn) {
    if (event !== "levelup") throw new Error(`createProgress: unknown event "${event}"`);
    if (typeof fn !== "function") throw new TypeError("createProgress: listener must be a function");
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function reset() {
    level = 1;
    xp = 0;
    totalMinutes = 0;
    lastSample = null;
    persist();
    return state();
  }

  if (storage !== null) read();

  return { state, sync, on, reset };
}
