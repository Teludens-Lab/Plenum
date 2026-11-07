import assert from "node:assert/strict";
import test from "node:test";
import { buildSecurityHeaders } from "../../deploy/compose/security-headers.mjs";

test("browser security headers use bounded websocket origins and explicit CSP fallbacks", () => {
  const headers = buildSecurityHeaders({
    publicBaseUrl: "https://plenum-stage-01.duckdns.org",
    mediaUrl: "wss://plenum-media-01.duckdns.org"
  });

  assert.equal(headers["cross-origin-embedder-policy"], "credentialless");
  assert.equal(headers["cross-origin-opener-policy"], "same-origin");
  assert.equal(headers["cross-origin-resource-policy"], "same-origin");
  assert.match(headers["content-security-policy"], /base-uri 'self'/u);
  assert.match(headers["content-security-policy"], /frame-ancestors 'none'/u);
  assert.match(headers["content-security-policy"], /form-action 'self'/u);
  assert.match(headers["content-security-policy"], /connect-src 'self' wss:\/\/plenum-stage-01\.duckdns\.org wss:\/\/plenum-media-01\.duckdns\.org/u);
  assert.doesNotMatch(headers["content-security-policy"], /(?:^|\s)wss:(?:\s|;|$)/u);
});

test("browser security headers deduplicate a shared application and media websocket origin", () => {
  const headers = buildSecurityHeaders({
    publicBaseUrl: "https://plenum.example",
    mediaUrl: "https://plenum.example/livekit"
  });

  assert.equal(headers["content-security-policy"].match(/wss:\/\/plenum\.example/gu)?.length, 1);
});

test("browser security headers reject non-network media schemes", () => {
  assert.throws(() => buildSecurityHeaders({
    publicBaseUrl: "https://plenum.example",
    mediaUrl: "file:///tmp/media"
  }), /MEDIA_URL must use HTTP\(S\) or WS\(S\)/u);
});
