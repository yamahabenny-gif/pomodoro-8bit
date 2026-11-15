// CONTRACT (owned by issue "Level-Up"). Experience timed to focus minutes: the bar fills while you focus, a level
// is reached after a set number of focus minutes, and the next level takes a little longer. Pure logic, no DOM.
//
// XP = focus minutes (fractional; breaks and paused time give nothing). Level L -> L+1 needs xpForLevel(L) minutes:
//   xpForLevel(L) = 15 + 5 * (L - 1)   (15, 20, 25, ... minutes), exported.
// createProgress({ storage = localStorage-or-null, key = "pomodoro8bit.progress.v1" }) returns:
//   state(): { level, xp (minutes into this level), need (xpForLevel(level)), ratio 0..1, totalMinutes }
//   sync(timerState)             call every frame with timer.state(); adds the focus time that passed since the
//                                last call (only while phase === "focus" and running; a skip or phase change never
//                                counts the skipped remainder). Returns the levels gained this call ([] usually).
//   on("levelup", fn) -> off     fn({ level }) once per level gained, in order
//   reset()                      back to level 1 (for tests/debug only, the UI does not offer it)
// Persists after every level-up and at most every 5 s of progress (storage errors are swallowed).
//
// Notes for callers:
// - Time is read from the timer's own remainingMs, never from the wall clock, so ?speed=60 fills the bar exactly
//   as fast as the clock runs and a paused timer gives nothing.
// - After a reload (or a long background gap) the first sync only takes a bearing; the next sync sees the jump and
//   emits every level it crossed, in order.
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
  let lastSample = null; // { remainingMs, phase, running }
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
    };
    const previous = lastSample;
    lastSample = current;
    // Only a stretch that stays inside one running focus phase counts; a phase change or a skip jumps the
    // remaining time and would otherwise look like work that never happened.
    if (!previous) return [];
    if (
      previous.phase !== "focus" ||
      current.phase !== "focus" ||
      !previous.running ||
      !current.running
    ) {
      return [];
    }
    const worked = previous.remainingMs - current.remainingMs;
    const gained = grant(worked / MINUTE_MS);
    if (!gained.length) {
      if (dirty && now() - lastSaveAt >= SAVE_EVERY_MS) persist();
      return gained;
    }
    persist();
    for (const reached of gained) emit({ level: reached });
    return gained;
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
