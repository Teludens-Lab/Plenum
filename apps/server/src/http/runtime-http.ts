import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  createErrorEnvelope,
  type CommandEnvelopeV1,
  type CommandReceiptV1,
  type ErrorEnvelopeV1,
  type JsonObject
} from "@plenum/event-contracts";
import type { Pool } from "pg";
import type { MediaProviderAdapter } from "@plenum/media-adapter";

import { withOrganizationTransaction } from "../database.js";
import { AuthorizationError, authorizationError } from "../errors.js";
import { resolveSessionAccessContext } from "../identity/context.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import { getRuntimeProjection, submitRuntimeCommand } from "../runtime/artifact-workflow.js";
import { validateCommandEnvelope } from "../runtime/commands/processor.js";
import { getOperatorProjection } from "../runtime/operator-projection.js";
import { executePendingModelRun, exportExtensionProvenance, getEffectProposals, type ExtensionRuntime } from "../extensions/runtime.js";
import { getMyReceipt, getPoll, getPollAudit, getPollResult, getPolls } from "../voting/polls.js";
import { issueMediaCredential, reconcileRevokedVoiceParticipants, releaseFloor, renewFloor, requestFloor, voiceReceipt } from "../comms/voice.js";
import type { ObjectStore } from "../registry/object-store.js";
import { getCollaborativeDraft, getRolePreview, publishCollaborativeDraft, type CollaborativePublishInput, type RolePreviewInput } from "../studio/collaboration/service.js";

const MAX_BODY_BYTES = 1_000_000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface RuntimeHttpOptions {
  pool: Pool;
  deploymentId: string;
  authenticate(request: IncomingMessage, correlationId: string): Promise<AuthenticatedPrincipal>;
  extensionRuntime?: ExtensionRuntime;
  mediaAdapter?: MediaProviderAdapter;
  floorTokenSecret?: string;
  objectStore?: ObjectStore;
}

function collaborativePublishInput(body: JsonObject, correlationId: string): CollaborativePublishInput {
  const allowed = new Set(["freezeId", "releaseLabel", "semanticVersion", "methodologyVersion", "releaseNotes",
    "warningsAcknowledged", "classificationReviewId", "accessibilityReviewStatus", "retentionPolicyId", "approvalNotes"]);
  if (Object.keys(body).some((field) => !allowed.has(field))) {
    throw authorizationError("VALIDATION_FAILED", "The publication request contains an unknown field.", correlationId);
  }
  const stringFields = ["releaseLabel", "semanticVersion", "methodologyVersion", "releaseNotes", "classificationReviewId",
    "accessibilityReviewStatus", "retentionPolicyId", "approvalNotes"] as const;
  for (const field of stringFields) {
    if (typeof body[field] !== "string" || body[field].length === 0 || body[field].length > 4_000) {
      throw authorizationError("VALIDATION_FAILED", `Publication field ${field} is required.`, correlationId);
    }
  }
  if (body.warningsAcknowledged !== true ||
      (body.freezeId !== undefined && (typeof body.freezeId !== "string" || !uuid.test(body.freezeId)))) {
    throw authorizationError("VALIDATION_FAILED", "Publication controls are incomplete.", correlationId);
  }
  if (!/^\d+\.\d+\.\d+$/u.test(String(body.semanticVersion))) {
    throw authorizationError("VALIDATION_FAILED", "The semantic version must use major.minor.patch.", correlationId);
  }
  return body as unknown as CollaborativePublishInput;
}

function rolePreviewInput(body: JsonObject, correlationId: string): RolePreviewInput {
  if (Object.keys(body).some((field) => !["sessionRoleId", "stageId", "teamId"].includes(field)) ||
      typeof body.sessionRoleId !== "string" || body.sessionRoleId.length === 0 || body.sessionRoleId.length > 200 ||
      typeof body.stageId !== "string" || body.stageId.length === 0 || body.stageId.length > 200 ||
      (body.teamId !== undefined && (typeof body.teamId !== "string" || body.teamId.length === 0 || body.teamId.length > 200))) {
    throw authorizationError("VALIDATION_FAILED", "The role preview selection is invalid.", correlationId);
  }
  return body as unknown as RolePreviewInput;
}

