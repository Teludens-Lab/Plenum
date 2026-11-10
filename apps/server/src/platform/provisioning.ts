import { createHash, randomBytes, randomUUID } from "node:crypto";
import { resolveTxt } from "node:dns/promises";

import {
  PLATFORM_CONTROL_PLANE_CONTRACT_ID,
  type JsonObject,
  type OrganizationDeploymentProfileV1,
  type OrganizationLifecycleStatusV1,
  type OrganizationProvisioningGateV1,
  type PlatformOrganizationDetailV1,
  type PlatformOrganizationsV1
} from "@plenum/event-contracts";
import type { Pool, PoolClient } from "pg";

import { withPlatformTransaction, withRestrictedTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import { listOrganizationIdentityProviders } from "../identity/organization-providers.js";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const domainPattern = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;
const emailPattern = /^[^\s@]+@([^\s@]+)$/u;
const entitlementPattern = /^[a-z][a-z0-9_.-]{1,79}$/u;

export interface CreatePlatformOrganizationInput {
  name: string;
  slug: string;
  legalName: string;
  countryCode: string;
  timeZone: string;
  deploymentProfile: OrganizationDeploymentProfileV1;
  dataResidencyRegion: string;
  entitlements: string[];
  supportContact: string;
  securityContact?: string;
}

/** The workspace address (slug) stays fixed after creation because Organization sign-in routing uses it. */
export type UpdatePlatformOrganizationInput = Omit<CreatePlatformOrganizationInput, "name" | "slug"> & { name?: string };

export interface DomainVerificationResolver {
  resolveTxt(name: string): Promise<string[]>;
}

export interface FirstAdminInvitationDelivery {
  deliver(input: {
    messageType: "PLATFORM_FIRST_ADMIN_INVITATION" | "PLATFORM_ADMINISTRATOR_INVITATION" |
      "ORGANIZATION_WORKFORCE_INVITATION";
    deliveryId: string;
    recipientEmail: string;
    organizationName: string;
    invitationUrl: string;
    expiresAt: string;
    templateRef: string;
  }): Promise<{ providerReference: string; previewUrl?: string }>;
}

export const systemDomainVerificationResolver: DomainVerificationResolver = {
  async resolveTxt(name) {
    const records = await Promise.race([
      resolveTxt(name),
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("DNS lookup timed out")), 5_000))
    ]);
    return records.map((chunks) => chunks.join(""));
  }
};

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  lifecycle_status: OrganizationLifecycleStatusV1;
  lifecycle_version: string;
  deployment_profile: OrganizationDeploymentProfileV1;
  configuration_status: "complete" | "needs_reconciliation";
  data_residency_region: string | null;
  entitlements: string[];
  verified_domain_count: string;
  first_admin_status: "not_invited" | "pending" | "accepted" | "expired";
  created_at: Date;
};

function clean(value: string): string {
  return value.trim();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function gates(row: Pick<OrganizationRow, "deployment_profile" | "entitlements" | "verified_domain_count" | "first_admin_status">): OrganizationProvisioningGateV1[] {
  return [
    { key: "deployment_profile", label: "Deployment profile", complete: row.deployment_profile !== "unconfigured",
      prerequisite: "Choose where this Organization will operate." },
    { key: "entitlements", label: "Entitlements", complete: row.entitlements.length > 0,
      prerequisite: "Enable at least one contracted Plenum capability." },
    { key: "verified_domain", label: "Verified domain", complete: Number(row.verified_domain_count) > 0,
      prerequisite: "Verify an Organization-owned domain." },
    { key: "first_admin", label: "First Admin", complete: row.first_admin_status === "accepted",
      prerequisite: "The first Organization Admin must accept their invitation." }
  ];
}

function summary(row: OrganizationRow): PlatformOrganizationsV1["organizations"][number] {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    lifecycleStatus: row.lifecycle_status,
    lifecycleVersion: Number(row.lifecycle_version),
    configurationStatus: row.configuration_status,
    deploymentProfile: row.deployment_profile,
    dataResidencyRegion: row.data_residency_region,
    entitlements: row.entitlements,
    verifiedDomainCount: Number(row.verified_domain_count),
    firstAdminStatus: row.first_admin_status,
    gates: gates(row),
    createdAt: row.created_at.toISOString()
  };
}

export async function requirePlatformAdministrator(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  correlationId: string
): Promise<void> {
  const current = await client.query(
    `SELECT 1
       FROM identity.authentication_sessions authentication_session
      WHERE authentication_session.organization_id = $1
        AND authentication_session.id = $2
        AND authentication_session.person_id = $3
        AND authentication_session.revoked_at IS NULL
        AND authentication_session.expires_at > transaction_timestamp()
        AND identity.current_platform_administrator()
      LIMIT 1`,
    [principal.organizationId, principal.authenticationSessionId, principal.principalId]
  );
  if (current.rowCount !== 1) {
    throw authorizationError("PERMISSION_DENIED", "Active Plenum Platform Administrator authority is required.", correlationId);
  }
}

