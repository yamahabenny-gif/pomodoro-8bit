// CONTRACT (owned by issue "Gegner"). Forest foes, all facing left toward the heroine:
//   "gnome"  small, quick, 1-2 hits    (pointy red hat, beard)
//   "orc"    medium, green half-orc, axe and shield, 3 hits, blocks once per fight
//   "ogre"   big, slow, club, 5 hits, ground shake on landing blows
//
//   WAVE 4 (issue "Gegner neu"): the orc becomes a broad, muscular half-orc (topknot, beard, big axe, round wooden
//   shield, fur and leather) and blocks now and then; new "golem": a stone golem, mossy shoulder, glowing orange
//   cracks and eyes, 7 hits, crumbles to rubble on death. Kinds then: ["gnome", "orc", "ogre", "golem"].
//
// ENEMY_KINDS: ["gnome", "orc", "ogre", "golem"]
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

export const ENEMY_KINDS = ["gnome", "orc", "ogre", "golem"];

const INK = "#17121f";
const palettes = {
  gnome: { ".": null, i: INK, r: "#a92e43", R: "#e04c55", s: "#f3b86a", S: "#ffe0a0", b: "#eee4d0", B: "#fff8e7", l: "#54405a", L: "#8a6571", w: "#b8c6bb", W: "#e6f1db" },
  orc: { ".": null, i: INK, g: "#39734d", G: "#62a45e", h: "#a4ce75", d: "#274c3d", a: "#594536", A: "#896745", c: "#bd9861", C: "#e0bd7f", m: "#ded3b5", M: "#fff0ca", s: "#9ba4a0", S: "#d6d9ca", w: "#c6c4a8", f: "#4b352f", F: "#775142", p: "#d8c9a4" },
  ogre: { ".": null, i: INK, g: "#7d7a5c", G: "#a3a07a", h: "#c0bc8e", d: "#57543e", a: "#49372e", A: "#755642", c: "#a27a4e", C: "#c09462", m: "#ded2b8", M: "#fff0cc", b: "#89513f", B: "#b56a4d", s: "#85816f", S: "#c0b899", w: "#d9cfad" },
  golem: { ".": null, i: INK, s: "#494653", S: "#716b70", l: "#958b82", L: "#c3b7a1", h: "#dfcba7", o: "#a9442d", O: "#ff782f", y: "#ffc75e", m: "#38533f", M: "#65804a", c: "#7160a0" },
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
    // Rebuilt below from rounded forms so the half-orc reads as a broad, muscular silhouette.
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

function makeOrcSprite() {
  const grid = Array.from({ length: 32 }, () => Array(36).fill("."));
  const rect = (x, y, w, h, fill) => {
    for (let yy = Math.max(0, y); yy < Math.min(32, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(36, x + w); xx++) grid[yy][xx] = fill;
  };
  const ellipse = (cx, cy, rx, ry, fill, outline = "i") => {
    for (let y = Math.max(0, Math.floor(cy - ry - 1)); y <= Math.min(31, cy + ry + 1); y++)
      for (let x = Math.max(0, Math.floor(cx - rx - 1)); x <= Math.min(35, cx + rx + 1); x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d <= 1) grid[y][x] = outline;
        if (d <= 0.78) grid[y][x] = fill;
      }
  };
  // Sturdy boots and planted legs support the wide torso.
  ellipse(10, 26, 6, 5, "d"); ellipse(26, 26, 6, 5, "d");
  rect(6, 27, 8, 2, "f"); rect(22, 27, 8, 2, "f");
  rect(5, 29, 10, 2, "F"); rect(21, 29, 10, 2, "F");
  rect(6, 29, 2, 1, "p"); rect(24, 29, 2, 1, "p");
  ellipse(11, 21, 6, 7, "G"); ellipse(25, 21, 6, 7, "g");
  rect(12, 20, 2, 6, "h"); rect(23, 20, 2, 6, "d");
  // Thick forearms and biceps frame the chest.
  ellipse(5, 15, 4, 6, "g"); ellipse(31, 15, 4, 6, "G");
  ellipse(5, 20, 3, 5, "G"); ellipse(31, 20, 3, 5, "g");
  rect(3, 22, 5, 3, "g"); rect(29, 22, 5, 3, "G");
  // Large shoulders, chest plates and three-tone muscle modeling.
  ellipse(9, 13, 7, 6, "G"); ellipse(27, 13, 7, 6, "g");
  ellipse(18, 16, 13, 9, "g");
  ellipse(13, 14, 7, 5, "G"); ellipse(23, 14, 7, 5, "G");
  ellipse(12, 13, 4, 3, "h"); ellipse(22, 13, 4, 3, "h");
  rect(17, 12, 2, 9, "d"); rect(7, 16, 3, 3, "d"); rect(26, 16, 3, 3, "d");
  // Loincloth, broad belt, and bright diagonal sash over the chest.
  rect(8, 22, 20, 2, "i"); rect(9, 23, 18, 4, "a"); rect(10, 23, 16, 1, "A");
  rect(16, 23, 4, 2, "C"); rect(11, 25, 2, 2, "c"); rect(23, 25, 2, 2, "c");
  for (let n = 0; n < 12; n++) {
    const xx = 25 - n, yy = 10 + n;
    rect(xx, yy, 2, 2, n % 3 === 0 ? "M" : "m");
    rect(xx, yy, 1, 2, "p");
  }
  // Face, tusks, beard and tied black topknot.
  ellipse(18, 6, 7, 6, "G");
  rect(12, 5, 12, 2, "d"); rect(14, 6, 3, 1, "h"); rect(20, 6, 3, 1, "h");
  rect(15, 6, 2, 2, "i"); rect(20, 6, 2, 2, "i");
  rect(13, 9, 11, 4, "f"); rect(15, 9, 2, 2, "M"); rect(20, 9, 2, 2, "M");
  rect(16, 10, 5, 2, "F"); rect(17, 11, 3, 2, "i");
  rect(18, 1, 4, 3, "i"); rect(20, 0, 3, 3, "f"); rect(21, 1, 3, 2, "F");
  return grid.map((row) => row.join(""));
}
sprites.orc = makeOrcSprite();

function makeGolemSprite() {
  const grid = Array.from({ length: 46 }, () => Array(38).fill("."));
  const rect = (x, y, w, h, fill) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy][xx] = fill; };
  const block = (x, y, w, h, fill, shade = "s") => {
    // Chipped corners and uneven side planes keep the stone plates from reading as perfect tiles.
    for (let row = -1; row <= h; row++) {
      const chip = row === -1 || row === h || (row + x) % 7 === 0 ? 1 : 0;
      rect(x - 1 + chip, y + row, w + 2 - chip * 2, 1, "i");
    }
    for (let row = 0; row < h; row++) {
      const chip = row === 0 || row === h - 1 || (row * 3 + x) % 11 === 0 ? 1 : 0;
      rect(x + chip, y + row, w - chip * 2, 1, fill);
    }
    rect(x + 2, y + 1, Math.max(1, w - 4), 1, shade);
  };
  // Chunky joints, faceted stone plates and broad hanging fists.
  block(5, 22, 9, 12, "S", "l"); block(24, 22, 9, 12, "S", "l");
  block(6, 33, 9, 8, "s", "S"); block(23, 33, 9, 8, "s", "S");
  block(3, 28, 8, 10, "l", "L"); block(27, 28, 8, 10, "l", "L");
  block(9, 14, 20, 19, "S", "l"); block(11, 16, 16, 14, "L", "h");
  // Shoulder stones and a mossy crystal crown.
  block(3, 15, 10, 9, "l", "L"); block(25, 13, 10, 10, "M", "m");
  block(28, 8, 4, 7, "c", "L"); rect(27, 12, 6, 3, "M");
  block(13, 5, 13, 10, "l", "L"); block(15, 7, 9, 6, "S", "h");
  block(16, 2, 7, 5, "S", "L");
  rect(15, 8, 4, 2, "i"); rect(21, 8, 4, 2, "i");
  rect(16, 8, 2, 1, "O"); rect(22, 8, 2, 1, "O"); rect(17, 8, 1, 1, "y"); rect(23, 8, 1, 1, "y");
  // Molten seams split the chest and run down into the waist plates.
  rect(18, 18, 2, 3, "i"); rect(19, 19, 2, 2, "y"); rect(20, 20, 2, 3, "O");
  rect(17, 21, 3, 2, "O"); rect(18, 22, 2, 2, "y"); rect(19, 24, 2, 4, "O");
  rect(13, 23, 4, 1, "i"); rect(14, 24, 3, 1, "O"); rect(16, 25, 2, 2, "y");
  rect(22, 25, 3, 1, "i"); rect(22, 26, 3, 1, "O");
  return grid.map((row) => row.join(""));
}
sprites.golem = makeGolemSprite();

