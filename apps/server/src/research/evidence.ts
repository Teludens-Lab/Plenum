import { createHash, randomUUID } from "node:crypto";
import { canonicalizeJson, type JsonObject } from "@plenum/event-contracts";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

async function requireCurrentRole(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  role: "admin" | "research_analyst",
  correlationId: string
): Promise<void> {
  if (!principal.organizationRoles.includes(role)) {
    throw authorizationError("PERMISSION_DENIED", `The ${role === "admin" ? "Admin" : "Research Analyst"} Organization Role is required.`, correlationId);
  }
  const current = await client.query(
    `SELECT 1
       FROM identity.authentication_sessions session
       JOIN identity.memberships membership
         ON membership.organization_id=session.organization_id AND membership.person_id=session.person_id
      WHERE session.organization_id=$1 AND session.id=$2 AND session.person_id=$3
        AND session.revoked_at IS NULL AND session.expires_at>transaction_timestamp()
        AND membership.organization_role=$4`,
    [principal.organizationId, principal.authenticationSessionId, principal.principalId, role]
  );
  if (current.rowCount !== 1) throw authorizationError("ACCESS_REVOKED", "Organization access is no longer active.", correlationId);
}

export interface ResearchAccessGrantInput {
  projectId: string;
  analystPersonId: string;
  protocolReference: string;
  expiresAt: Date;
}

export interface ResearchAccessGrant {
  grantId: string;
  projectId: string;
  analystPersonId: string;
  protocolReference: string;
  classificationCeiling: "internal";
  expiresAt: string;
}

export async function grantResearchAccess(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: ResearchAccessGrantInput,
  correlationId: string,
  now = new Date()
): Promise<ResearchAccessGrant> {
  if (!uuid.test(input.projectId) || !uuid.test(input.analystPersonId) ||
      input.protocolReference.trim().length === 0 || input.protocolReference.length > 400 ||
      Number.isNaN(input.expiresAt.getTime()) || input.expiresAt <= now) {
    throw authorizationError("VALIDATION_FAILED", "A project, Research Analyst, protocol reference, and future expiry are required.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, "admin", correlationId);
    const target = await client.query(
      `SELECT 1
         FROM studio.simulation_projects project
         JOIN identity.memberships membership
           ON membership.organization_id=project.organization_id AND membership.person_id=$3
          AND membership.organization_role='research_analyst'
        WHERE project.organization_id=$1 AND project.id=$2`,
      [principal.organizationId, input.projectId, input.analystPersonId]
    );
    if (target.rowCount !== 1) throw authorizationError("REFERENCE_INVALID", "The project or Research Analyst membership is unavailable.", correlationId);
    const grantId = randomUUID();
    await client.query(
      `INSERT INTO evidence.research_access_grants
         (id,organization_id,project_id,analyst_person_id,protocol_reference,classification_ceiling,approved_by,expires_at)
       VALUES ($1,$2,$3,$4,$5,'internal',$6,$7)`,
      [grantId, principal.organizationId, input.projectId, input.analystPersonId,
        input.protocolReference.trim(), principal.principalId, input.expiresAt]
    );
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'research.access_granted',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `research_access_grant:${grantId}`,
        JSON.stringify({ correlationId, projectId: input.projectId, analystPersonId: input.analystPersonId,
          protocolReference: input.protocolReference.trim(), expiresAt: input.expiresAt.toISOString() })]
    );
    return { grantId, projectId: input.projectId, analystPersonId: input.analystPersonId,
      protocolReference: input.protocolReference.trim(), classificationCeiling: "internal", expiresAt: input.expiresAt.toISOString() };
  });
}

export async function revokeResearchAccess(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  grantId: string,
  correlationId: string
): Promise<void> {
  if (!uuid.test(grantId)) throw authorizationError("INVALID_ID", "The Research Access Grant identifier is invalid.", correlationId);
  await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, "admin", correlationId);
    const revoked = await client.query(
      `UPDATE evidence.research_access_grants SET revoked_at=transaction_timestamp()
        WHERE organization_id=$1 AND id=$2 AND revoked_at IS NULL`,
      [principal.organizationId, grantId]
    );
    if (revoked.rowCount !== 1) throw authorizationError("NOT_FOUND", "The active Research Access Grant was not found.", correlationId);
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'research.access_revoked',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `research_access_grant:${grantId}`, JSON.stringify({ correlationId })]
    );
  });
}

export interface ResearchEvidenceIndex {
  contractId: "research-evidence-index-v1";
  sessionId: string;
  protocolReference: string;
  generatedAt: string;
  events: Array<{
    sequence: number;
    eventType: string;
    eventVersion: number;
    governingReleaseId: string;
    recordedAt: string;
  }>;
  nextSequence: number | null;
}

