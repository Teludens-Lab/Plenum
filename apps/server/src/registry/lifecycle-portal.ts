import { randomUUID } from "node:crypto";

import {
  RELEASE_CATALOG_CONTRACT_ID,
  SESSION_CATALOG_CONTRACT_ID,
  type CommandEnvelopeV1,
  type CreatedConfiguredSessionV1,
  type ReleaseCatalogV1,
  type ReleaseSummaryV1,
  type SessionCatalogV1,
  type SessionLifecycleStatusV1,
  type SessionSummaryV1
} from "@plenum/event-contracts";
import type { OrganizationRole } from "@plenum/policy-engine";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import { commandEnvelopeDigest, validateCommandEnvelope } from "../runtime/commands/processor.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RELEASE_ROLES: readonly OrganizationRole[] = ["admin", "publisher", "operator"];
const SESSION_ROLES: readonly OrganizationRole[] = ["admin", "operator"];

export interface CatalogListInput {
  query?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}

type Access = { roles: OrganizationRole[] };
type Cursor = { date: Date; id: string };

type ReleaseRow = {
  id: string; project_id: string; project_title: string; release_label: string; release_number: number;
  package_schema_version: string; compiler_version: string; package_sha256: string;
  published_by: string; publisher_name: string; published_at: Date; approval_count: string; session_count: string;
};

type SessionRow = {
  id: string; title: string; project_id: string; project_title: string; release_id: string; release_label: string;
  status: SessionLifecycleStatusV1; version: string; scheduled_start_at: Date | null; created_at: Date; updated_at: Date;
  participant_count: string; readiness_complete: string; readiness_total: string; blocking_incomplete: string;
};

type ReleaseAccessDefinition = {
  project_id: string;
  snapshot: {
    coreDesign?: {
      accessPolicy?: { readiness: Array<{ key: string; label: string; blocking: boolean }> };
      seats?: Array<{ id: string; sessionRoleIds: string[]; teamId?: string; minOccupancy: number;
        maxOccupancy: number | null; required: boolean; joinMode: string }>;
    };
  };
};

function normalizedLimit(value: number | undefined): number {
  if (value === undefined) return 20;
  if (!Number.isSafeInteger(value) || value < 1 || value > 50) throw new Error("limit");
  return value;
}

function encodeCursor(date: Date, id: string): string {
  return Buffer.from(JSON.stringify([date.toISOString(), id]), "utf8").toString("base64url");
}

function decodeCursor(value: string | undefined): Cursor | null {
  if (value === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== "string" ||
        typeof parsed[1] !== "string" || !uuid.test(parsed[1])) return null;
    const date = new Date(parsed[0]);
    return Number.isNaN(date.getTime()) ? null : { date, id: parsed[1].toLowerCase() };
  } catch {
    return null;
  }
}

async function requireAccess(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  allowedRoles: readonly OrganizationRole[],
  correlationId: string
): Promise<Access> {
  const result = await client.query<{ roles: OrganizationRole[] }>(
    `SELECT array_agg(membership.organization_role ORDER BY membership.organization_role)::text[] AS roles
       FROM identity.authentication_sessions session
       JOIN identity.memberships membership
         ON membership.organization_id=session.organization_id AND membership.person_id=session.person_id
      WHERE session.organization_id=$1 AND session.id=$2 AND session.person_id=$3
        AND session.revoked_at IS NULL AND session.expires_at>transaction_timestamp()`,
    [principal.organizationId, principal.authenticationSessionId, principal.principalId]
  );
  const roles = result.rows[0]?.roles ?? [];
  if (!roles.some((role) => allowedRoles.includes(role))) {
    throw authorizationError("ACCESS_REVOKED", "Lifecycle catalog access is unavailable for the current Organization Membership.", correlationId);
  }
  return { roles };
}

