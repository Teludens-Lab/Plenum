import assert from "node:assert/strict";
import { createServer } from "node:net";
import test from "node:test";

import { ClamAvContentScanner, OperationalTelemetry } from "../dist/index.js";

const deploymentId = "10000000-0000-4000-8000-000000000001";

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
    { reply: "stream: OK\n", status: "clean" },
    { reply: "stream: Eicar-Test-Signature FOUND\n", status: "infected" }
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
  const server = await scannerServer("PONG\n");
  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    const scanner = new ClamAvContentScanner({ host: "127.0.0.1", port: address.port, timeoutMs: 1_000 });
    assert.equal(await scanner.health(), "available");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
