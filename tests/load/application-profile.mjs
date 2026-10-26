import assert from "node:assert/strict";
import { spawn } from "node:child_process";

import { getRuntimeSnapshot, submitRuntimeCommand } from "../../apps/server/dist/index.js";
import {
  acceptance, actorContext, actorPrincipal, command, config, databaseSize, databaseUrl, environment, fixture,
  latencyMetric, observeDatabaseRecovery, performance, randomUUID, round, runConcurrent, seedReferenceWorkload,
  startSaturationSampler
} from "./load-support.mjs";

async function waitForServer(child) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Runtime server exited with code ${child.exitCode}`);
    try { if ((await fetch("http://127.0.0.1:4173/")).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Runtime server did not become ready");
}

function startServer() {
  const environment = { ...process.env, DATABASE_URL: databaseUrl };
  delete environment.MEDIA_TEST_URL;
  delete environment.MEDIA_TEST_OPERATOR_FILE;
  return spawn(process.execPath, ["tests/e2e/runtime-server.mjs"], {
    cwd: process.cwd(), env: environment, stdio: "inherit", windowsHide: true
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
  const soakEnabled = process.env.PLENUM_LOAD_SOAK === "1";
  if (soakEnabled && process.env.PLENUM_LOAD_ALLOW_SHORT_SOAK !== "1") {
    for (const name of ["PLENUM_LOAD_ENVIRONMENT_NAME", "PLENUM_LOAD_APPROVAL_REFERENCE",
      "PLENUM_LOAD_STORAGE_CLASS", "PLENUM_LOAD_NETWORK_DESCRIPTION", "PLENUM_LOAD_APPLICATION_PROCESSES"]) {
      assert.ok(process.env[name]?.trim(), `${name} is required for acceptance soak evidence`);
    }
    assert.equal(Number.isSafeInteger(Number(process.env.PLENUM_LOAD_APPLICATION_PROCESSES)) &&
      Number(process.env.PLENUM_LOAD_APPLICATION_PROCESSES) > 0, true,
    "PLENUM_LOAD_APPLICATION_PROCESSES must be a positive integer");
    const settings = (await pool.query(`SELECT current_setting('synchronous_commit') AS synchronous_commit,
      current_setting('wal_buffers') AS wal_buffers, current_setting('checkpoint_timeout') AS checkpoint_timeout,
      current_setting('max_wal_size') AS max_wal_size`)).rows[0];
    assert.deepEqual(settings, { synchronous_commit: "on", wal_buffers: "16MB",
      checkpoint_timeout: "15min", max_wal_size: "4GB" },
    "Acceptance soak requires the durable PS-545 PostgreSQL settings");
  }
  const duration = (name, configured) => {
    const override = process.env[name];
    if (override === undefined) return configured;
    const seconds = Number(override);
    assert.equal(process.env.PLENUM_LOAD_ALLOW_SHORT_SOAK, "1", `${name} overrides are diagnostic only`);
    assert.equal(Number.isFinite(seconds) && seconds >= 0, true, `${name} must be a non-negative number`);
    return seconds;
  };
  const warmupSeconds = soakEnabled ? duration("PLENUM_LOAD_WARMUP_SECONDS", config.soak.warmupSeconds) : 0;
  const steadyStateSeconds = soakEnabled ? duration("PLENUM_LOAD_STEADY_SECONDS", config.soak.steadyStateSeconds) : 0;
  let phase = soakEnabled ? "warmup" : "reconnect";
  const stopSampler = startSaturationSampler(pool, () => phase);

  const commandTasksBySession = fixtureLoad.sessions.map((session) => session.actors
    .filter(({ sessionRoleId }) => sessionRoleId === "scribe")
    .slice(0, config.application.commandsPerSession)
    .map((actor, index) => ({ actor, envelope: command(actor, "artifact.create", randomUUID(), 0,
      { artifactTypeKey: "note", content: { note: `Synthetic load note ${session.index}-${index}` } }) })));
  const commandTasks = commandTasksBySession[0].flatMap((_, index) => commandTasksBySession.map((tasks) => tasks[index]));
  assert.equal(commandTasks.length, config.sessions * config.application.commandsPerSession);

  let warmup = [];
  let steady = [];
  let steadyCommands = [];
  if (soakEnabled) {
    warmup = await runConcurrent(fixtureLoad.allActors, config.application.concurrency, async (actor) => {
      const snapshot = await getRuntimeSnapshot({ pool, principal: actorPrincipal(actor), sessionId: actor.sessionId,
        deviceId: actor.deviceId, activeSessionRoleId: actor.sessionRoleId, correlationId: randomUUID() });
      return snapshot.cursor;
    }, warmupSeconds * 1000 / fixtureLoad.allActors.length);
    assert.equal(warmup.every(({ ok }) => ok), true, warmup.find(({ ok }) => !ok)?.error);

    steadyCommands = commandTasks.map(({ actor }, index) => ({ actor, envelope: command(actor, "artifact.create",
      randomUUID(), 0, { artifactTypeKey: "note", content: { note: `Synthetic steady note ${index}` } }) }));
    const mixed = fixtureLoad.allActors.flatMap((actor, index) => [
      { kind: "projection", actor },
      ...(index % 5 === 0 ? [{ kind: "command", ...steadyCommands[index / 5] }] : [])
    ]);
    phase = "steady-state";
    steady = await runConcurrent(mixed, config.application.concurrency, async (item) => item.kind === "projection"
      ? { kind: item.kind, value: await getRuntimeSnapshot({ pool, principal: actorPrincipal(item.actor),
        sessionId: item.actor.sessionId, deviceId: item.actor.deviceId,
        activeSessionRoleId: item.actor.sessionRoleId, correlationId: randomUUID() }) }
      : { kind: item.kind, value: await submitRuntimeCommand(pool, actorContext(item.actor), item.envelope,
        randomUUID(), fixture.deploymentId) }, steadyStateSeconds * 1000 / mixed.length);
    assert.equal(steady.every(({ ok, value }) => ok && (value.kind !== "command" || value.value.status === "accepted")),
      true, steady.find(({ ok, value }) => !ok || (value?.kind === "command" && value.value.status !== "accepted"))?.error);
  }

  phase = "reconnect";
  const reconnect = await runConcurrent(fixtureLoad.allActors, config.application.concurrency, async (actor) => {
    const snapshot = await getRuntimeSnapshot({ pool, principal: actorPrincipal(actor), sessionId: actor.sessionId,
      deviceId: actor.deviceId, activeSessionRoleId: actor.sessionRoleId, correlationId: randomUUID() });
    assert.equal(snapshot.state.participantId, actor.participantId);
    return snapshot.cursor;
  }, config.application.reconnectWindowSeconds * 1000 / fixtureLoad.allActors.length);
  assert.equal(reconnect.every(({ ok }) => ok), true, reconnect.find(({ ok }) => !ok)?.error);

  phase = "commands";
  const commandBurst = await runConcurrent(commandTasks, config.application.concurrency, ({ actor, envelope }) =>
    submitRuntimeCommand(pool, actorContext(actor), envelope, randomUUID(), fixture.deploymentId),
  config.application.commandWindowSeconds * 1000 / commandTasks.length);
  assert.equal(commandBurst.every(({ ok, value }) => ok && value.status === "accepted"), true,
    commandBurst.find(({ ok, value }) => !ok || value?.status !== "accepted")?.error);

  const broadcasts = fixtureLoad.sessions.map((session) => {
    const actor = session.actors.find(({ sessionRoleId }) => sessionRoleId === "white_cell");
    assert.ok(actor);
    return { actor, aggregateId: randomUUID(), envelope: command(actor, "message.send", randomUUID(), 0,
      { routeId: "control-broadcast", content: { text: `Synthetic load broadcast ${session.index}` } }) };
  });
  phase = "broadcast";
  const broadcastResults = await runConcurrent(broadcasts, config.sessions, ({ actor, envelope }) =>
    submitRuntimeCommand(pool, actorContext(actor), envelope, randomUUID(), fixture.deploymentId));
  assert.equal(broadcastResults.every(({ ok, value }) => ok && value.status === "accepted"), true);

  const stageTasks = fixtureLoad.sessions.map((session) => {
    const actor = session.actors.find(({ sessionRoleId }) => sessionRoleId === "white_cell");
    return { actor, envelope: command(actor, "stage.start", session.sessionId, 0, { reason: "Synthetic load start" }) };
  });
  phase = "stage-entry";
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
  const acceptedCommandIds = [...steadyCommands, ...commandTasks].map(({ envelope }) => envelope.commandId);
  const integrity = (await pool.query(`SELECT
    (SELECT count(*)::int FROM runtime.participants WHERE session_id=ANY($1::uuid[])) AS participants,
    (SELECT count(*)::int FROM runtime.artifact_instances WHERE session_id=ANY($1::uuid[]) AND artifact_type_key='note') AS notes,
    (SELECT count(*)::int FROM runtime.message_recipients WHERE session_id=ANY($1::uuid[])) AS message_recipients,
    (SELECT count(*)::int FROM runtime.inject_recipient_states WHERE session_id=ANY($1::uuid[])) AS inject_recipients,
    (SELECT count(*)::int FROM sync.command_receipts WHERE command_id=ANY($2::uuid[])) AS receipts,
    (SELECT count(*)::int FROM evidence.events WHERE command_id=ANY($2::uuid[])) AS events,
    (SELECT count(*)::int FROM sync.session_delta_outbox item JOIN evidence.events event ON event.id=item.event_id
      WHERE event.command_id=ANY($2::uuid[])) AS outbox_rows,
    (SELECT count(*)::int FROM sync.command_receipts receipt
      LEFT JOIN evidence.events event ON event.session_id=receipt.session_id AND event.sequence=receipt.evidence_sequence
      LEFT JOIN sync.session_delta_outbox item ON item.event_id=event.id
      WHERE receipt.command_id=ANY($2::uuid[]) AND (event.id IS NULL OR item.id IS NULL)) AS outcome_mismatches,
    (SELECT count(*)::int FROM (SELECT session_id FROM evidence.events WHERE command_id=ANY($2::uuid[])
      GROUP BY session_id HAVING max(sequence)-min(sequence)+1<>count(*)) gaps) AS sequence_gaps`,
  [sessionIds, acceptedCommandIds])).rows[0];
  assert.deepEqual(integrity, {
    participants: config.sessions * config.participantsPerSession,
    notes: acceptedCommandIds.length,
    message_recipients: config.sessions * config.participantsPerSession,
    inject_recipients: config.sessions * config.participantsPerSession,
    receipts: acceptedCommandIds.length,
    events: acceptedCommandIds.length,
    outbox_rows: acceptedCommandIds.length,
    outcome_mismatches: 0,
    sequence_gaps: 0
  });

  const databaseRecovery = await observeDatabaseRecovery(pool);
  const authorActor = fixtureLoad.sessions[0].actors.find(({ personId }) => personId === fixture.people.author);
  const applicationRestart = await observeApplicationRestart(authorActor).catch((error) => ({
    status: "FAILED", milliseconds: null, injectedFailure: "Runtime process restart",
    error: error instanceof Error ? error.message : "Unknown Runtime restart failure"
  }));
  const saturation = await stopSampler();
  const bytesAfter = await databaseSize(pool);
  return {
    contractId: "load-profile-v1", profile: "application", testId: "SYNC-15",
    status: applicationRestart.status === "RECOVERED" ? "MEASURED" : "FAIL",
    generatedAt: new Date().toISOString(), environment: await environment(pool),
    conditions: { seed: config.seed, sessions: config.sessions, participantsPerSession: config.participantsPerSession,
      actorMix: "one Control actor plus Scribe/Facilitator/Notetaker Participants from the Release",
      soakEnabled, warmupSeconds, steadyStateSeconds, warmupProjections: warmup.length,
      steadyStateProjections: steady.filter(({ value }) => value?.kind === "projection").length,
      steadyStateCommands: steadyCommands.length, reconnects: reconnect.length, commands: commandTasks.length,
      broadcasts: broadcasts.length, stageEntryInjects: stageTasks.length, concurrency: config.application.concurrency,
      reconnectWindowSeconds: config.application.reconnectWindowSeconds,
      commandWindowSeconds: config.application.commandWindowSeconds },
    latencyMs: { reconnectSnapshot: latencyMetric(reconnect), commandReceipt: latencyMetric(commandBurst),
      broadcastFanout: latencyMetric(broadcastResults), stageEntryInjectFanout: latencyMetric(stageResults),
      ...(soakEnabled ? { warmupProjection: latencyMetric(warmup),
        steadyProjection: latencyMetric(steady.filter(({ value }) => value?.kind === "projection")),
        steadyCommandReceipt: latencyMetric(steady.filter(({ value }) => value?.kind === "command")) } : {}) },
    integrity: { ...integrity, duplicateReplaySharedReceipt: replay.replayed, unauthorizedProjectionError: unauthorizedCode,
      lostAcceptedEffects: 0, duplicateAcceptedEffects: 0 },
    failureRecovery: { databaseBackend: databaseRecovery, applicationRestart },
    saturation,
    cost: { wallSeconds: round((performance.now() - started) / 1000), databaseGrowthMiB: round((bytesAfter - bytesBefore) / 1024 ** 2), externalSpendUsd: 0 },
    acceptance: acceptance()
  };
}
