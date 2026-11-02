import { randomUUID } from "node:crypto";

import {
  REPORT_DEFINITION_CONTRACT_ID,
  RESEARCH_EXPORT_CONTRACT_ID,
  canonicalizeJson,
  type JsonObject,
  type JsonValue,
  type ReportDefinitionV1,
  type ReportKindV1,
  type ResearchExportV1
} from "@plenum/event-contracts";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import { requireCurrentOrganizationRole } from "../research/evidence.js";
import { createStoredZip, createTextPdf, csvCell, encodeJson, escapeHtml, sha256 } from "./formats.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const allowedFormats = new Set(["json", "jsonl", "csv", "html", "pdf", "zip"]);
const excludedClasses = ["direct_identity", "secret_ballot_choices", "protected_voice_assets", "reconstructed_transcript"];
const exportRetentionDays = 90;
// shortcut: one daily batch covers 10,000 exports; move to queued batches if an Organization can exceed that daily volume.
const retentionBatchSize = 10_000;

export type ReportFormat = "json" | "jsonl" | "csv" | "html" | "pdf" | "zip";

export interface ReportArtifact {
  artifactId: string;
  jobId: string;
  contentType: string;
  filename: string;
  bytes: Uint8Array;
  manifest: JsonObject;
  replayed: boolean;
}

export interface ReportRequest {
  idempotencyKey: string;
  reportKind: Exclude<ReportKindV1, "organization_archive">;
  format: ReportFormat;
  purposeLabel?: string;
}

async function requireAnyRole(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  roles: Array<"admin" | "operator">,
  correlationId: string
): Promise<void> {
  if (!principal.organizationRoles.some((role) => roles.includes(role as "admin" | "operator"))) {
    throw authorizationError("PERMISSION_DENIED", "The Admin or Operator Organization Role is required.", correlationId);
  }
  const current = await client.query(
    `SELECT 1 FROM identity.authentication_sessions authentication_session
      JOIN identity.memberships membership
        ON membership.organization_id=authentication_session.organization_id AND membership.person_id=authentication_session.person_id
     WHERE authentication_session.organization_id=$1 AND authentication_session.id=$2 AND authentication_session.person_id=$3
       AND authentication_session.revoked_at IS NULL AND authentication_session.expires_at>transaction_timestamp()
       AND membership.organization_role=ANY($4::text[]) LIMIT 1`,
    [principal.organizationId, principal.authenticationSessionId, principal.principalId, roles]
  );
  if (current.rowCount !== 1) throw authorizationError("ACCESS_REVOKED", "Organization access is no longer active.", correlationId);
}

export async function recordResearchConsent(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  purposeLabel: string,
  consentVersion: string,
  decision: "granted" | "withdrawn",
  correlationId: string
): Promise<{ consentId: string; decision: "granted" | "withdrawn"; recordedAt: string }> {
  if (!uuid.test(sessionId) || purposeLabel.trim().length === 0 || purposeLabel.length > 400 ||
      consentVersion.trim().length === 0 || consentVersion.length > 100) {
    throw authorizationError("VALIDATION_FAILED", "Session, research purpose, and consent version are required.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const participant = await client.query<{ id: string }>(
      `SELECT participant.id FROM runtime.participants participant
        JOIN identity.authentication_sessions authentication_session
          ON authentication_session.organization_id=participant.organization_id AND authentication_session.person_id=participant.person_id
       WHERE participant.organization_id=$1 AND participant.session_id=$2 AND participant.person_id=$3
         AND authentication_session.id=$4 AND authentication_session.revoked_at IS NULL
         AND authentication_session.expires_at>transaction_timestamp()`,
      [principal.organizationId, sessionId, principal.principalId, principal.authenticationSessionId]
    );
    if (participant.rows[0] === undefined) throw authorizationError("NOT_A_PARTICIPANT", "Current Session participation is required.", correlationId);
    const consentId = randomUUID();
    const inserted = await client.query<{ recorded_at: Date }>(
      `INSERT INTO reporting.research_consents
         (id,organization_id,session_id,participant_id,purpose_label,consent_version,decision,recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING recorded_at`,
      [consentId, principal.organizationId, sessionId, participant.rows[0].id, purposeLabel.trim(), consentVersion.trim(), decision, principal.principalId]
    );
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId,
        decision === "granted" ? "research.consent_granted" : "research.consent_withdrawn", `session:${sessionId}`,
        JSON.stringify({ correlationId, purposeLabel: purposeLabel.trim(), consentVersion: consentVersion.trim() })]
    );
    return { consentId, decision, recordedAt: inserted.rows[0]!.recorded_at.toISOString() };
  });
}

export async function recordAnalysis(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  input: {
    layer: "analytical_note" | "finding";
    content: JsonObject;
    sourceReferences: string[];
    confidence?: number;
    limitations: string;
  },
  correlationId: string,
  now = new Date()
): Promise<{ analysisId: string; recordedAt: string }> {
  if (!uuid.test(sessionId) || input.sourceReferences.length === 0 ||
      input.sourceReferences.some((reference) => reference.trim().length === 0 || reference.length > 500) ||
      (input.confidence !== undefined && (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1)) ||
      input.limitations.length > 4_000) {
    throw authorizationError("VALIDATION_FAILED", "The analytical record is invalid.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentOrganizationRole(client, principal, "research_analyst", correlationId);
    const access = await client.query(
      `SELECT 1 FROM runtime.sessions session
         JOIN evidence.research_access_grants access_grant
           ON access_grant.organization_id=session.organization_id AND access_grant.project_id=session.project_id
        WHERE session.organization_id=$1 AND session.id=$2 AND access_grant.analyst_person_id=$3
          AND access_grant.revoked_at IS NULL AND access_grant.expires_at>$4 LIMIT 1`,
      [principal.organizationId, sessionId, principal.principalId, now]
    );
    if (access.rowCount !== 1) {
      throw authorizationError("PERMISSION_DENIED", "An active project-scoped Research Access Grant is required.", correlationId);
    }
    const analysisId = randomUUID();
    const inserted = await client.query<{ recorded_at: Date }>(
      `INSERT INTO reporting.analytical_records
         (id,organization_id,session_id,layer,content,source_references,confidence,limitations,analyst_person_id)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9) RETURNING recorded_at`,
      [analysisId, principal.organizationId, sessionId, input.layer, JSON.stringify(input.content),
        input.sourceReferences.map((reference) => reference.trim()), input.confidence ?? null, input.limitations.trim(), principal.principalId]
    );
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'research.analysis_recorded',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `analytical_record:${analysisId}`,
        JSON.stringify({ correlationId, sessionId, layer: input.layer, sourceReferences: input.sourceReferences })]
    );
    return { analysisId, recordedAt: inserted.rows[0]!.recorded_at.toISOString() };
  });
}

