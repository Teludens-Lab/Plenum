import assert from "node:assert/strict";
import { spawn } from "node:child_process";

import { getRuntimeSnapshot, submitRuntimeCommand } from "../../apps/server/dist/index.js";
import {
  acceptance, actorContext, actorPrincipal, command, config, databaseSize, databaseUrl, environment, fixture,
  latencyMetric, observeDatabaseRecovery, performance, randomUUID, round, runConcurrent, seedReferenceWorkload,
  startSaturationSampler
} from "./load-support.mjs";

async function waitForServer(child) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Runtime server exited with code ${child.exitCode}`);
    try { if ((await fetch("http://127.0.0.1:4173/")).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Runtime server did not become ready");
}

function startServer() {
  return spawn(process.execPath, ["tests/e2e/runtime-server.mjs"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "inherit", windowsHide: true
  });
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));
}

async function observeApplicationRestart(actor) {
  const request = () => fetch(`http://127.0.0.1:4173/v1/sessions/${fixture.sessionId}/sync/snapshot?activeSessionRoleId=${actor.sessionRoleId}`, {
    headers: { authorization: `Bearer ${fixture.tokens.author}`, "x-device-id": actor.deviceId }
  });
  let server = startServer();
  try {
    await waitForServer(server);
    assert.equal((await request()).status, 200);
    await stopServer(server);
    const started = performance.now();
    server = startServer();
    await waitForServer(server);
    assert.equal((await request()).status, 200);
    return { status: "RECOVERED", milliseconds: round(performance.now() - started), injectedFailure: "Runtime process restart" };
  } finally { await stopServer(server); }
}

