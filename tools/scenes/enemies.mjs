// Enemy pose and effect study, advanced from zero so each snapshot is reproducible.
import { createEnemy, ENEMY_KINDS } from "../../src/game/enemies/enemies.js";

const kinds = ENEMY_KINDS;
const feet = [58, 160, 260];

export default function (frame, t) {
  const brightForest = t >= 10;
  const sceneTime = brightForest ? t - 10 : t;
  const foes = kinds.map((kind, i) => {
    const speeds = { gnome: 38, orc: 23, ogre: 12 };
    const enemy = createEnemy(kind, { x: feet[i] + speeds[kind] * 0.65, y: 150 });
    enemy.approach(feet[i] - (kind === "gnome" ? 19 : kind === "orc" ? 25 : 32));
    return enemy;
  });
  // A simple floor and sparse grass tufts keep each silhouette readable.
  const ink = 0xff1f1721, soil = brightForest ? 0xff655847 : 0xff493a39, grass = brightForest ? 0xff78945e : 0xff55704a;
  for (let x = 0; x < 320; x++) {
    frame.color[150 * 320 + x] = ink;
    for (let y = 151; y < 180; y++) frame.color[y * 320 + x] = (y < 156 ? soil : (brightForest ? 0xff51483e : 0xff382f38));
  }
  for (const x of [18, 34, 116, 202, 302]) {
    frame.color[148 * 320 + x] = grass;
    frame.color[149 * 320 + x + 1] = grass;
  }

  let attackDone = false, hitDone = false, deathDone = false;
  const dt = 1 / 60;
  for (let now = 0; now < sceneTime; now += dt) {
    if (now >= 1.15 && !attackDone) {
      foes.forEach((enemy) => enemy.attack());
      attackDone = true;
    }
    if (now >= 1.8 && !hitDone) {
      foes.forEach((enemy) => enemy.hit(1));
      hitDone = true;
    }
    if (now >= 2.1 && !deathDone) {
      foes.forEach((enemy) => enemy.hit(enemy.hp));
      deathDone = true;
    }
    foes.forEach((enemy) => enemy.update(dt));
  }
  foes.forEach((enemy) => enemy.draw(frame));
  return brightForest ? 0xff2a3a2b : 0xff18202b;
}
