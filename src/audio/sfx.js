// CONTRACT (owned by issue "Sound & Benachrichtigung"). Synthesized 8-bit sounds with WebAudio, no files.
//
// createSfx() returns:
//   unlock()                     call on the first user gesture (browsers block audio before)
//   play(name)                   "swing" | "hit" | "enemyDie" | "hurt" | "phaseFocus" | "phaseBreak" | "click"
//                                WAVE 4 (issue "Sound 2"): + "levelUp" | "thunder" | "ignite" | "block" | "rockHit"
//   setMuted(bool), muted
//   ambience(mode)               "forest" | "fire" | "rain" | "lake" | null: soft looping beds, optional.
//                                "rain" is rain on leaves with a drip crackle; "lake" is lapping water and crickets.
// notify(title, body)            Notification API when the tab is hidden; asks permission once, from a click
//
// Additions, backwards compatible: createSfx({ storage, createContext }) injects a fake for tests; the instance
// also carries notify() and requestPermission(); requestPermission() is exported; renderSound(name) and
// renderAmbience(mode, seconds) render the same recipes offline (waveform art in docs/img/issue-7 and -29);
// SOUNDS and AMBIENCES are the data both paths share.

const STORAGE_KEY = "pomodoro8bit.muted";
/** Quiet on purpose: peak of a busy sound sits around -18 dBFS. */
const MASTER = 0.16;
const MIN_GAIN = 0.0001;

// ---- sound design ---------------------------------------------------------------------------------
// A sound is a list of voices on one shared clock. type "tone" is an oscillator (square, triangle, sine,
// sawtooth) whose pitch can sweep; type "noise" is filtered white noise (the 8-bit "shhh" and "thud").
// Every voice has an attack and an exponential tail, so nothing clicks. `level` trims a whole sound:
// filtered noise loses a lot of amplitude, so the whooshes and clicks need more than the square hits.
const recipe = (voices, level = 1) => ({
  dur: voices.reduce((d, v) => Math.max(d, (v.t ?? 0) + v.dur), 0),
  level,
  voices,
});

