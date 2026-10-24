import { createHash } from "node:crypto";

import {
  REPLAY_DIVERGENCE_CONTRACT_ID,
  canonicalizeJson,
  type JsonObject,
  type JsonValue,
  type ReplayDivergenceV1
} from "@plenum/event-contracts";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";

export interface ReplayEvent extends JsonObject {
  sequence: number;
  eventType: string;
  eventVersion: number;
  governingReleaseId: string;
  aggregateId: string | null;
  aggregateVersion: number | null;
  body: JsonValue;
}

export interface SessionReplayInput {
  manifest: JsonObject;
  events: ReplayEvent[];
}

export interface SessionReplayAdapter {
  replay(input: SessionReplayInput): Promise<{ manifest: JsonObject; events: ReplayEvent[] }>;
}

const digest = (value: JsonValue): string => createHash("sha256").update(canonicalizeJson(value)).digest("hex");

export function compareReplay(
  sessionId: string,
  recorded: SessionReplayInput,
  replayed: SessionReplayInput,
  generatedAt = new Date()
): ReplayDivergenceV1 {
  const divergences: JsonObject[] = [];
  const recordedManifestDigest = digest(recorded.manifest);
  const replayedManifestDigest = digest(replayed.manifest);
  if (recordedManifestDigest !== replayedManifestDigest) {
    divergences.push({ code: "manifest_mismatch", sequence: null, recordedDigest: recordedManifestDigest, replayedDigest: replayedManifestDigest });
  }
  const count = Math.max(recorded.events.length, replayed.events.length);
  for (let index = 0; index < count; index += 1) {
    const expected = recorded.events[index];
    const actual = replayed.events[index];
    if (expected === undefined) {
      divergences.push({ code: "unexpected_event", sequence: actual?.sequence ?? null, recordedDigest: null, replayedDigest: digest(actual as ReplayEvent) });
    } else if (actual === undefined) {
      divergences.push({ code: "missing_event", sequence: expected.sequence, recordedDigest: digest(expected), replayedDigest: null });
    } else {
      const expectedDigest = digest(expected);
      const actualDigest = digest(actual);
      if (expectedDigest !== actualDigest) {
        divergences.push({ code: expected.sequence === actual.sequence ? "event_mismatch" : "event_reordered",
          sequence: expected.sequence, recordedDigest: expectedDigest, replayedDigest: actualDigest });
      }
    }
  }
  return {
    contractId: REPLAY_DIVERGENCE_CONTRACT_ID,
    sessionId,
    generatedAt: generatedAt.toISOString(),
    manifestDigest: recordedManifestDigest,
    matched: divergences.length === 0,
    comparedEvents: Math.min(recorded.events.length, replayed.events.length),
    divergences
  };
}

async function requireReplayRole(client: PoolClient, principal: AuthenticatedPrincipal, correlationId: string): Promise<void> {
  if (!principal.organizationRoles.some((role) => role === "admin" || role === "operator")) {
    throw authorizationError("PERMISSION_DENIED", "The Admin or Operator Organization Role is required.", correlationId);
  }
  const current = await client.query(
    `SELECT 1 FROM identity.authentication_sessions authentication_session
      JOIN identity.memberships membership
        ON membership.organization_id=authentication_session.organization_id AND membership.person_id=authentication_session.person_id
     WHERE authentication_session.organization_id=$1 AND authentication_session.id=$2 AND authentication_session.person_id=$3
       AND authentication_session.revoked_at IS NULL AND authentication_session.expires_at>transaction_timestamp()
       AND membership.organization_role=ANY($4::text[]) LIMIT 1`,
    [principal.organizationId, principal.authenticationSessionId, principal.principalId, ["admin", "operator"]]
  );
  if (current.rowCount !== 1) throw authorizationError("ACCESS_REVOKED", "Organization access is no longer active.", correlationId);
}

export async function replaySession(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  adapter: SessionReplayAdapter,
  correlationId: string,
  now = new Date()
): Promise<ReplayDivergenceV1> {
  const recorded = await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireReplayRole(client, principal, correlationId);
    const session = await client.query<{ initial_release_id: string; project_id: string; status: string }>(
      `SELECT initial_release_id,project_id,status FROM runtime.sessions WHERE organization_id=$1 AND id=$2`,
      [principal.organizationId, sessionId]
    );
    if (session.rows[0] === undefined) throw authorizationError("NOT_FOUND", "The Session was not found.", correlationId);
    const releases = await client.query<{ id: string; package_schema_version: string; compiler_version: string; package_sha256: string; snapshot: JsonObject }>(
      `SELECT release.id,release.package_schema_version,release.compiler_version,release.package_sha256,revision.snapshot
         FROM runtime.release_activations activation
         JOIN registry.releases release ON release.organization_id=activation.organization_id AND release.id=activation.release_id
         JOIN studio.definition_revisions revision ON revision.organization_id=release.organization_id AND revision.id=release.definition_revision_id
        WHERE activation.organization_id=$1 AND activation.session_id=$2 ORDER BY activation.activation_sequence`,
      [principal.organizationId, sessionId]
    );
    const modelRuns = await client.query<{ artifact_digest: string; configuration_digest: string; environment_digest: string | null; seed: string }>(
      `SELECT model_run.artifact_digest,model_run.configuration_digest,model_run.environment_digest,model_run.seed
         FROM extension.model_runs model_run JOIN extension.composition_runs composition_run ON composition_run.id=model_run.composition_run_id
        WHERE model_run.organization_id=$1 AND composition_run.session_id=$2 ORDER BY model_run.started_at,model_run.id`,
      [principal.organizationId, sessionId]
    );
    const source = await client.query<{
      sequence: string; event_type: string; event_version: number; governing_release_id: string;
      aggregate_id: string | null; aggregate_version: string | null; body: JsonValue;
    }>(
      `SELECT sequence,event_type,event_version,governing_release_id,aggregate_id,aggregate_version,body
         FROM evidence.events WHERE organization_id=$1 AND session_id=$2 ORDER BY sequence`,
      [principal.organizationId, sessionId]
    );
    const manifest: JsonObject = {
      sessionId,
      projectId: session.rows[0].project_id,
      initialReleaseId: session.rows[0].initial_release_id,
      sessionStatus: session.rows[0].status,
      releases: releases.rows.map((release) => ({ releaseId: release.id, packageSchemaVersion: release.package_schema_version,
        compilerVersion: release.compiler_version, packageSha256: release.package_sha256,
        randomSeed: (release.snapshot.scenario as JsonObject | undefined)?.randomSeed ?? null })),
      modelRuns: modelRuns.rows.map((run) => ({ pluginDigest: run.artifact_digest, configurationDigest: run.configuration_digest,
        environmentDigest: run.environment_digest, seed: Number(run.seed) }))
    };
    const events: ReplayEvent[] = source.rows.map((event) => ({ sequence: Number(event.sequence), eventType: event.event_type,
      eventVersion: event.event_version, governingReleaseId: event.governing_release_id, aggregateId: event.aggregate_id,
      aggregateVersion: event.aggregate_version === null ? null : Number(event.aggregate_version), body: event.body }));
    return { manifest, events };
  });
  const replayed = await adapter.replay(recorded);
  return compareReplay(sessionId, recorded, replayed, now);
}