function releaseSummary(row: ReleaseRow): ReleaseSummaryV1 {
  return {
    id: row.id, project: { id: row.project_id, title: row.project_title }, label: row.release_label,
    releaseNumber: Number(row.release_number), packageSchemaVersion: row.package_schema_version,
    compilerVersion: row.compiler_version, packageDigest: row.package_sha256,
    publishedBy: { id: row.published_by, displayName: row.publisher_name }, publishedAt: row.published_at.toISOString(),
    approvalCount: Number(row.approval_count), sessionCount: Number(row.session_count), immutable: true,
    detailUrl: `/releases/${row.id}`, packageUrl: `/v1/releases/${row.id}/package`
  };
}

function nextActions(status: SessionLifecycleStatusV1, blockingIncomplete: number): string[] {
  if (status === "configured") return blockingIncomplete === 0 ? ["Mark ready", "Staff Participants"] : ["Complete readiness", "Staff Participants"];
  if (status === "ready") return ["Open Session", "Review readiness"];
  if (status === "open") return ["Start Session", "Review staffing"];
  if (status === "active") return ["Open Runtime", "Monitor Session"];
  if (status === "paused") return ["Resume Session", "Review recovery"];
  if (status === "completed") return ["Generate reports", "Review replay"];
  if (status === "locked") return ["Archive Session", "Generate reports"];
  if (status === "archived") return ["View reports", "View replay"];
  return ["Configure Session"];
}

function sessionSummary(row: SessionRow): SessionSummaryV1 {
  const blockingIncomplete = Number(row.blocking_incomplete);
  const base = `/admin/sessions/${row.id}`;
  return {
    id: row.id, title: row.title, project: { id: row.project_id, title: row.project_title },
    governingRelease: { id: row.release_id, label: row.release_label }, status: row.status, version: Number(row.version),
    scheduledStartAt: row.scheduled_start_at?.toISOString() ?? null, createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(), participantCount: Number(row.participant_count),
    readiness: { complete: Number(row.readiness_complete), total: Number(row.readiness_total), blockingIncomplete },
    nextActions: nextActions(row.status, blockingIncomplete),
    urls: { detail: `/sessions/${row.id}`, staffing: `${base}#staffing-title`, runtime: `/sessions/${row.id}/runtime`,
      reports: `${base}/reports`, replay: `${base}/replay`, archive: `${base}/archive` }
  };
}

const releaseSelect = `SELECT release.id,release.project_id,project.title AS project_title,release.release_label,
       release.release_number,release.package_schema_version,release.compiler_version,release.package_sha256,
       release.published_by,publisher.display_name AS publisher_name,release.published_at,
       (SELECT count(*) FROM registry.release_approvals approval
         WHERE approval.organization_id=release.organization_id AND approval.release_id=release.id) AS approval_count,
       (SELECT count(*) FROM runtime.sessions session
         WHERE session.organization_id=release.organization_id AND session.initial_release_id=release.id) AS session_count
  FROM registry.releases release
  JOIN studio.simulation_projects project ON project.organization_id=release.organization_id AND project.id=release.project_id
  JOIN identity.persons publisher ON publisher.id=release.published_by`;

const sessionSelect = `SELECT session.id,session.title,session.project_id,project.title AS project_title,
       activation.release_id,release.release_label,session.status,session.version,session.scheduled_start_at,
       session.created_at,session.updated_at,
       (SELECT count(*) FROM runtime.participants participant
         WHERE participant.organization_id=session.organization_id AND participant.session_id=session.id) AS participant_count,
       (SELECT count(*) FROM runtime.session_readiness_checks check_row
         WHERE check_row.organization_id=session.organization_id AND check_row.session_id=session.id
           AND check_row.completed_at IS NOT NULL) AS readiness_complete,
       (SELECT count(*) FROM runtime.session_readiness_checks check_row
         WHERE check_row.organization_id=session.organization_id AND check_row.session_id=session.id) AS readiness_total,
       (SELECT count(*) FROM runtime.session_readiness_checks check_row
         WHERE check_row.organization_id=session.organization_id AND check_row.session_id=session.id
           AND check_row.blocking AND check_row.completed_at IS NULL) AS blocking_incomplete
  FROM runtime.sessions session
  JOIN studio.simulation_projects project ON project.organization_id=session.organization_id AND project.id=session.project_id
  JOIN LATERAL (SELECT release_id FROM runtime.release_activations
    WHERE organization_id=session.organization_id AND session_id=session.id ORDER BY activation_sequence DESC LIMIT 1) activation ON true
  JOIN registry.releases release ON release.organization_id=session.organization_id AND release.id=activation.release_id`;

