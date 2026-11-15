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

import { createFx, createFrame, painterFor, hex, mix, rand, clamp } from "../../../vendor/pixelfx/src/core/index.js";
import * as campfire from "../../../vendor/pixelfx/src/fx/fire/campfire.js";

const W = 320, H = 180, GROUND_Y = 150;
export const REST_KINDS = ["storm", "lake"];
const INK = hex("#17121f");
const FIRE_X = { storm: 219, lake: 78 };
const SEAT_X = { storm: 185, lake: 42 };

const SKY_STOPS = {
  storm: [[0, "#11162e"], [0.34, "#282642"], [0.72, "#49405d"], [1, "#716178"]],
  lake: [[0, "#171a34"], [0.4, "#47304f"], [0.72, "#a36360"], [1, "#ed9b58"]],
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
    ground: "#171a29", groundTop: "#3e4b49", water: "#222b3d", waterMid: "#384253", waterLit: "#687080",
    reed: "#596043", wood: "#76523a", ember: "#ffd064", glow: "#ff9b3e",
  },
};
const colorPal = Object.fromEntries(Object.entries(PAL).map(([kind, values]) => [kind,
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Array.isArray(v) ? v.map(hex) : hex(v)])),
]));
const SCENE_CACHE = Object.create(null);
const MIST = makeMist();

function makeMist() {
  const pixels = [];
  for (let y = -4; y <= 4; y++) for (let x = -58; x <= 58; x++) {
    const d = (x / 58) ** 2 + (y / 4) ** 2;
    if (d < 1) pixels.push([x, y, (1 - d) ** 2 * 0.22]);
  }
  return pixels;
}