const stats = {
  gnome: { hp: 2, speed: 38, reach: 19, attack: 0.62, contact: 0.28, height: 16, impact: hitSpark },
  orc: { hp: 3, speed: 21, reach: 31, attack: 1.05, contact: 0.43, height: 32, impact: hitSpark },
  ogre: { hp: 5, speed: 12, reach: 32, attack: 1.3, contact: 0.68, height: 39, impact: bluntHit },
  golem: { hp: 7, speed: 7, reach: 39, attack: 1.7, contact: 0.92, height: 46, impact: bluntHit },
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
  let queuedHit = null, didHit = false, didBlock = false, blockT = 0, impactFx = null, impactKind = "hit", deathFx = null, slamFx = null;
  let rubble = [], deathT = 0;
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
    deathT = 0;
    impactFx = null;
    if (kind === "golem") {
      rubble = Array.from({ length: 13 }, (_, index) => ({
        x: x - 15 + (index * 17 % 31), y: y - 5 - (index * 11 % 27),
        vx: -20 + index * 3.4, vy: -24 - (index % 5) * 7,
        size: 2 + (index % 4), color: ["#494653", "#716b70", "#958b82", "#c3b7a1", "#ff782f"][index % 5],
      }));
      deathFx = null;
    } else deathFx = createFx(poof, { x, y, seed: (Math.abs(Math.round(x * 13 + clock * 1000)) % 997) + 1 });
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
      if (kind === "orc" && !didBlock && state === "fight" && clock % 5 < 0.85) {
        didBlock = true;
        blockT = 0.32;
        startImpact("block");
        return hp;
      }
      hp = Math.max(0, hp - dmg);
      hitFlash = 0.12;
      recoil = 3 + (kind === "ogre" || kind === "golem" ? 2 : 0);
      startImpact(kind === "ogre" || kind === "golem" ? "blunt" : "hit");
      if (hp <= 0) beginDeath();
      return hp;
    },
    update(dt) {
      dt = Math.max(0, dt);
      clock += dt;
      if (hitFlash > 0) hitFlash = Math.max(0, hitFlash - dt);
      if (blockT > 0) blockT = Math.max(0, blockT - dt);
      if (recoil > 0) recoil = Math.max(0, recoil - dt * 18);
      impactFx?.update(dt);
      if (impactFx?.done()) impactFx = null;
      slamFx?.update(dt);
      if (slamFx?.done()) slamFx = null;
      if (state === "dying") {
        deathT += dt;
        if (kind === "golem") {
          for (const bit of rubble) {
            bit.x += bit.vx * dt; bit.y += bit.vy * dt; bit.vy += 100 * dt;
          }
        }
        deathFx?.update(dt);
        if (kind === "golem" ? deathT > 1.05 : deathFx?.done()) state = "dead";
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
          if (kind === "ogre" || kind === "golem") {
            slamFx = createFx(groundSlam, {
              x: x - 12, y, seed: (Math.abs(Math.round(x * 7 + clock * 1000)) % 997) + 1,
              palette: kind === "golem" ? ["#292137", "#51415d", "#716b70", "#958b82", "#c3b7a1", "#ff782f", "#ffc75e"] : ["#292137", "#51415d", "#8f7087", "#d6aa80", "#f2d49c", "#fff0ce", "#ffffff"], reach: kind === "golem" ? 94 : 78,
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
        if (kind === "golem") {
          const C = frame.color, W = frame.w;
          for (const bit of rubble) {
            const px = Math.round(bit.x), py = Math.round(bit.y), color = colorValue(bit.color);
            for (let yy = 0; yy < bit.size; yy++) for (let xx = 0; xx < bit.size; xx++)
              if (px + xx >= 0 && py + yy >= 0 && px + xx < frame.w && py + yy < frame.h) C[(py + yy) * W + px + xx] = color;
          }
        }
        return;
      }
      const C = frame.color, W = frame.w, H = frame.h, rows = sprite;
      const width = Math.max(...rows.map((row) => row.length));
      const walk = state === "approach";
      const phase = clock * (kind === "gnome" ? 13 : kind === "orc" ? 8 : kind === "golem" ? 2.4 : 4.6);
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
          const pulse = (Math.sin(clock * 5) + 1) * 0.5;
          const shade = kind === "golem" && key === "O" ? (pulse > 0.48 ? "#ff963e" : "#d34c27")
            : kind === "golem" && key === "y" ? (pulse > 0.48 ? "#ffe08a" : "#ff9d43") : (colors[key] ?? INK);
          C[py * W + px] = colorValue(flash ? "#ffffff" : shade);
        }
      }
      if (kind === "orc") {
        // Round shield with iron rim, wood boards and boss. A raised guard frames the block sparks.
        const sx = left + width - 8, sy = top + 18 - (blockT > 0 ? 2 : 0);
        const shield = [
          [-1,-6,"i"],[0,-6,"s"],[1,-6,"s"],[-3,-5,"s"],[-2,-5,"a"],[-1,-5,"A"],[0,-5,"A"],[1,-5,"a"],[2,-5,"s"],
          [-4,-4,"s"],[-3,-4,"a"],[-2,-4,"A"],[-1,-4,"a"],[0,-4,"A"],[1,-4,"A"],[2,-4,"a"],[3,-4,"s"],
          [-5,-3,"s"],[-4,-3,"a"],[-3,-3,"A"],[-2,-3,"a"],[-1,-3,"A"],[0,-3,"a"],[1,-3,"A"],[2,-3,"a"],[3,-3,"s"],[4,-3,"s"],
          [-5,-2,"i"],[-4,-2,"a"],[-3,-2,"A"],[-2,-2,"a"],[-1,-2,"A"],[0,-2,"c"],[1,-2,"A"],[2,-2,"a"],[3,-2,"A"],[4,-2,"s"],
          [-5,-1,"s"],[-4,-1,"a"],[-3,-1,"A"],[-2,-1,"a"],[-1,-1,"A"],[0,-1,"S"],[1,-1,"A"],[2,-1,"a"],[3,-1,"A"],[4,-1,"s"],
          [-5,0,"i"],[-4,0,"a"],[-3,0,"A"],[-2,0,"a"],[-1,0,"A"],[0,0,"c"],[1,0,"A"],[2,0,"a"],[3,0,"A"],[4,0,"i"],
          [-4,1,"s"],[-3,1,"a"],[-2,1,"A"],[-1,1,"a"],[0,1,"A"],[1,1,"a"],[2,1,"A"],[3,1,"s"],
          [-3,2,"s"],[-2,2,"a"],[-1,2,"A"],[0,2,"a"],[1,2,"A"],[2,2,"s"],[-2,3,"s"],[-1,3,"s"],[0,3,"a"],[1,3,"s"],
          [-1,4,"i"],[0,4,"s"],
        ];
        for (const [dx, dy, key] of shield) {
          const px = sx + dx, py = sy + dy;
          if (px >= 0 && py >= 0 && px < W && py < H) C[py * W + px] = colorValue(colors[key] ?? INK);
        }
      }
      // Each weapon stays in hand while approaching and follows the attack swing.
      {
        const swing = attackT > 0 ? attackU : 0;
        const handX = left + Math.floor(width * 0.3) - Math.round(swing * 3);
        const handY = top + (kind === "orc" ? 21 : Math.floor(rows.length * 0.64)) - Math.round(Math.sin(swing * Math.PI) * (kind === "orc" ? 4 : 5));
        const handleLen = kind === "gnome" ? 3 : kind === "orc" ? 16 : kind === "golem" ? 0 : 15;
        const wood = colorValue(kind === "gnome" ? "#59404a" : kind === "orc" ? "#684c37" : "#60463b");
        const brightWood = colorValue(kind === "orc" ? "#a27a4e" : "#a07053");
        const metal = colorValue(kind === "gnome" ? "#dce2cf" : "#d6d9ca");
        const put = (px, py, color) => {
          if (px >= 0 && py >= 0 && px < W && py < H) C[py * W + px] = color;
        };
        for (let n = 0; n < handleLen; n++) {
          const px = kind === "orc" ? handX - Math.round(n * 0.46) : handX - n;
          const py = kind === "orc" ? handY - n + Math.round(swing * n * 0.35) : handY - Math.round(swing * n * 0.65);
          put(px, py, n % 3 === 0 ? brightWood : wood);
          if (kind === "ogre") put(px, py + 1, wood);
        }
        const tipX = kind === "orc" ? handX - Math.round(handleLen * 0.46) : handX - handleLen;
        const tipY = kind === "orc" ? handY - handleLen + Math.round(swing * handleLen * 0.35) : handY - Math.round(swing * handleLen * 0.65);
        if (kind === "gnome") {
          for (let n = 1; n <= 4; n++) put(tipX - n, tipY - Math.round(swing * n * 0.35), metal);
        } else if (kind === "orc") {
          // Long haft and a broad, bright-edged crescent blade.
          const blade = [[0,-5],[1,-6],[3,-6],[5,-4],[6,-2],[6,1],[4,3],[1,4],[-1,3],[-2,1],[-1,0],[1,1],[3,0],[4,-2],[3,-4],[1,-4]];
          for (const [dx, dy] of blade) put(tipX + dx, tipY + dy, colorValue(INK));
          for (const [dx, dy] of [[0,-4],[1,-5],[3,-5],[4,-4],[5,-2],[5,0],[4,2],[2,3],[0,2],[-1,1],[0,0],[2,0],[3,-2],[2,-3],[1,-3]]) put(tipX + dx, tipY + dy, metal);
          for (const [dx, dy] of [[0,-4],[1,-5],[3,-5],[4,-4],[5,-2],[5,0],[4,2],[2,3]]) put(tipX + dx, tipY + dy, colorValue("#fff0ca"));
        } else if (kind === "ogre") {
          // A broad dark club with a single lit knot at its striking end.
          for (const [dx, dy] of [[0, -4], [-1, -4], [-2, -3], [-1, -3], [0, -3], [1, -3], [2, -3], [3, -2], [-3, -2], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [3, -1], [4, -1], [-4, -1], [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1], [-4, 0], [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [-3, 1], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2]]) put(tipX + dx, tipY + dy, wood);
          for (const [dx, dy] of [[-2, -3], [-1, -3], [-3, -2], [-2, -2], [-4, -1], [-3, -1]]) put(tipX + dx, tipY + dy, brightWood);
          put(tipX + 3, tipY + 1, colorValue("#48352b"));
        }
        if (kind === "golem") {
          // A blocky stone fist draws back and slams down with the attack arc.
          const fistX = left + width - 5 + Math.round(swing * 5), fistY = top + 25 - Math.round(Math.sin(swing * Math.PI) * 7);
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
            const edge = Math.abs(dx) === 3 || Math.abs(dy) === 3;
            put(fistX + dx, fistY + dy, colorValue(edge ? INK : (dy < -1 ? "#c3b7a1" : "#716b70")));
          }
        }
      }
      impactFx?.draw(frame);
      slamFx?.draw(frame);
    },
    isDead() { return state === "dead"; },
  };
  return enemy;
}
