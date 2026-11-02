import { OPERATOR_PROJECTION_CONTRACT_ID, type OperatorProjectionV1 } from "@plenum/event-contracts";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";

type StageDefinition = {
  id: string; name?: string; label?: string; durationSeconds?: number;
  transitions?: Array<{ targetStageId: string; label?: string }>;
  operatorControls?: Partial<{ allowStart: boolean; allowEnd: boolean; allowReopen: boolean; allowExtend: boolean; allowSkip: boolean; allowReturnToPrevious: boolean }>;
  completionRequirements?: Array<{ id: string }>;
};
type InjectDefinition = { id: string; title: string; releaseMode: string };
const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

async function requireCurrentOperator(client: PoolClient, principal: AuthenticatedPrincipal, sessionId: string, correlationId: string) {
  if (!principal.organizationRoles.includes("operator")) throw authorizationError("PERMISSION_DENIED", "Operator access is required.", correlationId);
  const current = await client.query(
    `SELECT 1 FROM identity.authentication_sessions auth
       JOIN identity.memberships membership ON membership.organization_id=auth.organization_id AND membership.person_id=auth.person_id
       JOIN runtime.session_operators operator ON operator.organization_id=auth.organization_id AND operator.person_id=auth.person_id AND operator.session_id=$4
      WHERE auth.organization_id=$1 AND auth.id=$2 AND auth.person_id=$3 AND auth.revoked_at IS NULL
        AND auth.expires_at>transaction_timestamp() AND membership.organization_role='operator' AND operator.revoked_at IS NULL`,
    [principal.organizationId, principal.authenticationSessionId, principal.principalId, sessionId]
  );
  if (current.rowCount !== 1) throw authorizationError("ACCESS_REVOKED", "An active Session Operator assignment is required.", correlationId);
}

