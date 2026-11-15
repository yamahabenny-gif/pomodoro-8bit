// Native-size contact sheet: each row shares a ground line for silhouette comparison.
import { hex, painterFor } from "../../vendor/pixelfx/src/core/index.js";
import { createServer } from "vite";
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { createHeroine } = await vite.ssrLoadModule("/src/game/heroine/heroine.js");
await vite.close();
export default function (frame, t) {
  const p = painterFor(frame);
  const poses = [["idle", 0], ["walk", 0.09], ["attack1", 0.39], ["attack2", 0.4], ["attack3", 0.42], ["hurt", 0.2], ["victory", 0.4], ["sitDown", 0.1], ["sit", 0], ["standUp", 0.3], ["lightFire", 0.8], ["levelUp", 0.5]];
  poses.forEach(([anim, elapsed], i) => {
    const x = 35 + (i % 4) * 78, y = 51 + Math.floor(i / 4) * 59;
    p.place(0, 0);
    p.line(x - 22, y, x + 34, y, hex("#615563"));
    p.text(anim.toUpperCase().replace("ATTACK", "ATK").replace("LIGHTFIRE", "FIRE").replace("SITDOWN", "SIT DN").replace("STANDUP", "STAND"), x - 15, y + 3, hex("#c9d4e0"), { font: "mini" });
    const heroine = createHeroine({ x, y });
    heroine.play(anim); heroine.update(elapsed + t); heroine.draw(frame);
  });
  return hex("#302c40");
}
