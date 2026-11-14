// CONTRACT (owned by issue "Timer-Kern"). localStorage glue around the timer, defensive by design:
// a missing, disabled or broken store must never break a session.
//
//   save(timer)     -> true if the timer's serialize() data is now in localStorage
//   load(preset)    -> the stored data for that preset, or null (no data, another preset, corrupt JSON,
//                      storage unavailable)
//   clear()         -> forget the stored session (reset button, "start fresh")
//
// The timer itself never touches storage: call save(timer) on every "change", and feed load(preset)
// to createTimer.restore(preset, data, opts). Everything is wrapped in try/catch because private mode,
// disabled storage and quota errors throw at different moments. Browser only; in node (tests, tools)
// there is simply no store and save() reports false.

export const STORAGE_KEY = "pomodoro8bit.timer.v1";

/** The localStorage object, or null when there is none (node) or touching it throws (private mode). */
function store() {
  try {
    const s = globalThis.localStorage;
    return s && typeof s.getItem === "function" && typeof s.setItem === "function" ? s : null;
  } catch {
    return null;
  }
}

/** Persist a timer. Returns false when storage is unavailable or full. */
export function save(timer) {
  const s = store();
  if (!s || !timer || typeof timer.serialize !== "function") return false;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(timer.serialize()));
    return true;
  } catch {
    return false;
  }
}

/** The saved data for `preset`, or null. Data from another variant is ignored, not migrated. */
export function load(preset) {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    if (data.preset != null && preset?.id != null && data.preset !== preset.id) return null;
    return data;
  } catch {
    return null;
  }
}

/** Drop the saved session. Returns false when storage is unavailable. */
export function clear() {
  const s = store();
  if (!s) return false;
  try {
    s.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
