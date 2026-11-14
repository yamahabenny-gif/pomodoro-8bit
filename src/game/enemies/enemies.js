// CONTRACT (owned by issue "Gegner"). Forest foes, all facing left toward the heroine:
//   "gnome"  small, quick, 1-2 hits    (pointy red hat, beard)
//   "orc"    medium, green, axe, 3 hits
//   "ogre"   big, slow, club, 5 hits, ground shake on landing blows
//
// ENEMY_KINDS: ["gnome", "orc", "ogre"]
// createEnemy(kind, { x, y }) returns:
//   kind, x, y, hp, maxHp
//   state: "approach" | "fight" | "dying" | "dead"
//   approach(targetX)            walk left until in range of targetX, then state = "fight"
//   attack({ onHit })            plays its swing; onHit on contact (the heroine plays "hurt", never dies)
//   hit(dmg)                     flash + knockback; at hp <= 0 plays death (pixelfx spawn/poof or similar)
//   update(dt), draw(frame)
//   isDead()                     true once the death effect has finished

import { createFx } from "../../../vendor/pixelfx/src/core/index.js";
import * as hitSpark from "../../../vendor/pixelfx/src/fx/impacts/hit-spark.js";
import * as bluntHit from "../../../vendor/pixelfx/src/fx/impacts/blunt-hit.js";
import * as groundSlam from "../../../vendor/pixelfx/src/fx/impacts/ground-slam.js";
import * as poof from "../../../vendor/pixelfx/src/fx/spawn/poof.js";

export const ENEMY_KINDS = ["gnome", "orc", "ogre"];

const INK = "#17121f";
const palettes = {
  gnome: { ".": null, i: INK, r: "#a92e43", R: "#e04c55", s: "#f3b86a", S: "#ffe0a0", b: "#eee4d0", B: "#fff8e7", l: "#54405a", L: "#8a6571", w: "#b8c6bb", W: "#e6f1db" },
  orc: { ".": null, i: INK, g: "#39734d", G: "#62a45e", h: "#a4ce75", d: "#274c3d", a: "#594536", A: "#896745", c: "#bd9861", C: "#e0bd7f", m: "#ded3b5", M: "#fff0ca", s: "#9ba4a0", S: "#d6d9ca", w: "#c6c4a8" },
  ogre: { ".": null, i: INK, g: "#7d7a5c", G: "#a3a07a", h: "#c0bc8e", d: "#57543e", a: "#49372e", A: "#755642", c: "#a27a4e", C: "#c09462", m: "#ded2b8", M: "#fff0cc", b: "#89513f", B: "#b56a4d", s: "#85816f", S: "#c0b899", w: "#d9cfad" },
};

// Rows are drawn at native pixel size, with one ink pixel around the flat color shapes.
const sprites = {
  gnome: [
    ".......R........", "......RiR.......", ".....RiiiR......", "...RRRRRRRRR....",
    "....iSSSSSSi....", "....iSSlSSSi....", "....iSSsSSSi....",
    "...iiBBBBBBii...", "....iiBBBBii....", ".....iBBBBi.....", "......iBBi......",
    "....iLLLLLLi....", "...iLLLLLLLLi...", "....iLLLLLLi....",
    "...ii....ii.....", "..ii......ii....",
  ],
  orc: [
    "........iiiiii..........", ".......iGGGGGGi.........", "......iGhhGGGGGi........", ".....iGGGGGGGGGi........",
    "....iGGGGGGGGGGGi.......", "....iGdddGGGdddGGii......", "....iGGGGGGGGGGGmi......", ".....iGGGMMMMGGGmi.......",
    "......iGGGMMGGGmi........", ".......iGGGMMmi..........", "........iGGGGi............", ".......iGGGGGGi...........",
    "......iGGGaaGGGi..........", ".....iGGaaCAaGGi..........", "....iGGGaaCAaaGGi.........", "....iGGGaaCAaaGGi.........",
    ".....iGGGAAAAaGGi..........", "......iGGAcCAaGGi.........", ".......iGGGGGGGi...........", "......iaaaaaaai.............",
    ".....ia...a...ai............", "....ii....a....ii...........", "...ii..........ii...........", "..ii............ii..........",
    ".ii..............ii.........", ".i................i.........",
  ],
};