export async function audit(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  action: string,
  organizationId: string,
  targetRef: string,
  correlationId: string,
  beforeState: JsonObject | null,
  afterState: JsonObject | null,
  details: JsonObject = {}
): Promise<void> {
  await client.query(
    `INSERT INTO evidence.platform_audit_records
       (id,actor_person_id,action,resource_organization_id,target_ref,before_state,after_state,details)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb)`,
    [randomUUID(), principal.principalId, action, organizationId, targetRef,
      beforeState === null ? null : JSON.stringify(beforeState), afterState === null ? null : JSON.stringify(afterState),
      JSON.stringify({ ...details, correlationId })]
  );
}

const organizationProjectionSql = `
  SELECT organization.id,organization.name,provisioning.slug,organization.lifecycle_status,
         organization.lifecycle_version::text,provisioning.deployment_profile,
         provisioning.configuration_status,provisioning.data_residency_region,provisioning.entitlements,organization.created_at,
         (SELECT count(*)::text FROM identity.organization_domains domain
           WHERE domain.organization_id=organization.id AND domain.verification_method='dns_txt'
             AND domain.challenge_value IS NOT NULL AND domain.verified_at IS NOT NULL) AS verified_domain_count,
         COALESCE((SELECT CASE WHEN invitation.accepted_at IS NOT NULL THEN 'accepted'
                              WHEN invitation.revoked_at IS NOT NULL THEN 'not_invited'
                              WHEN invitation.expires_at <= transaction_timestamp() THEN 'expired'
                              ELSE 'pending' END
                     FROM identity.first_admin_invitations invitation
                    WHERE invitation.organization_id=organization.id
                    ORDER BY invitation.created_at DESC LIMIT 1),
                  CASE WHEN EXISTS (
                    SELECT 1 FROM identity.memberships membership
                     WHERE membership.organization_id=organization.id
                       AND membership.organization_role='admin'
                  ) THEN 'accepted' ELSE 'not_invited' END) AS first_admin_status
    FROM identity.organizations organization
    JOIN identity.organization_provisioning provisioning ON provisioning.organization_id=organization.id`;

async function reconcileLegacyOrganizations(client: PoolClient, principal: AuthenticatedPrincipal, correlationId: string): Promise<void> {
  const missing = await client.query<{ id: string; name: string }>(
    `SELECT organization.id,organization.name
       FROM identity.organizations organization
      WHERE NOT EXISTS (
        SELECT 1 FROM identity.organization_provisioning provisioning
         WHERE provisioning.organization_id=organization.id
      )
      ORDER BY organization.id
      FOR UPDATE OF organization`
  );
  for (const organization of missing.rows) {
    const slug = `legacy-${organization.id.replaceAll("-", "")}`;
    await client.query(
      `INSERT INTO identity.organization_provisioning(
         organization_id,slug,legal_name,deployment_profile,entitlements,configuration_status
       ) VALUES ($1,$2,$3,'unconfigured',ARRAY[]::text[],'needs_reconciliation')`,
      [organization.id, slug, organization.name]
    );
    await audit(client, principal, "platform.organization_backfilled", organization.id,
      `organization:${organization.id}`, correlationId, null,
      { configurationStatus: "needs_reconciliation" }, { source: "legacy_organization" });
  }
}

async function listRows(client: PoolClient, organizationId?: string): Promise<OrganizationRow[]> {
  const result = await client.query<OrganizationRow>(
    `${organizationProjectionSql}${organizationId === undefined ? "" : " WHERE organization.id=$1"}
      ORDER BY lower(organization.name),organization.id`, organizationId === undefined ? [] : [organizationId]
  );
  return result.rows;
}

