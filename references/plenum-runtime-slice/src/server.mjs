// Plenum reference slice — Studio → Release → Session → data-driven artifact workflow.
// Local demo only: identity comes from headers, so the server refuses to start unless
// PLENUM_LOCAL_DEMO=1 and binds to loopback.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {pool, tx} from './db.mjs';
import {
  id, sha, UUID, isPlainObject, validateDefinition, validateCommand,
  findArtifactType, workflowFor, formFor, stateOf, sessionRoleIds, resolveTransition,
  visibilityAfter, notificationsFor, missingRequiredFields, eventTypeFor, sessionTransition, httpStatusFor
} from './domain.mjs';

const port = Number(process.env.PORT || 3000);
const deploymentId = process.env.PLENUM_DEPLOYMENT_ID || '';
if (process.env.PLENUM_LOCAL_DEMO !== '1') throw new Error('Refuse insecure demo identity: set PLENUM_LOCAL_DEMO=1 for loopback-only development');
if (!UUID.test(deploymentId)) throw new Error('Set PLENUM_DEPLOYMENT_ID to a UUID; this deployment becomes the Session Authority for sessions it creates');

const COMPILER_VERSION = 'reference-0.2';
const PACKAGE_SCHEMA_VERSION = 'slice-1';
const METHODOLOGY_VERSION = '1.0';

// Domain error codes thrown without an HTTP status (09 §8.1).
const DOMAIN_HTTP = {INVALID_COMMAND: 422, VALIDATION_FAILED: 422, INVALID_TRANSITION: 409, PERMISSION_DENIED: 403};

function fail(status, code, message, details) {
  return Object.assign(new Error(message), {status, code, details: details ?? null});
}

function auth(req) {
  const org = req.headers['x-org-id'];
  const person = req.headers['x-demo-user'];
  if (!org || !person) throw fail(401, 'UNAUTHENTICATED', 'Demo identity headers x-org-id and x-demo-user are required');
  if (!UUID.test(org) || !UUID.test(person)) throw fail(400, 'INVALID_ID', 'Identity headers must be UUIDs');
  return {org: org.toLowerCase(), person: person.toLowerCase()};
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1e6) throw fail(413, 'TOO_LARGE', 'Payload exceeds 1 MB');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  let value;
  try { value = JSON.parse(text); } catch { throw fail(400, 'INVALID_JSON', 'Malformed JSON'); }
  if (!isPlainObject(value)) throw fail(400, 'INVALID_JSON', 'The request body must be a JSON object');
  return value;
}

const query = async (c, s, p = []) => (await c.query(s, p)).rows;

function uuidParam(value) {
  if (!UUID.test(value)) throw fail(400, 'INVALID_ID', 'Path identifiers must be UUIDs');
  return value.toLowerCase();
}

async function member(c, a, roles) {
  const rows = await query(c, 'SELECT organization_role FROM identity.memberships WHERE organization_id=$1 AND person_id=$2', [a.org, a.person]);
  if (!rows.some((r) => roles.includes(r.organization_role))) throw fail(403, 'PERMISSION_DENIED', `Requires organization role: ${roles.join(' or ')}`);
}

async function personExists(c, personId) {
  return (await query(c, 'SELECT 1 FROM identity.persons WHERE id=$1', [personId])).length === 1;
}

// Releases are immutable, so their definitions can be cached per organization.
const definitionCache = new Map();
async function releaseDefinition(c, org, releaseId) {
  const key = `${org}:${releaseId}`;
  if (definitionCache.has(key)) return definitionCache.get(key);
  const row = (await query(c,
    `SELECT dr.snapshot FROM registry.releases r
       JOIN studio.definition_revisions dr ON dr.organization_id = r.organization_id AND dr.id = r.definition_revision_id
      WHERE r.organization_id=$1 AND r.id=$2`, [org, releaseId]))[0];
  if (!row) throw fail(404, 'NOT_FOUND', 'Release not found');
  definitionCache.set(key, row.snapshot);
  return row.snapshot;
}

// ---------- Studio ----------

function requireDefinitionObject(definition) {
  if (!isPlainObject(definition)) throw fail(422, 'VALIDATION_FAILED', 'The definition must be a JSON object');
}