export interface RetentionPolicyInput {
  policyKey: string;
  version: number;
  scopeType: "organization" | "project" | "artifact_type" | "message_channel" | "voice_channel" | "poll" | "session" | "export";
  scopeReference: string;
  periodDays: number;
  legalHoldBehavior: "retain" | "block_action";
  expiryAction: "archive" | "anonymize" | "delete";
  archiveDestination: string;
  approvalRequired: boolean;
}

export async function createRetentionPolicy(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: RetentionPolicyInput,
  correlationId: string
): Promise<{ policyId: string; version: number }> {
  if (input.policyKey.trim().length === 0 || !Number.isSafeInteger(input.version) || input.version < 1 ||
      input.scopeReference.trim().length === 0 || !Number.isSafeInteger(input.periodDays) || input.periodDays < 1 ||
      input.archiveDestination.trim().length === 0) {
    throw authorizationError("VALIDATION_FAILED", "The retention policy is incomplete.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentOrganizationRole(client, principal, "admin", correlationId);
    const policyId = randomUUID();
    await client.query(
      `INSERT INTO reporting.retention_policies
        (id,organization_id,policy_key,version,scope_type,scope_reference,period_days,legal_hold_behavior,
         expiry_action,archive_destination,approval_required,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [policyId, principal.organizationId, input.policyKey.trim(), input.version, input.scopeType, input.scopeReference.trim(),
        input.periodDays, input.legalHoldBehavior, input.expiryAction, input.archiveDestination.trim(), input.approvalRequired, principal.principalId]
    );
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'retention.policy_created',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `retention_policy:${policyId}`,
        JSON.stringify({ correlationId, policyKey: input.policyKey.trim(), version: input.version })]
    );
    return { policyId, version: input.version };
  });
}

export interface LegalHoldInput {
  scopeType: "organization" | "export";
  scopeReference: string;
  reason: string;
}

export async function placeLegalHold(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: LegalHoldInput,
  correlationId: string
): Promise<{ holdId: string; recordedAt: string }> {
  const scopeReference = input.scopeReference.trim();
  if (scopeReference.length === 0 || input.scopeReference.length > 200 ||
      (input.scopeType === "organization" && !["*", principal.organizationId].includes(scopeReference)) ||
      (input.scopeType === "export" && scopeReference !== "*" && !uuid.test(scopeReference)) ||
      input.reason.trim().length === 0 || input.reason.length > 4_000) {
    throw authorizationError("VALIDATION_FAILED", "The legal hold scope and reason are required.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentOrganizationRole(client, principal, "admin", correlationId);
    const holdId = randomUUID();
    const result = await client.query<{ recorded_at: Date }>(
      `INSERT INTO reporting.legal_hold_events
        (id,organization_id,hold_id,action,scope_type,scope_reference,reason,recorded_by)
       VALUES ($1,$2,$3,'placed',$4,$5,$6,$7) RETURNING recorded_at`,
      [randomUUID(), principal.organizationId, holdId, input.scopeType, scopeReference, input.reason.trim(), principal.principalId]
    );
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'retention.legal_hold_placed',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `legal_hold:${holdId}`,
        JSON.stringify({ correlationId, scopeType: input.scopeType, scopeReference })]
    );
    return { holdId, recordedAt: result.rows[0]!.recorded_at.toISOString() };
  });
}

export async function releaseLegalHold(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  holdId: string,
  reason: string,
  correlationId: string
): Promise<{ holdId: string; recordedAt: string }> {
  if (!uuid.test(holdId) || reason.trim().length === 0 || reason.length > 4_000) {
    throw authorizationError("VALIDATION_FAILED", "The legal hold and release reason are required.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentOrganizationRole(client, principal, "admin", correlationId);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`legal-hold:${principal.organizationId}:${holdId}`]);
    const current = await client.query<{ scope_type: LegalHoldInput["scopeType"]; scope_reference: string; released: boolean }>(
      `SELECT placed.scope_type,placed.scope_reference,EXISTS (
         SELECT 1 FROM reporting.legal_hold_events released
          WHERE released.organization_id=placed.organization_id AND released.hold_id=placed.hold_id AND released.action='released'
       ) AS released
         FROM reporting.legal_hold_events placed
        WHERE placed.organization_id=$1 AND placed.hold_id=$2 AND placed.action='placed'`,
      [principal.organizationId, holdId]
    );
    if (current.rows[0] === undefined) throw authorizationError("NOT_FOUND", "The legal hold was not found.", correlationId);
    if (current.rows[0].released) {
      throw authorizationError("INVALID_TRANSITION", "The legal hold is already released.", correlationId);
    }
    const result = await client.query<{ recorded_at: Date }>(
      `INSERT INTO reporting.legal_hold_events
        (id,organization_id,hold_id,action,scope_type,scope_reference,reason,recorded_by)
       VALUES ($1,$2,$3,'released',$4,$5,$6,$7) RETURNING recorded_at`,
      [randomUUID(), principal.organizationId, holdId, current.rows[0].scope_type, current.rows[0].scope_reference,
        reason.trim(), principal.principalId]
    );
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'retention.legal_hold_released',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `legal_hold:${holdId}`, JSON.stringify({ correlationId })]
    );
    return { holdId, recordedAt: result.rows[0]!.recorded_at.toISOString() };
  });
}

export interface RetentionEnforcementResult {
  purgedArtifacts: number;
  heldArtifacts: number;
  hasMore: boolean;
  cutoff: string;
}

export async function runRetentionEnforcement(
  pool: Pool,
  organizationId: string,
  actorPersonId: string,
  correlationId: string,
  now = new Date()
): Promise<RetentionEnforcementResult> {
  if (!uuid.test(organizationId) || !uuid.test(actorPersonId) || correlationId.trim().length === 0 || !Number.isFinite(now.getTime())) {
    throw new Error("Retention enforcement requires an Organization, service actor, correlation ID, and valid time");
  }
  return withOrganizationTransaction(pool, organizationId, async (client) => {
    const actor = await client.query(
      `SELECT 1 FROM identity.memberships WHERE organization_id=$1 AND person_id=$2
        AND organization_role='admin' LIMIT 1`, [organizationId, actorPersonId]
    );
    if (actor.rowCount !== 1) throw new Error("Retention service actor must be a current Organization Admin");

    const cutoff = new Date(now.getTime() - exportRetentionDays * 86_400_000);
    const purged = await client.query<{ id: string }>(
      `WITH active_holds AS (
         SELECT placed.hold_id,placed.scope_type,placed.scope_reference
           FROM reporting.legal_hold_events placed
          WHERE placed.organization_id=$1 AND placed.action='placed' AND NOT EXISTS (
            SELECT 1 FROM reporting.legal_hold_events released
             WHERE released.organization_id=placed.organization_id AND released.hold_id=placed.hold_id AND released.action='released'
          )
       ), eligible AS (
         SELECT artifact.id
           FROM reporting.export_artifacts artifact
           JOIN reporting.export_jobs job
             ON job.organization_id=artifact.organization_id AND job.id=artifact.job_id
          WHERE artifact.organization_id=$1 AND artifact.bytes IS NOT NULL AND artifact.created_at<$2
            AND NOT EXISTS (
              SELECT 1 FROM active_holds hold_event WHERE
                (hold_event.scope_type='organization' OR
                 (hold_event.scope_type='export' AND hold_event.scope_reference IN
                   ('*',artifact.id::text,job.id::text)))
            )
          ORDER BY artifact.created_at,artifact.id LIMIT $3
       )
       UPDATE reporting.export_artifacts artifact
          SET bytes=NULL,purged_at=$4,purged_by=$5
         FROM eligible WHERE artifact.organization_id=$1 AND artifact.id=eligible.id
       RETURNING artifact.id`,
      [organizationId, cutoff, retentionBatchSize, now, actorPersonId]
    );
    const status = await client.query<{ held: number; eligible: number }>(
      `WITH active_holds AS (
         SELECT placed.hold_id,placed.scope_type,placed.scope_reference
           FROM reporting.legal_hold_events placed
          WHERE placed.organization_id=$1 AND placed.action='placed' AND NOT EXISTS (
            SELECT 1 FROM reporting.legal_hold_events released
             WHERE released.organization_id=placed.organization_id AND released.hold_id=placed.hold_id AND released.action='released'
          )
       )
       SELECT
         count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM active_holds hold_event WHERE
             (hold_event.scope_type='organization' OR
              (hold_event.scope_type='export' AND hold_event.scope_reference IN ('*',artifact.id::text,job.id::text)))
         ))::integer AS held,
         count(*) FILTER (WHERE NOT EXISTS (
           SELECT 1 FROM active_holds hold_event WHERE
             (hold_event.scope_type='organization' OR
              (hold_event.scope_type='export' AND hold_event.scope_reference IN ('*',artifact.id::text,job.id::text)))
         ))::integer AS eligible
         FROM reporting.export_artifacts artifact
         JOIN reporting.export_jobs job ON job.organization_id=artifact.organization_id AND job.id=artifact.job_id
        WHERE artifact.organization_id=$1 AND artifact.bytes IS NOT NULL AND artifact.created_at<$2`,
      [organizationId, cutoff]
    );
    const result = {
      purgedArtifacts: purged.rowCount ?? 0,
      heldArtifacts: status.rows[0]?.held ?? 0,
      hasMore: (status.rows[0]?.eligible ?? 0) > 0,
      cutoff: cutoff.toISOString()
    };
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'retention.enforcement_completed',$4,$5::jsonb)`,
      [randomUUID(), organizationId, actorPersonId, `organization:${organizationId}`,
        JSON.stringify({ correlationId, policyKey: "OPEN-009-export-90-days", ...result })]
    );
    return result;
  });
}

