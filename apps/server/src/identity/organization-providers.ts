import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type {
  JsonObject,
  OrganizationIdentityProviderProtocolV1,
  OrganizationIdentityProviderStatusV1,
  OrganizationIdentityProviderV1
} from "@plenum/event-contracts";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction, withPlatformTransaction, withRestrictedTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import { beginOidcLogin, type AuthenticatedPrincipal } from "./login.js";
import type { OidcProviderConfiguration } from "./oidc.js";

const providerNamePattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
const sha256Pattern = /^[0-9a-f]{64}$/u;
const MAX_METADATA_BYTES = 1_000_000;

export interface StageOrganizationIdentityProviderInput {
  protocol: OrganizationIdentityProviderProtocolV1;
  displayName: string;
  discoveryUrl: string;
  metadataUrl?: string;
  clientId: string;
  audience: string;
  domainIds: string[];
  replacesProviderId?: string;
}

export interface IdentityMetadataFetcher {
  fetch(url: string): Promise<{ body: string; contentType: string | null }>;
}

type ProviderRow = {
  id: string;
  organization_id: string;
  provider_key: string;
  version: number;
  protocol: OrganizationIdentityProviderProtocolV1;
  display_name: string;
  status: OrganizationIdentityProviderStatusV1;
  discovery_url: string;
  metadata_url: string | null;
  client_id: string;
  audience: string;
  issuer: string | null;
  authorization_endpoint: string | null;
  token_endpoint: string | null;
  jwks_uri: string | null;
  preflighted_at: Date | null;
  preflight_failure: string | null;
  tested_at: Date | null;
  approved_at: Date | null;
  activated_at: Date | null;
  suspended_at: Date | null;
  replaces_provider_id: string | null;
  domains: string[];
};

async function requirePlatformAdministrator(client: PoolClient, principal: AuthenticatedPrincipal, correlationId: string): Promise<void> {
  const current = await client.query(
    `SELECT 1 FROM identity.authentication_sessions authentication_session
      WHERE authentication_session.organization_id=$1 AND authentication_session.id=$2
        AND authentication_session.person_id=$3 AND authentication_session.revoked_at IS NULL
        AND authentication_session.expires_at>transaction_timestamp()
        AND identity.current_platform_administrator() LIMIT 1`,
    [principal.organizationId, principal.authenticationSessionId, principal.principalId]
  );
  if (current.rowCount !== 1) throw authorizationError("PERMISSION_DENIED",
    "Active Plenum Platform Administrator authority is required.", correlationId);
}

async function audit(client: PoolClient, principal: AuthenticatedPrincipal, action: string, organizationId: string,
  targetRef: string, correlationId: string, beforeState: JsonObject | null, afterState: JsonObject | null,
  details: JsonObject = {}): Promise<void> {
  await client.query(`INSERT INTO evidence.platform_audit_records
    (id,actor_person_id,action,resource_organization_id,target_ref,before_state,after_state,details)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb)`,
  [randomUUID(), principal.principalId, action, organizationId, targetRef,
    beforeState === null ? null : JSON.stringify(beforeState), afterState === null ? null : JSON.stringify(afterState),
    JSON.stringify({ ...details, correlationId })]);
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function privateAddress(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local")) return true;
  if (isIP(normalized) === 4) {
    const [a = 0, b = 0] = normalized.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || a >= 224;
  }
  if (isIP(normalized) === 6) {
    return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") ||
      normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
  }
  return false;
}

function externalHttpsUrl(value: string, field: string): URL {
  if (value.length > 2_048) throw new Error(`${field} is too long`);
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username.length > 0 || url.password.length > 0 || privateAddress(url.hostname)) {
    throw new Error(`${field} must be an external HTTPS URL without credentials`);
  }
  return url;
}

