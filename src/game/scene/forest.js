// CONTRACT (owned by issue "Wald & Lagerfeuer"). The forest at 320 x 180, parallax layers, floor at GROUND_Y.
//
// WAVE 4 (issue "Wald-Reise"): the fight look follows the journey reference: a deep dusk forest, purple-blue
// shadows against an orange sunset band, mist between the trunks, gnarled trees with roots, fallen logs, mushrooms,
// fireflies, and along the way a stream with a plank bridge. Breaks move to src/game/scene/rest.js; "camp"/"night"
// stay as a fallback.
//
// createForest() returns:
//   setMode(mode, { instant })   "fight" (dusk, drifting fog) | "camp" (dusk, campfire lit,
//                                fireflies) | "night" (long break: stars, bigger fire). Crossfades ~1.5 s.
//   scroll(px)                   advance parallax (the heroine walks between fights)
//   update(dt)
//   background()                 Uint32Array(W*H) sky + far layers, the composite() background
//   drawBack(frame)              mid layers + campfire back layer: behind characters
//   drawFront(frame)             low grass (y >= 148) + fallback campfire front, never fight mist/trees
//   campfireX                    where the heroine sits in "camp"/"night"
//
// Everything time-based runs off update(dt); no setTimeout. The sky, far treeline and ground are baked once
// per mode and composited per far-layer offset, so a still camera costs nothing per frame.

import {
  createFrame, clearFrame, createFx, painterFor, backdrop, hex, mix, rand, clamp, TAU,
} from "../../../vendor/pixelfx/src/core/index.js";
import * as campfire from "../../../vendor/pixelfx/src/fx/fire/campfire.js";
import * as fireflies from "../../../vendor/pixelfx/src/fx/weather/fireflies.js";

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
const JOURNEY_PERIOD = FAR_PERIOD * 3;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
const mod = (v, m) => ((v % m) + m) % m;