export async function recordCorrection(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: { targetReference: string; originalValue: JsonValue; correctedValue: JsonValue; reason: string; reportsMustRegenerate: boolean },
  correlationId: string
): Promise<{ correctionId: string; correctedAt: string }> {
  if (input.targetReference.trim().length === 0 || input.reason.trim().length === 0 || input.reason.length > 4_000 ||
      canonicalizeJson(input.originalValue) === canonicalizeJson(input.correctedValue)) {
    throw authorizationError("VALIDATION_FAILED", "A changed value, target, and correction reason are required.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentOrganizationRole(client, principal, "admin", correlationId);
    const correctionId = randomUUID();
    const result = await client.query<{ corrected_at: Date }>(
      `INSERT INTO reporting.corrections
        (id,organization_id,target_reference,original_value,corrected_value,reason,reports_must_regenerate,corrected_by)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8) RETURNING corrected_at`,
      [correctionId, principal.organizationId, input.targetReference.trim(), JSON.stringify(input.originalValue),
        JSON.stringify(input.correctedValue), input.reason.trim(), input.reportsMustRegenerate, principal.principalId]
    );
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'report.correction_recorded',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, input.targetReference.trim(),
        JSON.stringify({ correlationId, correctionId, reportsMustRegenerate: input.reportsMustRegenerate })]
    );
    return { correctionId, correctedAt: result.rows[0]!.corrected_at.toISOString() };
  });
}

