// CONTRACT (owned by issue "Rast-Szenen"). Where the heroine rests on a break: a scene of its own, drawn instead of
// the forest while a break lasts. Same layering as the forest: background() behind, drawBack/drawFront around her.
//
// REST_KINDS: ["storm", "lake"]
//   "storm"  rain, distant thunderstorm (lightning flashes light the sky and treeline), she sits dry under a shelter
//            (rock overhang or a lean-to of branches) and lights a small fire there; drips at the shelter's edge
//   "lake"   a campfire on the shore of a still forest lake, fireflies over the water, fire and moon reflected,
//            reeds, a few stars
// createRest(kind, { night = false }) returns:
//   kind, night
//   seatX                        feet x where the heroine sits ("sit" faces right toward the fire)
//   fireX                        x of the fire (on GROUND_Y)
//   lit                          false until ignite(); an unlit fire shows the laid logs only
//   ignite()                     sparks, smoke puff, then the fire catches over ~1.5 s (the heroine's "lightFire")
//   update(dt)
//   background()                 Uint32Array(W*H), the composite() background (cache what doesn't move)
//   drawBack(frame), drawFront(frame)
// night: darker sky, more stars (the long break). Lightning in "storm" every 6-15 s, never pure white full screen.

import { createFx, painterFor, hex, mix, rand, clamp } from "../../../vendor/pixelfx/src/core/index.js";
import * as campfire from "../../../vendor/pixelfx/src/fx/fire/campfire.js";

const W = 320, H = 180, GROUND_Y = 150;
export const REST_KINDS = ["storm", "lake"];
const INK = hex("#17121f");
const FIRE_X = { storm: 219, lake: 78 };
const SEAT_X = { storm: 185, lake: 42 };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];

const SKY_STOPS = {
  storm: [[0, "#1c1a33"], [0.34, "#24223f"], [0.72, "#2a2748"], [1, "#302d4c"]],
  lake: [[0, "#29273e"], [0.4, "#4c4054"], [0.72, "#9a5e58"], [1, "#dc8959"]],
};
const PAL = {
  storm: {
    sky: ["#1c1a33", "#24223f", "#2a2748", "#302d4c"], far: "#292744", mid: "#1a192b",
    farBark: "#29243c", bark: "#171523", barkLit: "#322d47", rock: "#35334d", rockMid: "#4a4866", rockLit: "#686684",
    moss: "#3a4a3c", ground: "#1e1c2b", groundTop: "#39364d", puddle: "#343750", rain: "#7784a7", rainNear: "#aab5cc",
    shelter: "#242239", shelterTop: "#3d3a58", wood: "#74503b", ember: "#f4a449", glow: "#ff9139",
  },
  lake: {
    sky: ["#29273e", "#4c4054", "#9a5e58", "#dc8959"], far: "#322d43", mid: "#272638",
    bark: "#322934", barkLit: "#65443b", rock: "#4c3e3d", rockLit: "#86604a",
    ground: "#29252b", groundTop: "#696048", water: "#222b3d", waterMid: "#384253", waterLit: "#687080",
    reed: "#596043", wood: "#76523a", ember: "#ffd064", glow: "#ff9b3e",
  },
};
const colorPal = Object.fromEntries(Object.entries(PAL).map(([kind, values]) => [kind,
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Array.isArray(v) ? v.map(hex) : hex(v)])),
]));

