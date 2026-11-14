// Snapshot the integration at t=5 (fight), t=20 (camp) and t=30 (night).
import { createServer } from "vite";
import { createFrame } from "../../vendor/pixelfx/src/core/index.js";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const [{ createDirector }, { createHeroine }, { createForest }] = await Promise.all([
  vite.ssrLoadModule("/src/game/director/director.js"),
  vite.ssrLoadModule("/src/game/heroine/heroine.js"),
  vite.ssrLoadModule("/src/game/scene/forest.js"),
]);
await vite.close();

export default function (frame, t) {
  const phase = t >= 25 ? "long" : t >= 10 ? "short" : "focus";
  const totalMs = phase === "focus" ? 900_000 : phase === "long" ? 1_200_000 : 300_000;
  const timerState = { phase, totalMs, remainingMs: totalMs, completedFocus: 0 };
  const timer = { state: () => ({ ...timerState }), on: () => () => {} };
  const forest = createForest();
  const heroine = createHeroine({ x: 112, y: 150 });
  const director = createDirector({ stage: { frame }, forest, heroine, timer, sfx: null });
  const duration = phase === "focus" ? t : Math.min(2, t - (phase === "long" ? 25 : 10));
  for (let elapsed = 0; elapsed < duration; elapsed += 1 / 30) {
    const dt = Math.min(1 / 30, duration - elapsed);
    timerState.remainingMs = Math.max(0, timerState.remainingMs - dt * 60_000);
    director.update(dt);
  }
  director.draw();
  return forest.background();
}
