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
import AxeBuilder from "@axe-core/playwright";
import { fixture } from "../fixture.mjs";

test.use({ trace: "off" });
async function freePort() {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test("BA-06-T01/T03 production publication reaches idle authorized clients and clears revoked views", async ({ browser }, testInfo) => {
  const directory = await mkdtemp(join(tmpdir(), "plenum-ba06-"));
  const owner = new Pool({ connectionString: process.env.DATABASE_URL });
  const sessionId = randomUUID(), projectId = randomUUID(), releaseId = randomUUID(), revisionId = randomUUID(), connections = new Set(), contexts = [], logs = [];
  let service, tls, releaseOld;
  try {
    const definition = (await owner.query("SELECT snapshot FROM studio.definition_revisions WHERE id=$1", [fixture.revisionId])).rows[0].snapshot;
    definition.scenario.injects.push({ ...definition.scenario.injects[0], id: "ba06-blue", title: "BA-06 blue-only update", releaseMode: "manual", recipients: { teamIds: ["blue"] } });
    await owner.query("INSERT INTO studio.simulation_projects(id,organization_id,title,created_by) VALUES ($1,$2,'BA-06 synthetic project',$3)", [projectId, fixture.organizationId, fixture.people.operator]);
    await owner.query(`INSERT INTO studio.definition_revisions(id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
      VALUES ($1,$2,$3,$4,repeat('b',64),'1.3.1',$5)`, [revisionId, fixture.organizationId, projectId, definition, fixture.people.operator]);
    await owner.query(`INSERT INTO registry.releases(id,organization_id,project_id,definition_revision_id,release_number,release_label,package_schema_version,compiler_version,package_sha256,blob_key,published_by)
      VALUES ($1,$2,$3,$4,1,'BA-06 synthetic Release','1.0.0','0.1.0',repeat('b',64),'ba06-synthetic',$5)`, [releaseId, fixture.organizationId, projectId, revisionId, fixture.people.operator]);
    await owner.query(`INSERT INTO runtime.sessions(id,organization_id,project_id,initial_release_id,status,created_by,title)
      VALUES ($1,$2,$3,$4,'active',$5,'BA-06 live synchronization')`,
    [sessionId, fixture.organizationId, projectId, releaseId, fixture.people.operator]);
    await owner.query("INSERT INTO runtime.session_authorities(session_id,organization_id,deployment_id,authority_epoch,status) VALUES ($1,$2,$3,1,'active')",
      [sessionId, fixture.organizationId, fixture.deploymentId]);
    await owner.query("INSERT INTO evidence.session_sequences(session_id,organization_id) VALUES ($1,$2)", [sessionId, fixture.organizationId]);
    await owner.query(`INSERT INTO runtime.release_activations(id,organization_id,project_id,session_id,release_id,activation_sequence,compatibility_policy,approved_by)
      VALUES (gen_random_uuid(),$1,$2,$3,$4,1,'{}',$5)`, [fixture.organizationId, projectId, sessionId, releaseId, fixture.people.operator]);
    await owner.query(`INSERT INTO runtime.session_access_configs(organization_id,session_id,governing_release_id,access_policy,assignment_version,configured_by)
      SELECT organization_id,$1,governing_release_id,access_policy,1,configured_by FROM runtime.session_access_configs WHERE session_id=$2`, [sessionId, fixture.sessionId]);
    await owner.query("UPDATE runtime.session_access_configs SET access_policy=jsonb_set(access_policy,'{reassignment,crossTeamAllowed}','true') WHERE session_id=$1", [sessionId]);
    await owner.query(`INSERT INTO runtime.session_seats(organization_id,session_id,seat_id,session_role_ids,team_id,min_occupancy,max_occupancy,required,join_mode,state)
      SELECT organization_id,$1,seat_id,session_role_ids,team_id,min_occupancy,max_occupancy,required,join_mode,'open' FROM runtime.session_seats WHERE session_id=$2`, [sessionId, fixture.sessionId]);
    await owner.query("INSERT INTO runtime.session_operators(organization_id,session_id,person_id,assigned_by) VALUES ($1,$2,$3,$3)",
      [fixture.organizationId, sessionId, fixture.people.operator]);
    const participants = {}, tokens = {};
    for (const key of ["author", "reviewer", "redAuthor"]) {
      const participant = randomUUID(), person = randomUUID(), token = randomUUID(); participants[key] = participant; tokens[key] = token;
      await owner.query("INSERT INTO identity.persons(id,display_name) VALUES ($1,'BA-06 synthetic workforce participant')", [person]);
      await owner.query("INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'designer')", [fixture.organizationId, person]);
      await owner.query(`INSERT INTO identity.authentication_sessions(id,organization_id,person_id,issuer,subject,authentication_strength,expires_at)
        VALUES ($1,$2,$3::uuid,'https://ba06.invalid',$3::text,'mfa',now()+interval '1 day')`, [token, fixture.organizationId, person]);
      await owner.query("INSERT INTO runtime.participants(id,organization_id,session_id,person_id) VALUES ($1,$2,$3,$4)",
        [participant, fixture.organizationId, sessionId, person]);
      await owner.query("INSERT INTO runtime.participant_access_revisions(organization_id,session_id,participant_id) VALUES ($1,$2,$3)", [fixture.organizationId, sessionId, participant]);
      await owner.query(`INSERT INTO runtime.seat_assignments(id,organization_id,session_id,participant_id,session_role_id,seat_id,team_id,assigned_by)
        SELECT gen_random_uuid(),organization_id,$1,$2,session_role_id,seat_id,team_id,assigned_by FROM runtime.seat_assignments WHERE id=$3`,
      [sessionId, participant, fixture.assignments[key]]);
    }
    const openssl = process.env.PLENUM_TEST_OPENSSL ?? (process.platform === "win32" && existsSync("C:/Program Files/Git/usr/bin/openssl.exe")
      ? "C:/Program Files/Git/usr/bin/openssl.exe" : "openssl");
    const cert = join(directory, "cert.pem"), key = join(directory, "key.pem");
    assert.equal(spawnSync(openssl, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-keyout", key,
      "-out", cert, "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"], { windowsHide: true }).status, 0);
    const appPort = await freePort(), metricsPort = await freePort();
    tls = createHttpsServer({ key: await readFile(key), cert: await readFile(cert) }, (request, response) => {
      const upstream = httpRequest({ hostname: "127.0.0.1", port: appPort, method: request.method, path: request.url, headers: request.headers }, reply => {
        response.writeHead(reply.statusCode, reply.headers); reply.pipe(response);
      });
      upstream.on("error", () => { response.writeHead(502); response.end(); }); request.pipe(upstream);
    });
    tls.on("connection", socket => { connections.add(socket); socket.on("close", () => connections.delete(socket)); });
    tls.listen(0, "127.0.0.1"); await once(tls, "listening");
    const origin = `https://127.0.0.1:${tls.address().port}`;
    service = spawn(process.execPath, ["deploy/compose/profile-service.mjs"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "production", NODE_TLS_REJECT_UNAUTHORIZED: "1", PORT: String(appPort), METRICS_PORT: String(metricsPort),
        PLENUM_DEPLOYMENT_PROFILE: "cloud", PLENUM_PUBLIC_BASE_URL: origin, PLENUM_DEPLOYMENT_ID: fixture.deploymentId,
        PLENUM_RETENTION_ACTOR_PERSON_ID: fixture.people.operator, OIDC_ISSUER: origin, OIDC_PROVIDER_KEY: "ba06",
        OIDC_ORGANIZATION_ID: fixture.organizationId, OIDC_CLIENT_ID: "ba06", OIDC_REDIRECT_URI: `${origin}/auth/callback`,
        S3_BUCKET: "ba06-synthetic", MEDIA_URL: "wss://localhost", MEDIA_API_KEY: "synthetic", MEDIA_API_SECRET: "synthetic-media-secret",
        MEDIA_ADAPTER_DIGEST: `sha256:${"e".repeat(64)}`, FLOOR_TOKEN_SECRET: "synthetic-floor-token-secret",
        INVITATION_DELIVERY_ENDPOINT: `${origin}/synthetic-delivery`, INVITATION_DELIVERY_BEARER_TOKEN: "synthetic-delivery",
        INVITATION_DELIVERY_WEBHOOK_TOKEN: "synthetic-webhook", NOTIFICATIONS_HOSTNAME: "" } });
    service.stdout.on("data", chunk => logs.push(chunk.toString())); service.stderr.on("data", chunk => logs.push(chunk.toString()));
    await expect.poll(() => fetch(`http://127.0.0.1:${appPort}/`).then(r => r.status).catch(() => 0), { timeout: 20_000 }).toBe(200);
    const operatorHeaders = { authorization: `Bearer ${fixture.authenticationSessions.operator}`, "content-type": "application/json" };
    let binding;
    await expect.poll(async () => {
      const response = await fetch(`http://127.0.0.1:${appPort}/v1/operations/organization-jobs`, { headers: operatorHeaders });
      expect(response.status).toBe(200); binding = (await response.json()).binding; return Boolean(binding);
    }).toBe(true);
    // Earlier production tests own a different Deployment; transfer this synthetic binding through the Admin API.
    const configured = await fetch(`http://127.0.0.1:${appPort}/v1/operations/organization-jobs`, {
      method: "PUT", headers: operatorHeaders,
      body: JSON.stringify({ actorPersonId: fixture.people.operator, enabled: true, expectedRevision: binding.revision }) });
    expect(configured.status).toBe(200);
    expect((await configured.json()).binding.deploymentId).toBe(fixture.deploymentId);
    const clients = [];
    for (const key of ["author", "reviewer", "redAuthor"]) {
      const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1024, height: 768 }, reducedMotion: "reduce" });
      contexts.push(context);
      await context.addCookies([{ name: "plenum_session", value: tokens[key], domain: "127.0.0.1", path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
      const page = await context.newPage(), responses = [];
      page.on("pageerror", error => logs.push(`browser page error: ${error.message}\n`));
      page.on("requestfailed", request => logs.push(`browser request failed: ${new URL(request.url()).pathname}\n`));
      page.on("response", response => { if (/\/sync\/(stream|deltas)/u.test(response.url())) void response.text().then(body => responses.push(body)).catch(() => {}); });
      await page.goto(`${origin}/sessions/${sessionId}/runtime`);
      await expect(page.locator(".runtime-frame")).toBeVisible();
      await expect.poll(() => responses.length, { timeout: 15_000 }).toBeGreaterThan(0);
      clients.push({ context, page, responses });
    }
    const device = await (await fetch(`http://127.0.0.1:${appPort}/v1/devices`, { method: "POST", headers: operatorHeaders, body: "{}" })).json();
    const command = async (path, operationType, version, payload, aggregateId = sessionId) => {
      const result = await fetch(`http://127.0.0.1:${appPort}/v1/operator/sessions/${sessionId}/${path}`, { method: "POST", headers: operatorHeaders,
        body: JSON.stringify({ commandId: randomUUID(), deviceId: device.deviceId, operationType, aggregateId, expectedAggregateVersion: version,
          governingReleaseId: releaseId, payload: { reason: "Synthetic live synchronization proof", confirmed: true, ...payload } }) });
      const receipt = await result.json(); expect(receipt.status, JSON.stringify(receipt)).toBe("accepted"); return receipt;
    };
    await command("stage", "stage.start", 0, {});
    await expect.poll(async () => Number((await owner.query("SELECT count(*) FROM sync.session_delta_outbox WHERE session_id=$1 AND publication_status='pending'", [sessionId])).rows[0].count), { timeout: 15_000 }).toBe(0);
    for (const { page, responses } of clients) {
      await expect.poll(() => responses.some(body => body.includes("stage.started")), { timeout: 15_000 }).toBe(true);
      await expect(page.locator(".runtime-frame")).toBeVisible();
    }
    await command("stage", "stage.pause", 1, {});
    for (const { page } of clients) await expect(page.getByText("Paused", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    const injectId = randomUUID();
    await command("inject", "inject.release", 0, { injectDefinitionId: "ba06-blue" }, injectId);
    for (const { page, responses } of clients.slice(0, 2)) {
      await expect.poll(() => responses.some(body => body.includes(injectId)), { timeout: 15_000 }).toBe(true);
      await expect(page.getByRole("button", { name: "Injects 2", exact: true })).toBeVisible();
    }
    expect(clients[2].responses.join("")).not.toContain(injectId);
    await expect(clients[2].page.getByRole("button", { name: "Injects 1", exact: true })).toBeVisible();
    const deviceId = await clients[1].page.evaluate(() => localStorage.getItem("plenum.runtime.deviceId"));
    const forbidden = await clients[1].context.request.get(`${origin}/v1/sessions/${fixture.sessionId}/sync/snapshot`, { headers: { "x-device-id": deviceId } });
    expect(forbidden.status()).toBe(403);
    await clients[1].context.setOffline(true);
    await clients[1].page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await command("stage", "stage.resume", 2, {});
    await expect(clients[0].page.getByRole("timer", { name: /Time remaining/u })).toBeVisible();
    const beforeReconnect = clients[1].responses.length;
    await clients[1].context.setOffline(false);
    await clients[1].page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(clients[1].page.getByRole("timer", { name: /Time remaining/u })).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => clients[1].responses.length, { timeout: 15_000 }).toBeGreaterThan(beforeReconnect);
    const recovering = Promise.withResolvers();
    const resume = new Promise(resolve => { releaseOld = resolve; });
    await clients[1].page.route("**/sync/snapshot?*", async route => { recovering.resolve(); await resume; await route.continue(); }, { times: 1 });
    await clients[1].page.route(/\/sync\/(stream|deltas)\?/u, async route => {
      await owner.query("UPDATE sync.projection_cursors SET expires_at=now()-interval '1 second' WHERE session_id=$1", [sessionId]);
      await route.continue();
    }, { times: 1 });
    await expect.poll(() => clients[1].responses.some(body => body.includes("SYNC_CURSOR_EXPIRED")), { timeout: 15_000 }).toBe(true);
    await recovering.promise;
    await expect(clients[1].page.getByRole("heading", { name: "Connecting to Runtime" })).toBeVisible();
    await clients[1].page.screenshot({ path: testInfo.outputPath("ba06-reconnecting.png") });
    releaseOld();
    await expect(clients[1].page.locator(".runtime-frame")).toBeVisible();
    const assignment = (await owner.query("SELECT id FROM runtime.seat_assignments WHERE participant_id=$1 AND valid_to IS NULL", [participants.reviewer])).rows[0].id;
    const destination = (await owner.query("SELECT seat_id,session_role_id FROM runtime.seat_assignments WHERE id=$1", [fixture.assignments.greenAuthor])).rows[0];
    const reassigned = await fetch(`http://127.0.0.1:${appPort}/v1/sessions/${sessionId}/seat-assignments/${assignment}/reassign`, {
      method: "POST", headers: operatorHeaders, body: JSON.stringify({ commandId: randomUUID(), deviceId: device.deviceId,
        operationType: "participant.reassign", aggregateId: participants.reviewer, expectedAggregateVersion: 1, governingReleaseId: releaseId,
        payload: { previousSeatAssignmentId: assignment, newSessionRoleId: destination.session_role_id, newSeatId: destination.seat_id,
          reason: "Synthetic cross-team access change", exposureAcknowledged: true } }) });
    const reassignment = await reassigned.json(); expect(reassignment.status, JSON.stringify(reassignment)).toBe("accepted");
    await expect(clients[1].page.getByRole("button", { name: "Injects 1", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(clients[1].page.getByText("Scribe · Green", { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page: clients[0].page }).analyze()).violations).toEqual([]);
    await clients[0].page.keyboard.press("Tab");
    await expect(clients[0].page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await clients[0].page.screenshot({ path: testInfo.outputPath("ba06-live-1024.png") });
    await clients[0].page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await clients[0].page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    expect(await clients[0].page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await clients[0].page.screenshot({ path: testInfo.outputPath("ba06-zoom-forced-colors.png") });
    await clients[0].page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    // Equivalent CSS viewport for a 1024x768 desktop at 200% zoom.
    await clients[0].page.setViewportSize({ width: 512, height: 384 });
    expect(await clients[0].page.evaluate(() => window.innerWidth)).toBe(512);
    const beforeResponsiveCommit = await clients[0].page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      sidebar: document.querySelector('.runtime-frame')?.getAttribute('data-sidebar'), wide: matchMedia('(min-width: 52.01rem)').matches }));
    // Viewport resize completes before the matchMedia listener's React state update.
    await expect(clients[0].page.locator('.runtime-frame')).toHaveAttribute('data-sidebar', 'closed');
    await testInfo.attach('responsive-resize', { contentType: 'application/json', body: JSON.stringify({ before: beforeResponsiveCommit,
      after: await clients[0].page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        sidebar: document.querySelector('.runtime-frame')?.getAttribute('data-sidebar') })) }) });
    await expect(clients[0].page.getByRole("heading", { name: "Strategic Actions", exact: true, level: 1 })).toBeVisible();
    // The sidebar state and browser reflow settle independently after resizing.
    await expect(async () => {
      const overflow = await clients[0].page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        elements: [...document.querySelectorAll("body *")].filter(element => element.getBoundingClientRect().right > innerWidth)
          .map(element => ({ tag: element.tagName, className: element.className, right: element.getBoundingClientRect().right })) }));
      expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width);
    }).toPass({ timeout: 5_000, intervals: [50, 100, 250] });
    await clients[0].page.screenshot({ path: testInfo.outputPath("ba06-desktop-200-percent.png") });
    await clients[0].page.setViewportSize({ width: 1024, height: 768 });
    // Hold an older manual projection read while the independent subscription observes revocation.
    const held = new Promise(resolve => { releaseOld = resolve; });
    const captured = Promise.withResolvers(), delivered = Promise.withResolvers();
    await clients[0].page.route("**/runtime-projection*", async route => {
      const response = await route.fetch(); captured.resolve(); await held; await route.fulfill({ response }).catch(() => {}); delivered.resolve();
    }, { times: 1 });
    await clients[0].page.getByRole("button", { name: /Refresh/u }).click();
    await captured.promise;
    await owner.query("UPDATE runtime.seat_assignments SET valid_to=now() WHERE session_id=$1 AND participant_id=$2 AND valid_to IS NULL", [sessionId, participants.author]);
    await expect(clients[0].page.locator(".runtime-frame")).toHaveCount(0, { timeout: 15_000 });
    releaseOld();
    await delivered.promise;
    await clients[0].page.bringToFront();
    await clients[0].page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(clients[0].page.locator(".runtime-frame")).toHaveCount(0);
    await expect.poll(() => clients[0].page.evaluate(async session => {
      const database = await new Promise((resolve, reject) => {
        const open = indexedDB.open("plenum-offline-v1"); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error);
      });
      const keys = await new Promise((resolve, reject) => {
        const read = database.transaction("runtime").objectStore("runtime").getAllKeys(); read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error);
      });
      database.close();
      const scope = `${session}:${localStorage.getItem("plenum.runtime.deviceId")}`;
      return keys.every(key => key !== scope && !String(key).startsWith(`draft:${scope}:`));
    }, sessionId), { timeout: 5_000 }).toBe(true);
    await expect(clients[0].page.getByRole("alert")).toContainText(/cleared|access|Seat/u);
    await expect(clients[1].page.locator(".runtime-frame")).toBeVisible();
  } finally {
    releaseOld?.();
    for (const context of contexts) await context.close();
    if (service && service.exitCode === null) { service.kill(); await once(service, "exit"); }
    for (const socket of connections) socket.destroy();
    if (tls) await new Promise(resolve => tls.close(resolve));
    await owner.end(); await rm(directory, { recursive: true, force: true });
    await testInfo.attach("production-log", { body: logs.join(""), contentType: "text/plain" });
  }
});