function makeBackground(kind, night) {
  const pal = colorPal[kind], stops = SKY_STOPS[kind].map(([t, c]) => [t, hex(c)]);
  const bg = new Uint32Array(W * H);
  for (let y = 0; y < H; y++) {
    const t = y / (GROUND_Y - 1);
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
    const f = clamp((t - t0) / Math.max(1e-5, t1 - t0));
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const step = Math.floor(f * 5), frac = f * 5 - step;
      let c = mix(c0, c1, clamp((step + (frac > bay(x, y) ? 1 : 0)) / 5));
      if (night) c = mix(c, hex("#111525"), 0.42);
      bg[row + x] = c;
    }
  }
  if (kind === "storm") drawStormClouds(bg, pal);
  drawTreeLayers(bg, kind);
  if (kind === "storm") {
    // Wet forest floor with long puddles holding a blue-violet reflection.
    const puddles = [[60, 162, 40, 8], [148, 168, 31, 7], [219, 164, 25, 8], [285, 160, 30, 8]];
    for (let y = 130; y < H; y++) for (let x = 0; x < W; x++) {
      const edge = y === 130 || y === 131;
      bg[y * W + x] = edge ? pal.groundTop : pal.ground;
      for (let i = 0; i < puddles.length; i++) {
        const [cx, cy, rx, ry] = puddles[i], dy = Math.abs(y - cy);
        const wobble = Math.round(Math.sin(y * 0.7 + i * 3) * 2), width = rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2));
        if (dy <= ry && Math.abs(x - cx - wobble) <= width) {
          const rim = dy > ry - 2 || (x + y + i * 7) % 23 < 2;
          bg[y * W + x] = rim ? mix(pal.puddle, pal.rain, 0.42) : mix(pal.ground, pal.puddle, 0.7);
          break;
        }
      }
    }
  } else {
    // Lake occupies the middle distance; the foreground shore remains a clear place for the heroine and fire.
    for (let y = 101; y < 151; y++) for (let x = 0; x < W; x++) {
      const ripple = y % 7 === 3 && (x * 7 + y * 3) % 29 < 4;
      bg[y * W + x] = ripple ? pal.waterMid : pal.water;
    }
    drawLakeReflectionTrees(bg, pal);
    for (let y = 143; y < H; y++) for (let x = 0; x < W; x++) bg[y * W + x] = y < 151 ? pal.groundTop : pal.ground;
    const moonX = night ? 254 : 255, moonY = 26;
    discInto(bg, moonX, moonY, night ? 7 : 0, hex("#f5d79c"));
    if (night) for (let i = 0; i < 28; i++) {
      const x = Math.floor(rand(90, i, 1) * W), y = 5 + Math.floor(rand(90, i, 2) * 71);
      bg[y * W + x] = rand(90, i, 3) > 0.4 ? hex("#d3c5bd") : hex("#8e9db0");
    } else for (const [x, y] of [[31, 25], [119, 39], [208, 19], [288, 57]]) bg[y * W + x] = hex("#edd3a4");
    // Fire, moon and firefly reflection bands ripple on the surface.
    for (let y = 108; y < 145; y += 4) {
      const center = 78 + Math.round(Math.sin(y * 0.41) * 3), half = Math.max(1, Math.floor((y - 105) * 0.16));
      for (let x = center - half; x <= center + half; x++) if (x >= 0 && x < W) bg[y * W + x] = y % 8 ? pal.waterMid : pal.ember;
      if (night && y % 8 === 0) for (let x = 248 - half; x <= 248 + half; x++) if (x >= 0 && x < W) bg[y * W + x] = pal.waterLit;
    }
  }
  return bg;
}

function putBuffer(buf, x, y, color) {
  x = Math.round(x); y = Math.round(y);
  if (x >= 0 && x < W && y >= 0 && y < H) buf[y * W + x] = color;
}

function lineBuffer(buf, x0, y0, x1, y1, color, width = 1) {
  let x = Math.round(x0), y = Math.round(y0), ex = Math.round(x1), ey = Math.round(y1);
  const dx = Math.abs(ex - x), sx = x < ex ? 1 : -1, dy = -Math.abs(ey - y), sy = y < ey ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    for (let oy = -Math.floor(width / 2); oy <= Math.floor(width / 2); oy++)
      for (let ox = -Math.floor(width / 2); ox <= Math.floor(width / 2); ox++) putBuffer(buf, x + ox, y + oy, color);
    if (x === ex && y === ey) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function fillPolyBuffer(buf, points, color) {
  const ys = points.map((point) => point[1]), y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) {
    const intersections = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, py1] = points[i], [x2, py2] = points[(i + 1) % points.length];
      if ((py1 <= y && py2 > y) || (py2 <= y && py1 > y)) intersections.push(x1 + (y - py1) * (x2 - x1) / (py2 - py1));
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2)
      for (let x = Math.max(0, Math.ceil(intersections[i])); x <= Math.min(W - 1, Math.floor(intersections[i + 1])); x++) putBuffer(buf, x, y, color);
  }
}

