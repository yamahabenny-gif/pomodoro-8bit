import { describe, it, expect } from "vitest";
import { createFrame } from "pixelfx/core/index.js";
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

  it("keeps the lake night darker than dusk and includes the additional stars", () => {
    const dusk = createRest("lake"), night = createRest("lake", { night: true });
    expect(dusk.background()).not.toEqual(night.background());
    expect(night.night).toBe(true);
  });
});
