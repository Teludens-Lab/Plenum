import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  createErrorEnvelope,
  PRODUCT_SHELL_CONTRACT_ID,
  type CommandEnvelopeV1,
  type CommandReceiptV1,
  type ErrorEnvelopeV1,
  type JsonObject
} from "@plenum/event-contracts";
import type { Pool } from "pg";
import type { MediaProviderAdapter } from "@plenum/media-adapter";
import type { PluginRevocationsV1 } from "@plenum/plugin-sdk";
import type { OrganizationRole } from "@plenum/policy-engine";
import { compileModelComposition, previewCompositionFixture } from "@plenum/release-compiler";
import { COMPOSITION_DEFINITION_CONTRACT_ID } from "@plenum/simulation-schema";

import { withOrganizationTransaction } from "../database.js";
import { AuthorizationError, authorizationError } from "../errors.js";
import { resolveSessionAccessContext } from "../identity/context.js";
import { revokeAuthenticationSession, type AuthenticatedPrincipal } from "../identity/login.js";
import { getRuntimeProjection, submitRuntimeCommand } from "../runtime/artifact-workflow.js";
import { activateRelease, getReleaseHistory, getReleaseImpact, reviewReleaseImpact } from "../runtime/release-activation.js";
import { getAdjudications } from "../adjudication/service.js";
import { getRuntimeBootstrap, getRuntimeDeltas, getRuntimeSnapshot, getRuntimeSse } from "../sync/runtime-sync.js";
import { validateCommandEnvelope } from "../runtime/commands/processor.js";
import { getOperatorProjection } from "../runtime/operator-projection.js";
import { executeOperatorInjectControl, executeOperatorSessionCommand, executeOperatorStageControl, retryOperatorDelivery } from "../runtime/operator-control.js";
import {
  archiveSession,
  assignParticipant,
  activateDisplayPrincipal,
  claimSeat,
  configureSessionAccess,
  confirmReadiness,
  createGuestIdentity,
  createSession,
  deleteSession,
  decideJoinRequest,
  getReadiness,
  importRoster,
  issueInvitation,
  markSessionReady,
  openSession,
  reassignSeat,
  removeParticipants,
  revokeSessionPrincipal,
  resolveInvitationSession,
  resolveVisibleInvitationSession,
  resolvePrincipalCommandContext,
  submitJoinRequest
} from "../runtime/access/onboarding.js";
import { getParticipantEntry } from "../runtime/access/participant-entry.js";
import { executePendingModelRun, exportExtensionProvenance, getEffectProposals, type ExtensionRuntime } from "../extensions/runtime.js";
import { acceptPluginLicense, approvePluginArtifact, getPluginCatalog, importPluginRevocations,
  installPluginArtifact, provisionPluginTrustRoot, registerPluginPublisher, revokePluginArtifact,
  submitPluginArtifact } from "../extensions/registry.js";
import { getMyReceipt, getPoll, getPollAudit, getPollResult, getPolls } from "../voting/polls.js";
import { issueMediaCredential, reconcileRevokedVoiceParticipants, releaseFloor, renewFloor, requestFloor, voiceReceipt } from "../comms/voice.js";
import type { ObjectStore } from "../registry/object-store.js";
import { exportResearchEvidenceBundle, exportResearchEvidenceIndex, grantResearchAccess, revokeResearchAccess } from "../research/evidence.js";
import { createRetentionPolicy, exportOrganizationArchive, generateSessionReport, importOrganizationArchive,
  placeLegalHold, recordCorrection, recordResearchConsent, releaseLegalHold,
  type OrganizationArchive, type ReportFormat } from "../reporting/service.js";
import { replaySession, type SessionReplayAdapter } from "../replay/service.js";
import { getDataPolicyOperations, getReportArtifact, getSessionRetentionStatus, listOrganizationMemberAdministration,
  listPluginOperations, listResearchReportableSessions, listSessionReportArtifacts, replaceOrganizationMemberRoles } from "../operations/administration.js";
import { approvePublicationFreeze, freezeCollaborativeDraft, getCollaborativeDraft, getPublicationReview, getRolePreview,
  publishCollaborativeDraft, rehearseCollaborativeDraft, type CollaborativePublishInput,
  type RolePreviewInput } from "../studio/collaboration/service.js";
import { archiveProject, createProject, listProjectPortal, listSimulationTemplates, publishSimulationTemplate,
  recordTemplateLifecycle, reopenProject } from "../studio/portal.js";
import { listContentLibrary, uploadContentVersion, type ContentScanner, type UploadContentInput } from "../studio/content-library.js";
import {
  createConfiguredSession,
  getReleaseCatalogItem,
  getSessionCatalogItem,
  listReleaseCatalog,
  listSessionCatalog
} from "../registry/lifecycle-portal.js";
import { exportReleasePackage, importReleasePackage } from "../registry/publication.js";

const MAX_BODY_BYTES = 1_000_000;
const MAX_PACKAGE_BYTES = 32_000_000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface RuntimeHttpOptions {
  pool: Pool;
  deploymentId: string;
  authenticate(request: IncomingMessage, correlationId: string): Promise<AuthenticatedPrincipal>;
  extensionRuntime?: ExtensionRuntime;
  mediaAdapter?: MediaProviderAdapter;
  floorTokenSecret?: string;
  objectStore?: ObjectStore;
  replayAdapter?: SessionReplayAdapter;
  contentScanner?: ContentScanner;
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

function contentUploadInput(body: JsonObject, correlationId: string): UploadContentInput {
  const allowed = new Set(["requestId", "contentItemId", "title", "fileName", "mediaType", "contentBase64"]);
  const encoded = body.contentBase64;
  if (Object.keys(body).some((field) => !allowed.has(field)) || typeof body.requestId !== "string" || !uuid.test(body.requestId) ||
      (body.contentItemId !== undefined && (typeof body.contentItemId !== "string" || !uuid.test(body.contentItemId))) ||
      typeof body.title !== "string" || typeof body.fileName !== "string" || typeof body.mediaType !== "string" ||
      typeof encoded !== "string" || encoded.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)) {
    throw authorizationError("VALIDATION_FAILED", "The governed content upload is invalid.", correlationId);
  }
  return { requestId: body.requestId, ...(typeof body.contentItemId === "string" ? { contentItemId: body.contentItemId } : {}),
    title: body.title, fileName: body.fileName, mediaType: body.mediaType, bytes: Buffer.from(encoded, "base64") };
}

