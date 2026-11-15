// Issue 58 evidence plate: the old rain bed (main, before this issue) against the new one, both put through
// the same offline renderer. Left column = what you heard, right column = what you hear now.
//   node tools/snap.mjs docs/img/issue-58/rain-compare.scene.mjs docs/img/issue-58/rain-compare.png 0
// 12 s of bed at 16 kHz. Waveform = min/max per column, ticks underneath = the occasional drop.
// Spectrum = RMS per 1/9 octave band (biquad band-pass, 100 Hz .. 8 kHz), 0 dB = the loudest band of that
// column, so the two shapes can be compared directly. The 4 kHz marker is where the old hiss lived.
import { painterFor } from "../../../vendor/pixelfx/src/core/index.js";
import { hex, scale } from "../../../vendor/pixelfx/src/core/color.js";
import { AMBIENCES, grainTimes, renderBed } from "../../../src/audio/sfx.js";

// AMBIENCES.rain on main before issue 58: high-passed hiss at 1.5 kHz, a 2.8 kHz band, 11 drips/s that ping.
const OLD_RAIN = {
  layers: [
    { type: "highpass", freq: 1500, q: 0.6, gain: 0.19, lfo: 0.13, depth: 0.04 },
    { type: "bandpass", freq: 2800, q: 0.9, gain: 0.1, lfo: 0.37, depth: 0.05 },
    { type: "lowpass", freq: 480, q: 0.5, gain: 0.09, lfo: 0.07, depth: 0.02 },
  ],
  grains: { kind: "drip", gain: 0.13, perSecond: 11, seconds: 3 },
};

const INK = hex("#17121f"), BORDER = hex("#3a2f4a"), DOT = hex("#4a3d5e");
const LABEL = hex("#e2d8f0"), MUTED = hex("#7d7094"), AMBER = hex("#ffcf6b");
const OLD = hex("#ff9a76"), NEW = hex("#9ad2f0"), MARK = hex("#c46b7a");

const RATE = 16000, SECONDS = 12;
const F_LO = 100, F_HI = 8000, DB_SPAN = 45; // spectrum window: +0 .. -45 dB below the loudest band
const FULL_SCALE = 0.5; // waveform: this amplitude is the top of the box

/** RMS of one 1/9 octave band: RBJ band-pass, then measure what comes out. */
function bandRms(samples, freq, q, rate) {
  const w0 = (2 * Math.PI * freq) / rate, cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * q), a0 = 1 + alpha;
  const b0 = alpha / a0, b2 = -alpha / a0, a1 = (-2 * cos) / a0, a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, sum = 0, n = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i], y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    if (i > rate * 0.05) { // let the filter settle before measuring
      sum += y * y;
      n++;
    }
  }
  return Math.sqrt(sum / Math.max(1, n));
}

const BANDS = [];
for (let f = F_LO; f < F_HI; f *= Math.pow(2, 1 / 9)) BANDS.push(f);
const Q = 1 / (2 * (Math.pow(2, 1 / 18) - 1)); // 1/9 octave

function analyse(bed) {
  const samples = renderBed(bed, SECONDS, RATE);
  let peak = 0, sum = 0;
  for (const x of samples) {
    peak = Math.max(peak, Math.abs(x));
    sum += x * x;
  }
  const bands = BANDS.map((f) => ({ f, level: bandRms(samples, f, Q, RATE) }));
  const loudest = Math.max(...bands.map((b) => b.level)) || 1;
  for (const b of bands) b.db = 20 * Math.log10(Math.max(b.level / loudest, 1e-5));
  const power = (from, to) =>
    bands.filter((b) => b.f >= from && b.f < to).reduce((a, b) => a + b.level * b.level, 0);
  const total = power(0, Infinity) || 1;
  return {
    samples,
    drops: grainTimes(bed.grains, bed.grains.seconds ?? 3).filter((t) => t < SECONDS),
    peak,
    rms: Math.sqrt(sum / samples.length),
    bands,
    centroid: bands.reduce((a, b) => a + b.f * b.level * b.level, 0) / total,
    high: power(4000, Infinity) / total,
  };
}

const A = analyse(OLD_RAIN), B = analyse(AMBIENCES.rain);
const dB = (x) => (x > 0 ? 20 * Math.log10(x) : -99);

const COL_W = 148;
const COLS = [
  { a: A, x: 6, title: "VORHER", color: OLD, sub: "MAIN" },
  { a: B, x: 166, title: "NACHHER", color: NEW, sub: "ISSUE 58" },
];
const WAVE_TOP = 33, WAVE_H = 28, MID = WAVE_TOP + WAVE_H / 2;
const SPEC_TOP = 76, SPEC_H = 58;