function makeBackground(kind, night) {
  const pal = colorPal[kind], stops = SKY_STOPS[kind].map(([t, c]) => [t, hex(c)]);
  const bg = new Uint32Array(W * H);
  for (let y = 0; y < H; y++) {
    const t = y / (kind === "lake" ? 108 : 149);
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
    const f = clamp((t - t0) / Math.max(1e-5, t1 - t0));
    const row = y * W;
    for (let x = 0; x < W; x++) {
      let c = mix(c0, c1, Math.floor(f * 12) / 12);
      if (night) c = mix(c, hex("#111525"), 0.42);
      bg[row + x] = c;
    }
  }
  if (kind === "storm") drawStormClouds(bg, pal);
  if (kind === "lake" && night) {
    discInto(bg, 218, 30, 7, hex("#f5d79c"));
    for (let i = 0; i < 28; i++) putBuffer(bg, Math.floor(rand(90, i, 1) * W), 5 + Math.floor(rand(90, i, 2) * 65), hex("#b9b6c9"));
  }
  drawTreeLayers(bg, kind);
  if (kind === "storm") {
    // Wet forest floor with long puddles holding a blue-violet reflection.
    const puddles = [[16, 161, 18, 7], [219, 164, 15, 6], [278, 159, 26, 8], [307, 166, 16, 7]];
    for (let y = 130; y < H; y++) for (let x = 0; x < W; x++) {
      const edge = y === 130 || y === 131;
      const dry = x >= 43 && x <= 255 && y >= 138;
      bg[y * W + x] = edge ? pal.groundTop : dry ? mix(pal.ground, hex("#302b3a"), 0.42) : pal.ground;
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
    for (let x = 0; x < W; x++) {
      const edge = 132 + Math.round(Math.sin(x * 0.08) * 2 + Math.sin(x * 0.21));
      for (let y = 130; y < edge; y++) bg[y * W + x] = mix(pal.ground, pal.groundTop, 0.6);
    }
    drawStormGround(bg, pal);
  } else {
    // Lake occupies the middle distance; the foreground shore remains a clear place for the heroine and fire.
    for (let y = 101; y < 151; y++) for (let x = 0; x < W; x++) {
      const ripple = y % 7 === 3 && (x * 7 + y * 3) % 29 < 4;
      bg[y * W + x] = ripple ? pal.waterMid : pal.water;
    }
    drawLakeReflectionTrees(bg, pal);
    for (let y = 143; y < H; y++) for (let x = 0; x < W; x++) bg[y * W + x] = y < 151 ? pal.groundTop : pal.ground;

  }
  if (kind === "storm") for (let y = 113; y < 131; y++) for (let x = 0; x < W; x++) {
    const center = 122 + Math.sin(x * 0.024) * 3;
    const strength = Math.max(0, 1 - Math.abs(y - center) / 8) * 0.22;
    bg[y * W + x] = mix(bg[y * W + x], hex("#8294a6"), strength);
  }
  drawWoodlandFloor(bg, kind);
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
  // Overlapping bellies carry three quiet values; lightning later lights their interior.
  for (const [x, y, rx, ry, seed] of [[40, 14, 64, 25, 21], [133, 8, 70, 26, 22], [221, 17, 57, 23, 23], [301, 8, 63, 27, 24]]) {
    cloudMass(buf, x, y + 10, rx, ry, hex("#4d4662"), seed);
    cloudMass(buf, x - 8, y + 3, rx, ry, hex("#35334e"), seed);
    cloudMass(buf, x - 16, y - 8, rx, ry, hex("#23273f"), seed);
  }
}

function drawStormGround(buf, pal) {
  const root = hex("#171523"), rootLit = hex("#393243"), grass = hex("#414b3b"), stone = hex("#343245");
  // Roots crawl out of the cliff and break up the ground line; the space under the roof stays comparatively dry.
  lineBuffer(buf, 48, 137, 63, 143, root, 3);
  lineBuffer(buf, 63, 143, 81, 145, root, 2);
  lineBuffer(buf, 82, 145, 109, 142, root, 2);
  lineBuffer(buf, 52, 140, 65, 147, rootLit, 1);
  lineBuffer(buf, 91, 146, 106, 151, root, 2);
  lineBuffer(buf, 238, 143, 252, 147, root, 2);
  lineBuffer(buf, 251, 147, 272, 142, root, 2);
  lineBuffer(buf, 265, 145, 283, 151, rootLit, 1);
  for (const [x, y, w] of [[20, 146, 12], [35, 144, 10], [57, 151, 8], [246, 148, 10], [272, 145, 12], [302, 148, 9]]) {
    lineBuffer(buf, x, y, x - 3, y - w, grass, 1);
    lineBuffer(buf, x + 1, y, x + 3, y - w * 0.72, grass, 1);
    lineBuffer(buf, x + 3, y, x + 8, y - w * 0.85, grass, 1);
  }
  for (const [x, y, w, h] of [[31, 154, 7, 3], [117, 152, 4, 2], [184, 156, 5, 2], [264, 153, 7, 3], [310, 158, 5, 2]]) {
    fillPolyBuffer(buf, [[x - w, y], [x - w + 2, y - h], [x, y - h - 1], [x + w - 1, y - h], [x + w, y], [x + 2, y + 1]], INK);
    fillPolyBuffer(buf, [[x - w + 1, y - 1], [x - w + 3, y - h], [x, y - h], [x + w - 2, y - h], [x + w - 1, y - 1]], stone);
    putBuffer(buf, x - 2, y - h, pal.rockLit);
  }
  // Fine rain sheen and scattered leaf litter on the exposed, wet patches.
  for (let i = 0; i < 35; i++) {
    const x = Math.floor(rand(332, i, 1) * W), y = 140 + Math.floor(rand(332, i, 2) * 35);
    if (x > 64 && x < 245) continue;
    if (rand(332, i, 3) > 0.45) lineBuffer(buf, x, y, x + 2, y, pal.rain, 1);
  }
}

// Rounded leaf clusters join into a crown; a few notches keep the pixel edge organic.
function leafMass(buf, cx, cy, rx, ry, color, seed) {
  for (let i = 0; i < 11; i++) {
    const x = cx + (rand(seed, i, 1) - 0.5) * rx * 1.6;
    const y = cy + (rand(seed, i, 2) - 0.5) * ry;
    const r = rx * (0.25 + rand(seed, i, 3) * 0.24);
    ellipseBuffer(buf, x, y, r, ry * (0.48 + rand(seed, i, 4) * 0.3), color);
    for (let j = 0; j < 8; j++) {
      const angle = rand(seed + i, j, 8) * Math.PI * 2;
      const lx = x + Math.cos(angle) * r, ly = y + Math.sin(angle) * ry * 0.65;
      ellipseBuffer(buf, lx, ly, 2 + j % 3, 1 + j % 2, color);
    }
  }
}

function ellipseBuffer(buf, cx, cy, rx, ry, color) {
  for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(H - 1, cy + ry); y++) {
    const width = rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
    for (let x = Math.max(0, Math.ceil(cx - width)); x <= Math.min(W - 1, cx + width); x++) buf[y * W + x] = color;
  }
}