async function ensureDefinitions(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  reportKind: ReportRequest["reportKind"]
): Promise<{ definitionId: string; definition: ReportDefinitionV1; measurementId: string; measurementVersion: number }> {
  const excludedDataClasses = reportKind === "research_dataset"
    ? excludedClasses
    : ["secret_ballot_choices", "protected_voice_assets", "reconstructed_transcript"];
  const definition: ReportDefinitionV1 = {
    contractId: REPORT_DEFINITION_CONTRACT_ID,
    definitionKey: `plenum.${reportKind}`,
    definitionVersion: 1,
    reportKind,
    includedDataClasses: ["release_metadata", "session_metadata", "evidence_events", "measurement_definitions", "analytical_records"],
    excludedDataClasses,
    analyticalLayers: ["observation", "derived_metric", "analytical_note", "finding"]
  };
  const definitionId = randomUUID();
  await client.query(
    `INSERT INTO reporting.report_definitions(id,organization_id,definition_key,definition_version,report_kind,contract,created_by)
     VALUES ($1,$2,$3,1,$4,$5::jsonb,$6) ON CONFLICT (organization_id,definition_key,definition_version) DO NOTHING`,
    [definitionId, principal.organizationId, definition.definitionKey, reportKind, JSON.stringify(definition), principal.principalId]
  );
  const stored = await client.query<{ id: string }>(
    `SELECT id FROM reporting.report_definitions WHERE organization_id=$1 AND definition_key=$2 AND definition_version=1`,
    [principal.organizationId, definition.definitionKey]
  );
  const measurementId = randomUUID();
  await client.query(
    `INSERT INTO reporting.measurement_definitions
       (id,organization_id,measurement_key,version,research_question,definition,created_by)
     VALUES ($1,$2,'evidence_event_count',1,'How much captured Session activity is represented?',
       $3::jsonb,$4) ON CONFLICT (organization_id,measurement_key,version) DO NOTHING`,
    [measurementId, principal.organizationId, JSON.stringify({ formula: "count(observations)", sourceFields: ["evidence.events.id"],
      aggregationLevel: "session", timeWindow: "full_session", missingDataBehavior: "report_zero",
      interpretation: "Count of included captured Evidence Events", misinterpretationRisk: "Activity volume is not performance quality",
      validationMethod: "source_reconciliation", visualization: "number", exportFormat: "integer" }), principal.principalId]
  );
  const measurement = await client.query<{ id: string; version: number }>(
    `SELECT id,version FROM reporting.measurement_definitions
      WHERE organization_id=$1 AND measurement_key='evidence_event_count' ORDER BY version DESC LIMIT 1`, [principal.organizationId]
  );
  return { definitionId: stored.rows[0]!.id, definition, measurementId: measurement.rows[0]!.id, measurementVersion: measurement.rows[0]!.version };
}

