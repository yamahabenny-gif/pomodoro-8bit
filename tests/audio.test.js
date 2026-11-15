import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createSfx,
  notify,
  requestPermission,
  renderSound,
  renderAmbience,
  AMBIENCES,
  AMBIENCE_MODES,
  SOUNDS,
  SOUND_NAMES,
  durationOf,
} from "../src/audio/sfx.js";

/** A localStorage stand-in; `map` is the visible payload. */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
  };
}

/** The smallest thing that satisfies the WebAudio calls sfx makes. */
function fakeContext() {
  const created = { oscillators: 0, sources: 0, gains: 0, filters: 0 };
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
  });
  const node = () => ({ connect: (next) => next, disconnect() {} });
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    state: "suspended",
    destination: node(),
    resume() {
      ctx.state = "running";
      return Promise.resolve();
    },
    createGain() {
      created.gains++;
      return { ...node(), gain: param() };
    },
    createOscillator() {
      created.oscillators++;
      return { ...node(), type: "square", frequency: param(), start() {}, stop() {} };
    },
    createBiquadFilter() {
      created.filters++;
      return { ...node(), type: "bandpass", frequency: param(), Q: { value: 0 }, start() {}, stop() {} };
    },
    createBufferSource() {
      created.sources++;
      return { ...node(), buffer: null, loop: false, start() {}, stop() {} };
    },
    createBuffer: (_channels, length) => ({ getChannelData: () => new Float32Array(length) }),
  };
  return { ctx, created };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sfx without WebAudio", () => {
  it("is a silent no-op and never throws", () => {
    const sfx = createSfx();
    expect(() => {
      sfx.unlock();
      for (const name of SOUND_NAMES) sfx.play(name);
      sfx.play("doesNotExist");
      sfx.setMuted(true);
      sfx.ambience("forest");
      sfx.ambience("fire");
      sfx.ambience("rain");
      sfx.ambience("lake");
      sfx.ambience("nonsense");
      sfx.ambience(null);
      sfx.setMuted(false);
    }).not.toThrow();
    expect(sfx.muted).toBe(false);
    expect(createSfx().unlock()).toBe(false);
    expect(durationOf("nope")).toBe(0);
  });
});

describe("mute persistence", () => {
  it("stores the flag and restores it into the next instance", () => {
    const storage = fakeStorage();
    const first = createSfx({ storage });
    expect(first.muted).toBe(false);
    first.setMuted(true);
    expect(first.muted).toBe(true);
    expect(storage.getItem("pomodoro8bit.muted")).toBe("1");
    expect(createSfx({ storage }).muted).toBe(true);
    first.setMuted(false);
    expect(storage.getItem("pomodoro8bit.muted")).toBe("0");
  });

  it("survives storage that throws (private mode)", () => {
    const storage = {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
    };
    const sfx = createSfx({ storage });
    expect(sfx.muted).toBe(false);
    expect(() => sfx.setMuted(true)).not.toThrow();
    expect(sfx.muted).toBe(true);
  });
});

describe("notify", () => {
  it("does nothing without permission, in a visible tab, or in Node", () => {
    const shown = [];
    class FakeNotification {
      static permission = "default";
      constructor(title, options) {
        shown.push({ title, options });
      }
    }
    vi.stubGlobal("Notification", FakeNotification);
    vi.stubGlobal("document", { hidden: true });
    expect(notify("Kampf vorbei", "Rast")).toBe(false);
    expect(shown).toHaveLength(0);

    FakeNotification.permission = "granted";
    vi.stubGlobal("document", { hidden: false });
    expect(notify("Kampf vorbei", "Rast")).toBe(false);
    expect(shown).toHaveLength(0);
  });

  it("shows one tagged notification in a hidden tab with permission", () => {
    const shown = [];
    class FakeNotification {
      static permission = "granted";
      constructor(title, options) {
        shown.push({ title, options });
      }
    }
    vi.stubGlobal("Notification", FakeNotification);
    vi.stubGlobal("document", { hidden: true });
    expect(notify("Kampf vorbei", "Kurze Rast: 5 Minuten.")).toBe(true);
    expect(shown).toHaveLength(1);
    expect(shown[0].title).toBe("Kampf vorbei");
    expect(shown[0].options).toMatchObject({ body: "Kurze Rast: 5 Minuten.", tag: "pomodoro8bit" });
  });

  it("never throws when the browser blocks notifications", () => {
    class BrokenNotification {
      static permission = "granted";
      constructor() {
        throw new Error("blocked");
      }
    }
    vi.stubGlobal("Notification", BrokenNotification);
    vi.stubGlobal("document", { hidden: true });
    expect(notify("x", "y")).toBe(false);
  });
});

