import {
  OPERATOR_PROJECTION_CONTRACT_ID,
  type OperatorProjectionV1
} from "@plenum/event-contracts";
import type { Pool } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";

async function requireCurrentOperator(
  client: import("pg").PoolClient,
  principal: AuthenticatedPrincipal,
  correlationId: string
): Promise<void> {
  if (!principal.organizationRoles.includes("operator")) {
    throw authorizationError("PERMISSION_DENIED", "Operator access is required.", correlationId);
  }
  const current = await client.query(
    `SELECT 1 FROM identity.authentication_sessions authentication_session
       JOIN identity.memberships membership
         ON membership.organization_id=authentication_session.organization_id
        AND membership.person_id=authentication_session.person_id
      WHERE authentication_session.organization_id=$1 AND authentication_session.id=$2
        AND authentication_session.person_id=$3 AND authentication_session.revoked_at IS NULL
        AND authentication_session.expires_at>transaction_timestamp()
        AND membership.organization_role='operator'`,
    [principal.organizationId, principal.authenticationSessionId, principal.principalId]
  );
  if (current.rowCount !== 1) {
    throw authorizationError("ACCESS_REVOKED", "Operator access is no longer active.", correlationId);
  }
}

export async function getOperatorProjection(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  correlationId: string
): Promise<OperatorProjectionV1> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentOperator(client, principal, correlationId);
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
    const deliveryCounts = await client.query<{ publication_status: "pending" | "dead_lettered"; count: string }>(
      `SELECT publication_status,count(*) FROM sync.session_delta_outbox
        WHERE organization_id=$1 AND session_id=$2 AND publication_status IN ('pending','dead_lettered')
        GROUP BY publication_status`,
      [principal.organizationId, sessionId]
    );
    const deadLetters = await client.query<{
      id: string; event_id: string; event_type: string; attempts: number; created_at: Date;
    }>(
      `SELECT item.id,item.event_id,event.event_type,item.attempts,item.created_at
         FROM sync.session_delta_outbox item
         JOIN evidence.events event ON event.organization_id=item.organization_id AND event.id=item.event_id
        WHERE item.organization_id=$1 AND item.session_id=$2 AND item.publication_status='dead_lettered'
        ORDER BY item.created_at,item.id LIMIT 100`,
      [principal.organizationId, sessionId]
    );
    const deliveryCount = (status: "pending" | "dead_lettered") =>
      Number(deliveryCounts.rows.find((item) => item.publication_status === status)?.count ?? 0);
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
      })),
      deliveryHealth: {
        pending: deliveryCount("pending"),
        deadLettered: deliveryCount("dead_lettered"),
        deadLetters: deadLetters.rows.map((item) => ({
          outboxId: item.id,
          eventId: item.event_id,
          eventType: item.event_type,
          attempts: item.attempts,
          createdAt: item.created_at.toISOString()
        }))
      }
    };
  });
}

export async function retryDeadLetteredRuntimeDelta(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  outboxId: string,
  correlationId: string
): Promise<{ outboxId: string; status: "pending" }> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentOperator(client, principal, correlationId);
    const retried = await client.query<{ id: string; event_id: string; attempts: number }>(
      `UPDATE sync.session_delta_outbox
          SET publication_status='pending',published_at=NULL
        WHERE organization_id=$1 AND session_id=$2 AND id=$3 AND publication_status='dead_lettered'
      RETURNING id,event_id,attempts`,
      [principal.organizationId, sessionId, outboxId]
    );
    const row = retried.rows[0];
    if (row === undefined) {
      throw authorizationError("NOT_FOUND", "The dead-lettered delivery was not found.", correlationId);
    }
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES (gen_random_uuid(),$1,$2,'delivery.dead_letter_retried',$3,$4::jsonb)`,
      [principal.organizationId, principal.principalId, `outbox:${outboxId}`,
        JSON.stringify({ correlationId, sessionId, eventId: row.event_id, priorAttempts: row.attempts })]
    );
    return { outboxId: row.id, status: "pending" };
  });
}
