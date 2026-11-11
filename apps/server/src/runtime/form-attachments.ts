import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { CommandEnvelopeV1, FormAttachmentV1 } from "@plenum/event-contracts";
import { FORM_LIMITS } from "@plenum/simulation-schema";
import { activeOrganizationHoldSql, availableFormAttachmentSql, formRetentionPolicy } from "../reporting/form-retention.js";
import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import { resolveSessionAccessContext } from "../identity/context.js";
import type { ObjectStore } from "../registry/object-store.js";
import { detectedMediaType, scanContent, type ContentScanner } from "../security/content-scanning.js";
import { authorizeArtifactFile, executeArtifactFileCommand, type RuntimeProjectionInput } from "./artifact-workflow.js";
import { processSessionCommand, validateCommandEnvelope } from "./commands/processor.js";
import { requireCurrentOrganizationRole } from "../research/evidence.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import type { Pool } from "pg";
import { assertOrganizationJobAuthority, type OrganizationJobAuthority } from "../operations/job-authority.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
interface AttachmentRow {
  id: string; artifact_id: string; created_by: string; file_name: string; media_type: string; size_bytes: number; sha256: string; blob_key: string;
  retention_policy_id: string; scan_status: "quarantined" | "clean" | "infected" | "failed"; scan_detail: string;
  upload_state: "pending" | "store_failed" | "attached" | "purge_pending" | "purged"; created_at: Date; expires_at: Date; attached_at: Date | null;
}
export interface UploadFormAttachmentInput {
  command: CommandEnvelopeV1; attachmentId: string; fileName: string; mediaType: string; bytes: Uint8Array;
}

const resolve = (client: PoolClient, input: RuntimeProjectionInput) => resolveSessionAccessContext(client, input.principal, {
  sessionId: input.sessionId, deviceId: input.deviceId, correlationId: input.correlationId,
  ...(input.activeSessionRoleId === undefined ? {} : { requestedActiveSessionRoleId: input.activeSessionRoleId })
});

export async function listFormAttachments(input: RuntimeProjectionInput & { artifactId: string }): Promise<FormAttachmentV1[]> {
  return withOrganizationTransaction(input.pool, input.principal.organizationId, async (client) => {
    const context = await resolve(client, input);
    await authorizeArtifactFile(client, context, input.artifactId, input.correlationId);
    const rows = await client.query<AttachmentRow>(`SELECT * FROM runtime.form_attachments WHERE organization_id=$1 AND artifact_id=$2 AND ${availableFormAttachmentSql} ORDER BY created_at,id`,
      [context.organizationId, input.artifactId]);
    return rows.rows.map((row) => ({ id: row.id, fileName: row.file_name, mediaType: row.media_type, sizeBytes: row.size_bytes, sha256: row.sha256,
      scanStatus: row.scan_status, available: row.scan_status === "clean", canRetryScan: row.scan_status === "failed" && row.created_by === context.principalId,
      expiresAt: row.expires_at.toISOString() }));
  });
}

export async function downloadFormAttachment(input: RuntimeProjectionInput & { artifactId: string; attachmentId: string }, store: ObjectStore) {
  const row = await withOrganizationTransaction(input.pool, input.principal.organizationId, async (client) => {
    const context = await resolve(client, input);
    await authorizeArtifactFile(client, context, input.artifactId, input.correlationId);
    const result = await client.query<AttachmentRow>(`SELECT * FROM runtime.form_attachments WHERE organization_id=$1 AND artifact_id=$2 AND id=$3 AND ${availableFormAttachmentSql} AND scan_status='clean'`,
      [context.organizationId, input.artifactId, input.attachmentId]);
    if (!result.rows[0]) throw authorizationError("TARGET_NOT_FOUND", "The clean attachment was not found.", input.correlationId);
    return result.rows[0];
  });
  let bytes: Uint8Array;
  try { bytes = await store.get(row.blob_key); } catch { throw authorizationError("CAPABILITY_UNAVAILABLE", "The attachment could not be retrieved. Retry when storage is available.", input.correlationId); }
  if (bytes.byteLength !== row.size_bytes || hash(bytes) !== row.sha256) throw authorizationError("CAPABILITY_UNAVAILABLE", "The attachment failed its integrity check.", input.correlationId);
  // Recheck after external I/O so revoked access cannot complete a slow download.
  await withOrganizationTransaction(input.pool, input.principal.organizationId, async (client) => {
    const context = await resolve(client, input); await authorizeArtifactFile(client, context, input.artifactId, input.correlationId);
    const available = await client.query(`SELECT 1 FROM runtime.form_attachments WHERE organization_id=$1 AND id=$2 AND ${availableFormAttachmentSql} AND scan_status='clean'`, [context.organizationId, row.id]);
    if (!available.rowCount) throw authorizationError("TARGET_NOT_FOUND", "The attachment is no longer available.", input.correlationId);
  });
  return { bytes, fileName: row.file_name, mediaType: row.media_type };
}

