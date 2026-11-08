import base from './playwright.config.mjs';
const port = Number(process.env.PLENUM_E2E_PORT ?? 4179);
process.env.PLENUM_E2E_PORT = String(port);
export default { ...base, testMatch: 'participant-workflows.spec.mjs', outputDir: '../../output/playwright/participant-workflows/results',
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}`,
    // Chromium excludes loopback ICE candidates by default; this suite's disposable SFU is loopback-only.
    launchOptions: { ...base.use.launchOptions, args: [...base.use.launchOptions.args, '--allow-loopback-in-peer-connection'] } },
  webServer: { ...base.webServer, url: `http://127.0.0.1:${port}` } };