function statusFor(code: ErrorEnvelopeV1["error"]["code"]): number {
  if (code === "UNAUTHENTICATED" || code === "AUTH_EXPIRED") return 401;
  if (["PERMISSION_DENIED", "RESULT_NOT_RELEASED", "ACCESS_REVOKED", "NOT_A_PARTICIPANT", "DEVICE_NOT_REGISTERED"].includes(code)) return 403;
  if (["NOT_FOUND", "TARGET_NOT_FOUND"].includes(code)) return 404;
  if (["STALE_AGGREGATE_VERSION", "INCOMPATIBLE_RELEASE", "IDEMPOTENCY_COLLISION", "INVALID_TRANSITION", "TARGET_EXISTS", "ALREADY_VOTED", "DEADLINE_EXPIRED", "CAPABILITY_UNAVAILABLE", "FLOOR_BUSY", "FLOOR_TOKEN_EXPIRED"].includes(code)) return 409;
  if (["AUTHORITY_UNAVAILABLE", "MEDIA_UNAVAILABLE"].includes(code)) return 503;
  if (code === "TOO_LARGE") return 413;
  if (["INVALID_ID", "INVALID_JSON"].includes(code)) return 400;
  if (["INVALID_COMMAND", "VALIDATION_FAILED", "REFERENCE_INVALID"].includes(code)) return 422;
  return 500;
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage, correlationId: string): Promise<JsonObject> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_BODY_BYTES) throw authorizationError("TOO_LARGE", "The request exceeds 1 MB.", correlationId);
    chunks.push(bytes);
  }
  if (chunks.length === 0) return {};
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("object required");
    return value as JsonObject;
  } catch {
    throw authorizationError("INVALID_JSON", "The request body must be a JSON object.", correlationId);
  }
}

function pathId(value: string | undefined, correlationId: string): string {
  if (value === undefined || !uuid.test(value)) {
    throw authorizationError("INVALID_ID", "The path identifier is invalid.", correlationId);
  }
  return value.toLowerCase();
}

function deviceHeader(request: IncomingMessage, correlationId: string): string {
  const value = request.headers["x-device-id"];
  if (typeof value !== "string" || !uuid.test(value)) {
    throw authorizationError("DEVICE_NOT_REGISTERED", "A registered Device is required.", correlationId);
  }
  return value.toLowerCase();
}

async function registerDevice(pool: Pool, principal: AuthenticatedPrincipal): Promise<{ deviceId: string }> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const deviceId = randomUUID();
    await client.query(
      "INSERT INTO sync.devices(id,organization_id,person_id) VALUES ($1,$2,$3)",
      [deviceId, principal.organizationId, principal.principalId]
    );
    return { deviceId };
  });
}

async function receiptFor(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  commandId: string,
  correlationId: string
): Promise<CommandReceiptV1> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const result = await client.query<{
      command_id: string; status: CommandReceiptV1["status"]; result_version: string | null;
      evidence_sequence: string | null; rejection_code: CommandReceiptV1["errorCode"];
      message: string | null;
    }>(
      `SELECT command_id,status,result_version,evidence_sequence,rejection_code,message
         FROM sync.command_receipts
        WHERE organization_id=$1 AND session_id=$2 AND command_id=$3 AND actor_person_id=$4`,
      [principal.organizationId, sessionId, commandId, principal.principalId]
    );
    const row = result.rows[0];
    if (row === undefined) throw authorizationError("NOT_FOUND", "The Command Receipt was not found.", correlationId);
    return {
      commandId: row.command_id,
      status: row.status,
      aggregateVersion: row.result_version === null ? null : Number(row.result_version),
      evidenceSequence: row.evidence_sequence === null ? null : Number(row.evidence_sequence),
      errorCode: row.rejection_code,
      message: row.message,
      replayed: true
    };
  });
}

