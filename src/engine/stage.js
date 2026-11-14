// The pixel stage: one 320 x 180 pixelfx frame, composited onto the canvas each tick and scaled up with
// image-rendering: pixelated. Everything that draws gets the same frame; layer order is the caller's job.
import { createFrame, clearFrame, composite } from "pixelfx/core/index.js";

export const W = 320;
export const H = 180;
/** y of the forest floor; feet stand here. */
export const GROUND_Y = 150;

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {{ frame, W, H, present(bg?: Uint32Array|number|null): void, clear(): void }}
 */
export function createStage(canvas) {
  const ctx = canvas.getContext("2d");
  const frame = createFrame(W, H);
  const img = new ImageData(W, H);
  return {
    frame,
    W,
    H,
    clear() {
      clearFrame(frame);
    },
    present(bg = 0xff140d0d) {
      composite(frame, img.data, bg);
      ctx.putImageData(img, 0, 0);
    },
  };
}

/**
 * requestAnimationFrame loop with dt in seconds, clamped so a background tab doesn't jump the simulation.
 * The timer never relies on this loop for correctness (see src/timer).
 * @param {(dt: number, now: number) => void} tick
 * @returns {() => void} stop
 */
export function startLoop(tick) {
  let last = performance.now(), id = 0;
  const step = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    tick(dt, now);
    id = requestAnimationFrame(step);
  };
  id = requestAnimationFrame(step);
  return () => cancelAnimationFrame(id);
}
