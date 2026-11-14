// The boot smoke scene from src/main.js, stepped to time t.
import { createFx, painterFor, drawActor, stockActor, backdrop } from "../../vendor/pixelfx/src/core/index.js";
import * as campfire from "../../vendor/pixelfx/src/fx/fire/campfire.js";
import * as fireflies from "../../vendor/pixelfx/src/fx/weather/fireflies.js";

export default function (frame, t) {
  const fire = createFx(campfire, { x: 180, y: 150 }), flies = createFx(fireflies, { x: 160, y: 170 });
  for (let s = 0; s < t; s += 1 / 30) (fire.update(1 / 30), flies.update(1 / 30));
  flies.draw(frame);
  fire.draw(frame, "back");
  const p = painterFor(frame);
  p.place(150, 150);
  drawActor(p, stockActor(2));
  fire.draw(frame, "front");
  return backdrop("sky", 320, 180);
}
