import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.UI_TEST_URL ?? "http://127.0.0.1:3001",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    },
    // UI review contains synthetic data only. Never save real-user storage state.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
