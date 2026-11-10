import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { Pool } from "pg";
import { expect, test } from "@playwright/test";
import { fixture } from "../fixture.mjs";

// Traces would retain one-time codes and HttpOnly credentials.
test.use({ trace: "off" });

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("BA-01-T01/T02/T03 production callback binds isolated browsers and preserves safe destinations", async ({ browser }) => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const directory = await mkdtemp(join(tmpdir(), "plenum-ba01-tls-"));
  const owner = new Pool({ connectionString: process.env.DATABASE_URL });
  const contexts = [];
  let service, tls;
  try {
    const openssl = process.env.PLENUM_TEST_OPENSSL ?? (process.platform === "win32" && existsSync("C:/Program Files/Git/usr/bin/openssl.exe")
      ? "C:/Program Files/Git/usr/bin/openssl.exe" : "openssl");
    const cert = join(directory, "cert.pem"), key = join(directory, "key.pem");
    const generated = spawnSync(openssl, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-keyout", key, "-out", cert, "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"],
    { windowsHide: true, encoding: "utf8" });
    assert.equal(generated.status, 0, "OpenSSL must generate the disposable local TLS fixture");
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = { ...await exportJWK(publicKey), kid: "ba01-browser" };
    const appPort = await freePort(), metricsPort = await freePort();
    const transactions = new Map();
    let exchanges = 0, issuer, origin, scenario = 0;
    tls = createHttpsServer({ key: await readFile(key), cert: await readFile(cert) }, async (req, res) => {
      const url = new URL(req.url, issuer);
      if (url.pathname === "/protocol/openid-connect/auth") {
        const code = randomUUID();
        transactions.set(code, { nonce: url.searchParams.get("nonce"), challenge: url.searchParams.get("code_challenge") });
        const callback = new URL("/auth/callback", origin);
        callback.searchParams.set("code", code);
        callback.searchParams.set("state", url.searchParams.get("state"));
        res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" });
        res.end(`<a href="${callback.toString().replaceAll("&", "&amp;")}">Complete synthetic login</a>`);
      } else if (url.pathname === "/protocol/openid-connect/certs") {
        res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ keys: [jwk] }));
      } else if (url.pathname === "/protocol/openid-connect/token") {
        exchanges++;
        let body = "";
        for await (const chunk of req) body += chunk;
        const form = new URLSearchParams(body), transaction = transactions.get(form.get("code"));
        if (!transaction || transaction.challenge !== createHash("sha256").update(form.get("code_verifier") ?? "").digest("base64url")) {
          res.writeHead(400); res.end(); return;
        }
        transactions.delete(form.get("code"));
        const token = await new SignJWT({ nonce: transaction.nonce, acr: "mfa" })
          .setProtectedHeader({ alg: "RS256", kid: jwk.kid }).setIssuer(issuer).setAudience("ba01-browser")
          .setSubject("ba01-browser").setIssuedAt().setExpirationTime("10m").sign(privateKey);
        res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ id_token: token }));
      } else {
        const upstream = httpRequest({ hostname: "127.0.0.1", port: appPort, path: req.url, method: req.method,
          headers: { ...req.headers, "x-forwarded-for": `192.0.2.${scenario + 1}` } },
        (reply) => { res.writeHead(reply.statusCode, reply.headers); reply.pipe(res); });
        upstream.on("error", () => { res.writeHead(502); res.end(); });
        req.pipe(upstream);
      }
    });
    tls.listen(0, "127.0.0.1");
    await once(tls, "listening");
    origin = `https://localhost:${tls.address().port}`;
    issuer = `https://127.0.0.1:${tls.address().port}`;
    await owner.query(`INSERT INTO identity.federated_identities(id,organization_id,person_id,issuer,subject,provider_type)
      VALUES ($1,$2,$3,$4,'ba01-browser','oidc')`, [randomUUID(), fixture.organizationId, fixture.people.operator, issuer]);
    service = spawn(process.execPath, ["deploy/compose/profile-service.mjs"], { cwd: root, windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_EXTRA_CA_CERTS: cert, NODE_TLS_REJECT_UNAUTHORIZED: "1",
        PORT: String(appPort), METRICS_PORT: String(metricsPort), PLENUM_DEPLOYMENT_PROFILE: "cloud", PLENUM_TRUST_PROXY: "1",
        PLENUM_PUBLIC_BASE_URL: origin, PLENUM_DEPLOYMENT_ID: randomUUID(), PLENUM_RETENTION_ACTOR_PERSON_ID: fixture.people.operator,
        OIDC_ISSUER: issuer, OIDC_PROVIDER_KEY: "ba01-browser", OIDC_ORGANIZATION_ID: fixture.organizationId,
        OIDC_CLIENT_ID: "ba01-browser", OIDC_REDIRECT_URI: `${origin}/auth/callback`, S3_BUCKET: "ba01-synthetic",
        MEDIA_URL: "wss://localhost", MEDIA_API_KEY: "synthetic", MEDIA_API_SECRET: "synthetic-media-secret",
        MEDIA_ADAPTER_DIGEST: `sha256:${"e".repeat(64)}`, FLOOR_TOKEN_SECRET: "synthetic-floor-token-secret",
        INVITATION_DELIVERY_ENDPOINT: `${origin}/synthetic-delivery`, INVITATION_DELIVERY_BEARER_TOKEN: "synthetic-delivery",
        INVITATION_DELIVERY_WEBHOOK_TOKEN: "synthetic-webhook", NOTIFICATIONS_HOSTNAME: "" } });
    // Retain no service output: failure telemetry is verified separately and must not capture credentials.
    service.stdout.resume(); service.stderr.resume();
    await expect.poll(async () => {
      if (service.exitCode !== null) throw new Error(`Production service exited ${service.exitCode}`);
      return fetch(`http://127.0.0.1:${appPort}/`).then((r) => r.status).catch(() => 0);
    }, { timeout: 20_000 }).toBe(200);
    for (let index = 0; index < 2; index++) contexts.push(await browser.newContext({ ignoreHTTPSErrors: true }));
    const [a, b] = contexts, pageA = await a.newPage(), pageB = await b.newPage();
    const start = async (page, destination = "/?ba01=ok#complete") => {
      // Each scenario represents a new synthetic ingress IP; retain the production rate limiter.
      scenario++;
      await page.goto(`${origin}/auth/login?platformRecovery=1&returnTo=${encodeURIComponent(destination)}`);
      return page.getByRole("link", { name: "Complete synthetic login" }).getAttribute("href");
    };
    const sessionCount = async () => Number((await owner.query("SELECT count(*) FROM identity.authentication_sessions WHERE issuer=$1", [issuer])).rows[0].count);
    const callback = await start(pageA);
    const cookies = await a.cookies(origin);
    const binding = cookies.find(({ name }) => name.startsWith("__Host-plenum_login_"));
    expect(Boolean(binding?.httpOnly && binding.secure && binding.sameSite === "Lax" && binding.path === "/")).toBe(true);
    expect(binding.expires - Date.now() / 1000).toBeGreaterThan(280);
    const sameOriginPage = await a.newPage();
    await sameOriginPage.goto(origin);
    expect(await sameOriginPage.evaluate(() => document.cookie.includes("plenum_login"))).toBe(false);
    await sameOriginPage.close();
    const before = exchanges;
    const denied = await pageB.goto(callback);
    expect(denied.status()).toBe(401);
    expect(exchanges).toBe(before);
    expect(await sessionCount()).toBe(0);
    expect((await b.cookies(origin)).some(({ name }) => name === "plenum_session")).toBe(false);
    await pageA.getByRole("link", { name: "Complete synthetic login" }).click();
    await expect(pageA).toHaveURL(`${origin}/?ba01=ok#complete`);
    expect(exchanges).toBe(before + 1);
    expect(await sessionCount()).toBe(1);
    const session = (await a.cookies(origin)).find(({ name }) => name === "plenum_session");
    expect(Boolean(session?.secure && session.httpOnly && session.sameSite === "Lax")).toBe(true);
    expect((await a.cookies(origin)).some(({ name }) => name === binding.name)).toBe(false);
    expect((await pageA.goto(callback)).status()).toBe(401);
    expect((await a.cookies(origin)).find(({ name }) => name === "plenum_session")?.value === session.value).toBe(true);

    const first = await start(pageA), tab = await a.newPage(), second = await start(tab);
    expect((await a.cookies(origin)).filter(({ name }) => name.startsWith("__Host-plenum_login_")).length).toBe(2);
    await pageA.goto(first); await tab.goto(second);
    expect(await sessionCount()).toBe(3);
    const mismatch = await start(pageA);
    const mismatchState = new URL(mismatch).searchParams.get("state");
    await b.addCookies([{ ...session, domain: "localhost", path: "/" }]);
    await b.addCookies([{ name: `__Host-plenum_login_${mismatchState}`, value: "x".repeat(43), url: origin,
      secure: true, httpOnly: true, sameSite: "Lax" }]);
    const previousExchanges = exchanges;
    expect((await pageB.goto(mismatch)).status()).toBe(401);
    expect(exchanges).toBe(previousExchanges);
    expect((await b.cookies(origin)).find(({ name }) => name === "plenum_session")?.value === session.value).toBe(true);
    await pageA.goto(mismatch);
    expect(await sessionCount()).toBe(4);
    const expired = await start(pageA);
    await owner.query("UPDATE identity.oidc_login_attempts SET expires_at=transaction_timestamp()-interval '1 second' WHERE state_sha256=$1",
      [createHash("sha256").update(new URL(expired).searchParams.get("state")).digest("hex")]);
    expect((await pageA.goto(expired)).status()).toBe(401);
    expect(await sessionCount()).toBe(4);
    const raced = await start(pageA);
    const race = await Promise.all([a.request.get(raced, { maxRedirects: 0 }), a.request.get(raced, { maxRedirects: 0 })]);
    expect(race.map((reply) => reply.status()).sort()).toEqual([302, 401]);
    expect(await sessionCount()).toBe(5);
    const failure = new URL(await start(pageA)); failure.searchParams.set("code", "synthetic-invalid-code");
    expect((await pageA.goto(failure.toString())).status()).toBe(503);
    expect((await a.cookies(origin)).some(({ name }) => name.startsWith("__Host-plenum_login_"))).toBe(false);
    expect(await sessionCount()).toBe(5);
    for (const destination of ["/\\outside.example/audit", "//outside.example", "/\r\noutside", "/a/..//outside.example"]) {
      scenario++;
      const reply = await a.request.get(`${origin}/auth/login?platformRecovery=1&returnTo=${encodeURIComponent(destination)}`, { maxRedirects: 0 });
      expect(reply.status()).toBe(503);
      expect(reply.headers().location).toBeUndefined();
    }
    const signedOut = await a.request.post(`${origin}/v1/auth/logout`);
    expect(signedOut.status()).toBe(200);
    expect((await a.request.get(`${origin}/v1/me`)).status()).toBe(401);
  } finally {
    for (const context of contexts) await context.close();
    if (service && service.exitCode === null) { const closed = once(service, "exit"); service.kill(); await closed; }
    if (tls) { tls.closeAllConnections(); await new Promise((resolve) => tls.close(resolve)); }
    await owner.end();
    await rm(directory, { recursive: true, force: true });
  }
});
