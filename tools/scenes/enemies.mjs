// Four-enemy pose and effect study in a dusky, layered forest clearing.
import { createEnemy, ENEMY_KINDS } from "../../src/game/enemies/enemies.js";

const positions = { gnome: 42, orc: 111, ogre: 198, golem: 282 };
const color = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return (255 << 24) | ((n & 255) << 16) | (n & 0xff00) | (n >> 16 & 255);
};

function paintForest(frame) {
  const { color: px, w, h } = frame;
  const put = (x, y, hex) => { if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = color(hex); };
  // Dusky twilight behind silhouettes, with a warm low horizon.
  const sky = ["#242035", "#292239", "#30253b", "#3b2b3d", "#4a3040", "#653946"];
  for (let y = 0; y < 150; y++) {
    const band = Math.min(sky.length - 1, Math.floor(y / 27));
    for (let x = 0; x < w; x++) put(x, y, sky[band]);
  }
  // Distant trunks and low mist.
  for (const [x, width, top] of [[8, 8, 26], [34, 5, 44], [69, 8, 20], [143, 6, 37], [183, 9, 24], [235, 6, 39], [300, 9, 18]]) {
    for (let y = top; y < 144; y++) for (let dx = 0; dx < width; dx++) put(x + dx, y, y < 90 ? "#211d35" : "#292037");
    for (let dx = -14; dx < width + 16; dx++) {
      const edge = Math.floor(Math.sin(dx * 0.8) * 3);
      for (let dy = -5; dy < 4 + edge; dy++) put(x + dx, top + dy, dx % 4 === 0 ? "#292238" : "#242036");
    }
  }
  // Ragged foreground canopy silhouettes frame the clearing.
  for (let x = 0; x < w; x++) {
    const canopy = 10 + Math.round(7 * Math.sin(x * 0.16) + 4 * Math.sin(x * 0.39));
    for (let y = 0; y < canopy; y++) put(x, y, y < canopy - 2 ? "#171728" : "#211c31");
    const groundMist = 119 + Math.round(4 * Math.sin(x * 0.055));
    for (let y = groundMist; y < 142; y++) put(x, y, y < groundMist + 4 ? "#403348" : "#373044");
  }
  // Root-laced earth, a muted grass line and a few firefly points.
  for (let x = 0; x < w; x++) {
    put(x, 149, "#17121f");
    for (let y = 150; y < h; y++) put(x, y, y < 156 ? "#4f493c" : y < 163 ? "#382e38" : "#251f2d");
    if (x % 13 === 4) put(x, 148, "#758052");
  }
  for (const [x, y] of [[26, 96], [92, 121], [159, 88], [220, 111], [307, 102]]) {
    put(x, y, "#d79b4b"); put(x + 1, y, "#f6d17a");
  }
}

export default function (frame, t) {
  paintForest(frame);
  const enemies = ENEMY_KINDS.map((kind) => createEnemy(kind, { x: positions[kind], y: 150 }));
  for (const enemy of enemies) enemy.approach(positions[enemy.kind] - 38);
  let hit = false, killed = false;
  const dt = 1 / 60;
  for (let now = 0; now < t; now += dt) {
    if (now >= 0.1) enemies.forEach((enemy) => enemy.attack());
    if (now >= 0.65 && !hit) {
      enemies.forEach((enemy) => enemy.hit(1));
      hit = true;
    }
    if (now >= 2.8 && !killed) {
      enemies.forEach((enemy) => enemy.hit(enemy.hp));
      killed = true;
    }
    enemies.forEach((enemy) => enemy.update(dt));
  }
  enemies.forEach((enemy) => enemy.draw(frame));
  return 0xff242035;
}
