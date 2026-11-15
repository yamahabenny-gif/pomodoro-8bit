import { createForest } from "../../src/game/scene/forest.js";
import { createHeroine } from "./forest-heroine.mjs";

export default function (frame, t) {
  const forest = createForest();
  forest.scroll(6400);
  for (let s = 0; s < t; s += 1 / 30) forest.update(1 / 30);
  forest.drawBack(frame);
  const heroine = createHeroine({ x: 150, y: 150 });
  heroine.play("walk");
  heroine.update(t);
  heroine.draw(frame);
  forest.drawFront(frame);
  return forest.background();
}
