import { randomUUID } from "node:crypto";
import {
  type JsonObject,
  type RuntimeInjectV1,
  type RuntimeMessageV1
} from "@plenum/event-contracts";
import type {
  RuntimeActorSelectorV1,
  RuntimeInjectDefinitionV1,
  RuntimeProposalThreadProtocolV1,
  StateVariableDefinitionV1
} from "@plenum/simulation-schema";
import { injectCompletion } from "@plenum/simulation-schema";
import type { PoolClient } from "pg";
import { evaluateGate } from "@plenum/workflow-engine";

import { authorizationError } from "../errors.js";
import type { SessionAccessContextV1 } from "../identity/context.js";
import type { CommandDecision, CommandExecutionContext, PrincipalCommandExecutionContext } from "./commands/processor.js";
import { applyDueStateValueChanges, applyStateValueChange, initializeWorldState, readWorldStateFacts,
  scheduleStateValueChange } from "./state/world-state.js";

type SessionScope = Pick<SessionAccessContextV1, "organizationId" | "sessionId">;
type InjectCause = SessionScope & { principalId: string; participantId?: string; authorityEpoch: number };

interface InformationRelease {
  coreDesign: {
    teams: Array<{ id: string; name: string }>;
    sessionRoles: Array<{ id: string; isControlRole?: boolean; capabilities?: Array<{ capability: string }> }>;
    seats: Array<{ id: string; sessionRoleIds: string[]; teamId?: string }>;
    stages: Array<{ id: string }>;
    artifactTypes: Array<{ id: string; key: string; informationPolicyId: string; allowedTeamIds?: string[] }>;
    informationPolicies: Array<{
      id: string;
      grants: Array<{ audience: RuntimeActorSelectorV1; fieldsExcluded?: string[] }>;
    }>;
    stateVariables?: StateVariableDefinitionV1[];
    capabilities?: Array<{ id: string; initialState: string; informationPolicyId: string; mode?: "boolean" | "counted";
      initialQuantity?: number; maximumQuantity?: number }>;
    resourceDefinitions?: Array<{ id: string; informationPolicyId: string }>;
    communications: {
      messageChannels: Array<{
        id: string;
        informationPolicyId?: string;
        structuredArtifactTypeId?: string;
        threadProtocol?: RuntimeProposalThreadProtocolV1;
      }>;
      routes: Array<{
        id: string;
        channelId: string;
        sender: RuntimeActorSelectorV1;
        recipient: RuntimeActorSelectorV1;
        informationPolicyId: string;
        activeStageIds?: string[];
      }>;
    };
  };
  scenario: {
    content: Array<{ id: string; title: string; type: string; body?: string; informationPolicyId: string; version: string }>;
    injects: RuntimeInjectDefinitionV1[];
    initialState?: Array<{ stateVariableId: string; scopeReference?: string; value: boolean | number | string }>;
    initialCapabilities?: Array<{ capabilityId: string; scopeReference?: string; state: string; quantity?: number }>;
    initialResources?: Array<{ resourceId: string; scopeReference?: string; balance: number }>;
  };
}

interface RuntimeActor {
  teamId?: string;
  seatId: string;
  isControlRole: boolean;
}

interface Recipient {
  participantId: string;
  sessionRoleId: string;
  seatId: string;
  teamId?: string;
  isControlRole: boolean;
}

interface InjectInstanceRow {
  id: string;
  governing_release_id: string;
  inject_definition_id: string;
  state: string;
  version: string;
}

interface MessageThreadRow {
  id: string;
  channel_id: string;
  source_artifact_id: string;
  source_team_id: string;
  recipient_team_id: string;
  state: "open" | "accepted_terms" | "closed";
  source_closed_at: Date | null;
  recipient_closed_at: Date | null;
  version: string;
}

const informationReleases = new Map<string, Promise<InformationRelease>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function json(value: unknown): JsonObject | undefined {
  return isRecord(value) ? value as JsonObject : undefined;
}

async function readInformationRelease(
  client: PoolClient,
  context: SessionScope,
  releaseId: string,
  correlationId: string
): Promise<InformationRelease> {
  const cacheKey = `${context.organizationId}:${releaseId}`;
  const cached = informationReleases.get(cacheKey);
  if (cached !== undefined) return cached;
  const loaded = (async () => {
    const result = await client.query<{ snapshot: unknown }>(
      `SELECT (revision.snapshot - 'resources') #- '{coreDesign,resources}' AS snapshot
         FROM registry.releases release
         JOIN studio.definition_revisions revision
           ON revision.organization_id=release.organization_id AND revision.id=release.definition_revision_id
        WHERE release.organization_id=$1 AND release.id=$2`,
      [context.organizationId, releaseId]
    );
    const snapshot = result.rows[0]?.snapshot;
    if (!isRecord(snapshot)) throw authorizationError("INCOMPATIBLE_RELEASE", "The Release has no information-flow definition.", correlationId);
    const coreDesign = isRecord(snapshot.coreDesign) ? snapshot.coreDesign : snapshot;
    const scenario = isRecord(snapshot.scenario) ? snapshot.scenario : {};
    if (!Array.isArray(coreDesign.teams) || !Array.isArray(coreDesign.sessionRoles) || !Array.isArray(coreDesign.seats) ||
        !Array.isArray(coreDesign.stages) || !Array.isArray(coreDesign.artifactTypes) ||
        !Array.isArray(coreDesign.informationPolicies) || !isRecord(coreDesign.communications) ||
        !Array.isArray(coreDesign.communications.messageChannels) || !Array.isArray(coreDesign.communications.routes)) {
      throw authorizationError("INCOMPATIBLE_RELEASE", "The Release has no information-flow definition.", correlationId);
    }
    return {
      coreDesign: coreDesign as unknown as InformationRelease["coreDesign"],
      scenario: {
        content: Array.isArray(scenario.content) ? scenario.content as InformationRelease["scenario"]["content"] : [],
        injects: Array.isArray(scenario.injects) ? scenario.injects as RuntimeInjectDefinitionV1[] : [],
        ...(Array.isArray(scenario.initialState) ? { initialState: scenario.initialState as NonNullable<InformationRelease["scenario"]["initialState"]> } : {}),
        ...(Array.isArray(scenario.initialCapabilities) ? { initialCapabilities: scenario.initialCapabilities as NonNullable<InformationRelease["scenario"]["initialCapabilities"]> } : {}),
        ...(Array.isArray(scenario.initialResources) ? { initialResources: scenario.initialResources as NonNullable<InformationRelease["scenario"]["initialResources"]> } : {})
      }
    };
  })();
  if (informationReleases.size >= 64) informationReleases.delete(informationReleases.keys().next().value as string);
  informationReleases.set(cacheKey, loaded);
  try {
    return await loaded;
  } catch (error) {
    if (informationReleases.get(cacheKey) === loaded) informationReleases.delete(cacheKey);
    throw error;
  }
}

function actorFor(release: InformationRelease, context: SessionAccessContextV1): RuntimeActor | undefined {
  if (context.seatId === undefined) return undefined;
  const role = release.coreDesign.sessionRoles.find(({ id }) => id === context.activeSessionRoleId);
  const seat = release.coreDesign.seats.find(({ id }) => id === context.seatId);
  if (role === undefined || seat === undefined || !seat.sessionRoleIds.includes(role.id)) return undefined;
  return {
    seatId: seat.id,
    ...(seat.teamId === undefined ? {} : { teamId: seat.teamId }),
    isControlRole: role.isControlRole === true
  };
}

function selectorAllows(
  selector: RuntimeActorSelectorV1,
  sessionRoleId: string,
  actor: RuntimeActor,
  ownerTeamId?: string,
  payload?: JsonObject
): boolean {
  if (selector.public === true) return true;
  if (selector.includeControlRoles === true && actor.isControlRole) return true;
  const roleSelected = selector.sessionRoleIds !== undefined;
  const teamSelected = selector.teamIds !== undefined || selector.ownerTeam === true || selector.payloadTeamField !== undefined;
  const seatSelected = selector.seatIds !== undefined;
  if (!roleSelected && !teamSelected && !seatSelected) return false;
  const payloadTeams = selector.payloadTeamField === undefined ? undefined : payload?.[selector.payloadTeamField];
  return (!roleSelected || selector.sessionRoleIds?.includes(sessionRoleId) === true) &&
    (!teamSelected || (actor.teamId !== undefined && (
      selector.teamIds?.includes(actor.teamId) === true ||
      (selector.ownerTeam === true && actor.teamId === ownerTeamId) ||
      (Array.isArray(payloadTeams) && payloadTeams.includes(actor.teamId)) ||
      payloadTeams === actor.teamId
    ))) &&
    (!seatSelected || selector.seatIds?.includes(actor.seatId) === true);
}