async function createProject(c, a, b) {
  await member(c, a, ['designer']);
  if (typeof b.title !== 'string' || !b.title.trim()) throw fail(422, 'VALIDATION_FAILED', 'A title is required');
  requireDefinitionObject(b.definition);
  const projectId = id();
  const draftId = id();
  await c.query('INSERT INTO studio.simulation_projects(id, organization_id, title, created_by) VALUES($1,$2,$3,$4)', [projectId, a.org, b.title.trim(), a.person]);
  await c.query('INSERT INTO studio.drafts(id, organization_id, project_id, document, updated_by) VALUES($1,$2,$3,$4,$5)', [draftId, a.org, projectId, b.definition, a.person]);
  return {projectId, draftId, version: 1};
}

async function readDraft(c, a, projectId, lock = false) {
  const rows = await query(c, `SELECT id, document, version FROM studio.drafts WHERE organization_id=$1 AND project_id=$2${lock ? ' FOR UPDATE' : ''}`, [a.org, projectId]);
  if (!rows.length) throw fail(404, 'NOT_FOUND', 'Project not found');
  return rows[0];
}

async function getDraft(c, a, projectId) {
  await member(c, a, ['designer', 'publisher']);
  const draft = await readDraft(c, a, projectId);
  return {projectId, definition: draft.document, version: draft.version};
}

async function updateDraft(c, a, projectId, b) {
  await member(c, a, ['designer']);
  requireDefinitionObject(b.definition);
  if (!Number.isInteger(b.expectedVersion)) throw fail(422, 'VALIDATION_FAILED', 'expectedVersion must be an integer');
  const rows = await query(c,
    'UPDATE studio.drafts SET document=$1, version=version+1, updated_by=$2, updated_at=now() WHERE organization_id=$3 AND project_id=$4 AND version=$5 RETURNING version',
    [b.definition, a.person, a.org, projectId, b.expectedVersion]);
  if (rows.length) return {projectId, version: rows[0].version};
  await readDraft(c, a, projectId); // 404 if the project is missing
  throw fail(409, 'VERSION_CONFLICT', 'The draft changed since you loaded it');
}

async function validateDraft(c, a, projectId) {
  await member(c, a, ['designer', 'publisher']);
  const draft = await readDraft(c, a, projectId);
  return validateDefinition(draft.document);
}

