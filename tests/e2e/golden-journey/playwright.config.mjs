import { defineConfig } from "@playwright/test";
const port = Number(process.env.PLENUM_E2E_PORT ?? 4210);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: ".", testMatch: "golden.spec.mjs", workers: 1, fullyParallel: false,
  timeout: 1_200_000, expect: { timeout: 30_000 },
  globalSetup: process.env.PLENUM_GOLDEN_RESUME === "true" ? undefined : "./bootstrap.mjs",
  globalTeardown: "../global-teardown.mjs",
  outputDir: "../../../output/playwright/golden-journey/results", reporter: [["line"]],
  use: { baseURL, browserName: "chromium", viewport: { width: 1024, height: 768 }, trace: "on", screenshot: "only-on-failure" },
  webServer: { command: "node ../runtime-server.mjs --local-user-test --golden-journey", url: baseURL,
    env: { PLENUM_E2E_PORT: String(port) }, reuseExistingServer: false, timeout: 30_000 }
});
