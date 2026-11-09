import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLENUM_E2E_PORT ?? 4173);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: ".",
  testMatch: "runtime.spec.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 40_000 },
  globalSetup: "./global-setup.mjs",
  globalTeardown: "./global-teardown.mjs",
  outputDir: "../../output/playwright/ps-150/results",
  reporter: [["line"]],
  use: {
    baseURL,
    browserName: "chromium",
    permissions: ["microphone"],
    launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
    colorScheme: "dark",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "node runtime-server.mjs",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000
  }
});
