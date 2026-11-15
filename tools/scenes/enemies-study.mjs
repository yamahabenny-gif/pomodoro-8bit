// CONTRACT: snapshot scene; t selects the shared pose timeline from enemies.mjs.
import { createFrame } from '../../vendor/pixelfx/src/core/index.js';
import { createEnemy } from '../../src/game/enemies/enemies.js';
import scene from './enemies.mjs';

export default function (frame, t) {
  const stage = createFrame(frame.w, frame.h);
  const bg = scene(stage, t);
  for (let y = 108; y < frame.h; y++) for (let x = 0; x < frame.w; x++) frame.color[y * frame.w + x] = stage.color[(y - 24) * frame.w + x];
  // Enlarged native pixels above the stage-scale lineup expose contour and material decisions.
  for (const [kind, ox] of [['orc', 0], ['golem', 160]]) {
    const study = createFrame(80, 54);
    const enemy = createEnemy(kind, { x: 40, y: 52 });
    enemy.draw(study);
    for (let y = 0; y < 54; y++) for (let x = 0; x < 80; x++) {
      const color = study.color[y * 80 + x] || 0xff292326;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) frame.color[(y * 2 + dy) * frame.w + ox + x * 2 + dx] = color;
    }
  }
  return bg;
}
