import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { canonicalizeJson } from "../../packages/event-contracts/dist/index.js";
import { buildEvidenceCheckpoint, createAwsEvidenceAdapters, evidenceCheckpointDue, verifyEvidenceExport } from "../../apps/server/dist/index.js";

const sessionId = "60000000-0000-4000-8000-000000000001";

test('BA-10 AWS adapter pins signing identity and rejects mutable or conflicting anchor storage', async () => {
  const pair = generateKeyPairSync('ed25519'), keyArn = 'arn:aws:kms:us-east-1:123456789012:key/synthetic';
  const options = { keyArn, trustedPublicKey: pair.publicKey.export({ format: 'jwk' }), bucket: 'independent-fixture',
    bucketOwner: '987654321098', prefix: 'checkpoints',
    kms: { async send(command) {
      assert.equal(command.input.MessageType, 'RAW'); assert.equal(command.input.SigningAlgorithm, 'ED25519_SHA_512');
      return { KeyId: 'unexpected-key', SigningAlgorithm: 'ED25519_SHA_512', Signature: Buffer.alloc(64) };
    } }, s3: null };
  let storedBody, immutable = false, conflict = false;
  options.s3 = { async send(command) {
    assert.equal(command.input.ExpectedBucketOwner, options.bucketOwner);
    if (command.constructor.name === 'PutObjectCommand') {
      assert.equal(command.input.IfNoneMatch, '*'); assert.equal(command.input.ObjectLockMode, 'COMPLIANCE');
      storedBody = command.input.Body;
      throw Object.assign(new Error('already anchored'), { $metadata: { httpStatusCode: 412 } });
    }
    return { VersionId: 'immutable-version', ContentLength: storedBody.length,
      ObjectLockMode: immutable ? 'COMPLIANCE' : 'GOVERNANCE', ObjectLockRetainUntilDate: new Date('2040-01-01'),
      Body: { async transformToByteArray() { return Buffer.from(conflict ? '{}' : storedBody); }, destroy() {} } };
  } };
  const adapters = createAwsEvidenceAdapters(options);
  await assert.rejects(adapters.signer.signCheckpoint({ checkpointId: sessionId, checkpointDigest: 'a'.repeat(64), digestBytes: Buffer.alloc(32) }), /signing key/);
  const input = { idempotencyKey: sessionId, checkpointId: sessionId, sessionId, firstSequence: 1, lastSequence: 2,
    checkpointDigest: 'a'.repeat(64), checkpointCreatedAt: '2026-01-01T00:00:00.000Z', keyId: keyArn };
  await assert.rejects(adapters.anchor.anchorCheckpoint(input), /Unprotected/);
  immutable = true; conflict = true;
  await assert.rejects(adapters.anchor.anchorCheckpoint(input), /Conflicting/);
  conflict = false;
  assert.equal((await adapters.anchor.anchorCheckpoint(input)).verificationResult, 'verified');
  assert.throws(() => createAwsEvidenceAdapters({ ...options, trustedPublicKey: pair.privateKey.export({ format: 'jwk' }) }), /Invalid approved/);
});

test("SYNC-13 applies the five-minute, 1,000-event, and Session-close cadence", () => {
  const oldest = new Date("2026-10-23T00:00:00.000Z");
  assert.equal(evidenceCheckpointDue(999, oldest, "active", new Date("2026-10-23T00:04:59.999Z")), false);
  assert.equal(evidenceCheckpointDue(999, oldest, "active", new Date("2026-10-23T00:05:00.000Z")), true);
  assert.equal(evidenceCheckpointDue(1_000, oldest, "active", oldest), true);
  assert.equal(evidenceCheckpointDue(1, oldest, "completed", oldest), true);
});

