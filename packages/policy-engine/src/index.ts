export const POLICY_DECISION_VERSION = "policy-decision-v1";

export type OrganizationRole = "admin" | "designer" | "publisher" | "operator";
export type DataClassification = "public" | "internal" | "confidential" | "restricted";

export interface PolicyContext {
  organizationId: string;
  sessionId?: string;
  participantId?: string;
  activeSessionRoleId?: string;
  organizationRoles: OrganizationRole[];
}

export interface FieldAudience {
  public?: boolean;
  organizationRoles?: OrganizationRole[];
  sessionRoleIds?: string[];
  participantIds?: string[];
}

export interface ProtectedField {
  classification: DataClassification;
  audience: FieldAudience;
  value: unknown;
}

export interface ProtectedResource {
  organizationId: string;
  sessionId?: string;
  resourceType: string;
  fields: Record<string, ProtectedField>;
}

export class PolicyDeniedError extends Error {
  readonly code: "TARGET_NOT_FOUND" | "PERMISSION_DENIED";

  constructor(code: "TARGET_NOT_FOUND" | "PERMISSION_DENIED", message: string) {
    super(message);
    this.name = "PolicyDeniedError";
    this.code = code;
  }
}

function intersects(left: readonly string[] | undefined, right: readonly string[]): boolean {
  return left?.some((value) => right.includes(value)) ?? false;
}

function canSeeField(context: PolicyContext, field: ProtectedField): boolean {
  const { audience } = field;
  if (audience.public) return true;
  if (intersects(audience.organizationRoles, context.organizationRoles)) return true;
  if (
    context.activeSessionRoleId !== undefined &&
    audience.sessionRoleIds?.includes(context.activeSessionRoleId)
  ) return true;
  return context.participantId !== undefined && audience.participantIds?.includes(context.participantId) === true;
}

export function projectResource(
  context: PolicyContext,
  resource: ProtectedResource
): Readonly<Record<string, unknown>> {
  if (
    resource.organizationId !== context.organizationId ||
    (resource.sessionId !== undefined && resource.sessionId !== context.sessionId)
  ) {
    throw new PolicyDeniedError("TARGET_NOT_FOUND", "The resource was not found.");
  }

  if (resource.resourceType === "audit_record" && !context.organizationRoles.includes("admin")) {
    throw new PolicyDeniedError("PERMISSION_DENIED", "Audit Records require administrative access.");
  }

  return Object.fromEntries(
    Object.entries(resource.fields)
      .filter(([, field]) => canSeeField(context, field))
      .map(([name, field]) => [name, field.value])
  );
}
