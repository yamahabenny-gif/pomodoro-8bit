// CONTRACT (owned by issue "Sound & Benachrichtigung"). Synthesized 8-bit sounds with WebAudio, no files.
//
// createSfx() returns:
//   unlock()                     call on the first user gesture (browsers block audio before)
//   play(name)                   "swing" | "hit" | "enemyDie" | "hurt" | "phaseFocus" | "phaseBreak" | "click"
//   setMuted(bool), muted
//   ambience(mode)               "forest" | "fire" | null: soft looping noise beds, optional
// notify(title, body)            Notification API when the tab is hidden; asks permission once, from a click
//
// Additions, backwards compatible: createSfx({ storage, createContext }) injects a fake for tests; the instance
// also carries notify() and requestPermission(); requestPermission() is exported; renderSound(name) renders the
// same recipe offline (waveform art in docs/img/issue-7) and SOUNDS is the data both paths share.

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
};

export const SOUND_NAMES = Object.keys(SOUNDS);
export const durationOf = (name) => SOUNDS[name]?.dur ?? 0;

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

/** The two quiet noise beds: wind in the trees, and fire with a slow flicker. */
function buildAmbience(ctx, dest, mode) {
  const sources = [], nodes = [];
  const layer = ({ type, freq, q, gain, lfo, depth }) => {
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), bed = ctx.createGain();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    bed.gain.value = 0;
    src.connect(filter).connect(bed).connect(dest);
    src.start();
    bed.gain.setTargetAtTime(gain, ctx.currentTime, 1.5);
    if (lfo) {
      const osc = ctx.createOscillator(), amount = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = lfo;
      amount.gain.value = depth;
      osc.connect(amount).connect(bed.gain);
      osc.start();
      sources.push(osc);
      nodes.push(amount);
    }
    sources.push(src);
    nodes.push(filter, bed);
  };
  if (mode === "forest") {
    // wind: a wide low band that swells every dozen seconds
    layer({ type: "bandpass", freq: 520, q: 0.7, gain: 0.2, lfo: 0.08, depth: 0.05 });
    layer({ type: "lowpass", freq: 220, q: 0.5, gain: 0.12, lfo: 0.05, depth: 0.03 });
  } else {
    // fire: a hiss with a quick flicker and a low rumble under it
    layer({ type: "bandpass", freq: 1800, q: 0.9, gain: 0.16, lfo: 0.9, depth: 0.05 });
    layer({ type: "lowpass", freq: 320, q: 0.6, gain: 0.14, lfo: 0.4, depth: 0.05 });
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
    const next = mode === "forest" || mode === "fire" ? mode : null;
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
