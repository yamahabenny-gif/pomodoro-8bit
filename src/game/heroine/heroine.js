// CONTRACT (owned by issue "Heldin"). Our heroine is a small knight with a sword, long hair and a cape. Faces right.
//
// createHeroine({ x, y }) returns:
//   x, y                         feet position in stage pixels (y = GROUND_Y)
//   play(anim, { onHit, onDone }) anims: "idle" | "walk" | "attack1" | "attack2" | "attack3" | "hurt"
//                                 | "victory" | "sitDown" | "sit" | "standUp"
//                                 onHit fires on the contact frame of an attack, onDone when a one-shot ends
//   anim                         current anim name
//   update(dt)
//   draw(frame)                  draws with pixelfx painterFor(frame)
//   reach                        40 px in front of her feet where a sword hit lands
//   WAVE 4 (issue "Heldin neu"): brown long loose hair, silver-blue plate
//   armour, red cape, small crown-helm, sword; still faces right. New anims: "lightFire" (kneel, strike flint,
//   onHit at the spark that lights the fire, onDone when she sits back) and "levelUp" (sword raised, short glow).
//   WAVE 7: 36 px standing silhouette (up to 37 px with gait), origin (-20, -38); reach 40.
//   Sword: 18 px grip-to-tip, with a shorter flint striker during lightFire.
//   Rest uses the scene-owned seatX unchanged: rump is at (x + 1, y - 8), stump at (x - 15, y - 8).
//   heroinePose(anim, elapsed) and swordPose(anim, progress, hand, seated) are pixel-coordinate helpers for tests.

import { hex, painterFor } from "pixelfx/core/index.js";

const INK = "#17121f";
// Light falls from the upper left; each material uses three or four flat tones.
const PALETTE = {
  k: INK, h: "#57312f", H: "#925033", J: "#ce894b",
  s: "#f5c3a5", S: "#d88e83", w: "#fff1d6", e: "#244b7c", E: "#58a5cf",
  x: "#c9d4e0", X: "#eef3f7", d: "#7796ac", m: "#3b506a",
  g: "#eac466", b: "#967042", r: "#b6324e", R: "#64233c", q: "#e65a69",
  l: "#754a35", L: "#a8734b", c: "#d88e83", C: "#fff1d6",
};
const color = (name) => hex(PALETTE[name]);
const ORIGIN_X = -20, ORIGIN_Y = -38;
const SIT_STUMP_OFFSET_X = -15;
const SIT_STUMP = [".kkkkkkkkkkkkkkkkk.", "klllllllllllllllllk", "klllllLlllllllllllk", "klllllLlllllllllllk", ".kkkkkkkkkkkkkkkkk."];
const ONE_SHOTS = {
  attack1: { duration: 0.68, hit: 0.39 },
  attack2: { duration: 0.72, hit: 0.4 },
  attack3: { duration: 0.84, hit: 0.42 },
  hurt: { duration: 0.38 }, victory: { duration: 0.9 },
  sitDown: { duration: 0.65 }, standUp: { duration: 0.62 },
  lightFire: { duration: 1.25, hit: 0.78 }, levelUp: { duration: 1.2 },
};
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const smooth = (n) => { n = clamp01(n); return n * n * (3 - 2 * n); };