function renderReport(report: JsonObject, format: ReportFormat, basename: string): Omit<ReportArtifact, "artifactId" | "jobId" | "manifest" | "replayed"> {
  const observations = report.observations as JsonObject[];
  const jsonBytes = encodeJson(report);
  if (format === "json") return { contentType: "application/json", filename: `${basename}.json`, bytes: jsonBytes };
  if (format === "jsonl") {
    const rows = ["observations", "derivedMetrics", "analyticalNotes", "findings"].flatMap((layer) =>
      (report[layer] as JsonObject[]).map((element) => canonicalizeJson({ layer, element })));
    return { contentType: "application/x-ndjson", filename: `${basename}.jsonl`, bytes: new TextEncoder().encode(`${rows.join("\n")}\n`) };
  }
  if (format === "csv") {
    const rows = ["elementId,eventType,recordedAt,subjectRef,sourceReferences",
      ...observations.map((item) => [item.elementId, item.eventType, item.recordedAt, item.subjectRef,
        (item.sourceReferences as string[]).join("|")].map(csvCell).join(","))];
    return { contentType: "text/csv; charset=utf-8", filename: `${basename}.csv`, bytes: new TextEncoder().encode(`${rows.join("\n")}\n`) };
  }
  if (format === "html") {
    const body = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escapeHtml(basename)}</title><body>` +
      `<h1>${escapeHtml(basename)}</h1><p>Captured History: ${observations.length} Evidence Events.</p>` +
      `<h2>Captured History</h2><table><thead><tr><th>Sequence</th><th>Event</th><th>Source</th></tr></thead><tbody>` +
      observations.map((item) => `<tr><td>${escapeHtml(item.sequence)}</td><td>${escapeHtml(item.eventType)}</td><td>${escapeHtml((item.sourceReferences as string[])[0])}</td></tr>`).join("") +
      `</tbody></table><h2>Reconstructed Narrative</h2><p>No transcript is asserted; analytical notes and findings are separately attributed.</p></body></html>`;
    return { contentType: "text/html; charset=utf-8", filename: `${basename}.html`, bytes: new TextEncoder().encode(body) };
  }
  if (format === "pdf") {
    return { contentType: "application/pdf", filename: `${basename}.pdf`, bytes: createTextPdf([
      basename, `Captured History: ${observations.length} Evidence Events`,
      "Reconstructed Narrative: no transcript asserted", ...observations.slice(0, 40).map((item) => `${item.sequence} ${item.eventType} ${(item.sourceReferences as string[])[0]}`)
    ]) };
  }
  const manifest = encodeJson(report.manifest as JsonObject);
  return { contentType: "application/zip", filename: `${basename}.zip`,
    bytes: createStoredZip([{ path: "manifest.json", bytes: manifest }, { path: "report.json", bytes: jsonBytes }]) };
}

export async function generateSessionReport(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  request: ReportRequest,
  correlationId: string,
  now = new Date()
): Promise<ReportArtifact> {
  if (!uuid.test(sessionId) || !uuid.test(request.idempotencyKey) || !allowedFormats.has(request.format) ||
      (request.reportKind === "research_dataset" && (request.purposeLabel?.trim().length ?? 0) === 0)) {
    throw authorizationError("VALIDATION_FAILED", "The report request is invalid.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    if (request.reportKind === "research_dataset") await requireCurrentOrganizationRole(client, principal, "research_analyst", correlationId);
    else await requireAnyRole(client, principal, ["admin", "operator"], correlationId);
    const requestSha = sha256(canonicalizeJson({ sessionId, ...request } as unknown as JsonObject));
    const existing = await client.query<{
      job_id: string; request_sha256: string; artifact_id: string; filename: string; content_type: string; bytes: Buffer | null; manifest: JsonObject;
    }>(
      `SELECT job.id AS job_id,job.request_sha256,artifact.id AS artifact_id,artifact.filename,artifact.content_type,artifact.bytes,artifact.manifest
         FROM reporting.export_jobs job JOIN reporting.export_artifacts artifact ON artifact.organization_id=job.organization_id AND artifact.job_id=job.id
        WHERE job.organization_id=$1 AND job.idempotency_key=$2`, [principal.organizationId, request.idempotencyKey]
    );
    if (existing.rows[0] !== undefined) {
      if (existing.rows[0].request_sha256 !== requestSha) throw authorizationError("IDEMPOTENCY_COLLISION", "The export key was reused with different inputs.", correlationId);
      const row = existing.rows[0];
      if (row.bytes === null) throw authorizationError("NOT_FOUND", "The export artifact expired under the retention policy.", correlationId);
      return { artifactId: row.artifact_id, jobId: row.job_id, contentType: row.content_type, filename: row.filename,
        bytes: row.bytes, manifest: row.manifest, replayed: true };
    }
    const session = await client.query<{ project_id: string; status: string; initial_release_id: string; created_at: Date }>(
      `SELECT project_id,status,initial_release_id,created_at FROM runtime.sessions WHERE organization_id=$1 AND id=$2`,
      [principal.organizationId, sessionId]
    );
    if (session.rows[0] === undefined) throw authorizationError("NOT_FOUND", "The Session was not found.", correlationId);
    if (request.reportKind === "research_dataset") {
      const grant = await client.query(
        `SELECT 1 FROM evidence.research_access_grants WHERE organization_id=$1 AND project_id=$2 AND analyst_person_id=$3
          AND revoked_at IS NULL AND expires_at>$4 LIMIT 1`,
        [principal.organizationId, session.rows[0].project_id, principal.principalId, now]
      );
      if (grant.rowCount !== 1) throw authorizationError("PERMISSION_DENIED", "An active project-scoped Research Access Grant is required.", correlationId);
    }
    const { definitionId, definition, measurementId, measurementVersion } = await ensureDefinitions(client, principal, request.reportKind);
    const releases = await client.query<{ id: string; package_schema_version: string; compiler_version: string; package_sha256: string; snapshot: JsonObject }>(
      `SELECT release.id,release.package_schema_version,release.compiler_version,release.package_sha256,revision.snapshot
         FROM runtime.release_activations activation
         JOIN registry.releases release ON release.organization_id=activation.organization_id AND release.id=activation.release_id
         JOIN studio.definition_revisions revision ON revision.organization_id=release.organization_id AND revision.id=release.definition_revision_id
        WHERE activation.organization_id=$1 AND activation.session_id=$2 ORDER BY activation.activation_sequence`,
      [principal.organizationId, sessionId]
    );
    const events = await client.query<{
      id: string; sequence: string; event_type: string; event_version: number; governing_release_id: string;
      aggregate_id: string | null; aggregate_version: string | null; recorded_at: Date; body: JsonValue; actor_participant_id: string | null;
    }>(
      `SELECT id,sequence,event_type,event_version,governing_release_id,aggregate_id,aggregate_version,recorded_at,body,actor_participant_id
         FROM evidence.events WHERE organization_id=$1 AND session_id=$2 ORDER BY sequence`, [principal.organizationId, sessionId]
    );
    let includedEvents = events.rows;
    if (request.reportKind === "research_dataset") {
      const consent = await client.query<{ participant_id: string; decision: "granted" | "withdrawn" }>(
        `SELECT DISTINCT ON (participant_id) participant_id,decision FROM reporting.research_consents
          WHERE organization_id=$1 AND session_id=$2 AND purpose_label=$3 ORDER BY participant_id,recorded_at DESC,id DESC`,
        [principal.organizationId, sessionId, request.purposeLabel!.trim()]
      );
      const granted = new Set(consent.rows.filter(({ decision }) => decision === "granted").map(({ participant_id }) => participant_id));
      includedEvents = events.rows.filter((event) => event.actor_participant_id === null || granted.has(event.actor_participant_id));
    }
    const participantIds = [...new Set(includedEvents.flatMap((event) => event.actor_participant_id === null ? [] : [event.actor_participant_id]))].sort();
    const pseudonyms = new Map(participantIds.map((id, index) => [id, `participant-${String(index + 1).padStart(4, "0")}`]));
    const observations: JsonObject[] = includedEvents.map((event) => ({ elementId: event.id, sequence: Number(event.sequence),
      eventType: event.event_type, eventVersion: event.event_version, governingReleaseId: event.governing_release_id,
      aggregateReference: request.reportKind === "research_dataset" && event.aggregate_id !== null
        ? `source-${sha256(event.aggregate_id).slice(0, 24)}` : event.aggregate_id,
      aggregateVersion: event.aggregate_version === null ? null : Number(event.aggregate_version),
      recordedAt: event.recorded_at.toISOString(), captureMode: "captured",
      subjectRef: event.actor_participant_id === null ? null : pseudonyms.get(event.actor_participant_id) ?? null,
      sourceReferences: [`evidence.event:${event.id}`],
      ...(request.reportKind === "research_dataset" ? {} : { body: event.body }) }));
    const analysis = await client.query<{ id: string; layer: "analytical_note" | "finding"; content: JsonObject; source_references: string[]; confidence: string | null; limitations: string; recorded_at: Date }>(
      `SELECT id,layer,content,source_references,confidence,limitations,recorded_at FROM reporting.analytical_records
        WHERE organization_id=$1 AND session_id=$2 ORDER BY recorded_at,id`, [principal.organizationId, sessionId]
    );
    const sourceReferences = observations.flatMap((observation) => observation.sourceReferences as string[]);
    const derivedMetrics: JsonObject[] = [{ elementId: randomUUID(), metricKey: "evidence_event_count", measurementDefinitionId: measurementId,
      measurementDefinitionVersion: measurementVersion, value: observations.length, sourceReferences }];
    const analyticalNotes = analysis.rows.filter(({ layer }) => layer === "analytical_note").map((row) => ({ elementId: row.id,
      content: row.content, confidence: row.confidence === null ? null : Number(row.confidence), limitations: row.limitations,
      recordedAt: row.recorded_at.toISOString(), sourceReferences: row.source_references }));
    const findings = analysis.rows.filter(({ layer }) => layer === "finding").map((row) => ({ elementId: row.id,
      content: row.content, confidence: row.confidence === null ? null : Number(row.confidence), limitations: row.limitations,
      recordedAt: row.recorded_at.toISOString(), sourceReferences: row.source_references }));
    const releaseIds = releases.rows.map(({ id }) => id);
    const reproducibilityManifests = releases.rows.map((release) => ({ sessionId, releaseId: release.id,
      packageSchemaVersion: release.package_schema_version, compilerVersion: release.compiler_version,
      packageSha256: release.package_sha256, randomSeed: (release.snapshot.scenario as JsonObject | undefined)?.randomSeed ?? null,
      sourceReferences: [`registry.release:${release.id}`] }));
    const exportId = randomUUID();
    const sourceReconciliation: JsonObject = { sourceRows: events.rowCount, includedRows: observations.length,
      excludedRows: (events.rowCount ?? 0) - observations.length, includedSourceSha256: sha256(canonicalizeJson(observations)) };
    const manifest: JsonObject = { definition, sessionId, projectId: session.rows[0].project_id, releaseIds,
      generatedAt: now.toISOString(), anonymizationProfile: request.reportKind === "research_dataset" ? "consent-filtered-ordinal-v1" : "none",
      includedDataClasses: definition.includedDataClasses, excludedDataClasses: definition.excludedDataClasses,
      sourceReconciliation };
    const report = request.reportKind === "research_dataset" ? {
      contractId: RESEARCH_EXPORT_CONTRACT_ID, exportId, projectId: session.rows[0].project_id, sessionIds: [sessionId], releaseIds,
      generatedAt: now.toISOString(), exportDefinitionVersion: definition.definitionVersion,
      anonymizationProfile: "consent-filtered-ordinal-v1", purposeLabel: request.purposeLabel!.trim(),
      includedDataClasses: definition.includedDataClasses, excludedDataClasses: definition.excludedDataClasses,
      reproducibilityManifests, observations, derivedMetrics, analyticalNotes, findings,
      provenance: { reportDefinitionId: definitionId, sourceReconciliation, capturedHistoryLabel: "Captured History",
        reconstructedNarrativeLabel: "Reconstructed Narrative", reconstructedNarrativeIsTranscript: false }
    } satisfies ResearchExportV1 : { reportDefinition: definition, manifest, capturedHistoryLabel: "Captured History",
      reconstructedNarrativeLabel: "Reconstructed Narrative", reconstructedNarrativeIsTranscript: false,
      observations, derivedMetrics, analyticalNotes, findings };
    const rendered = renderReport(report as JsonObject, request.format, `${request.reportKind}-${sessionId}`);
    const jobId = randomUUID();
    const artifactId = randomUUID();
    await client.query(
      `INSERT INTO reporting.export_jobs
        (id,organization_id,session_id,project_id,definition_id,idempotency_key,request_sha256,format,status,requested_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'completed',$9)`,
      [jobId, principal.organizationId, sessionId, session.rows[0].project_id, definitionId, request.idempotencyKey,
        requestSha, request.format, principal.principalId]
    );
    await client.query(
      `INSERT INTO reporting.export_artifacts(id,organization_id,job_id,filename,content_type,bytes,sha256,manifest)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [artifactId, principal.organizationId, jobId, rendered.filename, rendered.contentType, Buffer.from(rendered.bytes),
        sha256(rendered.bytes), JSON.stringify(manifest)]
    );
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'report.export_completed',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `report_artifact:${artifactId}`,
        JSON.stringify({ correlationId, jobId, sessionId, reportKind: request.reportKind, format: request.format, artifactSha256: sha256(rendered.bytes) })]
    );
    return { artifactId, jobId, ...rendered, manifest, replayed: false };
  });
}

