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

export function createTimer(_preset, _opts = {}) {
  throw new Error("createTimer: not implemented yet (issue Timer-Kern)");
}
