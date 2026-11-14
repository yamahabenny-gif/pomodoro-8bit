// CONTRACT (owned by issue "Regie"). Resolve a valid persisted timer to its configured preset.
// loadSavedSession(presets, load) returns { preset, data } for a matching serialized timer, or null.

const PHASES = new Set(["focus", "short", "long"]);

function isTimerData(data) {
  return Boolean(
    data &&
    typeof data === "object" &&
    data.v === 1 &&
    typeof data.preset === "string" &&
    PHASES.has(data.phase) &&
    data.remainingMs != null &&
    Number.isFinite(Number(data.remainingMs)) &&
    typeof data.running === "boolean" &&
    data.savedAt != null &&
    Number.isFinite(Number(data.savedAt)) &&
    Number.isFinite(Number(data.speed)) &&
    Number(data.speed) > 0,
  );
}

export function loadSavedSession(presets, read) {
  if (!Array.isArray(presets) || typeof read !== "function") return null;
  const stored = read();
  if (!isTimerData(stored)) return null;

  const preset = presets.find(({ id }) => id === stored.preset);
  if (!preset) return null;
  const data = read(preset);
  if (!isTimerData(data) || data.preset !== preset.id) return null;
  return { preset, data };
}