export function createSystemIdentityMetadataFetcher(options: { allowPrivateNetworks?: boolean } = {}): IdentityMetadataFetcher {
  return {
    async fetch(value) {
      const url = externalHttpsUrl(value, "metadata URL");
      const addresses = await lookup(url.hostname, { all: true, verbatim: true });
      if (addresses.length === 0 || (options.allowPrivateNetworks !== true && addresses.some(({ address }) => privateAddress(address)))) {
        throw new Error("metadata host resolves to a private or unavailable network address");
      }
      const response = await fetch(url, {
        headers: { accept: "application/json, application/xml, text/xml;q=0.9" },
        redirect: "error",
        signal: AbortSignal.timeout(5_000)
      });
      if (!response.ok) throw new Error(`metadata endpoint returned ${response.status}`);
      const declaredLength = Number(response.headers.get("content-length") ?? "0");
      if (Number.isFinite(declaredLength) && declaredLength > MAX_METADATA_BYTES) throw new Error("metadata response is too large");
      const body = await response.text();
      if (Buffer.byteLength(body) > MAX_METADATA_BYTES) throw new Error("metadata response is too large");
      return { body, contentType: response.headers.get("content-type") };
    }
  };
}

export const systemIdentityMetadataFetcher = createSystemIdentityMetadataFetcher();

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("metadata must be an object");
  return value as Record<string, unknown>;
}

function metadataString(value: Record<string, unknown>, key: string): string {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.trim().length === 0) throw new Error(`metadata is missing ${key}`);
  return candidate.trim();
}

async function discoverOidc(discoveryUrl: string, fetcher: IdentityMetadataFetcher) {
  externalHttpsUrl(discoveryUrl, "discoveryUrl");
  const metadataResponse = await fetcher.fetch(discoveryUrl);
  const metadata = object(JSON.parse(metadataResponse.body) as unknown);
  const issuer = externalHttpsUrl(metadataString(metadata, "issuer"), "issuer").toString().replace(/\/$/u, "");
  const authorizationEndpoint = externalHttpsUrl(metadataString(metadata, "authorization_endpoint"), "authorization_endpoint").toString();
  const tokenEndpoint = externalHttpsUrl(metadataString(metadata, "token_endpoint"), "token_endpoint").toString();
  const jwksUri = externalHttpsUrl(metadataString(metadata, "jwks_uri"), "jwks_uri").toString();
  const jwksResponse = await fetcher.fetch(jwksUri);
  const jwks = object(JSON.parse(jwksResponse.body) as unknown);
  if (!Array.isArray(jwks.keys) || jwks.keys.length === 0 || !jwks.keys.every((key) => {
    if (typeof key !== "object" || key === null) return false;
    const record = key as Record<string, unknown>;
    return record.kty === "RSA" && (record.use === undefined || record.use === "sig");
  })) throw new Error("JWKS must contain at least one RSA signing key");
  const keysDigest = sha256(JSON.stringify(jwks.keys));
  return { issuer, authorizationEndpoint, tokenEndpoint, jwksUri,
    metadataSha256: sha256(metadataResponse.body), signingKeysSha256: keysDigest,
    signingKeyFingerprints: [keysDigest] };
}

function firstXmlAttribute(xml: string, element: string, attribute: string): string {
  const expression = new RegExp(`<(?:(?:[A-Za-z][\\w.-]*):)?${element}\\b[^>]*\\b${attribute}=["']([^"']+)["']`, "iu");
  const match = expression.exec(xml)?.[1];
  if (match === undefined || match.trim().length === 0) throw new Error(`SAML metadata is missing ${element} ${attribute}`);
  return match.trim().replaceAll("&amp;", "&");
}

function discoverSamlMetadata(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/iu.test(xml)) throw new Error("SAML metadata cannot contain document type or entity declarations");
  const entityId = firstXmlAttribute(xml, "EntityDescriptor", "entityID");
  const ssoUrl = externalHttpsUrl(firstXmlAttribute(xml, "SingleSignOnService", "Location"), "SAML SSO endpoint").toString();
  const certificates = [...xml.matchAll(/<(?:(?:[A-Za-z][\w.-]*):)?X509Certificate\b[^>]*>([A-Za-z0-9+/=\s]+)<\/(?:(?:[A-Za-z][\w.-]*):)?X509Certificate>/giu)]
    .map((match) => (match[1] ?? "").replaceAll(/\s/gu, ""))
    .filter(Boolean);
  if (certificates.length === 0) throw new Error("SAML metadata must publish at least one signing certificate");
  const fingerprints = certificates.map((certificate) => {
    const decoded = Buffer.from(certificate, "base64");
    if (decoded.length < 64) throw new Error("SAML signing certificate is invalid");
    return sha256(decoded);
  });
  return { entityId, ssoUrl, fingerprints };
}