export async function runApplicationProfile(pool) {
  const started = performance.now();
  const bytesBefore = await databaseSize(pool);
  const fixtureLoad = await seedReferenceWorkload(pool);
  const stopSampler = startSaturationSampler(pool);

  const reconnect = await runConcurrent(fixtureLoad.allActors, config.application.concurrency, async (actor) => {
    const snapshot = await getRuntimeSnapshot({ pool, principal: actorPrincipal(actor), sessionId: actor.sessionId,
      deviceId: actor.deviceId, activeSessionRoleId: actor.sessionRoleId, correlationId: randomUUID() });
    assert.equal(snapshot.state.participantId, actor.participantId);
    return snapshot.cursor;
  });
  assert.equal(reconnect.every(({ ok }) => ok), true, reconnect.find(({ ok }) => !ok)?.error);

  const commandTasks = fixtureLoad.sessions.flatMap((session) => session.actors
    .filter(({ sessionRoleId }) => sessionRoleId === "scribe")
    .slice(0, config.application.commandsPerSession)
    .map((actor, index) => ({ actor, envelope: command(actor, "artifact.create", randomUUID(), 0,
      { artifactTypeKey: "note", content: { note: `Synthetic load note ${session.index}-${index}` } }) })));
  assert.equal(commandTasks.length, config.sessions * config.application.commandsPerSession);
  const commandBurst = await runConcurrent(commandTasks, config.application.concurrency, ({ actor, envelope }) =>
    submitRuntimeCommand(pool, actorContext(actor), envelope, randomUUID(), fixture.deploymentId));
  assert.equal(commandBurst.every(({ ok, value }) => ok && value.status === "accepted"), true,
    commandBurst.find(({ ok, value }) => !ok || value?.status !== "accepted")?.error);

  const broadcasts = fixtureLoad.sessions.map((session) => {
    const actor = session.actors.find(({ sessionRoleId }) => sessionRoleId === "white_cell");
    assert.ok(actor);
    return { actor, aggregateId: randomUUID(), envelope: command(actor, "message.send", randomUUID(), 0,
      { routeId: "control-broadcast", content: { text: `Synthetic load broadcast ${session.index}` } }) };
  });
  const broadcastResults = await runConcurrent(broadcasts, config.sessions, ({ actor, envelope }) =>
    submitRuntimeCommand(pool, actorContext(actor), envelope, randomUUID(), fixture.deploymentId));
  assert.equal(broadcastResults.every(({ ok, value }) => ok && value.status === "accepted"), true);

  const stageTasks = fixtureLoad.sessions.map((session) => {
    const actor = session.actors.find(({ sessionRoleId }) => sessionRoleId === "white_cell");
    return { actor, envelope: command(actor, "stage.start", session.sessionId, 0, { reason: "Synthetic load start" }) };
  });
  const stageResults = await runConcurrent(stageTasks, config.sessions, ({ actor, envelope }) =>
    submitRuntimeCommand(pool, actorContext(actor), envelope, randomUUID(), fixture.deploymentId));
  assert.equal(stageResults.every(({ ok, value }) => ok && value.status === "accepted"), true);

  const replay = await submitRuntimeCommand(pool, actorContext(commandTasks[0].actor), commandTasks[0].envelope, randomUUID(), fixture.deploymentId);
  assert.equal(replay.replayed, true);
  let unauthorizedCode;
  try {
    await getRuntimeSnapshot({ pool, principal: { authenticationSessionId: fixture.authenticationSessions.operator,
      principalId: fixture.people.operator, organizationId: fixture.organizationId, organizationRoles: ["operator", "admin"],
      authenticationStrength: "mfa", expiresAt: new Date("2099-01-01T00:00:00Z") }, sessionId: fixture.sessionId,
      deviceId: fixtureLoad.operatorDeviceId, correlationId: randomUUID() });
  } catch (error) { unauthorizedCode = error?.envelope?.error?.code; }
  assert.equal(unauthorizedCode, "NOT_A_PARTICIPANT");

  const sessionIds = fixtureLoad.sessions.map(({ sessionId }) => sessionId);
  const integrity = (await pool.query(`SELECT
    (SELECT count(*)::int FROM runtime.participants WHERE session_id=ANY($1::uuid[])) AS participants,
    (SELECT count(*)::int FROM runtime.artifact_instances WHERE session_id=ANY($1::uuid[]) AND artifact_type_key='note') AS notes,
    (SELECT count(*)::int FROM runtime.message_recipients WHERE session_id=ANY($1::uuid[])) AS message_recipients,
    (SELECT count(*)::int FROM runtime.inject_recipient_states WHERE session_id=ANY($1::uuid[])) AS inject_recipients,
    (SELECT count(*)::int FROM sync.command_receipts WHERE command_id=ANY($2::uuid[])) AS receipts,
    (SELECT count(*)::int FROM evidence.events WHERE command_id=ANY($2::uuid[])) AS events,
    (SELECT count(*)::int FROM sync.session_delta_outbox item JOIN evidence.events event ON event.id=item.event_id
      WHERE event.command_id=ANY($2::uuid[])) AS outbox_rows`, [sessionIds, commandTasks.map(({ envelope }) => envelope.commandId)])).rows[0];
  assert.deepEqual(integrity, {
    participants: config.sessions * config.participantsPerSession,
    notes: commandTasks.length,
    message_recipients: config.sessions * config.participantsPerSession,
    inject_recipients: config.sessions * config.participantsPerSession,
    receipts: commandTasks.length,
    events: commandTasks.length,
    outbox_rows: commandTasks.length
  });

  const databaseRecovery = await observeDatabaseRecovery(pool);
  const authorActor = fixtureLoad.sessions[0].actors.find(({ personId }) => personId === fixture.people.author);
  const applicationRestart = await observeApplicationRestart(authorActor);
  const saturation = await stopSampler();
  const bytesAfter = await databaseSize(pool);
  return {
    contractId: "load-profile-v1", profile: "application", testId: "SYNC-15", status: "MEASURED",
    generatedAt: new Date().toISOString(), environment: await environment(pool),
    conditions: { seed: config.seed, sessions: config.sessions, participantsPerSession: config.participantsPerSession,
      actorMix: "one Control actor plus Scribe/Facilitator/Notetaker Participants from the Release",
      reconnects: reconnect.length, commands: commandTasks.length, broadcasts: broadcasts.length, stageEntryInjects: stageTasks.length,
      concurrency: config.application.concurrency },
    latencyMs: { reconnectSnapshot: latencyMetric(reconnect), commandReceipt: latencyMetric(commandBurst),
      broadcastFanout: latencyMetric(broadcastResults), stageEntryInjectFanout: latencyMetric(stageResults) },
    integrity: { ...integrity, duplicateReplaySharedReceipt: replay.replayed, unauthorizedProjectionError: unauthorizedCode,
      lostAcceptedEffects: 0, duplicateAcceptedEffects: 0 },
    failureRecovery: { databaseBackend: databaseRecovery, applicationRestart },
    saturation,
    cost: { wallSeconds: round((performance.now() - started) / 1000), databaseGrowthMiB: round((bytesAfter - bytesBefore) / 1024 ** 2), externalSpendUsd: 0 },
    acceptance: acceptance()
  };
}
