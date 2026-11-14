// CONTRACT (owned by issue "Heldin"). Our heroine: small (about 24 px tall, like pixelfx HERO2), sword and
// a pink scarf, long hair in a ponytail so she reads as "she" at a glance. Faces right; enemies come from the right.
//
// createHeroine({ x, y }) returns:
//   x, y                         feet position in stage pixels (y = GROUND_Y)
//   play(anim, { onHit, onDone }) anims: "idle" | "walk" | "attack1" | "attack2" | "attack3" | "hurt"
//                                 | "victory" | "sitDown" | "sit" | "standUp"
//                                 onHit fires on the contact frame of an attack, onDone when a one-shot ends
//   anim                         current anim name
//   update(dt)
//   draw(frame)                  draws with pixelfx painterFor(frame)
//   reach                        px in front of her feet where a sword hit lands

import { hex, painterFor } from "pixelfx/core/index.js";

const INK = "#17121f";
const PALETTE = {
  k: INK, h: "#713a2d", H: "#a95d3d", J: "#d18a4e", s: "#f1bf91", S: "#cf866b",
  w: "#fff0d5", e: "#302137", t: "#376c73", T: "#67a69a", u: "#274650",
  b: "#e5b85b", o: "#45334a", O: "#80505a", c: "#f53cd1", C: "#ff8fe6",
  x: "#d8e6dc", X: "#fff5d3", d: "#738c9a", g: "#efc45e",
};
const PIXEL_CODE = { k: "k", hair: "h", hairL: "H", hairH: "J", skin: "s", skinS: "S", white: "w", eye: "e", tunic: "t", tunicL: "T", tunicS: "u", belt: "b", boot: "o", bootL: "O", scarf: "c", scarfL: "C", steel: "x", steelL: "X", steelS: "d", gold: "g" };
const color = (name) => hex(PALETTE[name]);
const ONE_SHOTS = {
  attack1: { duration: 0.68, hit: 0.48 },
  attack2: { duration: 0.72, hit: 0.5 },
  attack3: { duration: 0.84, hit: 0.5 },
  hurt: { duration: 0.38 }, victory: { duration: 0.9 },
  sitDown: { duration: 0.65 }, standUp: { duration: 0.62 },
};
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const smooth = (n) => { n = clamp01(n); return n * n * (3 - 2 * n); };

