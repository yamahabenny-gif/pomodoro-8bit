import { createFrame } from "../../vendor/pixelfx/src/core/index.js";
import { createForest } from "../../src/game/scene/forest.js";
import { createHeroine } from "./forest-heroine.mjs";

const W = 320, H = 180, PANEL = 80, CROP_X = 110;

export default function (frame, t) {
  const background = new Uint32Array(W * H);
  const offsets = [0, 3000, 6400, 9000];
  for (let panel = 0; panel < offsets.length; panel++) {
    const forest = createForest();
    forest.scroll(offsets[panel]);
    for (let s = 0; s < t; s += 1 / 30) forest.update(1 / 30);
    const layers = createFrame(W, H);
    forest.drawBack(layers);
    const heroine = createHeroine({ x: 150, y: 150 });
    heroine.play("walk");
    heroine.update(t);
    heroine.draw(layers);
    forest.drawFront(layers);
    const bg = forest.background();
    for (let y = 0; y < H; y++) {
      const row = y * W, dst = panel * PANEL + y * W;
      background.set(bg.subarray(row + CROP_X, row + CROP_X + PANEL), dst);
      frame.color.set(layers.color.subarray(row + CROP_X, row + CROP_X + PANEL), dst);
      frame.light.set(layers.light.subarray(row + CROP_X, row + CROP_X + PANEL), dst);
    }
  }
  return background;
}