export async function validateIdentityProviderMetadata(input: {
  protocol: OrganizationIdentityProviderProtocolV1;
  discoveryUrl: string;
  metadataUrl?: string;
}, fetcher: IdentityMetadataFetcher): Promise<{
  oidc: Awaited<ReturnType<typeof discoverOidc>>;
  saml: { entityId: string; ssoUrl: string; fingerprints: string[] } | null;
  effectiveMetadataSha256: string;
}> {
  const oidc = await discoverOidc(input.discoveryUrl, fetcher);
  if (input.protocol === "oidc") return { oidc, saml: null, effectiveMetadataSha256: oidc.metadataSha256 };
  if (input.metadataUrl === undefined) throw new Error("SAML metadata URL is required");
  externalHttpsUrl(input.metadataUrl, "metadataUrl");
  const metadata = await fetcher.fetch(input.metadataUrl);
  return { oidc, saml: discoverSamlMetadata(metadata.body), effectiveMetadataSha256: sha256(metadata.body) };
}

function providerProjectionSql(): string {
  return `SELECT provider.id,provider.organization_id,provider.provider_key,provider.version,provider.protocol,
                 provider.display_name,provider.status,provider.discovery_url,provider.metadata_url,
                 provider.client_id,provider.audience,provider.issuer,provider.authorization_endpoint,
                 provider.token_endpoint,provider.jwks_uri,provider.preflighted_at,provider.preflight_failure,
                 provider.tested_at,provider.approved_at,provider.activated_at,provider.suspended_at,
                 provider.replaces_provider_id,
                 identity.identity_provider_bound_domains(provider.organization_id,provider.id) AS domains
            FROM identity.organization_identity_provider_revisions provider
           WHERE provider.organization_id=$1`;
}

export async function listOrganizationIdentityProviders(client: PoolClient, organizationId: string): Promise<OrganizationIdentityProviderV1[]> {
  const result = await client.query<ProviderRow>(`${providerProjectionSql()} ORDER BY provider.version DESC`, [organizationId]);
  return result.rows.map((row) => ({ id: row.id, version: row.version, protocol: row.protocol,
    displayName: row.display_name, status: row.status, discoveryUrl: row.discovery_url,
    metadataUrl: row.metadata_url, domains: row.domains, preflightedAt: row.preflighted_at?.toISOString() ?? null,
    testedAt: row.tested_at?.toISOString() ?? null, approvedAt: row.approved_at?.toISOString() ?? null,
    activatedAt: row.activated_at?.toISOString() ?? null, suspendedAt: row.suspended_at?.toISOString() ?? null,
    preflightFailure: row.preflight_failure, replacesProviderId: row.replaces_provider_id }));
}

export async function getOrganizationIdentityProviderManagement(pool: Pool, principal: AuthenticatedPrincipal,
  correlationId: string): Promise<{ identityProviders: OrganizationIdentityProviderV1[] }> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireOrganizationAdmin(client, principal, correlationId);
    return { identityProviders: await listOrganizationIdentityProviders(client, principal.organizationId) };
  });
}

async function requireStepUp(client: PoolClient, principal: AuthenticatedPrincipal, correlationId: string): Promise<void> {
  const result = await client.query<{ valid: boolean }>(
    "SELECT identity.platform_session_is_step_up($1,$2) AS valid",
    [principal.principalId, principal.authenticationSessionId]
  );
  if (result.rows[0]?.valid !== true) throw authorizationError("PERMISSION_DENIED",
    "Recent multi-factor authentication is required for identity-provider changes.", correlationId,
    { stepUpUrl: "/auth/login?platformRecovery=1&stepUp=1&returnTo=/platform/organizations" });
}

async function requireOrganizationAdmin(client: PoolClient, principal: AuthenticatedPrincipal, correlationId: string): Promise<void> {
  const result = await client.query(
    `SELECT 1 FROM identity.memberships membership
      WHERE membership.organization_id=$1 AND membership.person_id=$2 AND membership.organization_role='admin'`,
    [principal.organizationId, principal.principalId]
  );
  if (result.rowCount !== 1) throw authorizationError("PERMISSION_DENIED", "Organization Admin authority is required.", correlationId);
}

