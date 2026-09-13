import { defineConfig, devices } from "@playwright/test";

/**
 * Production-grade Playwright configuration (Major Update 2).
 *
 * The suite runs the app in DEMO MODE (no Supabase env vars are set for the
 * webServer), which is exactly the tested, fully-navigable in-browser store
 * with a simulated streaming assistant. On every push CI installs Chromium
 * and runs this file as its own gate.
 *
 * Principles:
 *  - Deterministic: every spec resets the demo store and signs in fresh.
 *  - Stable selectors: we target roles, names, labels and a small set of
 *    `data-testid` hooks — never coordinates or generated CSS.
 *  - Reduced motion: the browser emulates `prefers-reduced-motion: reduce`,
 *    exercising the global reduced-motion override (and keeping runs fast).
 *  - Diagnostics: HTML report, screenshot + trace on failure, video on retry.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  timeout: 30_000,
  expect: { timeout: 8_000 },

  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "en-US",
    // Emulate reduced motion so the global `prefers-reduced-motion` override
    // is exercised (and CSS transitions are collapsed to an instant cut).
    contextOptions: { reducedMotion: "reduce" },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // Force demo mode even if the developer has Supabase keys present.
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    },
  },
});