export const SOUNDS = {
  // Sword: a band-passed noise sweep falling away, with a small triangle body under it.
  swing: recipe(
    [
      { type: "noise", t: 0, dur: 0.15, gain: 0.34, filter: { type: "bandpass", from: 2800, to: 820, q: 1.1 } },
      { type: "noise", t: 0.025, dur: 0.1, gain: 0.16, filter: { type: "bandpass", from: 1600, to: 520, q: 0.8 } },
      { type: "tone", wave: "triangle", t: 0.01, dur: 0.07, gain: 0.1, from: 420, to: 180 },
    ],
    2.6,
  ),
  // Hit: square pulse dropping an octave, a triangle thump and a short bright noise slap.
  hit: recipe(
    [
      { type: "tone", wave: "square", t: 0, dur: 0.1, gain: 0.42, from: 210, to: 70 },
      { type: "tone", wave: "triangle", t: 0, dur: 0.12, gain: 0.22, from: 96, to: 52 },
      { type: "noise", t: 0, dur: 0.07, gain: 0.24, filter: { type: "highpass", from: 1800, to: 2600, q: 0.7 } },
    ],
    0.9,
  ),
  // Enemy dies: a falling arpeggio (G5 E5 Bb4 F4 Bb3) and a soft poof.
  enemyDie: recipe(
    [
      { type: "tone", wave: "square", t: 0, dur: 0.07, gain: 0.22, from: 784 },
      { type: "tone", wave: "square", t: 0.07, dur: 0.07, gain: 0.22, from: 622 },
      { type: "tone", wave: "square", t: 0.14, dur: 0.07, gain: 0.22, from: 466 },
      { type: "tone", wave: "square", t: 0.21, dur: 0.07, gain: 0.22, from: 349 },
      { type: "tone", wave: "square", t: 0.28, dur: 0.1, gain: 0.2, from: 233, to: 175 },
      { type: "noise", t: 0.3, dur: 0.16, gain: 0.16, filter: { type: "lowpass", from: 1500, to: 500, q: 0.9 } },
    ],
    1.6,
  ),
  // Hurt: a sawtooth wince sliding down, a little body noise. Short so it never gets in the way.
  hurt: recipe(
    [
      { type: "tone", wave: "sawtooth", t: 0, dur: 0.18, gain: 0.3, from: 440, to: 120 },
      { type: "noise", t: 0, dur: 0.15, gain: 0.16, filter: { type: "bandpass", from: 900, to: 280, q: 0.9 } },
    ],
    1.4,
  ),
  // Focus starts: rising G4 C5 G5 fanfare with an octave under it and a triangle shimmer on top.
  phaseFocus: recipe(
    [
      { type: "tone", wave: "square", t: 0, dur: 0.14, gain: 0.26, from: 392 },
      { type: "tone", wave: "square", t: 0.13, dur: 0.14, gain: 0.28, from: 523 },
      { type: "tone", wave: "square", t: 0.26, dur: 0.4, gain: 0.3, from: 784 },
      { type: "tone", wave: "triangle", t: 0.26, dur: 0.32, gain: 0.12, from: 1046 },
      { type: "tone", wave: "triangle", t: 0, dur: 0.2, gain: 0.14, from: 196 },
    ],
    1.25,
  ),
  // Break starts: soft bell (A5 with its fifth and an A4 hum), long tail, slow attack.
  phaseBreak: recipe(
    [
      { type: "tone", wave: "sine", t: 0, dur: 1, gain: 0.3, from: 880, attack: 0.012 },
      { type: "tone", wave: "sine", t: 0.01, dur: 0.7, gain: 0.1, from: 1320, attack: 0.012 },
      { type: "tone", wave: "triangle", t: 0, dur: 0.6, gain: 0.1, from: 440, attack: 0.012 },
    ],
    1.15,
  ),
  // UI click: tiny 1.2 kHz blip, barely there.
  click: recipe(
    [
      { type: "tone", wave: "square", t: 0, dur: 0.028, gain: 0.12, from: 1180, to: 980 },
      { type: "noise", t: 0, dur: 0.016, gain: 0.05, filter: { type: "highpass", from: 3400, q: 0.7 } },
    ],
    2,
  ),

  // ---- WAVE 4 -------------------------------------------------------------------------------------
  // Level up: C major run up (C5 E5 G5 C6) into a held chord with a triangle octave on top. One second and
  // the loudest sound in the set: a level is worth hearing.
  levelUp: recipe(
    [
      { type: "tone", wave: "square", t: 0, dur: 0.08, gain: 0.24, from: 523 },
      { type: "tone", wave: "square", t: 0.07, dur: 0.08, gain: 0.24, from: 659 },
      { type: "tone", wave: "square", t: 0.14, dur: 0.08, gain: 0.25, from: 784 },
      { type: "tone", wave: "square", t: 0.21, dur: 0.1, gain: 0.26, from: 1046 },
      // closing chord: C major with a triangle bass and a shimmering third octave
      { type: "tone", wave: "square", t: 0.36, dur: 0.6, gain: 0.2, from: 523 },
      { type: "tone", wave: "square", t: 0.36, dur: 0.6, gain: 0.18, from: 659 },
      { type: "tone", wave: "square", t: 0.36, dur: 0.56, gain: 0.18, from: 784 },
      { type: "tone", wave: "square", t: 0.36, dur: 0.52, gain: 0.15, from: 1046 },
      { type: "tone", wave: "triangle", t: 0.36, dur: 0.58, gain: 0.13, from: 262 },
      { type: "tone", wave: "triangle", t: 0.34, dur: 0.34, gain: 0.08, from: 1568, to: 2093 },
    ],
    1.05,
  ),
  // Thunder: a far-off roll, not a single boom. Three low-passed noise swells overlap and fade at
  // different speeds, with a faint crack up top; the low level keeps it behind the scene.
  thunder: recipe(
    [
      { type: "noise", t: 0, dur: 1.75, gain: 0.34, attack: 0.14, filter: { type: "lowpass", from: 300, to: 60, q: 0.6 } },
      { type: "noise", t: 0.3, dur: 1.5, gain: 0.3, attack: 0.2, filter: { type: "lowpass", from: 170, to: 45, q: 0.5 } },
      { type: "noise", t: 0.62, dur: 1.1, gain: 0.24, attack: 0.22, filter: { type: "lowpass", from: 110, to: 34, q: 0.5 } },
      { type: "noise", t: 0.04, dur: 0.4, gain: 0.08, attack: 0.03, filter: { type: "bandpass", from: 900, to: 180, q: 0.8 } },
      { type: "tone", wave: "triangle", t: 0.1, dur: 1.1, gain: 0.1, attack: 0.12, from: 58, to: 30 },
    ],
    1.15,
  ),
  // Ignite: two flint clicks, then the flame catching. The rising band-pass is the whoosh of the fire taking.
  ignite: recipe(
    [
      { type: "noise", t: 0, dur: 0.032, gain: 0.3, filter: { type: "highpass", from: 3200, to: 2400, q: 0.8 } },
      { type: "noise", t: 0.055, dur: 0.026, gain: 0.22, filter: { type: "highpass", from: 2600, to: 1500, q: 0.8 } },
      { type: "noise", t: 0.09, dur: 0.55, gain: 0.3, attack: 0.04, filter: { type: "bandpass", from: 480, to: 1750, q: 0.9 } },
      { type: "noise", t: 0.13, dur: 0.58, gain: 0.18, attack: 0.06, filter: { type: "lowpass", from: 900, to: 280, q: 0.6 } },
      { type: "tone", wave: "triangle", t: 0.1, dur: 0.3, gain: 0.12, attack: 0.03, from: 320, to: 190 },
    ],
    2,
  ),
  // Block: shield metal. Inharmonic square/triangle ring over a bright band-passed slap.
  block: recipe(
    [
      { type: "tone", wave: "square", t: 0, dur: 0.09, gain: 0.16, from: 1400 },
      { type: "tone", wave: "square", t: 0.004, dur: 0.07, gain: 0.12, from: 2093 },
      { type: "tone", wave: "triangle", t: 0, dur: 0.3, gain: 0.16, from: 2637 },
      { type: "tone", wave: "triangle", t: 0.008, dur: 0.19, gain: 0.09, from: 3520 },
      { type: "noise", t: 0, dur: 0.11, gain: 0.24, filter: { type: "bandpass", from: 3600, to: 1500, q: 2.4 } },
    ],
    1.1,
  ),
  // Rock hit: a dull thud in the body and a short gritty edge, no ring at all.
  rockHit: recipe(
    [
      { type: "noise", t: 0, dur: 0.22, gain: 0.36, filter: { type: "lowpass", from: 760, to: 140, q: 0.8 } },
      { type: "tone", wave: "triangle", t: 0, dur: 0.18, gain: 0.28, from: 122, to: 58 },
      { type: "tone", wave: "square", t: 0, dur: 0.08, gain: 0.12, from: 190, to: 80 },
      { type: "noise", t: 0.01, dur: 0.06, gain: 0.1, filter: { type: "bandpass", from: 1600, to: 700, q: 1.2 } },
    ],
    0.95,
  ),
};