function makeOgreSprite() {
  const grid = Array.from({ length: 40 }, () => Array(36).fill("."));
  const ellipse = (cx, cy, rx, ry, fill) => {
    for (let y = Math.max(0, Math.floor(cy - ry - 1)); y <= Math.min(39, cy + ry + 1); y++)
      for (let x = Math.max(0, Math.floor(cx - rx - 1)); x <= Math.min(35, cx + rx + 1); x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d <= 1) grid[y][x] = "i";
        if (d <= 0.72) grid[y][x] = fill;
      }
  };
  const rect = (x, y, w, h, fill) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy][xx] = fill;
  };
  // Feet and legs sit behind the broad body.
  ellipse(10, 35, 5, 4, "d"); ellipse(26, 35, 5, 4, "d");
  ellipse(8, 38, 7, 2, "d"); ellipse(28, 38, 7, 2, "d");
  ellipse(7, 19, 5, 9, "d"); ellipse(29, 19, 5, 9, "g");
  ellipse(7, 20, 3, 6, "g"); ellipse(29, 20, 3, 6, "G");
  // A smaller head, heavy shoulders, and a rounded belly make the scale read clearly.
  ellipse(18, 7, 7, 7, "g");
  ellipse(16, 6, 3, 3, "G");
  ellipse(18, 22, 13, 13, "g");
  ellipse(19, 25, 8, 6, "G");
  ellipse(14, 16, 6, 5, "G");
  // Eyes, brow, underbite and two tusks.
  rect(13, 5, 4, 1, "i"); rect(20, 5, 4, 1, "i");
  rect(14, 6, 2, 2, "m"); rect(21, 6, 2, 2, "m");
  rect(15, 6, 1, 2, "i"); rect(22, 6, 1, 2, "i");
  rect(13, 10, 11, 2, "d");
  rect(13, 11, 2, 3, "M"); rect(22, 11, 2, 3, "M");
  rect(16, 12, 6, 1, "i");
  // Leather loincloth with a belt, bright studs and separate pleats.
  rect(9, 29, 18, 2, "i"); rect(10, 30, 16, 4, "a");
  rect(10, 30, 16, 1, "A"); rect(17, 30, 3, 2, "C");
  rect(12, 32, 1, 2, "c"); rect(17, 32, 1, 2, "c"); rect(22, 32, 1, 2, "c");
  return grid.map((row) => row.join(""));
}

sprites.ogre = makeOgreSprite();

const stats = {
  gnome: { hp: 2, speed: 38, reach: 19, attack: 0.62, contact: 0.28, height: 16, impact: hitSpark },
  orc: { hp: 3, speed: 23, reach: 25, attack: 0.92, contact: 0.43, height: 29, impact: hitSpark },
  ogre: { hp: 5, speed: 12, reach: 32, attack: 1.3, contact: 0.68, height: 39, impact: bluntHit },
};