// Draw in one continuous coordinate space: no row remapping between head and torso.
function makeBody(anim, t) {
  const w = 48, h = 42, px = Array.from({ length: h }, () => Array(w).fill("."));
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) px[y][x] = c; };
  const rect = (x, y, rw, rh, c) => { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) put(x + i, y + j, c); };
  const line = (x0, y0, x1, y1, c) => {
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      put(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const twice = 2 * error;
      if (twice >= dy) { error += dy; x0 += sx; }
      if (twice <= dx) { error += dx; y0 += sy; }
    }
  };
  const stamp = (rows, x, y) => rows.forEach((row, j) => [...row].forEach((c, i) => { if (c !== ".") put(x + i, y + j, c); }));
  const walk = anim === "walk";
  const seated = anim === "sit" || (anim === "sitDown" && t >= 0.24) || (anim === "standUp" && t < 0.24);
  const kneeling = anim === "lightFire";
  const phase = Math.floor(t * 12) & 3;
  const bob = walk ? [0, 1, 0, -1][phase] : (anim === "idle" || anim === "sit") && phase >= 2 ? -1 : 0;
  const progress = ONE_SHOTS[anim] ? clamp01(t / ONE_SHOTS[anim].duration) : 0;
  const ox = anim === "attack2" ? 2 : anim === "attack3" ? 3 : anim === "hurt" ? -2 : seated ? 1 : kneeling ? 2 : 0;
  const oy = bob + (seated ? 5 : kneeling ? 4 : 0);

  // Folded cloth broadens below the hip, then turns back at the hem.
  const flutter = walk || anim.startsWith("attack") ? [0, 1, 2, 1][phase] : phase & 1;
  const capeEdges = [12, 11, 10, 10, 10, 9, 9, 9, 8, 7, 6, 6, 6, 7, 8, 10, 12];
  capeEdges.forEach((edge, row) => {
    const tail = row > 9 ? flutter : 0;
    const left = edge - tail + ox, right = 24 + ox;
    const py = 17 + row + Math.min(oy, 3);
    line(left, py, right, py, "k");
    for (let x = left + 1; x < right; x++) put(x, py, row < 4 || x < left + 3 ? "R" : "r");
    if (row < 15) put(left + 2, py, "q");
    if (row > 5) put(left + 5, py, "R");
  });

  // Feet remain on the baseline while the torso compresses during a step.
  const boot = (x, y) => stamp([
    "kggmk", "kdxmk", "kdxmk", "kdxmk", "kxxxkk", "kXxddk", "kRRRkk",
  ], x, y);
  if (seated || kneeling) {
    rect(17 + ox, 30, 13, 3, "k"); rect(18 + ox, 30, 10, 2, "m");
    boot(24 + ox, 31); boot(15 + ox, 31);
  } else if (walk) {
    const feet = [[12, 31, 23, 29], [16, 31, 22, 31], [17, 31, 24, 27], [12, 28, 21, 31]][phase];
    line(18 + ox, 28 + bob, feet[0] + 2 + ox, feet[1] + 1, "m");
    line(23 + ox, 28 + bob, feet[2] + 2 + ox, feet[3] + 1, "m");
    boot(feet[0] + ox, feet[1]); boot(feet[2] + ox, feet[3]);
  } else if (anim === "attack2" || anim === "attack3") {
    rect(14 + ox, 28, 5, 5, "m"); rect(22 + ox, 28, 8, 4, "m");
    boot(11 + ox, 31); boot(26 + ox, anim === "attack3" ? 29 : 31);
  } else {
    boot(15 + ox, 31); boot(22 + ox, 31);
  }

  // Loose brown locks extend past both shoulders, behind the face and pauldrons.
  stamp([
    ".kkkkkkkkkkk.",
    "khHHHHHHHHHhk",
    "khJHHHHHHHHhk",
    "khJHHHHHHHHhk",
    "khJHHHHHHHHhk",
    "khHHHHHHHHHhk",
    "khHHHHHHHHHhk",
    "khHHHHHHHHHhk",
    ".khHHHHHHHhk.",
    "..khHHHHHhk..",
  ], 13 + ox, 11 + oy);

  // Silver breastplate, waist and a flared mail skirt.
  const torso = [
    "..kkkkkkkkk..",
    ".kmddxxdddmk.",
    "kmdxXXxxddmk.",
    "kmdxXXxxddmk.",
    ".kmdxxxddmk..",
    ".kmmddddmmk..",
    ".kbbgRgbbbk..",
    ".kkkgqgkkkk..",
    ".kmxxxxxxmk..",
    "kmxXxXxXxXmk.",
    "kmXxXxXxXxmk.",
    "kmxXxXxXxXmk.",
    ".kggggggggk..",
    "..kkkkkkkk...",
  ];
  stamp(seated || kneeling ? torso.slice(0, 9) : torso, 14 + ox, 18 + oy);
  if (seated || kneeling) stamp([
    ".kdxXxXxXxdddk.",
    "kdxXxXxXxddXxxk",
    ".kggggggkkgggk.",
  ], 14 + ox, 30);


  stamp([".g.", "gqg", ".R."], 20 + ox, 19 + oy);
  // Long locks frame the jaw and fall behind the broad shoulder plates.
  stamp([".kk..", "khHk.", "khJHk", "khHHk", ".khHk", "..khHk", "...khHk", "....kk."], 9 + ox, 12 + oy);
  stamp(["..kk.", ".kHHk", "kHHJk", "kHHHk", "kHhk.", "kHhk..", "kHhk...", ".kk...."], 27 + ox, 12 + oy);
  stamp([
    "..kkkk...",
    ".kmddxkk.",
    "kmxXXxdmk",
    "kdxXxxddk",
    ".kddddk..",
  ], 7 + ox, 19 + oy);
  stamp([
    "...kkkk..",
    ".kkxddmk.",
    "kmdxxXXxm",
    "kddxxXxdk",
    "..kddddk.",
  ], 25 + ox, 19 + oy);

  // Gauntlet and blade share the same grip coordinate in every pose.
  let arm = [28 + ox, 22 + oy, 31 + ox, 22 + oy];
  if (walk) arm = [28 + ox, 22 + oy, 31 + ox, 22 + oy + [0, -1, 1, 0][phase]];
  if (anim === "attack1") arm = progress < 0.38 ? [29 + ox, 15 + oy, 29 + ox, 10 + oy] : [29 + ox, 22 + oy, 32 + ox, 25 + oy];
  if (anim === "attack2") arm = [29 + ox, 21 + oy, 33 + ox, 21 + oy];
  if (anim === "attack3") arm = [30 + ox, 21 + oy, 34 + ox, 20 + oy];
  if (anim === "victory" || anim === "levelUp") arm = [29 + ox, 15 + oy, 30 + ox, 10 + oy];
  if (kneeling) arm = [29 + ox, 25 + oy, 32 + ox, 28 + oy];
  if (seated) arm = [28 + ox, 23 + oy, 29 + ox, 26 + oy];
  for (const [dx, dy, c] of [[0, 0, "k"], [0, 1, "m"], [1, 0, "d"]]) {
    line(26 + ox + dx, 20 + oy + dy, arm[0] + dx, arm[1] + dy, c);
    line(arm[0] + dx, arm[1] + dy, arm[2] + dx, arm[3] + dy, c);
  }
  rect(arm[2] - 1, arm[3] - 1, 4, 4, "k");
  rect(arm[2], arm[3], 2, 2, "x");
  put(arm[2], arm[3], "X");
  stamp(["..kkk..", ".kXxxk.", "kXxxddk", "kxdddmk", ".kgggk."], 10 + ox, 18 + oy);
  stamp(["..kkk..", ".kXxxk.", "kXxxddk", "kxdddmk", ".kgggk."], 24 + ox, 18 + oy);

  // Crown, swept fringe and two large blue eyes, in a right-facing three-quarter view.
  stamp([
    ".......kgk.......",
    "..gk..kgXgk..kg..",
    "..kggkgxXxgkggk..",
    "..kdXxggrggxmdk..",
    "..kdxXgRqRgxmdk..",
    "..kdxxggRggddmk..",
    "..kdgggggggdmmk..",
    "..khJJHHHHHhmmk..",
    "..khJHHHssssHmk..",
    "..khHHsssssHsdk..",
    "..khHswessweSdk..",
    "..khHsEessEeSdk..",
    "..khHsEessEeSk...",
    "...kSSssssSSk....",
    "....ksssSssk.....",
    ".....kkkkkk......",
  ], 12 + ox, 2 + oy);
  put(17 + ox, 14 + oy, "E"); put(23 + ox, 14 + oy, "E");
  put(18 + ox, 14 + oy, "c"); put(24 + ox, 14 + oy, "c");
  put(21 + ox, 16 + oy, "h");
  // Neck joins head and breastplate on every held pose.
  rect(19 + ox, 17 + oy, 5, 2, "m");
  put(21 + ox, 18 + oy, "g");

  return { rows: px.map((row) => row.join("")), arm };
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
  } else if (anim === "victory" || anim === "levelUp") {
    tip = { x: handX + 1, y: handY - 12 };
  } else if (anim === "lightFire") {
    tip = { x: handX + 7, y: handY - 5 };
  } else if (anim === "hurt") {
    tip = { x: handX + 4, y: handY + 4 };
  } else {
    tip = { x: handX + 1, y: handY - 20 };
  }
  if (anim !== "lightFire") {
    const dx = tip.x - handX, dy = tip.y - handY, length = Math.hypot(dx, dy);
    tip = { x: handX + Math.round(dx * 18 / length), y: handY + Math.round(dy * 18 / length) };
  }
  return { grip: { x: handX, y: handY }, tip };
}