async function loadDetail(client: PoolClient, organizationId: string): Promise<PlatformOrganizationDetailV1 | null> {
  const rows = await listRows(client, organizationId);
  const row = rows[0];
  if (row === undefined) return null;
  const configuration = await client.query<{ legal_name: string; country_code: string | null; time_zone: string | null; support_contact: string | null;
      security_contact: string | null; activated_at: Date | null; suspended_at: Date | null; offboarded_at: Date | null }>(
      `SELECT provisioning.legal_name,provisioning.country_code,provisioning.time_zone,
              provisioning.support_contact,provisioning.security_contact,organization.activated_at,
              organization.suspended_at,organization.offboarded_at
         FROM identity.organization_provisioning provisioning
         JOIN identity.organizations organization ON organization.id=provisioning.organization_id
        WHERE provisioning.organization_id=$1`, [organizationId]);
  const domains = await client.query<{ id: string; domain: string; verification_method: "dns_txt" | "manual_contract"; verified_at: Date | null;
      challenge_name: string | null; challenge_value: string | null; challenge_expires_at: Date | null;
      last_checked_at: Date | null; verification_failure: string | null }>(
      `SELECT id,domain,verification_method,verified_at,challenge_name,challenge_value,challenge_expires_at,
              last_checked_at,verification_failure FROM identity.organization_domains
        WHERE organization_id=$1 ORDER BY verified_at NULLS FIRST,domain`, [organizationId]);
  const invitation = await client.query<{ id: string; email: string; expires_at: Date; accepted_at: Date | null; revoked_at: Date | null;
      identity_linked_at: Date | null; delivery_status: "queued" | "sent" | "failed" | "cancelled" | null;
      attempt_count: number | null; sent_at: Date | null; failed_at: Date | null; failure_reason: string | null }>(
      `SELECT invitation.id,invitation.email,invitation.expires_at,invitation.accepted_at,invitation.revoked_at,
              invitation.identity_linked_at,delivery.status AS delivery_status,delivery.attempt_count,
              delivery.sent_at,delivery.failed_at,delivery.failure_reason
         FROM identity.first_admin_invitations invitation
         LEFT JOIN identity.first_admin_invitation_deliveries delivery ON delivery.invitation_id=invitation.id
        WHERE invitation.organization_id=$1 ORDER BY invitation.created_at DESC LIMIT 1`, [organizationId]);
  const auditRecords = await client.query<{ id: string; action: string; display_name: string; recorded_at: Date; details: JsonObject }>(
      `SELECT audit.id,audit.action,person.display_name,audit.recorded_at,audit.details
         FROM evidence.platform_audit_records audit
         JOIN identity.persons person ON person.id=audit.actor_person_id
        WHERE audit.resource_organization_id=$1 ORDER BY audit.recorded_at DESC,audit.id DESC LIMIT 25`, [organizationId]);
  const config = configuration.rows[0];
  if (config === undefined) return null;
  const latestInvitation = invitation.rows[0];
  const firstAdminInvitation = latestInvitation === undefined ? null : {
    id: latestInvitation.id,
    email: latestInvitation.email,
    status: latestInvitation.accepted_at !== null ? "accepted" as const : latestInvitation.revoked_at !== null ? "revoked" as const :
      latestInvitation.expires_at <= new Date() ? "expired" as const : "pending" as const,
    expiresAt: latestInvitation.expires_at.toISOString(),
    acceptedAt: latestInvitation.accepted_at?.toISOString() ?? null,
    identityLinkedAt: latestInvitation.identity_linked_at?.toISOString() ?? null,
    delivery: latestInvitation.delivery_status === null ? null : {
      status: latestInvitation.delivery_status,
      attemptCount: latestInvitation.attempt_count ?? 0,
      sentAt: latestInvitation.sent_at?.toISOString() ?? null,
      failedAt: latestInvitation.failed_at?.toISOString() ?? null,
      failureReason: latestInvitation.failure_reason
    }
  };
  return {
    contractId: PLATFORM_CONTROL_PLANE_CONTRACT_ID,
    organization: { ...summary(row), legalName: config.legal_name, countryCode: config.country_code,
      timeZone: config.time_zone, supportContact: config.support_contact, securityContact: config.security_contact,
      activatedAt: config.activated_at?.toISOString() ?? null, suspendedAt: config.suspended_at?.toISOString() ?? null,
      offboardedAt: config.offboarded_at?.toISOString() ?? null },
    domains: domains.rows.map((domain) => ({ id: domain.id, domain: domain.domain,
      verificationMethod: domain.verification_method, verifiedAt: domain.verified_at?.toISOString() ?? null,
      challenge: domain.challenge_name === null || domain.challenge_value === null || domain.challenge_expires_at === null ? null : {
        recordType: "TXT" as const, name: domain.challenge_name, value: domain.challenge_value,
        expiresAt: domain.challenge_expires_at.toISOString(), lastCheckedAt: domain.last_checked_at?.toISOString() ?? null,
        failure: domain.verification_failure
      } })),
    firstAdminInvitation,
    identityProviders: await listOrganizationIdentityProviders(client, organizationId),
    auditRecords: auditRecords.rows.map((record) => ({ id: record.id, action: record.action,
      actorDisplayName: record.display_name, recordedAt: record.recorded_at.toISOString(), details: record.details }))
  };
}

export async function listPlatformOrganizations(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  correlationId: string
): Promise<PlatformOrganizationsV1> {
  return withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId);
    await reconcileLegacyOrganizations(client, principal, correlationId);
    return { contractId: PLATFORM_CONTROL_PLANE_CONTRACT_ID, organizations: (await listRows(client)).map(summary) };
  });
}

export async function getPlatformOrganization(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  organizationId: string,
  correlationId: string
): Promise<PlatformOrganizationDetailV1> {
  return withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId);
    await reconcileLegacyOrganizations(client, principal, correlationId);
    const detail = await loadDetail(client, organizationId);
    if (detail === null) throw authorizationError("NOT_FOUND", "The provisioned Organization was not found.", correlationId);
    return detail;
  });
}