export function createRuntimeHttpHandler(options: RuntimeHttpOptions) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const correlationId = randomUUID();
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (!url.pathname.startsWith("/v1/")) return false;
      const principal = await options.authenticate(request, correlationId);
      let match: RegExpMatchArray | null;
      if (request.method === "POST" && url.pathname === "/v1/devices") {
        send(response, 201, await registerDevice(options.pool, principal));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/draft$/u))) {
        send(response, 200, await getCollaborativeDraft(options.pool, principal, pathId(match[1], correlationId), correlationId));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/validate$/u))) {
        const draft = await getCollaborativeDraft(options.pool, principal, pathId(match[1], correlationId), correlationId);
        send(response, draft.validation.valid ? 200 : 422, draft.validation);
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/role-preview$/u))) {
        const projectId = pathId(match[1], correlationId);
        send(response, 200, await getRolePreview(options.pool, principal, projectId,
          rolePreviewInput(await readBody(request, correlationId), correlationId), correlationId));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/publish$/u))) {
        if (options.objectStore === undefined) throw authorizationError("CAPABILITY_UNAVAILABLE", "Publication storage is not configured.", correlationId);
        const projectId = pathId(match[1], correlationId);
        send(response, 201, await publishCollaborativeDraft(options.pool, options.objectStore, principal, projectId,
          collaborativePublishInput(await readBody(request, correlationId), correlationId), correlationId));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/runtime-projection$/u))) {
        send(response, 200, await getRuntimeProjection({
          pool: options.pool,
          principal,
          sessionId: pathId(match[1], correlationId),
          deviceId: deviceHeader(request, correlationId),
          correlationId
        }));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/polls$/u))) {
        const sessionId = pathId(match[1], correlationId);
        const context = await withOrganizationTransaction(options.pool, principal.organizationId, (client) =>
          resolveSessionAccessContext(client, principal, { sessionId, deviceId: deviceHeader(request, correlationId), correlationId }));
        send(response, 200, await getPolls(options.pool, context));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/voice-channels$/u))) {
        const sessionId = pathId(match[1], correlationId);
        const context = await withOrganizationTransaction(options.pool, principal.organizationId, (client) =>
          resolveSessionAccessContext(client, principal, { sessionId, deviceId: deviceHeader(request, correlationId), correlationId }));
        const projection = await getRuntimeProjection({pool:options.pool,principal,sessionId,deviceId:context.deviceId!,correlationId});
        send(response,200,{voiceChannels:projection.voiceChannels});
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/voice-channels\/([^/]+)\/status$/u))) {
        const sessionId = pathId(match[1], correlationId), channelId = pathId(match[2], correlationId);
        const context = await withOrganizationTransaction(options.pool, principal.organizationId, (client) =>
          resolveSessionAccessContext(client, principal, { sessionId, deviceId: deviceHeader(request, correlationId), correlationId }));
        const projection = await getRuntimeProjection({pool:options.pool,principal,sessionId,deviceId:context.deviceId!,correlationId});
        const channel = projection.voiceChannels.find(({id})=>id===channelId);
        if(channel===undefined) throw authorizationError("TARGET_NOT_FOUND","The Voice Channel was not found.",correlationId);
        send(response,200,channel);
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/voice-channels\/([^/]+)\/floor-requests(?:\/([^/]+)\/(renew|release))?$/u))) {
        if(options.mediaAdapter===undefined||options.floorTokenSecret===undefined) throw authorizationError("CAPABILITY_UNAVAILABLE","Voice media is not configured.",correlationId);
        const sessionId=pathId(match[1],correlationId),channelId=pathId(match[2],correlationId),body=await readBody(request,correlationId);
        const action=match[4]??"request",requestId=match[3]===undefined?body.requestId:pathId(match[3],correlationId);
        const context=await withOrganizationTransaction(options.pool,principal.organizationId,(client)=>resolveSessionAccessContext(client,principal,
          {sessionId,deviceId:deviceHeader(request,correlationId),correlationId}));
        if(typeof requestId!=="string"||!uuid.test(requestId)||typeof body.connectionId!=="string"||!uuid.test(body.connectionId)||
            !Number.isSafeInteger(body.expectedAuthorityEpoch)||(body.reason!==undefined&&(typeof body.reason!=="string"||body.reason.length>1000))||
            (action!=="request"&&(typeof body.floorToken!=="string"||body.floorToken.length<32))) {
          throw authorizationError("VALIDATION_FAILED","The Floor request is invalid.",correlationId);
        }
        const floorInput={pool:options.pool,context,channelId,deviceId:context.deviceId!,correlationId,deploymentId:options.deploymentId,
          tokenSecret:options.floorTokenSecret,mediaAdapter:options.mediaAdapter,input:{requestId,connectionId:body.connectionId,
            expectedAuthorityEpoch:Number(body.expectedAuthorityEpoch),...(typeof body.floorToken==="string"?{floorToken:body.floorToken}:{}),
            ...(typeof body.reason==="string"?{reason:body.reason}:{})}};
        const result=action==="request"?await requestFloor(floorInput):action==="renew"?await renewFloor(floorInput):await releaseFloor(floorInput);
        send(response,200,result);
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/polls\/([^/]+)\/(my-receipt|result|audit)$/u))) {
        const sessionId = pathId(match[1], correlationId), pollId = pathId(match[2], correlationId);
        const context = await withOrganizationTransaction(options.pool, principal.organizationId, (client) =>
          resolveSessionAccessContext(client, principal, { sessionId, deviceId: deviceHeader(request, correlationId), correlationId }));
        const result = match[3] === "my-receipt" ? await getMyReceipt(options.pool, context, pollId, correlationId) :
          match[3] === "result" ? await getPollResult(options.pool, context, pollId, correlationId) :
            await getPollAudit(options.pool, context, pollId, correlationId);
        send(response, 200, result);
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/polls\/([^/]+)$/u))) {
        const sessionId = pathId(match[1], correlationId), pollId = pathId(match[2], correlationId);
        const context = await withOrganizationTransaction(options.pool, principal.organizationId, (client) =>
          resolveSessionAccessContext(client, principal, { sessionId, deviceId: deviceHeader(request, correlationId), correlationId }));
        send(response, 200, await getPoll(options.pool, context, pollId, correlationId));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/commands$/u))) {
        const sessionId = pathId(match[1], correlationId);
        const command = await readBody(request, correlationId) as unknown as CommandEnvelopeV1;
        validateCommandEnvelope(command, correlationId);
        const context = await withOrganizationTransaction(options.pool, principal.organizationId, (client) =>
          resolveSessionAccessContext(client, principal, {
            sessionId,
            deviceId: command.deviceId,
            ...(command.activeSessionRoleId === undefined ? {} : { requestedActiveSessionRoleId: command.activeSessionRoleId }),
            correlationId
          }));
        const receipt = await submitRuntimeCommand(
          options.pool, context, command, correlationId, options.deploymentId, options.extensionRuntime?.plans, options.mediaAdapter
        );
        if (receipt.status === "accepted" && command.operationType === "composition_run.start" && options.extensionRuntime !== undefined) {
          await executePendingModelRun(options.pool, principal.organizationId, command.aggregateId, options.extensionRuntime);
        }
        const requiresMediaEnforcement = command.operationType.startsWith("voice_") || command.operationType.startsWith("stage.") ||
          command.operationType === "participant.reassign";
        if(options.mediaAdapter!==undefined && receipt.status==="accepted" && requiresMediaEnforcement) {
          try {
            if(command.operationType==="voice_channel.leave") await options.mediaAdapter.removeParticipant({organizationId:context.organizationId,sessionId,
              channelId:command.aggregateId,participantId:context.participantId});
            if(command.operationType==="voice_channel.close") await options.mediaAdapter.closeChannel({organizationId:context.organizationId,sessionId,channelId:command.aggregateId});
            if(command.operationType==="voice_channel.moderate"&&typeof command.payload.targetParticipantId==="string") {
              const target={organizationId:context.organizationId,sessionId,channelId:command.aggregateId,participantId:command.payload.targetParticipantId};
              if(command.payload.action==="remove") await options.mediaAdapter.removeParticipant(target); else await options.mediaAdapter.setTransmit(target,false);
            }
            if(command.operationType.startsWith("stage.")||command.operationType==="participant.reassign") {
              await reconcileRevokedVoiceParticipants(options.pool,context,options.mediaAdapter);
            }
          } catch { throw authorizationError("MEDIA_UNAVAILABLE","The authoritative change was recorded, but provider enforcement is pending retry.",correlationId); }
        }
        if(command.operationType==="voice_channel.join") {
          if(options.mediaAdapter===undefined) throw authorizationError("CAPABILITY_UNAVAILABLE","Voice media is not configured.",correlationId);
          const credential=receipt.status==="accepted"?await issueMediaCredential(options.pool,context,command.aggregateId,options.mediaAdapter,correlationId):null;
          send(response,receipt.status==="accepted"?200:409,voiceReceipt(receipt,credential));
          return true;
        }
        send(response, receipt.status === "accepted" ? 200 : 409, receipt);
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/effect-proposals$/u))) {
        const sessionId = pathId(match[1], correlationId);
        const context = await withOrganizationTransaction(options.pool, principal.organizationId, (client) =>
          resolveSessionAccessContext(client, principal, { sessionId, deviceId: deviceHeader(request, correlationId), correlationId }));
        send(response, 200, { proposals: await getEffectProposals(options.pool, context) });
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/extension-provenance$/u))) {
        const sessionId = pathId(match[1], correlationId);
        send(response, 200, await exportExtensionProvenance(options.pool, principal, sessionId, correlationId));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/commands\/([^/]+)$/u))) {
        send(response, 200, await receiptFor(
          options.pool, principal, pathId(match[1], correlationId), pathId(match[2], correlationId), correlationId
        ));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/operator\/sessions\/([^/]+)$/u))) {
        send(response, 200, await getOperatorProjection(
          options.pool, principal, pathId(match[1], correlationId), correlationId
        ));
        return true;
      }
      send(response, 404, createErrorEnvelope("NOT_FOUND", "The endpoint was not found.", correlationId));
      return true;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        send(response, statusFor(error.envelope.error.code), error.envelope);
      } else {
        send(response, 500, createErrorEnvelope("INTERNAL", "The request could not be completed.", correlationId));
      }
      return true;
    }
  };
}
