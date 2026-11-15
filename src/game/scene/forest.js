// CONTRACT (owned by issue "Wald & Lagerfeuer"). The forest at 320 x 180, parallax layers, floor at GROUND_Y.
//
// WAVE 4 (issue "Wald-Reise"): the fight look follows the journey reference: a deep dusk forest, purple-blue
// shadows against an orange sunset band, mist between the trunks, gnarled trees with roots, fallen logs, mushrooms,
// fireflies, and along the way a stream with a plank bridge. Breaks move to src/game/scene/rest.js; "camp"/"night"
// stay as a fallback.
//
// createForest() returns:
//   setMode(mode, { instant })   "fight" (day/afternoon, falling leaves) | "camp" (dusk, campfire lit,
//                                fireflies) | "night" (long break: stars, bigger fire). Crossfades ~1.5 s.
//   scroll(px)                   advance parallax (the heroine walks between fights)
//   update(dt)
//   background()                 Uint32Array(W*H) sky + far layers, the composite() background
//   drawBack(frame)              mid layers + campfire back layer: behind characters
//   drawFront(frame)             foreground grass/leaves + fire front layer: in front of characters
//   campfireX                    where the heroine sits in "camp"/"night"
//
// Everything time-based runs off update(dt); no setTimeout. The sky, far treeline and ground are baked once
// per mode and composited per far-layer offset, so a still camera costs nothing per frame.

import {
  createFrame, clearFrame, createFx, painterFor, backdrop, hex, mix, rand, clamp, TAU,
} from "../../../vendor/pixelfx/src/core/index.js";
import * as campfire from "../../../vendor/pixelfx/src/fx/fire/campfire.js";
import * as fireflies from "../../../vendor/pixelfx/src/fx/weather/fireflies.js";
import * as fallingLeaves from "../../../vendor/pixelfx/src/fx/weather/falling-leaves.js";
import * as godRays from "../../../vendor/pixelfx/src/fx/weather/god-rays.js";

// Same numbers as src/engine/stage.js. Duplicated so Node tools (tools/snap.mjs) can import this module
// without the Vite alias that stage.js uses.
const W = 320, H = 180, GROUND_Y = 150;

const MODES = ["fight", "camp", "night"];
const FADE_SECONDS = 1.5;
const CAMPFIRE_X = 228;

// parallax: pattern period in world px and the share of `scroll` each layer follows
const FAR_PERIOD = 480, FAR_SPEED = 0.16;
const MID_PERIOD = 480, MID_SPEED = 0.42;
const NEAR_PERIOD = 360, NEAR_SPEED = 0.72;
const FRONT_PERIOD = 240, FRONT_SPEED = 1.12;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
const mod = (v, m) => ((v % m) + m) % m;

// ---- palettes. Few flat tones per material, dark ink as outline; every mode shares the geometry, so a mode
// change can dissolve the colours on the same silhouettes.
const SKY = {
  fight: [
    [0, "#395d7e"], [0.42, "#6f93a0"], [0.6, "#93aa92"], [0.76, "#b6b184"], [0.9, "#d8c48e"], [1, "#e8d29c"],
  ],
  camp: [
    [0, "#241f3a"], [0.3, "#463c56"], [0.52, "#704858"], [0.7, "#a85c50"], [0.85, "#cc7a4e"], [1, "#ecaa62"],
  ],
};
const PAL = {
  fight: {
    ink: "#17121f",
    far: ["#33494a", "#3b5750", "#456258"],
    mist: "#b8c8ac",
    bark: "#3a2b22", barkLit: "#65462c", barkDark: "#241b17", moss: "#4c6a34",
    canopy: "#2f4a34", canopyLit: "#476c42",
    leafDark: "#2c4630", leafMid: "#3e6238", leafLit: "#5e8a44",
    stem: "#3a4a26",
    rockDark: "#43434e", rockMid: "#5c5c68", rockLit: "#7c7c88",
    grassDark: "#22321c", grassMid: "#44662c", grassTip: "#96b85a",
    flower: "#e8d05a",
  },
  camp: {
    ink: "#17121f",
    far: ["#2b2438", "#332b44", "#3d314c"],
    mist: "#a06a62",
    bark: "#342530", barkLit: "#6b4738", barkDark: "#211822", moss: "#4e5638",
    canopy: "#2a2a3c", canopyLit: "#403a50",
    leafDark: "#292f36", leafMid: "#3a4340", leafLit: "#58604a",
    stem: "#3a3830",
    rockDark: "#3a3646", rockMid: "#504a5a", rockLit: "#6c6276",
    grassDark: "#1e2426", grassMid: "#45502f", grassTip: "#b08a4a",
    flower: "#e8a05a",
  },
  night: {
    ink: "#0b0a12",
    far: ["#0f1424", "#14192b", "#1a2034"],
    mist: "#2a3350",
    bark: "#1c1f2a", barkLit: "#2f3648", barkDark: "#121522", moss: "#263632",
    canopy: "#151a28", canopyLit: "#222a3c",
    leafDark: "#141b24", leafMid: "#1f2a30", leafLit: "#30403f",
    stem: "#1e2824",
    rockDark: "#272b38", rockMid: "#363c4a", rockLit: "#4e5668",
    grassDark: "#0e141a", grassMid: "#24322c", grassTip: "#5e7a62",
    flower: "#8a9ac8",
  },
};
for (const mode of MODES) for (const [k, v] of Object.entries(PAL[mode])) PAL[mode][k] = Array.isArray(v) ? v.map(hex) : hex(v);
const SKY_STOPS = Object.fromEntries(MODES.filter((m) => SKY[m]).map((m) => [m, SKY[m].map(([t, c]) => [t, hex(c)])]));