function drawTreeLayers(buf, kind) {
  const lake = kind === "lake", base = lake ? 101 : 139;
  // Three continuous masses separate the warm horizon from the cool foreground.
  for (let layer = 0; layer < 3; layer++) {
    const col = hex((lake ? ["#69506b", "#413451", "#20243e"] : ["#49415b", "#302e48", "#1c2037"])[layer]);
    for (let i = 0; i < 10; i++) {
      const x = i * 37 - 7 + (rand(311, i, layer) - 0.5) * 22;
      const opening = Math.sin(Math.max(0, Math.min(1, x / W)) * Math.PI);
      const top = (lake ? 31 + opening * 42 : 37) + layer * 7 + rand(314, i, layer) * 16;
      const bend = (rand(316, i, layer) - 0.5) * 15;
      fillPolyBuffer(buf, [[x - 5, base], [x - 2, base - 19], [x + bend - 3, top], [x + bend + 2, top], [x + 3, base - 22], [x + 9, base]], col);
      lineBuffer(buf, x, top + 27, x - 14, top + 9, col, 2);
      lineBuffer(buf, x + 1, top + 22, x + 15, top + 4, col, 2);
      leafMass(buf, x + bend, top, 22, 12, col, 320 + i + layer * 13);
      leafMass(buf, x + 14, base - 2, 24, 7, col, 450 + i + layer * 13);
    }
  }
  // Canopy at the frame edge leaves a generous opening over the lake and shelter.
  for (const [x, y, rx, ry, seed] of [[4, 7, 65, 30, 601], [59, -7, 49, 26, 602], [295, 2, 57, 33, 603], [253, -13, 43, 24, 604]]) {
    leafMass(buf, x, y, rx, ry, hex("#11162c"), seed);
  }
}

function drawLakeReflectionTrees(buf) {
  // Mirror the actual distant bank, compressing and breaking it into water ripples.
  const bank = buf.slice();
  for (let y = 102; y < 141; y++) {
    const sy = 100 - Math.floor((y - 102) * 1.4);
    const drift = Math.round(Math.sin(y * 1.7) * 2);
    for (let x = 0; x < W; x++) {
      const sx = Math.max(0, Math.min(W - 1, x + drift));
      const source = bank[sy * W + sx];
      buf[y * W + x] = mix(source, hex("#25324a"), y % 4 === 0 ? 0.75 : 0.48);
    }
  }
}

function fern(buf, x, y, size, color) {
  for (const dir of [-1, 1]) {
    for (let i = 1; i <= size; i++) {
      const xx = x + i * dir, yy = y - i + i * i / (size * 2.5);
      lineBuffer(buf, xx, yy, xx + dir * 2, yy - Math.min(4, size - i + 1), color);
      if (i % 2) lineBuffer(buf, xx, yy, xx + dir * 3, yy + 1, color);
    }
  }
  lineBuffer(buf, x, y, x, y - size, color);
}

