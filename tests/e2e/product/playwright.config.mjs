import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLENUM_E2E_PORT ?? 4173);
const baseURL = `http://127.0.0.1:${port}`;
const useExistingFixture = process.env.PLENUM_E2E_USE_EXISTING_FIXTURE === "true";

export default defineConfig({
  testDir: ".",
  testMatch: "product-shell.spec.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 60_000 },
  globalSetup: useExistingFixture ? undefined : "../global-setup.mjs",
  globalTeardown: useExistingFixture ? undefined : "../global-teardown.mjs",
  outputDir: "../../../output/playwright/ps-710/results",
  reporter: [["line"]],
  use: {
    baseURL,
    browserName: "chromium",
    colorScheme: "light",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "node ../runtime-server.mjs --local-user-test",
    url: baseURL,
    reuseExistingServer: useExistingFixture,
    timeout: 30_000
  }
});
