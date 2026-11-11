import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { Pool } from "pg";
import { requestFloor, releaseFloor, renewFloor, reconcileFloorPermissions, reconcileRevokedVoiceParticipants } from "../dist/index.js";

export async function verifyFloorRevocation(owner, floor, first, second) {
  const publishing = new Set(), calls = [];
  let failDisable = false, uncertainEnable = false, uncertainDisable = false, blockedEnable, blockedDisable;
  const adapter = { ...floor(first).mediaAdapter,
    async setTransmit({ participantId }, enabled) {
      calls.push([participantId, enabled, "start"]);
      const blocked = enabled ? blockedEnable : blockedDisable;
      if (blocked) { blocked.entered.resolve(); await blocked.resume.promise; }
      if (!enabled && failDisable) throw new Error("Synthetic disable failure");
      if (enabled) publishing.add(participantId); else publishing.delete(participantId);
      calls.push([participantId, enabled, "done"]);
      if (enabled && uncertainEnable) throw new Error("Synthetic timeout after possible provider success");
      if (!enabled && uncertainDisable) throw new Error("Synthetic timeout after provider disable");
    }
  };
  const make = (actor = first) => ({ ...floor(actor, randomUUID(), randomUUID(), "Synthetic preemption"), mediaAdapter: adapter });
  const probe = make();
  const row = async (input) => (await owner.query("SELECT * FROM comms.floor_leases WHERE request_id=$1", [input.input.requestId])).rows[0];
  const expire = (input) => owner.query("UPDATE comms.floor_leases SET expires_at=now()-interval '1 second' WHERE request_id=$1", [input.input.requestId]);
  const retryDue = () => owner.query("UPDATE comms.floor_leases SET provider_retry_at=now()-interval '1 second' WHERE channel_id=$1", [probe.channelId]);
  const reconcile = (pool = probe.pool, deployment = probe.deploymentId) => reconcileFloorPermissions(pool, first.organizationId, deployment, adapter);
  const tokenInput = (input, lease) => ({ ...input, input: { ...input.input, floorToken: lease.floorToken } });
  const mediaUnavailable = (error) => error?.envelope?.error?.code === "MEDIA_UNAVAILABLE";
  const barrier = () => ({ entered: Promise.withResolvers(), resume: Promise.withResolvers() });

  // T01: no subsequent Floor request or cooperative client mute.
  const expired = make();
  await requestFloor(expired);
  await expire(expired);
  assert.equal((await reconcile()).unresolved, 0);
  assert.equal(publishing.size, 0);
  assert.equal((await row(expired)).provider_state, "disabled");
  assert.equal((await owner.query("SELECT 1 FROM evidence.events WHERE causation_id=$1 AND event_type='floor_lease.expired'", [expired.input.requestId])).rowCount, 1);

  // A lost disable acknowledgement remains uncertain even when the provider applied it.
  const uncertainExpiry = make();
  await requestFloor(uncertainExpiry);
  await expire(uncertainExpiry);
  uncertainDisable = true;
  assert.equal((await reconcile()).unresolved, 1);
  assert.equal(publishing.size, 0);
  assert.equal((await row(uncertainExpiry)).provider_state, "pending_disable");
  await assert.rejects(requestFloor(make(second)), mediaUnavailable);
  uncertainDisable = false;
  await retryDue();
  assert.equal((await reconcile()).unresolved, 0);
  assert.equal((await row(uncertainExpiry)).provider_state, "disabled");

  const released = make(), releasedLease = await requestFloor(released);
  failDisable = true;
  await assert.rejects(releaseFloor(tokenInput(released, releasedLease)), mediaUnavailable);
  const pending = await row(released);
  assert.equal(pending.active, false);
  assert.equal(pending.provider_state, "pending_disable");
  assert.equal(pending.provider_attempts, 1);
  const attempted = calls.length;
  await assert.rejects(requestFloor(make(second)), mediaUnavailable);
  assert.equal(calls.length, attempted, "request traffic cannot bypass durable retry backoff");
  assert.deepEqual([...publishing], [first.participantId]);
  const restarted = new Pool({ connectionString: owner.options.connectionString, max: 4 });
  try {
    await retryDue();
    assert.equal((await reconcile(restarted)).unresolved, 1);
    assert.equal((await row(released)).provider_attempts, 2);
    failDisable = false;
    await retryDue();
    const provider = createServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      try { await adapter.setTransmit(JSON.parse(Buffer.concat(chunks).toString()), false); response.writeHead(204); }
      catch { response.writeHead(503); }
      response.end();
    }).listen(0, "127.0.0.1");
    await once(provider, "listening");
    const child = spawn(process.execPath, ["--input-type=module", "-e", `
      import { Pool } from 'pg';
      import { reconcileFloorPermissions } from './apps/server/dist/index.js';
      const pool = new Pool({ connectionString: process.env.BA04_DATABASE_URL });
      try {
        const result = await reconcileFloorPermissions(pool, process.env.BA04_ORGANIZATION, process.env.BA04_DEPLOYMENT, {
          digest: process.env.BA04_DIGEST,
          async setTransmit(target, enabled) {
            if (enabled) throw new Error('A recovery worker must never enable');
            const response = await fetch(process.env.BA04_PROVIDER, { method: 'POST', body: JSON.stringify(target) });
            if (!response.ok) throw new Error('Synthetic provider failed');
          }
        });
        if (result.unresolved !== 0) process.exitCode = 1;
      } finally { await pool.end(); }
    `], { windowsHide: true, stdio: "ignore", env: { ...process.env, BA04_DATABASE_URL: owner.options.connectionString,
      BA04_ORGANIZATION: first.organizationId, BA04_DEPLOYMENT: probe.deploymentId, BA04_DIGEST: adapter.digest,
      BA04_PROVIDER: `http://127.0.0.1:${provider.address().port}` } });
    try { assert.equal((await once(child, "exit", { signal: AbortSignal.timeout(15_000) }))[0], 0); }
    finally { if (child.exitCode === null) child.kill(); provider.closeAllConnections(); await new Promise((resolve) => provider.close(resolve)); }
    assert.equal(publishing.size, 0);
    assert.equal((await row(released)).provider_state, "disabled");
  } finally { await restarted.end(); }

  // The old disable finishes before the same participant's new lease can enable.
  const old = make(), oldLease = await requestFloor(old);
  blockedDisable = barrier();
  const release = releaseFloor(tokenInput(old, oldLease));
  await blockedDisable.entered.promise;
  const successor = make(), successorPromise = requestFloor(successor);
  blockedDisable.resume.resolve();
  await release;
  blockedDisable = undefined;
  const successorLease = await successorPromise;
  assert.equal(successorLease.status, "granted");
  assert.deepEqual([...publishing], [first.participantId]);
  const callsBeforeRetry = calls.length;
  await reconcile();
  assert.equal(calls.length, callsBeforeRetry, "completed disables never replay against a newer valid lease");
  const renewed = await renewFloor(tokenInput(successor, successorLease));
  await reconcile();
  assert.equal((await row(successor)).provider_state, "enabled");
  assert.ok(new Date(renewed.expiresAt) >= new Date(successorLease.expiresAt));
  await expire(successor);
  const boundary = await Promise.allSettled([renewFloor(tokenInput(successor, renewed)), reconcile()]);
  assert.equal(boundary[0].status, "rejected");
  assert.equal(publishing.size, 0);

  uncertainEnable = true; failDisable = true;
  const uncertain = make();
  await assert.rejects(requestFloor(uncertain), mediaUnavailable);
  assert.equal((await row(uncertain)).provider_state, "pending_disable");
  assert.equal((await row(uncertain)).active, false);
  uncertainEnable = false; failDisable = false;
  await retryDue(); await reconcile();
  assert.equal(publishing.size, 0);

  // New worker recovers a process lost after reservation or provider enable.
  const interrupted = make();
  await requestFloor(interrupted);
  await owner.query("UPDATE comms.floor_leases SET provider_state='pending_enable' WHERE request_id=$1", [interrupted.input.requestId]);
  await reconcile();
  assert.equal(publishing.size, 0);
  assert.equal((await row(interrupted)).active, false);

  blockedEnable = barrier();
  const racing = make(), enabling = requestFloor(racing);
  await blockedEnable.entered.promise;
  await expire(racing);
  blockedEnable.resume.resolve();
  await assert.rejects(enabling, mediaUnavailable);
  blockedEnable = undefined;
  assert.equal(publishing.size, 0);

  const fenced = make(), fencedLease = await requestFloor(fenced);
  await owner.query("UPDATE runtime.session_authorities SET authority_epoch=2 WHERE organization_id=$1 AND session_id=$2", [first.organizationId, first.sessionId]);
  await assert.rejects(renewFloor(tokenInput(fenced, fencedLease)), (error) => error?.envelope?.error?.code === "AUTHORITY_UNAVAILABLE");
  assert.equal((await reconcile(undefined, randomUUID())).checked, 0);
  await reconcile();
  assert.equal(publishing.size, 0);
  await owner.query("UPDATE runtime.session_authorities SET authority_epoch=1 WHERE organization_id=$1 AND session_id=$2", [first.organizationId, first.sessionId]);
  assert.equal((await reconcileFloorPermissions(probe.pool, randomUUID(), probe.deploymentId, adapter)).checked, 0);
  const final = make(), finalLease = await requestFloor(final);
  await releaseFloor(tokenInput(final, finalLease));
  // PostgreSQL revocations retain microseconds; acknowledgement must match that exact revision.
  const grant = (await owner.query(`SELECT id,revoked_at::text,provider_revoked_at::text FROM comms.voice_grants
    WHERE organization_id=$1 AND channel_id=$2 AND participant_id=$3`,
  [first.organizationId, probe.channelId, first.participantId])).rows[0];
  assert.ok(grant);
  try {
    for (const replacement of [undefined, "2040-01-01 00:00:00.123789+00", null]) {
      await owner.query(`UPDATE comms.voice_grants SET revoked_at='2040-01-01 00:00:00.123456+00',
        provider_revoked_at=NULL WHERE id=$1`, [grant.id]);
      let removals = 0;
      const expectedRemovals = typeof replacement === "string" ? 2 : 1;
      const removing = { ...adapter, async removeParticipant() {
        assert.ok(++removals <= expectedRemovals, "acknowledgement must drain instead of retrying the same revision forever");
        assert.equal((await owner.query("SELECT provider_revoked_at FROM comms.voice_grants WHERE id=$1", [grant.id])).rows[0].provider_revoked_at,
          null, "a stale acknowledgement must not mark a newer revocation complete");
        if (removals === 1 && replacement !== undefined) {
          await owner.query("UPDATE comms.voice_grants SET revoked_at=$2 WHERE id=$1", [grant.id, replacement]);
        }
      } };
      await reconcileRevokedVoiceParticipants(probe.pool, first, removing);
      assert.equal(removals, expectedRemovals);
      const acknowledged = (await owner.query("SELECT provider_revoked_at FROM comms.voice_grants WHERE id=$1", [grant.id])).rows[0].provider_revoked_at;
      assert.equal(acknowledged !== null, replacement !== null);
      await reconcileRevokedVoiceParticipants(probe.pool, first, removing);
      assert.equal(removals, expectedRemovals, "completed or superseded revocations are not replayed");
    }
  } finally {
    await owner.query("UPDATE comms.voice_grants SET revoked_at=$2,provider_revoked_at=$3 WHERE id=$1",
      [grant.id, grant.revoked_at, grant.provider_revoked_at]);
  }
  console.log("BA-04 revocation acknowledgement PASS: microseconds preserved, changed revision retried, rejoin not acknowledged as revoked");
  console.log("BA-04-T01/T02/T03 PASS: expiry, durable failed release, restart, ambiguous enable, renewal, delayed disable, authority fencing");
}
