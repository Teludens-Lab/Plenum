/** Canonical API and event contracts owned by Contracts v1.3.1. */

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

type JsonSchemaProperty = Readonly<Record<string, unknown>>;

type ContractSchema<T extends object> = Readonly<{
  $schema: "https://json-schema.org/draft/2020-12/schema";
  $id: string;
  title: string;
  type: "object";
  additionalProperties: false;
  required: readonly (keyof T & string)[];
  properties: { readonly [K in keyof Required<T>]: JsonSchemaProperty };
}>;

export const COMMAND_ENVELOPE_CONTRACT_ID = "command-envelope-v1";
export const COMMAND_ENVELOPE_VERSION = 1;
export const EVENT_ENVELOPE_CONTRACT_ID = "event-envelope-v1";
export const EVENT_ENVELOPE_VERSION = 1;
export const ERROR_ENVELOPE_CONTRACT_ID = "error-envelope-v1";
export const ERROR_ENVELOPE_VERSION = 1;
export const COMMAND_RECEIPT_CONTRACT_ID = "command-receipt-v1";
export const DOMAIN_EVENT_CONTRACT_ID = "domain-event-v1";
export const RUNTIME_SSE_CONTRACT_ID = "runtime-sse-v1";
export const SYNC_DELTAS_CONTRACT_ID = "sync-deltas-v1";
export const SYNC_SNAPSHOT_CONTRACT_ID = "sync-snapshot-v1";
export const ARTIFACT_COMMAND_CONTRACT_ID = "artifact-command-v1";
export const RUNTIME_PROJECTION_CONTRACT_ID = "runtime-projection-v1";
export const OPERATOR_PROJECTION_CONTRACT_ID = "operator-projection-v1";

export interface CommandEnvelopeV1 {
  commandId: string;
  deviceId: string;
  operationType: string;
  aggregateId: string;
  expectedAggregateVersion: number;
  governingReleaseId: string;
  activeSessionRoleId?: string;
  deviceObservedAt?: string;
  payload: JsonObject;
}

export interface EventEnvelopeV1 {
  eventId: string;
  eventType: string;
  eventVersion: 1;
  producer: string;
  correlationId: string;
  causationId: string;
  sessionId: string;
  governingReleaseId: string;
  aggregateId: string;
  aggregateVersion: number;
  evidenceSequence: number;
  occurredAt: string;
  payload: JsonObject;
}

export type CommandOutcomeStatus = "received" | "accepted" | "rejected" | "needs_reconciliation";

export interface CommandReceiptV1 {
  commandId: string;
  status: CommandOutcomeStatus;
  aggregateVersion: number | null;
  evidenceSequence: number | null;
  errorCode: CanonicalErrorCode | null;
  message: string | null;
  replayed: boolean;
}

export type DomainEventV1 = EventEnvelopeV1;

export interface RuntimeDeltaV1 {
  deltaId: string;
  cursor: string;
  eventType: string;
  aggregateId: string;
  aggregateVersion: number | null;
  occurredAt: string;
  payload: JsonObject;
}

export interface SyncDeltasV1 {
  projectionVersion: string;
  policyVersion: string;
  deltas: RuntimeDeltaV1[];
  nextCursor: string;
}

export interface SyncSnapshotV1 {
  projectionVersion: string;
  policyVersion: string;
  cursor: string;
  state: JsonObject;
  aggregateVersions: Record<string, number>;
}

export type RuntimeSseEventV1 =
  | { kind: "delta"; cursor: string; delta: RuntimeDeltaV1 }
  | { kind: "cursor"; cursor: string; delta: null };

export interface RuntimeSseV1 {
  projectionVersion: string;
  policyVersion: string;
  events: RuntimeSseEventV1[];
}

export interface RuntimeFormFieldV1 {
  key: string;
  label: string;
  type: "text" | "long_text";
  required: boolean;
  helpText?: string;
}

export interface RuntimeFormV1 {
  id: string;
  name: string;
  formVersion: string;
  fields: RuntimeFormFieldV1[];
}

export interface RuntimeActionV1 {
  operationType: string;
  label: string;
  requiresForm: boolean;
}

export interface RuntimeArtifactV1 {
  id: string;
  artifactTypeKey: string;
  title: string;
  state: string;
  stateLabel: string;
  payload: JsonObject;
  version: number;
  governingReleaseId: string;
  form: RuntimeFormV1;
  createdByMe: boolean;
  actions: RuntimeActionV1[];
}

