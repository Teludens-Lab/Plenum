// Database and authority negative tests (Data Model v1.1 §13: DB-01, DB-02, DB-04, DB-05; Runtime §22).
// Requires: migrated database (DATABASE_URL as the migration owner), a running server (API_URL),
// and DEMO_* variables from `npm run seed`.
import {test, after} from 'node:test';
import {strict as assert} from 'node:assert';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';

const {DATABASE_URL, DEMO_ORG_ID: org, DEMO_DESIGNER, DEMO_PUBLISHER, DEMO_OPERATOR, DEMO_SCRIBE} = process.env;
const host = process.env.API_URL || 'http://127.0.0.1:3000';
if (!DATABASE_URL || !org || !DEMO_SCRIBE) throw new Error('Set DATABASE_URL, API_URL and DEMO_* variables from npm run seed');

pg.types.setTypeParser(20, (v) => Number(v));
const owner = new pg.Pool({connectionString: DATABASE_URL});
after(() => owner.end());

async function asApp(orgId, fn) {
  const c = await owner.connect();
  try {
    await c.query('BEGIN');
    await c.query('SET LOCAL ROLE plenum_app');
    if (orgId) await c.query("SELECT set_config('app.organization_id', $1, true)", [orgId]);
    return await fn(c);
  } finally {
    await c.query('ROLLBACK');
    c.release();
  }
}

async function errorCode(promise) {
  try { await promise; return null; } catch (e) { return e.code; }
}

const people = {designer: DEMO_DESIGNER, publisher: DEMO_PUBLISHER, operator: DEMO_OPERATOR, scribe: DEMO_SCRIBE};
async function call(who, path, method = 'GET', payload) {
  const r = await fetch(host + path, {method, headers: {'x-org-id': org, 'x-demo-user': people[who], 'content-type': 'application/json'}, body: payload ? JSON.stringify(payload) : undefined});
  return {status: r.status, body: await r.json()};
}

// A second organization with one project, created directly as the owner.
const otherOrg = randomUUID();
const otherProject = randomUUID();
await owner.query('INSERT INTO identity.organizations(id, name) VALUES($1, $2)', [otherOrg, 'Other organization']);
await owner.query('INSERT INTO studio.simulation_projects(id, organization_id, title, created_by) VALUES($1, $2, $3, $4)', [otherProject, otherOrg, 'Other project', DEMO_DESIGNER]);

test('DB-01: the application role only sees its own organization', async () => {
  const visible = await asApp(org, (c) => c.query('SELECT organization_id FROM studio.simulation_projects'));
  assert.ok(visible.rows.every((r) => r.organization_id === org));
  const other = await asApp(org, (c) => c.query('SELECT 1 FROM studio.simulation_projects WHERE id=$1', [otherProject]));
  assert.equal(other.rowCount, 0);
});

test('DB-01: without tenant context the application role sees nothing', async () => {
  const rows = await asApp(null, (c) => c.query('SELECT 1 FROM studio.simulation_projects'));
  assert.equal(rows.rowCount, 0);
});

test('DB-01: the application role cannot write into another organization', async () => {
  const code = await errorCode(asApp(org, (c) => c.query(
    'INSERT INTO studio.simulation_projects(id, organization_id, title, created_by) VALUES($1, $2, $3, $4)',
    [randomUUID(), otherOrg, 'Smuggled', DEMO_DESIGNER])));
  assert.equal(code, '42501');
});

test('DB-05: releases, revisions and evidence cannot be updated or deleted, even by the owner', async () => {
  const event = (await owner.query('SELECT id FROM evidence.events LIMIT 1')).rows[0];
  const release = (await owner.query('SELECT id FROM registry.releases LIMIT 1')).rows[0];
  assert.ok(event && release, 'run the smoke test first so evidence and a release exist');
  assert.equal(await errorCode(owner.query("UPDATE evidence.events SET body='{}' WHERE id=$1", [event.id])), '42501');
  assert.equal(await errorCode(owner.query('DELETE FROM evidence.events WHERE id=$1', [event.id])), '42501');
  assert.equal(await errorCode(owner.query("UPDATE registry.releases SET release_label='x' WHERE id=$1", [release.id])), '42501');
  assert.equal(await errorCode(owner.query('TRUNCATE evidence.events CASCADE')), '42501');
  assert.equal(await errorCode(asApp(org, (c) => c.query("UPDATE evidence.events SET body='{}'"))), '42501');
  assert.equal(await errorCode(asApp(org, (c) => c.query('DELETE FROM runtime.artifact_instances'))), '42501');
});

