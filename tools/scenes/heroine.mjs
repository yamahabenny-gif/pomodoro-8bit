// Four timed drawings per row make a compact filmstrip for each animation.
import { hex, painterFor, backdrop } from "../../vendor/pixelfx/src/core/index.js";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { createHeroine } = await vite.ssrLoadModule("/src/game/heroine/heroine.js");
await vite.close();

const GROUPS = [
  ["idle", "walk", "attack1"],
  ["attack2", "attack3", "hurt"],
  ["victory", "sitDown", "sit"],
  ["standUp", "lightFire", "levelUp"],
];
const DURATIONS = { idle: 0.34, walk: 0.34, sit: 0.34, attack1: 0.68, attack2: 0.72, attack3: 0.84, hurt: 0.38, victory: 0.9, sitDown: 0.65, standUp: 0.62, lightFire: 1.25, levelUp: 1.2 };
const SAMPLES = [0, 0.27, 0.54, 0.82];
const XS = [72, 136, 200, 264];

export default function (frame, t) {
  const p = painterFor(frame);
  const group = Math.min(GROUPS.length - 1, Math.floor(Math.max(0, t)));
  const anims = GROUPS[group];
  p.text(`FILMSTRIP ${group + 1}/4`, 4, 2, hex("#fff0d5"), { font: "mini", outline: hex("#17121f") });
  SAMPLES.forEach((sample, i) => p.text(`${Math.round(sample * 100)}%`, XS[i] - 4, 9, hex("#c2a898"), { font: "mini", align: "center", outline: hex("#17121f") }));

  anims.forEach((name, row) => {
    const baseline = 52 + row * 58;
    const label = name.toUpperCase().replace("ATTACK", "ATK").replace("SITDOWN", "SIT DN").replace("STANDUP", "STAND").replace("LIGHTFIRE", "LIGHT FIRE").replace("LEVELUP", "LEVEL UP");
    p.place(0, 0);
    p.text(label, 2, baseline - 13, hex("#f4d9a1"), { font: "mini", outline: hex("#17121f") });
    p.line(32, baseline, 320, baseline, hex("#342b37"));
    XS.forEach((x, i) => {
      const sample = SAMPLES[i];
      const heroine = createHeroine({ x, y: baseline });
      heroine.play(name);
      const duration = DURATIONS[name] ?? 0.72;
      heroine.update(duration * sample);
      heroine.draw(frame);
    });
  });
  return backdrop("sky", 320, 180);
}
