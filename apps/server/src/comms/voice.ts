import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  FLOOR_LEASE_CONTRACT_ID,
  VOICE_COMMAND_CONTRACT_ID,
  type FloorLeaseV1,
  type JsonObject,
  type MediaCredentialV1,
  type RuntimeVoiceChannelV1,
  type VoiceCommandReceiptV1
} from "@plenum/event-contracts";
import type { MediaProviderAdapter, MediaPermission, MediaParticipantInput } from "@plenum/media-adapter";
import { audienceAllows, type FieldAudience } from "@plenum/policy-engine";
import type { RuntimeActorSelectorV1, RuntimeVoiceChannelDefinitionV1 } from "@plenum/simulation-schema";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { SessionAccessContextV1 } from "../identity/context.js";
import type { CommandDecision, CommandExecutionContext } from "../runtime/commands/processor.js";

interface VoiceDefinition {
  communications: { voiceChannels: RuntimeVoiceChannelDefinitionV1[] };
  platformAdapters?: Array<{ id: string; digest: string }>;
  sessionRoles: Array<{ id: string; isControlRole?: boolean }>;
  seats: Array<{ id: string; teamId?: string }>;
}

interface ChannelRow {
  id: string;
  governing_release_id: string;
  definition_id: string;
  definition_revision: number;
  definition: RuntimeVoiceChannelDefinitionV1;
  status: "open" | "closed" | "degraded" | "unavailable";
  provider_adapter_digest: string;
  invited_participant_ids: string[];
  version: string;
}

interface ActiveAssignment {
  id: string;
  seat_id: string | null;
  session_role_id: string;
  participant_id: string;
}

interface FloorRequestInput {
  requestId: string;
  connectionId: string;
  expectedAuthorityEpoch: number;
  floorToken?: string;
  reason?: string;
}