function validateStageInput(input: StageOrganizationIdentityProviderInput, correlationId: string) {
  const normalized = { ...input, displayName: input.displayName.trim(), discoveryUrl: input.discoveryUrl.trim(),
    ...(input.metadataUrl === undefined ? {} : { metadataUrl: input.metadataUrl.trim() }),
    clientId: input.clientId.trim(), audience: input.audience.trim(), domainIds: [...new Set(input.domainIds)] };
  if (!["oidc", "saml"].includes(normalized.protocol) || normalized.displayName.length < 2 || normalized.displayName.length > 160 ||
      normalized.clientId.length < 1 || normalized.clientId.length > 300 || normalized.audience.length < 1 || normalized.audience.length > 300 ||
      normalized.domainIds.length === 0 || normalized.domainIds.some((id) => !/^[0-9a-f-]{36}$/iu.test(id)) ||
      (normalized.protocol === "saml" && (normalized.metadataUrl === undefined || normalized.metadataUrl.length === 0)) ||
      (normalized.protocol === "oidc" && normalized.metadataUrl !== undefined)) {
    throw authorizationError("VALIDATION_FAILED", "Identity-provider configuration fields are incomplete or invalid.", correlationId);
  }
  try {
    externalHttpsUrl(normalized.discoveryUrl, "discoveryUrl");
    if (normalized.metadataUrl !== undefined) externalHttpsUrl(normalized.metadataUrl, "metadataUrl");
  } catch {
    throw authorizationError("VALIDATION_FAILED", "Identity-provider metadata endpoints must be external HTTPS URLs.", correlationId);
  }
  return normalized;
}

