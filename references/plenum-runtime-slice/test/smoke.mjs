// PostgreSQL-backed end-to-end acceptance smoke. Requires a migrated, seeded database and a
// running server. Set DEMO_* variables from `npm run seed` output.
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const host = process.env.API_URL || 'http://127.0.0.1:3000';
const org = process.env.DEMO_ORG_ID;
const people = {
  designer: process.env.DEMO_DESIGNER,
  publisher: process.env.DEMO_PUBLISHER,
  operator: process.env.DEMO_OPERATOR,
  scribe: process.env.DEMO_SCRIBE,
  facilitator: process.env.DEMO_FACILITATOR,
  white_cell: process.env.DEMO_WHITE_CELL
};
if (!org || Object.values(people).some((v) => !v)) throw new Error('Set DEMO_ORG_ID and DEMO_* variables from npm run seed');

const definition = JSON.parse(await readFile(new URL('../definitions/fractured-order-reference.json', import.meta.url), 'utf8'));
let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log('  ok -', label); };

async function call(who, path, method = 'GET', payload, orgId = org) {
  const response = await fetch(host + path, {
    method,
    headers: {'x-org-id': orgId, 'x-demo-user': people[who] ?? who, 'content-type': 'application/json'},
    body: payload ? JSON.stringify(payload) : undefined
  });
  return {status: response.status, body: await response.json()};
}
async function ok(who, path, method, payload) {
  const r = await call(who, path, method, payload);
  if (r.status >= 300) throw new Error(`${who} ${method} ${path}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

// Studio
const {projectId} = await ok('designer', '/v1/projects', 'POST', {title: 'Smoke: Fractured Order reference', definition});
const validation = await ok('publisher', `/v1/projects/${projectId}/validate`, 'POST', {});
check('draft validates', () => assert.equal(validation.valid, true));
const denied = await call('scribe', `/v1/projects/${projectId}/publish`, 'POST', {});
check('only a publisher may publish', () => assert.equal(denied.status, 403));
const {releaseId} = await ok('publisher', `/v1/projects/${projectId}/publish`, 'POST', {});
const again = await call('publisher', `/v1/projects/${projectId}/publish`, 'POST', {});
check('republishing an unchanged draft is refused', () => { assert.equal(again.status, 409); assert.equal(again.body.error.code, 'ALREADY_PUBLISHED'); });

const crossTenant = await call('publisher', `/v1/projects/${projectId}/draft`, 'GET', undefined, randomUUID());
check('another organization cannot see the project', () => assert.equal(crossTenant.status, 403));

// Session
const {sessionId} = await ok('operator', '/v1/sessions', 'POST', {releaseId});
for (const role of ['scribe', 'facilitator', 'white_cell']) await ok('operator', `/v1/sessions/${sessionId}/participants`, 'POST', {personId: people[role], sessionRoleId: role});
const badRole = await call('operator', `/v1/sessions/${sessionId}/participants`, 'POST', {personId: people.scribe, sessionRoleId: 'observer'});
check('a session role must exist in the release', () => assert.equal(badRole.status, 422));
const device = {};
for (const role of ['scribe', 'facilitator', 'white_cell']) device[role] = (await ok(role, '/v1/devices', 'POST', {})).deviceId;

const send = (who, operationType, aggregateId, expectedAggregateVersion, payload = {}, commandId = randomUUID()) =>
  call(who, `/v1/sessions/${sessionId}/commands`, 'POST', {commandId, deviceId: device[who], operationType, aggregateId, governingReleaseId: releaseId, expectedAggregateVersion, payload});

const artifact = randomUUID();
const early = await send('scribe', 'artifact.create', artifact, 0, {artifactTypeKey: 'request', content: {summary: 'First request'}});
check('commands are rejected before the session starts, with a receipt', () => {
  assert.equal(early.status, 409); assert.equal(early.body.status, 'rejected'); assert.equal(early.body.errorCode, 'SESSION_NOT_ACTIVE'); assert.ok(early.body.evidenceSequence > 0);
});
await ok('operator', `/v1/sessions/${sessionId}/status`, 'POST', {status: 'active'});

const createId = randomUUID();
const created = await send('scribe', 'artifact.create', artifact, 0, {artifactTypeKey: 'request', content: {summary: 'First request'}}, createId);
check('scribe creates artifact', () => { assert.equal(created.status, 200); assert.equal(created.body.aggregateVersion, 1); });
const replay = await call('scribe', `/v1/sessions/${sessionId}/commands`, 'POST', {payload: {content: {summary: 'First request'}, artifactTypeKey: 'request'}, expectedAggregateVersion: 0, governingReleaseId: releaseId, aggregateId: artifact, operationType: 'artifact.create', deviceId: device.scribe, commandId: createId});
check('replay with reordered keys returns the original receipt', () => {
  assert.equal(replay.status, 200); assert.equal(replay.body.replayed, true); assert.equal(replay.body.evidenceSequence, created.body.evidenceSequence); assert.equal(replay.body.aggregateVersion, 1);
});
const collision = await send('scribe', 'artifact.create', artifact, 0, {artifactTypeKey: 'request', content: {summary: 'Different'}}, createId);
check('same command ID with a different payload is refused', () => { assert.equal(collision.status, 409); assert.equal(collision.body.error.code, 'IDEMPOTENCY_COLLISION'); });

const hidden = await send('white_cell', 'artifact.accept', artifact, 1);
check('white cell cannot act on a draft it cannot see', () => { assert.equal(hidden.status, 404); assert.equal(hidden.body.errorCode, 'TARGET_NOT_FOUND'); });

let version = 1;
const step = async (who, op, label, payload) => {
  const r = await send(who, op, artifact, version, payload);
  check(label, () => { assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.status, 'accepted'); });
  version = r.body.aggregateVersion;
};
await step('scribe', 'artifact.submit', 'scribe submits to facilitator');

const stale = await send('scribe', 'artifact.submit', artifact, 1);
check('stale version needs reconciliation', () => { assert.equal(stale.status, 409); assert.equal(stale.body.status, 'needs_reconciliation'); assert.equal(stale.body.errorCode, 'STALE_AGGREGATE_VERSION'); });
const withdraw = await send('scribe', 'artifact.edit', artifact, version, {content: {summary: 'Changed my mind'}});
check('scribe cannot withdraw after submitting', () => { assert.equal(withdraw.body.status, 'rejected'); assert.equal(withdraw.body.errorCode, 'INVALID_TRANSITION'); });

await step('facilitator', 'artifact.return', 'facilitator returns to scribe');
await step('scribe', 'artifact.edit', 'scribe edits returned artifact', {content: {summary: 'Revised request', rationale: 'Feedback addressed'}});
await step('scribe', 'artifact.submit', 'scribe resubmits to facilitator');
await step('facilitator', 'artifact.forward', 'facilitator forwards to white cell');
const facilitatorReturn = await send('facilitator', 'artifact.return', artifact, version);
check('facilitator cannot return once with white cell', () => { assert.equal(facilitatorReturn.status, 403); assert.equal(facilitatorReturn.body.errorCode, 'PERMISSION_DENIED'); });
await step('white_cell', 'artifact.return', 'white cell returns to scribe');
await step('scribe', 'artifact.submit', 'returned artifact goes back through the facilitator');
const skip = await send('white_cell', 'artifact.accept', artifact, version);
check('white cell cannot skip the facilitator', () => assert.equal(skip.body.errorCode, 'INVALID_TRANSITION'));
await step('facilitator', 'artifact.forward', 'facilitator forwards again');
await step('white_cell', 'artifact.accept', 'white cell accepts');

// Required fields
const empty = randomUUID();
await send('scribe', 'artifact.create', empty, 0, {artifactTypeKey: 'request', content: {}});
const invalid = await send('scribe', 'artifact.submit', empty, 1);
check('required fields block submission', () => { assert.equal(invalid.status, 422); assert.equal(invalid.body.errorCode, 'VALIDATION_FAILED'); });

// Projections
const whiteCellView = await ok('white_cell', `/v1/sessions/${sessionId}/artifacts`);
check('white cell sees the accepted artifact but not the unsubmitted one', () => {
  assert.deepEqual(whiteCellView.artifacts.map((x) => [x.id, x.state]), [[artifact, 'accepted']]);
});
const scribeView = await ok('scribe', `/v1/sessions/${sessionId}/artifacts`);
check('scribe sees both of its artifacts', () => assert.equal(scribeView.artifacts.length, 2));

// Receipts and evidence
const receipt = await ok('scribe', `/v1/sessions/${sessionId}/commands/${createId}`);
check('submitter can look up its receipt', () => assert.equal(receipt.status, 'accepted'));
const othersReceipt = await call('facilitator', `/v1/sessions/${sessionId}/commands/${createId}`);
check("others cannot read someone else's receipt", () => assert.equal(othersReceipt.status, 404));

const {events} = await ok('operator', `/v1/sessions/${sessionId}/evidence`);
check('evidence sequence is gap-free and strictly increasing', () => events.forEach((e, i) => assert.equal(e.sequence, i + 1)));
check('rejections and reconciliations are in evidence', () => {
  const types = new Set(events.map((e) => e.type));
  for (const t of ['session.created', 'release.activated', 'session.started', 'artifact.created', 'artifact.returned', 'artifact.accepted', 'command.rejected', 'command.reconciliation_required']) assert.ok(types.has(t), t);
});
check('replays did not add evidence', () => assert.equal(events.filter((e) => e.commandId === createId).length, 1));

console.log(`PASS ${passed} checks — session ${sessionId}`);
