import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { canonicalizeJson } from "../../packages/event-contracts/dist/index.js";
import { buildEvidenceCheckpoint, evidenceCheckpointDue, verifyEvidenceExport } from "../../apps/server/dist/index.js";

const sessionId = "60000000-0000-4000-8000-000000000001";

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