export interface OrganizationArchive extends JsonObject {
  archiveVersion: 1;
  restoreContract: "plenum-organization-logical-v1";
  generatedAt: string;
  sourceOrganizationRef: string;
  data: JsonObject;
  dataSha256: string;
  excludedDataClasses: string[];
}

export async function exportOrganizationArchive(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  correlationId: string,
  now = new Date()
): Promise<OrganizationArchive> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentOrganizationRole(client, principal, "admin", correlationId);
    const query = async (sql: string): Promise<JsonObject[]> => (await client.query<{ value: JsonObject }>(sql, [principal.organizationId])).rows.map(({ value }) => value);
    const data: JsonObject = {
      organization: (await query("SELECT to_jsonb(organization) AS value FROM identity.organizations organization WHERE id=$1"))[0] ?? {},
      persons: await query(`SELECT to_jsonb(person) AS value FROM identity.persons person
        JOIN identity.memberships membership ON membership.person_id=person.id
        WHERE membership.organization_id=$1 GROUP BY person.id ORDER BY person.id`),
      memberships: await query("SELECT to_jsonb(membership) AS value FROM identity.memberships membership WHERE organization_id=$1 ORDER BY person_id,organization_role"),
      projects: await query("SELECT to_jsonb(project) AS value FROM studio.simulation_projects project WHERE organization_id=$1 ORDER BY id"),
      simulationTemplates: await query("SELECT to_jsonb(template) AS value FROM studio.simulation_templates template WHERE organization_id=$1 ORDER BY published_at,id"),
      templateLifecycleEvents: await query("SELECT to_jsonb(event) AS value FROM studio.template_lifecycle_events event WHERE organization_id=$1 ORDER BY occurred_at,id"),
      projectCollaborators: await query("SELECT to_jsonb(collaborator) AS value FROM studio.project_collaborators collaborator WHERE organization_id=$1 ORDER BY project_id,person_id,project_role"),
      projectMutationReceipts: await query("SELECT to_jsonb(receipt) AS value FROM studio.project_mutation_receipts receipt WHERE organization_id=$1 ORDER BY recorded_at,request_id"),
      collaborativeDocuments: await query("SELECT to_jsonb(document) AS value FROM studio.collaborative_documents document WHERE organization_id=$1 ORDER BY id"),
      publicationFreezes: await query("SELECT to_jsonb(publication_freeze) AS value FROM studio.publication_freezes publication_freeze WHERE organization_id=$1 ORDER BY frozen_at,id"),
      revisions: await query("SELECT to_jsonb(revision) AS value FROM studio.definition_revisions revision WHERE organization_id=$1 ORDER BY created_at,id"),
      releases: await query("SELECT to_jsonb(release) AS value FROM registry.releases release WHERE organization_id=$1 ORDER BY published_at,id"),
      sessions: await query("SELECT to_jsonb(session) AS value FROM runtime.sessions session WHERE organization_id=$1 ORDER BY created_at,id"),
      sessionAuthorities: await query("SELECT to_jsonb(authority) AS value FROM runtime.session_authorities authority WHERE organization_id=$1 ORDER BY session_id"),
      activationReviews: await query("SELECT to_jsonb(review) AS value FROM runtime.release_activation_reviews review WHERE organization_id=$1 ORDER BY reviewed_at,id"),
      activations: await query("SELECT to_jsonb(activation) AS value FROM runtime.release_activations activation WHERE organization_id=$1 ORDER BY session_id,activation_sequence"),
      participants: await query("SELECT to_jsonb(participant) AS value FROM runtime.participants participant WHERE organization_id=$1 ORDER BY session_id,id"),
      seatAssignments: await query("SELECT to_jsonb(assignment) AS value FROM runtime.seat_assignments assignment WHERE organization_id=$1 ORDER BY session_id,id"),
      artifacts: await query("SELECT to_jsonb(artifact) AS value FROM runtime.artifact_instances artifact WHERE organization_id=$1 ORDER BY session_id,id"),
      sessionSequences: await query("SELECT to_jsonb(session_sequence) AS value FROM evidence.session_sequences session_sequence WHERE organization_id=$1 ORDER BY session_id"),
      events: await query("SELECT to_jsonb(event) AS value FROM evidence.events event WHERE organization_id=$1 ORDER BY session_id,sequence"),
      checkpointBatches: await query("SELECT to_jsonb(checkpoint) AS value FROM evidence.checkpoint_batches checkpoint WHERE organization_id=$1 ORDER BY session_id,first_sequence"),
      checkpointSignatures: await query("SELECT to_jsonb(checkpoint_signature) AS value FROM evidence.checkpoint_signatures checkpoint_signature WHERE organization_id=$1 ORDER BY signed_at,id"),
      anchorReceipts: await query("SELECT to_jsonb(receipt) AS value FROM evidence.anchor_receipts receipt WHERE organization_id=$1 ORDER BY recorded_at,id"),
      reportDefinitions: await query("SELECT to_jsonb(definition) AS value FROM reporting.report_definitions definition WHERE organization_id=$1 ORDER BY definition_key,definition_version"),
      measurementDefinitions: await query("SELECT to_jsonb(measurement_definition) AS value FROM reporting.measurement_definitions measurement_definition WHERE organization_id=$1 ORDER BY measurement_key,version"),
      researchConsents: await query("SELECT to_jsonb(consent) AS value FROM reporting.research_consents consent WHERE organization_id=$1 ORDER BY recorded_at,id"),
      analyticalRecords: await query("SELECT to_jsonb(record) AS value FROM reporting.analytical_records record WHERE organization_id=$1 ORDER BY recorded_at,id"),
      retentionPolicies: await query("SELECT to_jsonb(policy) AS value FROM reporting.retention_policies policy WHERE organization_id=$1 ORDER BY policy_key,version"),
      legalHoldEvents: await query("SELECT to_jsonb(hold_event) AS value FROM reporting.legal_hold_events hold_event WHERE organization_id=$1 ORDER BY recorded_at,id"),
      corrections: await query("SELECT to_jsonb(correction) AS value FROM reporting.corrections correction WHERE organization_id=$1 ORDER BY corrected_at,id"),
      exportJobs: await query("SELECT to_jsonb(job) AS value FROM reporting.export_jobs job WHERE organization_id=$1 ORDER BY completed_at,id"),
      exportArtifacts: await query("SELECT to_jsonb(artifact) AS value FROM reporting.export_artifacts artifact WHERE organization_id=$1 ORDER BY created_at,id")
    };
    return { archiveVersion: 1, restoreContract: "plenum-organization-logical-v1", generatedAt: now.toISOString(), sourceOrganizationRef: sha256(principal.organizationId).slice(0, 24),
      data, dataSha256: sha256(canonicalizeJson(data)),
      excludedDataClasses: ["authentication_credentials", "secret_ballot_choices", "protected_voice_assets", "audit_record_details", "object_store_blobs"] };
  });
}