function validateProvisioningDetails(input: UpdatePlatformOrganizationInput, correlationId: string): void {
  const checks: [boolean, string][] = [
    [input.legalName.length < 2 || input.legalName.length > 300, "Legal name must contain 2 to 300 characters."],
    [!/^[A-Z]{2}$/u.test(input.countryCode), "Country code must contain two letters, for example US, GB, or ZA."],
    [!isTimeZone(input.timeZone), "Time zone is not recognized. Use a named zone such as America/New_York, Africa/Johannesburg, or UTC."],
    [!["cloud", "self_hosted", "air_gapped"].includes(input.deploymentProfile), "Select a deployment profile: Plenum cloud, Self-hosted, or Air-gapped."],
    [input.dataResidencyRegion.length < 2 || input.dataResidencyRegion.length > 120,
      "Data residency region must contain 2 to 120 characters. Enter the actual deployment region, for example us-east-2."],
    [input.entitlements.length === 0, "Select at least one enabled capability."],
    [input.entitlements.some((item) => !entitlementPattern.test(item)),
      "Capability keys must contain 2 to 80 characters, start with a letter, and use only letters, numbers, underscores, hyphens, or periods. Leave additional keys blank unless supplied for your contract."],
    [input.supportContact.length < 3 || input.supportContact.length > 320, "Support contact must contain 3 to 320 characters."],
    [input.securityContact !== undefined && input.securityContact.length > 320, "Security contact must contain no more than 320 characters."]
  ];
  const invalid = checks.find(([failed]) => failed);
  if (invalid) throw authorizationError("VALIDATION_FAILED", invalid[1], correlationId);
}

function validateOrganizationName(name: string, correlationId: string): void {
  if (name.length < 2 || name.length > 200) {
    throw authorizationError("VALIDATION_FAILED", "Organization name must contain 2 to 200 characters.", correlationId);
  }
}

function validateCreateInput(input: CreatePlatformOrganizationInput, correlationId: string): CreatePlatformOrganizationInput {
  const normalized = { ...input, name: clean(input.name), slug: clean(input.slug).toLowerCase(), legalName: clean(input.legalName),
    countryCode: clean(input.countryCode).toUpperCase(), timeZone: clean(input.timeZone),
    dataResidencyRegion: clean(input.dataResidencyRegion), entitlements: [...new Set(input.entitlements.map((item) => clean(item).toLowerCase()))],
    supportContact: clean(input.supportContact), ...(input.securityContact === undefined ? {} : { securityContact: clean(input.securityContact) }) };
  validateOrganizationName(normalized.name, correlationId);
  if (!slugPattern.test(normalized.slug) || normalized.slug.length > 80) {
    throw authorizationError("VALIDATION_FAILED", "Workspace address must contain 1 to 80 lowercase letters or numbers, with single hyphens between words.", correlationId);
  }
  validateProvisioningDetails(normalized, correlationId);
  return normalized;
}

export async function createPlatformOrganization(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: CreatePlatformOrganizationInput,
  correlationId: string
): Promise<PlatformOrganizationDetailV1> {
  const validated = validateCreateInput(input, correlationId);
  return withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId);
    const exists = await client.query("SELECT 1 FROM identity.organization_provisioning WHERE slug=$1", [validated.slug]);
    if (exists.rowCount !== 0) throw authorizationError("TARGET_EXISTS", "An Organization already uses that workspace slug.", correlationId);
    const organizationId = randomUUID();
    await client.query(
      `INSERT INTO identity.organizations(id,name,lifecycle_status) VALUES ($1,$2,'pending')`, [organizationId, validated.name]
    );
    await client.query(
      `INSERT INTO identity.organization_provisioning
         (organization_id,slug,legal_name,country_code,time_zone,deployment_profile,data_residency_region,
          entitlements,support_contact,security_contact,configured_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text[],$9,$10,$11)`,
      [organizationId, validated.slug, validated.legalName, validated.countryCode, validated.timeZone,
        validated.deploymentProfile, validated.dataResidencyRegion, validated.entitlements,
        validated.supportContact, validated.securityContact ?? null, principal.principalId]
    );
    await audit(client, principal, "platform.organization_provisioned", organizationId, `organization:${organizationId}`,
      correlationId, null, { lifecycleStatus: "pending", deploymentProfile: validated.deploymentProfile,
        entitlements: validated.entitlements }, { slug: validated.slug });
    const detail = await loadDetail(client, organizationId);
    if (detail === null) throw new Error("Provisioned Organization projection was unavailable");
    return detail;
  });
}

function validateUpdateInput(input: UpdatePlatformOrganizationInput, correlationId: string): UpdatePlatformOrganizationInput {
  const normalized = {
    ...input,
    legalName: clean(input.legalName),
    countryCode: clean(input.countryCode).toUpperCase(),
    timeZone: clean(input.timeZone),
    dataResidencyRegion: clean(input.dataResidencyRegion),
    entitlements: [...new Set(input.entitlements.map((item) => clean(item).toLowerCase()))],
    supportContact: clean(input.supportContact),
    ...(input.securityContact === undefined ? {} : { securityContact: clean(input.securityContact) }),
    ...(input.name === undefined ? {} : { name: clean(input.name) })
  };
  if (normalized.name !== undefined) validateOrganizationName(normalized.name, correlationId);
  validateProvisioningDetails(normalized, correlationId);
  return normalized;
}

