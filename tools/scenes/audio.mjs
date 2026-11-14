// Waveform plate for src/audio/sfx.js: every sound recipe rendered offline at 8 kHz, one row each.
// t highlights one sound at a time (t % 7) and drops a playhead into it, so a few snapshots walk the set.
// node tools/snap.mjs tools/scenes/audio.mjs docs/img/issue-7/sfx-1.png 0.4
import { painterFor } from "../../vendor/pixelfx/src/core/index.js";
import { hex, scale } from "../../vendor/pixelfx/src/core/color.js";
import { SOUNDS, SOUND_NAMES, renderSound } from "../../src/audio/sfx.js";

const INK = hex("#17121f"), ROW = hex("#221a2b"), ROW_ON = hex("#2b2038"), BORDER = hex("#3a2f4a");
const LABEL = hex("#e2d8f0"), MUTED = hex("#7d7094"), AMBER = hex("#ffcf6b"), DOT = hex("#4a3d5e");
const COLORS = {
  swing: hex("#a8dcf0"),
  hit: hex("#ffcf6b"),
  enemyDie: hex("#8fe08b"),
  hurt: hex("#ff8f7a"),
  phaseFocus: hex("#ffd98a"),
  phaseBreak: hex("#c3b1ff"),
  click: hex("#9ee6d6"),
};
const NAMES = {
  swing: "SWING",
  hit: "HIT",
  enemyDie: "ENEMY DIE",
  hurt: "HURT",
  phaseFocus: "FOCUS",
  phaseBreak: "BREAK",
  click: "CLICK",
};

const RATE = 8000;
const X0 = 96, X1 = 312, TOP = 19, ROW_H = 20, STEP = 22, MID = 10, AMP = 8;
const AXIS = 1000; // all rows share one time axis in ms, so a blip looks like a blip

// One offline render per sound; the loudest peak sets the shared scale so the plate keeps the dynamics.
const WAVES = SOUND_NAMES.map((name) => ({ name, samples: renderSound(name, RATE) }));
const PEAK = WAVES.reduce((m, w) => Math.max(m, w.samples.reduce((p, x) => Math.max(p, Math.abs(x)), 0)), 0.0001);

export default function (frame, t) {
  const p = painterFor(frame);
  p.rect(0, 0, frame.w, frame.h, INK);
  p.text("8-BIT SFX", 6, 4, AMBER, { font: "big" });
  p.text("MASTER 0.16 / 8 KHZ", 314, 4, MUTED, { align: "right" });

  // Time ruler over the waveform column.
  for (const ms of [0, 250, 500, 750, 1000]) {
    const x = Math.min(X1, X0 + Math.round((ms / AXIS) * (X1 - X0)));
    p.text(ms === 1000 ? "1S" : String(ms), x, 12, MUTED, { font: "mini", align: "center" });
    p.rect(x, 17, 1, 1, DOT);
  }

  const active = ((Math.floor(t) % WAVES.length) + WAVES.length) % WAVES.length;
  WAVES.forEach((wave, i) => {
    const y = TOP + i * STEP, on = i === active, color = COLORS[wave.name] ?? AMBER;
    const cy = y + MID, width = X1 - X0;
    p.rect(4, y, 312, ROW_H, on ? ROW_ON : ROW);
    p.rect(4, y, 312, 1, BORDER);
    p.rect(4, y + ROW_H - 1, 312, 1, BORDER);
    p.rect(4, y, 2, ROW_H, on ? color : scale(color, 0.5));
    p.text(`${NAMES[wave.name] ?? wave.name.toUpperCase()} ${Math.round(SOUNDS[wave.name].dur * 1000)}MS`, 10, y + 7, on ? color : scale(LABEL, 0.55), { font: "mini" });

    // Dotted zero line, up to this sound's end: the row's length is its duration.
    const cols = Math.max(1, Math.min(width, Math.round(((wave.samples.length / RATE) * 1000 / AXIS) * width)));
    for (let x = 0; x < cols; x += 4) p.rect(X0 + x, cy, 1, 1, DOT, 0.7);

    // Max amplitude per column (an editor's envelope), with a bright edge so the shape reads.
    const per = wave.samples.length / cols;
    for (let x = 0; x < cols; x++) {
      let peak = 0;
      const from = Math.floor(x * per), to = Math.max(from + 1, Math.floor((x + 1) * per));
      for (let j = from; j < to && j < wave.samples.length; j++) peak = Math.max(peak, Math.abs(wave.samples[j]));
      if (peak <= 0.00002) continue;
      const h = Math.max(1, Math.round(Math.pow(peak / PEAK, 0.6) * AMP));
      const fill = on ? color : scale(color, 0.42), edge = on ? scale(color, 1.15) : scale(color, 0.6);
      p.rect(X0 + x, cy - h, 1, h * 2 + 1, fill);
      p.rect(X0 + x, cy - h, 1, 1, edge);
      p.rect(X0 + x, cy + h, 1, 1, edge);
    }
    p.rect(X0 + cols, y + 3, 1, ROW_H - 6, DOT, 0.8);

    if (on) {
      // Playhead runs the shared 1 s axis once per second.
      const x = X0 + Math.round((t % 1) * width);
      p.rect(x, y + 2, 1, ROW_H - 4, scale(color, 0.5));
      p.rect(x - 1, y, 3, 2, color);
      p.rect(x - 1, y + ROW_H - 2, 3, 2, color);
    }
  });
  p.text("SYNTHESE, KEINE AUDIODATEIEN", 6, 174, MUTED, { font: "mini" });
  p.text("WAVE = OFFLINE RENDER", 312, 174, MUTED, { font: "mini", align: "right" });
  return INK;
}