const logicalRestoreTables = [
  ["projects", "studio.simulation_projects"],
  ["projectCollaborators", "studio.project_collaborators"],
  ["projectMutationReceipts", "studio.project_mutation_receipts"],
  ["collaborativeDocuments", "studio.collaborative_documents"],
  ["publicationFreezes", "studio.publication_freezes"],
  ["simulationTemplates", "studio.simulation_templates"],
  ["templateLifecycleEvents", "studio.template_lifecycle_events"],
  ["revisions", "studio.definition_revisions"],
  ["releases", "registry.releases"],
  ["sessions", "runtime.sessions"],
  ["sessionAuthorities", "runtime.session_authorities"],
  ["activationReviews", "runtime.release_activation_reviews"],
  ["activations", "runtime.release_activations"],
  ["participants", "runtime.participants"],
  ["seatAssignments", "runtime.seat_assignments"],
  ["artifacts", "runtime.artifact_instances"],
  ["sessionSequences", "evidence.session_sequences"],
  ["events", "evidence.events"],
  ["checkpointBatches", "evidence.checkpoint_batches"],
  ["checkpointSignatures", "evidence.checkpoint_signatures"],
  ["anchorReceipts", "evidence.anchor_receipts"],
  ["reportDefinitions", "reporting.report_definitions"],
  ["measurementDefinitions", "reporting.measurement_definitions"],
  ["researchConsents", "reporting.research_consents"],
  ["analyticalRecords", "reporting.analytical_records"],
  ["retentionPolicies", "reporting.retention_policies"],
  ["legalHoldEvents", "reporting.legal_hold_events"],
  ["corrections", "reporting.corrections"],
  ["exportJobs", "reporting.export_jobs"],
  ["exportArtifacts", "reporting.export_artifacts"]
] as const;

function archiveRows(archive: OrganizationArchive, key: string, correlationId: string): JsonObject[] {
  const value = archive.data[key];
  if (!Array.isArray(value) || value.some((row) => row === null || Array.isArray(row) || typeof row !== "object")) {
    throw authorizationError("VALIDATION_FAILED", `The Organization archive dataset ${key} is invalid.`, correlationId);
  }
  return value as JsonObject[];
}

function optionalArchiveRows(archive: OrganizationArchive, key: string, correlationId: string): JsonObject[] {
  return archive.data[key] === undefined ? [] : archiveRows(archive, key, correlationId);
}