const colorValue = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  return (255 << 24) | (b << 16) | (g << 8) | r;
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function createEnemy(kind, opts = {}) {
  if (!ENEMY_KINDS.includes(kind)) throw new RangeError(`Unknown enemy kind: ${kind}`);
  const spec = stats[kind], sprite = sprites[kind], colors = palettes[kind];
  let x = opts.x ?? 0, y = opts.y ?? 150, hp = spec.hp, state = "approach";
  let clock = 0, attackT = 0, hitFlash = 0, recoil = 0, targetX = x;
  let queuedHit = null, didHit = false, impactFx = null, impactKind = "hit", deathFx = null, slamFx = null;
  const maxHp = hp;

  function startImpact(kind = "hit") {
    impactKind = kind;
    const mod = kind === "slam" ? groundSlam : kind === "blunt" ? bluntHit : hitSpark;
    const fxOpts = {
      x: x - (kind === "slam" ? 0 : 2), y: y - (kind === "slam" ? 0 : spec.height * 0.55),
      seed: (Math.abs(Math.round(x * 31 + clock * 1000)) % 997) + 1,
    };
    if (kind === "slam") Object.assign(fxOpts, {
      palette: ["#292137", "#51415d", "#8f7087", "#d6aa80", "#f2d49c", "#fff0ce", "#ffffff"],
      height: 1,
      reach: 78,
    });
    else fxOpts.height = 18;
    impactFx = createFx(mod, fxOpts);
  }

  function beginDeath() {
    state = "dying";
    attackT = 0;
    impactFx = null;
    deathFx = createFx(poof, { x, y, seed: (Math.abs(Math.round(x * 13 + clock * 1000)) % 997) + 1 });
  }

  const enemy = {
    kind,
    get x() { return x; },
    set x(value) { x = value; },
    get y() { return y; },
    set y(value) { y = value; },
    get hp() { return hp; },
    get maxHp() { return maxHp; },
    get state() { return state; },
    approach(destination) {
      if (state === "dying" || state === "dead") return;
      targetX = destination;
      if (x <= targetX + spec.reach) {
        x = Math.min(x, targetX + spec.reach);
        state = "fight";
      } else state = "approach";
    },
    attack({ onHit } = {}) {
      if (state !== "fight" || attackT > 0 || state === "dying") return false;
      attackT = spec.attack;
      didHit = false;
      queuedHit = onHit;
      return true;
    },
    hit(dmg = 1) {
      if (state === "dying" || state === "dead" || dmg <= 0) return hp;
      hp = Math.max(0, hp - dmg);
      hitFlash = 0.12;
      recoil = 3 + (kind === "ogre" ? 2 : 0);
      startImpact(kind === "ogre" ? "blunt" : "hit");
      if (hp <= 0) beginDeath();
      return hp;
    },
    update(dt) {
      dt = Math.max(0, dt);
      clock += dt;
      if (hitFlash > 0) hitFlash = Math.max(0, hitFlash - dt);
      if (recoil > 0) recoil = Math.max(0, recoil - dt * 18);
      impactFx?.update(dt);
      if (impactFx?.done()) impactFx = null;
      slamFx?.update(dt);
      if (slamFx?.done()) slamFx = null;
      if (state === "dying") {
        deathFx?.update(dt);
        if (deathFx?.done()) state = "dead";
        return;
      }
      if (state === "dead") return;
      if (state === "approach") {
        x = Math.max(targetX + spec.reach, x - spec.speed * dt);
        if (x <= targetX + spec.reach) state = "fight";
      }
      if (attackT > 0) {
        const previous = attackT;
        attackT = Math.max(0, attackT - dt);
        const elapsed = spec.attack - attackT;
        if (!didHit && elapsed >= spec.contact) {
          didHit = true;
          queuedHit?.({ kind, damage: 1 });
          if (kind === "ogre") {
            slamFx = createFx(groundSlam, {
              x: x - 12, y, seed: (Math.abs(Math.round(x * 7 + clock * 1000)) % 997) + 1,
              palette: ["#292137", "#51415d", "#8f7087", "#d6aa80", "#f2d49c", "#fff0ce", "#ffffff"], reach: 78,
            });
          } else startImpact("hit");
        }
        if (previous > 0 && attackT === 0) queuedHit = null;
      }
    },
    draw(frame) {
      if (state === "dead") return;
      if (state === "dying") {
        deathFx?.draw(frame);
        return;
      }
      const C = frame.color, W = frame.w, H = frame.h, rows = sprite;
      const width = Math.max(...rows.map((row) => row.length));
      const walk = state === "approach";
      const phase = clock * (kind === "gnome" ? 13 : kind === "orc" ? 8 : 4.6);
      const bob = walk ? Math.round(Math.sin(phase) * (kind === "gnome" ? 2 : 1)) : Math.round(Math.sin(clock * 3) * 0.5);
      const attackU = attackT > 0 ? (spec.attack - attackT) / spec.attack : 0;
      const lean = attackT > 0 ? Math.round(Math.sin(attackU * Math.PI) * (kind === "gnome" ? 2 : kind === "orc" ? 2 : 1)) : 0;
      const footX = Math.round(x + recoil - lean), top = Math.round(y - rows.length + bob);
      const left = footX - Math.floor(width / 2);
      const flash = hitFlash > 0;
      for (let row = 0; row < rows.length; row++) {
        for (let col = 0; col < rows[row].length; col++) {
          const key = rows[row][col];
          if (key === " " || key === ".") continue;
          let px = left + col, py = top + row;
          // A quick hop for the gnome, heavy alternating steps for the larger foes.
          if (walk && kind === "gnome") py -= Math.max(0, Math.round(Math.sin(phase * 0.5) * 2));
          else if (walk && row > rows.length - 7 && row < rows.length - 2) px += Math.round(Math.sin(phase) * (kind === "ogre" ? 1 : 0.5));
          if (px < 0 || py < 0 || px >= W || py >= H) continue;
          C[py * W + px] = colorValue(flash ? "#ffffff" : (colors[key] ?? INK));
        }
      }
      // Each weapon stays in hand while approaching and follows the attack swing.
      {
        const swing = attackT > 0 ? attackU : 0;
        const handX = left + Math.floor(width * 0.3) - Math.round(swing * 4);
        const handY = top + Math.floor(rows.length * 0.64) - Math.round(Math.sin(swing * Math.PI) * 5);
        const handleLen = kind === "gnome" ? 3 : kind === "orc" ? 7 : 15;
        const wood = colorValue(kind === "gnome" ? "#59404a" : kind === "orc" ? "#684c37" : "#60463b");
        const brightWood = colorValue(kind === "orc" ? "#a27a4e" : "#a07053");
        const metal = colorValue(kind === "gnome" ? "#dce2cf" : "#d6d9ca");
        const put = (px, py, color) => {
          if (px >= 0 && py >= 0 && px < W && py < H) C[py * W + px] = color;
        };
        for (let n = 0; n < handleLen; n++) {
          const px = handX - n, py = handY - Math.round(swing * n * 0.65);
          put(px, py, n % 3 === 0 ? brightWood : wood);
          if (kind === "ogre") put(px, py + 1, wood);
        }
        const tipX = handX - handleLen, tipY = handY - Math.round(swing * handleLen * 0.65);
        if (kind === "gnome") {
          for (let n = 1; n <= 4; n++) put(tipX - n, tipY - Math.round(swing * n * 0.35), metal);
        } else if (kind === "orc") {
          // Dark edging and a broad crescent make the axe head read at native scale.
          const blade = [[0, -3], [-1, -3], [-2, -2], [-3, -1], [-4, 0], [-3, 1], [-2, 2], [-1, 3], [0, 3]];
          for (const [dx, dy] of blade) put(tipX + dx, tipY + dy, colorValue(INK));
          for (const [dx, dy] of [[0, -2], [-1, -2], [-2, -1], [-3, 0], [-2, 1], [-1, 2], [0, 2]]) put(tipX + dx, tipY + dy, metal);
          put(tipX - 3, tipY, colorValue("#fff0ca"));
        } else {
          // A broad dark club with a single lit knot at its striking end.
          for (const [dx, dy] of [[0, -4], [-1, -4], [-2, -3], [-1, -3], [0, -3], [1, -3], [2, -3], [3, -2], [-3, -2], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [3, -1], [4, -1], [-4, -1], [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1], [-4, 0], [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [-3, 1], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2]]) put(tipX + dx, tipY + dy, wood);
          for (const [dx, dy] of [[-2, -3], [-1, -3], [-3, -2], [-2, -2], [-4, -1], [-3, -1]]) put(tipX + dx, tipY + dy, brightWood);
          put(tipX + 3, tipY + 1, colorValue("#48352b"));
        }
      }
      impactFx?.draw(frame);
      slamFx?.draw(frame);
    },
    isDead() { return state === "dead"; },
  };
  return enemy;
}