export async function updatePlatformOrganizationProvisioning(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  organizationId: string,
  input: UpdatePlatformOrganizationInput,
  correlationId: string
): Promise<PlatformOrganizationDetailV1> {
  const validated = validateUpdateInput(input, correlationId);
  return withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId);
    await reconcileLegacyOrganizations(client, principal, correlationId);
    const before = await loadDetail(client, organizationId);
    if (before === null) throw authorizationError("NOT_FOUND", "The Organization was not found.", correlationId);
    if (before.organization.lifecycleStatus === "offboarded") {
      throw authorizationError("INVALID_TRANSITION", "An offboarded Organization cannot be reconfigured.", correlationId);
    }
    await client.query(
      `UPDATE identity.organization_provisioning
          SET legal_name=$2,country_code=$3,time_zone=$4,deployment_profile=$5,data_residency_region=$6,
              entitlements=$7::text[],support_contact=$8,security_contact=$9,configured_by=$10,
              configuration_status='complete',updated_at=transaction_timestamp()
        WHERE organization_id=$1`,
      [organizationId, validated.legalName, validated.countryCode, validated.timeZone, validated.deploymentProfile,
        validated.dataResidencyRegion, validated.entitlements, validated.supportContact,
        validated.securityContact ?? null, principal.principalId]
    );
    if (validated.name !== undefined && validated.name !== before.organization.name) {
      await client.query("UPDATE identity.organizations SET name=$2 WHERE id=$1", [organizationId, validated.name]);
      await audit(client, principal, "platform.organization_renamed", organizationId,
        `organization:${organizationId}`, correlationId, { name: before.organization.name }, { name: validated.name });
    }
    await audit(client, principal, "platform.organization_provisioning_reconciled", organizationId,
      `organization:${organizationId}`, correlationId,
      { configurationStatus: before.organization.configurationStatus },
      { configurationStatus: "complete", deploymentProfile: validated.deploymentProfile,
        entitlements: validated.entitlements });
    const detail = await loadDetail(client, organizationId);
    if (detail === null) throw new Error("Organization projection was unavailable");
    return detail;
  });
}

export async function addOrganizationDomain(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  organizationId: string,
  input: { domain: string; verificationMethod: "dns_txt" | "manual_contract" },
  correlationId: string
): Promise<PlatformOrganizationDetailV1> {
  const domain = clean(input.domain).toLowerCase().replace(/\.$/u, "");
  if (!domainPattern.test(domain) || domain.length > 253 || input.verificationMethod !== "dns_txt") {
    throw authorizationError("VALIDATION_FAILED", "Enter a valid Organization domain for DNS TXT verification.", correlationId);
  }
  const challengeName = `_plenum-verification.${domain}`;
  const challengeValue = `plenum-verification=${randomBytes(24).toString("base64url")}`;
  const challengeExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1_000);
  return withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId);
    const organization = await client.query<{ lifecycle_status: OrganizationLifecycleStatusV1 }>(
      "SELECT lifecycle_status FROM identity.organizations WHERE id=$1 FOR UPDATE", [organizationId]);
    if (organization.rows[0] === undefined) throw authorizationError("NOT_FOUND", "The Organization was not found.", correlationId);
    if (organization.rows[0].lifecycle_status === "offboarded") {
      throw authorizationError("INVALID_TRANSITION", "An offboarded Organization cannot add domains.", correlationId);
    }
    const duplicate = await client.query("SELECT 1 FROM identity.organization_domains WHERE domain=$1", [domain]);
    if (duplicate.rowCount !== 0) throw authorizationError("TARGET_EXISTS", "That domain is already assigned to an Organization.", correlationId);
    const id = randomUUID();
    await client.query(
      `INSERT INTO identity.organization_domains(
         id,organization_id,domain,verification_method,created_by,challenge_name,challenge_value,
         challenge_issued_at,challenge_expires_at
       ) VALUES ($1,$2,$3,'dns_txt',$4,$5,$6,transaction_timestamp(),$7)`,
      [id, organizationId, domain, principal.principalId, challengeName, challengeValue, challengeExpiresAt]
    );
    await audit(client, principal, "platform.organization_domain_added", organizationId, `organization_domain:${id}`,
      correlationId, null, { domain, verificationMethod: "dns_txt", challengeExpiresAt: challengeExpiresAt.toISOString() });
    const detail = await loadDetail(client, organizationId);
    if (detail === null) throw new Error("Organization projection was unavailable");
    return detail;
  });
}

