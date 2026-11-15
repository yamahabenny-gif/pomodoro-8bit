import { createServer } from "vite";
import { createFrame } from "../../vendor/pixelfx/src/core/index.js";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const [{ createDirector }, { createHeroine }, { createForest }, { createRest }, { createEnemy }] = await Promise.all([
  vite.ssrLoadModule("/src/game/director/director.js"),
  vite.ssrLoadModule("/src/game/heroine/heroine.js"),
  vite.ssrLoadModule("/src/game/scene/forest.js"),
  vite.ssrLoadModule("/src/game/scene/rest.js"),
  vite.ssrLoadModule("/src/game/enemies/enemies.js"),
]);
await vite.close();

export default function (frame, t) {
  if (t < 2) {
    const forest = createForest();
    forest.setMode("fight", { instant: true });
    const heroine = createHeroine({ x: 112, y: 150 });
    heroine.play("attack2");
    const golem = createEnemy("golem", { x: 154, y: 150 });
    golem.approach(122);
    for (let i = 0; i < 15; i++) { forest.update(1 / 30); golem.update(1 / 30); }
    forest.drawBack(frame); heroine.draw(frame); golem.draw(frame); forest.drawFront(frame);
    return forest.background();
  }

  if (t < 3) {
    const rest = createRest("storm");
    rest.ignite();
    for (let i = 0; i < 30; i++) rest.update(0.05);
    const heroine = createHeroine({ x: rest.seatX, y: 150 });
    heroine.play("sit");
    rest.drawBack(frame); heroine.draw(frame); rest.drawFront(frame);
    return rest.background();
  }

  if (t < 4) {
    const rest = createRest("lake", { night: true });
    rest.ignite();
    for (let i = 0; i < 30; i++) rest.update(0.05);
    const heroine = createHeroine({ x: rest.seatX, y: 150 });
    heroine.play("sit");
    rest.drawBack(frame); heroine.draw(frame); rest.drawFront(frame);
    return rest.background();
  }

  const forest = createForest();
  forest.setMode("fight", { instant: true });
  const heroine = createHeroine({ x: 112, y: 150 });
  let listener;
  const progress = { on(name, fn) { if (name === "levelup") listener = fn; } };
  const timer = { state: () => ({ phase: "focus", totalMs: 1_500_000, remainingMs: 1_200_000, completedFocus: 0 }), on: () => () => {} };
  const director = createDirector({ stage: { frame }, forest, heroine, timer, progress, ui: { levelUp() {} } });
  listener?.({ level: 2 });
  director.update(0.05);
  director.draw();
  return director.background();
}
