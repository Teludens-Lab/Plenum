import { defineConfig } from "@playwright/test";
const port = Number(process.env.PLENUM_E2E_PORT ?? 4173);
const existing = process.env.PLENUM_E2E_USE_EXISTING_FIXTURE === "true";
export default defineConfig({
  testDir: ".", testMatch: "*.spec.mjs", workers: 1, fullyParallel: false,
  timeout: 180_000, expect: { timeout: 20_000 },
  globalSetup: existing ? undefined : "../global-setup.mjs",
  globalTeardown: existing ? undefined : "../global-teardown.mjs",
  outputDir: "../../../output/playwright/ps-842/regression/traces",
  reporter: [["line"], ["json", { outputFile: "../../../test-results/interface-consistency/ps-842.json" }]],
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: "chromium", trace: "retain-on-failure" },
  webServer: { command: "node ../runtime-server.mjs --local-user-test", url: `http://127.0.0.1:${port}`,
    reuseExistingServer: existing, timeout: 30_000 }
});
