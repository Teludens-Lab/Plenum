import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { resolveSessionAccessContext, runScheduledInjects, submitRuntimeCommand, withOrganizationTransaction } from "../dist/index.js";

async function eventually(check, message) {
  const deadline = Date.now() + 5_000;
  while (!await check()) {
    assert.ok(Date.now() < deadline, message);
    await delay(10);
  }
}

// Real transactions; barriers only pause SQL completion, never replace its result.
export async function verifyCommandSchedulerLockOrder(owner, app, fixture, deploymentId, schedule) {
  const f = fixture;
  const context = await withOrganizationTransaction(app, f.org, client => resolveSessionAccessContext(client, {
    principalId: f.person, organizationId: f.org, authenticationSessionId: f.token,
    organizationRoles: ["admin"], authenticationStrength: "mfa"
  }, { sessionId: f.session, deviceId: f.device, correlationId: randomUUID() }));
  const initial = Number((await owner.query("SELECT next_sequence FROM evidence.session_sequences WHERE session_id=$1", [f.session])).rows[0].next_sequence);

  for (const [index, schedulerFirst] of [true, false].entries()) {
    const injectId = await schedule(f, index);
    const command = { commandId: randomUUID(), deviceId: f.device, operationType: "composition_run.start",
      aggregateId: randomUUID(), expectedAggregateVersion: 0, governingReleaseId: f.release,
      activeSessionRoleId: "role", payload: { planId: "ba11-unavailable" } };
    const scheduler = await app.connect(), participant = await app.connect();
    const schedulerQuery = scheduler.query.bind(scheduler), participantQuery = participant.query.bind(participant);
    const barrier = Promise.withResolvers();
    let paused = false, commandDone = false, workerRun, commandRun;
    try {
      await schedulerQuery("SET statement_timeout='10s'"); await participantQuery("SET statement_timeout='10s'");
      const schedulerPid = (await schedulerQuery("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      const participantPid = (await participantQuery("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      if (schedulerFirst) {
        scheduler.query = async (...args) => {
          const result = await schedulerQuery(...args);
          if (typeof args[0] === "string" && args[0].includes("FROM runtime.sessions") && args[0].includes("SKIP LOCKED")) {
            paused = true; await barrier.promise;
          }
          return result;
        };
        workerRun = runScheduledInjects(scheduler, f.org, deploymentId);
        await eventually(() => paused, "scheduler holds the Session lifecycle lock");
        commandRun = submitRuntimeCommand(participant, context, command, randomUUID(), deploymentId)
          .then(receipt => ({ receipt }), error => ({ error })).finally(() => { commandDone = true; });
        await eventually(async () => commandDone || (await owner.query("SELECT $2::integer=ANY(pg_blocking_pids($1::integer)) AS blocked",
          [participantPid, schedulerPid])).rows[0].blocked, "participant completes or reaches the old Session FK lock conflict");
        barrier.resolve();
      } else {
        participant.query = async (...args) => {
          const result = await participantQuery(...args);
          if (typeof args[0] === "string" && args[0].includes("inserted_receipt AS")) {
            paused = true; await barrier.promise;
          }
          return result;
        };
        commandRun = submitRuntimeCommand(participant, context, command, randomUUID(), deploymentId)
          .then(receipt => ({ receipt }), error => ({ error }));
        await eventually(() => paused, "participant holds its Evidence sequence and Session FK locks before commit");
        workerRun = runScheduledInjects(scheduler, f.org, deploymentId);
        await eventually(async () => (await owner.query("SELECT $2::integer=ANY(pg_blocking_pids($1::integer)) AS blocked",
          [schedulerPid, participantPid])).rows[0].blocked, "scheduler waits on the participant's Evidence sequence");
        assert.deepEqual(await runScheduledInjects(app, f.org, deploymentId), { released: 0, failures: [] }, "another worker skips the scheduler's claimed Session");
        barrier.resolve();
      }
      const [worker, outcome] = await Promise.all([workerRun, commandRun]);
      assert.deepEqual(worker.failures.map(({ error }) => ({ code: error.code, message: error.message })), [], "BA-11 scheduler has no database deadlock");
      assert.ifError(outcome.error);
      assert.equal(outcome.receipt.status, "rejected");
      assert.equal(outcome.receipt.errorCode, "CAPABILITY_UNAVAILABLE");
      assert.equal(worker.released, 1);
      const followUp = await runScheduledInjects(app, f.org, deploymentId);
      assert.deepEqual(followUp, { released: 0, failures: [] });
      const retries = await Promise.all([0, 1].map(() => submitRuntimeCommand(app, context, command, randomUUID(), deploymentId)));
      assert.ok(retries.every(receipt => receipt.replayed && receipt.evidenceSequence === outcome.receipt.evidenceSequence));
      const state = (await owner.query(`SELECT
        (SELECT count(*)::integer FROM sync.command_receipts WHERE session_id=$1 AND command_id=$2) AS receipts,
        (SELECT count(*)::integer FROM evidence.events WHERE session_id=$1 AND command_id=$2 AND event_type='command.rejected') AS rejections,
        (SELECT count(*)::integer FROM evidence.events WHERE session_id=$1 AND aggregate_id=$3 AND event_type='inject.released') AS releases,
        (SELECT count(*)::integer FROM runtime.inject_recipient_states WHERE inject_instance_id=$3) AS recipients,
        (SELECT count(*)::integer FROM runtime.inject_instances WHERE id=$3 AND state<>'scheduled') AS delivered`,
      [f.session, command.commandId, injectId])).rows[0];
      assert.deepEqual(state, { receipts: 1, rejections: 1, releases: 1, recipients: 1, delivered: 1 });
    } finally {
      barrier.resolve();
      await Promise.allSettled([workerRun, commandRun]);
      scheduler.query = schedulerQuery; participant.query = participantQuery;
      await schedulerQuery("RESET statement_timeout"); await participantQuery("RESET statement_timeout");
      scheduler.release(); participant.release();
    }
  }
  const rows = (await owner.query(`SELECT event.sequence,count(outbox.id)::integer AS copies FROM evidence.events event
    LEFT JOIN sync.session_delta_outbox outbox ON outbox.event_id=event.id AND outbox.session_id=event.session_id
    WHERE event.session_id=$1 GROUP BY event.sequence ORDER BY event.sequence`, [f.session])).rows;
  assert.deepEqual(rows.map(row => Number(row.sequence)), [initial, initial + 1, initial + 2, initial + 3]);
  assert.ok(rows.every(row => row.copies === 1), "each committed outcome has exactly one outbox entry");
  assert.equal(Number((await owner.query("SELECT next_sequence FROM evidence.session_sequences WHERE session_id=$1", [f.session])).rows[0].next_sequence), initial + 4);
}