export async function listReleaseCatalog(
  pool: Pool, principal: AuthenticatedPrincipal, input: CatalogListInput, correlationId: string
): Promise<ReleaseCatalogV1> {
  let limit: number;
  try { limit = normalizedLimit(input.limit); } catch { throw authorizationError("VALIDATION_FAILED", "Release list limit must be between 1 and 50.", correlationId); }
  const query = input.query?.trim();
  if (query !== undefined && query.length > 100) throw authorizationError("VALIDATION_FAILED", "Release search is limited to 100 characters.", correlationId);
  const cursor = decodeCursor(input.cursor);
  if (input.cursor !== undefined && cursor === null) throw authorizationError("VALIDATION_FAILED", "Release list cursor is invalid.", correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const access = await requireAccess(client, principal, RELEASE_ROLES, correlationId);
    const rows = (await client.query<ReleaseRow>(`${releaseSelect}
      WHERE release.organization_id=$1
        AND ($2::text IS NULL OR release.release_label ILIKE '%'||$2||'%' OR project.title ILIKE '%'||$2||'%')
        AND ($3::timestamptz IS NULL OR (release.published_at,release.id)<($3::timestamptz,$4::uuid))
      ORDER BY release.published_at DESC,release.id DESC LIMIT $5`,
    [principal.organizationId, query === undefined || query === "" ? null : query, cursor?.date ?? null, cursor?.id ?? null, limit + 1])).rows;
    const visible = rows.slice(0, limit), last = visible.at(-1);
    const publisher = access.roles.includes("publisher");
    return { contractId: RELEASE_CATALOG_CONTRACT_ID,
      permissions: { canExportPackage: publisher, canImportPackage: publisher, canCreateSession: access.roles.includes("operator") },
      releases: visible.map(releaseSummary),
      nextCursor: rows.length > limit && last !== undefined ? encodeCursor(last.published_at, last.id) : null };
  });
}

export async function getReleaseCatalogItem(
  pool: Pool, principal: AuthenticatedPrincipal, releaseId: string, correlationId: string
): Promise<ReleaseSummaryV1> {
  if (!uuid.test(releaseId)) throw authorizationError("INVALID_ID", "The Release identifier is invalid.", correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireAccess(client, principal, RELEASE_ROLES, correlationId);
    const row = (await client.query<ReleaseRow>(`${releaseSelect} WHERE release.organization_id=$1 AND release.id=$2`,
      [principal.organizationId, releaseId])).rows[0];
    if (row === undefined) throw authorizationError("NOT_FOUND", "The Release was not found.", correlationId);
    return releaseSummary(row);
  });
}