function policyContent(
  release: InformationRelease,
  policyId: string | undefined,
  sessionRoleId: string,
  actor: RuntimeActor,
  content: JsonObject,
  ownerTeamId?: string
): JsonObject | undefined {
  const policy = release.coreDesign.informationPolicies.find(({ id }) => id === policyId);
  if (policy === undefined) return undefined;
  const grants = policy.grants.filter(({ audience }) =>
    selectorAllows(audience, sessionRoleId, actor, ownerTeamId, content));
  if (grants.length === 0) return undefined;
  return Object.fromEntries(Object.entries(content).filter(([field]) =>
    grants.some(({ fieldsExcluded }) => fieldsExcluded?.includes(field) !== true))) as JsonObject;
}

async function recipientsFor(
  client: PoolClient,
  release: InformationRelease,
  context: SessionScope,
  selector: RuntimeActorSelectorV1
): Promise<Recipient[]> {
  const result = await client.query<{ participant_id: string; session_role_id: string; seat_id: string }>(
    `SELECT assignment.participant_id,assignment.session_role_id,assignment.seat_id
       FROM runtime.seat_assignments assignment
      WHERE assignment.organization_id=$1 AND assignment.session_id=$2 AND assignment.valid_to IS NULL
      ORDER BY assignment.participant_id,assignment.id`,
    [context.organizationId, context.sessionId]
  );
  const recipients = new Map<string, Recipient>();
  for (const row of result.rows) {
    const role = release.coreDesign.sessionRoles.find(({ id }) => id === row.session_role_id);
    const seat = release.coreDesign.seats.find(({ id }) => id === row.seat_id);
    if (role === undefined || seat === undefined || !seat.sessionRoleIds.includes(role.id)) continue;
    const actor = {
      seatId: seat.id,
      ...(seat.teamId === undefined ? {} : { teamId: seat.teamId }),
      isControlRole: role.isControlRole === true
    };
    if (!selectorAllows(selector, role.id, actor)) continue;
    recipients.set(row.participant_id, {
      participantId: row.participant_id,
      sessionRoleId: role.id,
      seatId: seat.id,
      ...(seat.teamId === undefined ? {} : { teamId: seat.teamId }),
      isControlRole: role.isControlRole === true
    });
  }
  return [...recipients.values()];
}

async function currentStageId(client: PoolClient, context: SessionScope): Promise<string | undefined> {
  const result = await client.query<{ stage_id: string }>(
    "SELECT stage_id FROM runtime.session_stage_state WHERE organization_id=$1 AND session_id=$2",
    [context.organizationId, context.sessionId]
  );
  return result.rows[0]?.stage_id;
}

async function addDeliveries(
  client: PoolClient,
  context: SessionScope,
  recordType: "message" | "inject",
  recordId: string,
  recipients: readonly Recipient[]
): Promise<void> {
  if (recipients.length === 0) return;
  await client.query(
    `INSERT INTO runtime.information_deliveries
       (id,organization_id,session_id,record_type,record_id,participant_id,released_at)
     SELECT ids.id,$1,$2,$3,$4,ids.participant_id,transaction_timestamp()
       FROM unnest($5::uuid[],$6::uuid[]) AS ids(id,participant_id)
     ON CONFLICT (record_type,record_id,participant_id) DO NOTHING`,
    [context.organizationId, context.sessionId, recordType, recordId,
      recipients.map(() => randomUUID()), recipients.map(({ participantId }) => participantId)]
  );
}

async function insertMessageRecipients(
  client: PoolClient,
  context: SessionAccessContextV1,
  messageId: string,
  recipients: readonly Recipient[]
): Promise<void> {
  if (recipients.length === 0) return;
  await client.query(
    `INSERT INTO runtime.message_recipients
       (organization_id,session_id,message_id,participant_id)
     SELECT $1,$2,$3,ids.participant_id FROM unnest($4::uuid[]) AS ids(participant_id)
     ON CONFLICT DO NOTHING`,
    [context.organizationId, context.sessionId, messageId, recipients.map(({ participantId }) => participantId)]
  );
  await addDeliveries(client, context, "message", messageId, recipients);
}

function uniqueRecipients(...groups: ReadonlyArray<readonly Recipient[]>): Recipient[] {
  return [...new Map(groups.flat().map((recipient) => [recipient.participantId, recipient])).values()];
}

async function proposalParticipants(
  client: PoolClient,
  release: InformationRelease,
  context: SessionAccessContextV1,
  protocol: RuntimeProposalThreadProtocolV1,
  policyId: string | undefined,
  sourceTeamId: string,
  recipientTeamId: string
): Promise<Recipient[]> {
  const selected = uniqueRecipients(
    await recipientsFor(client, release, context, { sessionRoleIds: protocol.custodySessionRoleIds }),
    await recipientsFor(client, release, context, { sessionRoleIds: protocol.participantSessionRoleIds, teamIds: [sourceTeamId] }),
    await recipientsFor(client, release, context, { sessionRoleIds: protocol.participantSessionRoleIds, teamIds: [recipientTeamId] })
  );
  const policy = release.coreDesign.informationPolicies.find(({ id }) => id === policyId);
  const policyPayload: JsonObject = { sourceTeam: sourceTeamId, recipientTeam: recipientTeamId };
  return policy === undefined ? [] : selected.filter((recipient) => policy.grants.some(({ audience }) =>
    selectorAllows(audience, recipient.sessionRoleId, recipient, sourceTeamId, policyPayload)));
}

function proposalChannel(release: InformationRelease): InformationRelease["coreDesign"]["communications"]["messageChannels"][number] | undefined {
  return release.coreDesign.communications.messageChannels.find(({ threadProtocol }) => threadProtocol !== undefined);
}

function proposalActor(
  protocol: RuntimeProposalThreadProtocolV1,
  context: SessionAccessContextV1,
  actor: RuntimeActor,
  thread: MessageThreadRow
): "custodian" | "source" | "recipient" | undefined {
  if (protocol.custodySessionRoleIds.includes(context.activeSessionRoleId)) return "custodian";
  if (!protocol.participantSessionRoleIds.includes(context.activeSessionRoleId)) return undefined;
  if (actor.teamId === thread.source_team_id) return "source";
  if (actor.teamId === thread.recipient_team_id) return "recipient";
  return undefined;
}