export const SOUND_NAMES = Object.keys(SOUNDS);
export const durationOf = (name) => SOUNDS[name]?.dur ?? 0;

// ---- ambience data ---------------------------------------------------------------------------------
// A bed is a few filtered-noise layers (each with a slow sine on its gain so it breathes) plus an optional
// grain loop: "drip" is rain crackle, "cricket" is a field of chirps. Both the WebAudio builder and the offline
// renderer read this, so a change here is audible and visible in one go.
export const AMBIENCES = {
  forest: {
    layers: [
      { type: "bandpass", freq: 520, q: 0.7, gain: 0.2, lfo: 0.08, depth: 0.05 },
      { type: "lowpass", freq: 220, q: 0.5, gain: 0.12, lfo: 0.05, depth: 0.03 },
    ],
  },
  fire: {
    layers: [
      { type: "bandpass", freq: 1800, q: 0.9, gain: 0.16, lfo: 0.9, depth: 0.05 },
      { type: "lowpass", freq: 320, q: 0.6, gain: 0.14, lfo: 0.4, depth: 0.05 },
    ],
  },
  rain: {
    layers: [
      // the sheet of rain, a patter band, and the wet body of the downpour further off
      { type: "highpass", freq: 1500, q: 0.6, gain: 0.19, lfo: 0.13, depth: 0.04 },
      { type: "bandpass", freq: 2800, q: 0.9, gain: 0.1, lfo: 0.37, depth: 0.05 },
      { type: "lowpass", freq: 480, q: 0.5, gain: 0.09, lfo: 0.07, depth: 0.02 },
    ],
    grains: { kind: "drip", gain: 0.13, perSecond: 11 },
  },
  lake: {
    layers: [
      // slow lapping under the shore, a thin surface shimmer, and small wavelets over both
      { type: "lowpass", freq: 620, q: 0.9, gain: 0.16, lfo: 0.21, depth: 0.1 },
      { type: "bandpass", freq: 1700, q: 0.7, gain: 0.07, lfo: 0.09, depth: 0.04 },
      { type: "bandpass", freq: 950, q: 1.1, gain: 0.05, lfo: 0.55, depth: 0.04 },
    ],
    grains: { kind: "cricket", gain: 0.075, perSecond: 2.2 },
  },
};
export const AMBIENCE_MODES = Object.keys(AMBIENCES);
export const GRAIN_SECONDS = 3;
const GRAIN_SEED = { drip: 0x5a17, cricket: 0x2c09 };