function statusFor(code: ErrorEnvelopeV1["error"]["code"]): number {
  if (code === "UNAUTHENTICATED" || code === "AUTH_EXPIRED") return 401;
  if (["PERMISSION_DENIED", "RESULT_NOT_RELEASED", "ACCESS_REVOKED", "NOT_A_PARTICIPANT", "DEVICE_NOT_REGISTERED"].includes(code)) return 403;
  if (["NOT_FOUND", "TARGET_NOT_FOUND"].includes(code)) return 404;
  if (["STALE_AGGREGATE_VERSION", "INCOMPATIBLE_RELEASE", "IDEMPOTENCY_COLLISION", "INVALID_TRANSITION", "TARGET_EXISTS", "ALREADY_VOTED", "DEADLINE_EXPIRED", "CAPABILITY_UNAVAILABLE", "FLOOR_BUSY", "FLOOR_TOKEN_EXPIRED"].includes(code)) return 409;
  if (["AUTHORITY_UNAVAILABLE", "MEDIA_UNAVAILABLE"].includes(code)) return 503;
  if (code === "RATE_LIMITED") return 429;
  if (code === "TOO_LARGE") return 413;
  if (["INVALID_ID", "INVALID_JSON"].includes(code)) return 400;
  if (["INVALID_COMMAND", "VALIDATION_FAILED", "REFERENCE_INVALID"].includes(code)) return 422;
  return 500;
}

function statusForReceipt(receipt: CommandReceiptV1): number {
  return receipt.status === "accepted" ? 200 : statusFor(receipt.errorCode ?? "INTERNAL");
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function sendSse(response: ServerResponse, body: string): void {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store",
    connection: "keep-alive"
  });
  response.end(body);
}

function sendArtifact(response: ServerResponse, artifact: { contentType: string; filename: string; bytes: Uint8Array }): void {
  response.writeHead(200, { "content-type": artifact.contentType, "content-length": artifact.bytes.byteLength,
    "content-disposition": `attachment; filename="${artifact.filename}"`, "cache-control": "no-store",
    "x-content-type-options": "nosniff" });
  response.end(Buffer.from(artifact.bytes));
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

async function readPackageBytes(request: IncomingMessage, correlationId: string): Promise<Uint8Array> {
  if (request.headers["content-type"]?.split(";", 1)[0] !== "application/vnd.plenum.release+json") {
    throw authorizationError("VALIDATION_FAILED", "A Plenum Release Package content type is required.", correlationId);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_PACKAGE_BYTES) throw authorizationError("TOO_LARGE", "The Release Package exceeds 32 MB.", correlationId);
    chunks.push(bytes);
  }
  if (size === 0) throw authorizationError("VALIDATION_FAILED", "The Release Package is empty.", correlationId);
  return Buffer.concat(chunks);
}

async function readPluginBytes(request: IncomingMessage, correlationId: string): Promise<Uint8Array> {
  const contentType = request.headers["content-type"]?.split(";", 1)[0];
  if (contentType !== "application/vnd.plenum.plugin+json" && contentType !== "application/json") {
    throw authorizationError("VALIDATION_FAILED", "A signed Plenum Plugin bundle content type is required.", correlationId);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_PACKAGE_BYTES) throw authorizationError("TOO_LARGE", "The Plugin bundle exceeds 32 MB.", correlationId);
    chunks.push(bytes);
  }
  if (size === 0) throw authorizationError("VALIDATION_FAILED", "The Plugin bundle is empty.", correlationId);
  return Buffer.concat(chunks);
}

function pathId(value: string | undefined, correlationId: string): string {
  if (value === undefined || !uuid.test(value)) {
    throw authorizationError("INVALID_ID", "The path identifier is invalid.", correlationId);
  }
  return value.toLowerCase();
}

function listInput(url: URL): { query?: string; status?: "active" | "archived" | "all"; limit?: number; cursor?: string } {
  const query = url.searchParams.get("query");
  const status = url.searchParams.get("status");
  const limit = url.searchParams.get("limit");
  const cursor = url.searchParams.get("cursor");
  return {
    ...(query === null ? {} : { query }),
    ...(status === null ? {} : { status: status as "active" | "archived" | "all" }),
    ...(limit === null ? {} : { limit: Number(limit) }),
    ...(cursor === null ? {} : { cursor })
  };
}

function createProjectInput(body: JsonObject, correlationId: string) {
  if (Object.keys(body).some((field) => !["requestId", "title", "templateId", "includeScenario"].includes(field)) ||
      typeof body.requestId !== "string" || typeof body.title !== "string" ||
      (body.templateId !== undefined && typeof body.templateId !== "string") ||
      (body.includeScenario !== undefined && typeof body.includeScenario !== "boolean")) {
    throw authorizationError("VALIDATION_FAILED", "Project creation fields are invalid.", correlationId);
  }
  return { requestId: body.requestId, title: body.title,
    ...(typeof body.templateId === "string" ? { templateId: body.templateId } : {}),
    ...(typeof body.includeScenario === "boolean" ? { includeScenario: body.includeScenario } : {}) };
}

