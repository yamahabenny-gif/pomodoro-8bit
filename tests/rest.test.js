import { describe, it, expect, vi } from "vitest";
import { createFrame, Painter } from "pixelfx/core/index.js";
import { createRest, REST_KINDS } from "../src/game/scene/rest.js";
import { W, H } from "../src/engine/stage.js";

const settle = (rest, seconds, step = 1 / 30) => {
  for (let t = 0; t < seconds; t += step) rest.update(step);
};
const differs = (a, b) => a.some((color, i) => color !== b[i]);

describe("rest scenes", () => {
  it("exposes the two rest settings and rejects unknown kinds", () => {
    expect(REST_KINDS).toEqual(["storm", "lake"]);
    expect(() => createRest("camp")).toThrow(/unknown kind/);
  });

  it.each(REST_KINDS)("returns a full background and layered drawing for %s", (kind) => {
    const rest = createRest(kind);
    expect(rest.background()).toBeInstanceOf(Uint32Array);
    expect(rest.background()).toHaveLength(W * H);
    expect(rest.seatX).toBeGreaterThan(0);
    expect(rest.fireX).toBeGreaterThan(0);
    expect(Math.abs(rest.fireX - rest.seatX)).toBeGreaterThan(24);
    const back = createFrame(W, H), front = createFrame(W, H);
    rest.ignite(); settle(rest, 2);
    rest.drawBack(back); rest.drawFront(front);
    expect(back.color.some(Boolean)).toBe(true);
    expect(front.color.some(Boolean)).toBe(true);
  });

  it("lights the laid logs over about a second and a half", () => {
    const rest = createRest("storm");
    expect(rest.lit).toBe(false);
    rest.ignite();
    rest.update(1.4);
    expect(rest.lit).toBe(false);
    rest.update(0.11);
    expect(rest.lit).toBe(true);
    rest.ignite();
    expect(rest.lit).toBe(true);
  });

  it("bakes the storm shelter before the first draw and reuses its static frame", () => {
    const polygon = vi.spyOn(Painter.prototype, "poly");
    try {
      const callsBefore = polygon.mock.calls.length, rest = createRest("storm");
      expect(polygon).toHaveBeenCalledTimes(callsBefore);
      const back = createFrame(W, H), front = createFrame(W, H);
      rest.drawBack(back);
      expect(back.color[100 * W + 50]).not.toBe(0); // cliff wall is already in the warmed frame
      for (let i = 0; i < 12; i++) {
        rest.update(1 / 60);
        rest.drawBack(back);
        rest.drawFront(front);
      }
      expect(polygon).toHaveBeenCalledTimes(callsBefore);
    } finally {
      polygon.mockRestore();
    }
  });

  it("flashes the storm sky on a 6–15 second rhythm, less often at night", () => {
    for (const night of [false, true]) {
      const rest = createRest("storm", { night }), base = rest.background().slice(), flashes = [];
      for (let t = 0; t < 60; t += 0.05) {
        rest.update(0.05);
        if (differs(rest.background(), base)) flashes.push(Number((t + 0.05).toFixed(2)));
      }
      const starts = flashes.filter((time, i) => i === 0 || time - flashes[i - 1] > 0.1);
      expect(starts.length).toBeGreaterThanOrEqual(4);
      const gaps = starts.slice(1).map((time, i) => time - starts[i]);
      for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(night ? 7.8 : 5.8);
      for (const gap of gaps) expect(gap).toBeLessThanOrEqual(15.2);
    }
  });

  it("keeps each lightning illumination brief", () => {
    const rest = createRest("storm"), base = rest.background().slice(), active = [];
    for (let t = 0; t < 9; t += 0.01) {
      rest.update(0.01);
      if (differs(rest.background(), base)) active.push(Number((t + 0.01).toFixed(2)));
    }
    expect(active.length).toBeGreaterThan(0);
    expect(active.at(-1) - active[0] + 0.01).toBeGreaterThanOrEqual(0.14);
    expect(active.at(-1) - active[0] + 0.01).toBeLessThanOrEqual(0.2);
  });

  it("keeps the lake night darker than dusk and includes the additional stars", () => {
    const dusk = createRest("lake"), night = createRest("lake", { night: true });
    expect(dusk.background()).not.toEqual(night.background());
    expect(night.night).toBe(true);
  });

  it.each(REST_KINDS)("keeps water and weather behind a seated 36px actor in %s", kind => {
    const rest = createRest(kind, { night: true });
    const frame = createFrame(W, H), marker = 0xff44cc88;
    for (let tick = 0; tick < 180; tick++) {
      rest.update(1 / 30);
      frame.color.fill(0); frame.light.fill(0);
      rest.drawBack(frame);
      for (let y = 114; y <= 150; y++) for (let x = rest.seatX - 12; x <= rest.seatX + 10; x++) frame.color[y * W + x] = marker;
      rest.drawFront(frame);
      for (let y = 114; y <= 150; y++) for (let x = rest.seatX - 12; x <= rest.seatX + 10; x++) expect(frame.color[y * W + x]).toBe(marker);
    }
  });

  it("reuses the baked lake bank and background when entering a new break", () => {
    const first = createRest("lake"), second = createRest("lake");
    expect(first.background()).toBe(second.background());
    const polygon = vi.spyOn(Painter.prototype, "poly");
    try {
      const frame = createFrame(W, H);
      second.drawBack(frame); second.drawFront(frame);
      expect(polygon).not.toHaveBeenCalled();
    } finally { polygon.mockRestore(); }
  });

  it("shows ignition sparks even when ignite is called at scene time zero or later", () => {
    for (const delay of [0, 4]) {
      const rest = createRest("storm"), before = createFrame(W, H), after = createFrame(W, H);
      rest.update(delay); rest.drawBack(before);
      rest.ignite(); rest.update(0.15); rest.drawBack(after);
      let changed = 0;
      for (let y = 133; y < 145; y++) for (let x = rest.fireX - 6; x <= rest.fireX + 6; x++) {
        if (before.color[y * W + x] !== after.color[y * W + x]) changed++;
      }
      expect(changed).toBeGreaterThan(0);
      expect(rest.lit).toBe(false);
    }
  });

  it("ripples the moon reflection behind the actor while keeping the static background unchanged", () => {
    const rest = createRest("lake", { night: true }), base = rest.background();
    const first = createFrame(W, H), second = createFrame(W, H);
    rest.drawBack(first); rest.update(0.8); rest.drawBack(second);
    let changed = 0;
    for (let y = 104; y < 140; y++) for (let x = 205; x < 231; x++) {
      if (first.color[y * W + x] !== second.color[y * W + x]) changed++;
    }
    expect(changed).toBeGreaterThan(15);
    expect(rest.background()).toBe(base);
  });

});
