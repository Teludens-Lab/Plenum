import { createHash, randomUUID } from "node:crypto";

import {
  CONTENT_LIBRARY_CONTRACT_ID,
  UPLOAD_QUARANTINE_CONTRACT_ID,
  canonicalizeJson,
  type ContentLibraryItemV1,
  type ContentLibraryV1,
  type JsonObject,
  type UploadQuarantineV1
} from "@plenum/event-contracts";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import type { ObjectStore } from "../registry/object-store.js";

const MAX_CONTENT_BYTES = 512 * 1024;
const allowedMediaTypes = new Set(["text/plain", "text/markdown", "application/pdf", "image/png", "image/jpeg"]);

export interface ContentScanResult {
  status: "clean" | "infected";
  detail: string;
}

export interface ContentScanner {
  scan(bytes: Uint8Array, mediaType: string): Promise<ContentScanResult>;
}

export interface UploadContentInput {
  requestId: string;
  contentItemId?: string;
  title: string;
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
}

interface ContentRow {
  item_id: string;
  project_id: string;
  title: string;
  current_version: number;
  version_id: string;
  version: number;
  file_name: string;
  media_type: string;
  size_bytes: number;
  sha256: string;
  scan_status: "quarantined" | "clean" | "infected" | "failed";
  scan_detail: string;
  available_at: Date | null;
  created_at: Date;
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function detectedMediaType(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-") return "application/pdf";
  const text = Buffer.from(bytes).toString("utf8");
  if (!text.includes("\u0000") && Buffer.byteLength(text, "utf8") === bytes.byteLength) return "text";
  return undefined;
}

function validateUpload(input: UploadContentInput, correlationId: string): void {
  if (input.title.trim().length === 0 || input.title.length > 200 || input.fileName.trim().length === 0 || input.fileName.length > 255) {
    throw authorizationError("VALIDATION_FAILED", "Content title and file name are required and must fit their limits.", correlationId);
  }
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_CONTENT_BYTES) {
    throw authorizationError("TOO_LARGE", "Content uploads must be between 1 byte and 512 KiB.", correlationId);
  }
  if (!allowedMediaTypes.has(input.mediaType)) {
    throw authorizationError("VALIDATION_FAILED", "This content type is not allowed.", correlationId);
  }
  const detected = detectedMediaType(input.bytes);
  const matches = detected === input.mediaType || detected === "text" && (input.mediaType === "text/plain" || input.mediaType === "text/markdown");
  if (!matches) throw authorizationError("VALIDATION_FAILED", "The file content does not match its declared type.", correlationId);
}

async function requireContentAccess(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  projectId: string,
  correlationId: string
): Promise<void> {
  const result = await client.query(
    `SELECT 1
       FROM studio.simulation_projects project
       JOIN identity.authentication_sessions session
         ON session.organization_id=project.organization_id
       JOIN identity.memberships membership
         ON membership.organization_id=session.organization_id AND membership.person_id=session.person_id
      WHERE project.organization_id=$1 AND project.id=$2
        AND session.id=$3 AND session.person_id=$4
        AND session.revoked_at IS NULL AND session.expires_at>transaction_timestamp()
        AND membership.organization_role=ANY($5::text[])
      LIMIT 1`,
    [principal.organizationId, projectId, principal.authenticationSessionId, principal.principalId, ["admin", "designer"]]
  );
  if (result.rowCount !== 1) {
    throw authorizationError("ACCESS_REVOKED", "Content Library access is unavailable for this Project.", correlationId);
  }
}

function itemsFrom(rows: readonly ContentRow[]): ContentLibraryItemV1[] {
  const items = new Map<string, ContentLibraryItemV1>();
  for (const row of rows) {
    let item = items.get(row.item_id);
    if (item === undefined) {
      item = { id: row.item_id, projectId: row.project_id, title: row.title, currentVersion: row.current_version, versions: [] };
      items.set(row.item_id, item);
    }
    item.versions.push({
      id: row.version_id, version: row.version, fileName: row.file_name, mediaType: row.media_type,
      sizeBytes: row.size_bytes, sha256: row.sha256, scanStatus: row.scan_status, scanDetail: row.scan_detail,
      availableAt: row.available_at?.toISOString() ?? null, createdAt: row.created_at.toISOString()
    });
  }
  return [...items.values()];
}

async function contentRows(client: PoolClient, organizationId: string, projectId: string): Promise<ContentRow[]> {
  return (await client.query<ContentRow>(
    `SELECT item.id AS item_id,item.project_id,item.title,item.current_version,
            version.id AS version_id,version.version,version.file_name,version.media_type,version.size_bytes,
            version.sha256,version.scan_status,version.scan_detail,version.available_at,version.created_at
       FROM studio.content_items item
       JOIN studio.content_versions version
         ON version.organization_id=item.organization_id AND version.content_item_id=item.id
      WHERE item.organization_id=$1 AND item.project_id=$2
      ORDER BY item.updated_at DESC,item.id,version.version DESC`,
    [organizationId, projectId]
  )).rows;
}

export async function listContentLibrary(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  projectId: string,
  correlationId: string
): Promise<ContentLibraryV1> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireContentAccess(client, principal, projectId, correlationId);
    return { contractId: CONTENT_LIBRARY_CONTRACT_ID, projectId, permissions: { canUpload: true },
      items: itemsFrom(await contentRows(client, principal.organizationId, projectId)) };
  });
}

