// CONTRACT: deterministic contact sheet of approach, fight, attack, hit, block and death.
import { createEnemy } from '../../src/game/enemies/enemies.js';
export default function (frame) {
  const kinds = ['gnome', 'orc', 'ogre', 'golem'];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    const enemy = createEnemy(kinds[col], { x: 42 + col * 78, y: 56 + row * 59 });
    if (row > 0) enemy.approach(enemy.x);
    if (row === 1) {
      if (col === 1) { enemy.hit(1); enemy.update(0.2); enemy.hit(1); enemy.update(0.08); }
      else { enemy.attack(); enemy.update(col === 3 ? 0.45 : 0.2); }
    }
    if (row === 2) {
      enemy.hit(col < 2 ? 1 : enemy.hp);
      enemy.update(col < 2 ? 0.05 : 0.45);
    }
    enemy.draw(frame);
  }
  return 0xff292326;
}
