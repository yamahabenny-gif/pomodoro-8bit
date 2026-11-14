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
//   heroinePose(anim, elapsed) and swordPose(anim, progress, hand, seated) are pixel-coordinate helpers for tests.

import { hex, painterFor } from "pixelfx/core/index.js";

const INK = "#17121f";
const PALETTE = {
  k: INK, h: "#713a2d", H: "#a95d3d", J: "#d18a4e", s: "#f1bf91", S: "#cf866b",
  w: "#fff0d5", e: "#302137", t: "#376c73", T: "#67a69a", u: "#274650",
  b: "#e5b85b", o: "#45334a", O: "#80505a", c: "#f53cd1", C: "#ff8fe6",
  x: "#d8e6dc", X: "#fff5d3", d: "#738c9a", g: "#efc45e", l: "#754a35", L: "#a8734b",
};
const PIXEL_CODE = { k: "k", hair: "h", hairL: "H", hairH: "J", skin: "s", skinS: "S", white: "w", eye: "e", tunic: "t", tunicL: "T", tunicS: "u", belt: "b", boot: "o", bootL: "O", scarf: "c", scarfL: "C", steel: "x", steelL: "X", steelS: "d", gold: "g" };
const color = (name) => hex(PALETTE[name]);
const SIT_STUMP_OFFSET_X = -10; // Feet are at x=0; the 19 px stump is centered below her hips.
const SIT_STUMP = [".kkkkkkkkkkkkkkkkk.", "klllllllllllllllllk", "klllllLlllllllllllk", "klllllLlllllllllllk", ".kkkkkkkkkkkkkkkkk."];
const ONE_SHOTS = {
  attack1: { duration: 0.68, hit: 0.39 },
  attack2: { duration: 0.72, hit: 0.4 },
  attack3: { duration: 0.84, hit: 0.42 },
  hurt: { duration: 0.38 }, victory: { duration: 0.9 },
  sitDown: { duration: 0.65 }, standUp: { duration: 0.62 },
};
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const smooth = (n) => { n = clamp01(n); return n * n * (3 - 2 * n); };

