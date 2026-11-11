import assert from "node:assert/strict";
import { UpdateParticipantRequest } from "@livekit/protocol";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer as createHttpsServer } from "node:https";
import { once } from "node:events";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { discoverOrganizationJobs, withOrganizationTransaction, withRestrictedTransaction } from "../dist/index.js";

async function eventually(check, label, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (!await check()) {
    assert.ok(Date.now() < deadline, label);
    await delay(50);
  }
}
async function freePort() {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function verifyTenantJobs(owner, app) {
  const deployment = randomUUID(), digest = `sha256:${"e".repeat(64)}`, children = [], calls = [];
  let pendingDisable;
  const directory = await mkdtemp(join(tmpdir(), "plenum-ba05-tls-"));
  const cert = join(directory, "cert.pem"), key = join(directory, "key.pem");
  const openssl = process.env.PLENUM_TEST_OPENSSL ?? (process.platform === "win32" && existsSync("C:/Program Files/Git/usr/bin/openssl.exe") ? "C:/Program Files/Git/usr/bin/openssl.exe" : "openssl");
  assert.equal(spawnSync(openssl, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-keyout", key, "-out", cert,
    "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1"], { windowsHide: true, encoding: "utf8" }).status, 0);
  const provider = createHttpsServer({ key: await readFile(key), cert: await readFile(cert) }, async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    if (request.url.includes("UpdateParticipant")) {
      calls.push(UpdateParticipantRequest.fromJson(JSON.parse(Buffer.concat(chunks).toString())));
      if (pendingDisable) { pendingDisable.entered.resolve(); await pendingDisable.resume.promise; }
    }
    if (!request.url.includes("/twirp/")) {
      response.writeHead(200, { "content-type": "application/xml" });
      response.end('<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>ba05</Name><IsTruncated>false</IsTruncated><KeyCount>0</KeyCount></ListBucketResult>'); return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(request.url.includes("ListRooms") ? '{"rooms":[]}' : '{}');
  }).listen(0, "127.0.0.1");
  await once(provider, "listening");
  const providerUrl = `https://127.0.0.1:${provider.address().port}`;
  const seed = async (number, full = true) => {
    const f = { org: `50500000-0000-4000-8000-${String(number).padStart(12, "0")}`, person: randomUUID(), token: randomUUID(),
      project: randomUUID(), revision: randomUUID(), release: randomUUID(), session: randomUUID(), participant: randomUUID(), device: randomUUID(), seat: randomUUID(), definition: randomUUID() };
    await owner.query("INSERT INTO identity.organizations(id,name) VALUES ($1,'BA-05 synthetic Organization')", [f.org]);
    await owner.query("INSERT INTO identity.persons(id,display_name) VALUES ($1,'BA-05 dedicated actor')", [f.person]);
    await owner.query("INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'admin')", [f.org, f.person]);
    await owner.query(`INSERT INTO identity.authentication_sessions(id,organization_id,person_id,issuer,subject,authentication_strength,expires_at)
      VALUES ($1,$2,$3::uuid,'https://ba05.invalid',$3::text,'mfa',now()+interval '1 day')`, [f.token, f.org, f.person]);
    if (!full) return f;
    const snapshot = { coreDesign: { teams: [], sessionRoles: [{ id: "role", isControlRole: false }], seats: [{ id: "seat", sessionRoleIds: ["role"] }],
      stages: [], artifactTypes: [], informationPolicies: [{ id: "public", grants: [{ audience: { public: true } }] }], communications: { messageChannels: [], routes: [] } },
      scenario: { content: [{ id: "content", title: "Synthetic", type: "text", body: "Synthetic Inject", informationPolicyId: "public", version: "1" }],
        injects: Array.from({ length: 6 }, (_, i) => ({ id: `inject-${i}`, title: "Synthetic schedule", contentId: "content", recipients: { public: true },
          releaseMode: "scheduled", scheduledOffsetSeconds: 0, completionRequirements: { contractId: "inject-completion-v1", acknowledgementRequired: false } })) } };
    await owner.query("INSERT INTO studio.simulation_projects(id,organization_id,title,created_by) VALUES ($1,$2,'BA-05 synthetic',$3)", [f.project, f.org, f.person]);
    await owner.query(`INSERT INTO studio.definition_revisions(id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
      VALUES ($1,$2,$3,$4,repeat('a',64),'v1',$5)`, [f.revision, f.org, f.project, snapshot, f.person]);
    await owner.query(`INSERT INTO registry.releases(id,organization_id,project_id,definition_revision_id,release_number,release_label,package_schema_version,compiler_version,package_sha256,blob_key,published_by)
      VALUES ($1,$2,$3,$4,1,'BA-05 synthetic','1','1',repeat('a',64),'ba05',$5)`, [f.release, f.org, f.project, f.revision, f.person]);
    await owner.query("INSERT INTO runtime.sessions(id,organization_id,project_id,initial_release_id,status,created_by) VALUES ($1,$2,$3,$4,'active',$5)", [f.session, f.org, f.project, f.release, f.person]);
    await owner.query("INSERT INTO runtime.session_authorities(session_id,organization_id,deployment_id,authority_epoch,status) VALUES ($1,$2,$3,1,'active')", [f.session, f.org, deployment]);
    await owner.query("INSERT INTO evidence.session_sequences(session_id,organization_id) VALUES ($1,$2)", [f.session, f.org]);
    await owner.query("INSERT INTO runtime.participants(id,organization_id,session_id,person_id) VALUES ($1,$2,$3,$4)", [f.participant, f.org, f.session, f.person]);
    await owner.query(`INSERT INTO runtime.seat_assignments(id,organization_id,session_id,participant_id,session_role_id,seat_id,assigned_by)
      VALUES ($1,$2,$3,$4,'role','seat',$5)`, [f.seat, f.org, f.session, f.participant, f.person]);
    await owner.query("INSERT INTO sync.devices(id,organization_id,person_id) VALUES ($1,$2,$3)", [f.device, f.org, f.person]);
    await owner.query(`INSERT INTO reporting.report_definitions(id,organization_id,definition_key,definition_version,report_kind,contract,created_by)
      VALUES ($1,$2,'ba05',1,'after_action','{}',$3)`, [f.definition, f.org, f.person]);
    return f;
  };
  const schedule = async (f, number) => {
    const id = randomUUID(), command = randomUUID();
    await owner.query(`INSERT INTO sync.command_receipts(id,organization_id,session_id,command_id,payload_sha256,device_id,actor_person_id,actor_participant_id,authority_epoch,operation_type,aggregate_id,status)
      VALUES ($1,$2,$3,$1,repeat('a',64),$4,$5,$6,1,'inject.schedule',$7,'accepted')`, [command, f.org, f.session, f.device, f.person, f.participant, id]);
    await owner.query(`INSERT INTO runtime.inject_instances(id,organization_id,session_id,governing_release_id,inject_definition_id,state,title,content_id,scheduled_at,scheduling_command_id,scheduled_by_person_id)
      VALUES ($1,$2,$3,$4,$5,'scheduled','Synthetic','content',now()-interval '1 second',$6,$7)`, [id, f.org, f.session, f.release, `inject-${number}`, command, f.person]);
    return id;
  };
  const artifact = async (f, held = false) => {
    const job = randomUUID(), id = randomUUID();
    await owner.query(`INSERT INTO reporting.export_jobs(id,organization_id,project_id,definition_id,idempotency_key,request_sha256,format,status,requested_by)
      VALUES ($1,$2,$3,$4,$1,repeat('a',64),'json','completed',$5)`, [job, f.org, f.project, f.definition, f.person]);
    await owner.query(`INSERT INTO reporting.export_artifacts(id,organization_id,job_id,filename,content_type,bytes,sha256,manifest,created_at)
      VALUES ($1,$2,$3,'synthetic.json','application/json',$4,repeat('a',64),'{}',now()-interval '91 days')`, [id, f.org, job, Buffer.from('{}')]);
    if (held) await owner.query(`INSERT INTO reporting.legal_hold_events(id,organization_id,hold_id,action,scope_type,scope_reference,reason,recorded_by)
      VALUES ($1,$2,$1,'placed','export',$3,'Synthetic legal hold',$4)`, [randomUUID(), f.org, job, f.person]);
    return id;
  };
  const delivered = async (id) => (await owner.query("SELECT state FROM runtime.inject_instances WHERE id=$1", [id])).rows[0].state !== 'scheduled';
  const purged = async (id) => (await owner.query("SELECT bytes IS NULL AS purged FROM reporting.export_artifacts WHERE id=$1", [id])).rows[0].purged;
  const start = async (bootstrap) => {
    const port = await freePort(), metrics = await freePort(), publicUrl = `https://localhost:${port}`;
    // Test-only IPC drives the production SIGTERM handler; Date advances without sleeping a readiness window.
    const shim = `const original=Date.now;let offset=0;Date.now=()=>original()+offset;process.on('message',m=>{if(m==='stop'){process.emit('SIGTERM');process.send('stopping');process.disconnect()}else if(m==='advance'){offset+=61000;process.send('advanced')}});`;
    const child = spawn(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(shim)}`, "deploy/compose/profile-service.mjs"], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, NODE_ENV: 'production', NODE_EXTRA_CA_CERTS: cert, PORT: String(port), METRICS_PORT: String(metrics),
        PLENUM_DEPLOYMENT_PROFILE: 'cloud', PLENUM_PUBLIC_BASE_URL: publicUrl, PLENUM_DEPLOYMENT_ID: deployment,
        PLENUM_RETENTION_ACTOR_PERSON_ID: bootstrap.person, OIDC_ISSUER: publicUrl, OIDC_PROVIDER_KEY: 'ba05', OIDC_ORGANIZATION_ID: bootstrap.org,
        OIDC_CLIENT_ID: 'ba05', OIDC_REDIRECT_URI: `${publicUrl}/auth/callback`, S3_BUCKET: 'ba05', S3_ENDPOINT: providerUrl,
        S3_ACCESS_KEY_ID: 'synthetic', S3_SECRET_ACCESS_KEY: 'synthetic', MEDIA_URL: 'wss://127.0.0.1', MEDIA_API_URL: providerUrl,
        MEDIA_API_KEY: 'synthetic', MEDIA_API_SECRET: 'synthetic-media-secret', MEDIA_ADAPTER_DIGEST: digest, FLOOR_TOKEN_SECRET: 'synthetic-floor-secret',
        INVITATION_DELIVERY_ENDPOINT: `${publicUrl}/delivery`, INVITATION_DELIVERY_BEARER_TOKEN: 'synthetic-delivery-token', INVITATION_DELIVERY_WEBHOOK_TOKEN: 'synthetic-webhook-token',
        CONTENT_SCANNER_HOST: '', NOTIFICATIONS_HOSTNAME: '' } });
    const logs = []; child.stdout.on('data', b => logs.push(b.toString())); child.stderr.on('data', b => logs.push(b.toString()));
    const service = { child, logs, url: `http://127.0.0.1:${port}` }; children.push(service);
    await eventually(async () => { assert.equal(child.exitCode, null, logs.join('')); return fetch(service.url).then(r => r.ok).catch(() => false); }, 'production startup');
    return service;
  };
  const stop = async ({ child, logs }) => {
    if (child.exitCode !== null) return;
    child.send('stop');
    const result = await Promise.race([once(child, 'exit'), delay(15_000, undefined, { ref: false }).then(() => 'timeout')]);
    assert.notEqual(result, 'timeout', 'production shutdown must drain within 15 seconds');
    assert.equal(result[0], 0, logs.join(''));
  };
  const configure = async (service, f, revision = 0, enabled = true, extra = {}) => {
    const response = await fetch(`${service.url}/v1/operations/organization-jobs`, { method: 'PUT', headers: {
      authorization: `Bearer ${f.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ actorPersonId: f.person, enabled, expectedRevision: revision, ...extra }) });
    return { status: response.status, body: await response.json() };
  };
  try {
    const first = await seed(1), aInject = await schedule(first, 0), aArtifact = await artifact(first);
    const service = await start(first);
    await eventually(async () => await delivered(aInject) && await purged(aArtifact), 'T01/T02 bootstrap scheduled work');
    await eventually(async () => Number((await owner.query("SELECT count(*) FROM sync.session_delta_outbox WHERE organization_id=$1 AND publication_status='pending'", [first.org])).rows[0].count) === 0,
      'BA-06-T02 production startup publishes pending Runtime deltas');
    service.child.send('advance');
    await eventually(async () => (await fetch(`${service.url}/healthz`)).status === 200, 'healthy completed discovery sweep');
    const second = await seed(20), bInject = await schedule(second, 0), bArtifact = await artifact(second), held = await artifact(second, true);
    assert.equal(await delivered(bInject), false, 'unbound post-startup Organization is ineligible');
    assert.equal((await configure(service, second, 0, true, { actorPersonId: first.person })).status, 403, 'bootstrap principal cannot be reused across tenants');
    assert.equal((await configure(service, second, 0, true, { organizationId: first.org })).status, 422, 'caller cannot choose Organization');
    assert.equal((await configure(service, second)).status, 200);
    assert.equal((await configure(service, second)).status, 409, 'stale binding revision denied');
    const duplicate = await start(first);
    await eventually(async () => await delivered(bInject) && await purged(bArtifact), 'T01/T02 post-startup automatic jobs');
    await eventually(async () => Number((await owner.query("SELECT count(*) FROM sync.session_delta_outbox WHERE organization_id=$1 AND publication_status='pending'", [second.org])).rows[0].count) === 0,
      'BA-06-T02 additional Organization publishes automatically');
    assert.equal(await purged(held), false, 'legal hold preserves bytes');
    for (const [f, id, bytes] of [[first, aInject, aArtifact], [second, bInject, bArtifact]]) {
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM evidence.events WHERE aggregate_id=$1 AND event_type='inject.released'", [id])).rows[0].n, 1);
      assert.equal((await owner.query("SELECT purged_by FROM reporting.export_artifacts WHERE id=$1", [bytes])).rows[0].purged_by, f.person);
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM evidence.audit_records WHERE organization_id=$1 AND action='retention.enforcement_completed'", [f.org])).rows[0].n, 1, 'duplicate processes claim retention once');
    }
    // Deployment metadata visibility grants no tenant business-data access or cross-tenant writes.
    await withRestrictedTransaction(app, async client => {
      await client.query("SELECT set_config('app.deployment_id',$1,true)", [deployment]);
      assert.equal((await client.query('SELECT id FROM runtime.sessions')).rowCount, 0);
      assert.equal((await client.query('UPDATE operations.organization_job_bindings SET enabled=false')).rowCount, 0);
    });
    await withOrganizationTransaction(app, first.org, async client => assert.equal((await client.query('SELECT * FROM operations.organization_job_bindings WHERE organization_id=$1', [second.org])).rowCount, 0));
    assert.equal((await discoverOrganizationJobs(app, randomUUID())).length, 0);
    // Revoke before creating new work. Restart must not recreate a disabled legacy binding.
    assert.equal((await configure(service, first, 1, false)).status, 200);
    const denied = await schedule(first, 1);
    await stop(duplicate); await stop(service);
    const backlog = async (f, count) => {
      await owner.query(`WITH sequence AS (
        UPDATE evidence.session_sequences SET next_sequence=next_sequence+$3 WHERE organization_id=$1 AND session_id=$2
        RETURNING next_sequence-$3 AS first
      ), events AS (
        INSERT INTO evidence.events(id,organization_id,session_id,sequence,event_type,event_version,governing_release_id,authority_epoch,body,aggregate_id)
        SELECT gen_random_uuid(),$1,$2,first+n,'command.rejected',1,$4,1,'{}',$2 FROM sequence,generate_series(0,$3-1) n
        RETURNING id,sequence
      ) INSERT INTO sync.session_delta_outbox(id,organization_id,session_id,event_id,created_at)
        SELECT gen_random_uuid(),$1,$2,id,now()-sequence*interval '1 second' FROM events`, [f.org, f.session, count, f.release]);
    };
    await backlog(first, 1); await backlog(second, 205);
    await owner.query("UPDATE runtime.session_authorities SET status='fenced' WHERE session_id=$1", [second.session]);
    const restarted = await start(first);
    assert.equal((await owner.query('SELECT enabled,revision FROM operations.organization_job_bindings WHERE organization_id=$1', [first.org])).rows[0].enabled, false);
    const advanced = once(restarted.child, 'message'); restarted.child.send('advance'); await advanced;
    await eventually(async () => (await fetch(`${restarted.url}/healthz`)).status === 200, 'BA-06 discovery completed with fenced Session');
    assert.equal(Number((await owner.query("SELECT count(*) FROM sync.session_delta_outbox WHERE session_id=$1 AND publication_status='pending'", [second.session])).rows[0].count), 205);
    await owner.query("UPDATE runtime.session_authorities SET status='active',authority_epoch=authority_epoch+1 WHERE session_id=$1", [second.session]);
    await eventually(async () => Number((await owner.query("SELECT count(*) FROM sync.session_delta_outbox WHERE session_id=$1 AND publication_status='pending'", [second.session])).rows[0].count) === 0,
      'BA-06-T02 restart recovers a multi-batch backlog under current authority');
    const batches = await owner.query("SELECT count(*)::int AS size FROM sync.session_delta_outbox WHERE session_id=$1 GROUP BY published_at", [second.session]);
    assert.ok(batches.rows.every(row => row.size <= 100), 'publication transactions retain the 100-row bound');
    const order = await owner.query(`SELECT min(event.sequence)::int AS first,max(event.sequence)::int AS last
      FROM sync.session_delta_outbox item JOIN evidence.events event ON event.id=item.event_id
      WHERE item.session_id=$1 GROUP BY item.published_at ORDER BY item.published_at`, [second.session]);
    assert.ok(order.rows.every((row, index) => index === 0 || row.first > order.rows[index-1].last),
      'publication follows Evidence order even with reversed outbox timestamps');
    assert.equal(Number((await owner.query("SELECT count(*) FROM sync.session_delta_outbox WHERE session_id=$1 AND attempts<>1", [second.session])).rows[0].count), 0,
      'duplicate processes and restart do not republish committed rows');
    assert.equal(Number((await owner.query("SELECT count(*) FROM sync.session_delta_outbox WHERE session_id=$1 AND publication_status='pending'", [first.session])).rows[0].count), 1,
      'disabled tenant authority cannot publish');
    const live = await schedule(second, 1);
    await eventually(() => delivered(live), 'T03 restart continues another tenant');
    assert.equal(await delivered(denied), false);
    // Actor revocation is visible and cannot starve a healthy tenant, even across a discovery page.
    for (let i = 2; i <= 12; i++) { const f = await seed(i, false); assert.equal((await configure(restarted, f)).status, 200); }
    const page = await discoverOrganizationJobs(app, deployment);
    assert.equal(page.length, 10);
    assert.ok((await discoverOrganizationJobs(app, deployment, page.at(-1).organizationId)).some(a => a.organizationId === second.org));
    await owner.query("UPDATE identity.organization_workforce_members SET status='suspended',suspended_at=now() WHERE organization_id=$1 AND person_id=$2", [second.org, second.person]);
    const revoked = await schedule(second, 2), protectedBytes = await artifact(second);
    await owner.query("UPDATE operations.organization_job_bindings SET retention_due_at=now()-interval '1 second' WHERE organization_id=$1", [second.org]);
    const third = await seed(30), thirdInject = await schedule(third, 0), thirdBytes = await artifact(third);
    assert.equal((await configure(restarted, third)).status, 200);
    await eventually(async () => await delivered(thirdInject) && await purged(thirdBytes), 'T03 one-tenant failure cannot starve later pages');
    await eventually(() => restarted.logs.some(line => line.includes('organization_jobs_authority')), 'authority failure observable');
    restarted.child.send('advance');
    await eventually(async () => (await fetch(`${restarted.url}/healthz`)).status === 503, 'essential job failure degrades readiness');
    assert.equal(await delivered(revoked), false); assert.equal(await purged(protectedBytes), false);
    assert.equal((await configure(restarted, second, 1, false)).status, 401, 'revoked caller cannot reauthorize jobs');
    await owner.query("UPDATE identity.organization_workforce_members SET status='active',suspended_at=NULL WHERE organization_id=$1 AND person_id=$2", [second.org, second.person]);
    await eventually(async () => await delivered(revoked) && await purged(protectedBytes), 'revoked actor recovery');
    await eventually(async () => (await fetch(`${restarted.url}/healthz`)).status === 200, 'readiness recovers after a complete healthy sweep');
    // Session authority movement is not overridden by a valid Organization job binding.
    await owner.query('UPDATE runtime.session_authorities SET deployment_id=$1,authority_epoch=authority_epoch+1 WHERE session_id=$2', [randomUUID(), second.session]);
    const stale = await schedule(second, 3), healthy = await schedule(third, 1);
    await eventually(() => delivered(healthy), 'healthy tenant after authority move');
    assert.equal(await delivered(stale), false);
    await owner.query("UPDATE identity.organizations SET lifecycle_status='suspended' WHERE id=$1", [third.org]);
    const suspended = await schedule(third, 2);
    const channel = randomUUID(), lease = randomUUID();
    await owner.query(`INSERT INTO comms.voice_channels(id,organization_id,session_id,governing_release_id,definition_id,definition_revision,definition,status,provider_binding_id,provider_adapter_digest,authority_epoch,opened_by)
      VALUES ($1,$2,$3,$4,'radio',1,'{}','open','synthetic',$5,1,$6)`, [channel, third.org, third.session, third.release, digest, third.person]);
    await owner.query(`INSERT INTO comms.floor_leases(id,organization_id,session_id,channel_id,request_id,holder_seat_assignment_id,token_digest,authority_epoch,expires_at,max_expires_at,provider_state)
      VALUES ($1,$2,$3,$4,$1,$5,repeat('a',64),1,now()-interval '1 second',now()+interval '1 minute','enabled')`, [lease, third.org, third.session, channel, third.seat]);
    await stop(restarted);
    assert.equal(await delivered(suspended), false);
    await owner.query("UPDATE identity.organizations SET lifecycle_status='active' WHERE id=$1", [third.org]);
    const brokenBootstrap = await seed(40, false);
    await owner.query("DELETE FROM identity.memberships WHERE organization_id=$1 AND person_id=$2", [brokenBootstrap.org, brokenBootstrap.person]);
    pendingDisable = { entered: Promise.withResolvers(), resume: Promise.withResolvers() };
    const last = await start(brokenBootstrap);
    await eventually(() => calls.length === 1, 'BA-04 worker runs for additional Organization despite invalid bootstrap actor');
    assert.ok(calls.some(call => call.permission?.canPublish === false));
    await eventually(() => delivered(suspended), 'Organization resumes after reactivation');
    const stopping = stop(last);
    await once(last.child, 'message');
    assert.equal(last.child.exitCode, null, 'shutdown waits for admitted provider disable');
    assert.equal((await owner.query('SELECT provider_state FROM comms.floor_leases WHERE id=$1', [lease])).rows[0].provider_state, 'pending_disable');
    pendingDisable.resume.resolve();
    await stopping;
    assert.equal((await owner.query('SELECT provider_state FROM comms.floor_leases WHERE id=$1', [lease])).rows[0].provider_state, 'disabled');
    assert.equal(calls.length, 1, 'overlapping ticks do not duplicate the in-flight provider effect');
    const afterStop = await schedule(third, 3);
    assert.equal(await delivered(afterStop), false);
  } finally {
    pendingDisable?.resume.resolve();
    for (const service of children) if (service.child.exitCode === null) { service.child.kill(); await once(service.child, 'exit'); }
    provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve));
    assert.ok(directory.startsWith(join(tmpdir(), "plenum-ba05-tls-")));
    await rm(directory, { recursive: true, force: true });
  }
}