export interface FloorOperationInput {
  pool: Pool;
  context: SessionAccessContextV1;
  channelId: string;
  deviceId: string;
  input: FloorRequestInput;
  correlationId: string;
  deploymentId: string;
  tokenSecret: string;
  mediaAdapter: MediaProviderAdapter;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const fail = (errorCode: "VALIDATION_FAILED" | "PERMISSION_DENIED" | "TARGET_NOT_FOUND" | "TARGET_EXISTS" |
  "STALE_AGGREGATE_VERSION" | "INCOMPATIBLE_RELEASE" | "INVALID_TRANSITION" | "CAPABILITY_UNAVAILABLE",
message: string, reconcile = false): CommandDecision => ({ status: reconcile ? "needs_reconciliation" : "rejected", errorCode, message });

async function readDefinition(client: PoolClient, organizationId: string, releaseId: string): Promise<VoiceDefinition> {
  const result = await client.query<{ snapshot: unknown }>(`SELECT revision.snapshot FROM registry.releases release
    JOIN studio.definition_revisions revision ON revision.organization_id=release.organization_id AND revision.id=release.definition_revision_id
    WHERE release.organization_id=$1 AND release.id=$2`, [organizationId, releaseId]);
  const snapshot = result.rows[0]?.snapshot;
  const definition = isRecord(snapshot) && isRecord(snapshot.coreDesign) ? snapshot.coreDesign : snapshot;
  if (!isRecord(definition) || !isRecord(definition.communications) || !Array.isArray(definition.sessionRoles) || !Array.isArray(definition.seats)) {
    throw new Error("Release lacks the Voice Channel definition");
  }
  const communications = definition.communications;
  return { ...definition, communications: { ...communications,
    voiceChannels: Array.isArray(communications.voiceChannels) ? communications.voiceChannels : [] } } as unknown as VoiceDefinition;
}

async function assignment(client: PoolClient, context: SessionAccessContextV1): Promise<ActiveAssignment | undefined> {
  return (await client.query<ActiveAssignment>(`SELECT id,seat_id,session_role_id,participant_id FROM runtime.seat_assignments
    WHERE organization_id=$1 AND session_id=$2 AND participant_id=$3 AND session_role_id=$4 AND valid_to IS NULL
    ORDER BY valid_from DESC,id LIMIT 1`, [context.organizationId, context.sessionId, context.participantId, context.activeSessionRoleId])).rows[0];
}

function selectorAllows(definition: VoiceDefinition, selector: RuntimeActorSelectorV1, context: SessionAccessContextV1,
  active: ActiveAssignment): boolean {
  const seat = definition.seats.find(({ id }) => id === active.seat_id);
  const role = definition.sessionRoles.find(({ id }) => id === active.session_role_id);
  return audienceAllows({ organizationId: context.organizationId, sessionId: context.sessionId,
    participantId: context.participantId, activeSessionRoleId: active.session_role_id,
    ...(seat?.teamId === undefined ? {} : { activeTeamId: seat.teamId }), isControlRole: role?.isControlRole === true,
    organizationRoles: context.organizationRoles }, selector as FieldAudience);
}

async function activeStageId(client: PoolClient, context: SessionAccessContextV1): Promise<string | undefined> {
  return (await client.query<{ stage_id: string }>(`SELECT stage_id FROM runtime.session_stage_state
    WHERE organization_id=$1 AND session_id=$2 AND status='active' ORDER BY updated_at DESC LIMIT 1`,
  [context.organizationId, context.sessionId])).rows[0]?.stage_id;
}

async function readChannel(client: PoolClient, context: SessionAccessContextV1, id: string, lock = false): Promise<ChannelRow | undefined> {
  return (await client.query<ChannelRow>(`SELECT id,governing_release_id,definition_id,definition_revision,definition,status,provider_adapter_digest,
    invited_participant_ids,version
    FROM comms.voice_channels WHERE organization_id=$1 AND session_id=$2 AND id=$3${lock ? " FOR UPDATE" : ""}`,
  [context.organizationId, context.sessionId, id])).rows[0];
}

function stageAllows(channel: RuntimeVoiceChannelDefinitionV1, stageId: string | undefined): boolean {
  return channel.activeStageIds === undefined || (stageId !== undefined && channel.activeStageIds.includes(stageId));
}

async function openChannel(input: CommandExecutionContext, adapter: MediaProviderAdapter): Promise<CommandDecision> {
  const { client, context, command, activeReleaseId } = input;
  if (command.governingReleaseId !== activeReleaseId) return fail("INCOMPATIBLE_RELEASE", "New Voice Channels use the active Release.", true);
  if (command.expectedAggregateVersion !== 0) return fail("STALE_AGGREGATE_VERSION", "A new Voice Channel starts at version zero.", true);
  const release = await readDefinition(client, context.organizationId, activeReleaseId);
  const definition = typeof command.payload.definitionId === "string"
    ? release.communications.voiceChannels.find(({ id }) => id === command.payload.definitionId) : undefined;
  const active = await assignment(client, context);
  if (definition === undefined || active === undefined) return fail("VALIDATION_FAILED", "The Voice Channel Definition is unavailable.");
  if (!selectorAllows(release, definition.canModerate, context, active)) return fail("PERMISSION_DENIED", "The Active Role Context cannot open this Voice Channel.");
  let invitedParticipantIds: string[] = [];
  if (definition.mode === "private_call") {
    const requested = command.payload.invitedParticipantIds;
    if (definition.canInvite === undefined || !selectorAllows(release, definition.canInvite, context, active)) {
      return fail("PERMISSION_DENIED", "The Active Role Context cannot invite Participants to this private call.");
    }
    if (!Array.isArray(requested) || requested.length === 0 || requested.some((id) => typeof id !== "string" || !uuid.test(id)) ||
        new Set(requested).size !== requested.length || requested.length >= definition.capacity) {
      return fail("VALIDATION_FAILED", "A private call requires distinct invited Participants within its capacity.");
    }
    const requestedIds = requested as string[];
    const invitees = (await client.query<{ participant_id: string }>(`SELECT DISTINCT participant_id FROM runtime.seat_assignments
      WHERE organization_id=$1 AND session_id=$2 AND participant_id=ANY($3::uuid[]) AND valid_to IS NULL`,
    [context.organizationId, context.sessionId, requestedIds])).rows.map(({ participant_id }) => participant_id);
    if (invitees.length !== requestedIds.length) return fail("VALIDATION_FAILED", "Every private-call invitee requires an active Seat Assignment.");
    invitedParticipantIds = [context.participantId, ...requestedIds];
  } else if (command.payload.invitedParticipantIds !== undefined) {
    return fail("VALIDATION_FAILED", "Invitations apply only to private calls.");
  }
  if (!stageAllows(definition, await activeStageId(client, context))) return fail("INVALID_TRANSITION", "The Voice Channel is not available in the active Stage.");
  if (definition.recordingPolicy !== "off" || definition.transcriptionPolicy !== "off") {
    return fail("CAPABILITY_UNAVAILABLE", "Recording and transcription remain disabled pending OPEN-027.");
  }
  if ((await client.query("SELECT 1 FROM comms.voice_channels WHERE organization_id=$1 AND id=$2", [context.organizationId, command.aggregateId])).rowCount !== 0) {
    return fail("TARGET_EXISTS", "The Voice Channel already exists.");
  }
  const revision = Number(command.payload.definitionRevision);
  const configuredDigest = release.platformAdapters?.find(({ id }) => id === definition.mediaProviderAdapterBindingId)?.digest;
  const digest = configuredDigest === undefined ? undefined : `sha256:${configuredDigest}`;
  if (!Number.isSafeInteger(revision) || revision < 1 || digest === undefined || digest !== adapter.digest) {
    return fail("INCOMPATIBLE_RELEASE", "The Release does not pin the active Media Provider Adapter.", true);
  }
  await client.query(`INSERT INTO comms.voice_channels
    (id,organization_id,session_id,governing_release_id,definition_id,definition_revision,definition,status,
     provider_binding_id,provider_adapter_digest,invited_participant_ids,authority_epoch,opened_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'open',$8,$9,$10::uuid[],$11,$12)`, [command.aggregateId, context.organizationId,
    context.sessionId, activeReleaseId, definition.id, revision, JSON.stringify(definition), definition.mediaProviderAdapterBindingId,
    digest, invitedParticipantIds, context.authorityEpoch, context.principalId]);
  return { status: "accepted", aggregateVersion: 1, eventType: "voice_channel.opened", eventPayload: {
    channelId: command.aggregateId, definitionId: definition.id, definitionRevision: revision,
    providerAdapterBindingId: definition.mediaProviderAdapterBindingId, providerAdapterDigest: digest
  } };
}

async function manageChannel(input: CommandExecutionContext, channel: ChannelRow): Promise<CommandDecision> {
  const { client, context, command } = input;
  const version = Number(channel.version);
  if (command.governingReleaseId !== channel.governing_release_id) return fail("INCOMPATIBLE_RELEASE", "The Voice Channel is governed by another Release.", true);
  if (command.expectedAggregateVersion !== version) return fail("STALE_AGGREGATE_VERSION", `The Voice Channel is at version ${version}.`, true);
  const release = await readDefinition(client, context.organizationId, channel.governing_release_id);
  const active = await assignment(client, context);
  if (active === undefined) return fail("PERMISSION_DENIED", "An active Seat Assignment is required.");
  const listen = selectorAllows(release, channel.definition.canListen, context, active);
  const transmit = selectorAllows(release, channel.definition.canTransmit, context, active);
  const moderate = selectorAllows(release, channel.definition.canModerate, context, active);
  if (!stageAllows(channel.definition, await activeStageId(client, context))) return fail("INVALID_TRANSITION", "The Voice Channel is not available in the active Stage.");
  if (command.operationType === "voice_channel.join") {
    if (channel.status !== "open" || !listen ||
        (channel.definition.mode === "private_call" && !channel.invited_participant_ids.includes(context.participantId))) {
      return fail("PERMISSION_DENIED", "The Active Role Context cannot join this Voice Channel.");
    }
    const permissions: MediaPermission[] = ["listen", ...(transmit && channel.definition.mode !== "radio_ptt" ? ["transmit" as const] : []),
      ...(moderate ? ["moderate" as const] : [])];
    await client.query(`INSERT INTO comms.voice_grants
      (id,organization_id,session_id,channel_id,seat_assignment_id,participant_id,can_listen,can_transmit,can_moderate,
       valid_until,policy_revision,access_revision,authority_epoch)
      VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,transaction_timestamp()+interval '60 seconds',$9,$10,$11)
      ON CONFLICT(channel_id,seat_assignment_id) DO UPDATE SET can_listen=true,can_transmit=EXCLUDED.can_transmit,
        can_moderate=EXCLUDED.can_moderate,valid_until=EXCLUDED.valid_until,revoked_at=NULL,provider_revoked_at=NULL,policy_revision=EXCLUDED.policy_revision,
        access_revision=EXCLUDED.access_revision,authority_epoch=EXCLUDED.authority_epoch,updated_at=transaction_timestamp()`,
    [randomUUID(), context.organizationId, context.sessionId, channel.id, active.id, context.participantId,
      permissions.includes("transmit"), permissions.includes("moderate"), version, context.accessRevision, context.authorityEpoch]);
    return { status: "accepted", aggregateVersion: version, eventType: "voice_channel.joined", eventPayload: {
      contractId: VOICE_COMMAND_CONTRACT_ID, channelId: channel.id, seatAssignmentId: active.id, permissions
    } };
  }
  if (command.operationType === "voice_channel.leave") {
    await client.query(`UPDATE comms.voice_grants SET revoked_at=transaction_timestamp(),updated_at=transaction_timestamp()
      WHERE organization_id=$1 AND channel_id=$2 AND seat_assignment_id=$3 AND revoked_at IS NULL`,
    [context.organizationId, channel.id, active.id]);
    await client.query(`UPDATE comms.floor_leases SET active=false,released_at=transaction_timestamp(),version=version+1
      WHERE organization_id=$1 AND channel_id=$2 AND holder_seat_assignment_id=$3 AND active`,
    [context.organizationId, channel.id, active.id]);
    return { status: "accepted", aggregateVersion: version, eventType: "voice_channel.left", eventPayload: {
      channelId: channel.id, seatAssignmentId: active.id
    } };
  }
  if (command.operationType === "voice_channel.close") {
    if (!moderate || channel.status !== "open") return fail(moderate ? "INVALID_TRANSITION" : "PERMISSION_DENIED", "The Voice Channel cannot be closed.");
    const next = version + 1;
    await client.query(`UPDATE comms.voice_channels SET status='closed',closed_at=transaction_timestamp(),version=$3,updated_at=transaction_timestamp()
      WHERE organization_id=$1 AND id=$2`, [context.organizationId, channel.id, next]);
    await client.query(`UPDATE comms.voice_grants SET revoked_at=transaction_timestamp(),updated_at=transaction_timestamp()
      WHERE organization_id=$1 AND channel_id=$2 AND revoked_at IS NULL`, [context.organizationId, channel.id]);
    await client.query(`UPDATE comms.floor_leases SET active=false,released_at=transaction_timestamp(),version=version+1
      WHERE organization_id=$1 AND channel_id=$2 AND active`, [context.organizationId, channel.id]);
    return { status: "accepted", aggregateVersion: next, eventType: "voice_channel.closed", eventPayload: { channelId: channel.id } };
  }
  if (command.operationType === "voice_channel.moderate") {
    if (!moderate) return fail("PERMISSION_DENIED", "The Active Role Context cannot moderate this Voice Channel.");
    const targetParticipantId = command.payload.targetParticipantId;
    const action = command.payload.action;
    const reason = typeof command.payload.reason === "string" ? command.payload.reason.trim() : "";
    if (typeof targetParticipantId !== "string" || reason.length === 0 || (action !== "mute" && action !== "remove")) {
      return fail("VALIDATION_FAILED", "Moderation requires a target, action and reason.");
    }
    const result = await client.query<{ seat_assignment_id: string }>(`UPDATE comms.voice_grants SET can_transmit=false,
      revoked_at=CASE WHEN $4='remove' THEN transaction_timestamp() ELSE revoked_at END,updated_at=transaction_timestamp()
      WHERE organization_id=$1 AND channel_id=$2 AND participant_id=$3 AND revoked_at IS NULL RETURNING seat_assignment_id`,
    [context.organizationId, channel.id, targetParticipantId, action]);
    if (result.rowCount !== 1) return fail("TARGET_NOT_FOUND", "The Voice Channel Participant was not found.");
    return { status: "accepted", aggregateVersion: version,
      eventType: action === "remove" ? "voice_channel.left" : "intervention.recorded",
      eventPayload: { channelId: channel.id, targetParticipantId, action, reason } };
  }
  return fail("CAPABILITY_UNAVAILABLE", "Recording and transcription remain disabled pending OPEN-027.");
}

export function createVoiceCommandExecutor(adapter: MediaProviderAdapter) {
  return async (input: CommandExecutionContext): Promise<CommandDecision> => {
  if (input.command.operationType === "voice_channel.open") return openChannel(input, adapter);
  const channel = await readChannel(input.client, input.context, input.command.aggregateId, true);
  if (channel === undefined) return fail("TARGET_NOT_FOUND", "The Voice Channel was not found.");
  return manageChannel(input, channel);
  };
}

export async function getVoiceProjection(client: PoolClient, context: SessionAccessContextV1): Promise<RuntimeVoiceChannelV1[]> {
  const release = await readDefinition(client, context.organizationId, context.activeReleaseId);
  const active = await assignment(client, context);
  if (active === undefined) return [];
  const stageId = await activeStageId(client, context);
  const rows = (await client.query<ChannelRow>(`SELECT id,governing_release_id,definition_id,definition_revision,definition,status,provider_adapter_digest,
    invited_participant_ids,version
    FROM comms.voice_channels WHERE organization_id=$1 AND session_id=$2 AND status IN ('open','degraded','unavailable') ORDER BY opened_at,id`,
  [context.organizationId, context.sessionId])).rows;
  const projection: RuntimeVoiceChannelV1[] = [];
  for (const channel of rows) {
    if (channel.status === "closed") continue;
    if (channel.definition.mode === "private_call" && !channel.invited_participant_ids.includes(context.participantId)) continue;
    const status: RuntimeVoiceChannelV1["status"] = channel.status;
    const definition = release.communications.voiceChannels.find(({ id }) => id === channel.definition_id) ?? channel.definition;
    const canListen = selectorAllows(release, definition.canListen, context, active);
    const canModerate = selectorAllows(release, definition.canModerate, context, active);
    if ((!canListen && !canModerate) || !stageAllows(definition, stageId)) continue;
    const grant = await client.query<{ can_transmit: boolean }>(`SELECT can_transmit FROM comms.voice_grants WHERE organization_id=$1 AND channel_id=$2
      AND seat_assignment_id=$3 AND revoked_at IS NULL AND valid_until>transaction_timestamp()`, [context.organizationId, channel.id, active.id]);
    const floor = await client.query<{ expires_at: Date }>(`SELECT expires_at FROM comms.floor_leases WHERE organization_id=$1 AND channel_id=$2
      AND holder_seat_assignment_id=$3 AND active AND expires_at>transaction_timestamp()`, [context.organizationId, channel.id, active.id]);
    const joined = grant.rowCount === 1;
    const held = floor.rowCount === 1;
    const canTransmit = selectorAllows(release, definition.canTransmit, context, active);
    projection.push({ id: channel.id, definitionId: channel.definition_id, name: definition.name, mode: definition.mode,
      status, joined, canListen, canTransmit, canModerate,
      microphoneState: !joined ? "unavailable" : held ? "transmitting" : canTransmit ? "ready" : "muted",
      floorHeldByMe: held, floorExpiresAt: floor.rows[0]?.expires_at.toISOString() ?? null,
      version: Number(channel.version), governingReleaseId: channel.governing_release_id });
  }
  return projection;
}

export async function issueMediaCredential(pool: Pool, context: SessionAccessContextV1, channelId: string,
  adapter: MediaProviderAdapter, correlationId: string): Promise<MediaCredentialV1> {
  const grant = await withOrganizationTransaction(pool, context.organizationId, async (client) => {
    const channel = await readChannel(client, context, channelId);
    const active = await assignment(client, context);
    if (channel === undefined || active === undefined || channel.status !== "open") {
      throw authorizationError("TARGET_NOT_FOUND", "The Voice Channel was not found.", correlationId);
    }
    if (channel.provider_adapter_digest !== adapter.digest) {
      throw authorizationError("CAPABILITY_UNAVAILABLE", "The active provider does not match the Release-pinned adapter.", correlationId);
    }
    const row = (await client.query<{ can_listen: boolean; can_transmit: boolean; can_moderate: boolean }>(`SELECT can_listen,can_transmit,can_moderate
      FROM comms.voice_grants WHERE organization_id=$1 AND channel_id=$2 AND seat_assignment_id=$3 AND revoked_at IS NULL
      AND valid_until>transaction_timestamp() AND access_revision=$4 AND authority_epoch=$5`,
    [context.organizationId, channelId, active.id, context.accessRevision, context.authorityEpoch])).rows[0];
    if (row === undefined) throw authorizationError("ACCESS_REVOKED", "The Voice grant is expired or revoked.", correlationId);
    return { channel, permissions: [row.can_listen ? "listen" as const : null, row.can_transmit ? "transmit" as const : null,
      row.can_moderate ? "moderate" as const : null].filter((value): value is MediaPermission => value !== null) };
  });
  return adapter.issueCredential({ organizationId: context.organizationId, sessionId: context.sessionId, channelId,
    participantId: context.participantId, permissions: grant.permissions, capacity: grant.channel.definition.capacity, ttlSeconds: 30 });
}

export async function reconcileRevokedVoiceParticipants(pool: Pool, context: SessionAccessContextV1,
  adapter: MediaProviderAdapter): Promise<void> {
  for (;;) {
    const participants = await withOrganizationTransaction(pool, context.organizationId, async (client) =>
      (await client.query<{id:string;channel_id:string;participant_id:string}>(`SELECT grant_row.id,grant_row.channel_id,grant_row.participant_id
        FROM comms.voice_grants grant_row JOIN comms.voice_channels channel ON channel.organization_id=grant_row.organization_id AND channel.id=grant_row.channel_id
        WHERE grant_row.organization_id=$1 AND grant_row.session_id=$2 AND grant_row.revoked_at IS NOT NULL
          AND grant_row.provider_revoked_at IS NULL AND channel.status<>'closed' ORDER BY grant_row.id LIMIT 100`,
      [context.organizationId,context.sessionId])).rows);
    if (participants.length === 0) return;
    await Promise.all(participants.map(({channel_id,participant_id}) => adapter.removeParticipant({organizationId:context.organizationId,
      sessionId:context.sessionId,channelId:channel_id,participantId:participant_id})));
    await withOrganizationTransaction(pool,context.organizationId,async(client)=>{
      await client.query(`UPDATE comms.voice_grants SET provider_revoked_at=transaction_timestamp(),updated_at=transaction_timestamp()
        WHERE organization_id=$1 AND id=ANY($2::uuid[]) AND revoked_at IS NOT NULL`,
      [context.organizationId,participants.map(({id})=>id)]);
    });
  }
}

function floorToken(secret: string, input: { organizationId: string; sessionId: string; channelId: string; requestId: string;
  seatAssignmentId: string; authorityEpoch: number; maxExpiresAt: string }): string {
  return createHmac("sha256", secret).update([input.organizationId,input.sessionId,input.channelId,input.requestId,
    input.seatAssignmentId,input.authorityEpoch,input.maxExpiresAt].join(":"), "utf8").digest("base64url");
}

const tokenDigest = (token: string) => createHash("sha256").update(token).digest("hex");

async function appendFloorEvent(client: PoolClient, context: SessionAccessContextV1, channelId: string,
  requestId: string, eventType: string, payload: JsonObject, correlationId: string): Promise<void> {
  const sequence = Number((await client.query<{ sequence: string }>(`UPDATE evidence.session_sequences SET next_sequence=next_sequence+1
    WHERE organization_id=$1 AND session_id=$2 RETURNING next_sequence-1 AS sequence`,
  [context.organizationId, context.sessionId])).rows[0]?.sequence);
  if (!Number.isSafeInteger(sequence)) throw new Error("Session evidence sequence is missing");
  const eventId = randomUUID();
  await client.query(`INSERT INTO evidence.events
    (id,organization_id,session_id,sequence,event_type,event_version,actor_person_id,actor_participant_id,governing_release_id,
     authority_epoch,body,correlation_id,causation_id,aggregate_id,aggregate_version,occurred_at)
    VALUES ($1,$2,$3,$4,$5,1,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,1,transaction_timestamp())`,
  [eventId,context.organizationId,context.sessionId,sequence,eventType,context.principalId,context.participantId,
    context.activeReleaseId,context.authorityEpoch,JSON.stringify(payload),correlationId,requestId,channelId]);
  await client.query("INSERT INTO sync.session_delta_outbox(id,organization_id,session_id,event_id) VALUES ($1,$2,$3,$4)",
    [randomUUID(),context.organizationId,context.sessionId,eventId]);
}

function asLease(requestId: string, channelId: string, status: FloorLeaseV1["status"], token: string | null,
  expiresAt: Date | null, queuePosition: number | null): FloorLeaseV1 {
  return { contractId: FLOOR_LEASE_CONTRACT_ID, requestId, channelId, status, floorToken: token,
    expiresAt: expiresAt?.toISOString() ?? null, queuePosition };
}

async function assertFloorAuthority(client: PoolClient, input: FloorOperationInput): Promise<void> {
  const authority = (await client.query<{ deployment_id: string; authority_epoch: string; status: string }>(`SELECT deployment_id,authority_epoch,status
    FROM runtime.session_authorities WHERE organization_id=$1 AND session_id=$2 FOR UPDATE`,
  [input.context.organizationId,input.context.sessionId])).rows[0];
  if (authority === undefined || authority.deployment_id !== input.deploymentId || authority.status !== "active" ||
      Number(authority.authority_epoch) !== input.context.authorityEpoch || input.input.expectedAuthorityEpoch !== input.context.authorityEpoch) {
    throw authorizationError("AUTHORITY_UNAVAILABLE", "This Deployment is not the Session Authority.", input.correlationId);
  }
}

export async function requestFloor(input: FloorOperationInput): Promise<FloorLeaseV1> {
  const effect = await withOrganizationTransaction(input.pool, input.context.organizationId, async (client) => {
    await assertFloorAuthority(client, input);
    const channel = await readChannel(client, input.context, input.channelId, true);
    const active = await assignment(client, input.context);
    if (channel === undefined || active === undefined || channel.status !== "open" || channel.definition.mode !== "radio_ptt") {
      throw authorizationError("TARGET_NOT_FOUND", "The push-to-talk Voice Channel was not found.", input.correlationId);
    }
    const release = await readDefinition(client, input.context.organizationId, channel.governing_release_id);
    if (!stageAllows(channel.definition, await activeStageId(client,input.context)) ||
        !selectorAllows(release,channel.definition.canTransmit,input.context,active)) {
      throw authorizationError("PERMISSION_DENIED", "The Active Role Context cannot request this Floor.", input.correlationId);
    }
    let queuedRetry = false;
    const previous = (await client.query<{ status: FloorLeaseV1["status"]; connection_id: string; seat_assignment_id: string;
      expires_at: Date | null; max_expires_at: Date | null; active: boolean }>(`SELECT request.status,request.connection_id,request.seat_assignment_id,
      lease.expires_at,lease.max_expires_at,COALESCE(lease.active,false) AS active FROM comms.floor_requests request
      LEFT JOIN comms.floor_leases lease ON lease.organization_id=request.organization_id AND lease.channel_id=request.channel_id AND lease.request_id=request.request_id
      WHERE request.organization_id=$1 AND request.channel_id=$2 AND request.request_id=$3`,
    [input.context.organizationId,input.channelId,input.input.requestId])).rows[0];
    if (previous !== undefined) {
      if (previous.status === "queued" && previous.connection_id === input.input.connectionId && previous.seat_assignment_id === active.id) {
        queuedRetry = true;
      } else if (previous.connection_id !== input.input.connectionId || previous.seat_assignment_id !== active.id || !previous.active ||
          previous.expires_at === null || previous.expires_at <= new Date() || previous.max_expires_at === null) {
        throw authorizationError("FLOOR_TOKEN_EXPIRED", "This Floor request is no longer live.", input.correlationId);
      } else {
        const token = floorToken(input.tokenSecret,{organizationId:input.context.organizationId,sessionId:input.context.sessionId,
          channelId:input.channelId,requestId:input.input.requestId,seatAssignmentId:active.id,authorityEpoch:input.context.authorityEpoch,
          maxExpiresAt:previous.max_expires_at.toISOString()});
        return { response: asLease(input.input.requestId,input.channelId,"granted",token,previous.expires_at,null), enable: undefined };
      }
    }
    const expired = await client.query<{ request_id: string }>(`UPDATE comms.floor_leases SET active=false,released_at=transaction_timestamp(),version=version+1
      WHERE organization_id=$1 AND channel_id=$2 AND active AND expires_at<=transaction_timestamp() RETURNING request_id`,
    [input.context.organizationId,input.channelId]);
    for (const row of expired.rows) {
      await client.query("UPDATE comms.floor_requests SET status='expired',updated_at=transaction_timestamp() WHERE channel_id=$1 AND request_id=$2",
        [input.channelId,row.request_id]);
      await appendFloorEvent(client,input.context,input.channelId,row.request_id,"floor_lease.expired",{channelId:input.channelId,requestId:row.request_id},input.correlationId);
    }
    const priority = channel.definition.priorityPolicy?.find(({sessionRoleId}) => sessionRoleId===active.session_role_id)?.priority ?? 0;
    const current = (await client.query<{ request_id: string; holder_seat_assignment_id: string; priority: number; participant_id: string }>(`SELECT lease.request_id,
      lease.holder_seat_assignment_id,request.priority,assignment.participant_id FROM comms.floor_leases lease
      JOIN comms.floor_requests request ON request.organization_id=lease.organization_id AND request.channel_id=lease.channel_id AND request.request_id=lease.request_id
      JOIN runtime.seat_assignments assignment ON assignment.organization_id=lease.organization_id AND assignment.id=lease.holder_seat_assignment_id
      WHERE lease.organization_id=$1 AND lease.channel_id=$2 AND lease.active FOR UPDATE`,
    [input.context.organizationId,input.channelId])).rows[0];
    const preempt = current !== undefined && channel.definition.radio?.preemption === "authorized_emergency" && priority > current.priority;
    if (current !== undefined && !preempt && channel.definition.radio?.queuePolicy === undefined) {
      throw authorizationError("FLOOR_BUSY", "The Floor is already held.", input.correlationId);
    }
    if (current !== undefined && !preempt && queuedRetry) {
      const position = Number((await client.query<{ position: string }>(`SELECT count(*) AS position FROM comms.floor_requests
        WHERE organization_id=$1 AND channel_id=$2 AND status='queued' AND requested_at <=
          (SELECT requested_at FROM comms.floor_requests WHERE organization_id=$1 AND channel_id=$2 AND request_id=$3)`,
      [input.context.organizationId,input.channelId,input.input.requestId])).rows[0]?.position ?? 1);
      return { response: asLease(input.input.requestId,input.channelId,"queued",null,null,position), enable: undefined };
    }
    if (queuedRetry) await client.query("UPDATE comms.floor_requests SET status='granted',updated_at=transaction_timestamp() WHERE channel_id=$1 AND request_id=$2",
      [input.channelId,input.input.requestId]);
    else await client.query(`INSERT INTO comms.floor_requests
      (id,organization_id,session_id,channel_id,request_id,device_id,connection_id,seat_assignment_id,priority,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[randomUUID(),input.context.organizationId,input.context.sessionId,input.channelId,
      input.input.requestId,input.deviceId,input.input.connectionId,active.id,priority,current===undefined||preempt?"granted":"queued"]);
    if (current !== undefined && !preempt) {
      const position = Number((await client.query<{ position: string }>(`SELECT count(*) AS position FROM comms.floor_requests
        WHERE organization_id=$1 AND channel_id=$2 AND status='queued' AND (priority>$3 OR (priority=$3 AND requested_at<=transaction_timestamp()))`,
      [input.context.organizationId,input.channelId,priority])).rows[0]?.position ?? 1);
      await appendFloorEvent(client,input.context,input.channelId,input.input.requestId,"floor_lease.queued",
        {channelId:input.channelId,requestId:input.input.requestId,queuePosition:position},input.correlationId);
      return { response: asLease(input.input.requestId,input.channelId,"queued",null,null,position), enable: undefined };
    }
    if (preempt && current !== undefined) {
      const reason=typeof input.input.reason==="string"?input.input.reason.trim():"";
      if (reason.length===0) throw authorizationError("VALIDATION_FAILED","Authorized preemption requires a reason.",input.correlationId);
      await client.query(`UPDATE comms.floor_leases SET active=false,preempted_at=transaction_timestamp(),preemption_reason=$3,version=version+1
        WHERE organization_id=$1 AND channel_id=$2 AND active`,[input.context.organizationId,input.channelId,reason]);
      await client.query("UPDATE comms.floor_requests SET status='preempted',updated_at=transaction_timestamp() WHERE channel_id=$1 AND request_id=$2",
        [input.channelId,current.request_id]);
      await appendFloorEvent(client,input.context,input.channelId,current.request_id,"floor_lease.preempted",
        {channelId:input.channelId,requestId:current.request_id,reason},input.correlationId);
    }
    const leaseMs=channel.definition.radio?.floorLeaseMs ?? 1000;
    const maxMs=channel.definition.radio?.maxTransmissionMs ?? leaseMs;
    const clock=(await client.query<{now:Date}>("SELECT transaction_timestamp() AS now")).rows[0]?.now;
    if(clock===undefined) throw new Error("Database clock is unavailable");
    const expiresAt=new Date(clock.getTime()+leaseMs),maxExpiresAt=new Date(clock.getTime()+maxMs);
    const token=floorToken(input.tokenSecret,{organizationId:input.context.organizationId,sessionId:input.context.sessionId,
      channelId:input.channelId,requestId:input.input.requestId,seatAssignmentId:active.id,authorityEpoch:input.context.authorityEpoch,
      maxExpiresAt:maxExpiresAt.toISOString()});
    await client.query(`INSERT INTO comms.floor_leases
      (id,organization_id,session_id,channel_id,request_id,holder_seat_assignment_id,token_digest,authority_epoch,expires_at,max_expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[randomUUID(),input.context.organizationId,input.context.sessionId,input.channelId,
      input.input.requestId,active.id,tokenDigest(token),input.context.authorityEpoch,expiresAt,maxExpiresAt]);
    await appendFloorEvent(client,input.context,input.channelId,input.input.requestId,"floor_lease.granted",
      {channelId:input.channelId,requestId:input.input.requestId,seatAssignmentId:active.id,expiresAt:expiresAt.toISOString()},input.correlationId);
    return { response: asLease(input.input.requestId,input.channelId,"granted",token,expiresAt,null),
      enable:{organizationId:input.context.organizationId,sessionId:input.context.sessionId,channelId:input.channelId,
        participantId:input.context.participantId} satisfies MediaParticipantInput,
      disable: current===undefined?undefined:{organizationId:input.context.organizationId,sessionId:input.context.sessionId,
        channelId:input.channelId,participantId:current.participant_id} satisfies MediaParticipantInput };
  });
  try {
    if (effect.disable !== undefined) await input.mediaAdapter.setTransmit(effect.disable,false);
    if (effect.enable !== undefined) await input.mediaAdapter.setTransmit(effect.enable,true);
    return effect.response;
  } catch {
    if (effect.enable !== undefined) await expireFloorAfterProviderFailure(input);
    throw authorizationError("MEDIA_UNAVAILABLE","The media provider could not grant transmit permission.",input.correlationId);
  }
}

async function expireFloorAfterProviderFailure(input: FloorOperationInput): Promise<void> {
  await withOrganizationTransaction(input.pool,input.context.organizationId,async(client)=>{
    await client.query(`UPDATE comms.floor_leases SET active=false,released_at=transaction_timestamp(),version=version+1
      WHERE organization_id=$1 AND channel_id=$2 AND request_id=$3 AND active`,[input.context.organizationId,input.channelId,input.input.requestId]);
    await client.query("UPDATE comms.floor_requests SET status='expired',updated_at=transaction_timestamp() WHERE channel_id=$1 AND request_id=$2",
      [input.channelId,input.input.requestId]);
    await appendFloorEvent(client,input.context,input.channelId,input.input.requestId,"media_provider.unavailable",
      {channelId:input.channelId,requestId:input.input.requestId},input.correlationId);
  });
}

async function changeFloor(input: FloorOperationInput, release: boolean): Promise<FloorLeaseV1> {
  const result=await withOrganizationTransaction(input.pool,input.context.organizationId,async(client)=>{
    await assertFloorAuthority(client,input);
    const active=await assignment(client,input.context);
    const channel=await readChannel(client,input.context,input.channelId,true);
    if(active===undefined||channel===undefined) throw authorizationError("TARGET_NOT_FOUND","The Floor Lease was not found.",input.correlationId);
    const row=(await client.query<{ token_digest:string;expires_at:Date;max_expires_at:Date;active:boolean }>(`SELECT token_digest,expires_at,max_expires_at,active
      FROM comms.floor_leases WHERE organization_id=$1 AND channel_id=$2 AND request_id=$3 AND holder_seat_assignment_id=$4 FOR UPDATE`,
    [input.context.organizationId,input.channelId,input.input.requestId,active.id])).rows[0];
    const supplied=input.input.floorToken??"",actual=Buffer.from(tokenDigest(supplied)),expected=Buffer.from(row?.token_digest??"");
    if(row===undefined||!row.active||actual.length!==expected.length||!timingSafeEqual(actual,expected)||row.expires_at<=new Date()){
      throw authorizationError("FLOOR_TOKEN_EXPIRED","The Floor Lease is expired or invalid.",input.correlationId);
    }
    if(release){
      await client.query(`UPDATE comms.floor_leases SET active=false,released_at=transaction_timestamp(),version=version+1
        WHERE organization_id=$1 AND channel_id=$2 AND request_id=$3`,[input.context.organizationId,input.channelId,input.input.requestId]);
      await client.query("UPDATE comms.floor_requests SET status='released',updated_at=transaction_timestamp() WHERE channel_id=$1 AND request_id=$2",
        [input.channelId,input.input.requestId]);
      await appendFloorEvent(client,input.context,input.channelId,input.input.requestId,"floor_lease.released",
        {channelId:input.channelId,requestId:input.input.requestId},input.correlationId);
      return {response:asLease(input.input.requestId,input.channelId,"released",null,null,null),participantId:input.context.participantId};
    }
    const clock=(await client.query<{now:Date}>("SELECT transaction_timestamp() AS now")).rows[0]?.now;
    if(clock===undefined) throw new Error("Database clock is unavailable");
    const next=new Date(Math.min(clock.getTime()+(channel.definition.radio?.floorLeaseMs??1000),row.max_expires_at.getTime()));
    if(next<=clock) throw authorizationError("FLOOR_TOKEN_EXPIRED","The maximum transmission time has elapsed.",input.correlationId);
    await client.query(`UPDATE comms.floor_leases SET expires_at=$4,version=version+1 WHERE organization_id=$1 AND channel_id=$2 AND request_id=$3`,
      [input.context.organizationId,input.channelId,input.input.requestId,next]);
    return {response:asLease(input.input.requestId,input.channelId,"granted",supplied,next,null),participantId:undefined};
  });
  if(result.participantId!==undefined){
    try{await input.mediaAdapter.setTransmit({organizationId:input.context.organizationId,sessionId:input.context.sessionId,
      channelId:input.channelId,participantId:result.participantId},false);}catch{/* Lease is authoritative and already fails closed at expiry. */}
  }
  return result.response;
}

export const renewFloor=(input:FloorOperationInput)=>changeFloor(input,false);
export const releaseFloor=(input:FloorOperationInput)=>changeFloor(input,true);

export function voiceReceipt(receipt: Omit<VoiceCommandReceiptV1,"contractId"|"mediaCredential">,
  mediaCredential: MediaCredentialV1|null): VoiceCommandReceiptV1 {
  return {...receipt,contractId:VOICE_COMMAND_CONTRACT_ID,mediaCredential};
}