const GROUND = {
  fight: {
    stops: ["#6a5a38", "#4a3a26", "#3a2e20", "#2a2116"],
    pebble: "#5e4e36", dark: "#211a12", litter: "#7a5a32", moss: "#4a5a30", clearing: "#4a3a28",
  },
  camp: {
    stops: ["#6a4a30", "#3f2e24", "#30251d", "#211a16"],
    pebble: "#4a3a2c", dark: "#191411", litter: "#6a4428", moss: "#3e3a28", clearing: "#4e3a28",
  },
  night: {
    stops: ["#2e3446", "#1e2028", "#171820", "#101117"],
    pebble: "#2e3340", dark: "#0c0d12", litter: "#2a2a30", moss: "#1e2a28", clearing: "#2a2a26",
  },
};
for (const g of Object.values(GROUND)) for (const [k, v] of Object.entries(g)) g[k] = Array.isArray(v) ? v.map(hex) : hex(v);
const CLEARING_X = CAMPFIRE_X;

// ---- layer geometry, same in every mode. Seeds are fixed, so a tree keeps its shape while it scrolls.
const MID_TREES = Array.from({ length: 4 }, (_, i) => {
  const R = (k) => rand(501, i, k);
  return {
    x: (i + 0.5) * (MID_PERIOD / 4) + (R(1) - 0.5) * 66,
    h: 98 + R(2) * 74,
    w: 7 + R(3) * 5,
    lean: (R(4) - 0.5) * 16,
    moss: R(5) < 0.6,
    branchSide: R(6) < 0.5 ? -1 : 1,
    branchAt: 0.62 + R(7) * 0.26,
    seed: 900 + i,
  };
});
const MID_SAPLINGS = Array.from({ length: 4 }, (_, i) => {
  const R = (k) => rand(551, i, k);
  return {
    x: (i + 0.5) * (MID_PERIOD / 4) + (R(1) - 0.5) * 70,
    h: 34 + R(2) * 30,
    r: 5 + R(3) * 5,
    seed: 950 + i,
  };
});
const CANOPY = Array.from({ length: 10 }, (_, i) => {
  const R = (k) => rand(521, i, k);
  return {
    x: (i + 0.5) * (MID_PERIOD / 10) + (R(1) - 0.5) * 22,
    y: -12 + R(2) * 9,
    r: 15 + R(3) * 13,
    lobes: Array.from({ length: 4 }, (_, j) => ({ dx: (rand(522, i, j) - 0.5) * 34, dy: 6 + rand(523, i, j) * 17, r: 7 + rand(524, i, j) * 8 })),
  };
});
const NEAR = ["bush", "bush", "fern", "rock", "bush", "mushrooms", "log", "fern"].map((type, i) => {
  const R = (k) => rand(601, i, k);
  const item = { type, x: (i + 0.5) * (NEAR_PERIOD / 8) + (R(1) - 0.5) * 34, seed: 700 + i };
  if (type === "bush") {
    item.w = 16 + R(2) * 14;
    item.h = 9 + R(3) * 9;
    item.lobes = Array.from({ length: 4 }, (_, j) => ({
      dx: (rand(602, i, j) - 0.5) * item.w,
      dy: (rand(603, i, j) - 0.5) * item.h * 0.7,
      r: 4 + rand(604, i, j) * 4.5,
    }));
    item.berry = R(5) < 0.4;
  } else if (type === "fern") {
    item.h = 14 + R(2) * 9;
    item.n = 4 + Math.floor(R(3) * 3);
  } else if (type === "rock") {
    item.w = 7 + R(2) * 7;
    item.h = 4 + R(3) * 4;
  } else if (type === "mushrooms") {
    item.n = 2 + Math.floor(R(2) * 3);
  } else if (type === "log") {
    item.w = 13 + R(2) * 9;
  }
  return item;
});
const BLADES = (() => {
  const out = [];
  // tufts of two or three blades, so the foreground reads as grass, not a picket fence
  for (let i = 0; i < 34; i++) {
    const R = (k) => rand(801, i, k);
    const tx = R(1) * FRONT_PERIOD, base = GROUND_Y + 9 + R(2) * 19;
    const n = 1 + Math.floor(R(3) * 3);
    for (let j = 0; j < n; j++) {
      const R2 = (k) => rand(802, i, j, k);
      out.push({
        x: tx + (j - (n - 1) / 2) * (1.6 + R2(1) * 2.6),
        base: base + R2(2) * 2,
        h: 5 + R2(3) * (13 + R2(4) * 14),
        phase: R2(5) * TAU,
        sway: 0.6 + R2(6) * 2.6,
        tone: Math.floor(R2(7) * 3),
      });
    }
  }
  // low scattered blades filling the gaps between tufts
  for (let i = 0; i < 46; i++) {
    const R = (k) => rand(803, i, k);
    out.push({
      x: R(1) * FRONT_PERIOD,
      base: GROUND_Y + 14 + R(2) * 15,
      h: 3 + R(3) * 8,
      phase: R(4) * TAU,
      sway: 0.5 + R(5) * 1.8,
      tone: Math.floor(R(6) * 3),
    });
  }
  return out;
})();

// draw an item at its world position wrapped into every copy that can be on stage
function copies(offset, period, span, x, fn) {
  const n0 = Math.floor((offset - span) / period), n1 = Math.floor((offset + W + span) / period);
  for (let n = n0; n <= n1; n++) fn(x + n * period - offset, n);
}

