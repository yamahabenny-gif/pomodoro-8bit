// Storm shelter, with optional ignition for snapshots.
import { createRest } from "../../src/game/scene/rest.js";
import { createHeroine } from "./forest-heroine.mjs";

export default function (frame, t) {
  const rest = createRest("storm");
  if (t > 0.5) rest.ignite();
  for (let s = 0; s < t; s += 1 / 30) rest.update(1 / 30);
  rest.drawBack(frame);
  const heroine = createHeroine({ x: rest.seatX, y: 150 });
  heroine.play("sit");
  heroine.update(t);
  heroine.draw(frame);
  rest.drawFront(frame);
  return rest.background();
}