export async function uploadFormAttachment(input: RuntimeProjectionInput, store: ObjectStore, scanner: ContentScanner | undefined, upload: UploadFormAttachmentInput, deploymentId: string) {
  validateCommandEnvelope(upload.command, input.correlationId);
  const rescan = upload.command.operationType === "artifact.rescan_file";
  if ((!rescan && upload.command.operationType !== "artifact.attach_file") || !uuid.test(upload.attachmentId) ||
      upload.command.deviceId !== input.deviceId || upload.command.activeSessionRoleId !== undefined && upload.command.activeSessionRoleId !== input.activeSessionRoleId ||
      Object.keys(upload.command.payload).length !== 0 || !upload.fileName.trim() || upload.fileName.length > 255 || /[\x00-\x1f\x7f/\\]/u.test(upload.fileName)) {
    throw authorizationError("VALIDATION_FAILED", "The attachment request is invalid.", input.correlationId);
  }
  if (!upload.bytes.byteLength || upload.bytes.byteLength > FORM_LIMITS.attachmentBytes) throw authorizationError("TOO_LARGE", "Each attachment must contain 1 byte through 20 MB (20,000,000 bytes).", input.correlationId);
  const detected = detectedMediaType(upload.bytes);
  if (detected !== upload.mediaType && !(detected === "text" && ["text/plain", "text/markdown"].includes(upload.mediaType))) throw authorizationError("VALIDATION_FAILED", "File content does not match its declared type.", input.correlationId);
  const sha256 = hash(upload.bytes);
  const command: CommandEnvelopeV1 = { ...upload.command, payload: { attachmentId: upload.attachmentId, fileName: upload.fileName, mediaType: upload.mediaType, sizeBytes: upload.bytes.byteLength, sha256 } };
  const prepared = await withOrganizationTransaction(input.pool, input.principal.organizationId, async (client) => {
    const context = await resolve(client, input);
    const access = await authorizeArtifactFile(client, context, command.aggregateId, input.correlationId);
    const result = await client.query<AttachmentRow>("SELECT * FROM runtime.form_attachments WHERE organization_id=$1 AND id=$2 FOR UPDATE", [context.organizationId, upload.attachmentId]);
    const existing = result.rows[0];
    if (existing && (existing.artifact_id !== command.aggregateId || existing.created_by !== context.principalId || existing.sha256 !== sha256 ||
        existing.file_name !== upload.fileName || existing.media_type !== upload.mediaType)) throw authorizationError("IDEMPOTENCY_COLLISION", "This attachment identifier belongs to another upload.", input.correlationId);
    const prior = existing ? await client.query("SELECT 1 FROM sync.command_receipts WHERE organization_id=$1 AND session_id=$2 AND command_id=$3", [context.organizationId, context.sessionId, command.commandId]) : null;
    if (existing && (prior?.rowCount || existing.upload_state === "attached" && (!rescan || existing.scan_status !== "failed"))) return { context, row: existing, replayOnly: true };
    await authorizeArtifactFile(client, context, command.aggregateId, input.correlationId, true);
    if (!access.form.attachments!.allowedMediaTypes.some((type) => type === upload.mediaType)) throw authorizationError("VALIDATION_FAILED", "This file type is not enabled for the Form.", input.correlationId);
    if (command.governingReleaseId !== access.artifact.governing_release_id || command.expectedAggregateVersion !== Number(access.artifact.version)) throw authorizationError("STALE_AGGREGATE_VERSION", "Refresh the record before uploading. Keep the selected file for retry.", input.correlationId);
    if (rescan) {
      if (!existing || existing.upload_state !== "attached" || existing.scan_status !== "failed") throw authorizationError("INVALID_TRANSITION", "Only an attachment with a failed scan can be retried.", input.correlationId);
      return { context, row: existing, replayOnly: false };
    }
    if (existing) {
      if (!["pending", "store_failed"].includes(existing.upload_state)) throw authorizationError("INVALID_TRANSITION", "The upload cannot be retried.", input.correlationId);
      await client.query("UPDATE runtime.form_attachments SET upload_state='pending' WHERE organization_id=$1 AND id=$2", [context.organizationId, existing.id]);
      return { context, row: existing, replayOnly: false };
    }
    const totals = await client.query<{ count: number; bytes: string }>("SELECT count(*)::integer AS count,coalesce(sum(size_bytes),0)::text AS bytes FROM runtime.form_attachments WHERE organization_id=$1 AND artifact_id=$2 AND upload_state <> 'purged'", [context.organizationId, command.aggregateId]);
    if (totals.rows[0]!.count >= FORM_LIMITS.attachments || Number(totals.rows[0]!.bytes) + upload.bytes.byteLength > FORM_LIMITS.totalAttachmentBytes) throw authorizationError("TOO_LARGE", "A record supports 10 attachments and 100 MB total, including pending and unavailable files.", input.correlationId);
    const policy = await formRetentionPolicy(client, context.organizationId, access.projectId, access.artifactTypeId, access.retentionPolicyId, input.correlationId);
    const rows = await client.query<AttachmentRow>(`INSERT INTO runtime.form_attachments
      (id,organization_id,artifact_id,created_by,file_name,media_type,size_bytes,sha256,blob_key,retention_policy_id,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,transaction_timestamp()+make_interval(days=>$11)) RETURNING *`,
      [upload.attachmentId, context.organizationId, command.aggregateId, context.principalId, upload.fileName, upload.mediaType, upload.bytes.byteLength, sha256,
        `organizations/${context.organizationId}/form-attachments/${upload.attachmentId}/${sha256}`, access.retentionPolicyId, policy.period_days]);
    return { context, row: rows.rows[0]!, replayOnly: false };
  });
  let scan: { status: "clean" | "infected" | "failed"; detail: string } = { status: prepared.row.scan_status === "quarantined" ? "failed" : prepared.row.scan_status, detail: prepared.row.scan_detail };
  if (!prepared.replayOnly) {
    try {
      if (!rescan) await withOrganizationTransaction(input.pool, input.principal.organizationId, async (client) => {
        const current = await client.query("SELECT 1 FROM runtime.form_attachments WHERE organization_id=$1 AND id=$2 AND upload_state='pending' FOR UPDATE", [input.principal.organizationId, upload.attachmentId]);
        if (!current.rowCount) throw authorizationError("INVALID_TRANSITION", "This upload is no longer pending.", input.correlationId);
        // A row lock prevents retention from deleting the object before a slow immutable put finishes.
        // Its reservation was committed first, so rollback/connection loss cannot leave untracked bytes.
        await store.putImmutable(prepared.row.blob_key, upload.bytes, sha256);
      });
    }
    catch {
      await withOrganizationTransaction(input.pool, input.principal.organizationId, async (client) => {
        await client.query("UPDATE runtime.form_attachments SET upload_state='store_failed' WHERE organization_id=$1 AND id=$2 AND upload_state='pending'", [input.principal.organizationId, upload.attachmentId]);
      });
      throw authorizationError("CAPABILITY_UNAVAILABLE", "Storage failed. Retry the same upload; its reserved identifier and limits are preserved.", input.correlationId);
    }
    scan = await scanContent(scanner, upload.bytes, upload.mediaType);
  }
  return processSessionCommand({ pool: input.pool, context: prepared.context, command, correlationId: input.correlationId, deploymentId,
    lockAggregateAndExecute: (execution) => executeArtifactFileCommand(execution, scan) });
}