// ---- offline preview ------------------------------------------------------------------------------
// The same recipes as plain samples, so tools and pictures can look at a sound without WebAudio.

export function renderSound(name, rate = 8000) {
  const sound = SOUNDS[name];
  if (!sound) return new Float32Array(0);
  const out = new Float32Array(Math.ceil(sound.dur * rate));
  const rand = mulberry32(0x8b17);
  for (const v of sound.voices) {
    const start = Math.round((v.t ?? 0) * rate), n = Math.ceil(v.dur * rate);
    const attack = Math.min(v.attack ?? 0.004, v.dur * 0.5);
    const state = { lp: 0, mid: 0, hp: 0 };
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const u = i / rate, k = Math.min(1, u / v.dur), env = envelopeAt(u, v, attack) * sound.level;
      let s;
      if (v.type === "noise") {
        s = filterSample(rand() * 2 - 1, v.filter, k, rate, state);
      } else {
        // exponential sweep, like WebAudio's exponentialRampToValueAtTime
        const f = v.to ? v.from * Math.pow(v.to / v.from, k) : v.from;
        phase = (phase + f / rate) % 1;
        s = waveSample(v.wave, phase);
      }
      out[start + i] += s * env;
    }
  }
  return out;
}

/**
 * Ambient beds as plain samples: layers of filtered noise with their slow gain LFO, plus the grain loop
 * (rain drips, crickets). Same data the WebAudio builder uses, so a snapshot shows the bed you hear.
 */
export function renderAmbience(mode, seconds = 2, rate = 8000) {
  const bed = AMBIENCES[mode];
  if (!bed) return new Float32Array(0);
  const n = Math.ceil(seconds * rate), out = new Float32Array(n);
  const rand = mulberry32(0x2f19);
  for (const layer of bed.layers) {
    const state = { lp: 0, mid: 0, hp: 0 };
    for (let i = 0; i < n; i++) {
      const s = filterSample(rand() * 2 - 1, layer, 0.5, rate, state);
      const lfo = layer.lfo ? Math.sin((i / rate) * Math.PI * 2 * layer.lfo) : 0;
      out[i] += s * (layer.gain + (layer.depth ?? 0) * lfo);
    }
  }
  if (bed.grains) {
    const grains = grainSamples(bed.grains, GRAIN_SECONDS, rate);
    for (let i = 0; i < n; i++) out[i] += grains[i % grains.length] * bed.grains.gain;
  }
  return out;
}

/** When the grains of a loop start, in seconds. Shared by the synth and the picture. */
export function grainTimes(grain, seconds = GRAIN_SECONDS) {
  const rand = mulberry32(GRAIN_SEED[grain.kind] ?? 0x1234);
  const count = Math.max(1, Math.round(seconds * (grain.perSecond ?? 4)));
  const times = [];
  for (let g = 0; g < count; g++) times.push(((g + rand() * 0.6) / count) * seconds);
  return times;
}

