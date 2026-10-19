export const POLICY_DECISION_VERSION = "policy-decision-v1";

export type OrganizationRole = "admin" | "designer" | "publisher" | "operator";
export type DataClassification = "public" | "internal" | "confidential" | "restricted";

export interface PolicyContext {
  organizationId: string;
  sessionId?: string;
  participantId?: string;
  activeSessionRoleId?: string;
  activeTeamId?: string;
  isControlRole?: boolean;
  organizationRoles: OrganizationRole[];
}

export interface FieldAudience {
  public?: boolean;
  organizationRoles?: OrganizationRole[];
  sessionRoleIds?: string[];
  participantIds?: string[];
  teamIds?: string[];
  ownerTeam?: boolean;
  payloadTeamField?: string;
  includeControlRoles?: boolean;
}

export interface ProtectedField {
  classification: DataClassification;
  audience: FieldAudience;
  value: unknown;
}

export interface ProtectedResource {
  organizationId: string;
  sessionId?: string;
  ownerTeamId?: string;
  payload?: Record<string, unknown>;
  resourceType: string;
  fields: Record<string, ProtectedField>;
}

export interface ProjectionBoundary {
  maximumClassification?: DataClassification;
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

export function audienceAllows(
  context: PolicyContext,
  audience: FieldAudience,
  ownerTeamId?: string,
  payload?: Record<string, unknown>
): boolean {
  if (audience.public) return true;
  if (audience.includeControlRoles === true && context.isControlRole === true) return true;

  const hasIdentitySelector = audience.organizationRoles !== undefined || audience.sessionRoleIds !== undefined || audience.participantIds !== undefined;
  const identityMatches = !hasIdentitySelector ||
    intersects(audience.organizationRoles, context.organizationRoles) ||
    (context.activeSessionRoleId !== undefined && audience.sessionRoleIds?.includes(context.activeSessionRoleId) === true) ||
    (context.participantId !== undefined && audience.participantIds?.includes(context.participantId) === true);
  const payloadTeams = audience.payloadTeamField === undefined ? undefined : payload?.[audience.payloadTeamField];
  const hasTeamSelector = audience.teamIds !== undefined || audience.ownerTeam === true || audience.payloadTeamField !== undefined;
  const teamMatches = !hasTeamSelector ||
    (context.activeTeamId !== undefined && audience.teamIds?.includes(context.activeTeamId) === true) ||
    (audience.ownerTeam === true && context.activeTeamId !== undefined && context.activeTeamId === ownerTeamId) ||
    (context.activeTeamId !== undefined && Array.isArray(payloadTeams) && payloadTeams.includes(context.activeTeamId));
  return identityMatches && teamMatches && (hasIdentitySelector || hasTeamSelector);
}

export function projectResource(
  context: PolicyContext,
  resource: ProtectedResource,
  boundary: ProjectionBoundary = {}
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

  const classificationRank: Record<DataClassification, number> = {
    public: 0,
    internal: 1,
    confidential: 2,
    restricted: 3
  };
  return Object.fromEntries(
    Object.entries(resource.fields)
      .filter(([, field]) =>
        (boundary.maximumClassification === undefined ||
          classificationRank[field.classification] <= classificationRank[boundary.maximumClassification]) &&
        audienceAllows(context, field.audience, resource.ownerTeamId, resource.payload))
      .map(([name, field]) => [name, field.value])
  );
}
