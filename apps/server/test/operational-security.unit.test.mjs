import assert from "node:assert/strict";
import { createServer } from "node:net";
import test from "node:test";
import { assertBrowserOrigin, configuredBrowserOrigin } from "../dist/security/browser-origin.js";

import { ClamAvContentScanner, OperationalTelemetry, classifyDeploymentRequest, sessionCommandRateLimits } from "../dist/index.js";
import {
  deliverOperationalAlert, evaluateSustainedCondition, metricWindow, parsePrometheusSnapshot,
  rehydrateSecurityEventCursor, securityEventCursor
} from "../../../deploy/compose/operations-agent.mjs";
import { parseOperationsSecretBundle } from "../../../deploy/compose/operations-secrets.mjs";

const deploymentId = "10000000-0000-4000-8000-000000000001";

test("BA-03-T02 exact Origin gate fails closed for cookie requests and preserves cookie-free machine authentication", () => {
  const approved = configuredBrowserOrigin("https://app.plenum.test");
  for (const origin of [undefined, "null", "https://sibling.plenum.test", "http://app.plenum.test", "https://app.plenum.test:444",
    "https://app.plenum.test/", "https://app.plenum.test/path", "https://app.plenum.test@evil.test", "https://app.plenum.test.evil.test",
    "https://app.plenum.test https://evil.test", [approved, approved], "malformed"]) {
    assert.throws(() => assertBrowserOrigin({ headers: { cookie: "plenum_session=synthetic", ...(origin === undefined ? {} : { origin }),
      host: "app.plenum.test", "x-forwarded-host": "app.plenum.test", authorization: "Bearer synthetic" } }, approved, deploymentId),
    (error) => error.envelope?.error.code === "PERMISSION_DENIED");
  }
  assert.doesNotThrow(() => assertBrowserOrigin({ headers: { cookie: "plenum_session=synthetic", origin: approved } }, approved, deploymentId));
  assert.doesNotThrow(() => assertBrowserOrigin({ headers: { authorization: "Bearer synthetic" } }, approved, deploymentId));
  assert.throws(() => assertBrowserOrigin({ headers: { origin: "null", authorization: "Bearer synthetic" } }, approved, deploymentId));
  assert.throws(() => assertBrowserOrigin({ headers: { cookie: "synthetic", origin: approved } }, undefined, deploymentId));
  for (const url of ["null", "file:///tmp", "https://user:password@app.plenum.test"]) assert.throws(() => configuredBrowserOrigin(url));
});

test("BA-02-T03 Command ingress ignores spoofed identities, tokens and untrusted forwarded addresses", () => {
  const request = { method: "POST", url: "/v1/sessions/known/commands", headers: {}, socket: { remoteAddress: "192.0.2.1" } };
  const baseline = classifyDeploymentRequest(request);
  assert.equal(baseline.limit, 12_000);
  for (const url of ["/v1/sessions/unknown/commands", "/v1/sessions/known/commands/receipt"]) {
    assert.deepEqual(classifyDeploymentRequest({ ...request, url, headers: {
      authorization: "Bearer attacker-token", cookie: "plenum_session=attacker", "x-principal-id": "victim",
      "x-organization-id": "victim", "x-forwarded-for": "198.51.100.1", "x-real-ip": "198.51.100.2"
    } }), baseline);
  }
  const proxy = (forwarded) => classifyDeploymentRequest({ ...request, headers: { "x-forwarded-for": forwarded } }, true);
  assert.equal(proxy("attacker, 198.51.100.7").scope, "command-ingress:ip:198.51.100.7");
  for (const forwarded of ["not-an-ip", "198.51.100.1, garbage", ["198.51.100.1", "198.51.100.2"], "fe80::1%eth0"]) {
    assert.deepEqual(proxy(forwarded), baseline);
  }
  assert.deepEqual(proxy("2001:db8:0:0:0:0:0:1"), proxy("2001:db8::1"));
  assert.deepEqual(proxy("::ffff:192.0.2.1"), proxy("::ffff:c000:201"));
});

