import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { createHeroine } = await vite.ssrLoadModule("/src/game/heroine/heroine.js");
await vite.close();

export { createHeroine };
