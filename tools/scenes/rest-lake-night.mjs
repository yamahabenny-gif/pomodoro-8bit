// Moonlit lake shore for a long break.
import { createRest } from "../../src/game/scene/rest.js";
import { painterFor, drawActor, stockActor } from "../../vendor/pixelfx/src/core/index.js";

export default function (frame, t) {
  const rest = createRest("lake", { night: true });
  rest.ignite();
  for (let s = 0; s < t; s += 1 / 30) rest.update(1 / 30);
  rest.drawBack(frame);
  const p = painterFor(frame);
  p.place(rest.seatX, 150);
  drawActor(p, stockActor(2));
  rest.drawFront(frame);
  return rest.background();
}