test("BA-02-T02/T03 Command ownership is Organization/principal and separately Organization/Session", () => {
  const context = { organizationId: "ORG-A", principalId: "PERSON-A", sessionId: "SESSION-A" };
  const [principal, session] = sessionCommandRateLimits(context);
  assert.equal(principal.limit, 120);
  assert.equal(session.limit, 1_200);
  assert.deepEqual(sessionCommandRateLimits({ ...context, authenticationSessionId: "new-login", deviceId: "new-device",
    activeSessionRoleId: "new-role" }), [principal, session]);
  assert.deepEqual(sessionCommandRateLimits({ organizationId: "org-a", principalId: "person-a", sessionId: "session-a" }), [principal, session]);
  assert.notEqual(sessionCommandRateLimits({ ...context, principalId: "PERSON-B" })[0].scope, principal.scope);
  assert.equal(sessionCommandRateLimits({ ...context, principalId: "PERSON-B" })[1].scope, session.scope);
  assert.equal(sessionCommandRateLimits({ ...context, sessionId: "SESSION-B" })[0].scope, principal.scope);
  assert.notEqual(sessionCommandRateLimits({ ...context, organizationId: "ORG-B" })[0].scope, principal.scope);
});

function request(overrides = {}) {
  return {
    method: "GET",
    url: "/v1/operator/sessions/60000000-0000-4000-8000-000000000001/projection?token=secret",
    headers: {
      authorization: "Bearer must-not-appear",
      cookie: "plenum_session=must-not-appear",
      "user-agent": "must-not-appear",
      traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01"
    },
    ...overrides
  };
}

test("PS-810 telemetry correlates Session requests without recording sensitive request data", () => {
  const lines = [];
  let clock = 1_000_000_000n;
  const telemetry = new OperationalTelemetry({ deploymentId, write: (line) => lines.push(line),
    now: () => new Date("2026-11-05T00:00:00.000Z"), clock: () => clock });
  const context = telemetry.begin(request());
  clock += 125_000_000n;
  telemetry.complete(context, { statusCode: 200 });
  assert.equal(lines.length, 1);
  const event = JSON.parse(lines[0]);
  assert.equal(event.contractId, "operational-telemetry-v1");
  assert.equal(event.sessionId, "60000000-0000-4000-8000-000000000001");
  assert.equal(event.route, "/v1/operator/sessions/:id/projection");
  assert.equal(event.traceId, "0123456789abcdef0123456789abcdef");
  assert.equal(event.durationMs, 125);
  const serialized = JSON.stringify(event);
  for (const prohibited of ["must-not-appear", "authorization", "cookie", "user-agent", "token=secret"]) {
    assert.equal(serialized.includes(prohibited), false);
  }
  const metrics = telemetry.metrics();
  assert.match(metrics, /plenum_http_server_requests_total\{method="GET",route="\/v1\/operator\/sessions\/:id\/projection",status_class="2xx"\} 1/u);
  assert.match(metrics, /plenum_operational_events_total\{event="http\.request_completed",severity="info",outcome="succeeded"\} 1/u);
  assert.equal(metrics.includes("60000000-0000-4000-8000-000000000001"), false);
});

test("PS-810 telemetry bounds attacker-controlled route cardinality", () => {
  const lines = [];
  const telemetry = new OperationalTelemetry({ deploymentId, write: (line) => lines.push(line) });
  const context = telemetry.begin(request({ url: "/unknown/alice@example.test/private-file.txt?secret=value" }));
  telemetry.complete(context, { statusCode: 404 });
  const event = JSON.parse(lines[0]);
  assert.equal(event.route, "/:value/:value/:asset");
  const serialized = `${lines[0]}${telemetry.metrics()}`;
  for (const prohibited of ["alice@example.test", "private-file.txt", "secret=value"]) assert.equal(serialized.includes(prohibited), false);
});

