import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "./",
  resolve: { alias: { pixelfx: fileURLToPath(new URL("./vendor/pixelfx/src", import.meta.url)) } },
  test: { environment: "node", include: ["tests/**/*.test.js"] },
});