export function createForest() {
  let time = 0;
  let scrollX = 0;
  let mode = "fight";
  const weights = { fight: 1, camp: 0, night: 0 };
  const skyCache = {};
  const farCache = {};
  const midCache = {};
  const nearCache = {};
  const bgCache = new Map();
  let scratch = null;

  const fire = createFx(campfire, { x: CAMPFIRE_X, y: GROUND_Y, height: 20, seed: 5 });
  const flies = createFx(fireflies, {
    x: W / 2, y: H - 10, seed: 4, light: 1.3,
    grass: ["#070f0b", "#101c14", "#182a1e", "#243a28", "#345036", "#4a6a46"],
  });
  const leaves = createFx(fallingLeaves, { x: W / 2, y: GROUND_Y, seed: 8 });
  const rays = createFx(godRays, {
    x: W / 2, y: GROUND_Y, seed: 3, light: 0.45,
    palette: ["#5a7a88", "#6f8278", "#a09158", "#d0ac64", "#e8c47c", "#f6dca4", "#fff4d0"],
  });

  // ---- baked sky + ground, one buffer per mode
  function bakeSky(m) {
    const out = m === "night" ? backdrop("sky", W, H) : new Uint32Array(W * H);
    if (m !== "night") {
      const stops = SKY_STOPS[m];
      for (let y = 0; y < GROUND_Y; y++) {
        const t = y / (GROUND_Y - 1);
        let i = 0;
        while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
        const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
        const f = clamp((t - t0) / Math.max(1e-5, t1 - t0));
        const steps = 5, s = f * steps, k = Math.floor(s), fr = s - k;
        const row = y * W;
        for (let x = 0; x < W; x++) {
          const q = clamp((k + (fr > bay(x, y) ? 1 : 0)) / steps);
          out[row + x] = mix(c0, c1, q);
        }
      }
    }
    // low sun / sunset glow, dithered so it stays in the palette's steps
    if (m === "fight") glow(out, W / 2 - 150, -24, 120, hex("#f4e6b4"), 0.75);
    if (m === "camp") {
      glow(out, CAMPFIRE_X + 34, GROUND_Y + 2, 96, hex("#f0a05a"), 0.7);
      disc(out, 276, GROUND_Y - 12, 7, (d) => (d > 0.82 ? hex("#e8a05a") : hex("#ffd894")));
    }
    if (m === "night") {
      glow(out, 256, 62, 26, hex("#8a86b8"), 0.22);
      moon(out, 256, 62, 8);
      for (let i = 0; i < 7; i++) {
        const x = Math.floor(rand(911, i, 1) * W), y = Math.floor(rand(911, i, 2) * 118);
        if (Math.hypot(x - 256, y - 62) < 32) continue;
        out[y * W + x] = i < 4 ? hex("#ffffff") : hex("#cfc8ff");
        if (i < 4) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) set(out, x + dx, y + dy, hex("#8f8ac8"));
      }
    }
    if (m === "camp") for (let i = 0; i < 8; i++) set(out, Math.floor(rand(912, i, 1) * W), 8 + Math.floor(rand(912, i, 2) * 70), hex("#cfb8d8"));
    bakeGround(out, m);
    return out;
  }

  function bakeGround(out, m) {
    const g = GROUND[m], stops = g.stops;
    for (let y = GROUND_Y; y < H; y++) {
      const t = (y - GROUND_Y) / (H - GROUND_Y);
      const s = t * (stops.length - 1), k = Math.floor(s), fr = s - k;
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const q = clamp(k + (fr > bay(x, y) ? 1 : 0), 0, stops.length - 1);
        let c = stops[q];
        const r = rand(x >> 1, y, m === "fight" ? 21 : m === "camp" ? 22 : 23);
        if (r > 0.93) c = mix(c, g.pebble, 0.55);
        else if (r < 0.06) c = g.dark;
        // a worn dirt clearing around the fire pit
        if (m !== "fight") {
          const dx = (x - CLEARING_X) / 34, dy = (y - GROUND_Y - 2) / 6;
          const d = dx * dx + dy * dy;
          if (d < 1 && bay(x, y) > d * 0.9) c = mix(g.clearing, c, d * 0.7);
        }
        out[row + x] = c;
      }
    }
    // pebbles, roots and leaf litter
    for (let i = 0; i < 44; i++) {
      const x = Math.floor(rand(921, i, 1) * W), y = GROUND_Y + 2 + Math.floor(rand(921, i, 2) * (H - GROUND_Y - 3));
      const w = 1 + Math.floor(rand(921, i, 3) * 3), c = i % 3 ? g.pebble : g.litter;
      for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < (w > 2 ? 2 : 1); dy++) set(out, x + dx, y + dy, c);
      set(out, x, y, mix(c, g.dark, 0.4));
    }
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(rand(922, i, 1) * W), y = GROUND_Y + 1 + Math.floor(rand(922, i, 2) * 5);
      set(out, x, y, g.dark);
      if (i % 4 === 0) set(out, x + 1, y + 1, g.dark);
    }
    // a low grass fringe on the floor line: short tufts, not a dotted line
    for (let x = 0; x < W; x++) {
      const r = rand(923, x, m === "fight" ? 1 : m === "camp" ? 2 : 3);
      if (r > 0.55) set(out, x, GROUND_Y, mix(stops[0], g.moss, 0.3));
      if (r > 0.88) {
        set(out, x, GROUND_Y - 1, mix(stops[1], g.moss, 0.55));
        if (r > 0.96) set(out, x + 1, GROUND_Y - 2, g.moss);
      }
    }
    // flowers in the afternoon, a stone ring around the pit at dusk and night
    if (m === "fight") for (let i = 0; i < 9; i++) {
      const x = Math.floor(rand(924, i, 1) * W), y = GROUND_Y - 1 - Math.floor(rand(924, i, 2) * 3);
      set(out, x, y, PAL.fight.flower);
      set(out, x, y + 1, g.moss);
    }
    if (m !== "fight") for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU, x = Math.round(CLEARING_X + Math.cos(a) * (17 + (i & 1) * 3)), y = GROUND_Y + 2 + Math.round(Math.sin(a) * 3);
      set(out, x, y, i % 2 ? g.pebble : g.dark);
      set(out, x + 1, y, g.pebble);
    }
  }

  // ---- far treeline, baked once per mode as a seamless strip (the painter wraps the copies at +-period)
  function farFrame(m) {
    if (farCache[m]) return farCache[m];
    const f = createFrame(FAR_PERIOD, H);
    const p = painterFor(f);
    p.place(0, 0);
    const pal = PAL[m];
    const R = (i, k) => rand(431, i, k);
    // low understory so the horizon is not a hard line
    for (let i = 0; i < 20; i++) {
      const x = (i + 0.5) * (FAR_PERIOD / 20) + (R(i, 1) - 0.5) * 30, r = 5 + R(i, 2) * 10, y = GROUND_Y - 1 - R(i, 3) * 4;
      const c = pal.far[Math.floor(R(i, 4) * pal.far.length)];
      for (const dx of [-FAR_PERIOD, 0, FAR_PERIOD]) {
        p.circle(x + dx, y, r * 0.8, c);
        p.circle(x + dx - r * 0.5, y + 1, r * 0.55, c);
        p.circle(x + dx + r * 0.5, y + 1, r * 0.55, c);
      }
    }
    for (let i = 0; i < 12; i++) {
      const x = (i + 0.5) * (FAR_PERIOD / 12) + (R(i, 11) - 0.5) * 34;
      const h = 30 + R(i, 12) * 48, c = pal.far[Math.floor(R(i, 13) * pal.far.length)];
      const conifer = R(i, 14) < 0.72;
      for (const dx of [-FAR_PERIOD, 0, FAR_PERIOD]) {
        if (conifer) farConifer(p, x + dx, GROUND_Y, h, 9 + R(i, 15) * 10, c);
        else farTree(p, x + dx, GROUND_Y, h, 18 + R(i, 16) * 12, c);
      }
    }
    farCache[m] = f;
    return f;
  }

  // Build a mode's baked assets before the crossfade starts, so the fade itself never stalls on a bake.
  function warm(m) {
    if (!skyCache[m]) skyCache[m] = bakeSky(m);
    farFrame(m);
    midFrame(m);
    nearFrame(m);
    compose(m);
  }

  function compose(m) {
    const off = mod(Math.floor(scrollX * FAR_SPEED), FAR_PERIOD);
    const key = m + ":" + off;
    const hit = bgCache.get(key);
    if (hit) return hit;
    if (!skyCache[m]) skyCache[m] = bakeSky(m);
    const buf = skyCache[m].slice();
    const strip = farFrame(m).color;
    for (let y = 0; y < GROUND_Y; y++) {
      const row = y * W, srow = y * FAR_PERIOD;
      for (let x = 0; x < W; x++) {
        const c = strip[srow + ((x + off) % FAR_PERIOD)];
        if (c) buf[row + x] = c;
      }
    }
    bakeMist(buf, m);
    bgCache.set(key, buf);
    if (bgCache.size > 6) bgCache.delete(bgCache.keys().next().value);
    return buf;
  }

  function bakeMist(buf, m) {
    const mist = PAL[m].mist;
    for (let y = 112; y < GROUND_Y; y++) {
      const a = clamp((y - 112) / (GROUND_Y - 1 - 112));
      const k = a * a * 0.4, row = y * W;
      for (let x = 0; x < W; x++) if (bay(x, y) < k) buf[row + x] = mix(buf[row + x], mist, 0.22 + 0.3 * a);
    }
  }

  // ---- per-mode forest passes. Geometry is identical, only the palette moves.
  function eachMode(fn) {
    const active = MODES.filter((m) => weights[m] > 0.002).sort((a, b) => weights[b] - weights[a]);
    for (let i = 0; i < active.length; i++) {
      const m = active[i];
      fn(m, i === 0 ? 1 : weights[m]);
    }
  }

  // Static layers are baked once per mode into a seamless strip and blitted with the parallax offset,
  // so a mode change is just a dithered copy, not a redraw of every leaf.
  function wrapDraw(p, period, x, fn) {
    fn(x - period);
    fn(x);
    fn(x + period);
  }

  function midFrame(m) {
    if (midCache[m]) return midCache[m];
    const f = createFrame(MID_PERIOD, H);
    const p = painterFor(f);
    p.place(0, 0);
    const pal = PAL[m];
    // canopy hanging from the top edge: overlapping masses with a scalloped, leafy underside
    for (const c of CANOPY) wrapDraw(p, MID_PERIOD, c.x, (x) => {
      p.circle(x, c.y, c.r, pal.canopy);
      for (const l of c.lobes) {
        const lx = x + l.dx, ly = c.y + l.dy + c.r * 0.5;
        p.circle(lx, ly, l.r, pal.canopy);
        p.circle(lx - l.r * 0.3, ly + l.r * 0.15, l.r * 0.55, pal.canopyLit);
        p.dot(lx - l.r * 0.4, ly + l.r * 0.2, pal.leafLit);
      }
      for (let i = 0; i < 6; i++) {
        const dx = (rand(531, Math.round(c.x), i) - 0.5) * c.r * 1.7;
        const len = 2 + rand(532, Math.round(c.x), i) * 7;
        p.rect(x + dx, c.y + c.r * 0.7 + rand(533, Math.round(c.x), i) * 8, 1, len, i % 3 ? pal.canopy : pal.canopyLit);
      }
      // a few leaf tips biting into the sky along the underside
      for (let i = 0; i < 12; i++) {
        const lx = x + (rand(534, Math.round(c.x), i) - 0.5) * c.r * 1.9;
        const ly = c.y + c.r * 0.85 + rand(535, Math.round(c.x), i) * 7;
        p.px(lx, ly, i % 4 ? pal.canopy : pal.canopyLit);
        if (i % 3 === 0) p.px(lx + 1, ly + 1, pal.canopy);
      }
    });
    for (const t of MID_TREES) wrapDraw(p, MID_PERIOD, t.x, (x) => drawTrunk(p, t, x, pal));
    for (const s of MID_SAPLINGS) wrapDraw(p, MID_PERIOD, s.x, (x) => drawSapling(p, s, x, pal));
    // a few far bushes between the trunks
    for (let i = 0; i < 5; i++) {
      const x0 = (i + 0.5) * (MID_PERIOD / 5) + (rand(541, i, 1) - 0.5) * 44;
      wrapDraw(p, MID_PERIOD, x0, (x) => {
        const r = 6 + rand(541, i, 2) * 8;
        p.circle(x, GROUND_Y - r * 0.45, r * 0.8, pal.leafDark);
        p.circle(x - r * 0.6, GROUND_Y - r * 0.25, r * 0.5, pal.leafDark);
        p.circle(x + r * 0.55, GROUND_Y - r * 0.3, r * 0.5, pal.leafDark);
        p.circle(x - 1, GROUND_Y - r * 0.5, r * 0.45, pal.leafMid);
      });
    }
    midCache[m] = f;
    return f;
  }

  function nearFrame(m) {
    if (nearCache[m]) return nearCache[m];
    const f = createFrame(NEAR_PERIOD, H);
    const p = painterFor(f);
    p.place(0, 0);
    for (const item of NEAR) wrapDraw(p, NEAR_PERIOD, item.x, (x) => drawNearItem(p, item, x, PAL[m]));
    nearCache[m] = f;
    return f;
  }

  function blitStrip(frame, strip, off, alpha) {
    if (alpha <= 0.002) return;
    const C = frame.color, SC = strip.color, sw = strip.w, dith = alpha < 0.995;
    for (let y = 0; y < H; y++) {
      const row = y * W, srow = y * sw, by = (y & 3) << 2;
      for (let x = 0; x < W; x++) {
        let sx = x + off;
        if (sx >= sw) sx -= sw;
        const c = SC[srow + sx];
        if (!c) continue;
        if (!dith || alpha > BAYER[by | (x & 3)]) C[row + x] = c;
      }
    }
  }

  function drawGrassLayer(p, m, fade, t) {
    const pal = PAL[m];
    // effects share the frame's painter and leave their own origin behind
    p.place(0, 0);
    p.fade = fade;
    const off = mod(Math.floor(scrollX * FRONT_SPEED), FRONT_PERIOD);
    for (const b of BLADES) copies(off, FRONT_PERIOD, 24, b.x, (x) => {
      const sway = Math.sin(t * 1.5 + b.phase) * b.sway + Math.sin(t * 3.1 + b.phase * 2) * 0.5;
      for (let r = 0; r < b.h; r++) {
        const u = r / b.h;
        const px = Math.round(x + sway * u * u), py = Math.round(b.base - r);
        const c = u > 0.82 ? (b.tone === 0 ? pal.grassTip : pal.grassMid) : u > 0.4 ? pal.grassMid : pal.grassDark;
        p.px(px, py, c);
        if (b.tone === 0 && u < 0.55) p.px(px + 1, py, pal.grassDark);
        if (u > 0.3 && u < 0.7 && r % 3 === 0) p.px(px - 1, py + 1, pal.grassDark);
      }
      const tipX = Math.round(x + sway), tipY = Math.round(b.base - b.h);
      if (b.tone === 0 && b.h > 13) {
        p.px(tipX - 1, tipY + 1, pal.grassMid);
        p.px(tipX + 1, tipY + 2, pal.grassMid);
      }
      if (b.h > 18 && b.tone === 2) p.px(tipX, tipY - 1, pal.grassTip);
    });
    p.fade = 1;
  }

  // ---- campfire front layer: sparks and two low licks that pass in front of whoever sits there
  function drawFireFront(p, amount) {
    if (amount <= 0.01) return;
    p.place(0, 0);
    p.fade = amount;
    for (let i = 0; i < 4; i++) {
      const ph = rand(951, i, 1) * 8;
      const u = mod(time * 0.55 + rand(951, i, 2), 1);
      const x = CAMPFIRE_X + Math.sin(time * 1.4 + ph) * (3 + i * 2) + (i - 1.5) * 3;
      const y = GROUND_Y - 4 - u * (16 + i * 3);
      const c = u < 0.4 ? hex("#ffc23d") : u < 0.75 ? hex("#ff8a2a") : hex("#c9281f");
      if (u < 0.88) {
        p.px(x, y, c);
        p.glow(x, y, 4, c, 0.22 * (1 - u));
      }
    }
    const flick = 0.75 + 0.25 * Math.sin(time * 7.3) + 0.1 * Math.sin(time * 13.1);
    for (const [dx, h, w] of [[-5, 6, 2], [4, 8, 2.4]]) {
      const hh = h * flick;
      p.poly([[CAMPFIRE_X + dx - w, GROUND_Y + 1], [CAMPFIRE_X + dx + w, GROUND_Y + 1], [CAMPFIRE_X + dx, GROUND_Y + 1 - hh]], hex("#f2561d"));
      p.poly([[CAMPFIRE_X + dx - w * 0.45, GROUND_Y], [CAMPFIRE_X + dx + w * 0.45, GROUND_Y], [CAMPFIRE_X + dx, GROUND_Y - hh * 0.55]], hex("#ffc23d"));
    }
    p.fade = 1;
  }

  function drawFxAlpha(frame, fx, layer, alpha) {
    if (alpha <= 0.004) return;
    if (alpha >= 0.995) return fx.draw(frame, layer);
    if (!scratch) scratch = createFrame(W, H);
    clearFrame(scratch);
    fx.draw(scratch, layer);
    const C = frame.color, SC = scratch.color, L = frame.light, SL = scratch.light;
    for (let y = 0; y < H; y++) {
      const row = y * W, by = (y & 3) << 2;
      for (let x = 0; x < W; x++) {
        const i = row + x;
        const c = SC[i];
        if (c && alpha > BAYER[by | (x & 3)]) C[i] = c;
        const l = SL[i];
        if (l) {
          const d = L[i], k = alpha;
          const r = Math.min(255, (d & 255) + ((l & 255) * k | 0));
          const g = Math.min(255, ((d >>> 8) & 255) + (((l >>> 8) & 255) * k | 0));
          const b = Math.min(255, ((d >>> 16) & 255) + (((l >>> 16) & 255) * k | 0));
          L[i] = (255 << 24) | (b << 16) | (g << 8) | r;
        }
      }
    }
  }

  const api = {
    campfireX: CAMPFIRE_X,

    get mode() {
      return mode;
    },

    setMode(next, { instant = false } = {}) {
      if (!MODES.includes(next)) throw new Error(`createForest: unknown mode "${next}"`);
      if (next === mode) return;
      mode = next;
      if (instant) for (const m of MODES) weights[m] = m === next ? 1 : 0;
      warm(next);
    },

    scroll(px) {
      if (Number.isFinite(px)) scrollX += px;
    },

    update(dt) {
      if (!(dt > 0)) return;
      time += dt;
      const step = dt / FADE_SECONDS;
      let sum = 0;
      for (const m of MODES) {
        const target = m === mode ? 1 : 0;
        weights[m] = clamp(weights[m] + clamp(target - weights[m], -step, step));
        sum += weights[m];
      }
      if (sum > 0) for (const m of MODES) weights[m] /= sum;
      fire.update(dt);
      flies.update(dt);
      leaves.update(dt);
      rays.update(dt);
      const lit = clamp(weights.camp + weights.night);
      const nightShare = lit > 0 ? weights.night / lit : 0;
      fire.options.height = 20 + 15 * nightShare;
      fire.options.light = 0.95 + 0.35 * nightShare;
    },

    background() {
      const active = MODES.filter((m) => weights[m] > 0.002);
      if (active.length === 1) return compose(active[0]);
      const bufs = active.map((m) => [compose(m), weights[m]]).sort((a, b) => b[1] - a[1]);
      const out = new Uint32Array(W * H);
      const total = bufs.reduce((s, b) => s + b[1], 0) || 1;
      for (let y = 0; y < H; y++) {
        const row = y * W, by = (y & 3) << 2;
        for (let x = 0; x < W; x++) {
          const th = BAYER[by | (x & 3)];
          let acc = 0, c = bufs[bufs.length - 1][0][row + x];
          for (const [buf, w] of bufs) {
            acc += w / total;
            if (th < acc) { c = buf[row + x]; break; }
          }
          out[row + x] = c;
        }
      }
      return out;
    },

    drawBack(frame) {
      const p = painterFor(frame);
      p.place(0, 0);
      drawFxAlpha(frame, rays, "back", weights.fight * 0.42);
      const midOff = mod(Math.floor(scrollX * MID_SPEED), MID_PERIOD);
      const nearOff = mod(Math.floor(scrollX * NEAR_SPEED), NEAR_PERIOD);
      eachMode((m, fade) => blitStrip(frame, midFrame(m), midOff, fade));
      eachMode((m, fade) => blitStrip(frame, nearFrame(m), nearOff, fade));
      const lit = clamp(weights.camp + weights.night);
      if (lit > 0.01) {
        // a broad wash so the light channel warms the floor, trunks and bushes around the pit
        p.place(0, 0);
        p.glow(CAMPFIRE_X, GROUND_Y - 12, 120, hex("#ff8a2a"), 0.1 * lit);
        p.glow(CAMPFIRE_X, GROUND_Y - 4, 60, hex("#ffb04a"), 0.08 * lit);
        p.place(0, 0);
      }
      drawFxAlpha(frame, fire, "front", lit);
    },

    drawFront(frame) {
      const p = painterFor(frame);
      p.place(0, 0);
      drawFxAlpha(frame, rays, "front", weights.fight * 0.42);
      drawFxAlpha(frame, leaves, "front", weights.fight);
      drawFxAlpha(frame, flies, "front", clamp(weights.camp * 0.9 + weights.night));
      drawFireFront(p, clamp(weights.camp + weights.night));
      eachMode((m, fade) => drawGrassLayer(p, m, fade, time));
    },
  };
  return api;
}