export interface RuntimeCreateTaskV1 {
  artifactTypeKey: string;
  title: string;
  action: RuntimeActionV1;
  form: RuntimeFormV1;
}

export interface RuntimeModuleV1 {
  id: string;
  type: "session_status" | "artifact_form" | "task_list";
  title: string;
  mode: "read" | "write";
  emptyStateText: string;
}

export interface RuntimeProjectionV1 {
  contractId: typeof RUNTIME_PROJECTION_CONTRACT_ID;
  sessionId: string;
  sessionStatus: string;
  releaseId: string;
  releaseLabel: string;
  participantId: string;
  activeSessionRoleId: string;
  activeSessionRoleLabel: string;
  currentStageId: string | null;
  currentStageLabel: string | null;
  interfaceProfileId: string;
  layout: "single_column" | "main_with_sidebar" | "dashboard_grid" | "workspace_tabs";
  modules: RuntimeModuleV1[];
  createTasks: RuntimeCreateTaskV1[];
  artifacts: RuntimeArtifactV1[];
}

export interface OperatorProjectionV1 {
  contractId: typeof OPERATOR_PROJECTION_CONTRACT_ID;
  sessionId: string;
  sessionStatus: string;
  releaseId: string;
  releaseLabel: string;
  participantCount: number;
  occupiedSeatCount: number;
  artifactsByState: Record<string, number>;
  activeTasks: Array<{ artifactId: string; artifactTypeKey: string; state: string; version: number }>;
  recentEvents: Array<{ type: string; recordedAt: string; aggregateId: string | null }>;
}

export type ArtifactCommandV1 = CommandEnvelopeV1;

export const canonicalErrorCodes = [
  "UNAUTHENTICATED",
  "AUTH_EXPIRED",
  "INVALID_ID",
  "INVALID_JSON",
  "INVALID_COMMAND",
  "VALIDATION_FAILED",
  "PERMISSION_DENIED",
  "RESULT_NOT_RELEASED",
  "CONSENT_REQUIRED",
  "PLUGIN_NOT_APPROVED",
  "ACCESS_REVOKED",
  "NOT_A_PARTICIPANT",
  "DEVICE_NOT_REGISTERED",
  "NOT_FOUND",
  "TARGET_NOT_FOUND",
  "TARGET_EXISTS",
  "INVALID_TRANSITION",
  "ALREADY_VOTED",
  "DEADLINE_EXPIRED",
  "FLOOR_BUSY",
  "FLOOR_TOKEN_EXPIRED",
  "STALE_PROPOSAL",
  "CAPABILITY_UNAVAILABLE",
  "SESSION_NOT_ACTIVE",
  "STALE_AGGREGATE_VERSION",
  "INCOMPATIBLE_RELEASE",
  "VERSION_CONFLICT",
  "ALREADY_PUBLISHED",
  "IDEMPOTENCY_COLLISION",
  "CONFLICT",
  "REFERENCE_INVALID",
  "SYNC_CURSOR_EXPIRED",
  "TOO_LARGE",
  "RATE_LIMITED",
  "AUTHORITY_UNAVAILABLE",
  "TRANSIENT_DEPENDENCY",
  "PLUGIN_UNAVAILABLE",
  "MEDIA_UNAVAILABLE",
  "INTERNAL",
  "NETWORK_UNAVAILABLE"
] as const;

export type CanonicalErrorCode = (typeof canonicalErrorCodes)[number];

export interface ErrorDetailV1 {
  code: CanonicalErrorCode;
  message: string;
  details: JsonValue;
  correlationId: string;
}

export interface ErrorEnvelopeV1 {
  error: ErrorDetailV1;
}

const uuidProperty = { type: "string", format: "uuid" } as const;
const utcInstantProperty = { type: "string", format: "date-time" } as const;
const jsonObjectProperty = { type: "object" } as const;

