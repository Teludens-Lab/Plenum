import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

import { requestFloor } from "../../apps/server/dist/index.js";
import {
  acceptance, actorContext, config, databaseSize, environment, fixture, latencyMetric, observeDatabaseRecovery,
  performance, randomUUID, round, runConcurrent, seedReferenceWorkload, stableUuid, startSaturationSampler
} from "./load-support.mjs";

const mediaImage = "livekit/livekit-server:v1.13.10@sha256:89ca9ce0791e18d6e03bf6e2c49ceb27e1c754eae8bd50c989386c1a5963791a";
const adapter = {
  id: "load-fixture", version: "1", digest: `sha256:${"e".repeat(64)}`,
  async issueCredential() { throw new Error("not used"); },
  async setTransmit() {}, async removeParticipant() {}, async closeChannel() {}, async health() { return "available"; }
};

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function startMedia(name) {
  run("docker", ["run", "--detach", "--rm", "--name", name, "-p", "17880:7880", "-p", "17881:7881", "-p", "17882:7882/udp",
    mediaImage, "--dev", "--bind", "0.0.0.0", "--node-ip", "127.0.0.1", "--udp-port", "7882"]);
}

async function waitForMedia() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      await fetch("http://127.0.0.1:17880");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error("LiveKit did not become ready");
}

function mediaLoad(lk, durationSeconds, room) {
  const started = performance.now();
  const output = run(lk, ["perf", "load-test", "--url", "http://127.0.0.1:17880", "--dev", "--room", room,
    "--duration", `${durationSeconds}s`, "--audio-publishers", String(config.voice.mediaRoom.activeSpeakers),
    "--subscribers", String(config.voice.mediaRoom.listeners), "--num-per-second", "100"]);
  const losses = [...output.matchAll(/\((\d+(?:\.\d+)?)%\)/gu)].map((match) => Number(match[1]));
  assert.equal(output.includes("Error"), true);
  return { ok: true, milliseconds: performance.now() - started, output,
    packetLossPercent: losses.length === 0 ? null : Math.max(...losses) };
}

async function measureMedia() {
  const lk = process.env.PLENUM_LK_PATH ?? path.join(os.tmpdir(), "plenum-lk-2.19.2", "lk.exe");
  const name = `plenum-ps540-livekit-${process.pid}`;
  try {
    startMedia(name);
    await waitForMedia();
    const primary = mediaLoad(lk, config.voice.mediaRoom.durationSeconds, "ps540-media-primary");
    run("docker", ["stop", name]);
    const recoveryStarted = performance.now();
    startMedia(name);
    await waitForMedia();
    const recovered = mediaLoad(lk, 3, "ps540-media-recovery");
    return { primary, recovered, restartMilliseconds: round(performance.now() - recoveryStarted),
      cli: "livekit-cli v2.19.2", image: mediaImage };
  } finally {
    spawnSync("docker", ["stop", name], { encoding: "utf8", windowsHide: true });
  }
}

