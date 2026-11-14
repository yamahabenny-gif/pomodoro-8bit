// The middle of the fight -> camp crossfade (0.75 s into the 1.5 s dissolve).
import { createForest } from "../../src/game/scene/forest.js";
import { painterFor, drawActor, stockActor } from "../../vendor/pixelfx/src/core/index.js";

export default function (frame, t) {
  const forest = createForest();
  forest.scroll(120);
  forest.setMode("camp");
  for (let s = 0; s < t; s += 1 / 30) forest.update(1 / 30);
  forest.drawBack(frame);
  const p = painterFor(frame);
  p.place(200, 150);
  drawActor(p, stockActor(2));
  forest.drawFront(frame);
  return forest.background();
}