export async function uploadContentVersion(
  pool: Pool,
  objectStore: ObjectStore,
  scanner: ContentScanner | undefined,
  principal: AuthenticatedPrincipal,
  projectId: string,
  input: UploadContentInput,
  correlationId: string
): Promise<UploadQuarantineV1> {
  validateUpload(input, correlationId);
  const contentSha256 = sha256(input.bytes);
  const requestSha256 = sha256(canonicalizeJson({
    projectId, contentItemId: input.contentItemId ?? null, title: input.title.trim(), fileName: input.fileName,
    mediaType: input.mediaType, contentSha256
  }));
  const replay = await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireContentAccess(client, principal, projectId, correlationId);
    const result = await client.query<{ request_sha256: string; response: UploadQuarantineV1 }>(
      `SELECT request_sha256,response FROM studio.content_upload_receipts
        WHERE organization_id=$1 AND actor_person_id=$2 AND request_id=$3`,
      [principal.organizationId, principal.principalId, input.requestId]
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    if (row.request_sha256 !== requestSha256) throw authorizationError("IDEMPOTENCY_COLLISION", "The upload request identifier was reused with different content.", correlationId);
    return { ...row.response, replayed: true };
  });
  if (replay !== null) return replay;

  const objectKey = `studio-content/${principal.organizationId}/${projectId}/${input.requestId}/${contentSha256}`;
  await objectStore.putImmutable(objectKey, input.bytes, contentSha256);
  let scanStatus: "clean" | "infected" | "failed" = "failed";
  let scanDetail = "No approved malware scanner is configured; content remains unavailable.";
  if (scanner !== undefined) {
    try {
      const scan = await scanner.scan(input.bytes, input.mediaType);
      scanStatus = scan.status;
      scanDetail = scan.detail.slice(0, 1000);
    } catch {
      scanDetail = "The malware scan failed; content remains unavailable.";
    }
  }

  try {
    return await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
      await requireContentAccess(client, principal, projectId, correlationId);
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [input.requestId]);
      const existingReceipt = await client.query<{ request_sha256: string; response: UploadQuarantineV1 }>(
        `SELECT request_sha256,response FROM studio.content_upload_receipts
          WHERE organization_id=$1 AND actor_person_id=$2 AND request_id=$3`,
        [principal.organizationId, principal.principalId, input.requestId]
      );
      const receipt = existingReceipt.rows[0];
      if (receipt !== undefined) {
        if (receipt.request_sha256 !== requestSha256) throw authorizationError("IDEMPOTENCY_COLLISION", "The upload request identifier was reused with different content.", correlationId);
        return { ...receipt.response, replayed: true };
      }

      const itemId = input.contentItemId ?? randomUUID();
      let currentVersion = 0;
      if (input.contentItemId === undefined) {
        await client.query(
          `INSERT INTO studio.content_items(id,organization_id,project_id,title,created_by)
           VALUES ($1,$2,$3,$4,$5)`,
          [itemId, principal.organizationId, projectId, input.title.trim(), principal.principalId]
        );
      } else {
        const item = await client.query<{ current_version: number }>(
          `SELECT current_version FROM studio.content_items
            WHERE organization_id=$1 AND project_id=$2 AND id=$3 FOR UPDATE`,
          [principal.organizationId, projectId, itemId]
        );
        if (item.rows[0] === undefined) throw authorizationError("NOT_FOUND", "The Content Library item was not found.", correlationId);
        currentVersion = item.rows[0].current_version;
      }
      const version = currentVersion + 1;
      const versionId = randomUUID();
      const availableAt = scanStatus === "clean" ? new Date() : null;
      await client.query(
        `INSERT INTO studio.content_versions
         (id,organization_id,project_id,content_item_id,version,file_name,media_type,size_bytes,sha256,blob_key,
          scan_status,scan_detail,available_at,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [versionId, principal.organizationId, projectId, itemId, version, input.fileName, input.mediaType,
          input.bytes.byteLength, contentSha256, objectKey, scanStatus, scanDetail, availableAt, principal.principalId]
      );
      await client.query(
        `UPDATE studio.content_items SET title=$4,current_version=$5,updated_at=transaction_timestamp()
          WHERE organization_id=$1 AND project_id=$2 AND id=$3`,
        [principal.organizationId, projectId, itemId, input.title.trim(), version]
      );
      const contentItem: ContentLibraryItemV1 = {
        id: itemId, projectId, title: input.title.trim(), currentVersion: version,
        versions: [{ id: versionId, version, fileName: input.fileName, mediaType: input.mediaType,
          sizeBytes: input.bytes.byteLength, sha256: contentSha256, scanStatus, scanDetail,
          availableAt: availableAt?.toISOString() ?? null, createdAt: new Date().toISOString() }]
      };
      const response: UploadQuarantineV1 = {
        contractId: UPLOAD_QUARANTINE_CONTRACT_ID, projectId, contentItem, replayed: false
      };
      await client.query(
        `INSERT INTO studio.content_upload_receipts
         (organization_id,actor_person_id,request_id,project_id,request_sha256,response)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        [principal.organizationId, principal.principalId, input.requestId, projectId, requestSha256,
          JSON.stringify(response as JsonObject)]
      );
      return response;
    });
  } catch (error) {
    await objectStore.deleteIfDigest(objectKey, contentSha256).catch(() => false);
    throw error;
  }
}
