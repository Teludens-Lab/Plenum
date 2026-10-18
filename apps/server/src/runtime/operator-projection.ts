import {
  OPERATOR_PROJECTION_CONTRACT_ID,
  type OperatorProjectionV1
} from "@plenum/event-contracts";
import type { Pool } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";

export async function getOperatorProjection(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  correlationId: string
): Promise<OperatorProjectionV1> {
  if (!principal.organizationRoles.includes("operator")) {
    throw authorizationError("PERMISSION_DENIED", "Operator access is required.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const session = await client.query<{ status: string; release_id: string; release_label: string }>(
      `SELECT session.status,activation.release_id,release.release_label
         FROM runtime.sessions session
         JOIN LATERAL (
           SELECT release_id FROM runtime.release_activations
            WHERE organization_id=session.organization_id AND session_id=session.id
            ORDER BY activation_sequence DESC LIMIT 1
         ) activation ON true
         JOIN registry.releases release
           ON release.organization_id=session.organization_id AND release.id=activation.release_id
        WHERE session.organization_id=$1 AND session.id=$2`,
      [principal.organizationId, sessionId]
    );
    const row = session.rows[0];
    if (row === undefined) throw authorizationError("NOT_FOUND", "The Session was not found.", correlationId);
    const participants = await client.query<{ count: string }>(
        "SELECT count(*) FROM runtime.participants WHERE organization_id=$1 AND session_id=$2",
        [principal.organizationId, sessionId]
      );
    const artifacts = await client.query<{ state: string; count: string }>(
        `SELECT state,count(*) FROM runtime.artifact_instances
          WHERE organization_id=$1 AND session_id=$2 GROUP BY state ORDER BY state`,
        [principal.organizationId, sessionId]
      );
    const tasks = await client.query<{ id: string; artifact_type_key: string; state: string; version: string }>(
        `SELECT id,artifact_type_key,state,version FROM runtime.artifact_instances
          WHERE organization_id=$1 AND session_id=$2 AND state <> 'accepted'
          ORDER BY updated_at,id LIMIT 100`,
        [principal.organizationId, sessionId]
      );
    const events = await client.query<{ event_type: string; recorded_at: Date; aggregate_id: string | null }>(
        `SELECT event_type,recorded_at,aggregate_id FROM evidence.events
          WHERE organization_id=$1 AND session_id=$2 ORDER BY sequence DESC LIMIT 20`,
        [principal.organizationId, sessionId]
      );
    const occupied = await client.query<{ count: string }>(
      `SELECT count(*) FROM runtime.seat_assignments
        WHERE organization_id=$1 AND session_id=$2 AND valid_to IS NULL`,
      [principal.organizationId, sessionId]
    );
    return {
      contractId: OPERATOR_PROJECTION_CONTRACT_ID,
      sessionId,
      sessionStatus: row.status,
      releaseId: row.release_id,
      releaseLabel: row.release_label,
      participantCount: Number(participants.rows[0]?.count ?? 0),
      occupiedSeatCount: Number(occupied.rows[0]?.count ?? 0),
      artifactsByState: Object.fromEntries(artifacts.rows.map((item) => [item.state, Number(item.count)])),
      activeTasks: tasks.rows.map((item) => ({
        artifactId: item.id,
        artifactTypeKey: item.artifact_type_key,
        state: item.state,
        version: Number(item.version)
      })),
      recentEvents: events.rows.map((event) => ({
        type: event.event_type,
        recordedAt: event.recorded_at.toISOString(),
        aggregateId: event.aggregate_id
      }))
    };
  });
}