async function insertProposalMessage(
  input: CommandExecutionContext,
  thread: MessageThreadRow,
  routeId: string,
  content: JsonObject,
  recipients: readonly Recipient[],
  senderTeamId: string | null
): Promise<string> {
  const { client, context, command, activeReleaseId } = input;
  const messageId = command.commandId;
  const storedContent: JsonObject = {
    ...content,
    sourceArtifactId: thread.source_artifact_id,
    sourceTeam: thread.source_team_id,
    recipientTeam: thread.recipient_team_id
  };
  await client.query(
    `INSERT INTO runtime.messages
       (id,organization_id,session_id,governing_release_id,channel_id,route_id,thread_id,operation_type,
        sender_participant_id,sender_session_role_id,sender_team_id,content)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
    [messageId, context.organizationId, context.sessionId, activeReleaseId, thread.channel_id, routeId, thread.id,
      command.operationType, context.participantId, context.activeSessionRoleId,
      senderTeamId, JSON.stringify(storedContent)]
  );
  await insertMessageRecipients(client, context, messageId, recipients);
  return messageId;
}

async function executeProposalForward(
  input: CommandExecutionContext,
  release: InformationRelease,
  channel: InformationRelease["coreDesign"]["communications"]["messageChannels"][number],
  protocol: RuntimeProposalThreadProtocolV1,
  actor: RuntimeActor,
  action: RuntimeProposalThreadProtocolV1["actions"][number]
): Promise<CommandDecision> {
  const { client, context, command, activeReleaseId } = input;
  if (!protocol.custodySessionRoleIds.includes(context.activeSessionRoleId)) {
    return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "Only proposal custody may open a recipient thread." };
  }
  if (command.expectedAggregateVersion !== 0) {
    return { status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION", message: "A new proposal thread starts at version zero." };
  }
  const sourceArtifactId = text(command.payload.sourceArtifactId);
  const recipientTeamId = text(command.payload.recipientTeamId);
  if (sourceArtifactId === undefined || recipientTeamId === undefined || !release.coreDesign.teams.some(({ id }) => id === recipientTeamId)) {
    return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "A valid source Artifact and recipient Team are required." };
  }
  const sourceTypes = release.coreDesign.artifactTypes.filter(({ id }) => protocol.sourceArtifactTypeIds.includes(id));
  const source = await client.query<{ artifact_type_key: string; owner_team_id: string | null; state: string; payload: JsonObject; version: string }>(
    `SELECT artifact_type_key,owner_team_id,state,payload,version FROM runtime.artifact_instances
      WHERE organization_id=$1 AND session_id=$2 AND id=$3`,
    [context.organizationId, context.sessionId, sourceArtifactId]
  );
  const artifact = source.rows[0];
  const configuredRecipients = artifact === undefined ? undefined : artifact.payload[protocol.recipientTeamField];
  const sourceType = sourceTypes.find(({ key }) => key === artifact?.artifact_type_key);
  if (artifact === undefined || artifact.owner_team_id === null || sourceType === undefined ||
      (sourceType.allowedTeamIds !== undefined && !sourceType.allowedTeamIds.includes(artifact.owner_team_id)) ||
      artifact.state !== "recipient_threads" ||
      !(configuredRecipients === recipientTeamId || (Array.isArray(configuredRecipients) && configuredRecipients.includes(recipientTeamId)))) {
    return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The approved proposal recipient was not found." };
  }
  const route = release.coreDesign.communications.routes.find(({ id, channelId, sender, recipient }) =>
    id === action.routeId && channelId === channel.id && selectorAllows(sender, context.activeSessionRoleId, actor) &&
    recipient.sessionRoleIds?.some((id) => protocol.participantSessionRoleIds.includes(id)) === true);
  if (route === undefined) return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "No proposal forwarding Route is configured." };
  const thread: MessageThreadRow = {
    id: command.aggregateId,
    channel_id: channel.id,
    source_artifact_id: sourceArtifactId,
    source_team_id: artifact.owner_team_id,
    recipient_team_id: recipientTeamId,
    state: "open",
    source_closed_at: null,
    recipient_closed_at: null,
    version: "1"
  };
  const inserted = await client.query(
    `INSERT INTO runtime.message_threads
       (id,organization_id,session_id,governing_release_id,channel_id,source_artifact_id,source_team_id,recipient_team_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (session_id,channel_id,source_artifact_id,recipient_team_id) DO NOTHING`,
    [thread.id, context.organizationId, context.sessionId, activeReleaseId, channel.id, sourceArtifactId, artifact.owner_team_id, recipientTeamId]
  );
  if (inserted.rowCount !== 1) return { status: "rejected", errorCode: "TARGET_EXISTS", message: "This proposal recipient thread already exists." };
  const recipients = await proposalParticipants(
    client,
    release,
    context,
    protocol,
    channel.informationPolicyId,
    artifact.owner_team_id,
    recipientTeamId
  );
  if (recipients.length === 0) throw new Error(`Proposal thread ${thread.id} resolved no permitted participants`);
  const content: JsonObject = {
    sourceArtifactId,
    recipientTeamId,
    proposalVersion: Number(artifact.version),
    proposalDetails: artifact.payload,
    sourceTeam: artifact.owner_team_id,
    recipientTeam: recipientTeamId
  };
  const messageId = await insertProposalMessage(input, thread, route.id, content, recipients, actor.teamId ?? null);
  await client.query(
    `INSERT INTO runtime.message_approvals
       (id,organization_id,session_id,message_id,release_route_id,approved_by_participant_id) VALUES ($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), context.organizationId, context.sessionId, messageId, route.id, context.participantId]
  );
  return { status: "accepted", aggregateVersion: 1, eventType: "message.sent",
    eventPayload: { messageId, threadId: thread.id, channelId: channel.id, routeId: route.id } };
}

async function executeProposalCommand(
  input: CommandExecutionContext,
  release: InformationRelease
): Promise<CommandDecision> {
  const { client, context, command, activeReleaseId } = input;
  if (command.governingReleaseId !== activeReleaseId) {
    return { status: "needs_reconciliation", errorCode: "INCOMPATIBLE_RELEASE", message: "Proposal threads use the active Release." };
  }
  const channel = proposalChannel(release);
  const protocol = channel?.threadProtocol;
  const actor = actorFor(release, context);
  if (channel === undefined || protocol === undefined || actor === undefined) {
    return { status: "rejected", errorCode: "CAPABILITY_UNAVAILABLE", message: "The active Release has no proposal thread capability." };
  }
  const action = protocol.actions.find(({ command: configuredCommand }) => configuredCommand === command.operationType);
  if (action === undefined) return { status: "rejected", errorCode: "CAPABILITY_UNAVAILABLE", message: "This proposal operation is not configured." };
  if (command.operationType === "message.proposal_forward") return executeProposalForward(input, release, channel, protocol, actor, action);

  const result = await client.query<MessageThreadRow>(
    `SELECT id,channel_id,source_artifact_id,source_team_id,recipient_team_id,state,source_closed_at,recipient_closed_at,version
       FROM runtime.message_threads WHERE organization_id=$1 AND session_id=$2 AND id=$3 FOR UPDATE`,
    [context.organizationId, context.sessionId, command.aggregateId]
  );
  const thread = result.rows[0];
  if (thread === undefined) return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The proposal thread was not found." };
  const actorKind = proposalActor(protocol, context, actor, thread);
  if (actorKind !== action.actor) return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The proposal thread was not found." };
  const currentVersion = Number(thread.version);
  if (command.expectedAggregateVersion !== currentVersion) {
    return { status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION", message: `The proposal thread is at version ${currentVersion}.` };
  }
  if (thread.state === "closed") return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The proposal thread is closed." };

  if (command.operationType === "message.proposal_approve_round") {
    const messageId = text(command.payload.messageId);
    if (messageId === undefined) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "A pending Message is required." };
    const pending = await client.query<{ operation_type: string; content: JsonObject }>(
      `SELECT message.operation_type,message.content FROM runtime.messages message
        LEFT JOIN runtime.message_approvals approval
          ON approval.organization_id=message.organization_id AND approval.message_id=message.id
       WHERE message.organization_id=$1 AND message.session_id=$2 AND message.thread_id=$3 AND message.id=$4
         AND approval.message_id IS NULL`,
      [context.organizationId, context.sessionId, thread.id, messageId]
    );
    const pendingMessage = pending.rows[0];
    const approvedOperation = pendingMessage?.operation_type;
    const approvedAction = protocol.actions.find(({ command: configuredCommand }) => configuredCommand === approvedOperation);
    const approvalRoute = release.coreDesign.communications.routes.find(({ id, channelId }) =>
      id === approvedAction?.approvalRouteId && channelId === channel.id);
    if (approvedOperation === undefined || pendingMessage === undefined || approvalRoute === undefined) {
      return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The pending Message or its approval Route was not found." };
    }
    if (!selectorAllows(approvalRoute.sender, context.activeSessionRoleId, actor)) {
      return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "The approval Route does not permit this sender." };
    }
    await client.query(
      `INSERT INTO runtime.message_approvals
         (id,organization_id,session_id,message_id,release_route_id,approved_by_participant_id) VALUES ($1,$2,$3,$4,$5,$6)`,
      [randomUUID(), context.organizationId, context.sessionId, messageId, approvalRoute.id, context.participantId]
    );
    const approvalPolicy = release.coreDesign.informationPolicies.find(({ id }) => id === approvalRoute.informationPolicyId);
    const approvedRecipients = (await recipientsFor(client, release, context, approvalRoute.recipient)).filter((recipient) =>
      approvalPolicy?.grants.some(({ audience }) => selectorAllows(
        audience, recipient.sessionRoleId, recipient, undefined, pendingMessage.content
      )) === true);
    if (approvedRecipients.length === 0) throw new Error(`Approval Route ${approvalRoute.id} resolved no permitted participants`);
    await insertMessageRecipients(client, context, messageId, approvedRecipients);
    const closesSource = approvedOperation === "message.proposal_close_source";
    const closesRecipient = approvedOperation === "message.proposal_close_recipient";
    const sourceClosed = closesSource || thread.source_closed_at !== null;
    const recipientClosed = closesRecipient || thread.recipient_closed_at !== null;
    const state = sourceClosed && recipientClosed ? "closed" :
      approvedOperation === "message.proposal_accept" ? "accepted_terms" : thread.state;
    const version = currentVersion + 1;
    await client.query(
      `UPDATE runtime.message_threads SET state=$1,
         accepted_at=CASE WHEN $7 THEN COALESCE(accepted_at,transaction_timestamp()) ELSE accepted_at END,
         source_closed_at=CASE WHEN $2 THEN COALESCE(source_closed_at,transaction_timestamp()) ELSE source_closed_at END,
         recipient_closed_at=CASE WHEN $3 THEN COALESCE(recipient_closed_at,transaction_timestamp()) ELSE recipient_closed_at END,
         version=$4,updated_at=transaction_timestamp() WHERE organization_id=$5 AND id=$6`,
      [state, closesSource, closesRecipient, version, context.organizationId, thread.id,
        approvedOperation === "message.proposal_accept"]
    );
    return { status: "accepted", aggregateVersion: version, eventType: "message.delivered",
      eventPayload: { messageId, threadId: thread.id, channelId: thread.channel_id } };
  }

  if (action.requiresText === true && text(json(command.payload.content)?.text) === undefined) {
    return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "This proposal operation requires Message text." };
  }
  if ((actorKind === "source" && thread.source_closed_at !== null) ||
      (actorKind === "recipient" && thread.recipient_closed_at !== null)) {
    return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "This side of the proposal thread is closed." };
  }
  if (thread.state === "accepted_terms" && !command.operationType.startsWith("message.proposal_close_")) {
    return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "Accepted proposal terms may only be explicitly closed." };
  }
  const duplicate = await client.query(
    `SELECT 1 FROM runtime.messages message
      LEFT JOIN runtime.message_approvals approval
        ON approval.organization_id=message.organization_id AND approval.message_id=message.id
     WHERE message.organization_id=$1 AND message.thread_id=$2 AND message.operation_type=$3
       AND message.sender_participant_id=$4 AND approval.message_id IS NULL`,
    [context.organizationId, thread.id, command.operationType, context.participantId]
  );
  if (duplicate.rowCount !== 0) {
    return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "This proposal response is already awaiting approval." };
  }
  const route = release.coreDesign.communications.routes.find(({ id, channelId, sender }) =>
    id === action.routeId && channelId === thread.channel_id && selectorAllows(sender, context.activeSessionRoleId, actor));
  if (route === undefined) return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "No proposal Route is configured for this sender." };
  const sender = (await recipientsFor(client, release, context, { seatIds: [actor.seatId] }))
    .filter(({ participantId }) => participantId === context.participantId);
  const custody = await recipientsFor(client, release, context, { sessionRoleIds: protocol.custodySessionRoleIds });
  const messageId = await insertProposalMessage(
    input,
    thread,
    route.id,
    json(command.payload.content) ?? {},
    uniqueRecipients(sender, custody),
    actor.teamId ?? null
  );
  const version = currentVersion + 1;
  await client.query(
    "UPDATE runtime.message_threads SET version=$1,updated_at=transaction_timestamp() WHERE organization_id=$2 AND id=$3",
    [version, context.organizationId, thread.id]
  );
  return { status: "accepted", aggregateVersion: version, eventType: "message.sent",
    eventPayload: { messageId, threadId: thread.id, channelId: thread.channel_id, routeId: route.id } };
}

