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
const FIRE_X = { storm: 238, lake: 78 };
const SEAT_X = { storm: 201, lake: 42 };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];

const SKY_STOPS = {
  storm: [[0, "#141426"], [0.42, "#25243c"], [0.76, "#403248"], [1, "#71505a"]],
  lake: [[0, "#29273e"], [0.4, "#4c4054"], [0.72, "#9a5e58"], [1, "#dc8959"]],
};
const PAL = {
  storm: {
    sky: ["#141426", "#25243c", "#403248", "#71505a"], far: "#29283b", mid: "#211e31",
    bark: "#332531", barkLit: "#554047", rock: "#544b5a", rockLit: "#746878",
    ground: "#28232e", groundTop: "#62505a", puddle: "#41485d", rain: "#8494b0", rainNear: "#bcc5d2",
    shelter: "#342931", shelterTop: "#56414a", wood: "#74503b", ember: "#f4a449", glow: "#ff9139",
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
  // Distant tree crowns and trunks keep the horizon layered without obscuring the sky.
  for (let i = 0; i < 13; i++) {
    const x = i * 29 - 6 + Math.floor(rand(41, i, 1) * 12), top = 37 + Math.floor(rand(41, i, 2) * 29);
    const width = 15 + Math.floor(rand(41, i, 3) * 17);
    for (let y = top; y < 130; y++) {
      const trunk = Math.abs(x + width / 2 - y * (rand(41, i, 4) - 0.5) * 0.2 - (x + width / 2)) < 3;
      const canopy = Math.abs(y - top) > Math.abs(((x + width / 2) % 9) - 4) * 1.8;
      if (trunk && y > top + 8) bg[y * W + Math.max(0, Math.min(W - 1, x + width / 2))] = pal.bark;
      if (canopy) {
        const left = Math.max(0, x - Math.floor((y - top) * 0.11));
        const right = Math.min(W, x + width + Math.floor((y - top) * 0.11));
        for (let xx = left; xx < right; xx++) bg[y * W + xx] = pal.far;
      }
    }
    const tx = Math.max(1, Math.min(W - 4, x + Math.floor(width * 0.55)));
    for (let y = top + 7; y < 145; y++) bg[y * W + tx] = pal.bark;
  }
  if (kind === "storm") {
    // Wet ground, broad still puddles and their reflected sky color.
    for (let y = 130; y < H; y++) for (let x = 0; x < W; x++) {
      const edge = y === 130 || y === 131;
      bg[y * W + x] = edge ? pal.groundTop : pal.ground;
      const puddle = (x > 25 && x < 94 && y > 155) || (x > 116 && x < 177 && y > 160) || (x > 261 && y > 154);
      if (puddle) bg[y * W + x] = y === 155 || y === 160 ? pal.puddle : mix(pal.ground, pal.puddle, 0.48);
    }
  } else {
    // Lake occupies the middle distance; the foreground shore remains a clear place for the heroine and fire.
    for (let y = 101; y < 151; y++) for (let x = 0; x < W; x++) {
      const ripple = y % 7 === 3 && (x * 7 + y * 3) % 29 < 4;
      bg[y * W + x] = ripple ? pal.waterMid : pal.water;
    }
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
    const k = Math.min(0.62, flash * 0.58);
    for (let i = 0; i < bgBase.length; i++) bgFlash[i] = mix(bgBase[i], hex("#b7b6d2"), k);
    return bgFlash;
  }

  function drawShelter(p) {
    // Stone overhang on a crooked timber frame; a dark interior keeps the seated figure dry and legible.
    p.poly([[114, 74], [127, 63], [155, 58], [177, 62], [198, 69], [212, 83], [208, 89], [188, 82], [162, 78], [137, 81], [119, 87]], pal.rock);
    p.poly([[120, 74], [134, 66], [157, 63], [178, 68], [197, 75], [208, 84], [187, 78], [162, 74], [139, 77]], pal.rockLit);
    p.line(125, 83, 121, 129, INK); p.line(121, 129, 128, 132, pal.bark);
    p.line(204, 84, 211, 126, INK); p.line(204, 85, 198, 128, pal.bark);
    p.line(131, 91, 198, 91, pal.bark);
    p.poly([[119, 129], [211, 129], [214, 135], [117, 135]], pal.ground);
    // Drips gather at the low roof edge and fall in small broken lines.
    for (const [x, len] of [[132, 6], [153, 10], [179, 5], [197, 8]]) {
      p.px(x, 82, pal.rainNear);
      for (let y = 84; y < 84 + len; y++) if ((y + x) % 3 !== 0) p.px(x, y, pal.rain);
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
    for (let x = 13; x < W; x += 31) p.px(x, 145 + (x % 3), pal.rock);
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
    }
  }

  function drawLightning(p) {
    if (flash <= 0.04) return;
    const cx = 65 + Math.floor(rand(253, Math.floor(nextFlash), 2) * 195), base = 48 + Math.floor(rand(253, Math.floor(nextFlash), 3) * 24);
    const bolt = [[cx, -1], [cx - 5, 15], [cx + 2, 18], [cx - 8, 36], [cx + 1, base], [cx - 2, 27], [cx - 8, 25], [cx, -1]];
    p.polyline(bolt, hex("#dfd7ee"), Math.min(0.85, flash));
    p.polyline([[cx - 3, 16], [cx - 12, 23], [cx - 15, 31]], hex("#aab5d0"), flash * 0.55);
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
        drawShelter(p);
        // A small amber bounce warms the dry alcove after ignition.
        if (lit) {
          p.glow(fireX - 23, GROUND_Y - 28, 52, pal.glow, 0.19);
          p.glow(fireX - 16, GROUND_Y - 11, 34, pal.ember, 0.15);
        }
        drawLightning(p);
        drawRain(p, false);
      } else {
        drawLakeBank(p);
        if (lit) p.glow(fireX, GROUND_Y - 11, 59, pal.glow, 0.15);
        drawLakeFlies(p, false);
      }
      drawLogs(p);
      if (lit) fire.draw(frame, "back");
    },
    drawFront(frame) {
      const p = painterFor(frame); p.place(0, 0);
      if (kind === "storm") drawRain(p, true);
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
