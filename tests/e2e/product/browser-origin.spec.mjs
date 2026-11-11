import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { expect, test } from "@playwright/test";
import { fixture } from "../fixture.mjs";

test.use({ trace: "off" });

async function freePort() {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("BA-03-T01/T03 real sibling-origin browser sends its cookie but cannot sync or mutate", async ({ browser }, testInfo) => {
  const directory = await mkdtemp(join(tmpdir(), "plenum-ba03-tls-"));
  const owner = new Pool({ connectionString: process.env.DATABASE_URL });
  const observed = [], connections = new Set();
  let service, tls, isolatedBrowser;
  try {
    const openssl = process.env.PLENUM_TEST_OPENSSL ?? (process.platform === "win32" && existsSync("C:/Program Files/Git/usr/bin/openssl.exe")
      ? "C:/Program Files/Git/usr/bin/openssl.exe" : "openssl");
    const cert = join(directory, "cert.pem"), key = join(directory, "key.pem");
    const generated = spawnSync(openssl, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-keyout", key, "-out", cert, "-subj", "/CN=app.plenum.test", "-addext", "subjectAltName=DNS:app.plenum.test,DNS:sibling.plenum.test"],
    { windowsHide: true, encoding: "utf8" });
    assert.equal(generated.status, 0);
    const appPort = await freePort(), metricsPort = await freePort();
    const token = fixture.authenticationSessions.designerA;
    const capture = (request, status) => observed.push({ method: request.method, path: request.url, origin: request.headers.origin,
      cookieDelivered: request.headers.cookie?.includes(`plenum_session=${token}`) === true, status });
    tls = createHttpsServer({ key: await readFile(key), cert: await readFile(cert) }, (request, response) => {
      if (request.url === "/__test__/blank") {
        response.writeHead(200, { "content-type": "text/html" }); response.end("<!doctype html><title>BA-03 synthetic origin</title>"); return;
      }
      const upstream = httpRequest({ hostname: "127.0.0.1", port: appPort, method: request.method, path: request.url,
        headers: { ...request.headers, "x-forwarded-for": "192.0.2.3" } }, (reply) => {
        capture(request, reply.statusCode); response.writeHead(reply.statusCode, reply.headers); reply.pipe(response);
      });
      upstream.on("error", () => { response.writeHead(502); response.end(); });
      request.pipe(upstream);
    });
    tls.on("connection", (socket) => { connections.add(socket); socket.on("close", () => connections.delete(socket)); });
    tls.on("upgrade", (request, socket, head) => {
      const upstream = httpRequest({ hostname: "127.0.0.1", port: appPort, path: request.url,
        headers: { ...request.headers, "x-forwarded-for": "192.0.2.3" } });
      upstream.on("upgrade", (reply, peer, peerHead) => {
        capture(request, 101);
        socket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(reply.headers).map(([name, value]) => `${name}: ${value}`).join("\r\n")}\r\n\r\n`);
        if (peerHead.length) socket.write(peerHead);
        if (head.length) peer.write(head);
        socket.pipe(peer).pipe(socket);
        socket.on("error", () => peer.destroy()); peer.on("error", () => socket.destroy());
      });
      upstream.on("response", (reply) => { capture(request, reply.statusCode); reply.resume();
        socket.end(`HTTP/1.1 ${reply.statusCode} Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); });
      upstream.on("error", () => socket.destroy()); upstream.end();
    });
    tls.listen(0, "127.0.0.1"); await once(tls, "listening");
    const port = tls.address().port, origin = `https://app.plenum.test:${port}`, sibling = `https://sibling.plenum.test:${port}`;
    service = spawn(process.execPath, ["deploy/compose/profile-service.mjs"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: "1", NODE_ENV: "production", PORT: String(appPort), METRICS_PORT: String(metricsPort),
        PLENUM_DEPLOYMENT_PROFILE: "cloud", PLENUM_TRUST_PROXY: "1", PLENUM_PUBLIC_BASE_URL: origin,
        PLENUM_DEPLOYMENT_ID: randomUUID(), PLENUM_RETENTION_ACTOR_PERSON_ID: fixture.people.operator,
        OIDC_ISSUER: origin, OIDC_PROVIDER_KEY: "ba03", OIDC_ORGANIZATION_ID: fixture.organizationId,
        OIDC_CLIENT_ID: "ba03", OIDC_REDIRECT_URI: `${origin}/auth/callback`, S3_BUCKET: "ba03-synthetic",
        MEDIA_URL: "wss://localhost", MEDIA_API_KEY: "synthetic", MEDIA_API_SECRET: "synthetic-media-secret",
        MEDIA_ADAPTER_DIGEST: `sha256:${"e".repeat(64)}`, FLOOR_TOKEN_SECRET: "synthetic-floor-token-secret",
        INVITATION_DELIVERY_ENDPOINT: `${origin}/synthetic-delivery`, INVITATION_DELIVERY_BEARER_TOKEN: "synthetic-delivery",
        INVITATION_DELIVERY_WEBHOOK_TOKEN: "synthetic-webhook", NOTIFICATIONS_HOSTNAME: "" } });
    service.stdout.resume(); service.stderr.resume();
    await expect.poll(() => fetch(`http://127.0.0.1:${appPort}/`).then((r) => r.status).catch(() => 0), { timeout: 20_000 }).toBe(200);
    isolatedBrowser = await browser.browserType().launch({ args: ["--no-proxy-server", "--host-resolver-rules=MAP app.plenum.test 127.0.0.1, MAP sibling.plenum.test 127.0.0.1"] });
    const context = await isolatedBrowser.newContext({ ignoreHTTPSErrors: true });
    await context.addCookies([{ name: "plenum_session", value: token, domain: "app.plenum.test", path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
    const page = await context.newPage();
    const websocket = `${origin.replace("https:", "wss:")}/v1/projects/${fixture.projectId}/collaboration`;
    const probe = (endpoint) => new Promise((resolve) => {
      const socket = new WebSocket(endpoint);
      socket.onmessage = (event) => { const type = JSON.parse(event.data).type; socket.close(); resolve(type); };
      socket.onerror = () => resolve("rejected");
    });
    await page.goto(`${origin}/__test__/blank`);
    expect(await page.evaluate(probe, websocket)).toBe("sync");
    const before = Number((await owner.query("SELECT count(*) FROM studio.simulation_projects")).rows[0].count);
    await page.goto(`${sibling}/__test__/blank`);
    expect(await page.evaluate(probe, websocket)).toBe("rejected");
    await page.evaluate(async (url) => {
      await fetch(`${url}/v1/projects`, { method: "POST", mode: "no-cors", credentials: "include", headers: { "content-type": "text/plain" },
        body: JSON.stringify({ requestId: crypto.randomUUID(), title: "Denied sibling mutation" }) }).catch(() => null);
      // CORP may hide the denied response; the ingress observations below must prove cookie delivery and 403.
      await fetch(`${url}/v1/auth/logout`, { method: "POST", mode: "no-cors", credentials: "include" }).catch(() => null);
    }, origin);
    expect(Number((await owner.query("SELECT count(*) FROM studio.simulation_projects")).rows[0].count)).toBe(before);
    expect((await owner.query("SELECT revoked_at FROM identity.authentication_sessions WHERE id=$1", [token])).rows[0].revoked_at).toBe(null);
    const hostile = observed.filter((event) => event.origin === sibling);
    expect(hostile).toHaveLength(3);
    expect(hostile.every(({ cookieDelivered, status }) => cookieDelivered && status === 403)).toBe(true);
    await page.goto(`${origin}/__test__/blank`);
    const mutate = ({ type, title }) => fetch("/v1/projects", { method: "POST", headers: { "content-type": type },
      body: JSON.stringify({ requestId: crypto.randomUUID(), title }) }).then((r) => r.status);
    expect(await page.evaluate(mutate, { type: "text/plain", title: "Denied plain text" })).toBe(422);
    expect(await page.evaluate(mutate, { type: "application/json", title: "BA-03 approved browser" })).toBe(201);
    await testInfo.attach("ba03-browser-origin-evidence", { body: JSON.stringify({ browser: isolatedBrowser.version(), approvedOrigin: origin,
      hostileOrigin: sibling, cookie: "host-only; HttpOnly; Secure; SameSite=Lax; value omitted", observed }), contentType: "application/json" });
  } finally {
    await isolatedBrowser?.close();
    if (service) { service.kill(); await once(service, "exit"); }
    for (const socket of connections) socket.destroy();
    if (tls) await new Promise((resolve) => tls.close(resolve));
    await owner.end();
    await rm(directory, { recursive: true, force: true });
  }
});