test("PS-810 telemetry rejects arbitrary event and category values", () => {
  const telemetry = new OperationalTelemetry({ deploymentId, write() {} });
  assert.throws(() => telemetry.emit({ event: "invalid event", severity: "error", outcome: "failed",
    correlationId: "20000000-0000-4000-8000-000000000001" }), /identifiers are invalid/u);
  assert.throws(() => telemetry.emit({ event: "security.failed", severity: "error", outcome: "failed",
    correlationId: "20000000-0000-4000-8000-000000000001", category: "email@example.test" }), /category is invalid/u);
});

async function scannerServer(reply) {
  const server = createServer((socket) => {
    socket.on("data", () => undefined);
    socket.on("end", () => socket.end(reply));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

test("PS-810 ClamAV adapter recognizes clean and infected INSTREAM responses", async (context) => {
  for (const fixture of [
    { reply: "stream: OK\0", status: "clean" },
    { reply: "stream: Eicar-Test-Signature FOUND\0", status: "infected" }
  ]) {
    await context.test(fixture.status, async () => {
      const server = await scannerServer(fixture.reply);
      try {
        const address = server.address();
        assert.equal(typeof address, "object");
        const scanner = new ClamAvContentScanner({ host: "127.0.0.1", port: address.port, timeoutMs: 1_000 });
        assert.equal((await scanner.scan(new TextEncoder().encode("bounded fixture"), "text/plain")).status, fixture.status);
      } finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      }
    });
  }
});

test("PS-810 ClamAV adapter fails closed on an invalid scanner response", async () => {
  const server = await scannerServer("unexpected\n");
  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    const scanner = new ClamAvContentScanner({ host: "127.0.0.1", port: address.port, timeoutMs: 1_000 });
    await assert.rejects(scanner.scan(new Uint8Array([1]), "application/octet-stream"), /invalid response/u);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("PS-810 ClamAV readiness uses the private daemon protocol", async () => {
  const server = await scannerServer("PONG\0");
  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    const scanner = new ClamAvContentScanner({ host: "127.0.0.1", port: address.port, timeoutMs: 1_000 });
    assert.equal(await scanner.health(), "available");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("PS-830-T06 scanner accepts exactly 20 MB and bounds daemon output", async () => {
  const server = await scannerServer("stream: OK\0");
  try {
    const scanner = new ClamAvContentScanner({ host: "127.0.0.1", port: server.address().port, timeoutMs: 5_000 });
    assert.equal((await scanner.scan(new Uint8Array(20_000_000), "application/pdf")).status, "clean");
    await assert.rejects(scanner.scan(new Uint8Array(20_000_001), "application/pdf"), /size bound/u);
    await assert.rejects(scanner.scan(new Uint8Array(), "text/plain"), /size bound/u);
  } finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  const oversized = await scannerServer("x".repeat(4097));
  try {
    const scanner = new ClamAvContentScanner({ host: "127.0.0.1", port: oversized.address().port, timeoutMs: 1_000 });
    await assert.rejects(scanner.scan(new Uint8Array([1]), "text/plain"), /response exceeded/u);
    assert.equal(await scanner.health(), "unavailable");
  } finally { await new Promise((resolve, reject) => oversized.close((error) => error ? reject(error) : resolve())); }
});

test("PS-810 operations secret is narrow and rejects unexpected credentials", () => {
  const value = parseOperationsSecretBundle(JSON.stringify({
    ALERT_RECIPIENT: "operations@example.test",
    DATABASE_PASSWORD: "a".repeat(32),
    POSTMARK_FROM: "Plenum <sender@example.test>",
    POSTMARK_SERVER_TOKEN: "b".repeat(16)
  }));
  assert.equal(value.ALERT_RECIPIENT, "operations@example.test");
  assert.throws(() => parseOperationsSecretBundle(JSON.stringify({ ...value, AWS_SECRET_ACCESS_KEY: "prohibited" })), /unknown operations secret keys/iu);
});

test("PS-810 collector calculates bounded metric windows and sustained thresholds", () => {
  const previous = parsePrometheusSnapshot([
    'plenum_http_server_requests_total{method="GET",route="/",status_class="2xx"} 10',
    'plenum_http_server_request_duration_milliseconds_bucket{method="GET",route="/",status_class="2xx",le="1000"} 10',
    'plenum_http_server_request_duration_milliseconds_bucket{method="GET",route="/",status_class="2xx",le="+Inf"} 10'
  ].join("\n"));
  const current = parsePrometheusSnapshot([
    'plenum_http_server_requests_total{method="GET",route="/",status_class="2xx"} 28',
    'plenum_http_server_requests_total{method="GET",route="/",status_class="5xx"} 2',
    'plenum_http_server_request_duration_milliseconds_bucket{method="GET",route="/",status_class="2xx",le="1000"} 28',
    'plenum_http_server_request_duration_milliseconds_bucket{method="GET",route="/",status_class="2xx",le="+Inf"} 28',
    'plenum_http_server_request_duration_milliseconds_bucket{method="GET",route="/",status_class="5xx",le="1000"} 2',
    'plenum_http_server_request_duration_milliseconds_bucket{method="GET",route="/",status_class="5xx",le="+Inf"} 2'
  ].join("\n"));
  assert.deepEqual(metricWindow(current, previous), { errorRatio: 0.1, p95Milliseconds: 1000, sampleCount: 20, eventDeltas: {} });
  assert.deepEqual(evaluateSustainedCondition(undefined, true, 1_000, 300_000), { since: 1_000, notified: false, shouldNotify: false });
  assert.deepEqual(evaluateSustainedCondition({ since: 1_000, notified: false }, true, 301_000, 300_000),
    { since: 1_000, notified: true, shouldNotify: true });
});

test("PS-810 collector preserves PostgreSQL timestamp precision in the security-event cursor", async () => {
  const eventId = "20000000-0000-4000-8000-000000000002";
  const preciseTimestamp = "2026-11-07 02:57:43.403789+00";
  assert.deepEqual(securityEventCursor({ id: eventId, recorded_at_cursor: preciseTimestamp }), {
    recordedAt: preciseTimestamp,
    id: eventId
  });

  const state = { cursor: { recordedAt: "2026-11-07T02:57:43.403Z", id: eventId } };
  let query;
  const pool = { async query(text, parameters) {
    query = { text, parameters };
    return { rows: [{ id: eventId, recorded_at_cursor: preciseTimestamp }] };
  } };
  assert.equal(await rehydrateSecurityEventCursor(pool, state, deploymentId), true);
  assert.deepEqual(state.cursor, { recordedAt: preciseTimestamp, id: eventId });
  assert.match(query.text, /recorded_at::text AS recorded_at_cursor/u);
  assert.deepEqual(query.parameters, [deploymentId, eventId]);
});

test("PS-810 operational receiver sends a scrubbed Postmark message", async () => {
  let request;
  const messageId = await deliverOperationalAlert({
    ALERT_RECIPIENT: "operations@example.test", POSTMARK_FROM: "Plenum <sender@example.test>",
    POSTMARK_SERVER_TOKEN: "secret-token-value", POSTMARK_MESSAGE_STREAM: "outbound"
  }, {
    id: "readiness-unavailable", action: "page", deploymentId,
    recordedAt: "2026-11-06T00:00:00.000Z", outcome: "failed",
    runbook: "docs/operations/PS-810-OBSERVABILITY-SECURITY.md#readiness-unavailable"
  }, async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ MessageID: "message-1" }), { status: 200 });
  });
  assert.equal(messageId, "message-1");
  assert.equal(request.url, "https://api.postmarkapp.com/email");
  assert.equal(request.init.headers["X-Postmark-Server-Token"], "secret-token-value");
  const body = JSON.parse(request.init.body);
  assert.equal(body.To, "operations@example.test");
  assert.equal(JSON.stringify(body).includes("secret-token-value"), false);
});