function drawWoodlandFloor(buf, kind) {
  const lake = kind === "lake", moss = hex("#46594d"), mossLit = hex("#75805c"), soil = hex("#292536");
  // Low moss cushions and leaf litter leave feet and fire unobscured.
  for (let i = 0; i < 210; i++) {
    const x = rand(410, i, 1) * W, y = 149 + rand(410, i, 2) * 31;
    if (!lake && x > 112 && x < 239 && y < 158) continue;
    const edge = y < 154 + Math.sin(x * 0.09) * 3;
    ellipseBuffer(buf, x, y, 1 + rand(411, i, 1) * 3, 1, edge ? (i % 4 ? moss : mossLit) : soil);
  }
  for (const [x, y, size] of [[10, 164, 13], [113, 160, 9], [288, 157, 11], [307, 172, 12], [144, 176, 8]]) {
    fern(buf, x, y, size, INK);
    fern(buf, x - 1, y - 1, size - 1, moss);
  }
  // Framing trunks have tapering elbows and roots, never a vertical cut through the actor plane.
  for (const side of [0, 1]) {
    const xx = (x) => side ? W - x : x;
    const poly = (points, c) => fillPolyBuffer(buf, points.map(([x, y]) => [xx(x), y]), c);
    poly([[-8, 0], [9, 0], [6, 30], [15, 58], [10, 92], [9, 129], [17, 151], [38, 167], [19, 162], [6, 153], [-4, 174]], INK);
    poly([[0, 0], [5, 0], [2, 33], [10, 59], [5, 95], [4, 130], [11, 151], [24, 160], [14, 156], [0, 139]], hex("#37303e"));
    poly([[3, 38], [21, 29], [34, 12], [26, 31], [8, 48]], INK);
    poly([[7, 80], [24, 65], [31, 43], [29, 65], [17, 79], [8, 88]], INK);
    lineBuffer(buf, xx(2), 103, xx(1), 134, hex("#66514b"));
    lineBuffer(buf, xx(8), 148, xx(31), 163, hex("#66514b"));
    leafMass(buf, xx(26), 20, 26, 14, hex("#11162c"), 701 + side);
    leafMass(buf, xx(30), 47, 19, 10, hex("#141d32"), 704 + side);
    for (let i = 0; i < 40; i++) {
      const x = 13 + rand(608, i, side) * 34, y = 41 + rand(609, i, side) * 15;
      const at = Math.round(y) * W + Math.round(xx(x));
      if (buf[at] === hex("#141d32")) {
        lineBuffer(buf, xx(x), y, xx(x + 2), y - 1, i % 5 ? hex("#27364a") : hex("#61524f"));
      }
    }
    fern(buf, xx(21), 154, 8, moss);
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
  const cacheKey = `${kind}-${night ? "night" : "day"}`;
  const cachedScene = SCENE_CACHE[cacheKey];
  const bgBase = cachedScene?.bgBase ?? makeBackground(kind, night);
  const bgFlash = cachedScene?.bgFlash ?? (kind === "storm" ? new Uint32Array(W * H) : null);
  if (kind === "storm" && !cachedScene) {
    const flashTone = hex("#7473a4");
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const interior = Math.exp(-(((x - 174) / 115) ** 2 + ((y - 24) / 35) ** 2));
      const strength = y < 130 ? 0.08 + interior * 0.6 : 0.035;
      bgFlash[y * W + x] = mix(bgBase[y * W + x], flashTone, strength);
    }
  }
  const staticFrame = cachedScene?.staticFrame ?? createFrame(W, H);
  if (staticFrame && !cachedScene) {
    const staticPainter = painterFor(staticFrame);
    staticPainter.place(0, 0);
    if (kind === "storm") drawShelter(staticPainter); else drawLakeBank(staticPainter);
    SCENE_CACHE[cacheKey] = { bgBase, bgFlash, staticFrame };
  }
  const rainBack = kind === "storm" ? makeRainDrops(40, 701, 25) : [];
  const rainFront = kind === "storm" ? makeRainDrops(24, 802, 31) : [];
  const fire = createFx(campfire, { x: fireX, y: GROUND_Y, height: kind === "storm" ? 13 : 17, seed: kind === "storm" ? 35 : 72, light: 0.72 });

  function background() {
    if (kind !== "storm" || flash <= 0.01) return bgBase;
    return bgFlash;
  }

  function drawShelter(p) {
    // One grounded cliff mass rises on the left and rolls out into a long, heavy roof.
    const cliff = [[35, 141], [38, 117], [42, 99], [49, 80], [58, 66], [72, 56], [91, 50], [112, 47], [134, 49], [156, 54], [181, 59], [208, 64], [234, 70], [252, 79], [263, 90], [258, 99], [239, 95], [217, 91], [194, 87], [171, 84], [148, 81], [129, 82], [118, 89], [112, 106], [111, 126], [117, 141]];
    p.poly(cliff, INK);
    p.poly([[39, 137], [42, 116], [47, 98], [53, 81], [62, 68], [76, 59], [94, 54], [113, 52], [134, 54], [156, 59], [181, 64], [208, 69], [233, 75], [249, 83], [257, 90], [239, 89], [216, 85], [193, 81], [170, 78], [147, 76], [127, 77], [113, 84], [105, 103], [103, 126], [108, 138]], pal.rock);
    // Sloped wall facets climb continuously into the overhang; the cave opening is inset behind the heroine.
    p.poly([[41, 133], [45, 111], [51, 91], [59, 75], [71, 65], [87, 59], [102, 57], [91, 72], [86, 95], [85, 119], [91, 139]], pal.rockMid);
    p.poly([[48, 102], [53, 83], [65, 70], [78, 64], [90, 62], [82, 73], [76, 91], [69, 110], [59, 128], [48, 136]], pal.rockLit);
    p.poly([[88, 59], [104, 54], [123, 54], [146, 59], [171, 64], [197, 69], [223, 75], [246, 84], [258, 91], [238, 88], [215, 83], [191, 79], [168, 75], [145, 72], [123, 72], [104, 77], [92, 83], [84, 76]], pal.rockMid);
    p.poly([[95, 58], [110, 55], [128, 57], [149, 61], [171, 66], [194, 70], [217, 75], [237, 82], [219, 79], [196, 75], [173, 71], [151, 67], [130, 65], [111, 67], [98, 72]], pal.rockLit);
    // Deep, ink-shaded cave ceiling and back wall; there is no detached slab or support post.
    p.poly([[104, 84], [119, 77], [138, 74], [159, 76], [183, 80], [207, 84], [232, 90], [252, 96], [246, 111], [235, 120], [231, 139], [116, 139], [111, 118], [111, 101]], pal.shelter);
    p.poly([[111, 87], [128, 80], [146, 79], [166, 81], [190, 85], [214, 89], [236, 96], [243, 101], [231, 102], [209, 97], [186, 93], [164, 90], [143, 88], [124, 91]], pal.shelterTop);
    // Tinted stone seams, fractured edges and a few lichen patches anchor the hand-built cliff.
    p.polyline([[50, 105], [57, 98], [55, 89], [62, 83]], INK);
    p.polyline([[78, 87], [84, 81], [81, 75], [88, 69]], INK);
    p.polyline([[96, 124], [103, 117], [100, 108], [106, 101]], INK);
    p.polyline([[125, 73], [133, 70], [136, 64]], INK);
    p.polyline([[172, 74], [180, 72], [184, 67]], INK);
    p.polyline([[211, 80], [218, 78], [220, 73]], INK);
    p.poly([[57, 78], [67, 68], [77, 65], [81, 68], [75, 76], [66, 82]], pal.moss);
    p.poly([[100, 53], [111, 50], [126, 52], [132, 55], [119, 56], [107, 59]], pal.moss);
    p.poly([[161, 59], [171, 61], [178, 65], [174, 67], [165, 64]], pal.moss);
    p.poly([[222, 72], [235, 75], [244, 80], [239, 82], [229, 78]], pal.moss);
    for (const [x, y, h] of [[59, 74, 5], [69, 67, 4], [108, 53, 4], [118, 52, 6], [169, 63, 5], [233, 76, 5]])
      p.line(x, y, x + ((x % 3) - 1), y - h, pal.moss);
    // Long strata break into short offsets, following the weight of the rock.
    for (const [x, y, length] of [[62, 92, 18], [48, 115, 19], [70, 73, 19], [101, 61, 31], [143, 65, 28], [187, 76, 27], [216, 84, 26]]) {
      p.polyline([[x, y + 5], [x + 5, y], [x + length - 8, y + 2], [x + length, y + 1]], pal.rockMid);
      p.line(x + 7, y + 1, x + length - 8, y + 3, pal.rockLit);
    }
    for (let i = 0; i < 60; i++) {
      const x = 70 + rand(408, i, 1) * 174;
      const y = 51 + (x - 108) * 0.18 + rand(408, i, 2) * 6;
      p.ellipse(x, Math.max(54, y), 2 + i % 4, 1 + i % 2, i % 3 ? pal.moss : hex("#62715b"));
    }
    p.poly([[115, 103], [124, 97], [149, 99], [145, 103], [126, 103], [118, 114], [116, 133]], hex("#302c42"));
    p.poly([[116, 134], [134, 137], [151, 134], [167, 138], [194, 136], [232, 140], [116, 141]], hex("#342e3e"));
    p.polyline([[47, 128], [61, 119], [69, 109], [76, 104]], pal.rockMid);
    p.polyline([[53, 130], [66, 122], [76, 106], [82, 101]], pal.rockMid);
    for (let i = 0; i < 150; i++) {
      const x = 43 + Math.floor(rand(513, i, 1) * 212), y = 54 + Math.floor(rand(513, i, 2) * 83);
      const color = p.frame.color[y * W + x];
      if (color !== pal.rock && color !== pal.rockMid && color !== pal.rockLit) continue;
      const tone = color === pal.rockLit ? pal.rockMid : pal.rock;
      p.line(x, y, x + 2 + i % 4, y + (i % 2), tone);
    }
    p.polyline([[53, 131], [60, 141], [78, 147], [96, 148]], INK);
    p.polyline([[55, 133], [63, 140], [79, 145], [94, 146]], pal.moss);
    for (const [x, y, h] of [[65, 70, 7], [110, 53, 6], [169, 62, 5], [235, 77, 6]]) fern(p.frame.color, x, y, h, pal.moss);
  }

  function drawDrips(p) {
    for (const [x, edgeY] of [[119, 89], [146, 87], [175, 92], [245, 101]]) {
      const age = (time * 0.7 + x * 0.21) % 1;
      const y = edgeY + age * age * (145 - edgeY);
      p.blend(x, y, pal.rainNear, 0.55);
      p.blend(x, y + 1, pal.rainNear, 0.35);
    }
  }

  function drawShelterLight(p) {
    // Firelight stays in the additive light buffer and softly warms the underside of the cliff.
    p.glow(202, 88, 59, pal.glow, 0.15);
    p.glow(218, 135, 52, pal.ember, 0.1);
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
    // An old landing meets the water at the quiet right-hand bank.
    p.poly([[229, 136], [271, 136], [285, 148], [228, 148]], INK);
    for (let i = 0; i < 7; i++) {
      const x = 231 + i * 7;
      p.poly([[x, 137], [x + 5, 137], [x + 8, 145], [x + 1, 145]], pal.wood);
      p.line(x + 1, 137, x + 5, 137, pal.rockLit);
      p.line(x + 3, 141, x + 5, 144, pal.barkLit);
    }
    p.line(231, 135, 231, 151, INK); p.line(278, 139, 278, 154, INK);
    p.line(232, 135, 232, 150, pal.barkLit); p.line(279, 139, 279, 153, pal.barkLit);
    for (let i = 0; i < 120; i++) {
      const x = rand(503, i, 1) * W, y = 143 + rand(503, i, 2) * 6;
      if (x > 226 && x < 286) continue;
      p.ellipse(x, y, 1 + i % 3, 1, i % 4 ? hex("#435a50") : hex("#78805d"));
    }
    for (const [x, h] of [[29, 8], [58, 7], [139, 9], [183, 6], [235, 8], [281, 7]]) {
      p.line(x, 145, x - 2, 145 - h, pal.reed);
      p.line(x + 2, 146, x + 4, 145 - h * 0.8, pal.reed);
      p.line(x - 2, 145 - h, x + 1, 144 - h, pal.ember);
    }
  }

  function drawLakeMist(p) {
    for (let band = 0; band < 3; band++) {
      const cx = ((time * (1.5 + band) + band * 113) % 460) - 70;
      const cy = 106 + band * 9 + Math.sin(time * 0.3 + band) * 2;
      for (const [x, y, alpha] of MIST) p.blend(cx + x, cy + y, hex("#9aabc0"), alpha);
    }
  }

  function drawReflections(p) {
    if (night) for (let row = 0; row < 13; row++) {
      const y = 104 + row * 3, center = 218 + Math.sin(time * 1.3 + row * 1.9) * (1 + row * 0.14);
      const half = 1 + row * 0.48;
      for (let x = -half; x <= half; x++) p.blend(center + x, y, hex("#e6c99c"), (row % 3 === 0 ? 0.53 : 0.27) * (1 - Math.abs(x) / (half + 2)));
    }
    if (lit) for (let row = 0; row < 9; row++) {
      const y = 116 + row * 3, center = fireX + Math.sin(time * 2 + row * 2.1) * 2;
      const half = 1 + row * 0.55;
      for (let x = -half; x <= half; x++) p.blend(center + x, y, pal.ember, 0.2 + (row % 3) * 0.12);
    }
  }

  function drawLogs(p) {
    const x = fireX;
    p.ellipse(x, GROUND_Y + 1, 17, 3, INK);
    p.line(x - 10, GROUND_Y - 1, x + 8, GROUND_Y - 5, pal.wood);
    p.line(x - 8, GROUND_Y - 4, x + 10, GROUND_Y, pal.wood);
    p.line(x - 8, GROUND_Y - 2, x + 7, GROUND_Y - 5, pal.barkLit);
    if (ignition > -Infinity && time - ignition < 1.5) {
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
    const drops = front ? rainFront : rainBack;
    for (const drop of drops) {
      const phase = (time * drop.speed + drop.offset) % 180;
      const x = (drop.x - Math.floor(phase * 0.22) + W) % W;
      const y = phase - 16;
      if (x >= 108 && x <= 245 && y >= 82 && y <= 152) continue;
      if (front && y < 126) continue;
      if (!front && y > 136) continue;
      const c = front ? pal.rainNear : pal.rain;
      p.line(x, y, x - 2, y + (front ? 4 : 3), c, front ? 0.72 : 0.42);
    }
    // Small crowns in the puddle bands suggest drops hitting the wet ground.
    if (front) for (let i = 0; i < 5; i++) {
      const x = (i * 73 + Math.floor(time * 17) % W) % W, y = 158 + (i % 2) * 5;
      if (x > 108 && x < 245 && y < 160) continue;
      p.line(x - 2, y, x, y - 1, pal.rainNear, 0.6); p.line(x, y - 1, x + 2, y, pal.rainNear, 0.6);
    }
  }

  function makeRainDrops(count, seed, speed) {
    return Array.from({ length: count }, (_, i) => ({
      x: Math.floor(rand(seed, i, 2) * W),
      offset: rand(seed, i, 1) * 180,
      speed: speed * (0.86 + rand(seed, i, 3) * 0.28),
    }));
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
      if (y < 108) {
        const ry = Math.min(138, 102 + (102 - y) * 0.7 + 12), rx = x + Math.sin(time * 0.8 + i) * 2;
        p.blend(rx, ry, hex("#b9cf74"), pulse * 0.45);
        p.blend(rx + 1, ry, pal.waterLit, pulse * 0.2);
      }
    }
  }

  function drawStormPuddles(p) {
    const reflect = flash > 0.08 ? pal.rainNear : pal.puddle;
    for (const [x, y, width] of [[2, 158, 27], [266, 158, 33], [294, 164, 25]]) {
      p.line(x, y, x + width, y, reflect, flash > 0.08 ? 0.86 : 0.6);
      p.line(x + 5, y + 2, x + width - 8, y + 2, pal.puddle, 0.55);
    }
    // Amber streaks mirror the campfire in the nearest pools.
    if (lit) for (let row = 0; row < 5; row++) {
      const y = 159 + row * 2, x = fireX + Math.sin(time * 2.3 + row) * 2;
      for (let dx = -7 + row; dx <= 7 - row; dx++) p.blend(x + dx, y, row % 2 ? pal.glow : pal.ember, 0.32);
    }
    for (let i = 0; i < 6; i++) {
      const x = (i * 59 + Math.floor(time * 19)) % W, y = 155 + (i % 3) * 7;
      const pulse = 0.45 + 0.4 * Math.sin(time * 4 + i);
      p.line(x - 2, y, x, y - 2, pal.rainNear, pulse);
      p.line(x, y - 2, x + 2, y, pal.rainNear, pulse);
    }
  }

  function drawLightning(p) {
    if (flash <= 0.04) return;
    const seed = Math.floor(nextFlash), side = rand(253, seed, 4);
    const cx = side < 0.5 ? 12 + Math.floor(rand(253, seed, 2) * 22) : 275 + Math.floor(rand(253, seed, 2) * 35);
    const base = 48 + Math.floor(rand(253, seed, 3) * 30);
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
          flash = age < 0.18 ? Math.min(1, Math.exp(-age * 8) * (age < 0.08 ? 0.95 : 0.68)) : 0;
          if (age >= 0.18) nextFlash += (night ? 8 : 6) + rand(254, Math.floor(nextFlash), night ? 1 : 0) * (night ? 7 : 9);
        }
      }
      if (ignition > -Infinity && time - ignition >= 1.5) lit = true;
      if (lit) fire.update(dt);
    },
    background,
    drawBack(frame) {
      const p = painterFor(frame); p.place(0, 0);
      if (kind === "storm") {
        frame.color.set(staticFrame.color);
        drawLightning(p);
        drawDrips(p);
        if (lit) drawShelterLight(p);
        drawRain(p, false);
      } else {
        frame.color.set(staticFrame.color);
        drawReflections(p);
        if (lit) p.glow(fireX, GROUND_Y - 11, 59, pal.glow, 0.15);
        drawLakeMist(p);
        drawLakeFlies(p, false);
        drawLakeFlies(p, true);
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
      if (lit) fire.draw(frame, "front");
    },
  };
}

// Bake all static variants before a rest phase enters the animation loop.
createRest("storm");
createRest("storm", { night: true });
createRest("lake");
createRest("lake", { night: true });