export async function verifyOrganizationDomain(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  organizationId: string,
  domainId: string,
  correlationId: string,
  resolver: DomainVerificationResolver = systemDomainVerificationResolver
): Promise<PlatformOrganizationDetailV1> {
  const challenge = await withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId);
    const result = await client.query<{ domain: string; challenge_name: string; challenge_value: string; challenge_expires_at: Date }>(
      `SELECT domain,challenge_name,challenge_value,challenge_expires_at
         FROM identity.organization_domains
        WHERE organization_id=$1 AND id=$2 AND verification_method='dns_txt' AND verified_at IS NULL`,
      [organizationId, domainId]
    );
    const row = result.rows[0];
    if (row === undefined) throw authorizationError("INVALID_TRANSITION", "The DNS challenge was not found or is already verified.", correlationId);
    if (row.challenge_expires_at <= new Date()) {
      throw authorizationError("INVALID_TRANSITION", "The DNS challenge has expired. Reissue it before checking again.", correlationId);
    }
    return row;
  });

  let records: string[] = [];
  let lookupFailure: string | null = null;
  try {
    records = await resolver.resolveTxt(challenge.challenge_name);
  } catch {
    lookupFailure = "The TXT record could not be resolved.";
  }
  const matched = lookupFailure === null && records.some((value) => value === challenge.challenge_value);
  const failure = matched ? null : lookupFailure ?? "The expected TXT value was not found.";
  const detail = await withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId);
    const result = await client.query<{ domain: string }>(
      `UPDATE identity.organization_domains
          SET verification_attempts=verification_attempts+1,last_checked_at=transaction_timestamp(),
              verification_failure=$5,
              verified_at=CASE WHEN $5::text IS NULL THEN transaction_timestamp() ELSE verified_at END,
              verified_by=CASE WHEN $5::text IS NULL THEN $3 ELSE verified_by END,
              verification_reference=CASE WHEN $5::text IS NULL THEN $4 ELSE verification_reference END
        WHERE organization_id=$1 AND id=$2 AND verified_at IS NULL
          AND challenge_value=$4 AND challenge_expires_at > transaction_timestamp()
      RETURNING domain`,
      [organizationId, domainId, principal.principalId, challenge.challenge_value, failure]
    );
    const checked = result.rows[0];
    if (checked === undefined) throw authorizationError("INVALID_TRANSITION", "The DNS challenge changed or expired. Reissue it and try again.", correlationId);
    await audit(client, principal, matched ? "platform.organization_domain_verified" : "platform.organization_domain_verification_failed",
      organizationId, `organization_domain:${domainId}`, correlationId, { status: "pending" },
      { status: matched ? "verified" : "pending", domain: checked.domain }, failure === null ? {} : { reason: failure });
    const next = await loadDetail(client, organizationId);
    if (next === null) throw new Error("Organization projection was unavailable");
    return next;
  });
  if (!matched) throw authorizationError("INVALID_TRANSITION", failure ?? "DNS verification failed.", correlationId);
  return detail;
}

