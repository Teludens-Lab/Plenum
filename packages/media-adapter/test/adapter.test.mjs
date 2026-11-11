import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { LiveKitLocalMediaProviderAdapter } from "../dist/index.js";

const options = {
  apiUrl: "https://media.plenum.lan:7880",
  websocketUrl: "wss://media.plenum.lan:7880",
  apiKey: "fixture-key",
  apiSecret: "fixture-secret-at-least-sixteen",
  adapterDigest: `sha256:${"e".repeat(64)}`,
  allowedHosts: ["media.plenum.lan"]
};

test("VOICE-06/07 local adapter rejects public or insecure non-loopback endpoints", () => {
  assert.doesNotThrow(() => new LiveKitLocalMediaProviderAdapter(options));
  assert.throws(() => new LiveKitLocalMediaProviderAdapter({ ...options, websocketUrl: "wss://public.example" }), /allow-list/u);
  assert.throws(() => new LiveKitLocalMediaProviderAdapter({ ...options, apiUrl: "http://media.plenum.lan:7880" }), /loopback/u);
  assert.doesNotThrow(() => new LiveKitLocalMediaProviderAdapter({ ...options, apiUrl: "http://127.0.0.1:7880",
    websocketUrl: "ws://127.0.0.1:7880", allowedHosts: ["127.0.0.1"], allowInsecureLoopback: true }));
});

test("provider removal is idempotent when the participant or room is already gone", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ code: "not_found", msg: "target does not exist", meta: {} }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const adapter = new LiveKitLocalMediaProviderAdapter({ ...options, apiUrl: `http://127.0.0.1:${address.port}`,
      websocketUrl: `ws://127.0.0.1:${address.port}`, allowedHosts: ["127.0.0.1"], allowInsecureLoopback: true });
    const target = { organizationId: "org", sessionId: "session", channelId: "channel", participantId: "participant" };
    await assert.doesNotReject(adapter.removeParticipant(target));
    await assert.doesNotReject(adapter.closeChannel(target));
    await assert.doesNotReject(adapter.setTransmit(target, false));
    await assert.rejects(adapter.setTransmit(target, true));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