describe("requestPermission", () => {
  it("asks at most once and reports the granted state", async () => {
    let calls = 0;
    class FakeNotification {
      static permission = "default";
      static requestPermission() {
        calls++;
        FakeNotification.permission = "granted";
        return Promise.resolve("granted");
      }
    }
    vi.stubGlobal("Notification", FakeNotification);
    expect(await requestPermission()).toBe("granted");
    expect(await requestPermission()).toBe("granted");
    expect(calls).toBe(1);
  });

  it("degrades to 'unsupported' without the API", async () => {
    vi.stubGlobal("Notification", undefined);
    expect(await requestPermission()).toBe("unsupported");
  });
});

describe("WebAudio scheduling", () => {
  it("plays every sound and both ambience beds through the context", () => {
    const { ctx, created } = fakeContext();
    const sfx = createSfx({ storage: fakeStorage(), createContext: () => ctx });
    expect(sfx.unlock()).toBe(true);
    for (const name of SOUND_NAMES) sfx.play(name);
    expect(created.gains).toBeGreaterThanOrEqual(SOUND_NAMES.length);
    expect(created.oscillators).toBeGreaterThan(0);
    expect(created.sources).toBeGreaterThan(0);
    expect(created.filters).toBeGreaterThan(0);

    for (const bed of AMBIENCE_MODES) {
      const before = created.sources;
      sfx.ambience(bed);
      expect(created.sources, bed).toBeGreaterThan(before); // the bed started
    }
    expect(() => sfx.ambience(null)).not.toThrow();
    expect(() => sfx.setMuted(true)).not.toThrow();
    expect(sfx.muted).toBe(true);
  });

  it("remembers an ambience request made before unlock", () => {
    const { ctx, created } = fakeContext();
    const sfx = createSfx({ storage: fakeStorage(), createContext: () => ctx });
    const before = created.sources;
    sfx.ambience("fire");
    expect(created.sources).toBe(before); // no context yet
    sfx.unlock();
    expect(created.sources).toBeGreaterThan(before);
  });
});

describe("sound design", () => {
  it("documents every sound with short, quiet voices", () => {
    expect(SOUND_NAMES).toEqual([
      "swing", "hit", "enemyDie", "hurt", "phaseFocus", "phaseBreak", "click",
      "levelUp", "thunder", "ignite", "block", "rockHit",
    ]);
    for (const [name, sound] of Object.entries(SOUNDS)) {
      expect(sound.dur, name).toBeGreaterThan(0);
      expect(sound.dur, name).toBeLessThan(2.2);
      expect(sound.level, name).toBeGreaterThanOrEqual(0.5);
      expect(sound.level, name).toBeLessThanOrEqual(3);
      for (const v of sound.voices) {
        expect(v.gain, name).toBeGreaterThan(0);
        expect(v.gain, name).toBeLessThanOrEqual(0.45);
        expect(v.t ?? 0, name).toBeGreaterThanOrEqual(0);
        expect(v.dur, name).toBeGreaterThan(0);
        if (v.type === "noise") expect(v.filter.from, name).toBeGreaterThan(100);
        else expect(v.from, name).toBeGreaterThan(20);
      }
    }
  });

  it("renders audible, deterministic waveforms offline", () => {
    for (const name of SOUND_NAMES) {
      const a = renderSound(name, 8000), b = renderSound(name, 8000);
      expect(a.length, name).toBe(Math.ceil(SOUNDS[name].dur * 8000));
      const peak = a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
      expect(peak, name).toBeGreaterThan(0.02);
      expect(peak, name).toBeLessThan(1.2);
      expect(Math.abs(a[0]), name).toBeLessThan(0.02); // starts from silence
      expect(Math.abs(a[a.length - 1]), name).toBeLessThan(0.02); // and ends there
      expect(a, name).toEqual(b);
    }
    expect(renderSound("nope")).toHaveLength(0);
  });
});