// ---- shared tree shapes
function drawTrunk(p, t, x, pal) {
  const base = GROUND_Y + 2, top = base - t.h, w = t.w, tw = Math.max(2, w * 0.52);
  const tx = x + t.lean;
  p.ellipse(x, GROUND_Y + 2, w * 1.5, 2.4, pal.ink, 0.38);
  const ink = [[x - w / 2 - 1, base + 1], [x + w / 2 + 1, base + 1], [tx + tw / 2 + 1, top - 1], [tx - tw / 2 - 1, top - 1]];
  p.poly(ink, pal.ink);
  const body = [[x - w / 2, base], [x + w / 2, base], [tx + tw / 2, top], [tx - tw / 2, top]];
  p.poly(body, (px, py) => {
    const u = (px - x) / Math.max(1, w / 2);
    const v = (py - top) / Math.max(1, base - top);
    if (u > 0.4) return pal.barkDark;
    if (v > 0.86) return pal.barkDark;
    return pal.bark;
  });
  // lit left edge, broken up so it does not read as a stripe
  p.poly([[x - w / 2, base], [x - w / 2 + Math.max(1.4, w * 0.28), base], [tx - tw / 2 + Math.max(1.2, tw * 0.3), top], [tx - tw / 2, top]], (px, py) => {
    const r = rand(Math.round(px), Math.round(py / 9), t.seed);
    return r > 0.22 ? pal.barkLit : pal.bark;
  });
  // roots
  p.tri(x - w / 2, base - 2, x - w / 2 - Math.max(2, w * 0.5), base + 1, x - w / 2 + 1, base + 1, pal.bark);
  p.tri(x + w / 2, base - 2, x + w / 2 + Math.max(2, w * 0.5), base + 1, x + w / 2 - 1, base + 1, pal.barkDark);
  // a branch and its leaf clump
  const by = base - t.h * t.branchAt, dir = t.branchSide;
  const len = 16 + rand(t.seed, 1) * 18;
  p.poly([[x, by], [x, by - 3], [x + dir * len, by - 8 - len * 0.2], [x + dir * len, by - 5 - len * 0.2]], pal.barkDark);
  // leaves at the branch tip, so the bare stick reads as a bough
  const ex = x + dir * len, ey = by - 7 - len * 0.2, r = 2.4 + len * 0.07;
  p.circle(ex, ey, r + 0.8, pal.ink);
  p.circle(ex, ey, r * 0.9, pal.leafDark);
  p.circle(ex - r * 1.2, ey + r * 0.25, r * 0.62, pal.leafDark);
  p.circle(ex + r * 1.15, ey - r * 0.15, r * 0.6, pal.leafDark);
  p.circle(ex - r * 0.3, ey - r * 0.5, r * 0.55, pal.leafMid);
  p.dot(ex + r * 0.5, ey - r * 0.7, pal.leafLit);
  if (t.moss) {
    const m = base - t.h * 0.08;
    p.dot(x - w * 0.35, m, pal.moss);
    p.dot(x - w * 0.35 + 1, m + 1, pal.moss);
    p.dot(x - w * 0.5, m + 2, pal.moss);
  }
  for (let i = 0; i < 5; i++) {
    const yy = top + 12 + rand(t.seed, i, 2) * (t.h - 14);
    p.px(x - w * 0.18 + rand(t.seed, i, 3) * w * 0.35, yy, pal.ink);
    if (i % 2 === 0) p.px(x - w * 0.1 + rand(t.seed, i, 4) * w * 0.3, yy + 1, pal.ink);
  }
}