export async function stageOrganizationIdentityProvider(pool: Pool, principal: AuthenticatedPrincipal,
  organizationId: string, input: StageOrganizationIdentityProviderInput, correlationId: string): Promise<OrganizationIdentityProviderV1[]> {
  const validated = validateStageInput(input, correlationId);
  return withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId); await requireStepUp(client, principal, correlationId);
    const domains = await client.query<{ id: string }>(
      `SELECT id FROM identity.organization_domains
        WHERE organization_id=$1 AND id=ANY($2::uuid[]) AND verified_at IS NOT NULL`,
      [organizationId, validated.domainIds]
    );
    if (domains.rowCount !== validated.domainIds.length) throw authorizationError("INVALID_TRANSITION",
      "Every identity-provider domain must already be verified for this Organization.", correlationId);
    if (validated.replacesProviderId !== undefined) {
      const replaced = await client.query("SELECT 1 FROM identity.organization_identity_provider_revisions WHERE organization_id=$1 AND id=$2",
        [organizationId, validated.replacesProviderId]);
      if (replaced.rowCount !== 1) throw authorizationError("NOT_FOUND", "The provider revision to replace was not found.", correlationId);
    }
    const organization = await client.query("SELECT id FROM identity.organizations WHERE id=$1 FOR UPDATE", [organizationId]);
    if (organization.rowCount !== 1) throw authorizationError("NOT_FOUND", "The Organization was not found.", correlationId);
    const versionResult = await client.query<{ version: number }>(
      "SELECT COALESCE(max(version),0)+1 AS version FROM identity.organization_identity_provider_revisions WHERE organization_id=$1",
      [organizationId]
    );
    const version = versionResult.rows[0]?.version ?? 1;
    const providerId = randomUUID();
    const providerKey = `organization-${organizationId.replaceAll("-", "").slice(0, 12)}-${validated.protocol}-${version}`;
    if (!providerNamePattern.test(providerKey)) throw new Error("generated provider key is invalid");
    await client.query(
      `INSERT INTO identity.organization_identity_provider_revisions
         (id,organization_id,provider_key,version,protocol,display_name,replaces_provider_id,
          discovery_url,metadata_url,client_id,audience,staged_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [providerId, organizationId, providerKey, version, validated.protocol, validated.displayName,
        validated.replacesProviderId ?? null, validated.discoveryUrl, validated.metadataUrl ?? null,
        validated.clientId, validated.audience, principal.principalId]
    );
    for (const domainId of validated.domainIds) await client.query(
      "INSERT INTO identity.organization_identity_provider_domains(organization_id,provider_id,domain_id) VALUES ($1,$2,$3)",
      [organizationId, providerId, domainId]
    );
    await audit(client, principal, "platform.identity_provider_staged", organizationId, `identity_provider:${providerId}`,
      correlationId, null, { version, protocol: validated.protocol, status: "draft" },
      { boundDomainCount: validated.domainIds.length, replacesProviderId: validated.replacesProviderId ?? null });
    return listOrganizationIdentityProviders(client, organizationId);
  });
}

export async function preflightOrganizationIdentityProvider(pool: Pool, principal: AuthenticatedPrincipal,
  organizationId: string, providerId: string, correlationId: string,
  fetcher: IdentityMetadataFetcher = systemIdentityMetadataFetcher): Promise<OrganizationIdentityProviderV1[]> {
  const provider = await withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId); await requireStepUp(client, principal, correlationId);
    const row = await loadProviderRow(client, organizationId, providerId);
    if (row.status !== "draft") throw authorizationError("INVALID_TRANSITION", "Only a draft provider revision can run preflight.", correlationId);
    return row;
  });
  try {
    const discovered = await validateIdentityProviderMetadata({ protocol: provider.protocol,
      discoveryUrl: provider.discovery_url, ...(provider.metadata_url === null ? {} : { metadataUrl: provider.metadata_url }) }, fetcher);
    const { oidc, saml } = discovered;
    return withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
      await requirePlatformAdministrator(client, principal, correlationId); await requireStepUp(client, principal, correlationId);
      const configurationSha256 = sha256(JSON.stringify({ protocol: provider.protocol, discoveryUrl: provider.discovery_url,
        metadataUrl: provider.metadata_url, clientId: provider.client_id, audience: provider.audience,
        issuer: oidc.issuer, authorizationEndpoint: oidc.authorizationEndpoint, tokenEndpoint: oidc.tokenEndpoint,
        jwksUri: oidc.jwksUri, samlEntityId: saml?.entityId ?? null, samlSsoUrl: saml?.ssoUrl ?? null }));
      const updated = await client.query(
        `UPDATE identity.organization_identity_provider_revisions
            SET status='preflight_passed',issuer=$3,authorization_endpoint=$4,token_endpoint=$5,jwks_uri=$6,
                saml_entity_id=$7,saml_sso_url=$8,signing_key_fingerprints=$9::text[],configuration_sha256=$10,
                metadata_sha256=$11,signing_keys_sha256=$12,preflighted_by=$13,preflighted_at=transaction_timestamp(),preflight_failure=NULL
          WHERE organization_id=$1 AND id=$2 AND status='draft'`,
        [organizationId, providerId, oidc.issuer, oidc.authorizationEndpoint, oidc.tokenEndpoint, oidc.jwksUri,
          saml?.entityId ?? null, saml?.ssoUrl ?? null, saml?.fingerprints ?? oidc.signingKeyFingerprints,
          configurationSha256, discovered.effectiveMetadataSha256, oidc.signingKeysSha256, principal.principalId]
      );
      if (updated.rowCount !== 1) throw authorizationError("STALE_AGGREGATE_VERSION",
        "Provider revision changed while preflight was running. Refresh before trying again.", correlationId);
      await audit(client, principal, "platform.identity_provider_preflight_passed", organizationId, `identity_provider:${providerId}`,
        correlationId, { status: "draft" }, { status: "preflight_passed", configurationSha256 },
        { metadataSha256: discovered.effectiveMetadataSha256, signingKeysSha256: oidc.signingKeysSha256 });
      return listOrganizationIdentityProviders(client, organizationId);
    });
  } catch (error) {
    const failure = error instanceof Error ? error.message.slice(0, 500) : "Metadata validation failed";
    await withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
      await requirePlatformAdministrator(client, principal, correlationId);
      await client.query(`UPDATE identity.organization_identity_provider_revisions SET preflight_failure=$3
        WHERE organization_id=$1 AND id=$2 AND status='draft'`, [organizationId, providerId, failure]);
      await audit(client, principal, "platform.identity_provider_preflight_failed", organizationId, `identity_provider:${providerId}`,
        correlationId, { status: "draft" }, { status: "draft" }, { reason: failure });
    });
    throw authorizationError("VALIDATION_FAILED", "Identity-provider preflight failed. The active provider was not changed.", correlationId,
      { reason: failure });
  }
}

async function loadProviderRow(client: PoolClient, organizationId: string, providerId: string, lock = false): Promise<ProviderRow> {
  const result = await client.query<ProviderRow>(
    `SELECT provider.id,provider.organization_id,provider.provider_key,provider.version,provider.protocol,
            provider.display_name,provider.status,provider.discovery_url,provider.metadata_url,
            provider.client_id,provider.audience,provider.issuer,provider.authorization_endpoint,
            provider.token_endpoint,provider.jwks_uri,provider.preflighted_at,provider.preflight_failure,
            provider.tested_at,provider.approved_at,provider.activated_at,provider.suspended_at,
            provider.replaces_provider_id,
            identity.identity_provider_bound_domains(provider.organization_id,provider.id) AS domains
       FROM identity.organization_identity_provider_revisions provider
      WHERE provider.organization_id=$1 AND provider.id=$2${lock ? " FOR UPDATE" : ""}`,
    [organizationId, providerId]
  );
  const row = result.rows[0];
  if (row === undefined) throw authorizationError("NOT_FOUND", "The identity-provider revision was not found.", randomUUID());
  return row;
}

function runtimeConfiguration(row: ProviderRow, redirectUri: string): OidcProviderConfiguration {
  if (row.issuer === null || row.authorization_endpoint === null || row.token_endpoint === null || row.jwks_uri === null) {
    throw new Error("provider revision has not completed preflight");
  }
  return { providerKey: row.provider_key, organizationId: row.organization_id, issuer: row.issuer,
    audience: row.audience, clientId: row.client_id, redirectUri,
    authorizationEndpoint: row.authorization_endpoint, tokenEndpoint: row.token_endpoint, jwksUri: row.jwks_uri,
    identityProviderId: row.id };
}

export async function beginOrganizationIdentityProviderTest(pool: Pool, principal: AuthenticatedPrincipal,
  providerId: string, redirectUri: string, returnTo: string, correlationId: string): Promise<{ authorizationUrl: string }> {
  const provider = await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireOrganizationAdmin(client, principal, correlationId);
    await requireStepUp(client, principal, correlationId);
    const row = await loadProviderRow(client, principal.organizationId, providerId);
    if (row.status !== "preflight_passed") throw authorizationError("INVALID_TRANSITION",
      "Provider test authentication is available only after successful preflight.", correlationId);
    return row;
  });
  return beginOidcLogin(pool, runtimeConfiguration(provider, redirectUri), {
    returnTo, stepUp: true, purpose: "provider_test", identityProviderId: provider.id,
    initiatedByPersonId: principal.principalId, initiatingSessionId: principal.authenticationSessionId
  });
}

export async function approveOrganizationIdentityProvider(pool: Pool, principal: AuthenticatedPrincipal,
  providerId: string, reasonInput: string, correlationId: string): Promise<OrganizationIdentityProviderV1[]> {
  const reason = reasonInput.trim();
  if (reason.length < 3 || reason.length > 1_000) throw authorizationError("VALIDATION_FAILED", "An approval reason is required.", correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireOrganizationAdmin(client, principal, correlationId);
    await requireStepUp(client, principal, correlationId);
    const provider = await loadProviderRow(client, principal.organizationId, providerId, true);
    if (provider.status !== "tested" || provider.tested_at === null) throw authorizationError("INVALID_TRANSITION",
      "A successful test authentication is required before Admin approval.", correlationId);
    const staged = await client.query<{ staged_by: string }>(
      "SELECT staged_by FROM identity.organization_identity_provider_revisions WHERE id=$1", [providerId]);
    if (staged.rows[0]?.staged_by === principal.principalId) throw authorizationError("PERMISSION_DENIED",
      "The person who staged a provider cannot approve it as Organization Admin.", correlationId);
    await client.query(
      `UPDATE identity.organization_identity_provider_revisions
          SET status='approved',approved_by=$3,approved_at=transaction_timestamp()
        WHERE organization_id=$1 AND id=$2 AND status='tested'`,
      [principal.organizationId, providerId, principal.principalId]
    );
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'identity.provider_approved',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `identity_provider:${providerId}`,
        JSON.stringify({ reason, correlationId })]
    );
    return listOrganizationIdentityProviders(client, principal.organizationId);
  });
}

export async function activateOrganizationIdentityProvider(pool: Pool, principal: AuthenticatedPrincipal,
  organizationId: string, providerId: string, reasonInput: string, correlationId: string): Promise<OrganizationIdentityProviderV1[]> {
  const reason = reasonInput.trim();
  if (reason.length < 3 || reason.length > 1_000) throw authorizationError("VALIDATION_FAILED", "An activation reason is required.", correlationId);
  return withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId); await requireStepUp(client, principal, correlationId);
    const provider = await loadProviderRow(client, organizationId, providerId, true);
    if (provider.status !== "approved" || provider.preflighted_at === null || provider.tested_at === null || provider.approved_at === null) {
      throw authorizationError("INVALID_TRANSITION", "Preflight, test authentication, and Organization Admin approval are required before activation.", correlationId);
    }
    if (provider.preflighted_at.getTime() < Date.now() - 24 * 60 * 60 * 1_000) throw authorizationError("INVALID_TRANSITION",
      "Provider preflight is older than 24 hours. Stage a fresh revision before activation.", correlationId);
    const prior = await client.query<{ id: string }>(
      "SELECT id FROM identity.organization_identity_provider_revisions WHERE organization_id=$1 AND status='active' FOR UPDATE",
      [organizationId]
    );
    const priorId = prior.rows[0]?.id ?? null;
    if (priorId !== null) await client.query(
      "UPDATE identity.organization_identity_provider_revisions SET status='superseded' WHERE organization_id=$1 AND id=$2",
      [organizationId, priorId]
    );
    await client.query(
      `UPDATE identity.organization_identity_provider_revisions
          SET status='active',activated_by=$3,activated_at=transaction_timestamp(),suspended_by=NULL,suspended_at=NULL,suspension_reason=NULL
        WHERE organization_id=$1 AND id=$2`, [organizationId, providerId, principal.principalId]
    );
    await audit(client, principal, "platform.identity_provider_activated", organizationId, `identity_provider:${providerId}`,
      correlationId, { activeProviderId: priorId }, { activeProviderId: providerId }, { reason });
    return listOrganizationIdentityProviders(client, organizationId);
  });
}

export async function suspendOrganizationIdentityProvider(pool: Pool, principal: AuthenticatedPrincipal,
  organizationId: string, providerId: string, reasonInput: string, correlationId: string): Promise<OrganizationIdentityProviderV1[]> {
  const reason = reasonInput.trim();
  if (reason.length < 3 || reason.length > 1_000) throw authorizationError("VALIDATION_FAILED", "A suspension reason is required.", correlationId);
  return withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId); await requireStepUp(client, principal, correlationId);
    const provider = await loadProviderRow(client, organizationId, providerId, true);
    if (provider.status !== "active") throw authorizationError("INVALID_TRANSITION", "Only the active provider can be suspended.", correlationId);
    await client.query(`UPDATE identity.organization_identity_provider_revisions
      SET status='suspended',suspended_by=$3,suspended_at=transaction_timestamp(),suspension_reason=$4
      WHERE organization_id=$1 AND id=$2`, [organizationId, providerId, principal.principalId, reason]);
    const revoked = await client.query(`UPDATE identity.authentication_sessions
      SET revoked_at=transaction_timestamp() WHERE organization_id=$1 AND identity_provider_id=$2 AND revoked_at IS NULL`,
      [organizationId, providerId]);
    await audit(client, principal, "platform.identity_provider_suspended", organizationId, `identity_provider:${providerId}`,
      correlationId, { status: "active" }, { status: "suspended" }, { reason, revokedSessionCount: revoked.rowCount ?? 0 });
    return listOrganizationIdentityProviders(client, organizationId);
  });
}

export async function rollbackOrganizationIdentityProvider(pool: Pool, principal: AuthenticatedPrincipal,
  organizationId: string, providerId: string, reasonInput: string, correlationId: string): Promise<OrganizationIdentityProviderV1[]> {
  const reason = reasonInput.trim();
  if (reason.length < 3 || reason.length > 1_000) throw authorizationError("VALIDATION_FAILED", "A rollback reason is required.", correlationId);
  return withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId); await requireStepUp(client, principal, correlationId);
    const target = await loadProviderRow(client, organizationId, providerId, true);
    if (!["superseded", "suspended"].includes(target.status) || target.preflighted_at === null || target.tested_at === null || target.approved_at === null) {
      throw authorizationError("INVALID_TRANSITION", "Rollback requires a previously tested and approved provider revision.", correlationId);
    }
    const current = await client.query<{ id: string }>(
      "SELECT id FROM identity.organization_identity_provider_revisions WHERE organization_id=$1 AND status='active' FOR UPDATE", [organizationId]);
    const currentId = current.rows[0]?.id ?? null;
    if (currentId !== null) await client.query(
      "UPDATE identity.organization_identity_provider_revisions SET status='superseded' WHERE organization_id=$1 AND id=$2",
      [organizationId, currentId]);
    await client.query(`UPDATE identity.organization_identity_provider_revisions
      SET status='active',activated_by=$3,activated_at=transaction_timestamp(),suspended_by=NULL,suspended_at=NULL,suspension_reason=NULL
      WHERE organization_id=$1 AND id=$2`, [organizationId, providerId, principal.principalId]);
    if (currentId !== null) await client.query(`UPDATE identity.authentication_sessions SET revoked_at=transaction_timestamp()
      WHERE organization_id=$1 AND identity_provider_id=$2 AND revoked_at IS NULL`, [organizationId, currentId]);
    await audit(client, principal, "platform.identity_provider_rolled_back", organizationId, `identity_provider:${providerId}`,
      correlationId, { activeProviderId: currentId }, { activeProviderId: providerId }, { reason });
    return listOrganizationIdentityProviders(client, organizationId);
  });
}

export async function resolveOrganizationIdentityProvider(pool: Pool, selector: { slug?: string; domain?: string },
  redirectUri: string, correlationId: string): Promise<OidcProviderConfiguration> {
  const value = (selector.domain ?? selector.slug ?? "").trim().toLowerCase();
  if (value.length === 0 || (selector.domain !== undefined) === (selector.slug !== undefined)) {
    throw authorizationError("VALIDATION_FAILED", "An Organization workspace or verified email domain is required.", correlationId);
  }
  const resolved = await withRestrictedTransaction(pool, async (client) => {
    const result = await client.query<{ organization_id: string; identity_provider_id: string }>(
      "SELECT * FROM identity.resolve_active_identity_provider($1,$2)", [value, selector.domain !== undefined]);
    return result.rows[0];
  });
  if (resolved === undefined) throw authorizationError("NOT_FOUND", "No active identity provider is available for that Organization.", correlationId);
  return withOrganizationTransaction(pool, resolved.organization_id, async (client) =>
    runtimeConfiguration(await loadProviderRow(client, resolved.organization_id, resolved.identity_provider_id), redirectUri));
}

export async function resolveIdentityProviderForLoginState(pool: Pool, state: string, redirectUri: string,
  correlationId: string): Promise<{ configuration: OidcProviderConfiguration; purpose: string } | null> {
  const stateDigest = sha256(state);
  if (!sha256Pattern.test(stateDigest)) return null;
  const resolved = await withRestrictedTransaction(pool, async (client) => {
    const result = await client.query<{ organization_id: string; identity_provider_id: string | null; purpose: string }>(
      "SELECT * FROM identity.resolve_oidc_login_state($1)", [stateDigest]);
    return result.rows[0];
  });
  if (resolved === undefined || resolved.identity_provider_id === null) return null;
  return withOrganizationTransaction(pool, resolved.organization_id, async (client) => ({
    configuration: runtimeConfiguration(await loadProviderRow(client, resolved.organization_id, resolved.identity_provider_id as string), redirectUri),
    purpose: resolved.purpose
  }));
}
