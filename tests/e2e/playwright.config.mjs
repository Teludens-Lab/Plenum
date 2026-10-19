import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "runtime.spec.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  globalSetup: "./global-setup.mjs",
  outputDir: "../../output/playwright/ps-150/results",
  reporter: [["line"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    permissions: ["microphone"],
    launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
    colorScheme: "dark",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "node runtime-server.mjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 30_000
  }
});