// A tiny pixel canvas keeps the heroine's silhouette crisp at the stage's native resolution.
function makeBody(anim, t) {
  const w = 32, h = 28, px = Array.from({ length: h }, () => Array(w).fill("."));
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
  const phase = Math.floor(t * 12) & 3;
  const bob = walk ? [0, 1, 0, -1][phase] : anim === "idle" || anim === "sit" ? (phase >= 2 ? -1 : 0) : 0;
  const attackProgress = ONE_SHOTS[anim] ? clamp01(t / ONE_SHOTS[anim].duration) : 0;
  const lean = anim === "attack2" ? 2 : anim === "attack3" ? 3 : anim === "hurt" ? -2 : seated ? 1 : 0;
  const ox = lean;
  const headOx = ox + (seated ? 2 : 0), headBob = bob + (seated ? 2 : 0);

  const line = (x0, y0, x1, y1, c) => {
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, error = dx + dy;
    for (;;) {
      put(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const twice = 2 * error;
      if (twice >= dy) { error += dy; x0 += sx; }
      if (twice <= dx) { error += dx; y0 += sy; }
    }
  };

  // Ponytail sits behind the head; the two tips swing on held 12 fps steps.
  const swing = walk ? [0, 1, 0, -1][phase] : anim === "idle" ? phase & 1 : 0;
  outlineEllipse(7 + headOx, 8 + headBob + swing, 3, 4, "hair");
  put(4 + headOx, 8 + headBob + swing, "hairL"); put(5 + headOx, 11 + headBob + swing, "hairL");
  put(6 + headOx, 12 + headBob + swing, "hair");

  // Legs and boots. Alternating feet make the walk loop read at a glance.
  if (seated) {
    // Thighs turn forward, then shins fold down to make a clear seated L shape.
    rect(8 + ox, 19 + bob, 5, 3, "tunicS"); rect(12 + ox, 20 + bob, 7, 2, "tunic");
    rect(17 + ox, 21 + bob, 3, 3, "tunicS"); rect(7 + ox, 21 + bob, 3, 3, "tunic");
    rect(16 + ox, 24 + bob, 5, 2, "boot"); rect(5 + ox, 24 + bob, 5, 2, "bootL");
  } else if (anim === "attack2") {
    // A wide rear foot and a knee driven forward make the cross-slash read as a lunge.
    rect(8 + ox, 19 + bob, 4, 5, "tunicS"); rect(12 + ox, 20 + bob, 8, 2, "tunic");
    rect(18 + ox, 21 + bob, 3, 3, "tunicS");
    rect(5 + ox, 23 + bob, 6, 2, "boot"); rect(18 + ox, 24 + bob, 5, 2, "bootL");
  } else if (anim === "attack3") {
    // Both legs trail the forward dash in a compact airborne stride.
    rect(8 + ox, 19 + bob, 5, 3, "tunicS"); rect(13 + ox, 20 + bob, 5, 2, "tunic");
    rect(6 + ox, 22 + bob, 6, 2, "tunicS"); rect(15 + ox, 22 + bob, 6, 2, "tunic");
    rect(4 + ox, 24 + bob, 5, 2, "boot"); rect(17 + ox, 24 + bob, 5, 2, "bootL");
  } else if (walk) {
    // Four held gait drawings: contact, compression, pass, and the opposite high step.
    if (phase === 0) {
      rect(8 + ox, 19 + bob, 4, 5, "tunicS"); rect(13 + ox, 18 + bob, 4, 4, "tunic");
      rect(5 + ox, 23 + bob, 6, 2, "boot"); rect(15 + ox, 22 + bob, 6, 2, "bootL");
    } else if (phase === 1) {
      rect(9 + ox, 19 + bob, 4, 5, "tunicS"); rect(13 + ox, 19 + bob, 4, 5, "tunic");
      rect(8 + ox, 24 + bob, 6, 2, "boot"); rect(13 + ox, 24 + bob, 6, 2, "bootL");
    } else if (phase === 2) {
      rect(9 + ox, 19 + bob, 4, 4, "tunicS"); rect(14 + ox, 18 + bob, 4, 3, "tunic");
      rect(9 + ox, 23 + bob, 6, 2, "boot"); rect(15 + ox, 20 + bob, 6, 2, "bootL");
    } else {
      rect(9 + ox, 18 + bob, 4, 4, "tunicS"); rect(13 + ox, 19 + bob, 4, 5, "tunic");
      rect(6 + ox, 21 + bob, 6, 2, "boot"); rect(13 + ox, 23 + bob, 6, 2, "bootL");
    }
  } else {
    rect(9 + ox, 19 + bob, 3, 4, "tunicS");
    rect(13 + ox, 19 + bob, 3, 4, "tunic");
    rect(8 + ox, 23 + bob, 5, 2, "boot");
    rect(12 + ox, 23 + bob, 5, 2, "bootL");
    put(9 + ox, 23 + bob, "gold"); put(13 + ox, 23 + bob, "gold");
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
  if (walk) arm = [[18, 15, 20, 15], [19, 14, 21, 13], [18, 16, 20, 17], [17, 15, 19, 16]][phase].map((v, i) => v + (i % 2 ? bob : ox));
  if (anim === "attack1") arm = attackProgress < 0.42 ? [18 + ox, 8 + bob, 17 + ox, 3 + bob] : [19 + ox, 14 + bob, 22 + ox, 18 + bob];
  if (anim === "attack2") arm = [20 + ox, 15 + bob, 24 + ox, 14 + bob];
  if (anim === "attack3") arm = [21 + ox, 14 + bob, 25 + ox, 13 + bob];
  if (anim === "victory") arm = [17 + ox, 8 + bob, 18 + ox, 5 + bob];
  if (seated) arm = [17 + ox, 17 + bob, 18 + ox, 20 + bob];
  rect(15 + ox, 13 + bob, 4, 4, "k");
  if (walk) {
    const farArm = [[12, 15, 10, 18], [12, 16, 10, 19], [12, 15, 15, 14], [12, 14, 15, 15]][phase];
    line(farArm[0] + ox, farArm[1] + bob, farArm[2] + ox, farArm[3] + bob, "k");
    line(farArm[0] + ox + 1, farArm[1] + bob, farArm[2] + ox + 1, farArm[3] + bob, "skinS");
  }
  line(17 + ox, 14 + bob, arm[0], arm[1], "k");
  line(17 + ox, 15 + bob, arm[0], arm[1] + 1, "skinS");
  line(arm[0], arm[1], arm[2], arm[3], "k");
  line(arm[0], arm[1] + 1, arm[2], arm[3] + 1, "skin");
  rect(arm[2], arm[3], 2, 2, "skin");
  if (seated) {
    line(11 + ox, 14 + bob, 12 + ox, 18 + bob, "k");
    line(12 + ox, 14 + bob, 13 + ox, 18 + bob, "skinS");
    rect(12 + ox, 19 + bob, 2, 1, "skin");
  }

  // Face under a long auburn fringe, turned toward the incoming enemies.
  outlineEllipse(14 + headOx, 6 + headBob, 4, 5, "skin");
  rect(10 + headOx, 2 + headBob, 7, 2, "hair");
  rect(10 + headOx, 3 + headBob, 2, 5, "hair");
  rect(11 + headOx, 2 + headBob, 6, 2, "hairL");
  rect(15 + headOx, 3 + headBob, 3, 2, "hair");
  rect(16 + headOx, 4 + headBob, 2, 2, "hairL");
  put(16 + headOx, 7 + headBob, "eye"); put(17 + headOx, 8 + headBob, "skinS");
  put(13 + headOx, 9 + headBob, "skinS");

  // Pink scarf knot and tail flutter left in the breeze.
  rect(10 + headOx, 11 + headBob, 7, 2, "k");
  rect(11 + headOx, 11 + headBob, 5, 1, "scarf"); put(15 + headOx, 12 + headBob, "scarfL");
  const flutter = walk ? [0, 1, 0, -1][phase] : anim === "idle" ? phase & 1 : 0;
  rect(7 + headOx, 11 + headBob, 4, 2, "scarf");
  put(6 + headOx, 10 + headBob + flutter, "scarfL"); put(5 + headOx, 11 + headBob + flutter, "scarf");
  put(4 + headOx, 12 + headBob + flutter, "scarf"); put(5 + headOx, 13 + headBob + flutter, "scarfL");

  return { rows: px.map((row) => row.map((color) => PIXEL_CODE[color] ?? ".").join("")), arm };
}

export function heroinePose(anim, elapsed = 0) {
  const body = makeBody(anim, elapsed);
  const seated = anim === "sit" || (anim === "sitDown" && elapsed >= 0.24) || (anim === "standUp" && elapsed < 0.24);
  return { rows: body.rows, arm: body.arm, hand: { x: body.arm[2] + 1, y: body.arm[3] + 1 }, seated };
}

/** Return the sword grip and tip in sprite-local pixels, anchored directly to the hand. */
export function swordPose(anim, progress, hand, seated = false) {
  if (seated) return null;
  const handX = hand.x, handY = hand.y;
  let tip;
  if (anim.startsWith("attack")) {
    const swing = progress >= 0.38 && progress < 0.72;
    if (anim === "attack1") tip = progress < 0.38 ? { x: handX + 1, y: handY - 12 } : swing ? { x: handX + 8, y: handY + 9 } : { x: handX + 6, y: handY + 1 };
    else if (anim === "attack2") tip = progress < 0.38 ? { x: handX - 9, y: handY + 3 } : swing ? { x: handX + 12, y: handY + 1 } : { x: handX + 7, y: handY - 1 };
    else tip = progress < 0.38 ? { x: handX + 4, y: handY - 4 } : swing ? { x: handX + 14, y: handY } : { x: handX + 9, y: handY };
  } else if (anim === "victory") {
    tip = { x: handX + 1, y: handY - 12 };
  } else if (anim === "hurt") {
    tip = { x: handX + 4, y: handY + 4 };
  } else {
    tip = { x: handX + 7, y: handY - 7 };
  }
  return { grip: { x: handX, y: handY }, tip };
}

function drawLyingSword(p) {
  // Rest beside the stump at ground level, clear of the bent boots.
  p.line(-24, -2, -14, -2, color("d"));
  p.line(-24, -3, -14, -3, color("x"));
  p.line(-15, -4, -15, 0, color("g"));
  p.line(-26, -3, -24, -2, color("k"));
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
      const pose = heroinePose(anim, loopTime);
      const seated = pose.seated;
      if (seated) {
        p.place(heroine.x, heroine.y);
        p.sprite(SIT_STUMP, PALETTE, SIT_STUMP_OFFSET_X, -8);
      }
      let shiftX = 0, lift = 0;
      if (anim === "attack2") shiftX = progress < 0.34 ? 0 : progress < 0.7 ? 4 * smooth((progress - 0.34) / 0.36) : 4 * (1 - smooth((progress - 0.7) / 0.3));
      if (anim === "attack3") {
        shiftX = progress < 0.28 ? -2 : progress < 0.7 ? -2 + 12 * smooth((progress - 0.28) / 0.42) : 10 * (1 - smooth((progress - 0.7) / 0.3));
        lift = progress < 0.28 ? 0 : 3 * Math.sin(Math.PI * Math.min(1, (progress - 0.28) / 0.72));
      }
      if (anim === "victory") lift = 4 * Math.sin(Math.PI * progress);
      p.place(heroine.x + shiftX, heroine.y - lift);
      p.sprite(pose.rows, PALETTE, -12, -27);
      if (seated) {
        drawLyingSword(p);
      } else {
        const weapon = swordPose(anim, progress, pose.hand, seated);
        const { grip, tip } = weapon;
        const sword = (x, y) => [x - 12, y - 27];
        const [hiltX, hiltY] = sword(grip.x, grip.y), [bladeX, bladeY] = sword(tip.x, tip.y);
        p.line(hiltX, hiltY, hiltX + 1, hiltY + 1, color("k"));
        p.line(hiltX + 1, hiltY, hiltX + 2, hiltY + 1, color("g"));
        p.line(hiltX + 2, hiltY, bladeX, bladeY, color("d"));
        p.line(hiltX + 2, hiltY - 1, bladeX, bladeY - 1, color("x"));
        p.line(bladeX, bladeY - 1, bladeX + 1, bladeY - 2, color("X"));
      }
      if (anim.startsWith("attack")) {
        const impactFrame = Math.floor(elapsed * 12);
        const hitFrame = Math.floor(ONE_SHOTS[anim].hit * 12);
        const frameFromHit = impactFrame - hitFrame;
        if (frameFromHit >= -1 && frameFromHit <= 1) {
          const sweep = frameFromHit / 3;
          if (anim === "attack1") p.arc(10, -15, 13, 2, -1.25 + sweep, 0.55 + sweep, color("X"), 0.95);
          else if (anim === "attack2") {
            p.arc(13, -13, 13, 2, -0.15 + sweep, 1.05 + sweep, color("X"), 0.95);
            p.arc(13, -13, 10, 1, -0.35 + sweep, 0.85 + sweep, color("C"), 0.9);
          } else {
            p.line(10, -14, 23, -14, color("X"), 0.95);
            p.line(12, -16, 23, -14, color("d"), 0.9);
          }
        }
      }
    },
  };
  return heroine;
}