/** The looping grain loop: sparse drips or cricket chirps, deterministic per kind. */
export function grainSamples(grain, seconds = GRAIN_SECONDS, rate = 8000) {
  const out = new Float32Array(Math.ceil(seconds * rate));
  const rand = mulberry32((GRAIN_SEED[grain.kind] ?? 0x1234) ^ 0x9e37);
  const times = grainTimes(grain, seconds);
  for (let g = 0; g < times.length; g++) {
    const at = Math.min(out.length - 1, Math.floor(times[g] * rate));
    if (grain.kind === "cricket") {
      // a chirp is three short sine pulses at ~4 kHz, spaced like a field cricket
      const freq = 4000 + rand() * 700, pulse = Math.round(rate * 0.016), gap = Math.round(rate * 0.014);
      for (let p = 0; p < 3; p++) {
        const start = at + p * (pulse + gap);
        for (let j = 0; j < pulse && start + j < out.length; j++) {
          out[start + j] += Math.sin((j / rate) * Math.PI * 2 * freq) * Math.sin((j / pulse) * Math.PI) * 0.5;
        }
      }
    } else {
      // a drip: a tiny high ping with a click of noise on its front
      const freq = 1600 + rand() * 2400, len = Math.round(rate * 0.045), k = 0.6 + rand() * 0.4;
      for (let j = 0; j < len && at + j < out.length; j++) {
        const env = Math.exp(-j / (rate * 0.009));
        const click = j < rate * 0.004 ? (rand() * 2 - 1) * 0.5 : 0;
        out[at + j] += (Math.sin((j / rate) * Math.PI * 2 * freq) * 0.55 + click) * env * k;
      }
    }
  }
  return out;
}

function envelopeAt(u, v, attack) {
  if (u <= 0 || u >= v.dur) return 0;
  if (u < attack) return v.gain * (u / attack);
  const rate = Math.log(Math.max(v.gain, MIN_GAIN) / MIN_GAIN) / (v.dur - attack);
  return v.gain * Math.exp(-rate * (u - attack));
}

function waveSample(wave, p) {
  if (wave === "sine") return Math.sin(p * Math.PI * 2);
  if (wave === "triangle") return 1 - 4 * Math.abs(p - 0.5);
  if (wave === "sawtooth") return 2 * p - 1;
  return p < 0.5 ? 1 : -1;
}