function cloudMass(buf, cx, cy, rx, ry, color, seed) {
  for (let y = Math.max(0, cy - ry - 2); y <= Math.min(65, cy + ry + 2); y++) {
    for (let x = Math.max(0, cx - rx - 2); x <= Math.min(W - 1, cx + rx + 2); x++) {
      const n = 1 + (rand(seed, Math.floor(x / 4), Math.floor(y / 3)) - 0.5) * 0.2;
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d < n) putBuffer(buf, x, y, color);
    }
  }
}

function drawStormClouds(buf) {
  const cloudLow = hex("#24223f"), cloudMid = hex("#2b294b"), cloudRim = hex("#3b3866");
  // Broad scalloped cloud bands leave a ragged opening toward the horizon for the lightning to silhouette.
  for (let x = -20; x < W + 30; x += 1) {
    const wave = Math.sin(x * 0.028) * 5 + Math.sin(x * 0.071 + 1.2) * 3;
    const underside = 29 + wave + Math.sin(x * 0.13) * 2;
    for (let y = 0; y < underside; y++) putBuffer(buf, x, y, y < 10 + wave * 0.18 ? cloudLow : cloudMid);
    if (Math.sin(x * 0.09 + 0.6) > 0.58) for (let y = Math.floor(underside - 3); y < underside; y++) putBuffer(buf, x, y, cloudRim);
  }
  for (const [x, y, rx, ry, c, s] of [
    [43, 30, 31, 12, cloudMid, 21], [111, 35, 42, 15, cloudLow, 22], [187, 28, 38, 13, cloudMid, 23], [274, 34, 51, 17, cloudLow, 24],
  ]) cloudMass(buf, x, y, rx, ry, c, s);
}

function drawTreeLayers(buf, kind) {
  const farTrunk = kind === "storm" ? hex("#29243c") : hex("#322d43");
  const farCanopy = kind === "storm" ? hex("#24223d") : hex("#2b293f");
  const near = kind === "storm" ? hex("#171523") : hex("#222031");
  // Distant slender trunks and ragged crowns create a separate silhouette band.
  for (let i = 0; i < 9; i++) {
    const x = 14 + i * 38 + Math.round((rand(311, i, 1) - 0.5) * 18);
    const tip = 43 + Math.round(rand(311, i, 2) * 34), base = 138, lean = (rand(311, i, 3) - 0.5) * 13;
    for (let lobe = 0; lobe < 5; lobe++) {
      const lx = x + (lobe - 2) * (7 + Math.round(rand(312, i, lobe) * 3));
      const ly = tip + Math.abs(lobe - 2) * 3;
      fillPolyBuffer(buf, [[lx - 9, ly + 6], [lx - 6, ly - 1], [lx - 2, ly - 5], [lx + 3, ly - 3], [lx + 9, ly + 5], [lx + 6, ly + 10]], farCanopy);
    }
    lineBuffer(buf, x + lean, tip + 3, x, base, farTrunk, 2);
    lineBuffer(buf, x + lean, tip + 21, x - 13, tip + 6, farTrunk, 2);
    lineBuffer(buf, x + lean, tip + 15, x + 14, tip + 2, farTrunk, 2);
    lineBuffer(buf, x, base - 3, x - 10, base + 5, farTrunk, 2);
    lineBuffer(buf, x, base - 3, x + 11, base + 5, farTrunk, 2);
  }
  // Near trees are thicker and gnarled; trunks fork into asymmetric limbs and roots.
  const nearTrees = kind === "storm" ? [[-8, 4, 12, 165], [75, 8, 8, 151], [257, 12, 10, 158], [322, 3, -9, 165]] : [[-7, 10, 10, 98], [67, 23, 6, 101], [155, 18, -7, 99], [249, 13, 8, 101], [326, 5, -8, 99]];
  for (let i = 0; i < nearTrees.length; i++) {
    const [x, top, lean, base] = nearTrees[i], dx = lean < 0 ? -1 : 1, col = i % 2 ? near : mix(near, farTrunk, 0.16);
    lineBuffer(buf, x + lean, top, x, base, col, kind === "storm" ? (i % 2 ? 7 : 5) : 4);
    lineBuffer(buf, x + lean * 0.72, top + 28, x + dx * 34, top + 5, col, 4);
    lineBuffer(buf, x + lean * 0.72, top + 28, x + dx * 15, top + 19, col, 4);
    lineBuffer(buf, x + dx * 15, top + 19, x + dx * 34, top + 5, col, 3);
    lineBuffer(buf, x + lean * 0.5, top + 45, x - dx * 30, top + 26, col, 3);
    lineBuffer(buf, x + dx * 15, top + 17, x + dx * 23, top + 3, col, 2);
    lineBuffer(buf, x, base - 3, x - 17, base + 8, col, 3);
    lineBuffer(buf, x, base - 3, x + 18, base + 8, col, 3);
    for (let lobe = 0; lobe < 6; lobe++) {
      const bx = x + (lobe - 2.5) * 9 + Math.sin(i + lobe) * 4, by = top + 4 + (lobe % 2) * 5;
      fillPolyBuffer(buf, [[bx - 11, by + 7], [bx - 8, by], [bx - 3, by - 5], [bx + 4, by - 2], [bx + 11, by + 6], [bx + 6, by + 10]], col);
    }
    if (kind === "storm" && i % 2 === 0) lineBuffer(buf, x + dx * 3, base - 18, x + dx * 7, base - 51, mix(col, hex("#45435f"), 0.5), 1);
  }
}