const peakOf = (samples) => samples.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

describe("wave 4 sounds", () => {
  it("level up is a rising arpeggio into a held chord", () => {
    const sound = SOUNDS.levelUp;
    expect(sound.dur).toBeGreaterThanOrEqual(0.9);
    expect(sound.dur).toBeLessThanOrEqual(1.1);
    const opening = sound.voices.filter((v) => v.type === "tone" && (v.t ?? 0) < 0.3);
    expect(opening.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < opening.length; i++) expect(opening[i].from).toBeGreaterThan(opening[i - 1].from);
    const chord = sound.voices.filter((v) => Math.abs((v.t ?? 0) - 0.36) < 0.02 && v.dur >= 0.4);
    expect(chord.length).toBeGreaterThanOrEqual(4); // a chord, not one long note
  });

  it("thunder is distant: long, low, slow and quieter than the fanfare", () => {
    const sound = SOUNDS.thunder;
    expect(sound.dur).toBeGreaterThanOrEqual(1.8);
    expect(sound.dur).toBeLessThanOrEqual(2.2);
    const noise = sound.voices.filter((v) => v.type === "noise");
    expect(noise.length).toBeGreaterThanOrEqual(2);
    for (const v of noise) {
      if (v.filter.type === "lowpass") expect(v.filter.to ?? v.filter.from).toBeLessThan(300);
      expect(v.attack ?? 0).toBeGreaterThan(0.02); // swells in, never snaps
    }
    expect(peakOf(renderSound("thunder"))).toBeLessThan(peakOf(renderSound("levelUp")) * 0.5);
  });

  it("ignite clicks the flint before the flame catches", () => {
    const sound = SOUNDS.ignite;
    const clicks = sound.voices.filter((v) => v.type === "noise" && v.dur <= 0.04 && (v.t ?? 0) < 0.1);
    expect(clicks.length).toBeGreaterThanOrEqual(2);
    for (const c of clicks) {
      expect(c.filter.type).toBe("highpass");
      expect(c.filter.from).toBeGreaterThan(2000);
    }
    expect(sound.voices.some((v) => v.type === "noise" && v.dur >= 0.4)).toBe(true);
  });

  it("block rings metal, rock hit stays dull", () => {
    const block = SOUNDS.block, rock = SOUNDS.rockHit;
    expect(block.voices.some((v) => v.type === "tone" && v.dur >= 0.25)).toBe(true); // a ring, not a click
    expect(block.voices.some((v) => v.type === "noise" && v.filter.from >= 2500)).toBe(true);
    for (const v of rock.voices) {
      if (v.type === "tone") expect(v.from).toBeLessThan(250);
      if (v.type === "noise") expect(v.filter.from).toBeLessThan(2000);
    }
  });
});

describe("wave 4 ambience", () => {
  it("has the two new beds next to forest and fire", () => {
    expect(AMBIENCE_MODES).toEqual(["forest", "fire", "rain", "lake"]);
    expect(AMBIENCES.rain.layers.some((l) => l.type === "highpass")).toBe(true);
    expect(AMBIENCES.rain.grains.kind).toBe("drip");
    expect(AMBIENCES.lake.grains.kind).toBe("cricket");
    expect(AMBIENCES.lake.layers.some((l) => (l.lfo ?? 1) < 0.3)).toBe(true); // slow lapping
  });

  it("renders every bed offline, deterministic and audible", () => {
    for (const mode of AMBIENCE_MODES) {
      const a = renderAmbience(mode, 2, 8000), b = renderAmbience(mode, 2, 8000);
      expect(a.length, mode).toBe(16000);
      expect(peakOf(a), mode).toBeGreaterThan(0.01);
      expect(peakOf(a), mode).toBeLessThan(1);
      expect(a, mode).toEqual(b);
    }
    expect(renderAmbience("nope")).toHaveLength(0);
  });
});
