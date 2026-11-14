// Documentation scene for the timer core (issue #2). It drives the real createTimer() through a fake
// clock: scene time t means "t minutes into a classic session", rendered as a HUD mockup plus the cycle
// timeline. The timer catches up in one tick, so the playhead also proves the catch-up logic.
//
//   node tools/snap.mjs docs/img/issue-2/timer-cycle.scene.mjs docs/img/issue-2/timer-t0.png 0
//
import { painterFor, hex, scale } from "../../../vendor/pixelfx/src/core/index.js";
import { createTimer } from "../../../src/timer/timer.js";
import { presetById } from "../../../src/config/presets.js";

const MIN = 60_000;
const PRESET = presetById("classic");
const PLAN = (() => {
  const out = [];
  for (let focus = 1; focus <= 4; focus++) {
    out.push({ phase: "focus", minutes: PRESET.focus });
    const long = focus === 4 && PRESET.longBreak > 0;
    out.push({ phase: long ? "long" : "short", minutes: long ? PRESET.longBreak : PRESET.shortBreak });
  }
  return out;
})();
const PLAN_MIN = PLAN.reduce((sum, s) => sum + s.minutes, 0);

const C = {
  bg: hex("#17121f"),
  panel: hex("#1d1826"),
  line: hex("#3b3350"),
  dim: hex("#8f83a6"),
  text: hex("#f4e9d8"),
  gold: hex("#f0b424"),
  focus: hex("#d95b5b"),
  short: hex("#4f9d8a"),
  long: hex("#6b7fd7"),
};
const PHASE_COLOR = { focus: C.focus, short: C.short, long: C.long };
const PHASE_LABEL = { focus: "KAMPF", short: "RAST", long: "LANGE RAST" };

const mmss = (ms) => {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export default function (frame, t) {
  // the clock starts at 0 and only moves to t afterwards, so the timer really lives through t minutes
  let clock = 0;
  const timer = createTimer(PRESET, { now: () => clock, speed: 1 });
  clock = Math.max(0, t) * MIN;
  const s = timer.tick();
  const p = painterFor(frame);

  // panel
  p.rect(6, 6, 308, 168, C.panel);
  p.rect(6, 6, 308, 1, C.line);
  p.rect(6, 173, 308, 1, C.line);
  p.rect(6, 6, 1, 168, C.line);
  p.rect(313, 6, 1, 168, C.line);

  // header
  p.text("POMODORO 8-BIT", 16, 12, C.gold);
  p.text(`${PRESET.name.toUpperCase()} ${PRESET.focus}/${PRESET.shortBreak}/${PRESET.longBreak}`, 304, 12, C.dim, {
    align: "right",
  });

  // clock
  p.text(mmss(s.remainingMs), 160, 26, C.text, { font: "big", scale: 4, align: "center", outline: C.bg });

  // phase pill
  const label = PHASE_LABEL[s.phase];
  const color = PHASE_COLOR[s.phase];
  const [labelW] = p.measure(label, { font: "mini" });
  const pillW = labelW + 16;
  p.rect(160 - pillW / 2, 62, pillW, 11, scale(color, 0.45));
  p.rect(160 - pillW / 2, 62, pillW, 1, color);
  p.rect(160 - pillW / 2, 72, pillW, 1, color);
  p.rect(160 - pillW / 2, 62, 1, 11, color);
  p.rect(160 + pillW / 2 - 1, 62, 1, 11, color);
  p.text(label, 160, 65, C.text, { align: "center" });

  // cycle pips: position of the running focus inside the long-break block
  const every = PRESET.longBreakEvery || 4;
  const slot = ((s.cycle - 1) % every) + 1;
  const pipW = every * 6 + (every - 1) * 4;
  for (let i = 1; i <= every; i++) {
    const x = 160 - pipW / 2 + (i - 1) * 10;
    p.rect(x, 80, 6, 6, i <= slot ? C.gold : scale(C.line, 1.1));
    if (i === slot) p.rect(x, 80, 6, 1, C.text);
  }
  p.text(`ZYKLUS ${s.cycle} VON ${every}`, 160, 90, C.dim, { align: "center" });

  p.rect(16, 100, 288, 1, C.line);

  // cycle plan: focus and breaks laid out by minutes, elapsed part dimmed
  p.text("ZYKLUSPLAN", 16, 104, C.dim);
  p.text(`0 - ${PLAN_MIN} MIN`, 304, 104, C.dim, { align: "right" });
  const x0 = 16;
  const w = 288;
  const y = 116;
  const h = 18;
  let cursor = 0;
  for (const seg of PLAN) {
    const sx = Math.round(x0 + (cursor / PLAN_MIN) * w);
    const sw = Math.round(x0 + ((cursor + seg.minutes) / PLAN_MIN) * w) - sx;
    const done = cursor + seg.minutes <= t;
    const now = t > cursor && t < cursor + seg.minutes;
    const base = PHASE_COLOR[seg.phase];
    const fill = done ? scale(base, 0.5) : base;
    if (sw > 1) {
      p.rect(sx, y, sw - 1, h, fill);
      if (now) p.rect(sx, y, sw - 1, 1, C.text);
      if (sw >= 10) p.text(String(seg.minutes), sx + (sw - 1) / 2, y + 6, C.bg, { align: "center" });
    }
    cursor += seg.minutes;
  }

  // playhead: a plain 1 px line, kept clear of the labels above
  const px = Math.round(x0 + (Math.min(t, PLAN_MIN) / PLAN_MIN) * w);
  p.rect(px, y - 4, 1, h + 8, C.text);

  // footer
  p.text(`T+${Math.round(t)} MIN`, 16, 144, C.gold);
  p.text(`REST ${mmss(s.remainingMs)}`, 304, 144, C.text, { align: "right" });

  // legend + speed note
  let lx = 16;
  for (const phase of ["focus", "short", "long"]) {
    p.rect(lx, 158, 5, 5, PHASE_COLOR[phase]);
    p.text(PHASE_LABEL[phase], lx + 8, 158, C.dim);
    lx += 8 + p.measure(PHASE_LABEL[phase], { font: "mini" })[0] + 10;
  }
  p.text("SPEED 60: 1 MIN = 1 S", 304, 158, C.dim, { align: "right" });

  return C.bg;
}