// Shared setup for the HTTP tests below: a fresh active session with one scribe.
const definition = JSON.parse(await readFile(new URL('../definitions/fractured-order-reference.json', import.meta.url), 'utf8'));
const {body: project} = await call('designer', '/v1/projects', 'POST', {title: 'DB test project', definition});
const {body: published} = await call('publisher', `/v1/projects/${project.projectId}/publish`, 'POST', {});
const {body: session} = await call('operator', '/v1/sessions', 'POST', {releaseId: published.releaseId});
await call('operator', `/v1/sessions/${session.sessionId}/participants`, 'POST', {personId: DEMO_SCRIBE, sessionRoleId: 'scribe'});
await call('operator', `/v1/sessions/${session.sessionId}/status`, 'POST', {status: 'active'});
const {body: device} = await call('scribe', '/v1/devices', 'POST', {});
const createCommand = () => ({
  commandId: randomUUID(), deviceId: device.deviceId, operationType: 'artifact.create', aggregateId: randomUUID(),
  governingReleaseId: published.releaseId, expectedAggregateVersion: 0, payload: {artifactTypeKey: 'request', content: {summary: 'x'}}
});

test('DB-02 / DB-04: concurrent retries of one command commit once', async () => {
  const cmd = createCommand();
  const results = await Promise.all(Array.from({length: 6}, () => call('scribe', `/v1/sessions/${session.sessionId}/commands`, 'POST', cmd)));
  assert.ok(results.every((r) => r.status === 200), JSON.stringify(results.map((r) => r.status)));
  assert.equal(new Set(results.map((r) => r.body.evidenceSequence)).size, 1);
  assert.equal(results.filter((r) => r.body.replayed === false).length, 1);
  const events = await owner.query('SELECT count(*)::int AS n FROM evidence.events WHERE command_id=$1', [cmd.commandId]);
  const receipts = await owner.query('SELECT count(*)::int AS n FROM sync.command_receipts WHERE command_id=$1', [cmd.commandId]);
  assert.equal(events.rows[0].n, 1);
  assert.equal(receipts.rows[0].n, 1);
});

test('ADR-001: a deployment that is not the Session Authority cannot commit', async () => {
  const original = (await owner.query('SELECT deployment_id FROM runtime.session_authorities WHERE session_id=$1', [session.sessionId])).rows[0].deployment_id;
  await owner.query('UPDATE runtime.session_authorities SET deployment_id=$1 WHERE session_id=$2', [randomUUID(), session.sessionId]);
  try {
    const cmd = createCommand();
    const r = await call('scribe', `/v1/sessions/${session.sessionId}/commands`, 'POST', cmd);
    assert.equal(r.status, 503);
    assert.equal(r.body.error.code, 'AUTHORITY_UNAVAILABLE');
    const receipts = await owner.query('SELECT count(*)::int AS n FROM sync.command_receipts WHERE command_id=$1', [cmd.commandId]);
    assert.equal(receipts.rows[0].n, 0);
  } finally {
    await owner.query('UPDATE runtime.session_authorities SET deployment_id=$1 WHERE session_id=$2', [original, session.sessionId]);
  }
});

test('ADR-001: a fenced authority cannot commit', async () => {
  await owner.query("UPDATE runtime.session_authorities SET status='fenced' WHERE session_id=$1", [session.sessionId]);
  try {
    const r = await call('scribe', `/v1/sessions/${session.sessionId}/commands`, 'POST', createCommand());
    assert.equal(r.status, 503);
  } finally {
    await owner.query("UPDATE runtime.session_authorities SET status='active' WHERE session_id=$1", [session.sessionId]);
  }
});
