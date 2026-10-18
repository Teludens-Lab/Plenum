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