function drawSapling(p, s, x, pal) {
  const base = GROUND_Y + 2, top = base - s.h;
  p.ellipse(x, GROUND_Y + 2, 5, 1.6, pal.ink, 0.3);
  p.rect(x - 1, top, 3, s.h, pal.ink);
  p.rect(x, top + 2, 1, s.h - 3, pal.bark);
  p.px(x, top + 4, pal.barkLit);
  const dir = rand(s.seed, 9) < 0.5 ? -1 : 1, r = s.r;
  p.circle(x, top - 1, r + 0.8, pal.ink);
  p.circle(x, top - 1, r, pal.leafDark);
  p.circle(x - r * 0.9, top + r * 0.3, r * 0.66, pal.leafDark);
  p.circle(x + r * 0.95, top + r * 0.15, r * 0.6, pal.leafDark);
  p.circle(x - r * 0.35, top - r * 0.6, r * 0.55, pal.leafMid);
  p.circle(x + dir * r * 1.1, top - r * 0.15, r * 0.45, pal.leafMid);
  p.circle(x + r * 0.35, top + r * 0.45, r * 0.5, pal.leafMid);
  p.dot(x - r * 0.5, top - r * 0.5, pal.leafLit);
  p.dot(x + r * 0.55, top + r * 0.1, pal.leafLit);
  p.line(x, top + r * 0.8, x + dir * r * 0.8, top + r * 1.3, pal.barkDark);
}

