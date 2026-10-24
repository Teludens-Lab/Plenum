import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

import Ajv2020 from "ajv/dist/2020.js";
import { Pool } from "pg";

import { fixture } from "../e2e/fixture.mjs";

export const config = JSON.parse(await readFile(new URL("../../deploy/load-fixtures/reference-profile.json", import.meta.url), "utf8"));
export const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required for PS-540 load profiles");

const expiresAt = new Date("2099-01-01T00:00:00.000Z");
const round = (value) => Number(value.toFixed(2));

export function stableUuid(label) {
  const bytes = createHash("sha256").update(`${config.seed}:${label}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function latencyMetric(results) {
  const values = results.filter(({ ok }) => ok).map(({ milliseconds }) => milliseconds).sort((a, b) => a - b);
  const percentile = (value) => values.length === 0 ? 0 : values[Math.min(values.length - 1, Math.ceil(value * values.length) - 1)];
  return {
    samples: results.length,
    p50: round(percentile(0.5)),
    p95: round(percentile(0.95)),
    p99: round(percentile(0.99)),
    max: round(values.at(-1) ?? 0),
    errors: results.filter(({ ok }) => !ok).length
  };
}

export async function runConcurrent(items, concurrency, operation) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      const started = performance.now();
      try {
        results[index] = { ok: true, milliseconds: performance.now() - started, value: await operation(items[index], index) };
        results[index].milliseconds = performance.now() - started;
      } catch (error) {
        results[index] = { ok: false, milliseconds: performance.now() - started,
          error: error instanceof Error ? error.message : String(error) };
      }
    }
  }));
  return results;
}

export function actorContext(actor) {
  return {
    authenticationSessionId: actor.authenticationSessionId,
    principalId: actor.personId,
    principalType: "person",
    organizationId: fixture.organizationId,
    sessionId: actor.sessionId,
    sessionStatus: "active",
    participantId: actor.participantId,
    seatAssignmentIds: [actor.assignmentId],
    activeSessionRoleId: actor.sessionRoleId,
    seatId: actor.seatId,
    organizationRoles: [],
    activeReleaseId: fixture.releaseId,
    authenticationStrength: "mfa",
    featureFlags: [],
    authorityEpoch: 1,
    accessRevision: 1,
    deviceId: actor.deviceId
  };
}

export function actorPrincipal(actor) {
  return {
    authenticationSessionId: actor.authenticationSessionId,
    principalId: actor.personId,
    organizationId: fixture.organizationId,
    organizationRoles: [],
    authenticationStrength: "mfa",
    expiresAt
  };
}

function newActor(sessionIndex, participantIndex, sessionId, personId, authenticationSessionId, role = "scribe", seatId = "blue-scribe") {
  return {
    sessionIndex,
    participantIndex,
    sessionId,
    personId,
    authenticationSessionId,
    participantId: stableUuid(`participant-${sessionIndex}-${participantIndex}`),
    assignmentId: stableUuid(`assignment-${sessionIndex}-${participantIndex}`),
    deviceId: stableUuid(`device-${sessionIndex}-${participantIndex}`),
    sessionRoleId: role,
    seatId
  };
}

export async function seedReferenceWorkload(pool) {
  const existing = (await pool.query(`SELECT participant.id AS participant_id,participant.person_id,assignment.id AS assignment_id,
      assignment.session_role_id,assignment.seat_id,authentication.id AS authentication_session_id
    FROM runtime.participants participant
    JOIN runtime.seat_assignments assignment ON assignment.organization_id=participant.organization_id
      AND assignment.session_id=participant.session_id AND assignment.participant_id=participant.id AND assignment.valid_to IS NULL
    JOIN identity.authentication_sessions authentication ON authentication.organization_id=participant.organization_id
      AND authentication.person_id=participant.person_id AND authentication.revoked_at IS NULL
    WHERE participant.organization_id=$1 AND participant.session_id=$2 ORDER BY participant.id`,
  [fixture.organizationId, fixture.sessionId])).rows;
  assert.equal(existing.length, 10);

  const sessions = Array.from({ length: config.sessions }, (_, index) => ({
    index,
    sessionId: index === 0 ? fixture.sessionId : stableUuid(`session-${index}`),
    authorityId: index === 0 ? undefined : stableUuid(`authority-${index}`),
    activationId: index === 0 ? undefined : stableUuid(`activation-${index}`),
    radioChannelId: index === 0 ? fixture.voiceChannels.radio : stableUuid(`radio-${index}`),
    actors: []
  }));
  sessions[0].actors.push(...existing.map((row, index) => ({
    sessionIndex: 0, participantIndex: index, sessionId: fixture.sessionId,
    personId: row.person_id, authenticationSessionId: row.authentication_session_id,
    participantId: row.participant_id, assignmentId: row.assignment_id,
    deviceId: stableUuid(`device-0-${index}`), sessionRoleId: row.session_role_id, seatId: row.seat_id
  })));

  const finalReviewer = existing.find(({ person_id }) => person_id === fixture.people.finalReviewer);
  assert.ok(finalReviewer);
  for (let sessionIndex = 1; sessionIndex < sessions.length; sessionIndex += 1) {
    sessions[sessionIndex].actors.push(newActor(sessionIndex, 0, sessions[sessionIndex].sessionId,
      finalReviewer.person_id, finalReviewer.authentication_session_id, "white_cell", "control"));
  }
  for (const session of sessions) {
    while (session.actors.length < config.participantsPerSession) {
      const participantIndex = session.actors.length;
      const personId = stableUuid(`person-${session.index}-${participantIndex}`);
      session.actors.push(newActor(session.index, participantIndex, session.sessionId, personId,
        stableUuid(`authentication-${session.index}-${participantIndex}`)));
    }
  }

  const generated = sessions.flatMap(({ actors }) => actors).filter(({ personId }) => !existing.some(({ person_id }) => person_id === personId));
  const insertedParticipants = sessions.flatMap(({ actors }) => actors).filter(({ participantId }) => !existing.some(({ participant_id }) => participant_id === participantId));
  const allActors = sessions.flatMap(({ actors }) => actors);
  const radioDefinition = (await pool.query("SELECT definition FROM comms.voice_channels WHERE organization_id=$1 AND id=$2",
    [fixture.organizationId, fixture.voiceChannels.radio])).rows[0]?.definition;
  assert.ok(radioDefinition);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const session of sessions.slice(1)) {
      await client.query(`INSERT INTO runtime.sessions(id,organization_id,project_id,initial_release_id,status,created_by)
        VALUES ($1,$2,$3,$4,'active',$5)`, [session.sessionId, fixture.organizationId, fixture.projectId, fixture.releaseId, fixture.people.operator]);
      await client.query(`INSERT INTO runtime.session_authorities(session_id,organization_id,deployment_id,authority_epoch,status)
        VALUES ($1,$2,$3,1,'active')`, [session.sessionId, fixture.organizationId, fixture.deploymentId]);
      await client.query(`INSERT INTO runtime.release_activations
        (id,organization_id,project_id,session_id,release_id,activation_sequence,compatibility_policy,approved_by)
        VALUES ($1,$2,$3,$4,$5,1,'{}',$6)`, [session.activationId, fixture.organizationId, fixture.projectId,
        session.sessionId, fixture.releaseId, fixture.people.operator]);
      await client.query("INSERT INTO evidence.session_sequences(session_id,organization_id) VALUES ($1,$2)",
        [session.sessionId, fixture.organizationId]);
      await client.query(`INSERT INTO comms.voice_channels
        (id,organization_id,session_id,governing_release_id,definition_id,definition_revision,definition,status,
         provider_binding_id,provider_adapter_digest,authority_epoch,opened_by)
        VALUES ($1,$2,$3,$4,'all-hands-radio',1,$5::jsonb,'open','local-media-v1',$6,1,$7)`,
      [session.radioChannelId, fixture.organizationId, session.sessionId, fixture.releaseId, JSON.stringify(radioDefinition),
        `sha256:${"e".repeat(64)}`, fixture.people.operator]);
    }
    if (generated.length > 0) {
      await client.query("INSERT INTO identity.persons(id,display_name) SELECT * FROM unnest($1::uuid[],$2::text[])",
        [generated.map(({ personId }) => personId), generated.map(({ sessionIndex, participantIndex }) => `Synthetic load actor ${sessionIndex}-${participantIndex}`)]);
      await client.query(`INSERT INTO identity.authentication_sessions
        (id,organization_id,person_id,issuer,subject,authentication_strength,expires_at)
        SELECT ids.authentication_id,$1,ids.person_id,'https://load.invalid',ids.subject,'mfa','2099-01-01T00:00:00Z'
        FROM unnest($2::uuid[],$3::uuid[],$4::text[]) AS ids(authentication_id,person_id,subject)`,
      [fixture.organizationId, generated.map(({ authenticationSessionId }) => authenticationSessionId),
        generated.map(({ personId }) => personId), generated.map(({ sessionIndex, participantIndex }) => `ps540-${sessionIndex}-${participantIndex}`)]);
    }
    await client.query(`INSERT INTO sync.devices(id,organization_id,person_id)
      SELECT ids.device_id,$1,ids.person_id FROM unnest($2::uuid[],$3::uuid[]) AS ids(device_id,person_id)`,
    [fixture.organizationId, allActors.map(({ deviceId }) => deviceId), allActors.map(({ personId }) => personId)]);
    await client.query(`INSERT INTO runtime.participants(id,organization_id,session_id,person_id)
      SELECT ids.participant_id,$1,ids.session_id,ids.person_id
      FROM unnest($2::uuid[],$3::uuid[],$4::uuid[]) AS ids(participant_id,session_id,person_id)`,
    [fixture.organizationId, insertedParticipants.map(({ participantId }) => participantId),
      insertedParticipants.map(({ sessionId }) => sessionId), insertedParticipants.map(({ personId }) => personId)]);
    await client.query(`INSERT INTO runtime.seat_assignments
      (id,organization_id,session_id,participant_id,session_role_id,seat_id,assigned_by)
      SELECT ids.assignment_id,$1,ids.session_id,ids.participant_id,ids.session_role_id,ids.seat_id,$2
      FROM unnest($3::uuid[],$4::uuid[],$5::uuid[],$6::text[],$7::text[])
        AS ids(assignment_id,session_id,participant_id,session_role_id,seat_id)`,
    [fixture.organizationId, fixture.people.operator, insertedParticipants.map(({ assignmentId }) => assignmentId),
      insertedParticipants.map(({ sessionId }) => sessionId), insertedParticipants.map(({ participantId }) => participantId),
      insertedParticipants.map(({ sessionRoleId }) => sessionRoleId), insertedParticipants.map(({ seatId }) => seatId)]);
    await client.query(`INSERT INTO runtime.participant_access_revisions(organization_id,session_id,participant_id)
      SELECT $1,* FROM unnest($2::uuid[],$3::uuid[]) AS ids(session_id,participant_id)`,
    [fixture.organizationId, insertedParticipants.map(({ sessionId }) => sessionId), insertedParticipants.map(({ participantId }) => participantId)]);
    const operatorDeviceId = stableUuid("operator-device");
    await client.query("INSERT INTO sync.devices(id,organization_id,person_id) VALUES ($1,$2,$3)",
      [operatorDeviceId, fixture.organizationId, fixture.people.operator]);
    await client.query("COMMIT");
    return { sessions, allActors, operatorDeviceId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function startSaturationSampler(pool) {
  const samples = [];
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const db = (await pool.query(`SELECT count(*)::int AS connections,
        count(*) FILTER (WHERE wait_event IS NOT NULL)::int AS waiting
        FROM pg_stat_activity WHERE datname=current_database()`)).rows[0];
      samples.push({ atMs: Date.now(), rssMiB: round(process.memoryUsage().rss / 1024 ** 2),
        connections: db.connections, waiting: db.waiting });
    } finally { busy = false; }
  }, 100);
  return async () => {
    clearInterval(timer);
    while (busy) await new Promise((resolve) => setTimeout(resolve, 5));
    return {
      samples: samples.length,
      peakNodeRssMiB: Math.max(0, ...samples.map(({ rssMiB }) => rssMiB)),
      peakDatabaseConnections: Math.max(0, ...samples.map(({ connections }) => connections)),
      peakWaitingConnections: Math.max(0, ...samples.map(({ waiting }) => waiting))
    };
  };
}

export async function observeDatabaseRecovery(pool) {
  const victim = await pool.connect();
  const terminator = new Pool({ connectionString: databaseUrl, max: 1 });
  let released = false;
  try {
    const pid = Number((await victim.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
    await terminator.query("SELECT pg_terminate_backend($1)", [pid]);
    await assert.rejects(victim.query("SELECT 1"));
    victim.release(true);
    released = true;
    const started = performance.now();
    await pool.query("SELECT 1");
    return { status: "RECOVERED", milliseconds: round(performance.now() - started), injectedFailure: "terminated PostgreSQL backend" };
  } finally {
    if (!released) victim.release(true);
    await terminator.end();
  }
}

export async function databaseSize(pool) {
  return Number((await pool.query("SELECT pg_database_size(current_database()) AS bytes")).rows[0].bytes);
}

export async function writeReport(report) {
  const schema = JSON.parse(await readFile(new URL("./load-profile-v1.schema.json", import.meta.url), "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true, formats: { "date-time": true } });
  const validate = ajv.compile(schema);
  assert.equal(validate(report), true, JSON.stringify(validate.errors, null, 2));
  const directory = path.join(process.cwd(), "test-results", "load");
  await mkdir(directory, { recursive: true });
  const target = path.join(directory, `ps-540-${report.profile}.json`);
  await writeFile(target, `${JSON.stringify(report, null, 2)}\n`);
  return target;
}

export async function environment(pool) {
  const database = (await pool.query("SELECT version() AS version,current_setting('max_connections') AS max_connections,current_setting('shared_buffers') AS shared_buffers")).rows[0];
  const docker = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}|{{.NCPU}}|{{.MemTotal}}"], { encoding: "utf8" });
  const [dockerVersion = "unavailable", dockerCpu = "0", dockerMemory = "0"] = docker.status === 0 ? docker.stdout.trim().split("|") : [];
  return {
    commit: spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim(),
    node: process.version,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpuModel: os.cpus()[0]?.model ?? "unknown",
    logicalCpuCount: os.cpus().length,
    memoryGiB: round(os.totalmem() / 1024 ** 3),
    docker: { version: dockerVersion, cpuCount: Number(dockerCpu), memoryGiB: round(Number(dockerMemory) / 1024 ** 3) },
    database: { version: database.version, maxConnections: Number(database.max_connections), sharedBuffers: database.shared_buffers },
    network: "local Windows host to Docker Desktop PostgreSQL over loopback",
    databaseName: process.env.PLENUM_LOAD_DATABASE_NAME
  };
}

export function acceptance() {
  return {
    status: "BLOCKED",
    reason: "OPEN-019 targets are approved, but capacity acceptance still fails: command and Floor latency missed the targets, and the required soak, repetitions, and institutional media evidence are incomplete.",
    recommendedThresholds: config.recommendedThresholds
  };
}

export function command(actor, operationType, aggregateId, expectedAggregateVersion, payload, commandId = randomUUID()) {
  return { commandId, deviceId: actor.deviceId, operationType, aggregateId, expectedAggregateVersion,
    governingReleaseId: fixture.releaseId, activeSessionRoleId: actor.sessionRoleId, payload };
}

export { fixture, Pool, performance, randomUUID, round };
