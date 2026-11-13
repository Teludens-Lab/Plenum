import { createHash, createPublicKey, randomUUID, verify as verifySignature, type JsonWebKey as CryptoJsonWebKey } from "node:crypto";
import {
  CHECKPOINT_CONTRACT_ID,
  VERIFICATION_EXPORT_CONTRACT_ID,
  canonicalizeJson,
  type EvidenceAnchorReceiptV1,
  type EvidenceCheckpointSignatureV1,
  type EvidenceCheckpointV1,
  type EvidenceProofEventV1,
  type JsonObject,
  type JsonValue,
  type VerificationCheckpointV1,
  type VerificationExportV1
} from "@plenum/event-contracts";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import { assertOrganizationJobAuthority, type OrganizationJobAuthority } from "../operations/job-authority.js";

const sha256Pattern = /^[0-9a-f]{64}$/u;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const checkpointIntervalMs = 5 * 60 * 1_000;
const checkpointEventLimit = 1_000;

interface EvidenceEventRow {
  id: string;
  sequence: string | number;
  event_type: string;
  event_version: number;
  command_id: string | null;
  actor_person_id: string | null;
  actor_participant_id: string | null;
  governing_release_id: string;
  authority_epoch: string | number;
  correlation_id: string | null;
  causation_id: string | null;
  aggregate_id: string | null;
  aggregate_version: string | number | null;
  occurred_at: Date;
  recorded_at: Date;
  body: JsonValue;
}

export interface EvidenceSigner {
  signCheckpoint(input: {
    checkpointId: string;
    checkpointDigest: string;
    digestBytes: Uint8Array;
  }, signal?: AbortSignal): Promise<{ keyId: string; algorithm: "Ed25519"; signature: Uint8Array; publicKeyJwk: JsonObject }>;
}

export interface EvidenceAnchor {
  anchorCheckpoint(input: {
    idempotencyKey: string;
    checkpointId: string;
    sessionId: string;
    firstSequence: number;
    lastSequence: number;
    checkpointDigest: string;
    checkpointCreatedAt: string;
    keyId: string;
  }, signal?: AbortSignal): Promise<{
    endpoint: string;
    reference: string;
    anchoredDigest: string;
    verificationResult: "pending" | "verified" | "failed";
    recordedAt: Date;
  }>;
}

export interface IndependentAnchorV1 {
  endpoint: string;
  reference: string;
  anchoredDigest: string;
  keyId: string;
}

export interface VerificationResult {
  verified: boolean;
  issues: string[];
}