function drawNearItem(p, item, x, pal) {
  const base = GROUND_Y + 2;
  if (item.type === "bush") {
    p.ellipse(x, base, item.w * 0.62, 2.2, pal.ink, 0.4);
    p.line(x, base, x - 1, base - item.h * 0.55, pal.stem);
    for (const l of item.lobes) {
      p.circle(x + l.dx, base - item.h * 0.45 + l.dy, l.r + 1, pal.ink);
      p.circle(x + l.dx, base - item.h * 0.45 + l.dy, l.r, pal.leafDark);
      p.circle(x + l.dx - l.r * 0.3, base - item.h * 0.45 + l.dy - l.r * 0.35, l.r * 0.52, pal.leafMid);
      p.dot(x + l.dx - l.r * 0.45, base - item.h * 0.45 + l.dy - l.r * 0.5, pal.leafLit);
    }
    if (item.berry) {
      for (let i = 0; i < 3; i++) p.px(x + (rand(item.seed, i, 1) - 0.5) * item.w, base - item.h * 0.4 - rand(item.seed, i, 2) * item.h * 0.4, i % 2 ? hex("#c83a44") : hex("#e86a4a"));
    }
  } else if (item.type === "fern") {
    p.ellipse(x, base, 7, 1.8, pal.ink, 0.3);
    for (let f = 0; f < item.n; f++) {
      const side = f % 2 ? 1 : -1, spread = 0.35 + (f % 3) * 0.22;
      const len = item.h * (0.65 + rand(item.seed, f, 1) * 0.35);
      let px = x, py = base - 1;
      for (let r = 1; r <= len; r++) {
        const u = r / len;
        px = x + side * Math.cos(spread) * len * u * u * 1.1;
        py = base - 1 - Math.sin(spread) * len * u;
        p.px(px, py, u > 0.6 ? pal.leafMid : pal.leafDark);
        if (r % 3 === 0 && u < 0.8) {
          p.px(px - side, py, pal.leafDark);
          p.px(px + side * 0.2, py - 1, pal.leafMid);
        }
      }
      p.px(px, py, pal.leafLit);
    }
    p.line(x, base, x, base - 3, pal.stem);
  } else if (item.type === "rock") {
    const w = item.w, h = item.h;
    p.poly([[x - w, base], [x - w * 0.75, base - h], [x + w * 0.2, base - h - 1], [x + w, base - h * 0.3], [x + w * 0.8, base]], pal.ink);
    p.poly([[x - w + 1, base - 1], [x - w * 0.7, base - h + 1], [x + w * 0.2, base - h], [x + w - 1, base - h * 0.3], [x + w * 0.7, base - 1]], pal.rockMid);
    p.poly([[x - w + 2, base - 1], [x - w * 0.68, base - h + 1], [x - w * 0.1, base - h + 1]], pal.rockLit);
    p.line(x - w * 0.3, base - 1, x + w * 0.4, base - h * 0.4, pal.rockDark);
  } else if (item.type === "mushrooms") {
    for (let i = 0; i < item.n; i++) {
      const mx = x + (i - (item.n - 1) / 2) * 5 + (rand(item.seed, i, 1) - 0.5) * 3;
      const h = 3 + rand(item.seed, i, 2) * 3, r = 2.5 + rand(item.seed, i, 3) * 2;
      p.rect(mx - 0.5, base - h, 2, h, pal.rockLit);
      p.ellipse(mx + 0.5, base - h, r, r * 0.65, i % 2 ? hex("#b83a32") : hex("#d05a38"));
      p.px(mx - 1, base - h - 1, hex("#f0c8a0"));
      p.px(mx + 1, base - h - 2, hex("#f0c8a0"));
    }
  } else if (item.type === "log") {
    const w = item.w;
    p.ellipse(x, base + 1, w * 0.58, 2.3, pal.ink, 0.4);
    p.rect(x - w / 2, base - 5, w, 5, pal.ink);
    p.rect(x - w / 2, base - 4, w, 3, pal.bark);
    p.line(x - w / 2 + 1, base - 4, x + w / 2 - 1, base - 4, pal.barkLit);
    p.ellipse(x + w / 2, base - 3, 1.8, 2.6, pal.barkLit);
    p.dot(x + w / 2, base - 3, pal.barkDark);
    p.rect(x - w * 0.2, base - 5, 4, 1, pal.moss);
    p.px(x - w * 0.1, base - 5, pal.leafMid);
  }
}

