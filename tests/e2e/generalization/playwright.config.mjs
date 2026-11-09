import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLENUM_E2E_PORT ?? 4240);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: ".", testMatch: "cross-simulation.spec.mjs", workers: 1, fullyParallel: false,
  timeout: 600_000, expect: { timeout: 30_000 }, globalSetup: "./bootstrap.mjs",
  globalTeardown: "../global-teardown.mjs",
  outputDir: "../../../output/playwright/ps-840/results", reporter: [["line"]],
  use: { baseURL, browserName: "chromium", viewport: { width: 1024, height: 768 }, trace: "on", screenshot: "only-on-failure" },
  webServer: { command: "node ../runtime-server.mjs --local-user-test --generalization-journey", url: baseURL,
    env: { PLENUM_E2E_PORT: String(port) }, reuseExistingServer: false, timeout: 30_000 }
});
