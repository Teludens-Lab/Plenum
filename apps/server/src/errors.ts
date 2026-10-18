import { createErrorEnvelope, type CanonicalErrorCode, type ErrorEnvelopeV1, type JsonValue } from "@plenum/event-contracts";

export class AuthorizationError extends Error {
  readonly envelope: ErrorEnvelopeV1;

  constructor(envelope: ErrorEnvelopeV1) {
    super(envelope.error.message);
    this.name = "AuthorizationError";
    this.envelope = envelope;
  }
}

export function authorizationError(
  code: CanonicalErrorCode,
  message: string,
  correlationId: string,
  details: JsonValue = null
): AuthorizationError {
  return new AuthorizationError(createErrorEnvelope(code, message, correlationId, details));
}
