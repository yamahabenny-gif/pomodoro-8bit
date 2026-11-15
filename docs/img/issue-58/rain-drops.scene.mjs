// Issue 58 evidence plate 2: the drops. Each track row is normalised to its own peak so the rhythm shows; the
// absolute drop levels are printed underneath. The zoom row shows one drop, normalised, sample by sample.
//   node tools/snap.mjs docs/img/issue-58/rain-drops.scene.mjs docs/img/issue-58/rain-drops.png 0
import { painterFor } from "../../../vendor/pixelfx/src/core/index.js";
import { hex, scale } from "../../../vendor/pixelfx/src/core/color.js";
import { grainSamples, grainTimes } from "../../../src/audio/sfx.js";

const INK = hex("#17121f"), BORDER = hex("#3a2f4a"), DOT = hex("#4a3d5e");
const MUTED = hex("#7d7094"), AMBER = hex("#ffcf6b");
const OLD = hex("#ff9a76"), NEW = hex("#9ad2f0");

const RATE = 16000, WINDOW = 2; // two seconds of the loop per track row

const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// The drip generator from main before issue 58: a high ping at 1.6-4 kHz with a noise click on its front,
// eleven of them per second out of a three second loop.
const OLD_GRAINS = { kind: "drip", gain: 0.13, perSecond: 11, seconds: 3 };
function oldDripLoop(seconds, rate) {
  const out = new Float32Array(Math.ceil(seconds * rate));
  const rand = mulberry32(0x5a17 ^ 0x9e37);
  const count = Math.max(1, Math.round(seconds * 11));
  const times = [];
  for (let g = 0; g < count; g++) times.push(((g + rand() * 0.6) / count) * seconds);
  for (let g = 0; g < times.length; g++) {
    const at = Math.min(out.length - 1, Math.floor(times[g] * rate));
    const freq = 1600 + rand() * 2400, len = Math.round(rate * 0.045), k = 0.6 + rand() * 0.4;
    for (let j = 0; j < len && at + j < out.length; j++) {
      const env = Math.exp(-j / (rate * 0.009));
      const click = j < rate * 0.004 ? (rand() * 2 - 1) * 0.5 : 0;
      out[at + j] += (Math.sin((j / rate) * Math.PI * 2 * freq) * 0.55 + click) * env * k;
    }
  }
  return { samples: out, times };
}

const NEW_GRAINS = { kind: "drip", gain: 0.15, perSecond: 3, seconds: 16 };

const oldLoop = oldDripLoop(3, RATE);
const newLoop = grainSamples(NEW_GRAINS, 16, RATE);
const newTimes = grainTimes(NEW_GRAINS, 16);

const peakOf = (samples) => samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const dB = (x) => 20 * Math.log10(Math.max(x, 1e-9));

/** One drop, scaled by its bed's gain, cut to 0.12 s and normalised to its own peak. */
function firstDrop(samples, at, gain, length = 0.12) {
  const start = Math.floor(at * RATE), n = Math.round(length * RATE), out = [];
  let peak = 0;
  for (let j = 0; j < n && start + j < samples.length; j++) {
    const v = samples[start + j] * gain;
    out.push(v);
    peak = Math.max(peak, Math.abs(v));
  }
  return { samples: out.map((v) => v / (peak || 1)), peak };
}

/** First WINDOW seconds of a loop, scaled by the bed gain (it wraps, so the tail is real). */
function track(samples, gain) {
  const n = Math.ceil(WINDOW * RATE), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = samples[i % samples.length] * gain;
  return out;
}

const ROWS = [
  {
    y: 24,
    title: "VORHER",
    sub: "11 TROPFEN/S · 3 S SCHLEIFE",
    color: OLD,
    track: track(oldLoop.samples, OLD_GRAINS.gain),
    times: oldLoop.times,
  },
  {
    y: 72,
    title: "NACHHER",
    sub: "3 TROPFEN/S · 16 S SCHLEIFE",
    color: NEW,
    track: track(newLoop, NEW_GRAINS.gain),
    times: newTimes,
  },
];
const DROPS = [
  { color: OLD, drop: firstDrop(oldLoop.samples, oldLoop.times[0], OLD_GRAINS.gain), note: "KLICK + PING 1.6-4 KHZ" },
  { color: NEW, drop: firstDrop(newLoop, newTimes[0], NEW_GRAINS.gain), note: "WEICH 0.6-1.1 KHZ" },
];

/** Min/max waveform: one pixel column per slice, mirrored around the zero line. */
function drawWave(p, x, y, w, h, samples, color, fullScale, alpha = 0.9) {
  const mid = y + Math.round(h / 2), half = h / 2;
  p.rect(x, mid, w, 1, DOT, 0.6);
  const per = samples.length / w;
  for (let i = 0; i < w; i++) {
    let lo = 0, hi = 0;
    const from = Math.floor(i * per), to = Math.floor((i + 1) * per);
    for (let j = from; j < to; j++) {
      const v = samples[j];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const up = Math.round(Math.min(half, (Math.max(0, hi) / fullScale) * half));
    const down = Math.round(Math.min(half, (Math.max(0, -lo) / fullScale) * half));
    p.rect(x + i, mid - up, 1, Math.max(1, up + down), color, alpha);
  }
}

export default function (frame) {
  const p = painterFor(frame);
  p.rect(0, 0, frame.w, frame.h, INK);
  p.text("TROPFEN", 6, 2, AMBER, { font: "big" });
  p.text("16 KHZ · AUSSCHNITT AUS DER SCHLEIFE", 314, 4, MUTED, { font: "mini", align: "right" });

  for (const row of ROWS) {
    const { y, color } = row, h = 26;
    p.rect(6, y, 308, 2, color);
    p.text(row.title, 6, y + 4, color, { font: "mini" });
    p.text(row.sub, 314, y + 4, MUTED, { font: "mini", align: "right" });
    p.text("TROPFENSPUR, 2 S", 6, y + 12, DOT, { font: "mini" });
    p.text(`PEAK ${dB(peakOf(row.track)).toFixed(0)} DBFS`, 314, y + 12, MUTED, { font: "mini", align: "right" });
    drawWave(p, 6, y + 18, 308, h, row.track, color, peakOf(row.track) || 1);
    for (const at of row.times) {
      if (at > WINDOW) break;
      const x = 6 + Math.round((at / WINDOW) * 307);
      p.rect(x, y + 20 + h, 1, 2, scale(color, 1.2));
    }
  }

  // One drop, zoomed and normalised: the old one starts with a click and rings high, the new one is a soft
  // windowed sine inside the rain's own band.
  p.rect(6, 120, 308, 2, BORDER);
  p.text("EIN TROPFEN, 0.12 S", 6, 123, MUTED, { font: "mini" });
  p.text("AUF EIGENEN PEAK NORMIERT", 314, 123, MUTED, { font: "mini", align: "right" });
  DROPS.forEach((col, i) => {
    const x = 6 + i * 158, w = 148, top = 137, h = 30;
    p.text(i === 0 ? "VORHER" : "NACHHER", x, 130, col.color, { font: "mini" });
    p.text(col.note, x + (i === 0 ? 26 : 32), 130, MUTED, { font: "mini" });
    drawWave(p, x, top, w, h, col.drop.samples, col.color, 1, 1);
    p.text(`PEAK ${dB(col.drop.peak).toFixed(0)} DBFS`, x, top + h + 3, MUTED, { font: "mini" });
  });
  return INK;
}