function drawLyingSword(p) {
  // Rest beside the stump at ground level, clear of the bent boots.
  p.line(-30, -2, -12, -2, color("k"));
  p.line(-29, -3, -15, -3, color("x"));
  p.line(-28, -4, -15, -4, color("X"));
  p.line(-14, -6, -14, -1, color("k"));
  p.line(-14, -5, -14, -2, color("g"));
  p.line(-13, -3, -11, -3, color("h"));
}

/** Create the heroine at a feet position in stage pixels. */
export function createHeroine({ x = 0, y = 0 } = {}) {
  let anim = "idle", elapsed = 0, loopTime = 0, onHit = null, onDone = null, hitFired = false, doneFired = false;
  const heroine = {
    x, y, anim, reach: 40,
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
        anim = finished === "sitDown" || finished === "lightFire" ? "sit" : "idle";
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
      p.sprite(pose.rows, PALETTE, ORIGIN_X, ORIGIN_Y);
      if (anim === "lightFire") {
        const sparks = elapsed >= 0.62 && elapsed <= 0.94;
        p.line(9, -4, 14, -4, color("l"));
        p.line(10, -5, 13, -5, color("L"));
        if (sparks) {
          const sparkPhase = Math.floor(elapsed * 24) & 1;
          p.line(13, -7, 13 + sparkPhase, -9, color("g"));
          p.line(15, -6, 17, -8 - sparkPhase, color("X"));
          p.line(11, -7, 10 - sparkPhase, -9, color("R"));
        }
        if (elapsed >= ONE_SHOTS.lightFire.hit) {
          p.line(11, -8, 11, -11, color("R"));
          p.line(12, -8, 12, -12, color("g"));
          p.line(13, -8, 13, -10, color("R"));
        }
      }
      if (anim === "levelUp") {
        const pulse = 0.48 + 0.5 * Math.sin(Math.PI * progress);
        // Keep the celebration around the armour, never across the eyes.
        for (const [sx, sy] of [[-13, -34], [18, -27], [-16, -17]]) {
          p.line(sx - 1, sy, sx + 1, sy, color("g"), pulse);
          p.line(sx, sy - 2, sx, sy + 2, color("X"), pulse);
        }
        p.line(-8, -4, -3, -4, color("g"), pulse);
      }
      if (seated) {
        drawLyingSword(p);
      } else {
        const weapon = swordPose(anim, progress, pose.hand, seated);
        const { grip, tip } = weapon;
        const sword = (x, y) => [x + ORIGIN_X, y + ORIGIN_Y];
        const [hiltX, hiltY] = sword(grip.x, grip.y), [bladeX, bladeY] = sword(tip.x, tip.y);
        const dx = bladeX - hiltX, dy = bladeY - hiltY;
        const length = Math.hypot(dx, dy);
        const ux = dx / length, uy = dy / length, nx = -uy, ny = ux;
        const at = (along, across = 0) => [Math.round(hiltX + ux * along + nx * across), Math.round(hiltY + uy * along + ny * across)];
        const stroke = (a, b, tone) => p.line(...a, ...b, color(tone));
        // Tapered three-pixel blade and a crossguard perpendicular to the blade.
        for (const offset of [-2, -1, 0, 1, 2]) stroke(at(4, offset), at(length, 0), "k");
        stroke(at(4, -1), at(length - 1), "X");
        stroke(at(4), at(length - 1), "x");
        stroke(at(4, 1), at(length - 2), "d");
        stroke(at(-2), at(2), "h");
        stroke(at(2, -4), at(2, 4), "k");
        stroke(at(2, -3), at(2, 3), "g");
        stroke(at(-2, -1), at(-2, 1), "g");
        // The closed gauntlet stays visible over the grip.
        stroke(at(0, -1), at(0, 1), "x");
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