export async function rescanFormAttachment(input: RuntimeProjectionInput & { artifactId: string; attachmentId: string }, store: ObjectStore, scanner: ContentScanner | undefined, command: CommandEnvelopeV1, deploymentId: string) {
  if (command.operationType !== "artifact.rescan_file" || command.aggregateId !== input.artifactId) throw authorizationError("INVALID_COMMAND", "Choose the attachment rescan Command for this record.", input.correlationId);
  const row = await withOrganizationTransaction(input.pool, input.principal.organizationId, async (client) => {
    const context = await resolve(client, input); await authorizeArtifactFile(client, context, input.artifactId, input.correlationId);
    const rows = await client.query<AttachmentRow>(`SELECT * FROM runtime.form_attachments WHERE organization_id=$1 AND artifact_id=$2 AND id=$3 AND created_by=$4 AND ${availableFormAttachmentSql}`,
      [context.organizationId, input.artifactId, input.attachmentId, context.principalId]);
    if (!rows.rows[0]) throw authorizationError("TARGET_NOT_FOUND", "The attachment was not found.", input.correlationId);
    return rows.rows[0];
  });
  let bytes: Uint8Array;
  try { bytes = await store.get(row.blob_key); } catch { throw authorizationError("CAPABILITY_UNAVAILABLE", "Attachment storage is unavailable. Retry the scan later.", input.correlationId); }
  if (bytes.byteLength !== row.size_bytes || hash(bytes) !== row.sha256) throw authorizationError("CAPABILITY_UNAVAILABLE", "The stored attachment failed its integrity check.", input.correlationId);
  return uploadFormAttachment(input, store, scanner, { command, attachmentId: row.id, fileName: row.file_name, mediaType: row.media_type, bytes }, deploymentId);
}

