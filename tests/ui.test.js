import { describe, it, expect } from "vitest";
import { PRESETS } from "../src/config/presets.js";
import { cycleMarks, formatTime, phaseLabel, presetLine } from "../src/ui/ui.js";

describe("formatTime", () => {
  it("prints mm:ss and rounds up so a running clock never shows 00:00 early", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(1)).toBe("00:01");
    expect(formatTime(999)).toBe("00:01");
    expect(formatTime(1_000)).toBe("00:01");
    expect(formatTime(59_000)).toBe("00:59");
    expect(formatTime(60_000)).toBe("01:00");
    expect(formatTime(65_432)).toBe("01:06");
    expect(formatTime(1_500_000)).toBe("25:00");
    expect(formatTime(3_600_000)).toBe("60:00");
    expect(formatTime(5_399_000)).toBe("89:59");
  });

  it("clamps nonsense to zero", () => {
    expect(formatTime(-1)).toBe("00:00");
    expect(formatTime(NaN)).toBe("00:00");
    expect(formatTime(undefined)).toBe("00:00");
    expect(formatTime("oops")).toBe("00:00");
  });
});

describe("phaseLabel", () => {
  it("names the three phases in German", () => {
    expect(phaseLabel("focus")).toBe("Kampf");
    expect(phaseLabel("short")).toBe("Rast");
    expect(phaseLabel("long")).toBe("Lange Rast");
  });

  it("has no label for unknown phases", () => {
    expect(phaseLabel("nope")).toBe("");
    expect(phaseLabel(undefined)).toBe("");
  });
});

describe("presetLine", () => {
  it("shows focus · short break · long break/cycle", () => {
    expect(presetLine(PRESETS[0])).toBe("25 · 5 · 20/4");
    expect(presetLine(PRESETS[2])).toBe("15 · 3 · 15/4");
  });

  it("omits the long break when the variant has none", () => {
    expect(presetLine(PRESETS[1])).toBe("52 · 17");
    expect(presetLine(null)).toBe("");
  });
});

describe("cycleMarks", () => {
  it("fills one pip per completed focus phase", () => {
    expect(cycleMarks(0, 4)).toEqual([false, false, false, false]);
    expect(cycleMarks(2, 4)).toEqual([true, true, false, false]);
    expect(cycleMarks(3, 4, "short")).toEqual([true, true, true, false]);
  });

  it("starts the next set after the long break", () => {
    expect(cycleMarks(4, 4)).toEqual([false, false, false, false]);
    expect(cycleMarks(5, 4)).toEqual([true, false, false, false]);
  });

  it("fills the whole set during a long break", () => {
    expect(cycleMarks(4, 4, "long")).toEqual([true, true, true, true]);
  });

  it("has no pips for variants without a long break", () => {
    expect(cycleMarks(3, null)).toEqual([]);
    expect(cycleMarks(3, 0)).toEqual([]);
  });

  it("guards against weird input", () => {
    expect(cycleMarks(undefined, 4)).toEqual([false, false, false, false]);
    expect(cycleMarks(-2, 4)).toEqual([false, false, false, false]);
    expect(cycleMarks(7.9, 4)).toEqual([true, true, true, false]);
  });
});