function proof(sequence) {
  return {
    id: `10000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    sequence,
    eventType: "artifact.submitted",
    eventVersion: 1,
    commandId: null,
    actorPersonId: null,
    actorParticipantId: null,
    governingReleaseId: "50000000-0000-4000-8000-000000000001",
    authorityEpoch: 1,
    correlationId: null,
    causationId: null,
    aggregateId: null,
    aggregateVersion: sequence,
    occurredAt: `2026-10-23T00:0${sequence}:00.000Z`,
    recordedAt: `2026-10-23T00:0${sequence}:01.000Z`,
    bodyDigest: createHash("sha256").update(canonicalizeJson({ sequence })).digest("hex")
  };
}

function signedBundle(events, previousCheckpointDigest, keyId, pair, endpoint) {
  const checkpoint = buildEvidenceCheckpoint(sessionId, events, previousCheckpointDigest);
  const publicKeyJwk = pair.publicKey.export({ format: "jwk" });
  const reference = `${endpoint}/${checkpoint.checkpointId}`;
  return {
    bundle: {
      checkpoint,
      events,
      signature: {
        keyId,
        algorithm: "Ed25519",
        signature: sign(null, Buffer.from(checkpoint.checkpointDigest, "hex"), pair.privateKey).toString("base64"),
        publicKeyJwk,
        signedAt: checkpoint.createdAt
      },
      anchorReceipts: [{
        endpoint,
        reference,
        anchoredDigest: checkpoint.checkpointDigest,
        keyId,
        verificationResult: "verified",
        recordedAt: checkpoint.createdAt
      }]
    },
    key: publicKeyJwk,
    anchor: { endpoint, reference, anchoredDigest: checkpoint.checkpointDigest, keyId }
  };
}

function fixture() {
  const firstKey = generateKeyPairSync("ed25519");
  const secondKey = generateKeyPairSync("ed25519");
  const first = signedBundle([proof(1), proof(2)], null, "kms/evidence/2026-a", firstKey, "custodian-a");
  const second = signedBundle([proof(3), proof(4)], first.bundle.checkpoint.checkpointDigest,
    "kms/evidence/2027-a", secondKey, "custodian-a");
  return {
    exported: {
      contractId: "verification-export-v1",
      sessionId,
      generatedAt: "2026-10-23T01:00:00.000Z",
      lastEvidenceSequence: 4,
      checkpoints: [first.bundle, second.bundle]
    },
    keys: { "kms/evidence/2026-a": first.key, "kms/evidence/2027-a": second.key },
    anchors: [first.anchor, second.anchor]
  };
}

test("PS-510-T01 verifies a complete chain across signing-key rotation", () => {
  const { exported, keys, anchors } = fixture();
  assert.deepEqual(verifyEvidenceExport(exported, keys, anchors), { verified: true, issues: [] });
  assert.notDeepEqual(keys["kms/evidence/2026-a"], keys["kms/evidence/2027-a"]);
});

test("PS-510-T02 rejects modified, missing, and reordered Evidence", () => {
  const source = fixture();
  const modified = structuredClone(source.exported);
  modified.checkpoints[0].events[0].bodyDigest = "f".repeat(64);
  assert.ok(verifyEvidenceExport(modified, source.keys, source.anchors).issues.some((value) => value.startsWith("CHECKPOINT_DIGEST_MISMATCH")));

  const missing = structuredClone(source.exported);
  missing.checkpoints[0].events.splice(0, 1);
  assert.ok(verifyEvidenceExport(missing, source.keys, source.anchors).issues.some((value) => value.startsWith("MISSING_OR_REORDERED_EVENT")));

  const reordered = structuredClone(source.exported);
  reordered.checkpoints[0].events.reverse();
  assert.ok(verifyEvidenceExport(reordered, source.keys, source.anchors).issues.some((value) => value.startsWith("MISSING_OR_REORDERED_EVENT")));
});

test("PS-510-T02 requires separately supplied custodian evidence", () => {
  const { exported, keys } = fixture();
  const result = verifyEvidenceExport(exported, keys, []);
  assert.equal(result.verified, false);
  assert.ok(result.issues.every((value) => value.startsWith("MISSING_INDEPENDENT_ANCHOR")));
});

test("PS-510-T02 detects a removed final checkpoint through the custodian record", () => {
  const { exported, keys, anchors } = fixture();
  exported.checkpoints.pop();
  exported.lastEvidenceSequence = 2;
  const result = verifyEvidenceExport(exported, keys, anchors);
  assert.equal(result.verified, false);
  assert.ok(result.issues.includes("UNMATCHED_INDEPENDENT_ANCHOR"));
});

test("CMD-EVIDENCE-VERIFY reads a restored offline export and separate trust files", async () => {
  const { exported, keys, anchors } = fixture();
  const directory = await mkdtemp(join(tmpdir(), "plenum-evidence-"));
  try {
    const paths = ["export.json", "keys.json", "anchors.json"].map((name) => join(directory, name));
    await Promise.all([
      writeFile(paths[0], JSON.stringify(exported)),
      writeFile(paths[1], JSON.stringify(keys)),
      writeFile(paths[2], JSON.stringify(anchors))
    ]);
    const output = execFileSync(process.execPath, ["scripts/verify-evidence.mjs", ...paths], { encoding: "utf8" });
    assert.deepEqual(JSON.parse(output), { verified: true, issues: [] });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
