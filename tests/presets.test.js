import { describe, it, expect } from "vitest";
import { PRESETS, presetById } from "../src/config/presets.js";

describe("presets", () => {
  it("offers three variants with positive durations", () => {
    expect(PRESETS).toHaveLength(3);
    for (const p of PRESETS) {
      expect(p.focus).toBeGreaterThan(0);
      expect(p.shortBreak).toBeGreaterThan(0);
      if (p.longBreakEvery) expect(p.longBreak).toBeGreaterThan(0);
    }
  });
  it("falls back to the classic preset", () => {
    expect(presetById("nope").id).toBe("classic");
  });
});