export async function listSessionCatalog(
  pool: Pool, principal: AuthenticatedPrincipal, input: CatalogListInput, correlationId: string
): Promise<SessionCatalogV1> {
  let limit: number;
  try { limit = normalizedLimit(input.limit); } catch { throw authorizationError("VALIDATION_FAILED", "Session list limit must be between 1 and 50.", correlationId); }
  const query = input.query?.trim();
  if (query !== undefined && query.length > 100) throw authorizationError("VALIDATION_FAILED", "Session search is limited to 100 characters.", correlationId);
  const allowedStatuses = new Set(["created", "configured", "ready", "open", "active", "paused", "completed", "locked", "archived", "all"]);
  const status = input.status ?? "all";
  if (!allowedStatuses.has(status)) throw authorizationError("VALIDATION_FAILED", "Session status filter is invalid.", correlationId);
  const cursor = decodeCursor(input.cursor);
  if (input.cursor !== undefined && cursor === null) throw authorizationError("VALIDATION_FAILED", "Session list cursor is invalid.", correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const access = await requireAccess(client, principal, SESSION_ROLES, correlationId);
    const rows = (await client.query<SessionRow>(`${sessionSelect}
      WHERE session.organization_id=$1
        AND ($2::text IS NULL OR session.title ILIKE '%'||$2||'%' OR project.title ILIKE '%'||$2||'%')
        AND ($3::text IS NULL OR session.status=$3)
        AND ($4::timestamptz IS NULL OR (session.updated_at,session.id)<($4::timestamptz,$5::uuid))
      ORDER BY session.updated_at DESC,session.id DESC LIMIT $6`,
    [principal.organizationId, query === undefined || query === "" ? null : query, status === "all" ? null : status,
      cursor?.date ?? null, cursor?.id ?? null, limit + 1])).rows;
    const visible = rows.slice(0, limit), last = visible.at(-1), operator = access.roles.includes("operator");
    return { contractId: SESSION_CATALOG_CONTRACT_ID,
      permissions: { canCreateSession: operator, canOperateSessions: operator }, sessions: visible.map(sessionSummary),
      nextCursor: rows.length > limit && last !== undefined ? encodeCursor(last.updated_at, last.id) : null };
  });
}

export async function getSessionCatalogItem(
  pool: Pool, principal: AuthenticatedPrincipal, sessionId: string, correlationId: string
): Promise<SessionSummaryV1> {
  if (!uuid.test(sessionId)) throw authorizationError("INVALID_ID", "The Session identifier is invalid.", correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireAccess(client, principal, SESSION_ROLES, correlationId);
    const row = (await client.query<SessionRow>(`${sessionSelect} WHERE session.organization_id=$1 AND session.id=$2`,
      [principal.organizationId, sessionId])).rows[0];
    if (row === undefined) throw authorizationError("NOT_FOUND", "The Session was not found.", correlationId);
    return sessionSummary(row);
  });
}

function scheduledStart(value: unknown, correlationId: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) {
    throw authorizationError("VALIDATION_FAILED", "Scheduled start must be an ISO 8601 instant with a time zone.", correlationId);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw authorizationError("VALIDATION_FAILED", "Scheduled start is invalid.", correlationId);
  return date;
}

async function replayCreation(
  client: PoolClient, principal: AuthenticatedPrincipal, command: CommandEnvelopeV1, digest: string, correlationId: string
): Promise<CreatedConfiguredSessionV1 | null> {
  const row = (await client.query<{ payload_sha256: string; actor_person_id: string; evidence_sequence: string; title: string;
    version: string; initial_release_id: string; scheduled_start_at: Date | null }>(
    `SELECT receipt.payload_sha256,receipt.actor_person_id,receipt.evidence_sequence,session.title,session.version,
            session.initial_release_id,session.scheduled_start_at
       FROM sync.command_receipts receipt JOIN runtime.sessions session
         ON session.organization_id=receipt.organization_id AND session.id=receipt.session_id
      WHERE receipt.organization_id=$1 AND receipt.session_id=$2 AND receipt.command_id=$3`,
    [principal.organizationId, command.aggregateId, command.commandId])).rows[0];
  if (row === undefined) return null;
  if (row.payload_sha256 !== digest || row.actor_person_id !== principal.principalId) {
    throw authorizationError("IDEMPOTENCY_COLLISION", "The Command ID was already used for different Session creation input.", correlationId);
  }
  return { contractId: SESSION_CATALOG_CONTRACT_ID, sessionId: command.aggregateId, title: row.title, status: "configured",
    version: Number(row.version), governingReleaseId: row.initial_release_id,
    scheduledStartAt: row.scheduled_start_at?.toISOString() ?? null, replayed: true,
    evidenceSequence: Number(row.evidence_sequence), detailUrl: `/sessions/${command.aggregateId}`,
    staffingUrl: `/admin/sessions/${command.aggregateId}#staffing-title` };
}