async function publish(c, a, projectId) {
  await member(c, a, ['publisher']);
  const draft = await readDraft(c, a, projectId, true);
  const result = validateDefinition(draft.document);
  if (!result.valid) throw fail(422, 'VALIDATION_FAILED', 'The draft has validation errors', result.errors);
  const hash = sha(draft.document);
  const latest = (await query(c,
    'SELECT id, snapshot_sha256 FROM studio.definition_revisions WHERE organization_id=$1 AND project_id=$2 ORDER BY created_at DESC, id LIMIT 1',
    [a.org, projectId]))[0];
  if (latest && latest.snapshot_sha256 === hash) {
    const existing = (await query(c, 'SELECT id FROM registry.releases WHERE organization_id=$1 AND definition_revision_id=$2', [a.org, latest.id]))[0];
    throw fail(409, 'ALREADY_PUBLISHED', 'The draft is identical to the last published revision', {releaseId: existing?.id ?? null});
  }
  const releaseNumber = (await query(c, 'SELECT count(*)::int AS n FROM registry.releases WHERE organization_id=$1 AND project_id=$2', [a.org, projectId]))[0].n + 1;
  const revisionId = id();
  const releaseId = id();
  const releaseLabel = `r${releaseNumber}`;
  const packageSha256 = sha({packageSchemaVersion: PACKAGE_SCHEMA_VERSION, compilerVersion: COMPILER_VERSION, definitionSha256: hash, definition: draft.document});
  await c.query(
    'INSERT INTO studio.definition_revisions(id, organization_id, project_id, parent_revision_id, snapshot, snapshot_sha256, methodology_version, author_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [revisionId, a.org, projectId, latest?.id ?? null, draft.document, hash, METHODOLOGY_VERSION, a.person]);
  await c.query(
    'INSERT INTO registry.releases(id, organization_id, project_id, definition_revision_id, release_number, release_label, package_schema_version, compiler_version, package_sha256, blob_key, published_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [releaseId, a.org, projectId, revisionId, releaseNumber, releaseLabel, PACKAGE_SCHEMA_VERSION, COMPILER_VERSION, packageSha256, `embedded://${revisionId}`, a.person]);
  return {projectId, revisionId, releaseId, releaseLabel, definitionSha256: hash, packageSha256};
}

// ---------- Evidence ----------

async function emit(c, a, sessionId, {eventType, releaseId, epoch, commandId = null, participantId = null, body: eventBody}) {
  const row = (await query(c,
    'UPDATE evidence.session_sequences SET next_sequence = next_sequence + 1 WHERE organization_id=$1 AND session_id=$2 RETURNING next_sequence - 1 AS sequence',
    [a.org, sessionId]))[0];
  if (!row) throw fail(500, 'INTERNAL', 'Evidence sequence missing for session');
  const eventId = id();
  await c.query(
    'INSERT INTO evidence.events(id, organization_id, session_id, sequence, event_type, command_id, actor_person_id, actor_participant_id, governing_release_id, authority_epoch, body) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [eventId, a.org, sessionId, row.sequence, eventType, commandId, a.person, participantId, releaseId, epoch, eventBody]);
  await c.query('INSERT INTO sync.session_delta_outbox(id, organization_id, session_id, event_id) VALUES($1,$2,$3,$4)', [id(), a.org, sessionId, eventId]);
  return row.sequence;
}

// ---------- Sessions ----------

async function lockAuthority(c, a, sessionId) {
  const row = (await query(c, 'SELECT * FROM runtime.session_authorities WHERE organization_id=$1 AND session_id=$2 FOR UPDATE', [a.org, sessionId]))[0];
  if (!row) throw fail(404, 'NOT_FOUND', 'Session not found');
  return row;
}

function requireAuthority(authority) {
  if (authority.status !== 'active' || authority.deployment_id !== deploymentId) {
    throw fail(503, 'AUTHORITY_UNAVAILABLE', 'This deployment is not the active Session Authority for this session');
  }
}

async function activeRelease(c, a, sessionId) {
  const row = (await query(c, 'SELECT release_id FROM runtime.release_activations WHERE organization_id=$1 AND session_id=$2 ORDER BY activation_sequence DESC LIMIT 1', [a.org, sessionId]))[0];
  if (!row) throw fail(409, 'CONFLICT', 'Session has no active release');
  return row.release_id;
}

async function createSession(c, a, b) {
  await member(c, a, ['operator']);
  if (typeof b.releaseId !== 'string' || !UUID.test(b.releaseId)) throw fail(422, 'VALIDATION_FAILED', 'releaseId must be a UUID');
  const release = (await query(c, 'SELECT id, project_id FROM registry.releases WHERE organization_id=$1 AND id=$2', [a.org, b.releaseId.toLowerCase()]))[0];
  if (!release) throw fail(404, 'NOT_FOUND', 'Release not found');
  const sessionId = id();
  const policy = {existingWorkflows: 'pinned'};
  await c.query("INSERT INTO runtime.sessions(id, organization_id, project_id, initial_release_id, status, created_by) VALUES($1,$2,$3,$4,'created',$5)", [sessionId, a.org, release.project_id, release.id, a.person]);
  await c.query("INSERT INTO runtime.session_authorities(session_id, organization_id, deployment_id, authority_epoch, status) VALUES($1,$2,$3,1,'active')", [sessionId, a.org, deploymentId]);
  await c.query('INSERT INTO evidence.session_sequences(session_id, organization_id) VALUES($1,$2)', [sessionId, a.org]);
  await c.query(
    'INSERT INTO runtime.release_activations(id, organization_id, project_id, session_id, release_id, activation_sequence, compatibility_policy, approved_by) VALUES($1,$2,$3,$4,$5,1,$6,$7)',
    [id(), a.org, release.project_id, sessionId, release.id, policy, a.person]);
  await emit(c, a, sessionId, {eventType: 'session.created', releaseId: release.id, epoch: 1, body: {projectId: release.project_id, deploymentId}});
  await emit(c, a, sessionId, {eventType: 'release.activated', releaseId: release.id, epoch: 1, body: {activationSequence: 1, compatibilityPolicy: policy}});
  return {sessionId, status: 'created', releaseId: release.id, authorityEpoch: 1, deploymentId};
}

async function setSessionStatus(c, a, sessionId, b) {
  await member(c, a, ['operator']);
  const authority = await lockAuthority(c, a, sessionId);
  requireAuthority(authority);
  if (typeof b.status !== 'string') throw fail(422, 'VALIDATION_FAILED', 'status is required');
  const session = (await query(c, 'SELECT status FROM runtime.sessions WHERE organization_id=$1 AND id=$2 FOR UPDATE', [a.org, sessionId]))[0];
  const eventType = sessionTransition(session.status, b.status);
  await c.query('UPDATE runtime.sessions SET status=$1, version=version+1 WHERE organization_id=$2 AND id=$3', [b.status, a.org, sessionId]);
  const releaseId = await activeRelease(c, a, sessionId);
  const sequence = await emit(c, a, sessionId, {eventType, releaseId, epoch: authority.authority_epoch, body: {from: session.status, to: b.status, reason: typeof b.reason === 'string' ? b.reason : null}});
  return {sessionId, status: b.status, evidenceSequence: sequence};
}

async function assignParticipant(c, a, sessionId, b) {
  await member(c, a, ['operator']);
  const authority = await lockAuthority(c, a, sessionId);
  requireAuthority(authority);
  if (typeof b.personId !== 'string' || !UUID.test(b.personId)) throw fail(422, 'VALIDATION_FAILED', 'personId must be a UUID');
  if (typeof b.sessionRoleId !== 'string' || !b.sessionRoleId) throw fail(422, 'VALIDATION_FAILED', 'sessionRoleId is required');
  const personId = b.personId.toLowerCase();
  const session = (await query(c, 'SELECT status FROM runtime.sessions WHERE organization_id=$1 AND id=$2', [a.org, sessionId]))[0];
  if (['completed', 'locked', 'archived'].includes(session.status)) throw fail(409, 'SESSION_NOT_ACTIVE', 'The session no longer accepts assignments');
  if (!(await personExists(c, personId))) throw fail(404, 'NOT_FOUND', 'Person not found');
  const releaseId = await activeRelease(c, a, sessionId);
  const definition = await releaseDefinition(c, a.org, releaseId);
  if (!sessionRoleIds(definition).includes(b.sessionRoleId)) throw fail(422, 'VALIDATION_FAILED', `Session role "${b.sessionRoleId}" is not defined in the active release`);
  let participant = (await query(c, 'SELECT id FROM runtime.participants WHERE organization_id=$1 AND session_id=$2 AND person_id=$3', [a.org, sessionId, personId]))[0];
  if (!participant) {
    participant = {id: id()};
    await c.query('INSERT INTO runtime.participants(id, organization_id, session_id, person_id) VALUES($1,$2,$3,$4)', [participant.id, a.org, sessionId, personId]);
  }
  const existing = await query(c, 'SELECT 1 FROM runtime.seat_assignments WHERE participant_id=$1 AND session_role_id=$2 AND valid_to IS NULL', [participant.id, b.sessionRoleId]);
  if (existing.length) throw fail(409, 'CONFLICT', 'The participant already holds this session role');
  const seatAssignmentId = id();
  await c.query('INSERT INTO runtime.seat_assignments(id, organization_id, session_id, participant_id, session_role_id, assigned_by) VALUES($1,$2,$3,$4,$5,$6)',
    [seatAssignmentId, a.org, sessionId, participant.id, b.sessionRoleId, a.person]);
  await emit(c, a, sessionId, {eventType: 'seat_assignment.created', releaseId, epoch: authority.authority_epoch, body: {participantId: participant.id, personId, sessionRoleId: b.sessionRoleId, seatAssignmentId}});
  return {participantId: participant.id, seatAssignmentId};
}

async function registerDevice(c, a) {
  if (!(await personExists(c, a.person))) throw fail(404, 'NOT_FOUND', 'Person not found');
  const deviceId = id();
  await c.query('INSERT INTO sync.devices(id, organization_id, person_id) VALUES($1,$2,$3)', [deviceId, a.org, a.person]);
  return {deviceId};
}

// ---------- Commands ----------

function receiptResponse(r, replayed, message = null) {
  return {
    status: httpStatusFor(r.status, r.rejection_code),
    body: {
      commandId: r.command_id,
      status: r.status,
      aggregateVersion: r.result_version ?? null,
      evidenceSequence: r.evidence_sequence ?? null,
      errorCode: r.rejection_code ?? null,
      message,
      replayed
    }
  };
}

// Records the outcome: receipt + Evidence Event + outbox, in the caller's transaction (DEC-43).
async function record(c, ctx, {status, code = null, version = null, releaseId, eventType, eventBody, message = null}) {
  const {a, sessionId, cmd, digest, authority, participant, activeRole} = ctx;
  const type = status === 'accepted' ? eventType : status === 'rejected' ? 'command.rejected' : 'command.reconciliation_required';
  const evBody = status === 'accepted' ? eventBody : {operationType: cmd.operationType, aggregateId: cmd.aggregateId, code, activeSessionRoleId: activeRole};
  const sequence = await emit(c, a, sessionId, {eventType: type, releaseId, epoch: authority.authority_epoch, commandId: cmd.commandId, participantId: participant.id, body: evBody});
  await c.query(
    `INSERT INTO sync.command_receipts(id, organization_id, session_id, command_id, payload_sha256, device_id, actor_person_id, actor_participant_id,
       active_session_role_id, authority_epoch, operation_type, aggregate_id, status, result_version, evidence_sequence, rejection_code, resolved_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now())`,
    [id(), a.org, sessionId, cmd.commandId, digest, cmd.deviceId, a.person, participant.id, activeRole, authority.authority_epoch,
      cmd.operationType, cmd.aggregateId, status, version, sequence, code]);
  return receiptResponse({command_id: cmd.commandId, status, result_version: version, evidence_sequence: sequence, rejection_code: code}, false, message);
}

const reject = (c, ctx, code, releaseId, message) => record(c, ctx, {status: 'rejected', code, releaseId, message});
const reconcile = (c, ctx, code, releaseId, message) => record(c, ctx, {status: 'needs_reconciliation', code, releaseId, message});

async function command(c, a, sessionId, raw) {
  const cmd = validateCommand(raw);
  cmd.commandId = cmd.commandId.toLowerCase();
  cmd.deviceId = cmd.deviceId.toLowerCase();
  cmd.aggregateId = cmd.aggregateId.toLowerCase();
  cmd.governingReleaseId = cmd.governingReleaseId.toLowerCase();
  const digest = sha(cmd);

  // Serializes all commands for this session, so concurrent retries of one command cannot both run.
  const authority = await lockAuthority(c, a, sessionId);
  const prev = (await query(c, 'SELECT * FROM sync.command_receipts WHERE organization_id=$1 AND session_id=$2 AND command_id=$3', [a.org, sessionId, cmd.commandId]))[0];
  if (prev) {
    if (prev.actor_person_id !== a.person || prev.payload_sha256 !== digest) throw fail(409, 'IDEMPOTENCY_COLLISION', 'This command ID was already used with a different payload');
    return receiptResponse(prev, true);
  }
  requireAuthority(authority);

  const participant = (await query(c, 'SELECT id FROM runtime.participants WHERE organization_id=$1 AND session_id=$2 AND person_id=$3', [a.org, sessionId, a.person]))[0];
  if (!participant) throw fail(403, 'NOT_A_PARTICIPANT', 'You are not a participant in this session');
  const device = (await query(c, 'SELECT id FROM sync.devices WHERE organization_id=$1 AND id=$2 AND person_id=$3 AND revoked_at IS NULL', [a.org, cmd.deviceId, a.person]))[0];
  if (!device) throw fail(403, 'DEVICE_NOT_REGISTERED', 'Unregistered or revoked device');
  const roles = (await query(c, 'SELECT session_role_id FROM runtime.seat_assignments WHERE organization_id=$1 AND participant_id=$2 AND valid_to IS NULL ORDER BY session_role_id', [a.org, participant.id])).map((r) => r.session_role_id);

  let activeRole = cmd.activeSessionRoleId;
  if (!activeRole) {
    if (roles.length !== 1) throw fail(422, 'INVALID_COMMAND', roles.length ? 'activeSessionRoleId is required because you hold more than one session role' : 'You hold no active session role');
    activeRole = roles[0];
  }
  const session = (await query(c, 'SELECT status FROM runtime.sessions WHERE organization_id=$1 AND id=$2', [a.org, sessionId]))[0];
  const activeReleaseId = await activeRelease(c, a, sessionId);
  const ctx = {a, sessionId, cmd, digest, authority, participant, activeRole};

  if (!roles.includes(activeRole)) return reject(c, ctx, 'PERMISSION_DENIED', activeReleaseId, `You do not hold the session role "${activeRole}"`);
  if (session.status !== 'active') return reject(c, ctx, 'SESSION_NOT_ACTIVE', activeReleaseId, `The session is ${session.status}`);
  return cmd.operationType === 'artifact.create' ? createArtifact(c, ctx, activeReleaseId) : advanceArtifact(c, ctx, activeReleaseId);
}

async function createArtifact(c, ctx, activeReleaseId) {
  const {a, sessionId, cmd, participant, activeRole} = ctx;
  if (cmd.governingReleaseId !== activeReleaseId) return reconcile(c, ctx, 'INCOMPATIBLE_RELEASE', activeReleaseId, 'New artifacts use the currently activated release');
  if (cmd.expectedAggregateVersion !== 0) return reconcile(c, ctx, 'STALE_AGGREGATE_VERSION', activeReleaseId, 'A new artifact must be created with expectedAggregateVersion 0');
  if ((await query(c, 'SELECT 1 FROM runtime.artifact_instances WHERE organization_id=$1 AND id=$2', [a.org, cmd.aggregateId])).length) {
    return reject(c, ctx, 'TARGET_EXISTS', activeReleaseId, 'An artifact with this ID already exists');
  }
  const definition = await releaseDefinition(c, a.org, activeReleaseId);
  const type = findArtifactType(definition, cmd.payload?.artifactTypeKey);
  if (!type) return reject(c, ctx, 'VALIDATION_FAILED', activeReleaseId, 'payload.artifactTypeKey must name an artifact type in the release');
  const workflow = workflowFor(definition, type);
  const form = formFor(definition, type);
  let transition;
  try {
    transition = resolveTransition(workflow, null, 'artifact.create', activeRole);
  } catch (e) {
    if (e.code) return reject(c, ctx, e.code, activeReleaseId, e.message);
    throw e;
  }
  const content = isPlainObject(cmd.payload?.content) ? cmd.payload.content : {};
  const visible = visibilityAfter([], workflow, transition);
  await c.query(
    `INSERT INTO runtime.artifact_instances(id, organization_id, session_id, governing_release_id, artifact_type_key, workflow_key, form_version,
       creator_participant_id, state, payload, visible_role_ids, version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1)`,
    [cmd.aggregateId, a.org, sessionId, activeReleaseId, type.key, workflow.key || workflow.id, form.formVersion, participant.id, transition.to, content, visible]);
  return record(c, ctx, {
    status: 'accepted', version: 1, releaseId: activeReleaseId, eventType: eventTypeFor('artifact.create'),
    eventBody: {artifactId: cmd.aggregateId, artifactTypeKey: type.key, fromState: null, toState: transition.to, activeSessionRoleId: activeRole, version: 1, notify: notificationsFor(transition)}
  });
}

async function advanceArtifact(c, ctx, activeReleaseId) {
  const {a, sessionId, cmd, participant, activeRole} = ctx;
  const item = (await query(c, 'SELECT * FROM runtime.artifact_instances WHERE organization_id=$1 AND session_id=$2 AND id=$3 FOR UPDATE', [a.org, sessionId, cmd.aggregateId]))[0];
  const visibleToActor = item && (item.creator_participant_id === participant.id || item.visible_role_ids.includes(activeRole));
  if (!visibleToActor) return reject(c, ctx, 'TARGET_NOT_FOUND', activeReleaseId, 'Artifact not found');
  const releaseId = item.governing_release_id;
  if (cmd.governingReleaseId !== releaseId) return reconcile(c, ctx, 'INCOMPATIBLE_RELEASE', releaseId, 'This artifact is governed by a different release');
  if (item.version !== cmd.expectedAggregateVersion) return reconcile(c, ctx, 'STALE_AGGREGATE_VERSION', releaseId, `The artifact is at version ${item.version}`);

  // The pinned Governing Release decides the workflow (INV-021).
  const definition = await releaseDefinition(c, a.org, releaseId);
  const type = findArtifactType(definition, item.artifact_type_key);
  const workflow = workflowFor(definition, type);
  const form = formFor(definition, type);
  let transition;
  try {
    transition = resolveTransition(workflow, item.state, cmd.operationType, activeRole);
  } catch (e) {
    if (e.code) return reject(c, ctx, e.code, releaseId, e.message);
    throw e;
  }
  if (transition.contentOnly && item.creator_participant_id !== participant.id) {
    return reject(c, ctx, 'PERMISSION_DENIED', releaseId, 'Only the creator may edit this artifact');
  }

  let content = item.payload;
  if (transition.contentOnly) {
    if (!isPlainObject(cmd.payload?.content)) return reject(c, ctx, 'VALIDATION_FAILED', releaseId, 'payload.content must be an object');
    content = cmd.payload.content;
  } else if (stateOf(workflow, item.state)?.kind === 'draft') {
    const missing = missingRequiredFields(form, content);
    if (missing.length) return reject(c, ctx, 'VALIDATION_FAILED', releaseId, `Required fields are empty: ${missing.join(', ')}`);
  }

  const version = item.version + 1;
  const visible = visibilityAfter(item.visible_role_ids, workflow, transition);
  await c.query(
    'UPDATE runtime.artifact_instances SET state=$1, payload=$2, visible_role_ids=$3, version=$4, updated_at=now() WHERE organization_id=$5 AND id=$6',
    [transition.to, content, visible, version, a.org, item.id]);
  return record(c, ctx, {
    status: 'accepted', version, releaseId, eventType: eventTypeFor(cmd.operationType),
    eventBody: {artifactId: item.id, artifactTypeKey: item.artifact_type_key, fromState: item.state, toState: transition.to, activeSessionRoleId: activeRole, version, notify: notificationsFor(transition)}
  });
}

async function lookupReceipt(c, a, sessionId, commandId) {
  const r = (await query(c, 'SELECT * FROM sync.command_receipts WHERE organization_id=$1 AND session_id=$2 AND command_id=$3 AND actor_person_id=$4', [a.org, sessionId, commandId, a.person]))[0];
  if (!r) throw fail(404, 'NOT_FOUND', 'Receipt not found');
  return receiptResponse(r, true).body;
}

// Slice projection: an artifact is visible to its creator and to Participants whose active
// Session Roles were holders or notified recipients along its path. Not full Information Policy.
async function listArtifacts(c, a, sessionId) {
  const participant = (await query(c, 'SELECT id FROM runtime.participants WHERE organization_id=$1 AND session_id=$2 AND person_id=$3', [a.org, sessionId, a.person]))[0];
  if (!participant) throw fail(403, 'NOT_A_PARTICIPANT', 'You are not a participant in this session');
  const roles = (await query(c, 'SELECT session_role_id FROM runtime.seat_assignments WHERE organization_id=$1 AND participant_id=$2 AND valid_to IS NULL', [a.org, participant.id])).map((r) => r.session_role_id);
  const rows = await query(c,
    `SELECT id, artifact_type_key, state, payload, version, governing_release_id, form_version, creator_participant_id = $3 AS mine
       FROM runtime.artifact_instances
      WHERE organization_id=$1 AND session_id=$2 AND (creator_participant_id=$3 OR visible_role_ids && $4::text[])
      ORDER BY created_at, id`,
    [a.org, sessionId, participant.id, roles]);
  return {
    sessionRoleIds: roles,
    artifacts: rows.map((r) => ({
      id: r.id, artifactTypeKey: r.artifact_type_key, state: r.state, payload: r.payload,
      version: r.version, governingReleaseId: r.governing_release_id, formVersion: r.form_version, createdByMe: r.mine
    }))
  };
}

async function exportEvidence(c, a, sessionId) {
  await member(c, a, ['operator']);
  await lockAuthority(c, a, sessionId); // 404 for unknown sessions
  const events = await query(c,
    `SELECT sequence, event_type, event_version, command_id, actor_person_id, actor_participant_id, governing_release_id, authority_epoch, body, recorded_at
       FROM evidence.events WHERE organization_id=$1 AND session_id=$2 ORDER BY sequence`, [a.org, sessionId]);
  return {
    sessionId,
    generatedAt: new Date().toISOString(),
    label: 'captured_history',
    events: events.map((e) => ({
      sequence: e.sequence, type: e.event_type, typeVersion: e.event_version, commandId: e.command_id,
      actorPersonId: e.actor_person_id, actorParticipantId: e.actor_participant_id, governingReleaseId: e.governing_release_id,
      authorityEpoch: e.authority_epoch, body: e.body, recordedAt: e.recorded_at
    }))
  };
}

// ---------- HTTP ----------

function pgError(e) {
  switch (e.code) {
    case '22P02': return fail(400, 'INVALID_ID', 'Malformed identifier');
    case '23503': return fail(409, 'REFERENCE_INVALID', 'A referenced record does not exist in this organization');
    case '23505': return fail(409, 'CONFLICT', 'The record already exists');
    case '42501': return fail(403, 'PERMISSION_DENIED', 'Operation not permitted');
    default: return null;
  }
}

function respond(res, status, value, correlationId) {
  res.writeHead(status, {'content-type': 'application/json', 'x-correlation-id': correlationId, 'cache-control': 'no-store'});
  res.end(JSON.stringify(value));
}

async function sendFile(res, relative, type, extraHeaders = {}) {
  res.writeHead(200, {'content-type': type, ...extraHeaders});
  res.end(await readFile(new URL(relative, import.meta.url)));
}

async function handle(req, res) {
  const correlationId = id();
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    if (req.method === 'GET' && path === '/') {
      return await sendFile(res, '../public/index.html', 'text/html; charset=utf-8', {
        'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'"
      });
    }
    if (req.method === 'GET' && path === '/reference-definition.json') {
      return await sendFile(res, '../definitions/fractured-order-reference.json', 'application/json');
    }
    if (req.method === 'GET' && path === '/health') {
      try {
        await pool.query('SELECT 1');
        return respond(res, 200, {status: 'ok', database: 'ok', deploymentId}, correlationId);
      } catch {
        return respond(res, 503, {status: 'degraded', database: 'unavailable', deploymentId}, correlationId);
      }
    }

    const a = auth(req);
    const b = req.method === 'POST' || req.method === 'PUT' ? await body(req) : null;
    let m;
    let status = 200;
    let output;

    if (req.method === 'POST' && path === '/v1/projects') {
      output = await tx(a.org, (c) => createProject(c, a, b)); status = 201;
    } else if ((m = path.match(/^\/v1\/projects\/([^/]+)\/draft$/)) && req.method === 'GET') {
      const projectId = uuidParam(m[1]); output = await tx(a.org, (c) => getDraft(c, a, projectId));
    } else if ((m = path.match(/^\/v1\/projects\/([^/]+)\/draft$/)) && req.method === 'PUT') {
      const projectId = uuidParam(m[1]); output = await tx(a.org, (c) => updateDraft(c, a, projectId, b));
    } else if ((m = path.match(/^\/v1\/projects\/([^/]+)\/validate$/)) && req.method === 'POST') {
      const projectId = uuidParam(m[1]); output = await tx(a.org, (c) => validateDraft(c, a, projectId));
    } else if ((m = path.match(/^\/v1\/projects\/([^/]+)\/publish$/)) && req.method === 'POST') {
      const projectId = uuidParam(m[1]); output = await tx(a.org, (c) => publish(c, a, projectId)); status = 201;
    } else if (req.method === 'POST' && path === '/v1/sessions') {
      output = await tx(a.org, (c) => createSession(c, a, b)); status = 201;
    } else if ((m = path.match(/^\/v1\/sessions\/([^/]+)\/status$/)) && req.method === 'POST') {
      const sessionId = uuidParam(m[1]); output = await tx(a.org, (c) => setSessionStatus(c, a, sessionId, b));
    } else if ((m = path.match(/^\/v1\/sessions\/([^/]+)\/participants$/)) && req.method === 'POST') {
      const sessionId = uuidParam(m[1]); output = await tx(a.org, (c) => assignParticipant(c, a, sessionId, b)); status = 201;
    } else if (req.method === 'POST' && path === '/v1/devices') {
      output = await tx(a.org, (c) => registerDevice(c, a)); status = 201;
    } else if ((m = path.match(/^\/v1\/sessions\/([^/]+)\/commands$/)) && req.method === 'POST') {
      const sessionId = uuidParam(m[1]);
      const result = await tx(a.org, (c) => command(c, a, sessionId, b));
      status = result.status; output = result.body;
    } else if ((m = path.match(/^\/v1\/sessions\/([^/]+)\/commands\/([^/]+)$/)) && req.method === 'GET') {
      const sessionId = uuidParam(m[1]); const commandId = uuidParam(m[2]);
      output = await tx(a.org, (c) => lookupReceipt(c, a, sessionId, commandId));
    } else if ((m = path.match(/^\/v1\/sessions\/([^/]+)\/artifacts$/)) && req.method === 'GET') {
      const sessionId = uuidParam(m[1]); output = await tx(a.org, (c) => listArtifacts(c, a, sessionId));
    } else if ((m = path.match(/^\/v1\/sessions\/([^/]+)\/evidence$/)) && req.method === 'GET') {
      const sessionId = uuidParam(m[1]); output = await tx(a.org, (c) => exportEvidence(c, a, sessionId));
    } else {
      throw fail(404, 'NOT_FOUND', 'Route unavailable');
    }
    respond(res, status, output, correlationId);
  } catch (e) {
    const known = e.status ? e : DOMAIN_HTTP[e.code] ? Object.assign(e, {status: DOMAIN_HTTP[e.code]}) : pgError(e);
    if (known) {
      respond(res, known.status, {error: {code: known.code, message: known.message, details: known.details ?? null, correlationId}}, correlationId);
    } else {
      console.error(correlationId, e);
      respond(res, 500, {error: {code: 'INTERNAL', message: 'Server operation failed', details: null, correlationId}}, correlationId);
    }
  }
}

http.createServer(handle).listen(port, '127.0.0.1', () => console.log(`Plenum reference slice listening on http://127.0.0.1:${port} as deployment ${deploymentId}`));
