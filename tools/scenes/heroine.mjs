// Line up each heroine animation in a small gallery for the issue snapshots.
import { hex, painterFor, backdrop } from "../../vendor/pixelfx/src/core/index.js";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { createHeroine } = await vite.ssrLoadModule("/src/game/heroine/heroine.js");
await vite.close();

const ANIMS = ["idle", "walk", "attack1", "attack2", "attack3", "hurt", "victory", "sitDown", "sit", "standUp"];

export default function (frame, t) {
  const p = painterFor(frame);
  p.line(0, 150, 320, 150, "#342b37");
  ANIMS.forEach((name, i) => {
    const x = 17 + i * 32;
    const heroine = createHeroine({ x, y: 150 });
    heroine.play(name);
    heroine.update(t);
    heroine.draw(frame);
    p.place(0, 0);
    p.text(name.toUpperCase().replace("ATTACK", "ATK"), x, 10, hex("#e7d6c2"), { font: "mini", align: "center", outline: hex("#17121f") });
  });
  return backdrop("sky", 320, 180);
}
