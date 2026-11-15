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

import { palettes, sprites, equipment } from "./sprites.js";

const INK = "#17121f";
const stats = {
  gnome: { hp: 2, speed: 38, reach: 19, attack: 0.62, contact: 0.28, height: 22, impact: hitSpark },
  orc: { hp: 3, speed: 21, reach: 31, attack: 1.05, contact: 0.43, height: 38, impact: hitSpark },
  ogre: { hp: 5, speed: 12, reach: 32, attack: 1.3, contact: 0.68, height: 42, impact: bluntHit },
  golem: { hp: 7, speed: 7, reach: 39, attack: 1.7, contact: 0.92, height: 50, impact: bluntHit },
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
  let queuedHit = null, didHit = false, didBlock = false, receivedOrcHits = 0, blockT = 0, impactFx = null, impactKind = "hit", deathFx = null, slamFx = null;
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
        size: 2 + (index % 4), color: [palettes.golem.s, palettes.golem.S, palettes.golem.l, palettes.golem.L, palettes.golem.o][index % 5],
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
      if (kind === "orc" && state === "fight") {
        receivedOrcHits++;
        if (!didBlock && receivedOrcHits === 2) {
          didBlock = true;
          blockT = 0.32;
          startImpact("block");
          return hp;
        }
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
            if (bit.y + bit.size >= y) {
              bit.y = y - bit.size;
              bit.vy = 0;
              bit.vx *= Math.exp(-dt * 12);
            }
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
            const px = Math.round(bit.x), py = Math.round(bit.y);
            for (let yy = 0; yy < bit.size; yy++) for (let xx = 0; xx < bit.size; xx++) {
              if (bit.size > 2 && (xx === 0 || xx === bit.size - 1) && (yy === 0 || yy === bit.size - 1)) continue;
              const color = colorValue(yy === 0 ? palettes.golem.L : bit.color);
              if (px + xx >= 0 && py + yy >= 0 && px + xx < frame.w && py + yy < frame.h) C[(py + yy) * W + px + xx] = color;
            }
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
      if (kind === "golem") {
        // Low beige puffs sit behind the feet so the stone silhouette stays crisp.
        const drift = Math.floor(clock * 2) % 3;
        for (const side of [-1, 1]) {
          const puffX = footX + side * 10 + (side < 0 ? -drift : drift);
          for (const [dx, dy, shade] of [
            [-3, 0, "#887c6c"], [-2, -1, "#b4a68d"], [-1, -1, "#d2c5a7"],
            [0, -1, "#c5b79a"], [1, 0, "#aa9d85"], [2, 0, "#8e8372"],
          ]) {
            const px = puffX + dx, py = y - 1 + dy;
            if (px >= 0 && py >= 0 && px < W && py < H) C[py * W + px] = colorValue(shade);
          }
        }
      }
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
      const put = (px, py, hex) => {
        px = Math.round(px); py = Math.round(py);
        if (px >= 0 && py >= 0 && px < W && py < H) C[py * W + px] = colorValue(flash ? "#ffffff" : hex);
      };
      const blit = (art, ox, oy, angle = 0, pivotX = 0, pivotY = 0) => {
        const cos = Math.cos(angle), sin = Math.sin(angle);
        const width = art[0].length, height = art.length;
        const corners = [[0, 0], [width, 0], [0, height], [width, height]].map(([xx, yy]) => [
          ox + (xx - pivotX) * cos - (yy - pivotY) * sin,
          oy + (xx - pivotX) * sin + (yy - pivotY) * cos,
        ]);
        // Inverse nearest-neighbor rotation keeps steel and haft contiguous at every angle.
        const minX = Math.floor(Math.min(...corners.map(p => p[0]))), maxX = Math.ceil(Math.max(...corners.map(p => p[0])));
        const minY = Math.floor(Math.min(...corners.map(p => p[1]))), maxY = Math.ceil(Math.max(...corners.map(p => p[1])));
        for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
          const xx = Math.round((px - ox) * cos + (py - oy) * sin + pivotX);
          const yy = Math.round(-(px - ox) * sin + (py - oy) * cos + pivotY);
          const key = art[yy]?.[xx];
          if (key && key !== ".") put(px, py, colors[key] ?? INK);
        }
      };
      const swing = attackT > 0 ? Math.sin(attackU * Math.PI) : 0;
      if (kind === "orc") {
        blit(equipment.shield, left + 25 - (blockT > 0 ? 4 : 0), top + 17 - (blockT > 0 ? 4 : 0));
        blit(equipment.axe, left + 4, top + 22, -0.30 - swing * 1.15, 7, 23);
        // Fingers wrap over the haft at a fixed pivot, including during the swing.
        put(left + 3, top + 21, colors.h); put(left + 4, top + 22, colors.G);
      } else if (kind === "golem") {
        const contactU = spec.contact / spec.attack;
        const lift = attackT > 0 && attackU < contactU ? Math.sin(attackU / contactU * Math.PI) : 0;
        blit(equipment.fist, left - swing * 2, top + 23 - lift * 9);
        blit(equipment.fist, left + 32, top + 24 + swing * 2);
      } else {
        const hx = left + 3, hy = top + (kind === "gnome" ? 14 : 25);
        const length = kind === "gnome" ? 7 : 17;
        const tipX = hx - length, tipY = hy - swing * 11;
        for (let n = 0; n < length; n++) {
          put(hx - n, hy - swing * n * 11 / length, colors.a);
          put(hx - n, hy - swing * n * 11 / length - 1, kind === "gnome" && n > 2 ? colors.w : colors.c);
        }
        if (kind === "ogre") {
          for (let yy = -4; yy <= 3; yy++) for (let xx = -4; xx <= 4; xx++) {
            if (Math.abs(xx) + Math.abs(yy) > 6) continue;
            put(tipX + xx, tipY + yy, Math.abs(xx) + Math.abs(yy) === 6 ? INK : yy < -1 ? colors.c : colors.A);
          }
          put(tipX - 2, tipY - 3, colors.M); put(tipX + 2, tipY, colors.s);
        }
      }
      impactFx?.draw(frame);
      slamFx?.draw(frame);
    },
    isDead() { return state === "dead"; },
  };
  return enemy;
}
