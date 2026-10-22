import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import os from "node:os";
import { performance } from "node:perf_hooks";

import { Pool } from "pg";

import { submitRuntimeCommand } from "../../apps/server/dist/runtime/artifact-workflow.js";
import globalSetup from "../e2e/global-setup.mjs";
import { fixture } from "../e2e/fixture.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required for the information-flow load test");

const participantTarget = 500;
await globalSetup();
const pool = new Pool({ connectionString: databaseUrl, max: 4 });

try {
  const existingParticipantCount = Object.keys(fixture.participants).length;
  const additionalCount = participantTarget - existingParticipantCount;
  const personIds = Array.from({ length: additionalCount }, () => randomUUID());
  const participantIds = Array.from({ length: additionalCount }, () => randomUUID());
  const assignmentIds = Array.from({ length: additionalCount }, () => randomUUID());
  const names = personIds.map((_, index) => `Synthetic load participant ${index + 1}`);

  const deviceId = randomUUID();
  const seedClient = await pool.connect();
  try {
    await seedClient.query("BEGIN");
    await seedClient.query(
      "INSERT INTO identity.persons(id,display_name) SELECT * FROM unnest($1::uuid[],$2::text[])",
      [personIds, names]
    );
    await seedClient.query(
      `INSERT INTO runtime.participants(id,organization_id,session_id,person_id)
       SELECT ids.participant_id,$1,$2,ids.person_id FROM unnest($3::uuid[],$4::uuid[]) AS ids(participant_id,person_id)`,
      [fixture.organizationId, fixture.sessionId, participantIds, personIds]
    );
    await seedClient.query(
      `INSERT INTO runtime.seat_assignments
         (id,organization_id,session_id,participant_id,session_role_id,seat_id,assigned_by)
       SELECT ids.assignment_id,$1,$2,ids.participant_id,'scribe','blue-scribe',$3
         FROM unnest($4::uuid[],$5::uuid[]) AS ids(assignment_id,participant_id)`,
      [fixture.organizationId, fixture.sessionId, fixture.people.operator, assignmentIds, participantIds]
    );
    await seedClient.query(
      "INSERT INTO sync.devices(id,organization_id,person_id) VALUES ($1,$2,$3)",
      [deviceId, fixture.organizationId, fixture.people.finalReviewer]
    );
    await seedClient.query("COMMIT");
  } catch (error) {
    await seedClient.query("ROLLBACK");
    throw error;
  } finally {
    seedClient.release();
  }

  const context = {
    principalId: fixture.people.finalReviewer,
    principalType: "person",
    authenticationSessionId: fixture.authenticationSessions.finalReviewer,
    deviceId,
    organizationId: fixture.organizationId,
    sessionId: fixture.sessionId,
    sessionStatus: "active",
    participantId: fixture.participants.finalReviewer,
    seatAssignmentIds: [fixture.assignments.finalReviewer],
    activeSessionRoleId: "white_cell",
    seatId: "control",
    organizationRoles: [],
    activeReleaseId: fixture.releaseId,
    authenticationStrength: "mfa",
    featureFlags: [],
    authorityEpoch: 1,
    accessRevision: 1
  };
  const command = (operationType, aggregateId, payload) => ({
    commandId: randomUUID(), deviceId, operationType, aggregateId, expectedAggregateVersion: 0,
    governingReleaseId: fixture.releaseId, activeSessionRoleId: "white_cell", payload
  });

  const messageId = randomUUID();
  const messageStarted = performance.now();
  const messageReceipt = await submitRuntimeCommand(pool, context,
    command("message.send", messageId, { routeId: "control-broadcast", content: { text: "Capacity fixture" } }),
    randomUUID(), fixture.deploymentId);
  const messageMilliseconds = performance.now() - messageStarted;

  const injectStarted = performance.now();
  const injectReceipt = await submitRuntimeCommand(pool, context,
    command("stage.start", fixture.sessionId, { reason: "Capacity fixture" }),
    randomUUID(), fixture.deploymentId);
  const injectMilliseconds = performance.now() - injectStarted;

  const counts = await pool.query(`SELECT
    (SELECT count(*)::int FROM runtime.participants WHERE session_id=$1) AS participants,
    (SELECT count(*)::int FROM runtime.message_recipients WHERE message_id=$2) AS message_recipients,
    (SELECT count(*)::int FROM runtime.inject_recipient_states) AS inject_recipients,
    (SELECT count(*)::int FROM runtime.information_deliveries WHERE record_type='message' AND record_id=$2) AS message_deliveries,
    (SELECT count(*)::int FROM runtime.information_deliveries WHERE record_type='inject') AS inject_deliveries`,
  [fixture.sessionId, messageId]);
  const measured = counts.rows[0];
  assert.equal(messageReceipt.status, "accepted");
  assert.equal(injectReceipt.status, "accepted");
  assert.deepEqual(measured, {
    participants: participantTarget,
    message_recipients: participantTarget,
    inject_recipients: participantTarget,
    message_deliveries: participantTarget,
    inject_deliveries: participantTarget
  });
  console.log(JSON.stringify({
    status: "MEASURED",
    participantTarget,
    scenarios: {
      broadcastFanout: { milliseconds: Number(messageMilliseconds.toFixed(2)), recipients: measured.message_recipients },
      stageEntryInjectFanout: { milliseconds: Number(injectMilliseconds.toFixed(2)), recipients: measured.inject_recipients }
    },
    environment: {
      node: process.version,
      platform: `${os.platform()} ${os.release()} ${os.arch()}`,
      cpu: os.cpus()[0]?.model ?? "unknown",
      logicalCpuCount: os.cpus().length,
      memoryGiB: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
      database: "PostgreSQL 18 Docker"
    },
    acceptance: "BLOCKED: OPEN-019 has no approved latency or hardware budgets"
  }, null, 2));
} finally {
  await pool.end();
}