export async function getOperatorProjection(pool: Pool, principal: AuthenticatedPrincipal, sessionId: string, correlationId: string): Promise<OperatorProjectionV1> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentOperator(client, principal, sessionId, correlationId);
    const session = await client.query<{ title: string; status: string; version: string; release_id: string; release_label: string;
      authority_epoch: string; authority_status: string; snapshot: unknown }>(
      `SELECT session.title,session.status,session.version,activation.release_id,release.release_label,authority.authority_epoch,
              authority.status AS authority_status,(revision.snapshot - 'resources') #- '{coreDesign,resources}' AS snapshot
         FROM runtime.sessions session
         JOIN runtime.session_authorities authority ON authority.organization_id=session.organization_id AND authority.session_id=session.id
         JOIN LATERAL (SELECT release_id FROM runtime.release_activations WHERE organization_id=session.organization_id
           AND session_id=session.id ORDER BY activation_sequence DESC LIMIT 1) activation ON true
         JOIN registry.releases release ON release.organization_id=session.organization_id AND release.id=activation.release_id
         JOIN studio.definition_revisions revision ON revision.organization_id=release.organization_id AND revision.id=release.definition_revision_id
        WHERE session.organization_id=$1 AND session.id=$2`, [principal.organizationId, sessionId]
    );
    const row = session.rows[0];
    if (row === undefined) throw authorizationError("NOT_FOUND", "The Session was not found.", correlationId);
    const snapshot = asRecord(row.snapshot) ?? {}, core = asRecord(snapshot.coreDesign) ?? snapshot, scenario = asRecord(snapshot.scenario) ?? {};
    const stageDefinitions = Array.isArray(core.stages) ? core.stages as StageDefinition[] : [];
    const injectDefinitions = Array.isArray(scenario.injects) ? scenario.injects as InjectDefinition[] : [];
    const [participants, connected, seats, artifacts, tasks, events, stages, injects, adjudications, deliveryCounts, deadLetters] = await Promise.all([
      client.query<{ count: string }>("SELECT count(*) FROM runtime.participants WHERE organization_id=$1 AND session_id=$2", [principal.organizationId, sessionId]),
      client.query<{ count: string }>(`SELECT count(DISTINCT participant_id) FROM sync.projection_cursors WHERE organization_id=$1 AND session_id=$2 AND expires_at>transaction_timestamp()`, [principal.organizationId, sessionId]),
      client.query<{ total: string; occupied: string }>(`SELECT count(*) AS total,count(*) FILTER (WHERE EXISTS(SELECT 1 FROM runtime.seat_assignments assignment
        WHERE assignment.organization_id=seat.organization_id AND assignment.session_id=seat.session_id AND assignment.seat_id=seat.seat_id AND assignment.valid_to IS NULL)) AS occupied
        FROM runtime.session_seats seat WHERE seat.organization_id=$1 AND seat.session_id=$2`, [principal.organizationId, sessionId]),
      client.query<{ state: string; count: string }>("SELECT state,count(*) FROM runtime.artifact_instances WHERE organization_id=$1 AND session_id=$2 GROUP BY state ORDER BY state", [principal.organizationId, sessionId]),
      client.query<{ id: string; artifact_type_key: string; state: string; version: string }>(`SELECT id,artifact_type_key,state,version FROM runtime.artifact_instances
        WHERE organization_id=$1 AND session_id=$2 AND state <> 'accepted' ORDER BY updated_at,id LIMIT 100`, [principal.organizationId, sessionId]),
      client.query<{ sequence: string; event_type: string; recorded_at: Date; aggregate_id: string | null }>(`SELECT sequence,event_type,recorded_at,aggregate_id FROM evidence.events
        WHERE organization_id=$1 AND session_id=$2 ORDER BY sequence DESC LIMIT 50`, [principal.organizationId, sessionId]),
      client.query<{ stage_id: string; status: "not_started" | "active" | "paused" | "completed"; started_at: Date | null; paused_at: Date | null;
        accumulated_pause_seconds: string; extension_seconds: string; version: string; now: Date }>(`SELECT stage_id,status,started_at,paused_at,accumulated_pause_seconds,
        extension_seconds,version,transaction_timestamp() AS now FROM runtime.session_stage_state WHERE organization_id=$1 AND session_id=$2`, [principal.organizationId, sessionId]),
      client.query<{ id: string; inject_definition_id: string; title: string | null; state: string; version: string; scheduled_at: Date | null }>(`SELECT id,inject_definition_id,title,state,version,scheduled_at
        FROM runtime.inject_instances WHERE organization_id=$1 AND session_id=$2 ORDER BY COALESCE(scheduled_at,released_at),id`, [principal.organizationId, sessionId]),
      client.query<{ id: string; status: string; version: string; created_at: Date }>(`SELECT id,status,version,created_at FROM runtime.adjudication_requests
        WHERE organization_id=$1 AND session_id=$2 AND status NOT IN ('published','cancelled') ORDER BY created_at,id LIMIT 100`, [principal.organizationId, sessionId]),
      client.query<{ publication_status: "pending" | "dead_lettered"; count: string }>(`SELECT publication_status,count(*) FROM sync.session_delta_outbox WHERE organization_id=$1 AND session_id=$2
        AND publication_status IN ('pending','dead_lettered') GROUP BY publication_status`, [principal.organizationId, sessionId]),
      client.query<{ id: string; event_id: string; event_type: string; attempts: number; created_at: Date }>(`SELECT item.id,item.event_id,event.event_type,item.attempts,item.created_at
        FROM sync.session_delta_outbox item JOIN evidence.events event ON event.organization_id=item.organization_id AND event.id=item.event_id
        WHERE item.organization_id=$1 AND item.session_id=$2 AND item.publication_status='dead_lettered' ORDER BY item.created_at,item.id LIMIT 100`, [principal.organizationId, sessionId])
    ]);
    const stageRow = stages.rows[0], stageDefinition = stageDefinitions.find(({ id }) => id === stageRow?.stage_id) ?? stageDefinitions[0];
    const elapsed = stageRow?.started_at == null ? 0 : Math.max(0, Math.floor((((stageRow.status === "paused" && stageRow.paused_at !== null) ? stageRow.paused_at : stageRow.now).getTime()
      - stageRow.started_at.getTime()) / 1000 - Number(stageRow.accumulated_pause_seconds)));
    const duration = stageDefinition?.durationSeconds ?? null, extension = Number(stageRow?.extension_seconds ?? 0);
    const existingInjects = new Map(injects.rows.map((item) => [item.inject_definition_id, item]));
    const deadLettered = Number(deliveryCounts.rows.find((item) => item.publication_status === "dead_lettered")?.count ?? 0);
    const warnings: string[] = [];
    if (row.authority_status !== "active") warnings.push(`Session Authority is ${row.authority_status}. Mutations are fail-closed.`);
    if (deadLettered > 0) warnings.push(`${deadLettered} Runtime delivery item${deadLettered === 1 ? " is" : "s are"} dead-lettered.`);
    if (row.status === "active" && stageRow === undefined) warnings.push("The active Session has no initialized Stage state.");
    return {
      contractId: OPERATOR_PROJECTION_CONTRACT_ID, sessionId, sessionTitle: row.title, sessionStatus: row.status, sessionVersion: Number(row.version),
      releaseId: row.release_id, releaseLabel: row.release_label, authority: { epoch: Number(row.authority_epoch), status: row.authority_status },
      participantCount: Number(participants.rows[0]?.count ?? 0), connectedParticipantCount: Number(connected.rows[0]?.count ?? 0),
      occupiedSeatCount: Number(seats.rows[0]?.occupied ?? 0), totalSeatCount: Number(seats.rows[0]?.total ?? 0),
      stage: stageDefinition === undefined ? null : { id: stageDefinition.id, label: stageDefinition.label ?? stageDefinition.name ?? stageDefinition.id,
        status: stageRow?.status ?? "not_started", version: Number(stageRow?.version ?? 0), durationSeconds: duration, elapsedSeconds: elapsed,
        remainingSeconds: duration === null ? null : Math.max(0, duration + extension - elapsed), extensionSeconds: extension,
        transitions: (stageDefinition.transitions ?? []).map((item) => ({ targetStageId: item.targetStageId, label: item.label ?? item.targetStageId })),
        controls: { allowStart: stageDefinition.operatorControls?.allowStart === true, allowEnd: stageDefinition.operatorControls?.allowEnd === true,
          allowReopen: stageDefinition.operatorControls?.allowReopen === true, allowExtend: stageDefinition.operatorControls?.allowExtend === true,
          allowSkip: stageDefinition.operatorControls?.allowSkip === true, allowReturnToPrevious: stageDefinition.operatorControls?.allowReturnToPrevious === true } },
      artifactsByState: Object.fromEntries(artifacts.rows.map((item) => [item.state, Number(item.count)])),
      activeTasks: tasks.rows.map((item) => ({ artifactId: item.id, artifactTypeKey: item.artifact_type_key, state: item.state, version: Number(item.version) })),
      requiredSubmissions: (stageDefinition?.completionRequirements ?? []).map((item) => ({ id: item.id, label: item.id, complete: false })),
      injectQueue: injectDefinitions.map((definition) => { const instance = existingInjects.get(definition.id); return { id: instance?.id ?? null,
        definitionId: definition.id, title: instance?.title ?? definition.title, state: instance?.state ?? "pending", version: Number(instance?.version ?? 0),
        scheduledAt: instance?.scheduled_at?.toISOString() ?? null, releaseMode: definition.releaseMode }; }),
      adjudicationQueue: adjudications.rows.map((item) => ({ id: item.id, status: item.status, version: Number(item.version), createdAt: item.created_at.toISOString() })),
      warnings, recentEvents: events.rows.map((event) => ({ sequence: Number(event.sequence), type: event.event_type,
        recordedAt: event.recorded_at.toISOString(), aggregateId: event.aggregate_id })),
      deliveryHealth: { pending: Number(deliveryCounts.rows.find((item) => item.publication_status === "pending")?.count ?? 0), deadLettered,
        deadLetters: deadLetters.rows.map((item) => ({ outboxId: item.id, eventId: item.event_id, eventType: item.event_type, attempts: item.attempts,
          createdAt: item.created_at.toISOString() })) }
    };
  });
}
