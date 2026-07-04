import { defineConfig, devices } from "@playwright/test";

/**
 * Visual-baseline suite for the colour-normalization work (Phase 3.3).
 * Kept separate from playwright.config.ts so the functional e2e gate
 * (`npx playwright test`) never fails on pixel drift.
 *
 * Usage:
 *   npx playwright test -c playwright.screenshots.config.ts                    # compare against baselines
 *   npx playwright test -c playwright.screenshots.config.ts --update-snapshots # (re)record baselines
 */
export default defineConfig({
  testDir: "./tests/screenshots",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  expect: {
    toHaveScreenshot: {
      // Small tolerance for canvas antialiasing; colour changes are far larger.
      maxDiffPixelRatio: 0.002,
      animations: "disabled",
      caret: "hide",
    },
  },
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    trace: "off",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --port 4173",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
