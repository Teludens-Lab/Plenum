import {
  type CommandEnvelopeV1
} from "@plenum/event-contracts";
import { authorizationError } from "./errors.js";

export { createDatabasePool, withOrganizationTransaction } from "./database.js";
export { AuthorizationError, authorizationError } from "./errors.js";
export * from "./identity/oidc.js";
export * from "./identity/login.js";
export * from "./identity/context.js";
export * from "./access/reassignment.js";
export * from "./runtime/commands/processor.js";
export * from "./runtime/artifact-workflow.js";
export * from "./runtime/information-flow.js";
export * from "./runtime/operator-projection.js";
export * from "./sync/runtime-sync.js";
export * from "./registry/object-store.js";
export * from "./registry/publication.js";
export * from "./http/runtime-http.js";

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
    throw authorizationError("UNAUTHENTICATED", "Sign in is required.", correlationId);
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
    throw authorizationError(
      "NOT_A_PARTICIPANT",
      "A current Session Participant context is required.",
      correlationId
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
    throw authorizationError(
      "PERMISSION_DENIED",
      "The requested Active Role Context is not authorized.",
      correlationId
    );
  }
}