/** Ten rows per call. The durable purge journal allows recovery after storage deletion or database failure. */
export async function enforceFormAttachmentRetention(pool: Pool, principal: AuthenticatedPrincipal | OrganizationJobAuthority, store: ObjectStore, correlationId: string, now = new Date(), signal?: AbortSignal) {
  if (!Number.isFinite(now.getTime())) throw authorizationError("VALIDATION_FAILED", "Retention needs a valid server time.", correlationId);
  const scheduled = "deploymentId" in principal;
  const actorPersonId = scheduled ? principal.actorPersonId : principal.principalId;
  const authorize = (client: PoolClient) => scheduled ? assertOrganizationJobAuthority(client, principal)
    : requireCurrentOrganizationRole(client, principal, "admin", correlationId);
  const ids = await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await authorize(client);
    if (scheduled) now = (await client.query<{ now: Date }>("SELECT statement_timestamp() AS now")).rows[0]!.now;
    const rows = await client.query<{ id: string }>(`WITH candidates AS (SELECT id FROM runtime.form_attachments WHERE organization_id=$1 AND upload_state<>'purged'
      AND (expires_at<=$2 OR upload_state='purge_pending' OR (upload_state IN ('pending','store_failed') AND created_at<$2::timestamptz-interval '24 hours'))
      AND (NOT $3 OR retention_attempted_at IS NULL OR retention_attempted_at<=$2::timestamptz-interval '30 seconds')
      ORDER BY CASE WHEN $3 THEN retention_attempted_at END NULLS FIRST,created_at,id LIMIT 10 FOR UPDATE SKIP LOCKED)
      UPDATE runtime.form_attachments attachment SET retention_attempted_at=$2 FROM candidates
      WHERE attachment.organization_id=$1 AND attachment.id=candidates.id RETURNING attachment.id`, [principal.organizationId, now, scheduled]);
    return rows.rows.map(({ id }) => id);
  });
  let purged = 0, held = 0, failed = 0;
  const deadline = Date.now() + 5_000;
  for (const id of ids) {
    if (signal?.aborted || scheduled && Date.now() >= deadline) break;
    const prepared = await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
      await authorize(client);
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`attachment-retention:${principal.organizationId}`]);
      if (await organizationHasHold(client, principal.organizationId)) return false;
      const result = await client.query("UPDATE runtime.form_attachments SET upload_state='purge_pending' WHERE organization_id=$1 AND id=$2 AND upload_state<>'purged' RETURNING id", [principal.organizationId, id]);
      return result.rowCount === 1;
    });
    if (!prepared) { held++; continue; }
    try {
      const outcome = await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
        await authorize(client);
        // The object-store API has no transactional delete. Serialize with hold placement through deletion;
        // the previously committed purge_pending row survives any ambiguous storage/commit outcome.
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`attachment-retention:${principal.organizationId}`]);
        if (await organizationHasHold(client, principal.organizationId)) return "held";
        const rows = await client.query<AttachmentRow>("SELECT * FROM runtime.form_attachments WHERE organization_id=$1 AND id=$2 AND upload_state='purge_pending' FOR UPDATE", [principal.organizationId, id]);
        const row = rows.rows[0]; if (!row) return "unchanged";
        const deleted = await store.deleteIfDigest(row.blob_key, row.sha256);
        if (!deleted) {
          try { await store.get(row.blob_key, AbortSignal.timeout(10_000)); throw new Error("Attachment digest mismatch prevents deletion"); }
          catch (error) {
            const info = error as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } };
            if (info.code !== "ENOENT" && info.name !== "NoSuchKey" && info.$metadata?.httpStatusCode !== 404) throw error;
          }
        }
        await client.query("UPDATE runtime.form_attachments SET upload_state='purged',purged_at=$1 WHERE organization_id=$2 AND id=$3", [now, principal.organizationId, id]);
        await client.query(`INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
          VALUES ($1,$2,$3,'retention.attachment_purged',$4,$5::jsonb)`, [randomUUID(), principal.organizationId, actorPersonId, `attachment:${id}`, JSON.stringify({ correlationId, sha256: row.sha256, retentionPolicyId: row.retention_policy_id })]);
        return "purged";
      });
      if (outcome === "purged") purged++; else if (outcome === "held") held++;
    } catch { failed++; }
  }
  if (scheduled) {
    const unresolved = await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
      await authorize(client);
      if (await organizationHasHold(client, principal.organizationId)) return false;
      return (await client.query("SELECT 1 FROM runtime.form_attachments WHERE organization_id=$1 AND upload_state='purge_pending' LIMIT 1", [principal.organizationId])).rowCount === 1;
    });
    if (unresolved) failed = Math.max(failed, 1);
  }
  return { purged, held, failed, batchFull: ids.length === 10 };
}

async function organizationHasHold(client: PoolClient, organizationId: string): Promise<boolean> {
  const rows = await client.query(`${activeOrganizationHoldSql} LIMIT 1`, [organizationId]);
  return rows.rowCount === 1;
}