export const commandEnvelopeV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: COMMAND_ENVELOPE_CONTRACT_ID,
  title: "Command Envelope v1",
  type: "object",
  additionalProperties: false,
  required: [
    "commandId",
    "deviceId",
    "operationType",
    "aggregateId",
    "expectedAggregateVersion",
    "governingReleaseId",
    "payload"
  ],
  properties: {
    commandId: uuidProperty,
    deviceId: uuidProperty,
    operationType: { type: "string", pattern: "^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$" },
    aggregateId: uuidProperty,
    expectedAggregateVersion: { type: "integer", minimum: 0 },
    governingReleaseId: uuidProperty,
    activeSessionRoleId: { type: "string", minLength: 1 },
    deviceObservedAt: utcInstantProperty,
    payload: jsonObjectProperty
  }
} as const satisfies ContractSchema<CommandEnvelopeV1>;

export const artifactCommandV1Schema = {
  ...commandEnvelopeV1Schema,
  $id: ARTIFACT_COMMAND_CONTRACT_ID,
  title: "Artifact Command v1",
  properties: {
    ...commandEnvelopeV1Schema.properties,
    operationType: { type: "string", pattern: "^artifact\\.[a-z][a-z0-9_]*$" }
  }
} as const satisfies ContractSchema<ArtifactCommandV1>;

export const eventEnvelopeV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: EVENT_ENVELOPE_CONTRACT_ID,
  title: "Event Envelope v1",
  type: "object",
  additionalProperties: false,
  required: [
    "eventId",
    "eventType",
    "eventVersion",
    "producer",
    "correlationId",
    "causationId",
    "sessionId",
    "governingReleaseId",
    "aggregateId",
    "aggregateVersion",
    "evidenceSequence",
    "occurredAt",
    "payload"
  ],
  properties: {
    eventId: uuidProperty,
    eventType: { type: "string", pattern: "^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$" },
    eventVersion: { const: EVENT_ENVELOPE_VERSION },
    producer: { type: "string", minLength: 1 },
    correlationId: uuidProperty,
    causationId: uuidProperty,
    sessionId: uuidProperty,
    governingReleaseId: uuidProperty,
    aggregateId: uuidProperty,
    aggregateVersion: { type: "integer", minimum: 1 },
    evidenceSequence: { type: "integer", minimum: 1 },
    occurredAt: utcInstantProperty,
    payload: jsonObjectProperty
  }
} as const satisfies ContractSchema<EventEnvelopeV1>;

export const errorEnvelopeV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: ERROR_ENVELOPE_CONTRACT_ID,
  title: "Error Envelope v1",
  type: "object",
  additionalProperties: false,
  required: ["error"],
  properties: {
    error: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message", "details", "correlationId"],
      properties: {
        code: { type: "string", enum: canonicalErrorCodes },
        message: { type: "string", minLength: 1 },
        details: {},
        correlationId: uuidProperty
      }
    }
  }
} as const satisfies ContractSchema<ErrorEnvelopeV1>;

export const commandReceiptV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: COMMAND_RECEIPT_CONTRACT_ID,
  title: "Command Receipt v1",
  type: "object",
  additionalProperties: false,
  required: ["commandId", "status", "aggregateVersion", "evidenceSequence", "errorCode", "message", "replayed"],
  properties: {
    commandId: uuidProperty,
    status: { type: "string", enum: ["received", "accepted", "rejected", "needs_reconciliation"] },
    aggregateVersion: { type: ["integer", "null"], minimum: 0 },
    evidenceSequence: { type: ["integer", "null"], minimum: 1 },
    errorCode: { type: ["string", "null"], enum: [...canonicalErrorCodes, null] },
    message: { type: ["string", "null"] },
    replayed: { type: "boolean" }
  }
} as const satisfies ContractSchema<CommandReceiptV1>;

export const domainEventV1Schema = {
  ...eventEnvelopeV1Schema,
  $id: DOMAIN_EVENT_CONTRACT_ID,
  title: "Domain Event v1"
} as const satisfies ContractSchema<DomainEventV1>;

const runtimeDeltaProperties = {
  deltaId: uuidProperty,
  cursor: uuidProperty,
  eventType: { type: "string", pattern: "^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$" },
  aggregateId: uuidProperty,
  aggregateVersion: { type: ["integer", "null"], minimum: 0 },
  occurredAt: utcInstantProperty,
  payload: jsonObjectProperty
} as const;

