// Texture plate for the ambience beds in src/audio/sfx.js: 3 s of each bed rendered offline at 8 kHz.
// Rows are min/max columns, so noise layers read as a band and drips/crickets spike out of it.
// node tools/snap.mjs tools/scenes/audio-beds.mjs docs/img/issue-29/beds-1.png 0.4
import { painterFor } from "../../vendor/pixelfx/src/core/index.js";
import { hex, scale } from "../../vendor/pixelfx/src/core/color.js";
import { AMBIENCES, AMBIENCE_MODES, grainTimes, renderAmbience } from "../../src/audio/sfx.js";

const INK = hex("#17121f"), ROW = hex("#221a2b"), ROW_ON = hex("#2b2038"), BORDER = hex("#3a2f4a");
const LABEL = hex("#e2d8f0"), MUTED = hex("#7d7094"), AMBER = hex("#ffcf6b"), DOT = hex("#4a3d5e");
const COLORS = {
  forest: hex("#9ecfa0"),
  fire: hex("#ffb45e"),
  rain: hex("#9ad2f0"),
  lake: hex("#8fd6c4"),
};
const SUBTITLES = {
  forest: "WIND 520 + 220",
  fire: "HISS + RUMBLE",
  rain: "HIGH PASS + DRIPS",
  lake: "LAP 0.2HZ + CRICKETS",
};

const RATE = 16000, SECONDS = 3; // 16 kHz so the 4 kHz crickets exist in the picture at all
const X0 = 96, X1 = 314, TOP = 20, ROW_H = 34, STEP = 36, MID = 15, AMP = 11;

// One offline render per bed; they share one scale so the loudness between them stays comparable.
const BEDS = AMBIENCE_MODES.map((mode) => ({
  mode,
  samples: renderAmbience(mode, SECONDS, RATE),
  grains: AMBIENCES[mode].grains ? grainTimes(AMBIENCES[mode].grains, SECONDS) : [],
}));
const PEAK = BEDS.reduce((m, b) => Math.max(m, b.samples.reduce((p, x) => Math.max(p, Math.abs(x)), 0)), 0.0001);

export default function (frame, t) {
  const p = painterFor(frame);
  p.rect(0, 0, frame.w, frame.h, INK);
  p.text("AMBIENCE", 6, 3, AMBER, { font: "big" });
  p.text("3S LOOPS / 16 KHZ", 314, 4, MUTED, { align: "right" });

  // Time ruler over the texture column.
  for (const s of [0, 1, 2, 3]) {
    const x = Math.min(X1, X0 + Math.round((s / SECONDS) * (X1 - X0)));
    p.text(`${s}S`, x, 12, MUTED, { font: "mini", align: "center" });
    p.rect(x, 19, 1, 1, DOT);
  }

  const active = ((Math.floor(t) % BEDS.length) + BEDS.length) % BEDS.length;
  BEDS.forEach((bed, i) => {
    const y = TOP + i * STEP, on = i === active, color = COLORS[bed.mode] ?? AMBER;
    const cy = y + MID, width = X1 - X0;
    p.rect(4, y, 312, ROW_H, on ? ROW_ON : ROW);
    p.rect(4, y, 312, 1, BORDER);
    p.rect(4, y + ROW_H - 1, 312, 1, BORDER);
    p.rect(4, y, 2, ROW_H, on ? color : scale(color, 0.5));
    p.text(bed.mode.toUpperCase(), 10, y + 5, on ? color : scale(LABEL, 0.6), { font: "mini" });
    p.text(SUBTITLES[bed.mode] ?? "", 10, y + 14, MUTED, { font: "mini" });
    const grains = AMBIENCES[bed.mode].grains;
    if (grains) p.text(`${grains.kind.toUpperCase()} ${grains.perSecond}/S`, 10, y + 23, scale(MUTED, 1.15), { font: "mini" });

    // Zero line, then the amplitude envelope: the band is the noise layers, the ticks underneath the grains.
    for (let x = 0; x < width; x += 4) p.rect(X0 + x, cy, 1, 1, DOT, 0.7);
    const per = bed.samples.length / width;
    for (let x = 0; x < width; x++) {
      let peak = 0;
      const from = Math.floor(x * per), to = Math.max(from + 1, Math.floor((x + 1) * per));
      for (let j = from; j < to && j < bed.samples.length; j++) peak = Math.max(peak, Math.abs(bed.samples[j]));
      if (peak <= 0.00002) continue;
      const h = Math.max(1, Math.round(Math.pow(peak / PEAK, 0.55) * AMP));
      const fill = on ? color : scale(color, 0.38);
      p.rect(X0 + x, cy - h, 1, h * 2 + 1, fill, on ? 0.85 : 0.7);
      p.rect(X0 + x, cy - h, 1, 1, on ? scale(color, 1.25) : scale(color, 0.55));
    }
    for (const at of bed.grains) {
      const x = X0 + Math.round((Math.min(at, SECONDS) / SECONDS) * width);
      p.rect(x, cy + AMP + 2, 1, 2, on ? scale(color, 1.3) : scale(color, 0.5));
    }
    p.rect(X0 + width, y + 4, 1, ROW_H - 8, DOT, 0.8);

    if (on) {
      const x = X0 + Math.round(((t % SECONDS) / SECONDS) * width);
      p.rect(x, y + 3, 1, ROW_H - 5, scale(color, 0.5));
      p.rect(x - 1, y, 3, 2, color);
      p.rect(x - 1, y + ROW_H - 2, 3, 2, color);
    }
  });
  p.text("BAND = SCHICHTEN, TICKS = KORN", 6, 168, MUTED, { font: "mini" });
  p.text("WAVE 4: RAIN, LAKE", 314, 168, MUTED, { font: "mini", align: "right" });
  return INK;
}
