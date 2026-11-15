// CONTRACT: snapshot scene comparing an isolated heroine (left) with the forest passes (right).
import { createForest } from "../../src/game/scene/forest.js";
import { createHeroine } from "./forest-heroine.mjs";
import { hex } from "../../vendor/pixelfx/src/core/index.js";

export default function (frame, t) {
  const forest = createForest();
  forest.update(t);
  forest.drawBack(frame);
  const background = forest.background().slice();
  for (let y = 0; y < 180; y++) for (let x = 0; x < 160; x++) {
    const i = y * 320 + x;
    frame.color[i] = 0;
    frame.light[i] = 0;
    background[i] = hex("#67768a");
  }
  for (const x of [80, 240]) {
    const heroine = createHeroine({ x, y: 150 });
    heroine.play("walk");
    heroine.update(t);
    heroine.draw(frame);
  }
  // Apply the actual foreground, then retain only the forest half of that pass.
  const isolated = frame.color.slice(0);
  forest.drawFront(frame);
  for (let y = 0; y < 180; y++) for (let x = 0; x < 160; x++) frame.color[y * 320 + x] = isolated[y * 320 + x];
  return background;
}
