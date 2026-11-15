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

export const xpForLevel = (level) => 15 + 5 * (Math.max(1, level) - 1);

export function createProgress(_opts = {}) {
  throw new Error("createProgress: not implemented yet (issue Level-Up)");
}