export async function reissueOrganizationDomainChallenge(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  organizationId: string,
  domainId: string,
  correlationId: string
): Promise<PlatformOrganizationDetailV1> {
  const value = `plenum-verification=${randomBytes(24).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1_000);
  return withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId);
    const result = await client.query<{ domain: string }>(
      `UPDATE identity.organization_domains
          SET challenge_value=$4,challenge_issued_at=transaction_timestamp(),challenge_expires_at=$5,
              verification_failure=NULL,last_checked_at=NULL
        WHERE organization_id=$1 AND id=$2 AND verification_method='dns_txt' AND verified_at IS NULL
      RETURNING domain`, [organizationId, domainId, principal.principalId, value, expiresAt]
    );
    if (result.rows[0] === undefined) {
      throw authorizationError("INVALID_TRANSITION", "Only a pending DNS challenge can be reissued.", correlationId);
    }
    await audit(client, principal, "platform.organization_domain_challenge_reissued", organizationId,
      `organization_domain:${domainId}`, correlationId, null,
      { status: "pending", challengeExpiresAt: expiresAt.toISOString() });
    const detail = await loadDetail(client, organizationId);
    if (detail === null) throw new Error("Organization projection was unavailable");
    return detail;
  });
}

export async function issueFirstAdminInvitation(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  organizationId: string,
  emailInput: string,
  correlationId: string,
  delivery: FirstAdminInvitationDelivery,
  publicBaseUrl: string
): Promise<{ organization: PlatformOrganizationDetailV1; invitationUrl?: string; expiresAt: string }> {
  const email = clean(emailInput).toLowerCase();
  const emailMatch = email.match(emailPattern);
  let baseUrl: URL;
  try { baseUrl = new URL(publicBaseUrl); } catch { throw new Error("The public Plenum URL is invalid"); }
  if (email.length > 320 || emailMatch?.[1] === undefined || !["https:", "http:"].includes(baseUrl.protocol)) {
    throw authorizationError("VALIDATION_FAILED", "Enter a valid first Admin email address.", correlationId);
  }
  const queued = await withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId);
    const organization = await client.query<{ lifecycle_status: OrganizationLifecycleStatusV1; name: string }>(
      "SELECT lifecycle_status,name FROM identity.organizations WHERE id=$1 FOR UPDATE", [organizationId]);
    const organizationRow = organization.rows[0];
    if (organizationRow === undefined) throw authorizationError("NOT_FOUND", "The Organization was not found.", correlationId);
    const lifecycle = organizationRow.lifecycle_status;
    if (lifecycle !== "pending") throw authorizationError("INVALID_TRANSITION", "The first Admin can only be invited while provisioning is pending.", correlationId);
    const domain = await client.query(
      `SELECT 1 FROM identity.organization_domains
        WHERE organization_id=$1 AND domain=$2 AND verified_at IS NOT NULL`, [organizationId, emailMatch[1]]
    );
    if (domain.rowCount !== 1) {
      throw authorizationError("INVALID_TRANSITION", "Verify the email domain before inviting the first Organization Admin.", correlationId);
    }
    const accepted = await client.query(
      `SELECT 1 FROM identity.first_admin_invitations WHERE organization_id=$1 AND accepted_at IS NOT NULL`, [organizationId]);
    if (accepted.rowCount !== 0) throw authorizationError("INVALID_TRANSITION", "The first Organization Admin has already accepted.", correlationId);
    const prior = await client.query(
      `SELECT 1 FROM identity.first_admin_invitations WHERE organization_id=$1 LIMIT 1`, [organizationId]);
    const revoked = await client.query<{ id: string }>(
      `UPDATE identity.first_admin_invitations SET revoked_at=transaction_timestamp()
        WHERE organization_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id`, [organizationId]
    );
    if (revoked.rows.length > 0) {
      await client.query(
        `UPDATE identity.first_admin_invitation_deliveries SET status='cancelled',updated_at=transaction_timestamp()
          WHERE invitation_id=ANY($1::uuid[]) AND status='queued'`, [revoked.rows.map(({ id }) => id)]
      );
    }
    const token = randomBytes(32).toString("base64url");
    const invitationId = randomUUID();
    const deliveryId = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
    await client.query(
      `INSERT INTO identity.first_admin_invitations
         (id,organization_id,email,token_sha256,invited_by,expires_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [invitationId, organizationId, email, sha256(token), principal.principalId, expiresAt]
    );
    await client.query(
      `INSERT INTO identity.first_admin_invitation_deliveries
         (id,organization_id,invitation_id,recipient_email,channel,template_ref,status)
       VALUES ($1,$2,$3,$4,'email','platform-first-admin-v1','queued')`,
      [deliveryId, organizationId, invitationId, email]
    );
    await audit(client, principal, prior.rowCount === 0 ? "platform.first_admin_invitation_issued" : "platform.first_admin_invitation_reissued", organizationId,
      `first_admin_invitation:${invitationId}`, correlationId, null,
      { status: "pending", deliveryStatus: "queued", expiresAt: expiresAt.toISOString() });
    return { token, invitationId, deliveryId, organizationName: organizationRow.name, expiresAt };
  });

  const invitationPath = `/platform/invitations/${queued.token}`;
  const invitationUrl = new URL(invitationPath, baseUrl).toString();
  let providerReference: string | null = null;
  let previewUrl: string | undefined;
  let failureReason: string | null = null;
  try {
    const delivered = await delivery.deliver({ messageType: "PLATFORM_FIRST_ADMIN_INVITATION",
      deliveryId: queued.deliveryId, recipientEmail: email,
      organizationName: queued.organizationName, invitationUrl, expiresAt: queued.expiresAt.toISOString(),
      templateRef: "platform-first-admin-v1" });
    providerReference = delivered.providerReference;
    previewUrl = delivered.previewUrl;
  } catch {
    failureReason = "Invitation delivery failed. Reissue the invitation after checking the delivery provider.";
  }
  const organization = await withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId);
    await client.query(
      `UPDATE identity.first_admin_invitation_deliveries
          SET status=CASE WHEN $2::text IS NULL THEN 'sent' ELSE 'failed' END,
              attempt_count=attempt_count+1,sent_at=CASE WHEN $2::text IS NULL THEN transaction_timestamp() ELSE NULL END,
              failed_at=CASE WHEN $2::text IS NULL THEN NULL ELSE transaction_timestamp() END,
              failure_reason=$2,provider_reference=$3,updated_at=transaction_timestamp()
        WHERE id=$1 AND status='queued'`, [queued.deliveryId, failureReason, providerReference]
    );
    await audit(client, principal, failureReason === null ? "platform.first_admin_invitation_delivered" : "platform.first_admin_invitation_delivery_failed",
      organizationId, `first_admin_invitation:${queued.invitationId}`, correlationId,
      { deliveryStatus: "queued" }, { deliveryStatus: failureReason === null ? "sent" : "failed" },
      failureReason === null ? { providerReference: providerReference ?? "unavailable" } : { reason: failureReason });
    const detail = await loadDetail(client, organizationId);
    if (detail === null) throw new Error("Organization projection was unavailable");
    return detail;
  });
  return { organization, ...(previewUrl === undefined ? {} : { invitationUrl: previewUrl }), expiresAt: queued.expiresAt.toISOString() };
}

export async function revokeFirstAdminInvitation(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  organizationId: string,
  correlationId: string
): Promise<PlatformOrganizationDetailV1> {
  return withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId);
    const revoked = await client.query<{ id: string }>(
      `UPDATE identity.first_admin_invitations SET revoked_at=transaction_timestamp()
        WHERE organization_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL
      RETURNING id`, [organizationId]
    );
    const invitation = revoked.rows[0];
    if (invitation === undefined) throw authorizationError("INVALID_TRANSITION", "There is no pending first Admin invitation to revoke.", correlationId);
    await client.query(
      `UPDATE identity.first_admin_invitation_deliveries SET status='cancelled',updated_at=transaction_timestamp()
        WHERE invitation_id=$1 AND status='queued'`, [invitation.id]
    );
    await audit(client, principal, "platform.first_admin_invitation_revoked", organizationId,
      `first_admin_invitation:${invitation.id}`, correlationId, { status: "pending" }, { status: "revoked" });
    const detail = await loadDetail(client, organizationId);
    if (detail === null) throw new Error("Organization projection was unavailable");
    return detail;
  });
}