export function evidenceCheckpointDue(
  eventCount: number,
  oldestRecordedAt: Date,
  sessionStatus: string,
  now: Date
): boolean {
  return eventCount >= checkpointEventLimit ||
    now.getTime() - oldestRecordedAt.getTime() >= checkpointIntervalMs ||
    ["completed", "locked", "archived"].includes(sessionStatus);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeInteger(value: string | number | null, name: string): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${name} is outside the supported integer range`);
  return parsed;
}

function deterministicUuid(digest: string): string {
  const value = digest.slice(0, 32).split("");
  value[12] = "5";
  value[16] = "8";
  return `${value.slice(0, 8).join("")}-${value.slice(8, 12).join("")}-${value.slice(12, 16).join("")}-${value.slice(16, 20).join("")}-${value.slice(20).join("")}`;
}

export function evidenceProofEvent(row: EvidenceEventRow): EvidenceProofEventV1 {
  return {
    id: row.id,
    sequence: safeInteger(row.sequence, "Evidence sequence") as number,
    eventType: row.event_type,
    eventVersion: row.event_version,
    commandId: row.command_id,
    actorPersonId: row.actor_person_id,
    actorParticipantId: row.actor_participant_id,
    governingReleaseId: row.governing_release_id,
    authorityEpoch: safeInteger(row.authority_epoch, "Evidence authority epoch") as number,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    aggregateId: row.aggregate_id,
    aggregateVersion: safeInteger(row.aggregate_version, "Evidence aggregate version"),
    occurredAt: row.occurred_at.toISOString(),
    recordedAt: row.recorded_at.toISOString(),
    bodyDigest: sha256(canonicalizeJson(row.body))
  };
}

function eventDigest(event: EvidenceProofEventV1): string {
  return sha256(canonicalizeJson(event));
}

function merkleRoot(events: EvidenceProofEventV1[]): string {
  if (events.length === 0) throw new Error("A checkpoint requires at least one Evidence Event");
  let level = events.map(eventDigest);
  while (level.length > 1) {
    const next: string[] = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index] as string;
      const right = level[index + 1] ?? left;
      next.push(sha256(Buffer.concat([Buffer.from(left, "hex"), Buffer.from(right, "hex")])));
    }
    level = next;
  }
  return level[0] as string;
}

function checkpointPayload(checkpoint: JsonObject): JsonObject {
  return { ...checkpoint };
}

export function buildEvidenceCheckpoint(
  sessionId: string,
  events: EvidenceProofEventV1[],
  previousCheckpointDigest: string | null,
  createdAt = events.at(-1)?.recordedAt
): EvidenceCheckpointV1 {
  if (!uuidPattern.test(sessionId) || createdAt === undefined || Number.isNaN(Date.parse(createdAt))) {
    throw new Error("A valid Session and checkpoint timestamp are required");
  }
  for (let index = 0; index < events.length; index += 1) {
    const expected = (events[0]?.sequence ?? 0) + index;
    if (events[index]?.sequence !== expected) throw new Error(`Evidence sequence ${expected} is missing or reordered`);
  }
  if (previousCheckpointDigest !== null && !sha256Pattern.test(previousCheckpointDigest)) {
    throw new Error("The previous checkpoint digest is invalid");
  }
  const firstSequence = events[0]?.sequence;
  const lastSequence = events.at(-1)?.sequence;
  if (firstSequence === undefined || lastSequence === undefined) throw new Error("A checkpoint requires Evidence Events");
  const unsigned = {
    contractId: CHECKPOINT_CONTRACT_ID,
    sessionId,
    firstSequence,
    lastSequence,
    previousCheckpointDigest,
    batchMerkleRoot: merkleRoot(events),
    canonicalization: "plenum-evidence-v1" as const,
    algorithm: "sha256" as const,
    createdAt
  } as const satisfies JsonObject;
  const checkpointDigest = sha256(canonicalizeJson(checkpointPayload(unsigned)));
  return {
    contractId: unsigned.contractId,
    checkpointId: deterministicUuid(checkpointDigest),
    sessionId: unsigned.sessionId,
    firstSequence: unsigned.firstSequence,
    lastSequence: unsigned.lastSequence,
    previousCheckpointDigest: unsigned.previousCheckpointDigest,
    batchMerkleRoot: unsigned.batchMerkleRoot,
    canonicalization: unsigned.canonicalization,
    algorithm: unsigned.algorithm,
    checkpointDigest,
    createdAt: unsigned.createdAt
  };
}

function issue(issues: string[], code: string, checkpoint?: EvidenceCheckpointV1): void {
  issues.push(checkpoint === undefined ? code : `${code}:${checkpoint.checkpointId}`);
}

export function verifyEvidenceExport(
  exported: VerificationExportV1,
  trustedPublicKeys: Readonly<Record<string, JsonObject>>,
  independentAnchors: readonly IndependentAnchorV1[]
): VerificationResult {
  const issues: string[] = [];
  const usedAnchors = new Set<number>();
  if (exported.contractId !== VERIFICATION_EXPORT_CONTRACT_ID || !uuidPattern.test(exported.sessionId)) {
    issue(issues, "INVALID_EXPORT");
    return { verified: false, issues };
  }
  let expectedSequence = 1;
  let previousDigest: string | null = null;
  for (const bundle of exported.checkpoints) {
    const checkpoint = bundle.checkpoint;
    if (checkpoint.sessionId !== exported.sessionId || checkpoint.firstSequence !== expectedSequence) {
      issue(issues, "MISSING_OR_REORDERED_RANGE", checkpoint);
    }
    if (checkpoint.previousCheckpointDigest !== previousDigest) issue(issues, "BROKEN_CHECKPOINT_CHAIN", checkpoint);
    if (bundle.events.length !== checkpoint.lastSequence - checkpoint.firstSequence + 1 ||
        bundle.events.some((event, index) => event.sequence !== checkpoint.firstSequence + index)) {
      issue(issues, "MISSING_OR_REORDERED_EVENT", checkpoint);
    }
    try {
      const rebuilt = buildEvidenceCheckpoint(exported.sessionId, bundle.events, previousDigest, checkpoint.createdAt);
      if (rebuilt.checkpointDigest !== checkpoint.checkpointDigest || rebuilt.checkpointId !== checkpoint.checkpointId ||
          rebuilt.batchMerkleRoot !== checkpoint.batchMerkleRoot || rebuilt.contractId !== checkpoint.contractId ||
          rebuilt.firstSequence !== checkpoint.firstSequence || rebuilt.lastSequence !== checkpoint.lastSequence ||
          rebuilt.previousCheckpointDigest !== checkpoint.previousCheckpointDigest ||
          rebuilt.canonicalization !== checkpoint.canonicalization || rebuilt.algorithm !== checkpoint.algorithm) {
        issue(issues, "CHECKPOINT_DIGEST_MISMATCH", checkpoint);
      }
    } catch {
      issue(issues, "INVALID_CHECKPOINT_CONTENT", checkpoint);
    }
    const trustedKey = trustedPublicKeys[bundle.signature.keyId];
    if (trustedKey === undefined || canonicalizeJson(trustedKey) !== canonicalizeJson(bundle.signature.publicKeyJwk)) {
      issue(issues, "UNTRUSTED_SIGNING_KEY", checkpoint);
    } else {
      try {
        const valid = bundle.signature.algorithm === "Ed25519" && verifySignature(
          null,
          Buffer.from(checkpoint.checkpointDigest, "hex"),
          createPublicKey({ key: trustedKey as unknown as CryptoJsonWebKey, format: "jwk" }),
          Buffer.from(bundle.signature.signature, "base64")
        );
        if (!valid) issue(issues, "INVALID_SIGNATURE", checkpoint);
      } catch {
        issue(issues, "INVALID_SIGNATURE", checkpoint);
      }
    }
    const independentlyAnchored = bundle.anchorReceipts.some((receipt) => receipt.verificationResult === "verified" &&
      receipt.anchoredDigest === checkpoint.checkpointDigest && receipt.keyId === bundle.signature.keyId &&
      independentAnchors.some((anchor, index) => {
        const matches = anchor.endpoint === receipt.endpoint && anchor.reference === receipt.reference &&
          anchor.anchoredDigest === receipt.anchoredDigest && anchor.keyId === receipt.keyId;
        if (matches) usedAnchors.add(index);
        return matches;
      }));
    if (!independentlyAnchored) issue(issues, "MISSING_INDEPENDENT_ANCHOR", checkpoint);
    expectedSequence = checkpoint.lastSequence + 1;
    previousDigest = checkpoint.checkpointDigest;
  }
  if (independentAnchors.some((_, index) => !usedAnchors.has(index))) issue(issues, "UNMATCHED_INDEPENDENT_ANCHOR");
  if (expectedSequence - 1 !== exported.lastEvidenceSequence) issue(issues, "UNCHECKPOINTED_EVENTS");
  return { verified: issues.length === 0, issues };
}

async function currentAdmin(client: PoolClient, principal: AuthenticatedPrincipal, correlationId: string): Promise<void> {
  if (!principal.organizationRoles.includes("admin")) {
    throw authorizationError("PERMISSION_DENIED", "The Admin Organization Role is required.", correlationId);
  }
  const current = await client.query(
    `SELECT 1 FROM identity.authentication_sessions session
       JOIN identity.memberships membership
         ON membership.organization_id=session.organization_id AND membership.person_id=session.person_id
      WHERE session.organization_id=$1 AND session.id=$2 AND session.person_id=$3
        AND session.revoked_at IS NULL AND session.expires_at>transaction_timestamp()
        AND membership.organization_role='admin'
        AND identity.person_has_active_organization_access($1,$3)`,
    [principal.organizationId, principal.authenticationSessionId, principal.principalId]
  );
  if (current.rowCount !== 1) throw authorizationError("ACCESS_REVOKED", "Organization access is no longer active.", correlationId);
}

const eventColumns = `id,sequence,event_type,event_version,command_id,actor_person_id,actor_participant_id,
  governing_release_id,authority_epoch,correlation_id,causation_id,aggregate_id,aggregate_version,occurred_at,recorded_at,body`;

export interface CheckpointJobContext {
  authority: OrganizationJobAuthority;
  authorityEpoch: number;
  signal?: AbortSignal;
}

async function checkpointAuthority(client: PoolClient, organizationId: string, sessionId: string, context?: CheckpointJobContext) {
  if (!context) return;
  context.signal?.throwIfAborted();
  if (context.authority.organizationId !== organizationId) throw new Error("Checkpoint authority scope mismatch");
  await assertOrganizationJobAuthority(client, context.authority);
  const current = await client.query(`SELECT 1 FROM runtime.session_authorities
    WHERE organization_id=$1 AND session_id=$2 AND deployment_id=$3 AND authority_epoch=$4 AND status='active' FOR SHARE`,
  [organizationId, sessionId, context.authority.deploymentId, context.authorityEpoch]);
  if (current.rowCount !== 1) throw new Error("Checkpoint Session Authority is no longer current");
}

async function checkpointEffect<T>(operation: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(new Error("Checkpoint effect interrupted"));
  const timer = setTimeout(abort, 10_000);
  parent?.addEventListener("abort", abort, { once: true });
  if (parent?.aborted) abort();
  let rejectAbort: () => void = () => {};
  try {
    controller.signal.throwIfAborted();
    return await Promise.race([operation(controller.signal), new Promise<never>((_, reject) => {
      rejectAbort = () => reject(new Error("Checkpoint effect interrupted"));
      controller.signal.addEventListener("abort", rejectAbort, { once: true });
    })]);
  } finally {
    clearTimeout(timer); parent?.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", rejectAbort);
  }
}

export async function createDueEvidenceCheckpoint(
  pool: Pool,
  organizationId: string,
  sessionId: string,
  signer: EvidenceSigner | undefined,
  anchor: EvidenceAnchor | undefined,
  now = new Date(),
  context?: CheckpointJobContext
): Promise<EvidenceCheckpointV1 | null> {
  if (!uuidPattern.test(organizationId) || !uuidPattern.test(sessionId) || Number.isNaN(now.getTime())) {
    throw new Error("Valid Organization, Session, and checkpoint time values are required");
  }
  const leaseToken = randomUUID();
  const work = await withOrganizationTransaction(pool, organizationId, async (client) => {
    await checkpointAuthority(client, organizationId, sessionId, context);
    const session = await client.query<{ status: string }>(
      "SELECT status FROM runtime.sessions WHERE organization_id=$1 AND id=$2 FOR UPDATE", [organizationId, sessionId]);
    if (session.rows[0] === undefined) throw new Error("Session not found");
    const pending = (await client.query<{ checkpoint: EvidenceCheckpointV1; signature: EvidenceCheckpointSignatureV1 | null;
      retry_at: Date; leased: boolean | null }>(`SELECT *,lease_until>transaction_timestamp() AS leased FROM operations.evidence_checkpoint_work
      WHERE organization_id=$1 AND session_id=$2 FOR UPDATE`, [organizationId, sessionId])).rows[0];
    if (pending && (pending.retry_at > now || pending.leased)) return null;
    const previous = await client.query<{ last_sequence: string; checkpoint_digest: string }>(
      `SELECT last_sequence,checkpoint_digest FROM evidence.checkpoint_batches
        WHERE organization_id=$1 AND session_id=$2 ORDER BY last_sequence DESC LIMIT 1`, [organizationId, sessionId]);
    const firstSequence = Number(previous.rows[0]?.last_sequence ?? 0) + 1;
    const limit = pending ? pending.checkpoint.lastSequence - firstSequence + 1 : checkpointEventLimit;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > checkpointEventLimit) throw new Error("Invalid pending checkpoint range");
    const events = await client.query<EvidenceEventRow>(
      `SELECT ${eventColumns} FROM evidence.events
        WHERE organization_id=$1 AND session_id=$2 AND sequence>=$3 ORDER BY sequence LIMIT $4`,
      [organizationId, sessionId, firstSequence, limit]);
    const firstEvent = events.rows[0];
    if (firstEvent === undefined) {
      if (pending) throw new Error("Pending checkpoint Evidence is missing");
      return null;
    }
    const proofs = events.rows.map(evidenceProofEvent);
    if (proofs[0]?.sequence !== firstSequence || proofs.some((event, index) => event.sequence !== firstSequence + index)) {
      throw new Error(`Evidence sequence ${firstSequence} is missing or reordered`);
    }
    if (!pending && !evidenceCheckpointDue(proofs.length, firstEvent.recorded_at, session.rows[0].status, now)) return null;
    const checkpoint = buildEvidenceCheckpoint(sessionId, proofs, previous.rows[0]?.checkpoint_digest ?? null);
    if (pending && canonicalizeJson(pending.checkpoint) !== canonicalizeJson(checkpoint)) throw new Error("Pending checkpoint history changed");
    await client.query(`INSERT INTO operations.evidence_checkpoint_work(organization_id,session_id,checkpoint,lease_token,lease_until,attempts)
      VALUES ($1,$2,$3::jsonb,$4,transaction_timestamp()+interval '60 seconds',1) ON CONFLICT (session_id) DO UPDATE
      SET lease_token=$4,lease_until=transaction_timestamp()+interval '60 seconds',attempts=operations.evidence_checkpoint_work.attempts+1`,
    [organizationId, sessionId, JSON.stringify(checkpoint), leaseToken]);
    return { checkpoint, signature: pending?.signature ?? null };
  });
  if (work === null) return null;
  const prepared = work.checkpoint;
  const assertClaim = async (client: PoolClient) => {
    await checkpointAuthority(client, organizationId, sessionId, context);
    const claim = await client.query(`SELECT 1 FROM operations.evidence_checkpoint_work
      WHERE organization_id=$1 AND session_id=$2 AND lease_token=$3 AND lease_until>transaction_timestamp() FOR UPDATE`,
    [organizationId, sessionId, leaseToken]);
    if (claim.rowCount !== 1) throw new Error("Checkpoint work claim expired");
  };
  let failure = signer && anchor ? "signing_failed" : "signing_unavailable";
  try {
    if (!signer || !anchor) throw new Error("Approved checkpoint signer and independent anchor are not configured");

    const signed = work.signature ? { ...work.signature, signature: Buffer.from(work.signature.signature, "base64") }
      : await checkpointEffect(signal => signer.signCheckpoint({
      checkpointId: prepared.checkpointId,
      checkpointDigest: prepared.checkpointDigest,
      digestBytes: Buffer.from(prepared.checkpointDigest, "hex")
    }, signal), context?.signal);
    if (signed.algorithm !== "Ed25519" || signed.keyId.trim() === "" || signed.keyId.length > 512 ||
        signed.signature.byteLength !== 64 || signed.publicKeyJwk.kty !== "OKP" ||
        signed.publicKeyJwk.crv !== "Ed25519" || typeof signed.publicKeyJwk.x !== "string" ||
        Object.hasOwn(signed.publicKeyJwk, "d") || Object.hasOwn(signed.publicKeyJwk, "k")) {
      throw new Error("The Evidence signer returned an invalid signature response");
    }
    try {
      const signerKey = createPublicKey({ key: signed.publicKeyJwk as unknown as CryptoJsonWebKey, format: "jwk" });
      if (!verifySignature(null, Buffer.from(prepared.checkpointDigest, "hex"), signerKey, signed.signature)) {
        throw new Error("invalid signature");
      }
    } catch {
      throw new Error("The Evidence signer returned an invalid signature response");
    }
    const signedAt = work.signature?.signedAt ?? now.toISOString();
    await withOrganizationTransaction(pool, organizationId, async client => {
      await assertClaim(client);
      await client.query(`UPDATE operations.evidence_checkpoint_work SET signature=$4::jsonb
        WHERE organization_id=$1 AND session_id=$2 AND lease_token=$3`,
      [organizationId, sessionId, leaseToken, JSON.stringify({ ...signed, signature: Buffer.from(signed.signature).toString("base64"), signedAt })]);
    });
    failure = "anchoring_failed";
    const anchored = await checkpointEffect(signal => anchor.anchorCheckpoint({
      idempotencyKey: prepared.checkpointId,
      checkpointId: prepared.checkpointId,
      sessionId,
      firstSequence: prepared.firstSequence,
      lastSequence: prepared.lastSequence,
      checkpointDigest: prepared.checkpointDigest,
      checkpointCreatedAt: prepared.createdAt,
      keyId: signed.keyId
    }, signal), context?.signal);
    if (anchored.anchoredDigest !== prepared.checkpointDigest || anchored.endpoint.trim() === "" ||
        anchored.reference.trim() === "" || anchored.verificationResult !== "verified" || !Number.isFinite(anchored.recordedAt.getTime())) {
      throw new Error("The independent anchor response does not match the checkpoint");
    }

    failure = "interrupted";
    return await withOrganizationTransaction(pool, organizationId, async (client) => {
      await assertClaim(client);
      const inserted = await client.query(
        `INSERT INTO evidence.checkpoint_batches
          (id,organization_id,session_id,first_sequence,last_sequence,previous_checkpoint_digest,batch_merkle_root,canonicalization,algorithm,checkpoint_digest,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (session_id,first_sequence) DO NOTHING RETURNING id`,
        [prepared.checkpointId, organizationId, sessionId, prepared.firstSequence, prepared.lastSequence,
          prepared.previousCheckpointDigest, prepared.batchMerkleRoot, prepared.canonicalization, prepared.algorithm,
          prepared.checkpointDigest, prepared.createdAt]
      );
      if (inserted.rowCount === 0) {
        const existing = await client.query<{ checkpoint_digest: string }>(
          `SELECT checkpoint_digest FROM evidence.checkpoint_batches
            WHERE organization_id=$1 AND session_id=$2 AND first_sequence=$3`,
          [organizationId, sessionId, prepared.firstSequence]);
        if (existing.rows[0]?.checkpoint_digest !== prepared.checkpointDigest) {
          throw new Error("A conflicting checkpoint already covers this Evidence range");
        }
        await client.query("DELETE FROM operations.evidence_checkpoint_work WHERE organization_id=$1 AND session_id=$2 AND lease_token=$3", [organizationId, sessionId, leaseToken]);
        return prepared;
      }
      await client.query(
        `INSERT INTO evidence.checkpoint_signatures
          (id,organization_id,checkpoint_id,signing_key_id,signature_algorithm,signature,public_key_jwk,signed_at)
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6::jsonb,$7)`,
        [organizationId, prepared.checkpointId, signed.keyId, signed.algorithm, Buffer.from(signed.signature),
          JSON.stringify(signed.publicKeyJwk), signedAt]
      );
      await client.query(
        `INSERT INTO evidence.anchor_receipts
          (id,organization_id,checkpoint_id,anchor_endpoint,anchor_reference,anchored_digest,signing_key_id,verification_result,recorded_at)
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8)`,
        [organizationId, prepared.checkpointId, anchored.endpoint, anchored.reference, anchored.anchoredDigest,
          signed.keyId, anchored.verificationResult, anchored.recordedAt]
      );
      await client.query("DELETE FROM operations.evidence_checkpoint_work WHERE organization_id=$1 AND session_id=$2 AND lease_token=$3", [organizationId, sessionId, leaseToken]);
      return prepared;
    });
  } catch (error) {
    await withOrganizationTransaction(pool, organizationId, client => client.query(`UPDATE operations.evidence_checkpoint_work
      SET last_failure=$4,lease_token=NULL,lease_until=NULL,
        retry_at=GREATEST($5::timestamptz,transaction_timestamp()) + make_interval(secs => LEAST(300,5*power(2,LEAST(attempts-1,6)))::double precision)
      WHERE organization_id=$1 AND session_id=$2 AND lease_token=$3`,
    [organizationId, sessionId, leaseToken, context?.signal?.aborted ? "interrupted" : failure, now]));
    throw error;
  }
}

export async function exportEvidenceVerification(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  correlationId: string,
  now = new Date()
): Promise<VerificationExportV1> {
  if (!uuidPattern.test(sessionId) || Number.isNaN(now.getTime())) {
    throw authorizationError("VALIDATION_FAILED", "A valid Session and export time are required.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await currentAdmin(client, principal, correlationId);
    const session = await client.query<{ last_sequence: string }>(
      `SELECT sequence.next_sequence-1 AS last_sequence FROM runtime.sessions session
       JOIN evidence.session_sequences sequence ON sequence.organization_id=session.organization_id AND sequence.session_id=session.id
       WHERE session.organization_id=$1 AND session.id=$2`, [principal.organizationId, sessionId]);
    if (session.rows[0] === undefined) throw authorizationError("NOT_FOUND", "The Session was not found.", correlationId);
    const checkpoints = await client.query<{
      id: string; first_sequence: string; last_sequence: string; previous_checkpoint_digest: string | null;
      batch_merkle_root: string; canonicalization: "plenum-evidence-v1"; algorithm: "sha256";
      checkpoint_digest: string; created_at: Date; signing_key_id: string; signature_algorithm: "Ed25519";
      signature: Buffer; public_key_jwk: JsonObject; signed_at: Date;
    }>(
      `SELECT checkpoint.*,signature.signing_key_id,signature.signature_algorithm,signature.signature,
              signature.public_key_jwk,signature.signed_at
         FROM evidence.checkpoint_batches checkpoint
         JOIN evidence.checkpoint_signatures signature ON signature.organization_id=checkpoint.organization_id AND signature.checkpoint_id=checkpoint.id
        WHERE checkpoint.organization_id=$1 AND checkpoint.session_id=$2 ORDER BY checkpoint.first_sequence`,
      [principal.organizationId, sessionId]
    );
    const bundles: VerificationCheckpointV1[] = [];
    for (const row of checkpoints.rows) {
      const events = await client.query<EvidenceEventRow>(
        `SELECT ${eventColumns} FROM evidence.events
          WHERE organization_id=$1 AND session_id=$2 AND sequence BETWEEN $3 AND $4 ORDER BY sequence`,
        [principal.organizationId, sessionId, row.first_sequence, row.last_sequence]);
      const receipts = await client.query<{
        anchor_endpoint: string; anchor_reference: string; anchored_digest: string; signing_key_id: string;
        verification_result: "pending" | "verified" | "failed"; recorded_at: Date;
      }>(`SELECT anchor_endpoint,anchor_reference,anchored_digest,signing_key_id,verification_result,recorded_at
            FROM evidence.anchor_receipts WHERE organization_id=$1 AND checkpoint_id=$2 ORDER BY recorded_at`,
      [principal.organizationId, row.id]);
      const checkpoint: EvidenceCheckpointV1 = {
        contractId: CHECKPOINT_CONTRACT_ID, checkpointId: row.id, sessionId,
        firstSequence: Number(row.first_sequence), lastSequence: Number(row.last_sequence),
        previousCheckpointDigest: row.previous_checkpoint_digest, batchMerkleRoot: row.batch_merkle_root,
        canonicalization: row.canonicalization, algorithm: row.algorithm,
        checkpointDigest: row.checkpoint_digest, createdAt: row.created_at.toISOString()
      };
      const signature: EvidenceCheckpointSignatureV1 = {
        keyId: row.signing_key_id, algorithm: row.signature_algorithm, signature: row.signature.toString("base64"),
        publicKeyJwk: row.public_key_jwk, signedAt: row.signed_at.toISOString()
      };
      const anchorReceipts: EvidenceAnchorReceiptV1[] = receipts.rows.map((receipt) => ({
        endpoint: receipt.anchor_endpoint, reference: receipt.anchor_reference, anchoredDigest: receipt.anchored_digest,
        keyId: receipt.signing_key_id, verificationResult: receipt.verification_result, recordedAt: receipt.recorded_at.toISOString()
      }));
      bundles.push({ checkpoint, events: events.rows.map(evidenceProofEvent), signature, anchorReceipts });
    }
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES (gen_random_uuid(),$1,$2,'evidence.verification_exported',$3,$4::jsonb)`,
      [principal.organizationId, principal.principalId, `session:${sessionId}`,
        JSON.stringify({ correlationId, checkpointCount: bundles.length, bodiesExcluded: true })]
    );
    return {
      contractId: VERIFICATION_EXPORT_CONTRACT_ID,
      sessionId,
      generatedAt: now.toISOString(),
      lastEvidenceSequence: Number(session.rows[0].last_sequence),
      checkpoints: bundles
    };
  });
}