export async function exportResearchEvidenceIndex(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  correlationId: string,
  afterSequence = 0,
  limit = 1_000,
  now = new Date()
): Promise<ResearchEvidenceIndex> {
  if (!uuid.test(sessionId) || !Number.isSafeInteger(afterSequence) || afterSequence < 0 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
    throw authorizationError("VALIDATION_FAILED", "The research export cursor or limit is invalid.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, "research_analyst", correlationId);
    const access = await client.query<{ protocol_reference: string }>(
      `SELECT access_grant.protocol_reference
         FROM runtime.sessions session
         JOIN evidence.research_access_grants access_grant
           ON access_grant.organization_id=session.organization_id AND access_grant.project_id=session.project_id
          AND access_grant.analyst_person_id=$3 AND access_grant.classification_ceiling='internal'
          AND access_grant.revoked_at IS NULL AND access_grant.expires_at>$4
        WHERE session.organization_id=$1 AND session.id=$2
        ORDER BY access_grant.created_at DESC LIMIT 1`,
      [principal.organizationId, sessionId, principal.principalId, now]
    );
    if (access.rows[0] === undefined) throw authorizationError("PERMISSION_DENIED", "An active project-scoped Research Access Grant is required.", correlationId);
    const result = await client.query<{
      sequence: string; event_type: string; event_version: number; governing_release_id: string; recorded_at: Date;
    }>(
      `SELECT sequence,event_type,event_version,governing_release_id,recorded_at
         FROM evidence.events
        WHERE organization_id=$1 AND session_id=$2 AND sequence>$3
        ORDER BY sequence LIMIT $4`,
      [principal.organizationId, sessionId, afterSequence, limit + 1]
    );
    const hasMore = result.rows.length > limit;
    const rows = result.rows.slice(0, limit);
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'research.evidence_index_exported',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `session:${sessionId}`,
        JSON.stringify({ correlationId, protocolReference: access.rows[0].protocol_reference,
          afterSequence, returned: rows.length, classificationCeiling: "internal" })]
    );
    return {
      contractId: "research-evidence-index-v1",
      sessionId,
      protocolReference: access.rows[0].protocol_reference,
      generatedAt: now.toISOString(),
      events: rows.map((row) => ({ sequence: Number(row.sequence), eventType: row.event_type,
        eventVersion: row.event_version, governingReleaseId: row.governing_release_id, recordedAt: row.recorded_at.toISOString() })),
      nextSequence: hasMore ? Number(rows.at(-1)?.sequence ?? afterSequence) : null
    };
  });
}

interface ResearchExportEvent extends JsonObject {
  sessionId: string;
  sequence: number;
  eventType: string;
  eventVersion: number;
  governingReleaseId: string;
  aggregateId: string;
  aggregateVersion: number | null;
  recordedAt: string;
  captureMode: "captured";
}

export interface ResearchExportArtifact {
  contentType: string;
  filename: string;
  bytes: Uint8Array;
  manifest: JsonObject;
}

const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const text = (value: unknown) => new TextEncoder().encode(typeof value === "string" ? value : canonicalizeJson(value as JsonObject));
const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const html = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files: Array<{ path: string; bytes: Uint8Array }>): Uint8Array {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.path, "utf8");
    const body = Buffer.from(file.bytes);
    const checksum = crc32(body);
    const header = Buffer.alloc(30 + name.length);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8); header.writeUInt16LE(0, 10); header.writeUInt16LE(33, 12);
    header.writeUInt32LE(checksum, 14); header.writeUInt32LE(body.length, 18); header.writeUInt32LE(body.length, 22);
    header.writeUInt16LE(name.length, 26); header.writeUInt16LE(0, 28); name.copy(header, 30);
    local.push(header, body);
    const directory = Buffer.alloc(46 + name.length);
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0, 8); directory.writeUInt16LE(0, 10); directory.writeUInt16LE(0, 12);
    directory.writeUInt16LE(33, 14); directory.writeUInt32LE(checksum, 16); directory.writeUInt32LE(body.length, 20);
    directory.writeUInt32LE(body.length, 24); directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(offset, 42);
    name.copy(directory, 46); central.push(directory); offset += header.length + body.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBytes, end]);
}