export async function createConfiguredSession(
  pool: Pool, principal: AuthenticatedPrincipal, releaseId: string, command: CommandEnvelopeV1,
  correlationId: string, deploymentId: string
): Promise<CreatedConfiguredSessionV1> {
  validateCommandEnvelope(command, correlationId);
  if (command.operationType !== "session.create" || command.governingReleaseId !== releaseId || command.expectedAggregateVersion !== 0 ||
      Object.keys(command.payload).some((key) => !["title", "scheduledStartAt"].includes(key)) ||
      typeof command.payload.title !== "string") {
    throw authorizationError("INVALID_COMMAND", "The Session creation Command is invalid.", correlationId);
  }
  const title = command.payload.title.trim();
  if (title.length < 1 || title.length > 200) throw authorizationError("VALIDATION_FAILED", "Session title must be 1 to 200 characters.", correlationId);
  const start = scheduledStart(command.payload.scheduledStartAt, correlationId);
  const digest = commandEnvelopeDigest(command);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireAccess(client, principal, ["operator"], correlationId);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `session-create:${principal.organizationId}:${command.aggregateId}`
    ]);
    const replay = await replayCreation(client, principal, command, digest, correlationId);
    if (replay !== null) return replay;
    const existing = await client.query("SELECT 1 FROM runtime.sessions WHERE organization_id=$1 AND id=$2",
      [principal.organizationId, command.aggregateId]);
    if (existing.rowCount !== 0) throw authorizationError("TARGET_EXISTS", "The Session identifier is already in use.", correlationId);
    const device = await client.query("SELECT 1 FROM sync.devices WHERE organization_id=$1 AND id=$2 AND person_id=$3 AND revoked_at IS NULL",
      [principal.organizationId, command.deviceId, principal.principalId]);
    if (device.rowCount !== 1) throw authorizationError("DEVICE_NOT_REGISTERED", "The Device is not registered.", correlationId);
    const release = (await client.query<ReleaseAccessDefinition>(
      `SELECT release.project_id,revision.snapshot FROM registry.releases release
       JOIN studio.definition_revisions revision ON revision.organization_id=release.organization_id AND revision.id=release.definition_revision_id
       WHERE release.organization_id=$1 AND release.id=$2`, [principal.organizationId, releaseId])).rows[0];
    const core = release?.snapshot.coreDesign;
    if (release === undefined || core?.accessPolicy === undefined || !Array.isArray(core.seats)) {
      throw authorizationError("REFERENCE_INVALID", "The published Release has no complete Session access configuration.", correlationId);
    }
    await client.query(
      `INSERT INTO runtime.sessions(id,organization_id,project_id,initial_release_id,status,version,created_by,title,scheduled_start_at)
       VALUES ($1,$2,$3,$4,'created',1,$5,$6,$7)`,
      [command.aggregateId, principal.organizationId, release.project_id, releaseId, principal.principalId, title, start]
    );
    await client.query(`INSERT INTO runtime.session_authorities(session_id,organization_id,deployment_id,authority_epoch,status)
      VALUES ($1,$2,$3,1,'active')`, [command.aggregateId, principal.organizationId, deploymentId]);
    await client.query(`INSERT INTO runtime.release_activations
      (id,organization_id,project_id,session_id,release_id,activation_sequence,compatibility_policy,approved_by)
      VALUES ($1,$2,$3,$4,$5,1,'{}',$6)`,
    [randomUUID(), principal.organizationId, release.project_id, command.aggregateId, releaseId, principal.principalId]);
    await client.query(`INSERT INTO runtime.session_operators(organization_id,session_id,person_id,assigned_by)
      VALUES ($1,$2,$3,$3)`, [principal.organizationId, command.aggregateId, principal.principalId]);
    await client.query("INSERT INTO evidence.session_sequences(session_id,organization_id,next_sequence) VALUES ($1,$2,3)",
      [command.aggregateId, principal.organizationId]);
    await client.query(`INSERT INTO runtime.session_access_configs
      (organization_id,session_id,governing_release_id,access_policy,configured_by)
      VALUES ($1,$2,$3,$4::jsonb,$5)`,
    [principal.organizationId, command.aggregateId, releaseId, JSON.stringify(core.accessPolicy), principal.principalId]);
    for (const seat of core.seats) {
      await client.query(`INSERT INTO runtime.session_seats
        (organization_id,session_id,seat_id,session_role_ids,team_id,min_occupancy,max_occupancy,required,join_mode)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [principal.organizationId, command.aggregateId, seat.id, seat.sessionRoleIds, seat.teamId ?? null,
        seat.minOccupancy, seat.maxOccupancy, seat.required, seat.joinMode]);
    }
    for (const check of core.accessPolicy.readiness) {
      await client.query(`INSERT INTO runtime.session_readiness_checks
        (organization_id,session_id,check_key,label,blocking,governing_release_id,assignment_version)
        VALUES ($1,$2,$3,$4,$5,$6,1)`,
      [principal.organizationId, command.aggregateId, check.key, check.label, check.blocking, releaseId]);
    }
    await client.query("UPDATE runtime.sessions SET status='configured',version=2,updated_at=transaction_timestamp() WHERE organization_id=$1 AND id=$2",
      [principal.organizationId, command.aggregateId]);
    const createdEventId = randomUUID(), configuredEventId = randomUUID();
    await client.query(`INSERT INTO evidence.events
      (id,organization_id,session_id,sequence,event_type,event_version,command_id,actor_person_id,governing_release_id,
       authority_epoch,body,correlation_id,causation_id,aggregate_id,aggregate_version,occurred_at)
      VALUES ($1,$2,$3,1,'session.created',1,$4,$5,$6,1,$7::jsonb,$8,$4,$3,1,transaction_timestamp()),
             ($9,$2,$3,2,'session.configured',1,NULL,$5,$6,1,$10::jsonb,$8,$4,$3,2,transaction_timestamp())`,
    [createdEventId, principal.organizationId, command.aggregateId, command.commandId, principal.principalId, releaseId,
      JSON.stringify({ sessionId: command.aggregateId, projectId: release.project_id, title, scheduledStartAt: start?.toISOString() ?? null }),
      correlationId, configuredEventId, JSON.stringify({ sessionId: command.aggregateId, governingReleaseId: releaseId })]);
    await client.query(`INSERT INTO sync.command_receipts
      (id,organization_id,session_id,command_id,payload_sha256,device_id,actor_person_id,actor_participant_id,
       authority_epoch,operation_type,aggregate_id,status,result_version,evidence_sequence,resolved_at,correlation_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,1,'session.create',$3,'accepted',2,2,transaction_timestamp(),$8)`,
    [randomUUID(), principal.organizationId, command.aggregateId, command.commandId, digest, command.deviceId,
      principal.principalId, correlationId]);
    await client.query(`INSERT INTO sync.session_delta_outbox(id,organization_id,session_id,event_id) VALUES
      ($1,$2,$3,$4),($5,$2,$3,$6)`,
    [randomUUID(), principal.organizationId, command.aggregateId, createdEventId, randomUUID(), configuredEventId]);
    await client.query(`INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
      VALUES ($1,$2,$3,'session.created',$4,$5::jsonb)`,
    [randomUUID(), principal.organizationId, principal.principalId, `session:${command.aggregateId}`,
      JSON.stringify({ correlationId, commandId: command.commandId, projectId: release.project_id, governingReleaseId: releaseId, status: "configured" })]);
    return { contractId: SESSION_CATALOG_CONTRACT_ID, sessionId: command.aggregateId, title, status: "configured",
      version: 2, governingReleaseId: releaseId, scheduledStartAt: start?.toISOString() ?? null, replayed: false,
      evidenceSequence: 2, detailUrl: `/sessions/${command.aggregateId}`,
      staffingUrl: `/admin/sessions/${command.aggregateId}#staffing-title` };
  });
}
