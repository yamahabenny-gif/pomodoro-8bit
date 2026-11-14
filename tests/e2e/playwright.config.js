import { defineConfig } from "@playwright/test";

// E2E lives next to the app so it never lands in vitest (which only collects tests/**/*.test.js).
// The preview server is built from source first: the smoke test must exercise the shipped bundle.
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.js/,
  timeout: 45_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