function filterSample(x, filter, k, rate, state) {
  const type = filter?.type ?? "bandpass";
  const from = filter?.from ?? 1200, to = filter?.to ?? from;
  const cut = from * Math.pow(to / from, k);
  const a = 1 - Math.exp((-2 * Math.PI * cut) / rate);
  state.lp += a * (x - state.lp);
  if (type === "lowpass") return state.lp;
  if (type === "highpass") return x - state.lp;
  // band: low-pass twice, then high-pass once, around the moving cutoff. Crude, but enough to see.
  state.mid += a * (state.lp - state.mid);
  state.hp += a * (state.mid - state.hp);
  return state.mid - state.hp;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- WebAudio -------------------------------------------------------------------------------------

/** The browser's AudioContext, or null in Node, tests and very old browsers. */
function defaultContext() {
  try {
    const Ctor =
      (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) ||
      (typeof globalThis !== "undefined" && (globalThis.AudioContext || globalThis.webkitAudioContext));
    return Ctor ? new Ctor() : null;
  } catch {
    return null;
  }
}

function safeStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function readMuted(storage) {
  try {
    return storage?.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(storage, value) {
  try {
    storage?.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // private mode or a full quota: mute still works for this session
  }
}

const noiseBuffers = new WeakMap();
/** Two seconds of white noise per context, shared by every voice and the ambience beds. */
function noiseBuffer(ctx) {
  let buffer = noiseBuffers.get(ctx);
  if (buffer) return buffer;
  const rate = ctx.sampleRate || 44100, n = Math.max(1, Math.floor(rate * 2));
  buffer = ctx.createBuffer(1, n, rate);
  const data = buffer.getChannelData(0), rand = mulberry32(0x8b17);
  for (let i = 0; i < n; i++) data[i] = rand() * 2 - 1;
  noiseBuffers.set(ctx, buffer);
  return buffer;
}

function envelope(param, v, t, level) {
  const peak = Math.max(MIN_GAIN, v.gain * level);
  const attack = Math.min(v.attack ?? 0.004, v.dur * 0.5);
  param.setValueAtTime(MIN_GAIN, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(MIN_GAIN, t + v.dur);
}

function scheduleTone(ctx, dest, v, t0, level) {
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  const t = t0 + (v.t ?? 0), end = t + v.dur;
  osc.type = v.wave ?? "square";
  osc.frequency.setValueAtTime(v.from, t);
  if (v.to && v.to !== v.from) osc.frequency.exponentialRampToValueAtTime(v.to, end);
  envelope(gain.gain, v, t, level);
  osc.connect(gain).connect(dest);
  osc.start(t);
  osc.stop(end + 0.02);
}

function scheduleNoise(ctx, dest, v, t0, level) {
  const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
  const t = t0 + (v.t ?? 0), end = t + v.dur;
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  filter.type = v.filter?.type ?? "bandpass";
  filter.frequency.setValueAtTime(v.filter?.from ?? 1200, t);
  if (v.filter?.to) filter.frequency.exponentialRampToValueAtTime(v.filter.to, end);
  filter.Q.value = v.filter?.q ?? 1;
  envelope(gain.gain, v, t, level);
  src.connect(filter).connect(gain).connect(dest);
  src.start(t);
  src.stop(end + 0.02);
}

/** The quiet beds: wind in the trees, fire, rain, lakeside. Data lives in AMBIENCES. */
function buildAmbience(ctx, dest, mode) {
  const bed = AMBIENCES[mode];
  const sources = [], nodes = [];
  if (!bed) return { sources, nodes };
  for (const layer of bed.layers) {
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gainNode = ctx.createGain();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    filter.type = layer.type;
    filter.frequency.value = layer.freq;
    filter.Q.value = layer.q;
    gainNode.gain.value = 0;
    src.connect(filter).connect(gainNode).connect(dest);
    src.start();
    gainNode.gain.setTargetAtTime(layer.gain, ctx.currentTime, 1.5);
    if (layer.lfo) {
      const osc = ctx.createOscillator(), amount = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = layer.lfo;
      amount.gain.value = layer.depth ?? 0;
      osc.connect(amount).connect(gainNode.gain);
      osc.start();
      sources.push(osc);
      nodes.push(amount);
    }
    sources.push(src);
    nodes.push(filter, gainNode);
  }
  if (bed.grains) {
    // Drips and crickets: a looping buffer of grains, faded in like the layers.
    const rate = ctx.sampleRate || 44100, data = grainSamples(bed.grains, GRAIN_SECONDS, rate);
    const src = ctx.createBufferSource(), grainGain = ctx.createGain();
    const buffer = ctx.createBuffer(1, data.length, rate);
    buffer.getChannelData(0).set(data);
    src.buffer = buffer;
    src.loop = true;
    grainGain.gain.value = 0;
    src.connect(grainGain).connect(dest);
    src.start();
    grainGain.gain.setTargetAtTime(bed.grains.gain, ctx.currentTime, 1.5);
    sources.push(src);
    nodes.push(grainGain);
  }
  return { sources, nodes };
}

function stopAmbience(handle) {
  if (!handle) return;
  for (const s of handle.sources) {
    try {
      s.stop();
    } catch {
      // already stopped
    }
    try {
      s.disconnect();
    } catch {}
  }
  for (const n of handle.nodes) {
    try {
      n.disconnect();
    } catch {}
  }
}

/**
 * Create the sound system. Everything degrades to silence: without WebAudio (Node, tests, locked down
 * browsers) every call is a no-op and nothing throws.
 * options: { storage, createContext } override localStorage / AudioContext for tests.
 */
export function createSfx(options = {}) {
  const storage = options.storage === undefined ? safeStorage() : options.storage;
  const makeContext = options.createContext ?? defaultContext;
  const noop = () => {};

  let ctx = null, master = null;
  let muted = readMuted(storage);
  let ambienceWanted = null, ambienceHandle = null, ambienceMode = null;

  const ensure = () => {
    if (ctx) return ctx;
    try {
      ctx = makeContext() ?? null;
      if (!ctx) return null;
      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER;
      master.connect(ctx.destination);
      return ctx;
    } catch {
      ctx = null;
      master = null;
      return null;
    }
  };

  const unlock = () => {
    if (!ensure()) return false;
    try {
      if (ctx.state === "suspended" && typeof ctx.resume === "function") Promise.resolve(ctx.resume()).catch(noop);
    } catch {}
    if (ambienceWanted && !ambienceHandle) setAmbience(ambienceWanted);
    return true;
  };

  const play = (name) => {
    const sound = SOUNDS[name];
    if (!sound || muted || !ensure()) return;
    const t0 = ctx.currentTime + 0.006;
    for (const v of sound.voices) {
      try {
        if (v.type === "noise") scheduleNoise(ctx, master, v, t0, sound.level);
        else scheduleTone(ctx, master, v, t0, sound.level);
      } catch {
        // a browser refusing one node must never break the fight
      }
    }
  };

  const setMuted = (value) => {
    muted = !!value;
    writeMuted(storage, muted);
    if (!master || !ctx) return;
    try {
      master.gain.setTargetAtTime(muted ? 0 : MASTER, ctx.currentTime, 0.02);
    } catch {
      master.gain.value = muted ? 0 : MASTER;
    }
  };

  function setAmbience(next) {
    if (ambienceHandle) {
      stopAmbience(ambienceHandle);
      ambienceHandle = null;
      ambienceMode = null;
    }
    if (!next || !ensure()) return;
    try {
      ambienceHandle = buildAmbience(ctx, master, next);
      ambienceMode = next;
    } catch {
      ambienceHandle = null;
      ambienceMode = null;
    }
  }

  const ambience = (mode) => {
    const next = AMBIENCES[mode] ? mode : null;
    ambienceWanted = next;
    if (next === ambienceMode) return;
    if (!next) {
      setAmbience(null);
      return;
    }
    // No gesture yet: remember it, unlock() starts the bed once the context exists.
    if (!ctx || !master) return;
    setAmbience(next);
  };

  // Belt and braces: the first pointer or key press unlocks, even if the UI forgets to call unlock().
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    const onGesture = () => {
      try {
        document.removeEventListener("pointerdown", onGesture);
        document.removeEventListener("keydown", onGesture);
      } catch {}
      unlock();
    };
    try {
      document.addEventListener("pointerdown", onGesture, { passive: true });
      document.addEventListener("keydown", onGesture);
    } catch {}
  }

  return {
    unlock,
    play,
    setMuted,
    ambience,
    notify,
    requestPermission,
    get muted() {
      return muted;
    },
  };
}

// ---- notifications --------------------------------------------------------------------------------

let permissionAsked = false;

function currentPermission() {
  try {
    return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  } catch {
    return "denied";
  }
}

/**
 * Ask for notification permission. Call it from a click (browsers require a gesture) and at most once:
 * a second call before the prompt is answered just reports the current state.
 * @returns {Promise<NotificationPermission|"unsupported">}
 */
export function requestPermission() {
  let permission;
  try {
    if (typeof Notification === "undefined") return Promise.resolve("unsupported");
    permission = Notification.permission;
    if (permission !== "default" || permissionAsked) return Promise.resolve(permission);
    permissionAsked = true;
    const maybe = Notification.requestPermission();
    if (maybe && typeof maybe.then === "function") {
      return maybe.then(
        (p) => (typeof p === "string" ? p : currentPermission()),
        () => {
          permissionAsked = false;
          return currentPermission();
        },
      );
    }
    return Promise.resolve(currentPermission());
  } catch {
    permissionAsked = false;
    return Promise.resolve(currentPermission());
  }
}

/**
 * A desktop ping for the phase change, only while the tab is hidden and only with permission already
 * granted; permission is never asked from here. Never throws.
 * @returns {boolean} whether a notification was shown
 */
export function notify(title, body) {
  try {
    if (typeof document === "undefined" || !document.hidden) return false;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
    new Notification(title, { body, tag: "pomodoro8bit" });
    return true;
  } catch {
    return false;
  }
}