// A tiny pixel canvas keeps the heroine's silhouette crisp at the stage's native resolution.
function makeBody(anim, t) {
  const w = 25, h = 28, px = Array.from({ length: h }, () => Array(w).fill("."));
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) px[y][x] = c; };
  const rect = (x, y, rw, rh, c) => { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) put(x + i, y + j, c); };
  const ellipse = (cx, cy, rx, ry, c) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1) put(x, y, c);
    }
  };
  const outlineEllipse = (cx, cy, rx, ry, fill, edge = "k") => {
    ellipse(cx, cy, rx + 1, ry + 1, edge);
    ellipse(cx, cy, rx, ry, fill);
  };

  const walk = anim === "walk", seated = anim === "sit" || (anim === "sitDown" && t >= 0.24) || (anim === "standUp" && t < 0.24);
  const phase = Math.floor(t * 12) & 1;
  const bob = walk ? (phase ? -1 : 0) : anim === "idle" ? (Math.floor(t * 3) % 2 ? -1 : 0) : 0;
  const lean = anim.startsWith("attack") ? 1 : anim === "hurt" ? -2 : 0;
  const ox = lean;

  // Ponytail sits behind the head; the two tips swing on held 12 fps steps.
  const swing = walk || anim === "idle" ? phase : 0;
  outlineEllipse(7 + ox, 8 + bob + swing, 3, 4, "hair");
  put(4 + ox, 8 + bob + swing, "hairL"); put(5 + ox, 11 + bob + swing, "hairL");
  put(6 + ox, 12 + bob + swing, "hair");

  // Legs and boots. Alternating feet make the walk loop read at a glance.
  const step = walk ? (phase ? 1 : -1) : 0;
  if (seated) {
    rect(8 + ox, 19 + bob, 4, 3, "tunicS"); rect(11 + ox, 21 + bob, 7, 2, "tunic");
    rect(14 + ox, 22 + bob, 5, 2, "boot"); rect(8 + ox, 22 + bob, 6, 2, "boot");
  } else {
    rect(9 + ox, 19 + bob, 3, 4 + Math.max(0, step), "tunicS");
    rect(13 + ox, 19 + bob, 3, 4 + Math.max(0, -step), "tunic");
    rect(8 + ox + Math.max(0, -step), 23 + bob, 5, 2, "boot");
    rect(12 + ox + Math.max(0, step), 23 + bob, 5, 2, "bootL");
    put(9 + ox + Math.max(0, -step), 23 + bob, "gold"); put(13 + ox + Math.max(0, step), 23 + bob, "gold");
  }

  // Short tunic, belt and chest highlight.
  rect(8 + ox, 12 + bob, 9, 8, "k");
  rect(9 + ox, 13 + bob, 7, 6, "tunic");
  rect(9 + ox, 14 + bob, 2, 5, "tunicL");
  rect(14 + ox, 14 + bob, 2, 5, "tunicS");
  rect(9 + ox, 18 + bob, 7, 2, "belt"); put(13 + ox, 18 + bob, "gold");
  put(15 + ox, 15 + bob, "white");

  // Arm, shoulder and hand. Its angle changes with each sword beat.
  let arm = [18 + ox, 16 + bob, 20 + ox, 15 + bob];
  if (anim === "attack1") arm = [18 + ox, 15 + bob, 20 + ox, 13 + bob];
  if (anim === "attack2") arm = [18 + ox, 16 + bob, 20 + ox, 17 + bob];
  if (anim === "attack3") arm = [18 + ox, 15 + bob, 21 + ox, 14 + bob];
  if (anim === "victory") arm = [17 + ox, 13 + bob, 18 + ox, 10 + bob];
  if (seated) arm = [16 + ox, 16 + bob, 17 + ox, 18 + bob];
  rect(15 + ox, 13 + bob, 4, 4, "k");
  rect(16 + ox, 14 + bob, 2, 3, "skinS");
  rect(arm[0], arm[1], 3, 2, "skin"); put(arm[2], arm[3], "skin");

  // Face under a long auburn fringe, turned toward the incoming enemies.
  outlineEllipse(14 + ox, 6 + bob, 4, 5, "skin");
  rect(10 + ox, 2 + bob, 7, 2, "hair");
  rect(10 + ox, 3 + bob, 2, 5, "hair");
  rect(11 + ox, 2 + bob, 6, 2, "hairL");
  rect(15 + ox, 3 + bob, 3, 2, "hair");
  rect(16 + ox, 4 + bob, 2, 2, "hairL");
  put(16 + ox, 7 + bob, "eye"); put(17 + ox, 8 + bob, "skinS");
  put(13 + ox, 9 + bob, "skinS");

  // Pink scarf knot and tail flutter left in the breeze.
  rect(10 + ox, 11 + bob, 7, 2, "k");
  rect(11 + ox, 11 + bob, 5, 1, "scarf"); put(15 + ox, 12 + bob, "scarfL");
  const flutter = anim === "idle" || walk ? phase : 0;
  rect(7 + ox, 11 + bob, 4, 2, "scarf");
  put(6 + ox, 10 + bob + flutter, "scarfL"); put(5 + ox, 11 + bob + flutter, "scarf");
  put(4 + ox, 12 + bob + flutter, "scarf"); put(5 + ox, 13 + bob + flutter, "scarfL");

  return { rows: px.map((row) => row.map((color) => PIXEL_CODE[color] ?? ".").join("")), arm };
}