export async function runVoiceProfile(pool) {
  const started = performance.now();
  const bytesBefore = await databaseSize(pool);
  const workload = await seedReferenceWorkload(pool);
  const stopSampler = startSaturationSampler(pool);
  const grants = workload.sessions.flatMap((session) => session.actors.map((actor) => ({ ...actor, channelId: session.radioChannelId })));
  await pool.query(`INSERT INTO comms.voice_grants
    (id,organization_id,session_id,channel_id,seat_assignment_id,participant_id,can_listen,can_transmit,can_moderate,
     valid_until,policy_revision,access_revision,authority_epoch)
    SELECT ids.id,$1,ids.session_id,ids.channel_id,ids.assignment_id,ids.participant_id,true,true,false,
      '2099-01-01T00:00:00Z',1,1,1
    FROM unnest($2::uuid[],$3::uuid[],$4::uuid[],$5::uuid[],$6::uuid[]) AS ids(id,session_id,channel_id,assignment_id,participant_id)`,
  [fixture.organizationId, grants.map((grant, index) => stableUuid(`voice-grant-${index}`)), grants.map(({ sessionId }) => sessionId),
    grants.map(({ channelId }) => channelId), grants.map(({ assignmentId }) => assignmentId), grants.map(({ participantId }) => participantId)]);
  const floor = await runConcurrent(grants, config.voice.controlConcurrency, (actor, index) => requestFloor({
    pool, context: actorContext(actor), channelId: actor.channelId, deviceId: actor.deviceId,
    input: { requestId: stableUuid(`floor-request-${index}`), connectionId: stableUuid(`floor-connection-${index}`),
      expectedAuthorityEpoch: 1, reason: "Synthetic priority preemption" },
    correlationId: randomUUID(), deploymentId: fixture.deploymentId, tokenSecret: "ps540-local-only-floor-secret", mediaAdapter: adapter
  }));
  assert.equal(floor.every(({ ok }) => ok), true, floor.find(({ ok }) => !ok)?.error);
  assert.equal(floor.filter(({ value }) => value.status === "granted").length >= config.sessions, true);

  await pool.query(`UPDATE comms.floor_leases SET active=false,released_at=transaction_timestamp(),version=version+1
    WHERE organization_id=$1 AND active`, [fixture.organizationId]);
  const failedActor = grants[0];
  let providerFailure;
  try {
    await requestFloor({ pool, context: actorContext(failedActor), channelId: failedActor.channelId, deviceId: failedActor.deviceId,
      input: { requestId: randomUUID(), connectionId: randomUUID(), expectedAuthorityEpoch: 1 }, correlationId: randomUUID(),
      deploymentId: fixture.deploymentId, tokenSecret: "ps540-local-only-floor-secret",
      mediaAdapter: { ...adapter, async setTransmit() { throw new Error("injected provider failure"); } } });
  } catch (error) { providerFailure = error?.envelope?.error?.code; }
  assert.equal(providerFailure, "MEDIA_UNAVAILABLE");
  const media = await measureMedia();
  assert.equal(media.primary.packetLossPercent, 0);
  assert.equal(media.recovered.packetLossPercent, 0);

  const integrity = (await pool.query(`SELECT
    (SELECT count(*)::int FROM comms.voice_grants WHERE organization_id=$1) AS grants,
    (SELECT count(*)::int FROM comms.floor_requests WHERE organization_id=$1) AS requests,
    (SELECT count(*)::int FROM comms.floor_leases WHERE organization_id=$1 AND active) AS active_leases,
    (SELECT count(*)::int FROM evidence.events WHERE organization_id=$1 AND event_type='media_provider.unavailable') AS provider_failures`,
  [fixture.organizationId])).rows[0];
  assert.equal(integrity.grants, grants.length);
  assert.equal(integrity.active_leases, 0);
  assert.equal(integrity.provider_failures, 1);
  const databaseRecovery = await observeDatabaseRecovery(pool);
  const saturation = await stopSampler();
  const bytesAfter = await databaseSize(pool);
  return {
    contractId: "load-profile-v1", profile: "voice", testId: "VOICE-12", status: "MEASURED",
    generatedAt: new Date().toISOString(), environment: await environment(pool),
    conditions: { seed: config.seed, sessions: config.sessions, floorRequests: floor.length,
      controlConcurrency: config.voice.controlConcurrency, mediaRooms: config.voice.mediaRoom.rooms,
      mediaListeners: config.voice.mediaRoom.listeners, activeSpeakers: config.voice.mediaRoom.activeSpeakers,
      mediaDurationSeconds: config.voice.mediaRoom.durationSeconds, mediaCli: media.cli, mediaImage: media.image,
      network: "local loopback; no TURN relay or WAN impairment" },
    latencyMs: { floorRequest: latencyMetric(floor), mediaProfile: latencyMetric([media.primary]),
      mediaAfterRestart: latencyMetric([media.recovered]) },
    integrity: { ...integrity, mediaPacketLossPercent: media.primary.packetLossPercent,
      mediaAfterRestartPacketLossPercent: media.recovered.packetLossPercent, providerFailure,
      mediaOutputSha256: createHash("sha256").update(media.primary.output).digest("hex") },
    failureRecovery: { databaseBackend: databaseRecovery,
      mediaServerRestart: { status: "RECOVERED", milliseconds: media.restartMilliseconds, injectedFailure: "LiveKit container restart" } },
    saturation,
    cost: { wallSeconds: round((performance.now() - started) / 1000), databaseGrowthMiB: round((bytesAfter - bytesBefore) / 1024 ** 2), externalSpendUsd: 0 },
    acceptance: acceptance()
  };
}
