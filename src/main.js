// Boot. For now a smoke scene that proves the pixelfx pipeline (backdrop, campfire, stock hero) end to end.
// The issue "Regie" replaces the smoke scene with menu -> timer -> director once the modules exist.
import { createStage, startLoop, W, H, GROUND_Y } from "./engine/stage.js";
import { createFx, painterFor, drawActor, stockActor, backdrop } from "pixelfx/core/index.js";
import * as campfire from "pixelfx/fx/fire/campfire.js";
import * as fireflies from "pixelfx/fx/weather/fireflies.js";

const stage = createStage(document.getElementById("stage"));
const bg = backdrop("sky", W, H);
const fire = createFx(campfire, { x: 180, y: GROUND_Y });
const flies = createFx(fireflies, { x: W / 2, y: H - 10 });
const hero = stockActor(2);

startLoop((dt) => {
  fire.update(dt);
  flies.update(dt);
  stage.clear();
  flies.draw(stage.frame);
  fire.draw(stage.frame, "back");
  const p = painterFor(stage.frame);
  p.place(150, GROUND_Y);
  drawActor(p, hero);
  fire.draw(stage.frame, "front");
  stage.present(bg);
});