function drawLakeReflectionTrees(buf, pal) {
  const reflect = hex("#3a4258");
  // Broken, inverted tree silhouettes taper into the water and leave room for moving glints.
  for (let i = 0; i < 8; i++) {
    const x = 13 + i * 42 + Math.round((rand(319, i, 1) - 0.5) * 18), tip = 102 + Math.round(rand(319, i, 2) * 6), end = 135;
    for (let y = tip; y < end; y += 2) {
      const depth = y - tip, width = Math.min(12, 2 + Math.floor(depth * 0.34));
      const center = x + Math.round(Math.sin(depth * 0.2 + i) * 2);
      for (let dx = -width; dx <= width; dx++) {
        const segment = Math.floor((dx + width) / 4);
        if (rand(320, i, Math.floor(y / 2), segment) > 0.24)
          putBuffer(buf, center + dx, y, depth % 6 === 0 ? pal.waterMid : reflect);
      }
    }
  }
}

function discInto(buf, cx, cy, r, c) {
  if (!r) return;
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) buf[(cy + y) * W + cx + x] = c;
}

export function createRest(kind, { night = false } = {}) {
  if (!REST_KINDS.includes(kind)) throw new Error(`createRest: unknown kind "${kind}"`);
  const pal = colorPal[kind], fireX = FIRE_X[kind], seatX = SEAT_X[kind];
  let time = 0, ignition = -Infinity, lit = false;
  let nextFlash = (night ? 8 : 6) + rand(251, kind === "storm" ? 1 : 2, night ? 1 : 0) * (night ? 7 : 9);
  let flash = 0;
  const bgBase = makeBackground(kind, night);
  const bgFlash = new Uint32Array(W * H);
  const fire = createFx(campfire, { x: fireX, y: GROUND_Y, height: kind === "storm" ? 13 : 17, seed: kind === "storm" ? 35 : 72, light: 0.72 });

  function background() {
    if (kind !== "storm" || flash <= 0.01) return bgBase;
    const k = Math.min(0.52, flash * 0.46);
    for (let i = 0; i < bgBase.length; i++) bgFlash[i] = mix(bgBase[i], hex("#7473a4"), k);
    return bgFlash;
  }

  function drawShelter(p) {
    // A heavy rock lip and deep underside wrap over the resting place like a shallow cave.
    const rock = [[70, 82], [81, 68], [99, 58], [125, 50], [157, 48], [182, 54], [208, 60], [231, 65], [253, 78], [258, 87], [245, 96], [222, 91], [198, 87], [174, 84], [150, 86], [124, 91], [100, 94], [80, 91]];
    p.poly(rock, INK);
    p.poly([[75, 81], [85, 70], [103, 61], [127, 54], [155, 52], [180, 58], [205, 64], [229, 69], [250, 81], [250, 87], [223, 83], [197, 79], [173, 77], [149, 78], [122, 83], [98, 87], [81, 87]], pal.rock);
    p.poly([[85, 73], [104, 63], [128, 57], [154, 55], [179, 61], [203, 67], [225, 72], [240, 81], [220, 77], [196, 73], [174, 70], [150, 71], [124, 76], [101, 81]], pal.rockMid);
    p.poly([[92, 70], [107, 63], [128, 59], [154, 58], [176, 63], [195, 68], [211, 73], [190, 71], [168, 67], [145, 66], [122, 69], [104, 75]], pal.rockLit);
    // Ink-dark cave ceiling under the lip, with a broken moss edge and three stone facets.
    p.poly([[83, 88], [102, 86], [124, 81], [149, 78], [174, 78], [199, 81], [223, 86], [247, 91], [242, 101], [218, 96], [194, 92], [169, 89], [145, 89], [120, 96], [98, 100], [83, 97]], pal.shelter);
    p.poly([[90, 88], [109, 84], [132, 81], [151, 80], [175, 82], [196, 85], [216, 89], [202, 88], [180, 86], [157, 86], [135, 89], [114, 94]], pal.shelterTop);
    p.poly([[85, 76], [96, 69], [103, 70], [108, 76], [102, 82], [92, 82]], pal.moss);
    p.poly([[171, 68], [182, 69], [189, 74], [184, 78], [174, 75]], pal.moss);
    p.poly([[225, 73], [235, 76], [241, 82], [237, 85], [229, 80]], pal.moss);
    p.line(83, 91, 78, 132, INK, 2); p.line(78, 132, 91, 137, pal.rock);
    p.poly([[78, 103], [98, 99], [107, 131], [82, 138]], pal.rock);
    p.poly([[239, 98], [254, 95], [263, 130], [243, 137]], pal.rock);
    p.poly([[77, 130], [264, 127], [268, 137], [75, 140]], pal.ground);
    if (lit) {
      // Warm bounce catches the underside and a nearby floor patch in gold without washing out stone texture.
      p.glow(fireX - 37, 82, 88, pal.glow, 0.27);
      p.glow(fireX - 20, 127, 68, pal.ember, 0.22);
      p.poly([[195, 84], [211, 86], [222, 91], [212, 91], [197, 89]], pal.ember);
      p.poly([[223, 92], [246, 96], [257, 103], [240, 101]], pal.glow);
    }
    // Moss threads across the drip lip; water gathers and falls in broken bright streaks.
    for (const [x, len] of [[91, 5], [119, 9], [151, 5], [178, 8], [205, 6], [234, 10]]) {
      p.px(x, 88 + Math.floor((x % 13) / 5), pal.rainNear);
      for (let y = 90; y < 90 + len; y++) if ((y + x) % 3 !== 0) p.dot(x, y, pal.rainNear, 0.7);
    }
  }

  function drawLakeBank(p) {
    // Reeds frame the water; clumps stay low so the reflected sky remains open.
    for (const [x, h, dir] of [[8, 16, -1], [23, 21, 1], [119, 15, -1], [293, 19, 1], [309, 13, -1]]) {
      p.line(x, 147, x + dir * 2, 147 - h, pal.reed);
      p.line(x + 2, 147, x + dir * 5, 147 - h * 0.72, pal.reed);
      p.line(x - 2, 147, x - dir * 4, 147 - h * 0.84, pal.reed);
      p.line(x + dir * 2, 147 - h, x + dir * 4, 145 - h, pal.ember);
    }
    p.poly([[0, 143], [35, 139], [78, 142], [112, 139], [155, 144], [205, 141], [254, 144], [320, 139], [320, 151], [0, 151]], pal.groundTop);
    for (const [x, y, rx, ry] of [[48, 145, 5, 2], [101, 147, 3, 2], [162, 146, 6, 2], [203, 145, 4, 2], [266, 147, 5, 3]]) {
      p.ellipse(x, y, rx, ry, INK); p.ellipse(x, y - 1, rx - 1, ry - 1, pal.rock);
      p.px(x - 1, y - 1, pal.rockLit);
    }
    for (const [x, h] of [[29, 8], [58, 7], [139, 9], [183, 6], [235, 8], [281, 7]]) {
      p.line(x, 145, x - 2, 145 - h, pal.reed);
      p.line(x + 2, 146, x + 4, 145 - h * 0.8, pal.reed);
      p.line(x - 2, 145 - h, x + 1, 144 - h, pal.ember);
    }
  }

  function drawLakeMist(p) {
    for (let band = 0; band < 4; band++) {
      const y = 101 + band * 6 + Math.sin(time * 0.35 + band) * 1.5;
      const drift = (time * (3 + band) + band * 37) % 390 - 35;
      for (let segment = 0; segment < 3; segment++) {
        const x = (drift + segment * 137) % 350 - 15, length = 34 + ((segment * 19 + band * 13) % 37);
        for (let dx = 0; dx < length; dx += 2) {
          const alpha = 0.2 + 0.06 * Math.sin(dx * 0.19 + band);
          p.blend(x + dx, y + Math.sin(dx * 0.13 + band) * 1.2, hex("#a4a6b4"), alpha);
        }
      }
    }
  }

  function drawLogs(p) {
    const x = fireX;
    p.ellipse(x, GROUND_Y + 1, 17, 3, INK);
    p.line(x - 10, GROUND_Y - 1, x + 8, GROUND_Y - 5, pal.wood);
    p.line(x - 8, GROUND_Y - 4, x + 10, GROUND_Y, pal.wood);
    p.line(x - 8, GROUND_Y - 2, x + 7, GROUND_Y - 5, pal.barkLit);
    if (ignition > 0 && ignition < 1.5) {
      const age = time - ignition, q = clamp(age / 1.5);
      // Sparks first, then a small smoke curl, then the first tongues of flame.
      if (age < 0.38) for (let i = 0; i < 7; i++) {
        const phase = ((age * (2.8 + i * 0.23) + i * 0.19) % 1);
        const sx = x + Math.round(Math.sin(i * 5.2 + age * 8) * (2 + i % 3));
        const sy = GROUND_Y - 6 - phase * 11;
        p.dot(sx, sy, pal.ember, 1 - phase * 0.45);
      }
      if (age > 0.26) {
        const fade = clamp((age - 0.26) / 0.75);
        for (let i = 0; i < 5; i++) {
          const sy = GROUND_Y - 8 - i * 3 - ((age * 8 + i) % 2);
          const sx = x + Math.round(Math.sin(age * 4 + i) * (1 + i));
          p.dot(sx, sy, pal.rockLit, fade * 0.6);
        }
      }
      if (q > 0.58) {
        p.tri(x - 3, GROUND_Y - 4, x, GROUND_Y - 15 * q, x + 2, GROUND_Y - 4, pal.glow);
        p.tri(x - 1, GROUND_Y - 4, x + 2, GROUND_Y - 11 * q, x + 4, GROUND_Y - 4, pal.ember);
      }
    }
  }

  function drawRain(p, front) {
    if (kind !== "storm") return;
    for (let i = 0; i < (front ? 48 : 80); i++) {
      const seed = front ? 800 : 700, phase = (time * (front ? 31 : 25) + rand(seed, i, 1) * 180) % 180;
      const x = (Math.floor(rand(seed, i, 2) * W) - Math.floor(phase * 0.22) + W) % W;
      const y = phase - 16;
      if (front && y < 126) continue;
      if (!front && y > 136) continue;
      const c = front ? pal.rainNear : pal.rain;
      p.line(x, y, x - 2, y + (front ? 5 : 4), c, front ? 0.78 : 0.48);
    }
    // Small crowns in the puddle bands suggest drops hitting the wet ground.
    if (front) for (let i = 0; i < 5; i++) {
      const x = (i * 73 + Math.floor(time * 17) % W) % W, y = 158 + (i % 2) * 5;
      p.line(x - 2, y, x, y - 1, pal.rainNear, 0.6); p.line(x, y - 1, x + 2, y, pal.rainNear, 0.6);
    }
  }

  function drawLakeFlies(p, front) {
    const start = front ? 7 : 0, end = front ? 14 : 7;
    for (let i = start; i < end; i++) {
      const x = 10 + rand(191, i, 1) * 300 + Math.sin(time * (0.32 + rand(191, i, 4)) + i) * 5;
      const y = 82 + rand(191, i, 2) * 57 + Math.sin(time * 0.6 + i * 2) * 3;
      const pulse = Math.max(0, Math.sin(time * (1.8 + rand(191, i, 3)) + i * 1.7));
      if (pulse < 0.18) continue;
      p.glow(x, y, 7, hex("#a6c94a"), pulse * 0.42);
      p.dot(x, y, pulse > 0.72 ? hex("#f0e883") : hex("#badb59"), pulse);
      if (pulse > 0.72) p.dot(x + 1, y, hex("#f4eeb0"), pulse * 0.75);
      if (y < 137) {
        const ry = 104 + (y - 82) * 0.43, rx = x + Math.sin(time * 0.8 + i) * 2;
        p.dot(rx, ry, pal.waterLit, pulse * 0.45);
      }
    }
  }

  function drawStormPuddles(p) {
    const reflect = flash > 0.08 ? pal.rainNear : pal.puddle;
    for (const [x, y, width] of [[30, 158, 58], [124, 164, 45], [198, 161, 40], [269, 158, 39]]) {
      p.line(x, y, x + width, y, reflect, flash > 0.08 ? 0.86 : 0.6);
      p.line(x + 5, y + 2, x + width - 8, y + 2, pal.puddle, 0.55);
    }
    // Amber streaks mirror the campfire in the nearest pools.
    p.line(209, 160, 231, 160, pal.ember, 0.8);
    p.line(214, 163, 227, 163, pal.glow, 0.52);
    for (let i = 0; i < 6; i++) {
      const x = (i * 59 + Math.floor(time * 19)) % W, y = 155 + (i % 3) * 7;
      const pulse = 0.45 + 0.4 * Math.sin(time * 4 + i);
      p.line(x - 2, y, x, y - 2, pal.rainNear, pulse);
      p.line(x, y - 2, x + 2, y, pal.rainNear, pulse);
    }
  }

  function drawLightning(p) {
    if (flash <= 0.04) return;
    const cx = 65 + Math.floor(rand(253, Math.floor(nextFlash), 2) * 195), base = 48 + Math.floor(rand(253, Math.floor(nextFlash), 3) * 24);
    const bolt = [[cx, -1], [cx - 5, 15], [cx + 2, 18], [cx - 8, 36], [cx + 1, base], [cx - 2, 27], [cx - 8, 25], [cx, -1]];
    p.polyline(bolt, hex("#c6c8ed"), Math.min(0.9, flash));
    p.polyline([[cx - 3, 16], [cx - 12, 23], [cx - 15, 31], [cx - 22, 37]], hex("#aab5d0"), flash * 0.8);
    p.polyline([[cx - 8, 36], [cx - 3, 42], [cx - 7, 51]], hex("#b7b8dd"), flash * 0.72);
    p.polyline([[cx + 2, 18], [cx + 12, 23], [cx + 17, 32]], hex("#aab5d0"), flash * 0.65);
  }

  return {
    kind, night, seatX, fireX,
    get lit() { return lit; },
    ignite() {
      if (lit || ignition > -Infinity) return;
      ignition = time;
    },
    update(dt) {
      if (!(dt > 0)) return;
      time += dt;
      flash = 0;
      if (kind === "storm") {
        if (time >= nextFlash) {
          const age = time - nextFlash;
          flash = age < 0.48 ? Math.min(1, Math.exp(-age * 6) * (age < 0.12 ? 0.9 : 0.48)) : 0;
          if (age >= 0.48) nextFlash += (night ? 8 : 6) + rand(254, Math.floor(nextFlash), night ? 1 : 0) * (night ? 7 : 9);
        }
      }
      if (ignition > -Infinity && time - ignition >= 1.5) lit = true;
      if (lit) fire.update(dt);
    },
    background,
    drawBack(frame) {
      const p = painterFor(frame); p.place(0, 0);
      if (kind === "storm") {
        drawLightning(p);
        drawShelter(p);
        drawRain(p, false);
      } else {
        drawLakeBank(p);
        if (lit) p.glow(fireX, GROUND_Y - 11, 59, pal.glow, 0.15);
        drawLakeFlies(p, false);
        drawLakeMist(p);
      }
      drawLogs(p);
      if (lit) fire.draw(frame, "back");
    },
    drawFront(frame) {
      const p = painterFor(frame); p.place(0, 0);
      if (kind === "storm") {
        drawStormPuddles(p);
        drawRain(p, true);
      }
      else {
        // A few broken ripples and firefly lights hang over the lake's mirrored band.
        for (let i = 0; i < 10; i++) {
          const x = (i * 37 + Math.floor(time * 3) % 37) % W, y = 112 + (i % 6) * 5;
          p.line(x, y, x + 3 + (i % 4), y, i % 3 ? pal.waterLit : pal.ember, 0.38);
        }
        drawLakeFlies(p, true);
      }
      if (lit) fire.draw(frame, "front");
    },
  };
}