function projectLifecycleInput(body: JsonObject, correlationId: string) {
  if (Object.keys(body).some((field) => !["requestId", "expectedVersion"].includes(field)) ||
      typeof body.requestId !== "string" || typeof body.expectedVersion !== "number") {
    throw authorizationError("VALIDATION_FAILED", "Project lifecycle fields are invalid.", correlationId);
  }
  return { requestId: body.requestId, expectedVersion: body.expectedVersion };
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

async function getProductShellContext(pool: Pool, principal: AuthenticatedPrincipal, correlationId: string) {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const result = await client.query<{ display_name: string; organization_name: string; is_member: boolean }>(
      `SELECT person.display_name, organization.name AS organization_name
         FROM identity.persons person
         JOIN identity.organizations organization ON organization.id = $1
        WHERE organization.id = $1 AND person.id = $2 AND (
          EXISTS (SELECT 1 FROM identity.memberships membership
            WHERE membership.organization_id=$1 AND membership.person_id=$2)
          OR EXISTS (SELECT 1 FROM runtime.participants participant
            JOIN runtime.seat_assignments assignment
              ON assignment.organization_id=participant.organization_id AND assignment.session_id=participant.session_id
             AND assignment.participant_id=participant.id AND assignment.valid_to IS NULL
            WHERE participant.organization_id=$1 AND participant.person_id=$2)
          OR EXISTS (SELECT 1 FROM identity.session_invitations invitation
            WHERE invitation.organization_id=$1 AND invitation.recipient_person_id=$2
              AND invitation.accepted_at IS NULL AND invitation.revoked_at IS NULL
              AND invitation.expires_at>transaction_timestamp())
          OR EXISTS (SELECT 1 FROM runtime.join_requests request
            WHERE request.organization_id=$1 AND request.person_id=$2
              AND request.status IN ('waiting_room','assignment_pending','admitted'))
        )
        LIMIT 1`,
      [principal.organizationId, principal.principalId]
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw authorizationError("PERMISSION_DENIED", "Current Organization or Session access is required.", correlationId);
    }
    const destinations: Array<"home" | "studio" | "runtime" | "operations"> = ["home", "runtime"];
    if (principal.organizationRoles.length > 0) destinations.splice(1, 0, "studio");
    if (principal.organizationRoles.some((role) => role === "operator" || role === "admin")) destinations.push("operations");
    return {
      contractId: PRODUCT_SHELL_CONTRACT_ID,
      principal: { id: principal.principalId, displayName: row.display_name },
      organization: { id: principal.organizationId, name: row.organization_name, roles: principal.organizationRoles },
      destinations
    };
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
      if (request.method === "GET" && url.pathname === "/v1/product-context") {
        send(response, 200, await getProductShellContext(options.pool, principal, correlationId));
        return true;
      }
      if (request.method === "GET" && url.pathname === "/v1/participant-entry") {
        send(response, 200, await getParticipantEntry(options.pool, principal));
        return true;
      }
      if (request.method === "POST" && url.pathname === "/v1/auth/logout") {
        await revokeAuthenticationSession(options.pool, principal, correlationId);
        send(response, 200, { signedOut: true });
        return true;
      }
      if (request.method === "POST" && url.pathname === "/v1/devices") {
        send(response, 201, await registerDevice(options.pool, principal));
        return true;
      }
      if (request.method === "GET" && url.pathname === "/v1/operations/members") {
        send(response, 200, await listOrganizationMemberAdministration(options.pool, principal, correlationId));
        return true;
      }
      if (request.method === "PUT" && (match = url.pathname.match(/^\/v1\/operations\/members\/([^/]+)\/roles$/u))) {
        const body = await readBody(request, correlationId);
        const roles = body.roles;
        if (Object.keys(body).some((field) => !["roles", "expectedRevision"].includes(field)) ||
            !Array.isArray(roles) || !roles.every((role) => typeof role === "string") ||
            typeof body.expectedRevision !== "string") {
          throw authorizationError("VALIDATION_FAILED", "The Organization Role change is invalid.", correlationId);
        }
        send(response, 200, await replaceOrganizationMemberRoles(options.pool, principal,
          pathId(match[1], correlationId), { roles: roles as OrganizationRole[], expectedRevision: body.expectedRevision }, correlationId));
        return true;
      }
      if (request.method === "GET" && url.pathname === "/v1/operations/plugins") {
        send(response, 200, await listPluginOperations(options.pool, principal, correlationId));
        return true;
      }
      if (request.method === "POST" && url.pathname === "/v1/plugin-publishers") {
        const body = await readBody(request, correlationId);
        if (Object.keys(body).some((field) => !["publisherPrincipalId", "displayName", "signatureKeyId", "publicKeyPem"].includes(field)) ||
            ![body.publisherPrincipalId, body.displayName, body.signatureKeyId, body.publicKeyPem].every((value) => typeof value === "string")) {
          throw authorizationError("VALIDATION_FAILED", "The Plugin Publisher registration is invalid.", correlationId);
        }
        const publisherId = randomUUID();
        await registerPluginPublisher(options.pool, principal, { publisherId,
          publisherPrincipalId: body.publisherPrincipalId as string, displayName: body.displayName as string,
          signatureKeyId: body.signatureKeyId as string, publicKeyPem: body.publicKeyPem as string, correlationId });
        send(response, 201, { publisherId });
        return true;
      }
      if (request.method === "POST" && url.pathname === "/v1/plugin-trust-roots") {
        const body = await readBody(request, correlationId);
        if (Object.keys(body).some((field) => !["publisherId", "publisherKeyId", "publisherPublicKeyPem", "revocationKeyId", "revocationPublicKeyPem"].includes(field)) ||
            ![body.publisherId, body.publisherKeyId, body.publisherPublicKeyPem, body.revocationKeyId,
              body.revocationPublicKeyPem].every((value) => typeof value === "string")) {
          throw authorizationError("VALIDATION_FAILED", "The Plugin trust root is invalid.", correlationId);
        }
        const trustRootId = randomUUID();
        await provisionPluginTrustRoot(options.pool, principal, { trustRootId, publisherId: body.publisherId as string,
          publisherKeyId: body.publisherKeyId as string, publisherPublicKeyPem: body.publisherPublicKeyPem as string,
          revocationKeyId: body.revocationKeyId as string, revocationPublicKeyPem: body.revocationPublicKeyPem as string,
          correlationId });
        send(response, 201, { trustRootId });
        return true;
      }
      if (request.method === "POST" && url.pathname === "/v1/plugin-revocations") {
        const body = await readBody(request, correlationId);
        if (Object.keys(body).some((field) => !["publisherId", "document"].includes(field)) ||
            typeof body.publisherId !== "string" || typeof body.document !== "object" || body.document === null || Array.isArray(body.document)) {
          throw authorizationError("VALIDATION_FAILED", "The signed Plugin revocation list is invalid.", correlationId);
        }
        const revocationListId = randomUUID();
        await importPluginRevocations(options.pool, principal, { revocationListId,
          publisherId: body.publisherId, document: body.document as PluginRevocationsV1, correlationId });
        send(response, 201, { revocationListId });
        return true;
      }
      if (request.method === "POST" && url.pathname === "/v1/plugins/submissions") {
        if (options.objectStore === undefined) throw authorizationError("CAPABILITY_UNAVAILABLE", "Plugin storage is not configured.", correlationId);
        send(response, 201, await submitPluginArtifact(options.pool, options.objectStore, principal,
          await readPluginBytes(request, correlationId), correlationId));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/plugins\/([^/]+)\/(approve|revoke)$/u))) {
        const artifactId = pathId(match[1], correlationId);
        if (match[2] === "approve") send(response, 200, await approvePluginArtifact(options.pool, principal, artifactId, correlationId));
        else { await revokePluginArtifact(options.pool, principal, artifactId, correlationId); send(response, 200, { revoked: true }); }
        return true;
      }
      if (request.method === "POST" && url.pathname === "/v1/plugins/licenses") {
        const body = await readBody(request, correlationId);
        if (Object.keys(body).some((field) => !["pluginId", "license", "termsDigest"].includes(field)) ||
            ![body.pluginId, body.license, body.termsDigest].every((value) => typeof value === "string")) {
          throw authorizationError("VALIDATION_FAILED", "The Plugin license acceptance is invalid.", correlationId);
        }
        const acceptanceId = randomUUID();
        await acceptPluginLicense(options.pool, principal, {
          acceptanceId, pluginId: body.pluginId as string,
          license: body.license as string, termsDigest: body.termsDigest as string, correlationId
        });
        send(response, 201, { accepted: true, acceptanceId });
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/organizations\/([^/]+)\/plugin-installations$/u))) {
        if (pathId(match[1], correlationId) !== principal.organizationId) {
          throw authorizationError("PERMISSION_DENIED", "Plugin installation is restricted to the active Organization.", correlationId);
        }
        if (options.objectStore === undefined) throw authorizationError("CAPABILITY_UNAVAILABLE", "Plugin storage is not configured.", correlationId);
        const body = await readBody(request, correlationId);
        const compatibility = body.compatibility;
        if (Object.keys(body).some((field) => !["installationId", "artifactId", "permittedPermissions", "compatibility"].includes(field)) ||
            ![body.installationId, body.artifactId].every((value) => typeof value === "string") ||
            !Array.isArray(body.permittedPermissions) || !body.permittedPermissions.every((value) => typeof value === "string") ||
            typeof compatibility !== "object" || compatibility === null || Array.isArray(compatibility) ||
            typeof compatibility.hostApiVersion !== "string" || typeof compatibility.releaseSchemaVersion !== "string" ||
            !["connected", "self_hosted", "air_gapped"].includes(String(compatibility.deploymentProfile))) {
          throw authorizationError("VALIDATION_FAILED", "The Plugin installation request is invalid.", correlationId);
        }
        send(response, 201, await installPluginArtifact(options.pool, options.objectStore, principal, {
          installationId: body.installationId as string, deploymentId: options.deploymentId,
          artifactId: body.artifactId as string, permittedPermissions: body.permittedPermissions as string[],
          compatibility: { hostApiVersion: compatibility.hostApiVersion, releaseSchemaVersion: compatibility.releaseSchemaVersion,
            deploymentProfile: compatibility.deploymentProfile as "connected" | "self_hosted" | "air_gapped" }, correlationId
        }));
        return true;
      }
      if (request.method === "GET" && url.pathname === "/v1/operations/data-policy") {
        send(response, 200, await getDataPolicyOperations(options.pool, principal, correlationId));
        return true;
      }
      if (request.method === "GET" && url.pathname === "/v1/research/reportable-sessions") {
        send(response, 200, await listResearchReportableSessions(options.pool, principal, correlationId));
        return true;
      }
      if (request.method === "POST" && url.pathname === "/v1/retention/policies") {
        const body = await readBody(request, correlationId);
        if (Object.keys(body).some((field) => !["policyKey", "version", "scopeType", "scopeReference", "periodDays",
          "legalHoldBehavior", "expiryAction", "archiveDestination", "approvalRequired"].includes(field)) ||
            typeof body.policyKey !== "string" || typeof body.version !== "number" || typeof body.scopeType !== "string" ||
            typeof body.scopeReference !== "string" || typeof body.periodDays !== "number" ||
            !["retain", "block_action"].includes(String(body.legalHoldBehavior)) ||
            !["archive", "anonymize", "delete"].includes(String(body.expiryAction)) ||
            typeof body.archiveDestination !== "string" || typeof body.approvalRequired !== "boolean") {
          throw authorizationError("VALIDATION_FAILED", "The retention policy request is invalid.", correlationId);
        }
        send(response, 201, await createRetentionPolicy(options.pool, principal, {
          policyKey: body.policyKey, version: body.version,
          scopeType: body.scopeType as "organization" | "project" | "artifact_type" | "message_channel" | "voice_channel" | "poll" | "session" | "export",
          scopeReference: body.scopeReference, periodDays: body.periodDays,
          legalHoldBehavior: body.legalHoldBehavior as "retain" | "block_action",
          expiryAction: body.expiryAction as "archive" | "anonymize" | "delete",
          archiveDestination: body.archiveDestination, approvalRequired: body.approvalRequired
        }, correlationId));
        return true;
      }
      if (request.method === "POST" && url.pathname === "/v1/reporting/corrections") {
        const body = await readBody(request, correlationId);
        if (Object.keys(body).some((field) => !["targetReference", "originalValue", "correctedValue", "reason", "reportsMustRegenerate"].includes(field)) ||
            typeof body.targetReference !== "string" || body.originalValue === undefined || body.correctedValue === undefined ||
            typeof body.reason !== "string" || typeof body.reportsMustRegenerate !== "boolean") {
          throw authorizationError("VALIDATION_FAILED", "The correction request is invalid.", correlationId);
        }
        send(response, 201, await recordCorrection(options.pool, principal, {
          targetReference: body.targetReference, originalValue: body.originalValue,
          correctedValue: body.correctedValue, reason: body.reason,
          reportsMustRegenerate: body.reportsMustRegenerate
        }, correlationId));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/organizations\/([^/]+)\/archive$/u))) {
        if (pathId(match[1], correlationId) !== principal.organizationId) {
          throw authorizationError("PERMISSION_DENIED", "Portable export is restricted to the active Organization.", correlationId);
        }
        const archive = await exportOrganizationArchive(options.pool, principal, correlationId);
        sendArtifact(response, { contentType: "application/json", filename: "plenum-organization-archive.json",
          bytes: new TextEncoder().encode(JSON.stringify(archive)) });
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/organizations\/([^/]+)\/archive\/import$/u))) {
        if (pathId(match[1], correlationId) !== principal.organizationId) {
          throw authorizationError("PERMISSION_DENIED", "Portable import is restricted to the active Organization.", correlationId);
        }
        const bytes = await readPluginBytes(request, correlationId);
        let archive: OrganizationArchive;
        try { archive = JSON.parse(new TextDecoder().decode(bytes)) as OrganizationArchive; }
        catch { throw authorizationError("INVALID_JSON", "The Organization archive is not valid JSON.", correlationId); }
        send(response, 201, await importOrganizationArchive(options.pool, principal, archive, correlationId));
        return true;
      }
      if (request.method === "GET" && url.pathname === "/v1/releases") {
        send(response, 200, await listReleaseCatalog(options.pool, principal, listInput(url), correlationId));
        return true;
      }
      if (request.method === "POST" && url.pathname === "/v1/releases/import") {
        if (options.objectStore === undefined) throw authorizationError("CAPABILITY_UNAVAILABLE", "Release Package storage is not configured.", correlationId);
        const bytes = await readPackageBytes(request, correlationId);
        const packageDigest = createHash("sha256").update(bytes).digest("hex");
        send(response, 201, await importReleasePackage(options.pool, options.objectStore, principal, bytes, packageDigest, correlationId));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/releases\/([^/]+)\/package$/u))) {
        if (options.objectStore === undefined) throw authorizationError("CAPABILITY_UNAVAILABLE", "Release Package storage is not configured.", correlationId);
        const releaseId = pathId(match[1], correlationId);
        sendArtifact(response, { contentType: "application/vnd.plenum.release+json",
          filename: `plenum-release-${releaseId}.json`,
          bytes: await exportReleasePackage(options.pool, options.objectStore, principal, releaseId, correlationId) });
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/releases\/([^/]+)\/sessions$/u))) {
        const releaseId = pathId(match[1], correlationId);
        const command = await readBody(request, correlationId) as unknown as CommandEnvelopeV1;
        send(response, 201, await createConfiguredSession(options.pool, principal, releaseId, command,
          correlationId, options.deploymentId));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/releases\/([^/]+)$/u))) {
        send(response, 200, await getReleaseCatalogItem(options.pool, principal, pathId(match[1], correlationId), correlationId));
        return true;
      }
      if (request.method === "GET" && url.pathname === "/v1/sessions") {
        send(response, 200, await listSessionCatalog(options.pool, principal, listInput(url), correlationId));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)$/u))) {
        send(response, 200, await getSessionCatalogItem(options.pool, principal, pathId(match[1], correlationId), correlationId));
        return true;
      }
      if (request.method === "GET" && url.pathname === "/v1/projects") {
        send(response, 200, await listProjectPortal(options.pool, principal, listInput(url), correlationId));
        return true;
      }
      if (request.method === "GET" && url.pathname === "/v1/templates") {
        const input = listInput(url);
        send(response, 200, await listSimulationTemplates(options.pool, principal,
          { ...(input.query === undefined ? {} : { query: input.query }), ...(input.limit === undefined ? {} : { limit: input.limit }),
            ...(input.cursor === undefined ? {} : { cursor: input.cursor }) }, correlationId));
        return true;
      }
      if (request.method === "POST" && url.pathname === "/v1/projects") {
        send(response, 201, await createProject(options.pool, principal,
          createProjectInput(await readBody(request, correlationId), correlationId), correlationId));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/(archive|reopen)$/u))) {
        const projectId = pathId(match[1], correlationId);
        const input = projectLifecycleInput(await readBody(request, correlationId), correlationId);
        send(response, 200, match[2] === "archive"
          ? await archiveProject(options.pool, principal, projectId, input, correlationId)
          : await reopenProject(options.pool, principal, projectId, input, correlationId));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/templates$/u))) {
        const body = await readBody(request, correlationId);
        if (Object.keys(body).some((field) => !["title", "summary", "includeScenario", "rationale", "supersedesTemplateId"].includes(field)) ||
            typeof body.title !== "string" || typeof body.summary !== "string" || typeof body.includeScenario !== "boolean" ||
            typeof body.rationale !== "string" || (body.supersedesTemplateId !== undefined && typeof body.supersedesTemplateId !== "string")) {
          throw authorizationError("VALIDATION_FAILED", "Template publication fields are invalid.", correlationId);
        }
        send(response, 201, await publishSimulationTemplate(options.pool, principal, pathId(match[1], correlationId), {
          title: body.title, summary: body.summary, includeScenario: body.includeScenario, rationale: body.rationale,
          ...(body.supersedesTemplateId === undefined ? {} : { supersedesTemplateId: body.supersedesTemplateId })
        }, correlationId));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/templates\/([^/]+)\/(deprecate|archive)$/u))) {
        const body = await readBody(request, correlationId);
        if (Object.keys(body).some((field) => field !== "rationale") || typeof body.rationale !== "string") {
          throw authorizationError("VALIDATION_FAILED", "A Template lifecycle rationale is required.", correlationId);
        }
        send(response, 201, await recordTemplateLifecycle(options.pool, principal, pathId(match[1], correlationId),
          match[2] === "deprecate" ? "deprecated" : "archived", body.rationale, correlationId));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/draft$/u))) {
        send(response, 200, await getCollaborativeDraft(options.pool, principal, pathId(match[1], correlationId), correlationId));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/content-library$/u))) {
        send(response, 200, await listContentLibrary(options.pool, principal, pathId(match[1], correlationId), correlationId));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/content-library\/uploads$/u))) {
        if (options.objectStore === undefined) throw authorizationError("CAPABILITY_UNAVAILABLE", "Content storage is not configured.", correlationId);
        send(response, 201, await uploadContentVersion(options.pool, options.objectStore, options.contentScanner, principal,
          pathId(match[1], correlationId), contentUploadInput(await readBody(request, correlationId), correlationId), correlationId));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/plugin-catalog$/u))) {
        const projectId = pathId(match[1], correlationId);
        send(response, 200, { plugins: await getPluginCatalog(options.pool, principal, correlationId, projectId) });
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/compositions\/validate$/u))) {
        const projectId = pathId(match[1], correlationId);
        const body = await readBody(request, correlationId);
        if (Object.keys(body).some((field) => !["compositionId", "fixtureId"].includes(field)) ||
            typeof body.compositionId !== "string" || typeof body.fixtureId !== "string") {
          throw authorizationError("VALIDATION_FAILED", "The Model Composition fixture request is invalid.", correlationId);
        }
        const draft = await getCollaborativeDraft(options.pool, principal, projectId, correlationId);
        const materialization = draft.materialization as { coreDesign?: { pluginBindings?: unknown[]; compositions?: unknown[]; sessionRoles?: Array<{ id: string }> } };
        const core = materialization.coreDesign;
        const composition = core?.compositions?.find((item) => typeof item === "object" && item !== null && "id" in item && item.id === body.compositionId);
        if (composition === undefined || core === undefined || !Array.isArray(core.pluginBindings)) {
          throw authorizationError("REFERENCE_INVALID", "The Model Composition is unavailable in this Draft.", correlationId);
        }
        const typedComposition = composition as Parameters<typeof compileModelComposition>[0];
        const bindings = core.pluginBindings as Parameters<typeof compileModelComposition>[1];
        const fixture = typedComposition.fixtures.find(({ id }) => id === body.fixtureId);
        if (fixture === undefined) throw authorizationError("REFERENCE_INVALID", "The composition fixture is unavailable.", correlationId);
        const compiled = compileModelComposition(typedComposition, bindings, new Set(core.sessionRoles?.map(({ id }) => id) ?? []));
        send(response, 200, { contractId: COMPOSITION_DEFINITION_CONTRACT_ID, compositionId: compiled.id,
          graphDigest: compiled.graphDigest, dependencyClosure: compiled.dependencyClosure,
          preview: previewCompositionFixture(compiled, bindings, fixture) });
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/organizations\/([^/]+)\/plugin-catalog$/u))) {
        const organizationId = pathId(match[1], correlationId);
        if (organizationId !== principal.organizationId) {
          throw authorizationError("PERMISSION_DENIED", "The Plugin catalog belongs to another Organization.", correlationId);
        }
        send(response, 200, { plugins: await getPluginCatalog(options.pool, principal, correlationId) });
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/validate$/u))) {
        const draft = await getCollaborativeDraft(options.pool, principal, pathId(match[1], correlationId), correlationId);
        send(response, draft.validation.valid ? 200 : 422, draft.validation);
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/rehearsals$/u))) {
        const body = await readBody(request, correlationId);
        if (Object.keys(body).some((field) => !["seed", "startedAt"].includes(field)) ||
            typeof body.seed !== "number" || typeof body.startedAt !== "string") {
          throw authorizationError("VALIDATION_FAILED", "The rehearsal seed and start time are invalid.", correlationId);
        }
        send(response, 200, await rehearseCollaborativeDraft(options.pool, principal,
          pathId(match[1], correlationId), { seed: body.seed, startedAt: body.startedAt }, correlationId));
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
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/publication-freezes$/u))) {
        send(response, 201, await freezeCollaborativeDraft(options.pool, principal, pathId(match[1], correlationId), correlationId));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/publication-review$/u))) {
        send(response, 200, await getPublicationReview(options.pool, principal, pathId(match[1], correlationId), correlationId));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/publication-freezes\/([^/]+)\/approve$/u))) {
        const body = await readBody(request, correlationId);
        if (Object.keys(body).some((field) => field !== "notes") || typeof body.notes !== "string") {
          throw authorizationError("VALIDATION_FAILED", "Publication review notes are required.", correlationId);
        }
        send(response, 201, await approvePublicationFreeze(options.pool, principal,
          pathId(match[1], correlationId), pathId(match[2], correlationId), body.notes, correlationId));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/research-access-grants$/u))) {
        const body = await readBody(request, correlationId);
        if (Object.keys(body).some((field) => !["analystPersonId", "protocolReference", "expiresAt"].includes(field)) ||
            typeof body.analystPersonId !== "string" || typeof body.protocolReference !== "string" || typeof body.expiresAt !== "string") {
          throw authorizationError("VALIDATION_FAILED", "Research access grant fields are invalid.", correlationId);
        }
        send(response, 201, await grantResearchAccess(options.pool, principal, {
          projectId: pathId(match[1], correlationId), analystPersonId: body.analystPersonId,
          protocolReference: body.protocolReference, expiresAt: new Date(body.expiresAt)
        }, correlationId));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/sessions$/u))) {
        const body = await readBody(request, correlationId);
        if (Object.keys(body).some((field) => field !== "releaseId") || typeof body.releaseId !== "string") {
          throw authorizationError("VALIDATION_FAILED", "A published Release identifier is required.", correlationId);
        }
        send(response, 201, await createSession(options.pool, principal, pathId(match[1], correlationId),
          body.releaseId, correlationId, options.deploymentId));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/research-export$/u))) {
        const format = url.searchParams.get("format") ?? "zip";
        if (!new Set(["json", "csv", "html", "zip"]).has(format)) {
          throw authorizationError("VALIDATION_FAILED", "The research export format is invalid.", correlationId);
        }
        sendArtifact(response, await exportResearchEvidenceBundle(options.pool, principal,
          pathId(match[1], correlationId), format as "json" | "csv" | "html" | "zip", correlationId));
        return true;
      }
      if (request.method === "DELETE" && (match = url.pathname.match(/^\/v1\/research-access-grants\/([^/]+)$/u))) {
        await revokeResearchAccess(options.pool, principal, pathId(match[1], correlationId), correlationId);
        send(response, 200, { revoked: true });
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/research-evidence-index$/u))) {
        const afterSequence = url.searchParams.get("afterSequence");
        const limit = url.searchParams.get("limit");
        send(response, 200, await exportResearchEvidenceIndex(options.pool, principal, pathId(match[1], correlationId), correlationId,
          afterSequence === null ? 0 : Number(afterSequence), limit === null ? 1_000 : Number(limit)));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/research-consents$/u))) {
        const body = await readBody(request, correlationId);
        if (Object.keys(body).some((field) => !["purposeLabel", "consentVersion", "decision"].includes(field)) ||
            typeof body.purposeLabel !== "string" || typeof body.consentVersion !== "string" ||
            (body.decision !== "granted" && body.decision !== "withdrawn")) {
          throw authorizationError("VALIDATION_FAILED", "The research consent request is invalid.", correlationId);
        }
        send(response, 201, await recordResearchConsent(options.pool, principal, pathId(match[1], correlationId),
          body.purposeLabel, body.consentVersion, body.decision, correlationId));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/reports$/u))) {
        send(response, 200, await listSessionReportArtifacts(options.pool, principal,
          pathId(match[1], correlationId), correlationId));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/report-artifacts\/([^/]+)$/u))) {
        sendArtifact(response, await getReportArtifact(options.pool, principal, pathId(match[1], correlationId), correlationId));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/reports$/u))) {
        const body = await readBody(request, correlationId);
        const reportKinds = new Set(["session_archive", "after_action", "team", "control", "research_dataset"]);
        const formats = new Set(["json", "jsonl", "csv", "html", "pdf", "zip"]);
        if (Object.keys(body).some((field) => !["idempotencyKey", "reportKind", "format", "purposeLabel"].includes(field)) ||
            typeof body.idempotencyKey !== "string" || typeof body.reportKind !== "string" || !reportKinds.has(body.reportKind) ||
            typeof body.format !== "string" || !formats.has(body.format) ||
            (body.purposeLabel !== undefined && typeof body.purposeLabel !== "string")) {
          throw authorizationError("VALIDATION_FAILED", "The report request is invalid.", correlationId);
        }
        const purpose = body.purposeLabel === undefined ? {} : { purposeLabel: body.purposeLabel };
        const artifact = await generateSessionReport(options.pool, principal, pathId(match[1], correlationId), {
          idempotencyKey: body.idempotencyKey,
          reportKind: body.reportKind as "session_archive" | "after_action" | "team" | "control" | "research_dataset",
          format: body.format as ReportFormat,
          ...purpose
        }, correlationId);
        sendArtifact(response, artifact);
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/retention-status$/u))) {
        send(response, 200, await getSessionRetentionStatus(options.pool, principal,
          pathId(match[1], correlationId), correlationId));
        return true;
      }
      if (request.method === "POST" && url.pathname === "/v1/retention/legal-holds") {
        const body = await readBody(request, correlationId);
        if (Object.keys(body).some((field) => !["scopeType", "scopeReference", "reason"].includes(field)) ||
            !["organization", "export"].includes(String(body.scopeType)) ||
            typeof body.scopeReference !== "string" || typeof body.reason !== "string") {
          throw authorizationError("VALIDATION_FAILED", "The legal hold request is invalid.", correlationId);
        }
        send(response, 201, await placeLegalHold(options.pool, principal, {
          scopeType: body.scopeType as "organization" | "export",
          scopeReference: body.scopeReference,
          reason: body.reason
        }, correlationId));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/retention\/legal-holds\/([^/]+)\/release$/u))) {
        const body = await readBody(request, correlationId);
        if (Object.keys(body).some((field) => field !== "reason") || typeof body.reason !== "string") {
          throw authorizationError("VALIDATION_FAILED", "The legal hold release reason is required.", correlationId);
        }
        send(response, 201, await releaseLegalHold(options.pool, principal, pathId(match[1], correlationId), body.reason, correlationId));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/replay$/u))) {
        if (options.replayAdapter === undefined) {
          throw authorizationError("CAPABILITY_UNAVAILABLE", "A deterministic Session replay adapter is not configured.", correlationId);
        }
        send(response, 200, await replaySession(options.pool, principal, pathId(match[1], correlationId),
          options.replayAdapter, correlationId));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/runtime-projection$/u))) {
        send(response, 200, await getRuntimeProjection({
          pool: options.pool,
          principal,
          sessionId: pathId(match[1], correlationId),
          deviceId: deviceHeader(request, correlationId),
          ...(url.searchParams.get("activeSessionRoleId") === null ? {}
            : { activeSessionRoleId: url.searchParams.get("activeSessionRoleId")! }),
          correlationId
        }));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/sync\/(bootstrap|snapshot|deltas|stream)$/u))) {
        const sessionId = pathId(match[1], correlationId);
        const deviceId = deviceHeader(request, correlationId);
        const requestedRole = url.searchParams.get("activeSessionRoleId") ?? undefined;
        const base = {
          pool: options.pool,
          principal,
          sessionId,
          deviceId,
          ...(requestedRole === undefined ? {} : { activeSessionRoleId: requestedRole }),
          correlationId
        };
        if (match[2] === "bootstrap") {
          send(response, 200, await getRuntimeBootstrap(base));
          return true;
        }
        if (match[2] === "snapshot") {
          send(response, 200, await getRuntimeSnapshot(base));
          return true;
        }
        const cursor = url.searchParams.get("cursor") ?? request.headers["last-event-id"];
        if (typeof cursor !== "string") {
          throw authorizationError("SYNC_CURSOR_EXPIRED", "A Projection Cursor is required.", correlationId);
        }
        if (match[2] === "deltas") send(response, 200, await getRuntimeDeltas({ ...base, cursor }));
        else sendSse(response, (await getRuntimeSse({ ...base, cursor })).body);
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/release-impact$/u))) {
        const candidateReleaseId = url.searchParams.get("candidateReleaseId");
        if (candidateReleaseId === null) {
          throw authorizationError("VALIDATION_FAILED", "A candidate Release identifier is required.", correlationId);
        }
        send(response, 200, await getReleaseImpact(options.pool, principal, pathId(match[1], correlationId),
          pathId(candidateReleaseId, correlationId), correlationId));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/release-impact-reviews$/u))) {
        const body = await readBody(request, correlationId);
        if (Object.keys(body).some((field) => !["candidateReleaseId", "reportDigest", "existingInstanceHandling"].includes(field)) ||
            typeof body.candidateReleaseId !== "string" || typeof body.reportDigest !== "string" ||
            typeof body.existingInstanceHandling !== "string") {
          throw authorizationError("VALIDATION_FAILED", "The impact review request is invalid.", correlationId);
        }
        send(response, 201, await reviewReleaseImpact(options.pool, principal, pathId(match[1], correlationId), {
          candidateReleaseId: body.candidateReleaseId,
          reportDigest: body.reportDigest,
          existingInstanceHandling: body.existingInstanceHandling
        }, correlationId));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/release-activations$/u))) {
        const sessionId = pathId(match[1], correlationId);
        const command = await readBody(request, correlationId) as unknown as CommandEnvelopeV1;
        validateCommandEnvelope(command, correlationId);
        if (command.aggregateId !== sessionId) {
          throw authorizationError("VALIDATION_FAILED", "The Session path and Command target differ.", correlationId);
        }
        const context = await resolvePrincipalCommandContext(options.pool, principal, sessionId, command.deviceId, correlationId);
        const receipt = await activateRelease(options.pool, principal, context, command, correlationId, options.deploymentId);
        send(response, statusForReceipt(receipt), receipt);
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/release-history$/u))) {
        send(response, 200, await getReleaseHistory(options.pool, principal, pathId(match[1], correlationId), correlationId));
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/adjudications$/u))) {
        const sessionId = pathId(match[1], correlationId);
        const context = await withOrganizationTransaction(options.pool, principal.organizationId, (client) =>
          resolveSessionAccessContext(client, principal, { sessionId, deviceId: deviceHeader(request, correlationId), correlationId }));
        send(response, 200, { adjudications: await getAdjudications(options.pool, context) });
        return true;
      }
      if (request.method === "GET" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/readiness$/u))) {
        send(response, 200, await getReadiness(options.pool, principal, pathId(match[1], correlationId), correlationId,
          url.searchParams.get("query") ?? undefined));
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/invitations\/([^/]+)\/accept$/u))) {
        const invitationToken = decodeURIComponent(match[1] ?? "");
        const sessionId = await resolveInvitationSession(options.pool, principal, invitationToken, correlationId);
        const submitted = await readBody(request, correlationId) as unknown as CommandEnvelopeV1;
        const command = { ...submitted, payload: { ...submitted.payload, invitationToken } };
        validateCommandEnvelope(command, correlationId);
        const context = await resolvePrincipalCommandContext(options.pool, principal, sessionId, command.deviceId, correlationId);
        const receipt = await submitJoinRequest(options.pool, context, command, correlationId, options.deploymentId);
        send(response, statusForReceipt(receipt), receipt);
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/participant-entry\/invitations\/([^/]+)\/accept$/u))) {
        const invitationId = pathId(match[1], correlationId);
        const sessionId = await resolveVisibleInvitationSession(options.pool, principal, invitationId, correlationId);
        const submitted = await readBody(request, correlationId) as unknown as CommandEnvelopeV1;
        const command = { ...submitted, payload: { ...submitted.payload, invitationId } };
        validateCommandEnvelope(command, correlationId);
        const context = await resolvePrincipalCommandContext(options.pool, principal, sessionId, command.deviceId, correlationId);
        const receipt = await submitJoinRequest(options.pool, context, command, correlationId, options.deploymentId);
        send(response, statusForReceipt(receipt), receipt);
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/(access\/configure|invitations|join-requests|roster-imports|participants|ready|open)$/u))) {
        const sessionId = pathId(match[1], correlationId);
        const command = await readBody(request, correlationId) as unknown as CommandEnvelopeV1;
        validateCommandEnvelope(command, correlationId);
        const context = await resolvePrincipalCommandContext(options.pool, principal, sessionId, command.deviceId, correlationId);
        const operation = match[2];
        const result = operation === "access/configure" ? await configureSessionAccess(options.pool, context, command, correlationId, options.deploymentId) :
          operation === "invitations" ? await issueInvitation(options.pool, context, command, correlationId, options.deploymentId) :
          operation === "join-requests" ? await submitJoinRequest(options.pool, context, command, correlationId, options.deploymentId) :
          operation === "roster-imports" ? await importRoster(options.pool, context, command, correlationId, options.deploymentId) :
          operation === "participants" ? await assignParticipant(options.pool, context, command, correlationId, options.deploymentId) :
          operation === "ready" ? await markSessionReady(options.pool, context, command, correlationId, options.deploymentId) :
          await openSession(options.pool, context, command, correlationId, options.deploymentId);
        const receipt = "receipt" in result ? result.receipt : result;
        send(response, statusForReceipt(receipt), result);
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/(participants\/remove|archive|delete)$/u))) {
        const sessionId = pathId(match[1], correlationId);
        const command = await readBody(request, correlationId) as unknown as CommandEnvelopeV1;
        validateCommandEnvelope(command, correlationId);
        if (command.aggregateId !== sessionId) throw authorizationError("VALIDATION_FAILED", "The Session path and Command target differ.", correlationId);
        const context = await resolvePrincipalCommandContext(options.pool, principal, sessionId, command.deviceId, correlationId);
        const receipt = match[2] === "participants/remove"
          ? await removeParticipants(options.pool, context, command, correlationId, options.deploymentId)
          : match[2] === "archive"
            ? await archiveSession(options.pool, context, command, correlationId, options.deploymentId)
            : await deleteSession(options.pool, context, command, correlationId, options.deploymentId);
        send(response, statusForReceipt(receipt), receipt);
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/join-requests\/([^/]+)\/(admit|reject)$/u))) {
        const sessionId = pathId(match[1], correlationId), participantId = pathId(match[2], correlationId);
        const command = await readBody(request, correlationId) as unknown as CommandEnvelopeV1;
        validateCommandEnvelope(command, correlationId);
        if (command.aggregateId !== participantId) throw authorizationError("VALIDATION_FAILED", "The Participant path and Command target differ.", correlationId);
        const context = await resolvePrincipalCommandContext(options.pool, principal, sessionId, command.deviceId, correlationId);
        const receipt = await decideJoinRequest(options.pool, context, command, correlationId, options.deploymentId,
          match[3] === "admit" ? "admit" : "reject");
        send(response, statusForReceipt(receipt), receipt);
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/seats\/([^/]+)\/claim$/u))) {
        const sessionId = pathId(match[1], correlationId);
        const command = await readBody(request, correlationId) as unknown as CommandEnvelopeV1;
        validateCommandEnvelope(command, correlationId);
        if (command.payload.seatId !== decodeURIComponent(match[2] ?? "")) throw authorizationError("VALIDATION_FAILED", "The Seat path and payload differ.", correlationId);
        const context = await resolvePrincipalCommandContext(options.pool, principal, sessionId, command.deviceId, correlationId);
        const receipt = await claimSeat(options.pool, context, command, correlationId, options.deploymentId);
        send(response, statusForReceipt(receipt), receipt);
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/seat-assignments\/([^/]+)\/reassign$/u))) {
        const sessionId = pathId(match[1], correlationId), assignmentId = pathId(match[2], correlationId);
        const command = await readBody(request, correlationId) as unknown as CommandEnvelopeV1;
        validateCommandEnvelope(command, correlationId);
        if (command.payload.previousSeatAssignmentId !== assignmentId) throw authorizationError("VALIDATION_FAILED", "The Seat Assignment path and payload differ.", correlationId);
        const context = await resolvePrincipalCommandContext(options.pool, principal, sessionId, command.deviceId, correlationId);
        const receipt = await reassignSeat(options.pool, context, command, correlationId, options.deploymentId);
        send(response, statusForReceipt(receipt), receipt);
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/readiness\/([^/]+)\/confirm$/u))) {
        const sessionId = pathId(match[1], correlationId);
        const command = await readBody(request, correlationId) as unknown as CommandEnvelopeV1;
        validateCommandEnvelope(command, correlationId);
        if (command.payload.checkKey !== decodeURIComponent(match[2] ?? "")) throw authorizationError("VALIDATION_FAILED", "The readiness path and payload differ.", correlationId);
        const context = await resolvePrincipalCommandContext(options.pool, principal, sessionId, command.deviceId, correlationId);
        const receipt = await confirmReadiness(options.pool, context, command, correlationId, options.deploymentId);
        send(response, statusForReceipt(receipt), receipt);
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/(guests|display-principals\/activate)$/u))) {
        const sessionId = pathId(match[1], correlationId);
        const command = await readBody(request, correlationId) as unknown as CommandEnvelopeV1;
        validateCommandEnvelope(command, correlationId);
        const context = await resolvePrincipalCommandContext(options.pool, principal, sessionId, command.deviceId, correlationId);
        const result = match[2] === "guests"
          ? await createGuestIdentity(options.pool, context, command, correlationId, options.deploymentId)
          : await activateDisplayPrincipal(options.pool, context, command, correlationId, options.deploymentId);
        const receipt = "receipt" in result ? result.receipt : result;
        send(response, statusForReceipt(receipt), result);
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/principals\/([^/]+)\/revoke$/u))) {
        const sessionId = pathId(match[1], correlationId), principalId = pathId(match[2], correlationId);
        const command = await readBody(request, correlationId) as unknown as CommandEnvelopeV1;
        validateCommandEnvelope(command, correlationId);
        if (command.aggregateId !== principalId) throw authorizationError("VALIDATION_FAILED", "The Principal path and Command target differ.", correlationId);
        const context = await resolvePrincipalCommandContext(options.pool, principal, sessionId, command.deviceId, correlationId);
        const receipt = await revokeSessionPrincipal(options.pool, context, command, correlationId, options.deploymentId);
        send(response, statusForReceipt(receipt), receipt);
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
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/operator\/sessions\/([^/]+)\/(lifecycle|stage|inject)$/u))) {
        const sessionId = pathId(match[1], correlationId);
        const command = await readBody(request, correlationId) as unknown as CommandEnvelopeV1;
        validateCommandEnvelope(command, correlationId);
        const context = await resolvePrincipalCommandContext(options.pool, principal, sessionId, command.deviceId, correlationId);
        const receipt = match[2] === "lifecycle"
          ? await executeOperatorSessionCommand(options.pool, context, command, correlationId, options.deploymentId)
          : match[2] === "stage"
            ? await executeOperatorStageControl(options.pool, context, command, correlationId, options.deploymentId)
            : await executeOperatorInjectControl(options.pool, context, command, correlationId, options.deploymentId);
        send(response, statusForReceipt(receipt), receipt);
        return true;
      }
      if (request.method === "POST" && (match = url.pathname.match(/^\/v1\/operator\/sessions\/([^/]+)\/dead-letters\/([^/]+)\/retry$/u))) {
        const sessionId = pathId(match[1], correlationId), outboxId = pathId(match[2], correlationId);
        const command = await readBody(request, correlationId) as unknown as CommandEnvelopeV1;
        validateCommandEnvelope(command, correlationId);
        if (command.aggregateId !== outboxId) throw authorizationError("VALIDATION_FAILED", "The delivery path and Command target differ.", correlationId);
        const context = await resolvePrincipalCommandContext(options.pool, principal, sessionId, command.deviceId, correlationId);
        const receipt = await retryOperatorDelivery(options.pool, context, command, correlationId, options.deploymentId);
        send(response, statusForReceipt(receipt), receipt);
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
