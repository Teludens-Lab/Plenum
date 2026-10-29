import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "product-shell.spec.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  globalSetup: "../global-setup.mjs",
  globalTeardown: "../global-teardown.mjs",
  outputDir: "../../../output/playwright/ps-700/results",
  reporter: [["line"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    colorScheme: "light",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "node ../runtime-server.mjs --local-user-test",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 30_000
  }
});
