import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("VOICE-07 candidate media profile declares local relay and disables public address discovery", async () => {
  const profile = await readFile("deploy/media/livekit.yaml", "utf8");
  assert.match(profile, /use_external_ip:\s*false/u);
  assert.match(profile, /domain:\s*media\.plenum\.lan/u);
  assert.doesNotMatch(profile, /stun|\.com|\.net|\.org/u);
  assert.match(await readFile("docs/media-runbook.md", "utf8"), /zero public destinations/u);
});