export async function importOrganizationArchive(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  archive: OrganizationArchive,
  correlationId: string
): Promise<{ importId: string; replayed: boolean; restoredRows: number }> {
  if (archive.archiveVersion !== 1 || archive.restoreContract !== "plenum-organization-logical-v1" ||
      !/^[0-9a-f]{64}$/u.test(archive.dataSha256) ||
      sha256(canonicalizeJson(archive.data)) !== archive.dataSha256) {
    throw authorizationError("VALIDATION_FAILED", "The Organization archive digest is invalid.", correlationId);
  }
  const organization = archive.data.organization;
  if (organization === null || Array.isArray(organization) || typeof organization !== "object" ||
      organization.id !== principal.organizationId ||
      archive.sourceOrganizationRef !== sha256(principal.organizationId).slice(0, 24)) {
    throw authorizationError("VALIDATION_FAILED", "The archive does not belong to the current Organization.", correlationId);
  }
  const persons = archiveRows(archive, "persons", correlationId);
  const memberships = archiveRows(archive, "memberships", correlationId);
  const optionalDatasets = new Set(["simulationTemplates", "templateLifecycleEvents", "projectCollaborators", "projectMutationReceipts", "legalHoldEvents"]);
  const datasets = logicalRestoreTables.map(([key, table]) => ({ key, table,
    rows: optionalDatasets.has(key) ? optionalArchiveRows(archive, key, correlationId) : archiveRows(archive, key, correlationId) }));
  const foreignDataset = memberships.some((row) => row.organization_id !== principal.organizationId) ? "memberships" :
    datasets.find(({ rows }) => rows.some((row) => row.organization_id !== principal.organizationId))?.key;
  if (foreignDataset !== undefined) {
    throw authorizationError("VALIDATION_FAILED", `The archive dataset ${foreignDataset} contains data from another Organization.`, correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentOrganizationRole(client, principal, "admin", correlationId);
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM reporting.organization_imports WHERE organization_id=$1 AND source_package_sha256=$2`,
      [principal.organizationId, archive.dataSha256]
    );
    if (existing.rows[0] !== undefined) return { importId: existing.rows[0].id, replayed: true, restoredRows: 0 };
    const target = await client.query<{ name: string }>("SELECT name FROM identity.organizations WHERE id=$1", [principal.organizationId]);
    if (target.rows[0]?.name !== organization.name) {
      throw authorizationError("VALIDATION_FAILED", "The target Organization identity does not match the archive.", correlationId);
    }
    const occupied = await client.query<{ table_name: string }>(logicalRestoreTables
      .map(([, table]) => `SELECT '${table}' AS table_name WHERE EXISTS (SELECT 1 FROM ${table} WHERE organization_id=$1)`)
      .join(" UNION ALL "), [principal.organizationId]);
    if (occupied.rows[0] !== undefined) {
      throw authorizationError("VALIDATION_FAILED", "Organization archives can only be restored into an empty Organization deployment.", correlationId);
    }
    const restoredPersons = await client.query(
      "INSERT INTO identity.persons SELECT * FROM jsonb_populate_recordset(NULL::identity.persons,$1::jsonb) ON CONFLICT (id) DO NOTHING",
      [JSON.stringify(persons)]
    );
    const conflictingPerson = await client.query(
      `SELECT 1 FROM jsonb_array_elements($1::jsonb) source(value)
        JOIN identity.persons person ON person.id=(source.value->>'id')::uuid
       WHERE person.display_name IS DISTINCT FROM source.value->>'display_name' LIMIT 1`,
      [JSON.stringify(persons)]
    );
    if (conflictingPerson.rows[0] !== undefined) {
      throw authorizationError("VALIDATION_FAILED", "An archived Person conflicts with the target identity bootstrap.", correlationId);
    }
    const restoredMemberships = await client.query(
      "INSERT INTO identity.memberships SELECT * FROM jsonb_populate_recordset(NULL::identity.memberships,$1::jsonb) ON CONFLICT DO NOTHING",
      [JSON.stringify(memberships)]
    );
    let restoredRows = (restoredPersons.rowCount ?? 0) + (restoredMemberships.rowCount ?? 0);
    for (const { table, rows } of datasets) {
      if (rows.length === 0) continue;
      const restored = table === "studio.simulation_projects"
        ? await client.query(
          `INSERT INTO studio.simulation_projects
             (id,organization_id,title,created_by,created_at,lifecycle_status,version,updated_at,archived_at,archived_by,source_template_id)
           SELECT id,organization_id,title,created_by,created_at,
                  coalesce(lifecycle_status,'active'),coalesce(version,1),coalesce(updated_at,created_at),
                  archived_at,archived_by,NULL
             FROM jsonb_populate_recordset(NULL::studio.simulation_projects,$1::jsonb)`,
          [JSON.stringify(rows)]
        )
        : await client.query(
          `INSERT INTO ${table} SELECT * FROM jsonb_populate_recordset(NULL::${table},$1::jsonb)`,
          [JSON.stringify(rows)]
        );
      restoredRows += restored.rowCount ?? 0;
    }
    const projectRows = datasets.find(({ table }) => table === "studio.simulation_projects")?.rows ?? [];
    const templateRows = datasets.find(({ table }) => table === "studio.simulation_templates")?.rows ?? [];
    if (templateRows.length > 0 && projectRows.some((row) => row.source_template_id !== null && row.source_template_id !== undefined)) {
      await client.query(
        `UPDATE studio.simulation_projects project
            SET source_template_id=source.source_template_id
           FROM jsonb_populate_recordset(NULL::studio.simulation_projects,$1::jsonb) source
          WHERE project.organization_id=$2 AND project.id=source.id AND source.source_template_id IS NOT NULL`,
        [JSON.stringify(projectRows), principal.organizationId]
      );
    }
    const collaboratorRows = datasets.find(({ table }) => table === "studio.project_collaborators")?.rows ?? [];
    if (collaboratorRows.length === 0 && projectRows.length > 0) {
      const owners = await client.query(
        `INSERT INTO studio.project_collaborators
           (organization_id,project_id,person_id,project_role,added_by,added_at)
         SELECT organization_id,id,created_by,'owner',created_by,created_at
           FROM studio.simulation_projects WHERE organization_id=$1
         ON CONFLICT DO NOTHING`,
        [principal.organizationId]
      );
      restoredRows += owners.rowCount ?? 0;
    }
    const importId = randomUUID();
    await client.query(
      `INSERT INTO reporting.organization_imports(id,organization_id,source_package_sha256,source_manifest,imported_by)
       VALUES ($1,$2,$3,$4::jsonb,$5)`,
      [importId, principal.organizationId, archive.dataSha256, JSON.stringify(archive), principal.principalId]
    );
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'organization.archive_imported',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `organization_import:${importId}`,
        JSON.stringify({ correlationId, sourcePackageSha256: archive.dataSha256, restoredRows })]
    );
    return { importId, replayed: false, restoredRows };
  });
}