export default function (frame) {
  const p = painterFor(frame);
  p.rect(0, 0, frame.w, frame.h, INK);
  p.text("REGENTON", 6, 2, AMBER, { font: "big" });
  p.text(`${SECONDS} S · 16 KHZ · WELLENFORM + SPEKTRUM`, 314, 4, MUTED, { font: "mini", align: "right" });

  for (const col of COLS) {
    const { a, x, color } = col;
    p.rect(x, 13, COL_W, 2, color);
    p.text(col.title, x, 17, color, { font: "big" });
    p.text(col.sub, x + COL_W, 19, MUTED, { font: "mini", align: "right" });

    // ---- waveform: one column per ~80 ms, full min/max band on one shared scale
    p.text("WELLENFORM", x, 27, DOT, { font: "mini" });
    p.text("0.5 = RAND", x + COL_W, 27, DOT, { font: "mini", align: "right" });
    p.rect(x, MID, COL_W, 1, DOT, 0.7);
    for (const amp of [0.25, 0.5]) { // guide lines so the level difference between the columns reads
      const k = Math.round((amp / FULL_SCALE) * (WAVE_H / 2));
      p.rect(x, MID - k, COL_W, 1, DOT, 0.3);
      p.rect(x, MID + k, COL_W, 1, DOT, 0.3);
    }
    const per = a.samples.length / COL_W;
    for (let i = 0; i < COL_W; i++) {
      let lo = 0, hi = 0;
      const from = Math.floor(i * per), to = Math.floor((i + 1) * per);
      for (let j = from; j < to; j++) {
        const v = a.samples[j];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      const top = MID - Math.round((hi / FULL_SCALE) * (WAVE_H / 2));
      const bottom = MID + Math.round((-lo / FULL_SCALE) * (WAVE_H / 2));
      p.rect(x + i, top, 1, Math.max(1, bottom - top), color, 0.9);
    }
    for (const at of a.drops) {
      const dx = x + Math.round((Math.min(at, SECONDS) / SECONDS) * (COL_W - 1));
      p.rect(dx, WAVE_TOP + WAVE_H + 1, 1, 2, scale(color, 1.2));
    }

    // ---- spectrum: bands left to right, 100 Hz .. 8 kHz on a log axis
    p.text("SPEKTRUM 1/9 OKT", x, 70, DOT, { font: "mini" });
    const fx = (f) => x + Math.round((Math.log(f / F_LO) / Math.log(F_HI / F_LO)) * (COL_W - 1));
    // +0 and -45 dB frame, grid every 15 dB
    p.rect(x, SPEC_TOP, COL_W, 1, BORDER);
    p.rect(x, SPEC_TOP + SPEC_H, COL_W, 1, BORDER);
    for (let d = -15; d > -DB_SPAN; d -= 15) {
      const y = SPEC_TOP + Math.round((-d / DB_SPAN) * (SPEC_H - 1));
      p.rect(x, y, COL_W, 1, DOT, 0.4);
      p.text(String(d), x + 1, y + 1, DOT, { font: "mini" });
    }
    // 4 kHz: everything to the right of this line is the air that made the old bed hiss
    for (const b of a.bands) {
      const h = Math.max(1, Math.round((Math.max(0, b.db + DB_SPAN) / DB_SPAN) * (SPEC_H - 2)));
      const bx = fx(b.f), hot = b.f >= 4000;
      p.rect(bx, SPEC_TOP + SPEC_H - 1 - h, 2, h, hot ? MARK : color);
      p.rect(bx, SPEC_TOP + SPEC_H - 1 - h, 2, 1, hot ? scale(MARK, 1.2) : scale(color, 1.25));
    }
    for (let y = SPEC_TOP; y < SPEC_TOP + SPEC_H; y += 3) p.rect(fx(4000), y, 1, 1, MARK);
    p.text("4K", fx(4000) + 3, SPEC_TOP + 2, MARK, { font: "mini" });
    p.text("100", x, SPEC_TOP + SPEC_H + 2, DOT, { font: "mini" });
    p.text("8K", x + COL_W, SPEC_TOP + SPEC_H + 2, DOT, { font: "mini", align: "right" });
    p.text("0 DB", x + 1, SPEC_TOP + 2, DOT, { font: "mini" });

    // ---- numbers
    const row = SPEC_TOP + SPEC_H + 10;
    p.text(`PEAK ${dB(a.peak).toFixed(1)}`, x, row, LABEL, { font: "mini" });
    p.text(`RMS ${dB(a.rms).toFixed(1)}`, x + COL_W, row, a.rms > 0.07 ? MARK : LABEL, { font: "mini", align: "right" });
    p.text(`MITTE ${Math.round(a.centroid)} HZ`, x, row + 8, MUTED, { font: "mini" });
    p.text(`>4KHZ ${(a.high * 100).toFixed(1)}%`, x + COL_W, row + 8, a.high > 0.1 ? MARK : NEW, {
      font: "mini",
      align: "right",
    });
  }

  p.text("SPEKTRUM: 0 DB = LAUTESTES BAND", 6, 170, MUTED, { font: "mini" });
  p.text("PEAK/RMS IN DBFS", 314, 170, MUTED, { font: "mini", align: "right" });
  return INK;
}
