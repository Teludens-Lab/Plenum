import { createHash, randomUUID } from "node:crypto";
import {
  RELEASE_ACTIVATION_CONTRACT_ID,
  canonicalizeJson,
  type CommandEnvelopeV1,
  type CommandReceiptV1,
  type CompatibilityReportV1,
  type JsonObject,
  type ReleaseActivationV1
} from "@plenum/event-contracts";
import { classifyReleaseCompatibility, type CompatibilityReleaseInput } from "@plenum/release-compiler";
import type { CoreDesignV1, ScenarioV1 } from "@plenum/simulation-schema";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import { processPrincipalSessionCommand, type PrincipalSessionCommandContext } from "./commands/processor.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface ReleaseImpactV1 extends JsonObject {
  sessionId: string;
  projectId: string;
  currentReleaseId: string;
  candidateReleaseId: string;
  activationSequence: number;
  report: CompatibilityReportV1;
  reportDigest: string;
  existingWorkflows: JsonObject[];
  openPolls: JsonObject[];
  inFlightCompositions: JsonObject[];
  queuedCommandCount: number;
  approvedImpactReviewId: string | null;
  approvedBy: string | null;
}

type ReleaseRow = {
  release_id: string;
  package_schema_version: string;
  compiler_version: string;
  snapshot: unknown;
  manifest: unknown;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function releaseInput(row: ReleaseRow, correlationId: string): CompatibilityReleaseInput {
  if (!record(row.snapshot)) throw authorizationError("INCOMPATIBLE_RELEASE", "The Release definition is unavailable.", correlationId);
  const coreDesign = record(row.snapshot.coreDesign) ? row.snapshot.coreDesign : row.snapshot;
  const scenario = record(row.snapshot.scenario) ? row.snapshot.scenario : {};
  const manifest = record(row.manifest) ? row.manifest : {};
  if (!record(coreDesign) || !record(scenario)) {
    throw authorizationError("INCOMPATIBLE_RELEASE", "The Release definition is invalid.", correlationId);
  }
  return {
    releaseId: row.release_id,
    schemaVersion: typeof manifest.schemaVersion === "string" ? manifest.schemaVersion : row.package_schema_version,
    compilerVersion: typeof manifest.compilerVersion === "string" ? manifest.compilerVersion : row.compiler_version,
    coreDesign: coreDesign as CoreDesignV1,
    scenario: scenario as unknown as ScenarioV1
  };
}

function reportDigest(report: CompatibilityReportV1): string {
  return createHash("sha256").update(canonicalizeJson(report)).digest("hex");
}

async function requireOperator(client: PoolClient, principal: AuthenticatedPrincipal, sessionId: string, correlationId: string) {
  if (!principal.organizationRoles.includes("operator")) {
    throw authorizationError("PERMISSION_DENIED", "An Operator Organization Role is required.", correlationId);
  }
  const result = await client.query(
    `SELECT 1 FROM runtime.session_operators
      WHERE organization_id=$1 AND session_id=$2 AND person_id=$3 AND revoked_at IS NULL`,
    [principal.organizationId, sessionId, principal.principalId]
  );
  if (result.rowCount !== 1) {
    throw authorizationError("PERMISSION_DENIED", "An active Session Operator assignment is required.", correlationId);
  }
}

async function requireImpactReviewAccess(client: PoolClient, principal: AuthenticatedPrincipal, sessionId: string, correlationId: string) {
  if (principal.organizationRoles.includes("reviewer")) {
    const reviewer = await client.query(
      "SELECT 1 FROM identity.memberships WHERE organization_id=$1 AND person_id=$2 AND organization_role='reviewer'",
      [principal.organizationId, principal.principalId]
    );
    if (reviewer.rowCount === 1) return;
  }
  await requireOperator(client, principal, sessionId, correlationId);
}

async function releaseImpact(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  candidateReleaseId: string,
  correlationId: string,
  lock = false,
  reviewAccess = false
): Promise<ReleaseImpactV1> {
  if (reviewAccess) await requireImpactReviewAccess(client, principal, sessionId, correlationId);
  else await requireOperator(client, principal, sessionId, correlationId);
  const session = await client.query<{ project_id: string; current_release_id: string; activation_sequence: string }>(
    `SELECT session.project_id,activation.release_id AS current_release_id,activation.activation_sequence
       FROM runtime.sessions session
       JOIN LATERAL (SELECT release_id,activation_sequence FROM runtime.release_activations
         WHERE organization_id=session.organization_id AND session_id=session.id
         ORDER BY activation_sequence DESC LIMIT 1) activation ON true
      WHERE session.organization_id=$1 AND session.id=$2${lock ? " FOR UPDATE OF session" : ""}`,
    [principal.organizationId, sessionId]
  );
  const current = session.rows[0];
  if (current === undefined) throw authorizationError("TARGET_NOT_FOUND", "The Session was not found.", correlationId);
  if (current.current_release_id === candidateReleaseId) {
    throw authorizationError("CONFLICT", "The candidate Release is already active.", correlationId);
  }
  const releases = await client.query<ReleaseRow>(
    `SELECT release.id AS release_id,release.package_schema_version,release.compiler_version,revision.snapshot,manifest.manifest
       FROM registry.releases release
       JOIN studio.definition_revisions revision ON revision.organization_id=release.organization_id
        AND revision.project_id=release.project_id AND revision.id=release.definition_revision_id
       LEFT JOIN registry.package_manifests manifest ON manifest.organization_id=release.organization_id AND manifest.release_id=release.id
      WHERE release.organization_id=$1 AND release.project_id=$2 AND release.id=ANY($3::uuid[])`,
    [principal.organizationId, current.project_id, [current.current_release_id, candidateReleaseId]]
  );
  const from = releases.rows.find((row) => row.release_id === current.current_release_id);
  const to = releases.rows.find((row) => row.release_id === candidateReleaseId);
  if (from === undefined || to === undefined) {
    throw authorizationError("REFERENCE_INVALID", "Both Releases must be published for this Project.", correlationId);
  }
  const report = classifyReleaseCompatibility(releaseInput(from, correlationId), releaseInput(to, correlationId));
  const digest = reportDigest(report);
  const approved = await client.query<{ id: string; display_name: string }>(
    `SELECT review.id,person.display_name FROM runtime.release_activation_reviews review
      JOIN identity.persons person ON person.id=review.reviewed_by
      LEFT JOIN identity.memberships membership ON membership.organization_id=review.organization_id
        AND membership.person_id=review.reviewed_by AND membership.organization_role='reviewer'
     WHERE review.organization_id=$1 AND review.session_id=$2 AND review.from_release_id=$3 AND review.to_release_id=$4
       AND review.report_sha256=$5 AND (review.change_classification<>'consequential' OR membership.person_id IS NOT NULL)
     ORDER BY review.reviewed_at DESC,review.id DESC LIMIT 1`,
    [principal.organizationId, sessionId, current.current_release_id, candidateReleaseId, digest]
  );
  const workflows = await client.query<{ governing_release_id: string; workflow_key: string; state: string; count: string }>(
      `SELECT governing_release_id,workflow_key,state,count(*)::text AS count FROM runtime.artifact_instances
        WHERE organization_id=$1 AND session_id=$2 GROUP BY governing_release_id,workflow_key,state
        ORDER BY governing_release_id,workflow_key,state`, [principal.organizationId, sessionId]);
  const polls = await client.query<{ id: string; definition_id: string; governing_release_id: string; status: string }>(
      `SELECT id,definition_id,governing_release_id,status FROM voting.polls
        WHERE organization_id=$1 AND session_id=$2 AND status='open' ORDER BY id`, [principal.organizationId, sessionId]);
  const compositions = await client.query<{ id: string; governing_release_id: string; status: string }>(
      `SELECT id,governing_release_id,status FROM extension.composition_runs
        WHERE organization_id=$1 AND session_id=$2 AND status IN ('pending','running') ORDER BY id`, [principal.organizationId, sessionId]);
  const queued = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM sync.command_receipts
        WHERE organization_id=$1 AND session_id=$2 AND status='received'`, [principal.organizationId, sessionId]);
  return {
    sessionId,
    projectId: current.project_id,
    currentReleaseId: current.current_release_id,
    candidateReleaseId,
    activationSequence: Number(current.activation_sequence),
    report,
    reportDigest: digest,
    existingWorkflows: workflows.rows.map((row) => ({ ...row, count: Number(row.count) })),
    openPolls: polls.rows,
    inFlightCompositions: compositions.rows,
    queuedCommandCount: Number(queued.rows[0]?.count ?? 0),
    approvedImpactReviewId: approved.rows[0]?.id ?? null,
    approvedBy: approved.rows[0]?.display_name ?? null
  };
}

export async function getReleaseImpact(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  candidateReleaseId: string,
  correlationId: string
): Promise<ReleaseImpactV1> {
  if (!uuid.test(sessionId) || !uuid.test(candidateReleaseId)) {
    throw authorizationError("INVALID_ID", "Valid Session and Release identifiers are required.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, (client) =>
    releaseImpact(client, principal, sessionId, candidateReleaseId, correlationId, false, true));
}

export async function reviewReleaseImpact(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  input: { candidateReleaseId: string; reportDigest: string; existingInstanceHandling: string },
  correlationId: string
): Promise<{ impactReviewId: string; reportDigest: string; reviewedAt: string }> {
  if (!uuid.test(input.candidateReleaseId) || !/^[0-9a-f]{64}$/u.test(input.reportDigest) || input.existingInstanceHandling !== "keep_existing") {
    throw authorizationError("VALIDATION_FAILED", "The impact review is invalid.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const impact = await releaseImpact(client, principal, sessionId, input.candidateReleaseId, correlationId, false, true);
    if (impact.report.classification === "consequential" && !principal.organizationRoles.includes("reviewer")) {
      throw authorizationError("PERMISSION_DENIED", "Consequential live activation requires a fresh Reviewer approval.", correlationId);
    }
    const authors = await client.query<{ author_person_ids: string[] }>(
      `SELECT COALESCE(frozen.author_person_ids,ARRAY[revision.author_id]::uuid[]) AS author_person_ids
         FROM registry.releases release
         JOIN studio.definition_revisions revision ON revision.organization_id=release.organization_id
          AND revision.id=release.definition_revision_id
         LEFT JOIN studio.publication_freezes AS frozen ON frozen.organization_id=revision.organization_id
          AND frozen.id=revision.source_freeze_id
        WHERE release.organization_id=$1 AND release.id=$2`,
      [principal.organizationId, input.candidateReleaseId]
    );
    if (impact.report.classification === "consequential" && (authors.rows[0]?.author_person_ids ?? []).includes(principal.principalId)) {
      throw authorizationError("PERMISSION_DENIED", "An author of the candidate Release cannot approve its consequential activation.", correlationId);
    }
    if (impact.reportDigest !== input.reportDigest) {
      throw authorizationError("VERSION_CONFLICT", "The compatibility report changed; review the current impact.", correlationId);
    }
    const id = randomUUID();
    const reviewed = await client.query<{ reviewed_at: Date }>(
      `INSERT INTO runtime.release_activation_reviews
        (id,organization_id,project_id,session_id,from_release_id,to_release_id,report,report_sha256,
         change_classification,existing_instance_handling,reviewed_by,reviewer_roles,policy_version,artifact_sha256,rationale,evidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,'keep_existing',$10,$11::text[],'OPEN-013.v1',$12,$13,$14::jsonb) RETURNING reviewed_at`,
      [id, principal.organizationId, impact.projectId, sessionId, impact.currentReleaseId, impact.candidateReleaseId,
        JSON.stringify(impact.report), impact.reportDigest, impact.report.classification, principal.principalId,
        principal.organizationRoles, impact.reportDigest, `Reviewed ${impact.report.classification.replaceAll("_", " ")} live-change impact.`,
        JSON.stringify({ correlationId, reportDigest: impact.reportDigest, existingInstanceHandling: "keep_existing" })]
    );
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'release.impact_reviewed',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `session:${sessionId}`,
        JSON.stringify({ correlationId, impactReviewId: id, fromReleaseId: impact.currentReleaseId,
          toReleaseId: impact.candidateReleaseId, reportDigest: impact.reportDigest,
          classification: impact.report.classification, existingInstanceHandling: "keep_existing",
          policyVersion: "OPEN-013.v1", actorRoles: principal.organizationRoles,
          artifactDigest: impact.reportDigest, evidence: { report: impact.report },
          rationale: `Reviewed ${impact.report.classification.replaceAll("_", " ")} live-change impact.` })]
    );
    return { impactReviewId: id, reportDigest: impact.reportDigest, reviewedAt: reviewed.rows[0]!.reviewed_at.toISOString() };
  });
}

export async function activateRelease(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  context: PrincipalSessionCommandContext,
  command: CommandEnvelopeV1,
  correlationId: string,
  deploymentId: string
): Promise<CommandReceiptV1> {
  const candidateReleaseId = command.payload.candidateReleaseId;
  const impactReviewId = command.payload.impactReviewId;
  const submittedDigest = command.payload.reportDigest;
  if (command.operationType !== "release.activate" || command.aggregateId !== context.sessionId ||
      typeof candidateReleaseId !== "string" || !uuid.test(candidateReleaseId) ||
      typeof impactReviewId !== "string" || !uuid.test(impactReviewId) ||
      typeof submittedDigest !== "string" || !/^[0-9a-f]{64}$/u.test(submittedDigest) ||
      command.payload.existingInstanceHandling !== "keep_existing") {
    throw authorizationError("INVALID_COMMAND", "The Release activation Command is invalid.", correlationId);
  }
  return processPrincipalSessionCommand({ pool, context, command, correlationId, deploymentId,
    lockSessionAndExecute: async ({ client, activeReleaseId }) => {
      if (!context.organizationRoles.includes("operator")) {
        return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "An Operator Organization Role is required." };
      }
      const assignment = await client.query(
        `SELECT 1 FROM runtime.session_operators WHERE organization_id=$1 AND session_id=$2 AND person_id=$3 AND revoked_at IS NULL`,
        [context.organizationId, context.sessionId, context.principalId]
      );
      if (assignment.rowCount !== 1) {
        return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "An active Session Operator assignment is required." };
      }
      const impact = await releaseImpact(client, principal, context.sessionId, candidateReleaseId, correlationId, true);
      if (impact.currentReleaseId !== activeReleaseId || command.expectedAggregateVersion !== impact.activationSequence) {
        return { status: "rejected", errorCode: "STALE_AGGREGATE_VERSION", message: "The active Release changed; review the current impact." };
      }
      if (impact.reportDigest !== submittedDigest) {
        return { status: "rejected", errorCode: "VERSION_CONFLICT", message: "The compatibility report changed; review the current impact." };
      }
      if (impact.report.blockedReasons.length > 0) {
        return { status: "rejected", errorCode: "INCOMPATIBLE_RELEASE", message: impact.report.blockedReasons.join(" ") };
      }
      const review = await client.query<{ reviewed_by: string }>(
        `SELECT review.reviewed_by FROM runtime.release_activation_reviews review
          LEFT JOIN identity.memberships membership ON membership.organization_id=review.organization_id
            AND membership.person_id=review.reviewed_by AND membership.organization_role='reviewer'
          WHERE review.organization_id=$1 AND review.session_id=$2 AND review.id=$3 AND review.from_release_id=$4 AND review.to_release_id=$5
            AND review.report_sha256=$6 AND review.existing_instance_handling='keep_existing'
            AND (review.change_classification<>'consequential' OR membership.person_id IS NOT NULL)`,
        [context.organizationId, context.sessionId, impactReviewId, activeReleaseId, candidateReleaseId, submittedDigest]
      );
      if (review.rowCount !== 1) {
        return { status: "rejected", errorCode: "REFERENCE_INVALID", message: "A current reviewed impact is required." };
      }
      const activationId = randomUUID();
      const sequence = impact.activationSequence + 1;
      const inserted = await client.query<{ activated_at: Date }>(
        `INSERT INTO runtime.release_activations
          (id,organization_id,project_id,session_id,release_id,previous_activation_id,activation_sequence,
           compatibility_policy,approved_by,impact_review_id,change_classification,existing_instance_handling)
         SELECT $1,$2,$3,$4,$5,id,$6,$7::jsonb,$8,$9,$10,'keep_existing'
           FROM runtime.release_activations WHERE organization_id=$2 AND session_id=$4 AND activation_sequence=$11
         RETURNING activated_at`,
        [activationId, context.organizationId, impact.projectId, context.sessionId, candidateReleaseId, sequence,
          JSON.stringify({ reportContractId: impact.report.contractId, reportDigest: submittedDigest }), context.principalId,
          impactReviewId, impact.report.classification, impact.activationSequence]
      );
      const activatedAt = inserted.rows[0]?.activated_at;
      if (activatedAt === undefined) {
        return { status: "rejected", errorCode: "STALE_AGGREGATE_VERSION", message: "The active Release changed; review the current impact." };
      }
      const event: ReleaseActivationV1 = {
        contractId: RELEASE_ACTIVATION_CONTRACT_ID,
        activationId,
        sessionId: context.sessionId,
        fromReleaseId: activeReleaseId,
        toReleaseId: candidateReleaseId,
        activationSequence: sequence,
        impactReviewId,
        compatibilityReportDigest: submittedDigest,
        classification: impact.report.classification,
        existingInstanceHandling: "keep_existing",
        activatedBy: context.principalId,
        activatedAt: activatedAt.toISOString()
      };
      await client.query(
        `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
         VALUES ($1,$2,$3,'release.activated',$4,$5::jsonb)`,
        [randomUUID(), context.organizationId, context.principalId, `session:${context.sessionId}`,
          JSON.stringify({ ...event, correlationId, policyVersion: "OPEN-013.v1", actorRoles: context.organizationRoles,
            artifactDigest: submittedDigest, approvedBy: review.rows[0]?.reviewed_by,
            evidence: { impactReviewId, compatibilityReportDigest: submittedDigest },
            rationale: "Activate the reviewed compatible Release for new work while preserving existing Governing Releases." })]
      );
      return { status: "accepted", aggregateVersion: sequence, eventType: "release.activated", eventPayload: event };
    }
  });
}

export async function getReleaseHistory(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  correlationId: string
): Promise<JsonObject> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireOperator(client, principal, sessionId, correlationId);
    const history = await client.query<{
      id: string; release_id: string; previous_activation_id: string | null; activation_sequence: string;
      impact_review_id: string | null; change_classification: string | null; existing_instance_handling: string | null;
      approved_by: string; activated_at: Date;
    }>(
      `SELECT id,release_id,previous_activation_id,activation_sequence,impact_review_id,change_classification,
              existing_instance_handling,approved_by,activated_at
         FROM runtime.release_activations WHERE organization_id=$1 AND session_id=$2 ORDER BY activation_sequence`,
      [principal.organizationId, sessionId]
    );
    if (history.rows.length === 0) throw authorizationError("TARGET_NOT_FOUND", "The Session was not found.", correlationId);
    return {
      sessionId,
      activeReleaseId: history.rows.at(-1)!.release_id,
      activations: history.rows.map((row) => ({ activationId: row.id, releaseId: row.release_id,
        previousActivationId: row.previous_activation_id, activationSequence: Number(row.activation_sequence),
        impactReviewId: row.impact_review_id, classification: row.change_classification,
        existingInstanceHandling: row.existing_instance_handling, approvedBy: row.approved_by,
        activatedAt: row.activated_at.toISOString() }))
    };
  });
}