// ---- sky/tree helpers that write straight into a color buffer
function set(out, x, y, c) {
  x = Math.round(x); y = Math.round(y);
  if (x >= 0 && x < W && y >= 0 && y < H) out[y * W + x] = c;
}
function disc(out, cx, cy, r, color) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d <= 1) set(out, x, y, color(d));
    }
}
function glow(out, cx, cy, r, c, k) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d >= 1) continue;
      const a = (1 - d) * (1 - d) * k;
      if (bay(x, y) < a) out[y * W + x] = mix(out[y * W + x], c, 0.35 + 0.4 * (1 - d));
    }
}
function moon(out, cx, cy, r) {
  disc(out, cx, cy, r, (d) => (d > 0.86 ? hex("#c8c2e4") : d > 0.62 ? hex("#ddd8f2") : hex("#f0ecff")));
  set(out, cx - 3, cy - 2, hex("#c0bcdc"));
  set(out, cx - 2, cy - 2, hex("#c0bcdc"));
  set(out, cx + 3, cy + 2, hex("#c8c4e0"));
  set(out, cx + 2, cy + 3, hex("#c8c4e0"));
  set(out, cx + 4, cy - 3, hex("#d4d0ea"));
}
function farConifer(p, x, base, h, w, c) {
  p.rect(x - 1, base - 8, 2, 8, c);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const u = i / tiers, ty = base - 5 - (h - 6) * u;
    const half = (w * (1 - u) + 2) * 0.5 + 1;
    const th = (h / tiers) * 1.45;
    p.tri(x, ty - th, x - half, ty, x + half, ty, c);
  }
  p.tri(x, base - h - 2, x - 1, base - h + 4, x + 1, base - h + 4, c);
}
function farTree(p, x, base, h, w, c) {
  // a broad leafy mass that reaches the understory, no lollipop trunk
  const cy = base - h * 0.34, r = w * 0.55;
  for (const [dx, dy, rr] of [
    [0, -r * 0.7, r * 0.85], [-r * 0.95, -r * 0.3, r * 0.68], [r * 0.95, -r * 0.35, r * 0.7],
    [-r * 0.6, r * 0.35, r * 0.62], [r * 0.65, r * 0.3, r * 0.6], [0, r * 0.1, r * 0.85],
    [-r * 1.35, r * 0.25, r * 0.44], [r * 1.35, r * 0.2, r * 0.42], [0, r * 0.95, r * 0.6],
  ]) p.circle(x + dx, cy + dy, rr, c);
}