export const syncDeltasV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: SYNC_DELTAS_CONTRACT_ID,
  title: "Runtime sync deltas v1",
  type: "object",
  additionalProperties: false,
  required: ["projectionVersion", "policyVersion", "deltas", "nextCursor"],
  properties: {
    projectionVersion: { type: "string", minLength: 1 },
    policyVersion: { type: "string", minLength: 1 },
    deltas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["deltaId", "cursor", "eventType", "aggregateId", "aggregateVersion", "occurredAt", "payload"],
        properties: runtimeDeltaProperties
      }
    },
    nextCursor: uuidProperty
  }
} as const satisfies ContractSchema<SyncDeltasV1>;

export const syncSnapshotV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: SYNC_SNAPSHOT_CONTRACT_ID,
  title: "Runtime sync snapshot v1",
  type: "object",
  additionalProperties: false,
  required: ["projectionVersion", "policyVersion", "cursor", "state", "aggregateVersions"],
  properties: {
    projectionVersion: { type: "string", minLength: 1 },
    policyVersion: { type: "string", minLength: 1 },
    cursor: uuidProperty,
    state: jsonObjectProperty,
    aggregateVersions: { type: "object", additionalProperties: { type: "integer", minimum: 0 } }
  }
} as const satisfies ContractSchema<SyncSnapshotV1>;

export const runtimeSseV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: RUNTIME_SSE_CONTRACT_ID,
  title: "Runtime SSE batch v1",
  type: "object",
  additionalProperties: false,
  required: ["projectionVersion", "policyVersion", "events"],
  properties: {
    projectionVersion: { type: "string", minLength: 1 },
    policyVersion: { type: "string", minLength: 1 },
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "cursor", "delta"],
        properties: {
          kind: { type: "string", enum: ["delta", "cursor"] },
          cursor: uuidProperty,
          delta: { anyOf: [{ type: "null" }, {
            type: "object",
            additionalProperties: false,
            required: ["deltaId", "cursor", "eventType", "aggregateId", "aggregateVersion", "occurredAt", "payload"],
            properties: runtimeDeltaProperties
          }] }
        }
      }
    }
  }
} as const satisfies ContractSchema<RuntimeSseV1>;

export const runtimeProjectionV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: RUNTIME_PROJECTION_CONTRACT_ID,
  title: "Authorized Runtime Projection v1",
  type: "object",
  additionalProperties: false,
  required: [
    "contractId", "sessionId", "sessionStatus", "releaseId", "releaseLabel", "participantId",
    "activeSessionRoleId", "activeSessionRoleLabel", "currentStageId", "currentStageLabel",
    "interfaceProfileId", "layout", "modules", "createTasks", "artifacts"
  ],
  properties: {
    contractId: { const: RUNTIME_PROJECTION_CONTRACT_ID },
    sessionId: uuidProperty,
    sessionStatus: { type: "string", minLength: 1 },
    releaseId: uuidProperty,
    releaseLabel: { type: "string", minLength: 1 },
    participantId: uuidProperty,
    activeSessionRoleId: { type: "string", minLength: 1 },
    activeSessionRoleLabel: { type: "string", minLength: 1 },
    currentStageId: { type: ["string", "null"] },
    currentStageLabel: { type: ["string", "null"] },
    interfaceProfileId: { type: "string", minLength: 1 },
    layout: { type: "string", enum: ["single_column", "main_with_sidebar", "dashboard_grid", "workspace_tabs"] },
    modules: { type: "array", items: { type: "object" } },
    createTasks: { type: "array", items: { type: "object" } },
    artifacts: { type: "array", items: { type: "object" } }
  }
} as const satisfies ContractSchema<RuntimeProjectionV1>;

export function canonicalizeJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalizeJson(value[key] as JsonValue)}`).join(",")}}`;
}

const dotCaseName = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
const irregularPastParticiples = new Set(["cast", "held", "left", "sent", "set"]);

export function isCommandOperationType(value: string): boolean {
  if (!dotCaseName.test(value)) return false;
  const action = value.slice(value.indexOf(".") + 1);
  return !action.endsWith("ed") && !irregularPastParticiples.has(action);
}

export function isPastTenseEventType(value: string): boolean {
  if (!dotCaseName.test(value)) return false;
  const action = value.slice(value.indexOf(".") + 1);
  return action.endsWith("ed") || irregularPastParticiples.has(action);
}

export function createErrorEnvelope(
  code: CanonicalErrorCode,
  message: string,
  correlationId: string,
  details: JsonValue = null
): ErrorEnvelopeV1 {
  return { error: { code, message, details, correlationId } };
}
