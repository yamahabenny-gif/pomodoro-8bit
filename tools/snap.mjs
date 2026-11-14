// Look at your pixels without a browser: node tools/snap.mjs <scene.mjs> [out.png] [seconds]
// A scene module default-exports (frame, t) => background, drawing into the 320 x 180 pixelfx frame at time t
// and returning what composite() should put behind it (Uint32Array, color number or null).
// Example: node tools/snap.mjs tools/scenes/smoke.mjs snaps/smoke.png 2
import { pathToFileURL } from "node:url";
import { createFrame, composite } from "../vendor/pixelfx/src/core/index.js";
import { writePng } from "./png.mjs";

const [scenePath, out = "snaps/snap.png", secs = "1"] = process.argv.slice(2);
if (!scenePath) throw new Error("usage: node tools/snap.mjs <scene.mjs> [out.png] [seconds]");
const { default: scene } = await import(pathToFileURL(scenePath).href);
const W = 320, H = 180, frame = createFrame(W, H);
const bg = await scene(frame, Number(secs));
await import("node:fs").then((fs) => fs.mkdirSync(new URL(".", pathToFileURL(out)), { recursive: true }));
writePng(out, composite(frame, new Uint8Array(W * H * 4), bg ?? 0xff140d0d), W, H);
console.log(`wrote ${out}`);
