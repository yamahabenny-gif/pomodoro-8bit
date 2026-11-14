import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createSfx,
  notify,
  requestPermission,
  renderSound,
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

    const beforeForest = created.sources;
    sfx.ambience("forest");
    expect(created.sources).toBeGreaterThan(beforeForest); // the bed started
    const afterForest = created.sources;
    sfx.ambience("fire");
    expect(created.sources).toBeGreaterThan(afterForest);
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
  it("documents all seven sounds with short, quiet voices", () => {
    expect(SOUND_NAMES).toEqual(["swing", "hit", "enemyDie", "hurt", "phaseFocus", "phaseBreak", "click"]);
    for (const [name, sound] of Object.entries(SOUNDS)) {
      expect(sound.dur, name).toBeGreaterThan(0);
      expect(sound.dur, name).toBeLessThan(1.4);
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
