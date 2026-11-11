import base from "./playwright.config.mjs";

if (process.env.MEDIA_TEST_URL === undefined) {
  throw new Error("MEDIA_TEST_URL is required for the real-media proof");
}

export default { ...base, testMatch: ["runtime.spec.mjs", "floor-revocation.spec.mjs"], grep: /VOICE-06\/07\/11|BA-04/u };
