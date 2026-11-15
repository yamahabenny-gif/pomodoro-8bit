import { createForest } from "../../src/game/scene/forest.js";
import { painterFor, drawActor, stockActor } from "../../vendor/pixelfx/src/core/index.js";

export default function (frame, t) {
  const forest = createForest();
  forest.scroll(6000);
  for (let s = 0; s < t; s += 1 / 30) forest.update(1 / 30);
  forest.drawBack(frame);
  const p = painterFor(frame);
  p.place(150, 150);
  drawActor(p, stockActor(2));
  forest.drawFront(frame);
  return forest.background();
}