export async function exportResearchEvidenceBundle(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  projectId: string,
  format: "json" | "csv" | "html" | "zip",
  correlationId: string,
  now = new Date()
): Promise<ResearchExportArtifact> {
  if (!uuid.test(projectId)) throw authorizationError("VALIDATION_FAILED", "A valid Project is required.", correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, "research_analyst", correlationId);
    const access = await client.query<{ protocol_reference: string }>(
      `SELECT protocol_reference FROM evidence.research_access_grants
        WHERE organization_id=$1 AND project_id=$2 AND analyst_person_id=$3
          AND classification_ceiling='internal' AND revoked_at IS NULL AND expires_at>$4
        ORDER BY created_at DESC LIMIT 1`,
      [principal.organizationId, projectId, principal.principalId, now]
    );
    if (access.rows[0] === undefined) {
      throw authorizationError("PERMISSION_DENIED", "An active project-scoped Research Access Grant is required.", correlationId);
    }
    const sessions = await client.query<{ id: string; status: string; created_at: Date }>(
      `SELECT id,status,created_at FROM runtime.sessions
        WHERE organization_id=$1 AND project_id=$2 ORDER BY created_at,id`,
      [principal.organizationId, projectId]
    );
    if (sessions.rowCount === 0) throw authorizationError("NOT_FOUND", "No Sessions were found for the Project.", correlationId);
    const sessionIds = sessions.rows.map(({ id }) => id);
    const source = await client.query<{
      session_id: string; sequence: string; event_type: string; event_version: number; governing_release_id: string;
      aggregate_id: string; aggregate_version: string | null; recorded_at: Date;
    }>(
      `SELECT session_id,sequence,event_type,event_version,governing_release_id,aggregate_id,aggregate_version,recorded_at
         FROM evidence.events
        WHERE organization_id=$1 AND session_id=ANY($2::uuid[]) ORDER BY session_id,sequence`,
      [principal.organizationId, sessionIds]
    );
    const events: ResearchExportEvent[] = source.rows.map((row) => ({
      sessionId: row.session_id, sequence: Number(row.sequence), eventType: row.event_type,
      eventVersion: row.event_version, governingReleaseId: row.governing_release_id,
      aggregateId: row.aggregate_id, aggregateVersion: row.aggregate_version === null ? null : Number(row.aggregate_version),
      recordedAt: row.recorded_at.toISOString(), captureMode: "captured"
    }));
    const jsonBytes = text({ contractId: "research-evidence-export-v1", projectId, sessions: sessions.rows.map((session) => ({
      sessionId: session.id, status: session.status, createdAt: session.created_at.toISOString()
    })), events });
    const csvBytes = text([
      ["sessionId", "sequence", "eventType", "eventVersion", "governingReleaseId", "aggregateId", "aggregateVersion", "recordedAt", "captureMode"].map(csv).join(","),
      ...events.map((event) => [event.sessionId, event.sequence, event.eventType, event.eventVersion,
        event.governingReleaseId, event.aggregateId, event.aggregateVersion, event.recordedAt, event.captureMode].map(csv).join(","))
    ].join("\n") + "\n");
    const htmlBytes = text(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Research evidence report</title><body>` +
      `<h1>Research evidence report</h1><p>Project ${html(projectId)}</p><p>${events.length} canonical captured event rows.</p>` +
      `<table><thead><tr><th>Session</th><th>Sequence</th><th>Event</th><th>Capture</th></tr></thead><tbody>` +
      events.map((event) => `<tr><td>${html(event.sessionId)}</td><td>${event.sequence}</td><td>${html(event.eventType)}</td><td>captured</td></tr>`).join("") +
      `</tbody></table></body></html>`);
    const files = [
      { path: "events.json", mediaType: "application/json", bytes: jsonBytes, records: events.length },
      { path: "events.csv", mediaType: "text/csv", bytes: csvBytes, records: events.length },
      { path: "report.html", mediaType: "text/html", bytes: htmlBytes, records: events.length }
    ];
    const manifest: JsonObject = {
      contractId: "research-evidence-manifest-v1", exportId: randomUUID(), projectId,
      sessionIds, protocolReference: access.rows[0].protocol_reference, generatedAt: now.toISOString(),
      captureModes: ["captured"],
      files: files.map((file) => ({ path: file.path, mediaType: file.mediaType, bytes: file.bytes.byteLength,
        records: file.records, sha256: hash(file.bytes) })),
      formalReportSource: { path: "report.html", sourcePath: "events.json", sourceSha256: hash(jsonBytes) },
      sourceReconciliation: { sourceRows: source.rowCount, exportedRows: events.length,
        matched: source.rowCount === events.length, sourceSha256: hash(text(events)) }
    };
    const manifestBytes = text(manifest);
    const selection = format === "json" ? { contentType: "application/json", filename: "research-evidence.json", bytes: jsonBytes } :
      format === "csv" ? { contentType: "text/csv; charset=utf-8", filename: "research-evidence.csv", bytes: csvBytes } :
      format === "html" ? { contentType: "text/html; charset=utf-8", filename: "research-evidence.html", bytes: htmlBytes } :
      { contentType: "application/zip", filename: "research-evidence.zip",
        bytes: zip([{ path: "manifest.json", bytes: manifestBytes }, ...files.map(({ path, bytes }) => ({ path, bytes }))]) };
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'research.export_completed',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `project:${projectId}`,
        JSON.stringify({ correlationId, exportId: manifest.exportId, format, sessionCount: sessionIds.length,
          eventCount: events.length, exportSha256: hash(selection.bytes), classificationCeiling: "internal" })]
    );
    return { ...selection, manifest };
  });
}
