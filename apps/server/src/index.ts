import {
  createErrorEnvelope,
  type CommandEnvelopeV1,
  type ErrorEnvelopeV1
} from "@plenum/event-contracts";

/** Identity and authority values created by authenticated server middleware. */
export interface TrustedSessionContext {
  principalId: string;
  organizationId: string;
  sessionId: string;
  participantId: string;
  seatAssignmentIds: string[];
  activeSessionRoleId: string;
  authorityEpoch: number;
}

export class AuthorizationError extends Error {
  readonly envelope: ErrorEnvelopeV1;

  constructor(envelope: ErrorEnvelopeV1) {
    super(envelope.error.message);
    this.name = "AuthorizationError";
    this.envelope = envelope;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasNonEmptyString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "string" && record[key].length > 0;
}

export function requireTrustedSessionContext(
  value: unknown,
  correlationId: string
): TrustedSessionContext {
  if (!isRecord(value) || !hasNonEmptyString(value, "principalId")) {
    throw new AuthorizationError(
      createErrorEnvelope("UNAUTHENTICATED", "Sign in is required.", correlationId)
    );
  }

  if (
    !hasNonEmptyString(value, "organizationId") ||
    !hasNonEmptyString(value, "sessionId") ||
    !hasNonEmptyString(value, "participantId") ||
    !Array.isArray(value.seatAssignmentIds) ||
    !value.seatAssignmentIds.every((id) => typeof id === "string" && id.length > 0) ||
    !hasNonEmptyString(value, "activeSessionRoleId") ||
    !Number.isSafeInteger(value.authorityEpoch) ||
    Number(value.authorityEpoch) < 0
  ) {
    throw new AuthorizationError(
      createErrorEnvelope(
        "NOT_A_PARTICIPANT",
        "A current Session Participant context is required.",
        correlationId
      )
    );
  }

  return value as unknown as TrustedSessionContext;
}

export function authorizeCommandRole(
  context: TrustedSessionContext,
  command: CommandEnvelopeV1,
  correlationId: string
): void {
  if (
    command.activeSessionRoleId !== undefined &&
    command.activeSessionRoleId !== context.activeSessionRoleId
  ) {
    throw new AuthorizationError(
      createErrorEnvelope(
        "PERMISSION_DENIED",
        "The requested Active Role Context is not authorized.",
        correlationId
      )
    );
  }
}
