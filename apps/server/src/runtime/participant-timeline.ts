import type { PoolClient } from "pg";
import type { RuntimeProjectionV1, RuntimeTimelineV1 } from "@plenum/event-contracts";

const stageEvents = ["stage.started", "stage.paused", "stage.resumed", "stage.extended", "stage.ended", "stage.reopened", "stage.advanced", "stage.returned"];
const artifactEvents = ["artifact.created", "artifact.edited", "artifact.submitted", "artifact.forwarded", "artifact.returned", "artifact.accepted"];

/** Only project metadata for currently authorized records; never expose raw evidence bodies. */
export async function readParticipantTimeline(client: PoolClient, organizationId: string, sessionId: string,
  visible: Pick<RuntimeProjectionV1, "artifacts" | "messages" | "injects">,
  stages: Array<{ id: string; label: string }>, before?: number): Promise<RuntimeTimelineV1> {
  const artifacts = new Map(visible.artifacts.map((item) => [item.id, item.title]));
  const messages = new Map(visible.messages.map((item) => [item.id, item.channelId]));
  const injects = new Map(visible.injects.map((item) => [item.id, item.title]));
  const result = await client.query<{ id: string; sequence: string; occurred_at: Date; event_type: string;
    aggregate_id: string; aggregate_version: string | null; message_id: string | null; stage_id: string | null }>(
    `SELECT id,sequence,occurred_at,event_type,aggregate_id,aggregate_version,body->>'messageId' AS message_id,body->>'toStageId' AS stage_id
       FROM evidence.events WHERE organization_id=$1 AND session_id=$2 AND ($3::bigint IS NULL OR sequence<$3)
       AND ((aggregate_id=$2 AND event_type=ANY($4::text[]))
         OR (aggregate_id=ANY($5::uuid[]) AND event_type=ANY($6::text[]))
         OR (body->>'messageId'=ANY($7::text[]) AND event_type IN ('message.sent','message.delivered'))
         OR (aggregate_id=ANY($8::uuid[]) AND event_type='inject.released'))
       ORDER BY sequence DESC LIMIT 51`,
    [organizationId, sessionId, before ?? null, stageEvents, [...artifacts.keys()], artifactEvents, [...messages.keys()], [...injects.keys()]]);
  const entries: RuntimeTimelineV1["entries"] = result.rows.slice(0, 50).map((row) => {
    const category = row.event_type.split(".")[0] as RuntimeTimelineV1["entries"][number]["category"];
    return { id: row.id, sequence: Number(row.sequence), occurredAt: row.occurred_at.toISOString(), category,
      title: category === "stage" ? stages.find((stage) => stage.id === row.stage_id)?.label ?? "Session stage" : category === "artifact" ? artifacts.get(row.aggregate_id)!
        : category === "inject" ? injects.get(row.aggregate_id)! : (messages.get(row.message_id ?? "") ?? "Message").replaceAll("-", " "),
      activity: row.event_type.split(".")[1]!.replaceAll("_", " "), aggregateId: row.aggregate_id,
      version: row.aggregate_version === null ? null : Number(row.aggregate_version) };
  });
  return { entries, nextBefore: result.rows.length > 50 ? entries.at(-1)!.sequence : null };
}