function swordPose(anim, progress, arm) {
  const handX = arm[2] + 1, handY = arm[3] + 1;
  if (anim.startsWith("attack")) {
    const wind = progress < 0.4;
    const swing = progress >= 0.4 && progress < 0.7;
    if (anim === "attack1") return wind ? [handX - 1, handY - 4, handX + 4, handY - 8] : swing ? [handX, handY - 2, handX + 9, handY + 5] : [handX + 1, handY - 1, handX + 7, handY + 1];
    if (anim === "attack2") return wind ? [handX + 1, handY + 2, handX + 7, handY + 6] : swing ? [handX, handY + 1, handX + 9, handY - 6] : [handX + 1, handY, handX + 7, handY - 1];
    return wind ? [handX - 1, handY - 2, handX + 5, handY - 7] : swing ? [handX + 1, handY, handX + 11, handY - 1] : [handX + 1, handY, handX + 9, handY];
  }
  if (anim === "victory") return [handX, handY, handX + 2, handY - 10];
  if (anim === "sit" || anim === "sitDown") return [handX, handY + 1, handX + 4, handY + 4];
  if (anim === "hurt") return [handX - 2, handY + 1, handX + 4, handY + 4];
  return [handX, handY - 2, handX + 7, handY - 7];
}

/** Create the heroine at a feet position in stage pixels. */
export function createHeroine({ x = 0, y = 0 } = {}) {
  let anim = "idle", elapsed = 0, loopTime = 0, onHit = null, onDone = null, hitFired = false, doneFired = false;
  const heroine = {
    x, y, anim, reach: 18,
    play(name, callbacks = {}) {
      const allowed = ["idle", "walk", ...Object.keys(ONE_SHOTS), "sit"];
      if (!allowed.includes(name)) throw new RangeError(`Unknown heroine animation: ${name}`);
      anim = name;
      heroine.anim = anim;
      elapsed = 0;
      loopTime = 0;
      hitFired = false;
      doneFired = false;
      onHit = callbacks.onHit ?? null;
      onDone = callbacks.onDone ?? null;
      return heroine;
    },
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      loopTime += dt;
      const oneShot = ONE_SHOTS[anim];
      if (!oneShot) return;
      const prev = elapsed;
      elapsed = Math.min(oneShot.duration, elapsed + dt);
      if (oneShot.hit !== undefined && !hitFired && prev < oneShot.hit && elapsed >= oneShot.hit) {
        hitFired = true;
        onHit?.();
      }
      if (elapsed >= oneShot.duration && !doneFired) {
        doneFired = true;
        const finished = anim;
        anim = finished === "sitDown" ? "sit" : "idle";
        heroine.anim = anim;
        onDone?.();
        onHit = null;
        onDone = null;
      }
    },
    draw(frame) {
      const p = painterFor(frame);
      const progress = ONE_SHOTS[anim] ? elapsed / ONE_SHOTS[anim].duration : 0;
      const pose = makeBody(anim, loopTime);
      p.place(heroine.x, heroine.y);
      p.sprite(pose.rows, PALETTE, -12, -27);
      const [sx, sy, ex, ey] = swordPose(anim, progress, pose.arm);
      const sword = (x, y) => [x - 12, y - 27];
      const [hiltX, hiltY] = sword(sx, sy), [bladeX, bladeY] = sword(ex, ey);
      p.line(hiltX, hiltY, hiltX + 1, hiltY + 1, color("k"));
      p.line(hiltX + 1, hiltY, hiltX + 2, hiltY + 1, color("g"));
      p.line(hiltX + 2, hiltY, bladeX, bladeY, color("d"));
      p.line(hiltX + 2, hiltY - 1, bladeX, bladeY - 1, color("x"));
      p.line(bladeX, bladeY - 1, bladeX + 1, bladeY - 2, color("X"));
      if (anim.startsWith("attack") && progress > 0.4 && progress < 0.72) {
        const f = smooth((progress - 0.4) / 0.32);
        if (anim === "attack1") p.arc(9, -12, 10, 2, -0.85, 0.5 + f * 0.25, color("X"), 0.8);
        else if (anim === "attack2") p.arc(9, -13, 10, 2, 0.45, 1.8 + f * 0.2, color("C"), 0.8);
        else p.line(10, -12, 19, -13, color("X"), 0.8);
      }
    },
  };
  return heroine;
}
