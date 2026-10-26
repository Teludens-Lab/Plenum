import base from "./playwright.config.mjs";

if (process.env.MEDIA_TEST_URL === undefined) {
  throw new Error("MEDIA_TEST_URL is required for the real-media recovery proof");
}

export default { ...base, grep: /VOICE-12-RECOVERY/u };