// ---- palettes. Few flat tones per material, dark ink as outline; every mode shares the geometry, so a mode
// change can dissolve the colours on the same silhouettes.
const SKY = {
  fight: [
    [0, "#11152f"], [0.3, "#322746"], [0.49, "#66425b"], [0.60, "#ae634d"], [0.73, "#dc8c4e"], [0.84, "#bd704d"], [1, "#41405a"],
  ],
  camp: [
    [0, "#241f3a"], [0.3, "#463c56"], [0.52, "#704858"], [0.7, "#a85c50"], [0.85, "#cc7a4e"], [1, "#ecaa62"],
  ],
};
const PAL = {
  fight: {
    ink: "#17121f",
    far: ["#302c4c", "#463653", "#64445f"],
    mist: "#6a7894",
    bark: "#302c35", barkLit: "#785945", barkDark: "#191c2d", moss: "#4a5740",
    canopy: "#0e132a", canopyLit: "#252d3c",
    leafDark: "#11162b", leafMid: "#303c3c", leafLit: "#9a7047",
    stem: "#393443",
    rockDark: "#393746", rockMid: "#514c5d", rockLit: "#736675",
    grassDark: "#192c30", grassMid: "#46583e", grassTip: "#918353",
    flower: "#d99b59",
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
    stops: ["#3c332f", "#2b252a", "#171724", "#0f1220"],
    pebble: "#514744", dark: "#17151d", litter: "#624536", moss: "#414333", clearing: "#3e3535",
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
const MID_TREES = Array.from({ length: 5 }, (_, i) => {
  const R = (k) => rand(501, i, k);
  return {
    x: (i + 0.5) * (MID_PERIOD / 5) + (R(1) - 0.5) * 18,
    lean: (R(4) - 0.5) * 24,
    seed: 900 + i,
  };
});
const NEAR = ["fern", "log", "fern", "rock", "fern", "mushrooms", "log", "fern"].map((type, i) => {
  const R = (k) => rand(601, i, k);
  const item = { type, x: (i + 0.5) * (NEAR_PERIOD / 8) + (R(1) - 0.5) * 34, seed: 700 + i };
  if (type === "fern") {
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
    const tx = R(1) * FRONT_PERIOD, base = GROUND_Y + 2 + R(2) * 5;
    const n = 1 + Math.floor(R(3) * 3);
    for (let j = 0; j < n; j++) {
      const R2 = (k) => rand(802, i, j, k);
      out.push({
        x: tx + (j - (n - 1) / 2) * (1.6 + R2(1) * 2.6),
        base: base + R2(2) * 2,
        h: 2 + R2(3) * 5,
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
      base: GROUND_Y + 2 + R(2) * 5,
      h: 2 + R(3) * 4,
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
  const trunkCache = {};
  const bgCache = new Map();
  let journeyCache = null;
  let scratch = null;

  const fire = createFx(campfire, { x: CAMPFIRE_X, y: GROUND_Y, height: 20, seed: 5 });
  const flies = createFx(fireflies, {
    x: W / 2, y: H - 10, seed: 4, light: 1.3,
    palette: ["#3d2818", "#8d4d25", "#d58031", "#f1b64d", "#ffe18a", "#fff4c0"],
    grass: ["#090b13", "#141824", "#20232f", "#2a3038", "#3a413c", "#555340"],
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
          const q = m === "fight" ? Math.round(f * 8) / 8 : clamp((k + (fr > bay(x, y) ? 1 : 0)) / steps);
          out[row + x] = mix(c0, c1, q);
        }
      }
    }
    // The fight sunset is carried by the sky gradient; an extra glow would clip against the floor edge.
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
        const q = clamp(k + (fr > (m === "fight" ? rand(920, x >> 2, y >> 1) : bay(x, y)) ? 1 : 0), 0, stops.length - 1);
        let c = stops[q];
        const r = rand(x >> 1, m === "fight" ? y >> 1 : y, m === "fight" ? 21 : m === "camp" ? 22 : 23);
        if (r > 0.96) c = mix(c, g.pebble, 0.55);
        else if (r < 0.03) c = g.dark;
        // a worn dirt clearing around the fire pit
        if (m !== "fight") {
          const dx = (x - CLEARING_X) / 34, dy = (y - GROUND_Y - 2) / 6;
          const d = dx * dx + dy * dy;
          if (d < 1 && bay(x, y) > d * 0.9) c = mix(g.clearing, c, d * 0.7);
        }
        out[row + x] = c;
      }
    }
    if (m === "fight") {
      for (let x = 0; x < W; x++) {
        const depth = 5 + Math.floor(rand(925, x >> 1) * 4);
        for (let y = GROUND_Y; y < GROUND_Y + depth; y++) {
          const c = y < GROUND_Y + 2 ? PAL[m].grassTip : y < GROUND_Y + 5 ? PAL[m].grassMid : PAL[m].grassDark;
          set(out, x, y, rand(926, x, y) < 0.22 ? g.moss : c);
        }
      }
    }
    if (m === "fight") for (let i = 0; i < 50; i++) {
      const x = Math.floor(rand(927, i, 1) * W), y = 159 + Math.floor(rand(927, i, 2) * 7);
      const c = i % 3 ? g.pebble : g.moss;
      for (const [dx, dy] of [[0, 0], [1, -1], [2, -1], [3, 0], [1, 1]]) set(out, x + dx, y + dy, c);
      set(out, x + 1, y + 2, g.dark);
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
    // Overlapping broadleaf silhouettes: distant crowns have no outlines or bark detail.
    for (let layer = 2; layer >= 0; layer--) {
      for (let i = 0; i < 14; i++) {
        const x = i * FAR_PERIOD / 14 + R(i + layer * 30, 11) * 18;
        const h = 85 + R(i + layer * 30, 12) * 45;
        for (const dx of [-FAR_PERIOD, 0, FAR_PERIOD]) {
          drawFarSilhouette(p, x + dx, 142 - layer * 3, h, 1.8 + R(i, 14) * 1.8,
            pal.far[layer], R(i, 15) * 15 - 7);
        }
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
    trunkFrame(m);
    compose(m);
  }

  function compose(m) {
    const off = mod(Math.floor(scrollX * FAR_SPEED), FAR_PERIOD);
    const journeyOff = m === "fight" ? mod(Math.floor(scrollX * FAR_SPEED), JOURNEY_PERIOD) : 0;
    const key = m + ":" + off + ":" + journeyOff;
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
    if (m === "fight") blitJourneyGround(buf, journeyOff);
    bakeMist(buf, m);
    bgCache.set(key, buf);
    if (bgCache.size > 6) bgCache.delete(bgCache.keys().next().value);
    return buf;
  }

  function buildJourney() {
    if (journeyCache) return journeyCache;
    const f = createFrame(JOURNEY_PERIOD, H), p = painterFor(f);
    p.place(0, 0);
    const ink = hex("#17121f"), water = [hex("#111626"), hex("#222b40"), hex("#30394d")];
    const moss = hex("#526341"), mossLight = hex("#71804c"), bark = hex("#56392c");
    // Fallen wood rests along the bank, with a split cut end and broken limbs.
    p.poly([[58, 151], [59, 144], [65, 139], [70, 144], [97, 146], [110, 142],
      [107, 148], [111, 152]], ink);
    p.poly([[62, 149], [63, 143], [69, 146], [97, 148], [104, 146], [103, 151]], bark);
    p.line(66, 146, 98, 149, hex("#8a6546"));
    p.line(67, 148, 91, 151, hex("#211d27"));
    p.line(83, 147, 79, 141, bark);
    p.line(79, 141, 76, 139, hex("#8a6546"));
    p.poly([[64, 149], [67, 147], [71, 148], [69, 150]], ink);
    p.line(92, 147, 101, 147, moss);
    const sx = 176;
    p.poly([[sx - 19, 153], [sx - 7, 143], [sx - 4, 127], [sx, 134], [sx + 6, 130],
      [sx + 9, 122], [sx + 11, 139], [sx + 8, 149], [sx + 20, 155]], ink);
    p.poly([[sx - 13, 152], [sx - 3, 142], [sx - 2, 133], [sx + 2, 137],
      [sx + 7, 131], [sx + 7, 143], [sx + 3, 150]], bark);
    p.line(sx - 1, 137, sx - 6, 149, hex("#997348"));
    p.line(sx + 5, 138, sx + 2, 145, hex("#2b2026"));
    p.line(sx - 13, 151, sx - 5, 149, moss);
    p.line(sx - 15, 152, sx - 8, 150, mossLight);
    const stumpX = FAR_PERIOD + 210;
    // The middle stretch opens into a mossy glade with a stump, fungi and a low fallen log.
    p.ellipse(stumpX + 28, GROUND_Y + 1, 25, 3, ink, 0.7);
    p.poly([[stumpX + 13, 151], [stumpX + 16, 144], [stumpX + 20, 140], [stumpX + 36, 140], [stumpX + 41, 145], [stumpX + 44, 151]], ink);
    p.poly([[stumpX + 16, 150], [stumpX + 19, 145], [stumpX + 22, 142], [stumpX + 35, 142], [stumpX + 39, 146], [stumpX + 41, 150]], bark);
    p.ellipse(stumpX + 28, 142, 8, 2.4, hex("#8c6844"), 0.9);
    p.line(stumpX + 21, 142, stumpX + 35, 142, hex("#b58a54"));
    p.line(stumpX - 35, 151, stumpX + 3, 149, ink);
    p.line(stumpX - 34, 149, stumpX + 2, 147, hex("#563b2a"));
    for (const [groupX, n] of [[270, 4], [stumpX - 22, 5]]) {
      for (let i = 0; i < n; i++) {
        const x = groupX + i * 5, h = 3 + rand(883, groupX, i) * 3;
        const cap = i % 2 ? hex("#bd6741") : hex("#9b5036");
        p.line(x, 150, x, 150 - h, hex("#bca17a"));
        p.poly([[x - 2, 150 - h], [x - 2, 149 - h], [x - 1, 148 - h], [x + 2, 148 - h], [x + 3, 149 - h], [x + 3, 150 - h]], ink);
        p.poly([[x - 1, 149 - h], [x, 148 - h], [x + 2, 148 - h], [x + 2, 149 - h]], cap);
        p.px(x, 148 - h, hex("#e4a067"));
      }
    }
    // A stream occupies the last stretch; its banks meet the floor on both sides.
    const riverX = FAR_PERIOD * 2 + 125, riverW = 180;
    p.rect(riverX, 154, riverW, H - 154, water[0]);
    for (let i = 0; i < 26; i++) {
      const x = riverX + 5 + rand(881, i, 1) * (riverW - 10);
      const y = 156 + rand(881, i, 2) * 22;
      const w = 2 + rand(881, i, 3) * 10;
      p.line(x, y, x + w, y, water[i % 3]);
      if (i % 3 === 0) p.line(x + 1, y + 1, x + w * 0.55, y + 1, hex("#586176"));
    }
    // Broken tree silhouettes ripple in the dark stream below the bridge.
    for (let i = 0; i < 7; i++) {
      const x = riverX + 10 + i * 31, y = 162 + (i % 3) * 4;
      p.line(x, y, x + 3, y - 4, hex("#171d2d"));
      p.line(x + 3, y - 4, x + 7, y - 3, hex("#171d2d"));
      p.line(x + 3, y - 4, x + 2, y - 7, hex("#171d2d"));
    }
    p.poly([[riverX - 8, 154], [riverX + 1, 150], [riverX + 18, 151], [riverX + 24, 154]], moss);
    p.poly([[riverX + riverW - 24, 154], [riverX + riverW - 18, 151], [riverX + riverW - 1, 150], [riverX + riverW + 8, 154]], moss);
    p.line(riverX - 4, 151, riverX + 16, 151, mossLight);
    p.line(riverX + riverW - 16, 151, riverX + riverW + 4, 151, mossLight);
    for (const x of [riverX + 2, riverX + riverW - 3]) {
      p.ellipse(x, 154, 8, 2, ink, 0.8);
      p.px(x - 4, 151, hex("#72705c")); p.px(x + 2, 150, hex("#4f4d48"));
    }
    const bridgeX = riverX + 24, bridgeW = 132;
    // Each board is separate, with dark gaps, end grain and a slightly uneven edge.
    for (let i = 0; i < 14; i++) {
      const x = bridgeX + i * 9, y = 145 + (i % 4 === 0 ? 1 : 0), shade = i % 3;
      p.rect(x, y, 8, 5, ink);
      p.rect(x + 1, y + 1, 6, 3, [hex("#81563c"), hex("#946343"), hex("#704936")][shade]);
      p.line(x + 2, y + 1, x + 5, y + 1, hex("#b37a4d"));
      p.px(x + 2, y + 3, hex("#4f352e"));
    }
    // Rail posts and sagging rope keep the crossing readable at native size.
    const postStep = (bridgeW - 6) / 4;
    for (let i = 0; i <= 4; i++) {
      const x = bridgeX + 3 + i * postStep;
      p.rect(x - 2, 135, 5, 13, ink);
      p.rect(x - 1, 136, 2, 10, bark);
      p.px(x - 1, 136, hex("#a2754a"));
    }
    for (let i = 0; i < 4; i++) {
      const x0 = bridgeX + 3 + i * postStep, x1 = x0 + postStep;
      p.line(x0, 137, x0 + postStep * 0.25, 140, hex("#32252b"));
      p.line(x0 + postStep * 0.25, 140, x0 + postStep * 0.75, 140, hex("#32252b"));
      p.line(x0 + postStep * 0.75, 140, x1, 137, hex("#32252b"));
      p.px(x0 + 8, 139, hex("#725138"));
    }
    journeyCache = f;
    return f;
  }

  function blitJourneyGround(buf, off) {
    const strip = buildJourney().color;
    for (let y = GROUND_Y; y < H; y++) {
      const row = y * W, srow = y * JOURNEY_PERIOD;
      for (let x = 0; x < W; x++) {
        const c = strip[srow + ((x + off) % JOURNEY_PERIOD)];
        if (c) buf[row + x] = c;
      }
    }
  }

  function drawFightMist(p) {
    p.place(0, 0);
    // Continuous alpha volumes, never ordered dither; all mist is behind actors.
    for (let x = 0; x < W; x++) {
      const wx = x + scrollX * FAR_SPEED;
      const center = 130 + Math.sin(wx * 0.035 - time * 0.12) * 6
        + Math.sin(wx * 0.071 + 1.4) * 2;
      const density = 0.30 + 0.18 * Math.sin(wx * 0.021 + time * 0.09);
      for (let y = 108; y < GROUND_Y; y++) {
        const d = (y - center) / (10 + 4 * Math.sin(wx * 0.018));
        const a = Math.max(0, 1 - d * d);
        if (a > 0) p.blend(x, y, PAL.fight.mist, a * a * density * weights.fight);
      }
    }
  }

  function drawFightFireflies(p, amount) {
    if (amount <= 0.004) return;
    p.place(0, 0);
    const gold = hex("#ffd36f"), amber = hex("#f1a64f");
    for (let i = 0; i < 6; i++) {
      const phase = rand(941, i, 1) * TAU;
      const pulse = Math.max(0, Math.sin(time * 1.15 + phase));
      if (pulse < 0.16) continue;
      const x = rand(941, i, 2) * W + Math.sin(time * 0.22 + phase) * 3;
      const y = 103 + rand(941, i, 3) * 39 + Math.sin(time * 0.42 + phase) * 2;
      const color = i % 2 ? amber : gold;
      // Color alpha stays behind sprites; additive frame light would shine through actors.
      p.disc(x, y, 3 + pulse * 2, color, (d) => (1 - d) ** 2 * 0.22 * pulse * amount);
      p.dot(x, y, color, pulse * amount);
      if (pulse > 0.72) p.dot(x + 1, y - 1, gold, (pulse - 0.6) * amount);
    }
  }

  function bakeMist(buf, m) {
    const mist = PAL[m].mist;
    for (let y = 112; y < GROUND_Y; y++) {
      const a = clamp((y - 112) / (GROUND_Y - 1 - 112));
      const k = a * a * 0.4, row = y * W;
      if (m !== "fight") for (let x = 0; x < W; x++) if (bay(x, y) < k) buf[row + x] = mix(buf[row + x], mist, 0.22 + 0.3 * a);
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
    // Low angular bracken merges the trunk bases into the forest floor.
    for (let i = 0; i < 32; i++) {
      const x0 = i * MID_PERIOD / 32;
      wrapDraw(p, MID_PERIOD, x0, (x) => {
        const h = 4 + (0.5 + 0.5 * Math.sin(i * 0.95)) * 22;
        p.poly([[x - 17, 151], [x - 13, 144], [x - 16, 140], [x - 7, 141],
          [x - 10, 151 - h], [x - 4, 145 - h], [x, 148 - h], [x + 2, 142 - h],
          [x + 6, 151 - h], [x + 13, 137], [x + 11, 145], [x + 21, 151]], pal.canopy);
      });
    }
    // A continuous roof and two large trees frame openings into the distant forest.
    for (const t of MID_TREES) wrapDraw(p, MID_PERIOD, t.x, (x) => drawTrunk(p, t, x, pal));
    for (let i = 0; i < 18; i++) {
      const x0 = i * MID_PERIOD / 18;
      wrapDraw(p, MID_PERIOD, x0, (x) => {
        const y = 8 + Math.sin(i * 1.8) * 12;
        drawLeafMass(p, x, y, 38 + rand(531, i) * 12, pal, 800 + i);
      });
    }
    midCache[m] = f;
    return f;
  }

  function trunkFrame(m) {
    if (trunkCache[m]) return trunkCache[m];
    const f = createFrame(MID_PERIOD, H), p = painterFor(f);
    p.place(0, 0);
    for (const x0 of [-12, 202]) wrapDraw(p, MID_PERIOD, x0,
      (x) => drawAncientTree(p, x, PAL[m], 3301 + x0));
    trunkCache[m] = f;
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
      const worldX = mod(Math.floor(scrollX * FAR_SPEED) + Math.round(x), JOURNEY_PERIOD);
      const riverX = FAR_PERIOD * 2 + 100;
      if (m === "fight" && b.base > GROUND_Y + 2 && worldX >= riverX && worldX < riverX + 180) return;
      const sway = Math.sin(t * 1.5 + b.phase) * b.sway + Math.sin(t * 3.1 + b.phase * 2) * 0.5;
      for (let r = 0; r < b.h; r++) {
        const u = r / b.h;
        const px = Math.round(x + sway * u * u), py = Math.round(b.base - r);
        const c = u > 0.82 ? (b.tone === 0 ? pal.grassTip : pal.grassMid) : u > 0.4 ? pal.grassMid : pal.grassDark;
        if (py < GROUND_Y - 2) continue;
        p.px(px, py, c);
        if (b.tone === 0 && u < 0.55) p.px(px + 1, py, pal.grassDark);
        if (u > 0.3 && u < 0.7 && r % 3 === 0) p.px(px - 1, py + 1, pal.grassDark);
      }
      const tipX = Math.round(x + sway), tipY = Math.round(b.base - b.h);
      if (tipY >= GROUND_Y - 2 && b.tone === 0 && b.h > 13) {
        p.px(tipX - 1, tipY + 1, pal.grassMid);
        p.px(tipX + 1, tipY + 2, pal.grassMid);
      }
      if (tipY >= GROUND_Y - 1 && b.h > 18 && b.tone === 2) p.px(tipX, tipY - 1, pal.grassTip);
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
      const midOff = mod(Math.floor(scrollX * MID_SPEED), MID_PERIOD);
      const nearOff = mod(Math.floor(scrollX * NEAR_SPEED), NEAR_PERIOD);
      eachMode((m, fade) => blitStrip(frame, midFrame(m), midOff, fade));
      if (weights.fight > 0.002) drawFightMist(p);
      eachMode((m, fade) => blitStrip(frame, trunkFrame(m), midOff, fade));
      eachMode((m, fade) => blitStrip(frame, nearFrame(m), nearOff, fade));
      if (weights.fight > 0.002) {
        const journeyOff = mod(Math.floor(scrollX * FAR_SPEED), JOURNEY_PERIOD);
        blitStrip(frame, buildJourney(), journeyOff, weights.fight);
      }
      drawFightFireflies(p, weights.fight);
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
      drawFxAlpha(frame, flies, "front", clamp(weights.camp * 0.9 + weights.night));
      drawFireFront(p, clamp(weights.camp + weights.night));
      eachMode((m, fade) => drawGrassLayer(p, m, fade, time));
    },
  };
  return api;
}

// ---- shared tree shapes
function drawLeafMass(p, x, y, radius, pal, seed) {
  // Small serrated lobes overlap into one broad crown, with light on the upper-right rim.
  p.ellipse(x, y, radius * 0.85, radius * 0.45, pal.leafDark);
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * TAU;
    const cx = x + Math.cos(a) * radius * (0.72 + rand(seed, i, 1) * 0.22);
    const cy = y + Math.sin(a) * radius * 0.43;
    const r = 3 + rand(seed, i, 2) * 5;
    p.poly([[cx - r, cy], [cx - r + 1, cy - 2], [cx - 2, cy - 2], [cx - 2, cy - r],
      [cx + 1, cy - r + 2], [cx + r, cy - 3], [cx + r - 1, cy + 1],
      [cx + r + 2, cy + 2], [cx + 2, cy + 3], [cx, cy + r], [cx - 2, cy + 2]], pal.leafDark);
    if (Math.sin(a) < -0.2 && rand(seed, i, 3) > 0.35) {
      p.poly([[cx - 3, cy - 1], [cx - 1, cy - 4], [cx + 1, cy - 3],
        [cx + 4, cy - 4], [cx + 3, cy], [cx, cy + 1]], pal.leafMid);
      p.line(cx - 1, cy - 4, cx + 1, cy - 3, pal.leafLit);
      p.px(cx + 3, cy - 4, pal.leafLit);
      p.px(cx + 4, cy - 1, pal.canopyLit);
    }
  }
  if (y > 28) for (let i = 0; i < 10; i++) {
    const cx = x + (rand(seed, i, 11) - 0.5) * radius * 1.3;
    const cy = y + (rand(seed, i, 12) - 0.65) * radius * 0.45;
    p.poly([[cx - 2, cy], [cx, cy - 2], [cx + 1, cy - 1], [cx + 4, cy - 2],
      [cx + 3, cy + 1], [cx, cy + 2]], i % 3 ? pal.canopyLit : pal.leafMid);
    if (i % 4 === 0) p.line(cx + 1, cy - 2, cx + 3, cy - 3, pal.leafLit);
  }

}

function drawFarSilhouette(p, x, base, height, width, color, lean) {
  const top = base - height, mid = x + lean;
  p.poly([[x - width * 1.5, base], [x + width, base], [mid + width * 0.7, top + 12],
    [mid - width * 0.7, top + 10], [x - width * 1.8 + lean, base - height * 0.4]], color);
  for (let i = 0; i < 9; i++) {
    const dx = (rand(Math.round(x), i, 3) - 0.5) * 36;
    const dy = rand(Math.round(x), i, 4) * 23;
    p.ellipse(mid + dx, top + dy, 9 + rand(i, Math.round(x)) * 9, 9 + dy * 0.25, color);
  }
}

function drawAncientTree(p, x, pal, seed) {
  // Broad buttress, a twisting trunk and forked limbs; no straight pole reaches the crown.
  p.poly([[x - 37, 153], [x - 20, 143], [x - 9, 119], [x - 4, 96], [x + 7, 78],
    [x + 10, 59], [x + 4, 42], [x - 6, 25], [x - 3, 17], [x + 13, 37],
    [x + 18, 54], [x + 29, 31], [x + 43, 20], [x + 48, 21], [x + 34, 38],
    [x + 24, 65], [x + 23, 84], [x + 11, 110], [x + 10, 135], [x + 19, 147],
    [x + 41, 156], [x + 22, 159], [x + 2, 145], [x - 14, 155]], pal.ink);
  p.poly([[x - 28, 151], [x - 14, 140], [x - 4, 114], [x + 2, 95], [x + 12, 78],
    [x + 14, 57], [x + 8, 40], [x + 17, 54], [x + 19, 75], [x + 15, 94],
    [x + 7, 117], [x + 5, 139], [x + 25, 155], [x + 4, 145], [x - 1, 139], [x - 10, 149]], pal.bark);
  for (const [side, by, reach] of [[-1, 75, 41], [1, 100, 39], [-1, 44, 28]]) {
    const bx = x + 10, ex = bx + side * reach;
    p.poly([[bx, by + 7], [bx + side * 11, by - 4], [ex - side * 9, by - 22],
      [ex + side * 10, by - 25], [ex + side * 11, by - 21], [ex - side * 7, by - 18],
      [bx + side * 12, by + 3], [bx, by + 15]], pal.ink);
    p.poly([[bx, by + 5], [bx + side * 11, by], [ex - side * 8, by - 19],
      [ex + side * 7, by - 23], [ex - side * 8, by - 21], [bx + side * 12, by - 2]], pal.bark);
    p.line(bx, by + 5, ex - side * 9, by - 20, pal.barkLit);
    drawLeafMass(p, ex, by - 26, 22, pal, seed + by);
  }
  drawLeafMass(p, x + 35, 18, 39, pal, seed);
  for (let i = 0; i < 6; i++) {
    const dx = i * 2;
    p.line(x + 11 + dx, 59, x + 7 + dx, 86, i % 2 ? pal.barkDark : pal.barkLit);
    p.line(x + 7 + dx, 86, x - 7 + dx, 120, i % 2 ? pal.barkDark : pal.barkLit);
    p.line(x - 7 + dx, 120, x - 12 + dx, 140, pal.barkDark);
  }
  p.ellipse(x + 12, 82, 3, 5, pal.ink);
  p.line(x + 8, 77, x + 7, 83, pal.barkLit);
  for (const [dx, dy, ex, ey] of [[-5, 123, -30, 154], [1, 135, -15, 163], [7, 135, 33, 161]]) {
    p.line(x + dx, dy, x + ex, ey, pal.barkLit);
    p.line(x + dx + 2, dy + 3, x + ex + 2, ey + 1, pal.barkDark);
    p.line(x + dx - 2, dy + 5, x + ex - 3, ey - 1, pal.moss);
  }
  for (let i = 0; i < 24; i++) {
    const y = 104 + rand(seed, i, 7) * 46;
    const dx = y < 125 ? 2 - (y - 104) * 0.38 : -6 - (y - 125) * 0.65;
    const xx = x + dx + rand(seed, i, 8) * 5;
    p.line(xx, y, xx + 2, y - 1, i % 3 ? pal.moss : pal.grassDark);
    if (i % 4 === 0) p.px(xx + 1, y - 2, pal.grassTip);
  }

}

function drawTrunk(p, t, x, pal) {
  const c = pal.canopy, top = 20 + rand(t.seed, 1) * 25;
  const bend = t.lean * 0.7;
  p.poly([[x - 9, 150], [x - 3, 119], [x + bend - 4, 88], [x + bend - 2, top],
    [x + bend + 4, top], [x + bend + 5, 94], [x + 4, 125], [x + 10, 150]], c);
  for (const side of [-1, 1]) {
    const bx = x + bend + side * 24, by = top + 26 + side * 12;
    p.poly([[x, 100], [x + bend, 74], [bx, by], [bx + side * 14, by - 5],
      [bx + side * 13, by - 2], [bx, by + 5], [x + bend + 3, 82]], c);
    drawLeafMass(p, bx + side * 7, by - 6, 17, { ...pal, leafMid: c, leafLit: pal.canopyLit }, t.seed);
  }
}

function drawNearItem(p, item, x, pal) {
  const base = GROUND_Y + 2;
  if (item.type === "fern") {
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
          p.line(px - side * 2, py + 1, px, py, pal.leafDark);
          p.line(px, py - 1, px + side * 2, py - 3, pal.moss);
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