export async function acceptFirstAdminInvitation(
  pool: Pool,
  token: string,
  displayNameInput: string,
  correlationId: string
): Promise<{ organizationId: string; organizationName: string; personId: string }> {
  const displayName = clean(displayNameInput);
  if (!/^[A-Za-z0-9_-]{43}$/u.test(token) || displayName.length < 2 || displayName.length > 200) {
    throw authorizationError("VALIDATION_FAILED", "The invitation or Admin name is invalid.", correlationId);
  }
  return withRestrictedTransaction(pool, async (client) => {
    const result = await client.query<{ organization_id: string; organization_name: string; person_id: string }>(
      `SELECT * FROM identity.accept_first_admin_invitation($1,$2,$3,$4)`,
      [sha256(token), randomUUID(), displayName, correlationId]
    );
    const accepted = result.rows[0];
    if (accepted === undefined) {
      throw authorizationError("INVALID_TRANSITION", "This invitation is invalid, expired, already used, or no longer eligible.", correlationId);
    }
    return { organizationId: accepted.organization_id, organizationName: accepted.organization_name, personId: accepted.person_id };
  });
}

export async function transitionOrganizationLifecycle(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  organizationId: string,
  action: "activate" | "suspend" | "offboard",
  expectedVersion: number,
  reason: string,
  correlationId: string
): Promise<PlatformOrganizationDetailV1> {
  const rationale = clean(reason);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || rationale.length < 3 || rationale.length > 1_000) {
    throw authorizationError("VALIDATION_FAILED", "A current lifecycle version and reason are required.", correlationId);
  }
  return withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId);
    const current = await client.query<{ lifecycle_status: OrganizationLifecycleStatusV1; lifecycle_version: string }>(
      `SELECT lifecycle_status,lifecycle_version::text FROM identity.organizations WHERE id=$1 FOR UPDATE`, [organizationId]);
    const row = current.rows[0];
    if (row === undefined) throw authorizationError("NOT_FOUND", "The Organization was not found.", correlationId);
    if (Number(row.lifecycle_version) !== expectedVersion) {
      throw authorizationError("STALE_AGGREGATE_VERSION", "Organization lifecycle changed in another view. Refresh before trying again.", correlationId);
    }
    const detailBefore = await loadDetail(client, organizationId);
    if (detailBefore === null) throw authorizationError("NOT_FOUND", "The provisioned Organization was not found.", correlationId);
    if (action === "activate") {
      if (row.lifecycle_status !== "pending" && row.lifecycle_status !== "suspended") {
        throw authorizationError("INVALID_TRANSITION", "Only a pending or suspended Organization can be activated.", correlationId);
      }
      const incomplete = detailBefore.organization.gates.filter((gate) => !gate.complete);
      if (incomplete.length > 0) {
        throw authorizationError("INVALID_TRANSITION", "Organization activation prerequisites are incomplete.", correlationId,
          { prerequisites: incomplete.map((gate) => gate.prerequisite) });
      }
      await client.query(
        `UPDATE identity.organizations SET lifecycle_status='active',lifecycle_version=lifecycle_version+1,
          activated_at=transaction_timestamp(),suspended_at=NULL WHERE id=$1`, [organizationId]);
    } else if (action === "suspend") {
      if (row.lifecycle_status !== "active") throw authorizationError("INVALID_TRANSITION", "Only an active Organization can be suspended.", correlationId);
      await client.query(
        `UPDATE identity.organizations SET lifecycle_status='suspended',lifecycle_version=lifecycle_version+1,
          suspended_at=transaction_timestamp() WHERE id=$1`, [organizationId]);
    } else {
      if (row.lifecycle_status === "offboarded") throw authorizationError("INVALID_TRANSITION", "The Organization is already offboarded.", correlationId);
      await client.query(
        `UPDATE identity.organizations SET lifecycle_status='offboarded',lifecycle_version=lifecycle_version+1,
          offboarded_at=transaction_timestamp() WHERE id=$1`, [organizationId]);
      await client.query(
        `UPDATE identity.first_admin_invitations SET revoked_at=transaction_timestamp()
          WHERE organization_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL`, [organizationId]);
    }
    if (action === "suspend" || action === "offboard") {
      await client.query("SELECT set_config('app.organization_id',$1,true)", [organizationId]);
      await client.query(
        `UPDATE identity.authentication_sessions SET revoked_at=transaction_timestamp()
          WHERE organization_id=$1 AND revoked_at IS NULL`, [organizationId]);
      await client.query(
        `UPDATE sync.projection_grants SET revoked_at=transaction_timestamp()
          WHERE organization_id=$1 AND revoked_at IS NULL`, [organizationId]);
    }
    const detailAfter = await loadDetail(client, organizationId);
    if (detailAfter === null) throw new Error("Organization projection was unavailable");
    await audit(client, principal, `platform.organization_${action === "offboard" ? "offboarded" : `${action}d`}`,
      organizationId, `organization:${organizationId}`, correlationId,
      { lifecycleStatus: detailBefore.organization.lifecycleStatus, lifecycleVersion: detailBefore.organization.lifecycleVersion },
      { lifecycleStatus: detailAfter.organization.lifecycleStatus, lifecycleVersion: detailAfter.organization.lifecycleVersion },
      { reason: rationale });
    return detailAfter;
  });
}