async function executeMessageSend(input: CommandExecutionContext, release: InformationRelease): Promise<CommandDecision> {
  const { client, context, command, activeReleaseId } = input;
  if (command.governingReleaseId !== activeReleaseId) {
    return { status: "needs_reconciliation", errorCode: "INCOMPATIBLE_RELEASE", message: "Messages use the active Release." };
  }
  if (command.expectedAggregateVersion !== 0) {
    return { status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION", message: "A new Message starts at version zero." };
  }
  const routeId = text(command.payload.routeId);
  const content = json(command.payload.content);
  const route = release.coreDesign.communications.routes.find(({ id }) => id === routeId);
  const channel = release.coreDesign.communications.messageChannels.find(({ id }) => id === route?.channelId);
  const actor = actorFor(release, context);
  if (route === undefined || channel === undefined || content === undefined) {
    return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "A valid Communication Route and Message content are required." };
  }
  if (actor === undefined || !selectorAllows(route.sender, context.activeSessionRoleId, actor)) {
    return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "The Communication Route does not permit this sender." };
  }
  if (channel.structuredArtifactTypeId !== undefined) {
    const artifactId = text(command.payload.artifactId);
    const artifactType = release.coreDesign.artifactTypes.find(({ id }) => id === channel.structuredArtifactTypeId);
    if (artifactId === undefined || artifactType === undefined) {
      return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "This Communication Channel requires its configured Artifact." };
    }
    const artifact = await client.query<{ artifact_type_key: string; owner_team_id: string | null }>(
      `SELECT artifact_type_key,owner_team_id FROM runtime.artifact_instances
        WHERE organization_id=$1 AND session_id=$2 AND id=$3`,
      [context.organizationId, context.sessionId, artifactId]
    );
    if (artifact.rows[0]?.artifact_type_key !== artifactType.key ||
        (!actor.isControlRole && artifact.rows[0]?.owner_team_id !== actor.teamId)) {
      return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The configured Channel Artifact was not found." };
    }
    content.artifactId = artifactId;
  }
  const policy = release.coreDesign.informationPolicies.find(({ id }) => id === route.informationPolicyId);
  if (policy === undefined) return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "The Communication Route is denied by default." };
  const stageId = await currentStageId(client, context);
  if (route.activeStageIds !== undefined && (stageId === undefined || !route.activeStageIds.includes(stageId))) {
    return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The Communication Route is not active in this Stage." };
  }
  const routeRecipients = await recipientsFor(client, release, context, route.recipient);
  const recipients = routeRecipients.filter((recipient) => policy.grants.some(({ audience }) => selectorAllows(
    audience,
    recipient.sessionRoleId,
    recipient,
    actor.teamId,
    content
  )));
  if (recipients.length === 0) return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "No permitted recipient was found." };
  const exists = await client.query("SELECT 1 FROM runtime.messages WHERE organization_id=$1 AND id=$2", [context.organizationId, command.aggregateId]);
  if (exists.rowCount !== 0) return { status: "rejected", errorCode: "TARGET_EXISTS", message: "The Message already exists." };
  await client.query(
    `INSERT INTO runtime.messages
       (id,organization_id,session_id,governing_release_id,channel_id,route_id,operation_type,
        sender_participant_id,sender_session_role_id,sender_team_id,content)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
    [command.aggregateId, context.organizationId, context.sessionId, activeReleaseId, route.channelId, route.id,
      command.operationType, context.participantId, context.activeSessionRoleId, actor.teamId ?? null, JSON.stringify(content)]
  );
  await insertMessageRecipients(client, context, command.aggregateId, recipients);
  return {
    status: "accepted",
    aggregateVersion: 1,
    eventType: "message.sent",
    eventPayload: { messageId: command.aggregateId, channelId: route.channelId, routeId: route.id }
  };
}

async function insertInjectRecipients(
  client: PoolClient,
  context: SessionScope,
  instanceId: string,
  recipients: readonly Recipient[]
): Promise<void> {
  if (recipients.length === 0) return;
  await client.query(
    `INSERT INTO runtime.inject_recipient_states
       (organization_id,session_id,inject_instance_id,participant_id,released_at)
     SELECT $1,$2,$3,ids.participant_id,transaction_timestamp() FROM unnest($4::uuid[]) AS ids(participant_id)
     ON CONFLICT DO NOTHING`,
    [context.organizationId, context.sessionId, instanceId, recipients.map(({ participantId }) => participantId)]
  );
  await addDeliveries(client, context, "inject", instanceId, recipients);
}

async function releaseInject(
  client: PoolClient,
  context: InjectCause,
  releaseId: string,
  release: InformationRelease,
  definition: RuntimeInjectDefinitionV1,
  instanceId: string,
  commandId: string,
  scheduledVersion?: number
): Promise<number | undefined> {
  const selected = await recipientsFor(client, release, context, definition.recipients);
  const content = release.scenario.content.find(({ id }) => id === definition.contentId);
  const policy = release.coreDesign.informationPolicies.find(({ id }) => id === content?.informationPolicyId);
  const recipients = policy === undefined ? [] : selected.filter((recipient) => policy.grants.some(({ audience }) =>
    selectorAllows(audience, recipient.sessionRoleId, recipient)));
  if (recipients.length === 0) {
    if (scheduledVersion !== undefined) return undefined;
    throw new Error(`Inject ${definition.id} resolved no recipients`);
  }
  const state = injectCompletion(definition, { total: recipients.length, acknowledged: 0, responded: 0 }).state;
  const inserted = scheduledVersion === undefined ? await client.query(
    `INSERT INTO runtime.inject_instances
       (id,organization_id,session_id,governing_release_id,inject_definition_id,state,title,content_id,released_at,closed_at,version)
     VALUES ($1,$2,$3,$4,$5,$8,$6,$7,transaction_timestamp(),CASE WHEN $8='closed' THEN transaction_timestamp() END,1)
     ON CONFLICT (session_id,inject_definition_id) DO NOTHING RETURNING id`,
    [instanceId, context.organizationId, context.sessionId, releaseId, definition.id, definition.title, definition.contentId,
      state]
  ) : await client.query(
    `UPDATE runtime.inject_instances SET state=$1,released_at=transaction_timestamp(),
       closed_at=CASE WHEN $1='closed' THEN transaction_timestamp() END,version=version+1
      WHERE organization_id=$2 AND session_id=$3 AND id=$4 AND governing_release_id=$5
        AND state='scheduled' AND version=$6 AND scheduled_at<=transaction_timestamp() RETURNING id`,
    [state,context.organizationId,context.sessionId,instanceId,releaseId,scheduledVersion]
  );
  if (inserted.rowCount !== 1) return undefined;
  await insertInjectRecipients(client, context, instanceId, recipients);
  await initializeWorldState(client, {
    organizationId: context.organizationId, sessionId: context.sessionId, governingReleaseId: releaseId
  }, release.coreDesign, release.scenario);
  for (const [effectIndex, effect] of (definition.effects ?? []).entries()) {
    const variable = release.coreDesign.stateVariables?.find(({ id }) => id === effect.stateVariableId);
    const worldContext = {
      organizationId: context.organizationId, sessionId: context.sessionId, governingReleaseId: releaseId
    };
    const source = {
      type: "inject", reference: instanceId, commandId, actorPersonId: context.principalId,
      rationale: effect.rationale ?? `Inject ${definition.id} released`
    } as const;
    if ((effect.delaySeconds ?? 0) > 0) await scheduleStateValueChange(client, worldContext, effect, effectIndex, source);
    else await applyStateValueChange(client, worldContext, effect, source, variable === undefined ? {} : { definition: variable });
  }
  return scheduledVersion === undefined ? 1 : scheduledVersion + 1;
}

async function recordInjectEvent(
  client: PoolClient,
  context: InjectCause,
  releaseId: string,
  commandId: string,
  instanceId: string,
  definitionId: string,
  options: { eventType?: "inject.released" | "inject.scheduled"; version?: number; automatic?: boolean;
    scheduledAt?: string; gateExplanations?: ReturnType<typeof evaluateGate>["explanations"] } = {}
): Promise<void> {
  const sequence = await client.query<{ sequence: string }>(
    `UPDATE evidence.session_sequences SET next_sequence=next_sequence+1
      WHERE organization_id=$1 AND session_id=$2 RETURNING next_sequence-1 AS sequence`,
    [context.organizationId, context.sessionId]
  );
  const evidenceSequence = Number(sequence.rows[0]?.sequence);
  if (!Number.isSafeInteger(evidenceSequence)) throw new Error("Session evidence sequence is missing");
  const eventId = randomUUID();
  await client.query(
    `INSERT INTO evidence.events
       (id,organization_id,session_id,sequence,event_type,event_version,actor_person_id,actor_participant_id,
        governing_release_id,authority_epoch,body,correlation_id,causation_id,aggregate_id,aggregate_version,occurred_at)
     VALUES ($1,$2,$3,$4,$12,1,$5,$6,$7,$8,$9::jsonb,$10,$10,$11,$13,transaction_timestamp())`,
    [eventId, context.organizationId, context.sessionId, evidenceSequence,
      options.automatic ? null : context.principalId, options.automatic ? null : context.participantId ?? null,
      releaseId, context.authorityEpoch, JSON.stringify({ injectInstanceId: instanceId, injectDefinitionId: definitionId,
        ...(options.gateExplanations === undefined ? {} : { gateExplanations: options.gateExplanations }),
        ...(options.scheduledAt === undefined ? {} : { scheduledAt: options.scheduledAt }),
        ...(options.automatic ? { trigger: "scheduled", schedulingCommandId: commandId } : {}) }),
      commandId, instanceId, options.eventType ?? "inject.released", options.version ?? 1]
  );
  await client.query(
    "INSERT INTO sync.session_delta_outbox(id,organization_id,session_id,event_id) VALUES ($1,$2,$3,$4)",
    [randomUUID(), context.organizationId, context.sessionId, eventId]
  );
}

/** Called inside Session start or live activation, before its Receipt is committed.
 * New definitions use the original accepted start; existing instances keep their pins. */
export async function scheduleConfiguredInjects(input: PrincipalCommandExecutionContext): Promise<CommandDecision | null> {
  const { client, context, activeReleaseId, command } = input;
  // Historical Releases may predate information-flow definitions entirely.
  const configured = await client.query(
    `SELECT 1 FROM registry.releases release JOIN studio.definition_revisions revision
       ON revision.organization_id=release.organization_id AND revision.id=release.definition_revision_id
      WHERE release.organization_id=$1 AND release.id=$2
        AND revision.snapshot @? '$.scenario.injects[*] ? (@.releaseMode == "scheduled")'`,
    [context.organizationId, activeReleaseId]
  );
  if (configured.rowCount === 0) return null;
  const release = await readInformationRelease(client, context, activeReleaseId, command.commandId);
  const existing = await client.query<{ inject_definition_id: string }>(
    "SELECT inject_definition_id FROM runtime.inject_instances WHERE organization_id=$1 AND session_id=$2",
    [context.organizationId, context.sessionId]
  );
  const instantiated = new Set(existing.rows.map(({ inject_definition_id }) => inject_definition_id));
  const definitions = release.scenario.injects.filter(({ id, releaseMode }) => releaseMode === "scheduled" && !instantiated.has(id));
  if (definitions.length === 0) return null;
  const clock = command.operationType === "session.start"
    ? (await client.query<{ now: Date }>("SELECT transaction_timestamp() AS now")).rows[0]!.now
    : (await client.query<{ occurred_at: Date }>(
      `SELECT occurred_at FROM evidence.events WHERE organization_id=$1 AND session_id=$2
         AND event_type='session.started' ORDER BY sequence LIMIT 1`, [context.organizationId, context.sessionId]
    )).rows[0]?.occurred_at;
  if (!clock) return { status: "rejected", errorCode: "VALIDATION_FAILED",
    message: "Scheduled Injects require the accepted Session start time in retained Evidence." };
  const schedules = definitions.map((definition) => ({ definition,
    due: new Date(clock.getTime() + Number(definition.scheduledOffsetSeconds) * 1000) }));
  const invalid = schedules.find(({ due }) => !Number.isFinite(due.getTime()) || due.getUTCFullYear() > 9999);
  if (invalid) return { status: "rejected", errorCode: "VALIDATION_FAILED",
    message: `The scheduled offset for ${invalid.definition.title} is outside the supported UTC date range.` };
  for (const { definition, due } of schedules) {
    const id = randomUUID();
    const inserted = await client.query(
      `INSERT INTO runtime.inject_instances
         (id,organization_id,session_id,governing_release_id,inject_definition_id,state,title,content_id,
          scheduled_at,scheduling_command_id,scheduled_by_person_id,version)
       VALUES ($1,$2,$3,$4,$5,'scheduled',$6,$7,$8,$9,$10,1)
       ON CONFLICT (session_id,inject_definition_id) DO NOTHING RETURNING id`,
      [id,context.organizationId,context.sessionId,activeReleaseId,definition.id,definition.title,definition.contentId,
        due,command.commandId,context.principalId]
    );
    if (inserted.rowCount === 1) await recordInjectEvent(client, context, activeReleaseId, command.commandId, id, definition.id,
      { eventType: "inject.scheduled", scheduledAt: due.toISOString() });
  }
  return null;
}

/** The caller holds this Session's authority and lifecycle locks. Delivery is a
 * causal effect of the accepted scheduling Command, not an impersonated user action. */
export async function releaseDueScheduledInjects(client: PoolClient, context: SessionScope & { authorityEpoch: number }): Promise<number> {
  const due = await client.query<{ id: string; governing_release_id: string; inject_definition_id: string;
    scheduling_command_id: string; scheduled_by_person_id: string; scheduled_at: Date; version: string }>(
    `SELECT id,governing_release_id,inject_definition_id,scheduling_command_id,scheduled_by_person_id,scheduled_at,version
       FROM runtime.inject_instances WHERE organization_id=$1 AND session_id=$2 AND state='scheduled'
        AND scheduling_command_id IS NOT NULL AND scheduled_at<=transaction_timestamp()
       ORDER BY scheduled_at,id LIMIT 100 FOR UPDATE`,
    [context.organizationId,context.sessionId]
  );
  let released = 0;
  for (const row of due.rows) {
    const cause = { ...context, principalId: row.scheduled_by_person_id };
    const release = await readInformationRelease(client, context, row.governing_release_id, row.scheduling_command_id);
    const definition = release.scenario.injects.find(({ id }) => id === row.inject_definition_id);
    if (!definition || definition.releaseMode !== "scheduled") throw new Error("Scheduled Inject lacks its pinned definition");
    const version = await releaseInject(client, cause, row.governing_release_id, release, definition, row.id,
      row.scheduling_command_id, Number(row.version));
    if (version === undefined) continue; // No currently authorized recipients; retain the due schedule for retry.
    await recordInjectEvent(client, cause, row.governing_release_id, row.scheduling_command_id, row.id, definition.id,
      { version, automatic: true, scheduledAt: row.scheduled_at.toISOString() });
    released++;
  }
  return released;
}

export async function releaseStageInjects(
  input: CommandExecutionContext,
  mode: "stage_entry" | "stage_exit",
  stageId: string
): Promise<string[]> {
  const release = await readInformationRelease(input.client, input.context as SessionAccessContextV1, input.activeReleaseId, input.command.commandId);
  const released: string[] = [];
  for (const definition of release.scenario.injects.filter((inject) => inject.releaseMode === mode && inject.stageId === stageId)) {
    const instanceId = randomUUID();
    if (!await releaseInject(input.client, input.context, input.activeReleaseId, release, definition, instanceId, input.command.commandId)) continue;
    await recordInjectEvent(input.client, input.context, input.activeReleaseId, input.command.commandId, instanceId, definition.id);
    released.push(instanceId);
  }
  return released;
}

export async function releaseGateInjects(input: CommandExecutionContext | PrincipalCommandExecutionContext): Promise<string[]> {
  const release = await readInformationRelease(input.client, input.context, input.activeReleaseId, input.command.commandId);
  const participantContext = "activeSessionRoleId" in input.context ? input.context : undefined;
  const actor = participantContext === undefined ? undefined : actorFor(release, participantContext);
  if (participantContext !== undefined && actor === undefined) return [];
  await initializeWorldState(input.client, {
    organizationId: input.context.organizationId, sessionId: input.context.sessionId, governingReleaseId: input.activeReleaseId
  }, release.coreDesign, release.scenario);
  await applyDueStateValueChanges(input.client, input.context, release.coreDesign.stateVariables ?? []);
  // Principal Stage Commands already require an active Session Operator; match Stage fact visibility.
  const policyVisible = (policyId: string): boolean => participantContext === undefined || (actor !== undefined && release.coreDesign.informationPolicies
    .find(({ id }) => id === policyId)?.grants.some(({ audience }) =>
      selectorAllows(audience, participantContext.activeSessionRoleId, actor)) === true);
  const released: string[] = [];
  for (const definition of release.scenario.injects.filter((inject) => inject.releaseMode === "gate")) {
    if (definition.releaseGate === undefined) continue;
    const facts = await readWorldStateFacts(input.client, input.context, {
      stateVariableIds: new Set((release.coreDesign.stateVariables ?? []).filter(({ informationPolicyId }) => policyVisible(informationPolicyId)).map(({ id }) => id)),
      capabilityIds: new Set((release.coreDesign.capabilities ?? []).filter(({ informationPolicyId }) => policyVisible(informationPolicyId)).map(({ id }) => id)),
      resourceIds: new Set((release.coreDesign.resourceDefinitions ?? []).filter(({ informationPolicyId }) => policyVisible(informationPolicyId)).map(({ id }) => id))
    });
    const stage = await currentStageId(input.client, input.context);
    if (stage !== undefined) facts["session.stage.id"] = stage;
    facts["session.status"] = "sessionStatus" in input ? input.sessionStatus : input.context.sessionStatus;
    if (participantContext !== undefined) facts["actor.sessionRoleId"] = participantContext.activeSessionRoleId;
    if (actor?.teamId !== undefined) facts["actor.teamId"] = actor.teamId;
    const clock = await input.client.query<{ now: Date }>("SELECT transaction_timestamp() AS now");
    facts["time.wallClock"] = clock.rows[0]?.now.toISOString() ?? new Date(0).toISOString();
    const evaluation = evaluateGate(definition.releaseGate, facts);
    if (!evaluation.passed) continue;
    const instanceId = randomUUID();
    if (!await releaseInject(input.client, input.context, input.activeReleaseId, release, definition, instanceId, input.command.commandId)) continue;
    await recordInjectEvent(input.client, input.context, input.activeReleaseId, input.command.commandId,
      instanceId, definition.id, { gateExplanations: evaluation.explanations });
    released.push(instanceId);
  }
  return released;
}

async function updateInjectAggregateState(
  client: PoolClient,
  context: SessionAccessContextV1,
  instanceId: string,
  definition: RuntimeInjectDefinitionV1
): Promise<number> {
  const result = await client.query<{ total: string; acknowledged: string; responded: string }>(
    `SELECT count(*) AS total,count(acknowledged_at) AS acknowledged,count(responded_at) AS responded
       FROM runtime.inject_recipient_states
      WHERE organization_id=$1 AND session_id=$2 AND inject_instance_id=$3`,
    [context.organizationId, context.sessionId, instanceId]
  );
  const row = result.rows[0];
  const total = Number(row?.total ?? 0);
  const acknowledged = Number(row?.acknowledged ?? 0);
  const responded = Number(row?.responded ?? 0);
  const progress = injectCompletion(definition, { total, acknowledged, responded });
  const updated = await client.query<{ version: string }>(
    `UPDATE runtime.inject_instances SET state=$1,
       acknowledged_at=CASE WHEN $2 THEN COALESCE(acknowledged_at,transaction_timestamp()) ELSE acknowledged_at END,
       responded_at=CASE WHEN $3 THEN COALESCE(responded_at,transaction_timestamp()) ELSE responded_at END,
       closed_at=CASE WHEN $1='closed' THEN COALESCE(closed_at,transaction_timestamp()) ELSE closed_at END,
       version=version+1
      WHERE organization_id=$4 AND session_id=$5 AND id=$6 RETURNING version`,
    [progress.state, progress.allAcknowledged, progress.allResponded && progress.responseRequired, context.organizationId, context.sessionId, instanceId]
  );
  const version = Number(updated.rows[0]?.version);
  if (!Number.isSafeInteger(version)) throw new Error("Inject version update failed");
  return version;
}

async function executeInjectCommand(
  input: CommandExecutionContext | PrincipalCommandExecutionContext,
  release: InformationRelease,
  operatorAuthority = false
): Promise<CommandDecision> {
  const { client, context, command, activeReleaseId } = input;
  if (command.operationType === "inject.release" && command.governingReleaseId !== activeReleaseId) {
    return { status: "needs_reconciliation", errorCode: "INCOMPATIBLE_RELEASE", message: "Injects use the active Release." };
  }
  if (command.operationType === "inject.release") {
    if (command.expectedAggregateVersion !== 0) {
      return { status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION", message: "A new Inject Instance starts at version zero." };
    }
    const definitionId = text(command.payload.injectDefinitionId);
    const definition = release.scenario.injects.find(({ id }) => id === definitionId);
    const role = release.coreDesign.sessionRoles.find(({ id }) => id === ("activeSessionRoleId" in context ? context.activeSessionRoleId : undefined));
    if (definition === undefined) return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The Inject Definition was not found." };
    if (definition.releaseMode !== "manual") return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "This Inject is not released manually." };
    if (!operatorAuthority && !role?.capabilities?.some(({ capability }) => capability === "inject.release")) {
      return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "The Active Role Context cannot release Injects." };
    }
    if (!await releaseInject(client, context as SessionAccessContextV1, activeReleaseId, release, definition, command.aggregateId, command.commandId)) {
      return { status: "rejected", errorCode: "TARGET_EXISTS", message: "The Inject has already been released." };
    }
    const releasedInjectIds = operatorAuthority ? [] : await releaseGateInjects(input as CommandExecutionContext);
    return { status: "accepted", aggregateVersion: 1, eventType: "inject.released",
      eventPayload: { injectInstanceId: command.aggregateId, injectDefinitionId: definition.id, releasedInjectIds } };
  }

  const result = await client.query<InjectInstanceRow>(
    `SELECT id,governing_release_id,inject_definition_id,state,version FROM runtime.inject_instances
      WHERE organization_id=$1 AND session_id=$2 AND id=$3 FOR UPDATE`,
    [context.organizationId, context.sessionId, command.aggregateId]
  );
  const instance = result.rows[0];
  if (instance === undefined) return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The Inject was not found." };
  if (!operatorAuthority && command.governingReleaseId !== instance.governing_release_id) {
    return { status: "needs_reconciliation", errorCode: "INCOMPATIBLE_RELEASE", message: "Use this Inject's Governing Release." };
  }
  release = await readInformationRelease(client, context as SessionAccessContextV1, instance.governing_release_id, command.commandId);
  const definition = release.scenario.injects.find(({ id }) => id === instance.inject_definition_id);
  if (definition === undefined) throw new Error(`Release lacks Inject Definition ${instance.inject_definition_id}`);
  if (command.operationType === "inject.reschedule") {
    if (!operatorAuthority) return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "Only the assigned Session Operator may reschedule Injects." };
    if (command.expectedAggregateVersion !== Number(instance.version)) return { status: "needs_reconciliation",
      errorCode: "STALE_AGGREGATE_VERSION", message: `The Inject is at version ${instance.version}.` };
    if (instance.state !== "scheduled" || definition.releaseMode !== "scheduled") return { status: "rejected",
      errorCode: "INVALID_TRANSITION", message: "Only an unreleased scheduled Inject can be rescheduled." };
    const value = command.payload.scheduledAt;
    const instant = typeof value === "string" ? new Date(value) : new Date(NaN);
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value) ||
      !Number.isFinite(instant.getTime()) || instant.toISOString() !== (value.includes(".") ? value : value.replace("Z", ".000Z"))) {
      return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "Choose a valid UTC date and time for the Inject." };
    }
    const version = Number(instance.version) + 1;
    await client.query(
      `UPDATE runtime.inject_instances SET scheduled_at=$1,version=$2,scheduling_command_id=$3,scheduled_by_person_id=$4
        WHERE organization_id=$5 AND session_id=$6 AND id=$7`,
      [instant,version,command.commandId,context.principalId,context.organizationId,context.sessionId,instance.id]
    );
    return { status: "accepted", aggregateVersion: version, eventType: "inject.scheduled",
      eventPayload: { injectInstanceId: instance.id, injectDefinitionId: definition.id, scheduledAt: instant.toISOString(),
        rescheduled: true, reason: command.payload.reason ?? null } };
  }
  if (command.operationType === "inject.cancel") {
    const role = release.coreDesign.sessionRoles.find(({ id }) => id === ("activeSessionRoleId" in context ? context.activeSessionRoleId : undefined));
    if (!operatorAuthority && !role?.capabilities?.some(({ capability }) => capability === "inject.release")) {
      return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "The Active Role Context cannot cancel Injects." };
    }
    if (command.expectedAggregateVersion !== Number(instance.version)) {
      return { status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION", message: `The Inject is at version ${instance.version}.` };
    }
    if (["cancelled", "expired", "closed"].includes(instance.state)) {
      return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The Inject can no longer be cancelled." };
    }
    const version = Number(instance.version) + 1;
    await client.query(
      "UPDATE runtime.inject_instances SET state='cancelled',version=$1 WHERE organization_id=$2 AND id=$3",
      [version, context.organizationId, instance.id]
    );
    return { status: "accepted", aggregateVersion: version, eventType: "inject.cancelled",
      eventPayload: { injectInstanceId: instance.id, injectDefinitionId: definition.id } };
  }

  if (operatorAuthority) {
    return { status: "rejected", errorCode: "CAPABILITY_UNAVAILABLE", message: "This Inject operation is participant-scoped." };
  }
  const participantContext = context as SessionAccessContextV1;
  const actor = actorFor(release, participantContext);
  const content = release.scenario.content.find(({ id }) => id === definition.contentId);
  const policy = release.coreDesign.informationPolicies.find(({ id }) => id === content?.informationPolicyId);
  if (!actor || !selectorAllows(definition.recipients, participantContext.activeSessionRoleId, actor) ||
      !policy?.grants.some(({ audience }) => selectorAllows(audience, participantContext.activeSessionRoleId, actor))) {
    return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The Inject was not found." };
  }
  if (["cancelled", "expired", "closed"].includes(instance.state)) {
    return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "This Inject no longer accepts recipient actions." };
  }

  const recipient = await client.query<{ version: string; acknowledged_at: Date | null; responded_at: Date | null }>(
    `SELECT version,acknowledged_at,responded_at FROM runtime.inject_recipient_states
      WHERE organization_id=$1 AND session_id=$2 AND inject_instance_id=$3 AND participant_id=$4 FOR UPDATE`,
    [context.organizationId, context.sessionId, instance.id, participantContext.participantId]
  );
  const recipientState = recipient.rows[0];
  if (recipientState === undefined) return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The Inject was not found." };
  const instanceVersion = Number(instance.version);
  if (command.expectedAggregateVersion !== instanceVersion) {
    return { status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION", message: `The Inject is at version ${instanceVersion}.` };
  }
  if (command.operationType === "inject.acknowledge") {
    if (definition.completionRequirements?.acknowledgementRequired === false) {
      return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "This Inject does not require acknowledgement." };
    }
    if (recipientState.acknowledged_at !== null) return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The Inject is already acknowledged." };
    const recipientVersion = Number(recipientState.version) + 1;
    await client.query(
      `UPDATE runtime.inject_recipient_states SET acknowledged_at=transaction_timestamp(),version=$1
        WHERE organization_id=$2 AND inject_instance_id=$3 AND participant_id=$4`,
      [recipientVersion, context.organizationId, instance.id, participantContext.participantId]
    );
    await client.query(
      `UPDATE runtime.information_deliveries SET acknowledged_at=transaction_timestamp()
        WHERE organization_id=$1 AND record_type='inject' AND record_id=$2 AND participant_id=$3`,
      [context.organizationId, instance.id, participantContext.participantId]
    );
    const version = await updateInjectAggregateState(client, participantContext, instance.id, definition);
    return { status: "accepted", aggregateVersion: version, eventType: "inject.acknowledged",
      eventPayload: { injectInstanceId: instance.id, injectDefinitionId: definition.id } };
  }
  if (command.operationType === "inject.respond") {
    if (definition.requiredResponseArtifactTypeId === undefined) {
      return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "This Inject does not require a response Artifact." };
    }
    if ((definition.completionRequirements?.acknowledgementRequired !== false && recipientState.acknowledged_at === null) || recipientState.responded_at !== null) {
      return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "Complete any required acknowledgement first. A response can be recorded once." };
    }
    const artifactId = text(command.payload.artifactId);
    const artifactType = release.coreDesign.artifactTypes.find(({ id }) => id === definition.requiredResponseArtifactTypeId);
    if (artifactId === undefined || artifactType === undefined) {
      return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "A valid response Artifact is required." };
    }
    const artifact = await client.query<{ artifact_type_key: string; owner_team_id: string | null; payload: JsonObject }>(
      `SELECT artifact_type_key,owner_team_id,payload FROM runtime.artifact_instances
        WHERE organization_id=$1 AND session_id=$2 AND id=$3 AND governing_release_id=$4
          AND (creator_participant_id=$5 OR $6=ANY(visible_role_ids)) FOR SHARE`,
      [context.organizationId, context.sessionId, artifactId, instance.governing_release_id, participantContext.participantId, participantContext.activeSessionRoleId]
    );
    const response = artifact.rows[0];
    const responsePolicy = release.coreDesign.informationPolicies.find(({ id }) => id === artifactType.informationPolicyId);
    if (response?.artifact_type_key !== artifactType.key || !responsePolicy?.grants.some(({ audience }) =>
      selectorAllows(audience, participantContext.activeSessionRoleId, actor, response.owner_team_id ?? undefined, response.payload))) {
      return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The response Artifact was not found." };
    }
    const recipientVersion = Number(recipientState.version) + 1;
    await client.query(
      `UPDATE runtime.inject_recipient_states
          SET responded_at=transaction_timestamp(),response_artifact_id=$1,version=$2
        WHERE organization_id=$3 AND inject_instance_id=$4 AND participant_id=$5`,
      [artifactId, recipientVersion, context.organizationId, instance.id, participantContext.participantId]
    );
    const version = await updateInjectAggregateState(client, participantContext, instance.id, definition);
    return { status: "accepted", aggregateVersion: version, eventType: "inject.responded",
      eventPayload: { injectInstanceId: instance.id, injectDefinitionId: definition.id, responseArtifactId: artifactId } };
  }
  return { status: "rejected", errorCode: "CAPABILITY_UNAVAILABLE", message: "This Inject operation is not available." };
}

export async function executeInformationCommand(
  input: CommandExecutionContext | PrincipalCommandExecutionContext,
  operatorAuthority = false
): Promise<CommandDecision> {
  const release = await readInformationRelease(input.client, input.context as SessionAccessContextV1, input.activeReleaseId, input.command.commandId);
  if (input.command.operationType === "message.send") return executeMessageSend(input as CommandExecutionContext, release);
  if (input.command.operationType.startsWith("message.proposal_")) return executeProposalCommand(input as CommandExecutionContext, release);
  if (input.command.operationType.startsWith("inject.")) return executeInjectCommand(input, release, operatorAuthority);
  return { status: "rejected", errorCode: "CAPABILITY_UNAVAILABLE", message: "This configured information-flow capability is not available." };
}

function injectContent(release: InformationRelease, contentId: string): JsonObject | undefined {
  const item = release.scenario.content.find(({ id }) => id === contentId);
  if (item === undefined) return undefined;
  return {
    title: item.title,
    type: item.type,
    version: item.version,
    ...(item.body === undefined ? {} : { body: item.body })
  };
}

export async function getInformationProjection(
  client: PoolClient,
  context: SessionAccessContextV1,
  actor: RuntimeActor,
  correlationId: string
): Promise<{ messages: RuntimeMessageV1[]; injects: RuntimeInjectV1[] }> {
  const release = await readInformationRelease(client, context, context.activeReleaseId, correlationId);
  const messages = await client.query<{
    id: string; channel_id: string; route_id: string; thread_id: string | null; sender_participant_id: string;
    sender_session_role_id: string; sender_team_id: string | null; operation_type: string; content: JsonObject; created_at: Date;
    approved_at: Date | null; approval_route_id: string | null;
    thread_state: RuntimeMessageV1["threadState"]; thread_version: string | null;
    delivered_at: Date | null; read_at: Date | null;
  }>(
    `SELECT message.id,message.channel_id,message.route_id,message.thread_id,message.sender_participant_id,
            message.sender_session_role_id,message.sender_team_id,message.operation_type,message.content,message.created_at,
            approval.approved_at,approval.release_route_id AS approval_route_id,
            thread.state AS thread_state,thread.version AS thread_version,
            recipient.delivered_at,recipient.read_at
       FROM runtime.messages message
       LEFT JOIN runtime.message_recipients recipient
         ON recipient.organization_id=message.organization_id AND recipient.message_id=message.id AND recipient.participant_id=$3
       LEFT JOIN runtime.message_approvals approval
         ON approval.organization_id=message.organization_id AND approval.message_id=message.id
       LEFT JOIN runtime.message_threads thread
         ON thread.organization_id=message.organization_id AND thread.id=message.thread_id
      WHERE message.organization_id=$1 AND message.session_id=$2
        AND (message.sender_participant_id=$3 OR recipient.participant_id=$3)
      ORDER BY message.created_at,message.id`,
    [context.organizationId, context.sessionId, context.participantId]
  );
  const injectRows = await client.query<{
    id: string; governing_release_id: string; inject_definition_id: string; state: RuntimeInjectV1["state"]; content_id: string;
    released_at: Date; acknowledged_at: Date | null; responded_at: Date | null; version: string;
  }>(
    `SELECT instance.id,instance.governing_release_id,instance.inject_definition_id,instance.state,instance.content_id,recipient.released_at,
            recipient.acknowledged_at,recipient.responded_at,instance.version
       FROM runtime.inject_instances instance
       JOIN runtime.inject_recipient_states recipient
         ON recipient.organization_id=instance.organization_id AND recipient.inject_instance_id=instance.id
      WHERE instance.organization_id=$1 AND instance.session_id=$2 AND recipient.participant_id=$3
        AND instance.state NOT IN ('scheduled','eligible','cancelled','expired')
      ORDER BY recipient.released_at,instance.id`,
    [context.organizationId, context.sessionId, context.participantId]
  );
  const injects: RuntimeInjectV1[] = [];
  for (const row of injectRows.rows) {
    const pinned = await readInformationRelease(client, context, row.governing_release_id, correlationId);
    const pinnedActor = actorFor(pinned, context);
    const definition = pinned.scenario.injects.find(({ id }) => id === row.inject_definition_id);
    const contentDefinition = pinned.scenario.content.find(({ id }) => id === row.content_id);
    const policy = pinned.coreDesign.informationPolicies.find(({ id }) => id === contentDefinition?.informationPolicyId);
    if (definition === undefined || contentDefinition === undefined || policy === undefined ||
        pinnedActor === undefined || !selectorAllows(definition.recipients, context.activeSessionRoleId, pinnedActor) ||
        !policy.grants.some(({ audience }) => selectorAllows(audience, context.activeSessionRoleId, pinnedActor))) continue;
    const rawContent = injectContent(pinned, row.content_id);
    const content = rawContent === undefined ? undefined : policyContent(
      pinned,
      contentDefinition.informationPolicyId,
      context.activeSessionRoleId,
      pinnedActor,
      rawContent
    );
    if (content === undefined) continue;
    injects.push({
      id: row.id,
      definitionId: definition.id,
      title: definition.title,
      content,
      state: row.state,
      releasedAt: row.released_at.toISOString(),
      acknowledgedAt: row.acknowledged_at?.toISOString() ?? null,
      respondedAt: row.responded_at?.toISOString() ?? null,
      requiredResponseArtifactTypeId: definition.requiredResponseArtifactTypeId ?? null,
      governingReleaseId: row.governing_release_id,
      acknowledgementRequired: definition.completionRequirements?.acknowledgementRequired ?? true,
      recipientComplete: injectCompletion(definition, { total: 1, acknowledged: row.acknowledged_at === null ? 0 : 1,
        responded: row.responded_at === null ? 0 : 1 }).complete,
      responseArtifactTypeKey: pinned.coreDesign.artifactTypes.find(({ id }) => id === definition.requiredResponseArtifactTypeId)?.key ?? null,
      version: Number(row.version)
    });
  }
  const projectedMessages: RuntimeMessageV1[] = [];
  for (const row of messages.rows) {
    const route = release.coreDesign.communications.routes.find(({ id }) => id === row.route_id);
    const content = policyContent(
      release,
      route?.informationPolicyId,
      context.activeSessionRoleId,
      actor,
      row.content,
      row.sender_team_id ?? undefined
    );
    if (content === undefined) continue;
    projectedMessages.push({
      id: row.id,
      channelId: row.channel_id,
      routeId: row.route_id,
      threadId: row.thread_id,
      senderParticipantId: row.sender_participant_id,
      senderSessionRoleId: row.sender_session_role_id,
      operationType: row.operation_type,
      content,
      sentAt: row.created_at.toISOString(),
      approvedAt: row.approved_at?.toISOString() ?? null,
      approvalRouteId: row.approval_route_id,
      threadState: row.thread_state,
      threadVersion: row.thread_version === null ? null : Number(row.thread_version),
      deliveryState: row.read_at === null ? row.delivered_at === null ? "released" : "delivered" : "read"
    });
  }
  return {
    messages: projectedMessages,
    injects
  };
}
