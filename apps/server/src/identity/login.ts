import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { OrganizationRole } from "@plenum/policy-engine";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import { linkOrganizationWorkforceOidcIdentity } from "./organization-workforce.js";
import {
  createOidcAuthorizationRequest,
  exchangeOidcAuthorizationCode,
  verifyOidcIdToken,
  type FetchLike,
  type OidcProviderConfiguration,
  type PendingOidcLogin,
  type VerifiedOidcIdentity
} from "./oidc.js";

export const OIDC_CALLBACK_CONTRACT_ID = "oidc-callback-v1";

export interface AuthenticatedPrincipal {
  authenticationSessionId: string;
  principalId: string;
  organizationId: string;
  organizationRoles: OrganizationRole[];
  authenticationStrength: string;
  expiresAt: Date;
  returnTo?: string;
  preserveSession?: boolean;
}

export interface BeginOidcLoginOptions {
  platformAdministratorInvitationToken?: string;
  returnTo?: string;
  stepUp?: boolean;
  purpose?: "sign_in" | "provider_test" | "platform_recovery";
  identityProviderId?: string;
  initiatedByPersonId?: string;
  initiatingSessionId?: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function validateOidcReturnTo(value: string, publicUrl: string): string {
  const invalid = () => new Error("OIDC returnTo must be a same-origin path");
  if (value.length > 2_000 || !value.startsWith("/") || value.startsWith("//") ||
      /[\\\u0000-\u001f\u007f]/u.test(value) || /%(?:5c|0[0-9a-f]|1[0-9a-f]|7f)/iu.test(value)) throw invalid();
  const origin = new URL(publicUrl).origin;
  const destination = new URL(value, origin);
  const path = `${destination.pathname}${destination.search}${destination.hash}`;
  if (destination.origin !== origin || path.startsWith("//")) throw invalid();
  return path;
}

const browserCredentialPattern = /^[A-Za-z0-9_-]{43}$/u;

export function oidcLoginCookie(state: string, credential?: string): string {
  if (!browserCredentialPattern.test(state) ||
      (credential !== undefined && !browserCredentialPattern.test(credential))) throw new Error("Invalid OIDC transaction cookie");
  // __Host- prevents sibling domains from planting a transaction cookie.
  return `__Host-plenum_login_${state}=${credential ?? ""}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${credential === undefined ? 0 : 300}`;
}

export function readOidcLoginCookie(state: string, header?: string): string | undefined {
  if (!browserCredentialPattern.test(state)) return undefined;
  const name = `__Host-plenum_login_${state}=`;
  const matches = header?.split(";").map((part) => part.trim()).filter((part) => part.startsWith(name)) ?? [];
  const value = matches.length === 1 ? matches[0]?.slice(name.length) : undefined;
  return value !== undefined && browserCredentialPattern.test(value) ? value : undefined;
}

export async function beginOidcLogin(
  pool: Pool,
  configuration: OidcProviderConfiguration,
  options: BeginOidcLoginOptions = {},
  now = new Date()
): Promise<{ authorizationUrl: string; state: string; browserCredential: string }> {
  const returnTo = options.returnTo === undefined ? null : validateOidcReturnTo(options.returnTo, configuration.redirectUri);
  const browserCredential = randomBytes(32).toString("base64url");
  if (options.platformAdministratorInvitationToken !== undefined &&
      !/^[A-Za-z0-9_-]{43}$/u.test(options.platformAdministratorInvitationToken)) {
    throw authorizationError("INVALID_TRANSITION", "The Platform Administrator invitation is invalid or expired.", randomUUID());
  }
  const request = createOidcAuthorizationRequest(configuration, now,
    options.stepUp === undefined ? {} : { stepUp: options.stepUp });
  await withOrganizationTransaction(pool, configuration.organizationId, async (client) => {
    let platformAdministratorInvitationId: string | null = null;
    if (options.platformAdministratorInvitationToken !== undefined) {
      const invitation = await client.query<{ invitation_id: string | null }>(
        "SELECT identity.resolve_platform_administrator_invitation($1,$2) AS invitation_id",
        [configuration.organizationId, sha256(options.platformAdministratorInvitationToken)]
      );
      platformAdministratorInvitationId = invitation.rows[0]?.invitation_id ?? null;
      if (platformAdministratorInvitationId === null) {
        throw authorizationError("INVALID_TRANSITION", "The Platform Administrator invitation is invalid or expired.", randomUUID());
      }
    }
    await client.query(
      `INSERT INTO identity.oidc_login_attempts
         (id, organization_id, provider_key, state_sha256, nonce, code_verifier, expires_at,
          platform_administrator_invitation_id,return_to,identity_provider_id,purpose,
          initiated_by_person_id,initiating_session_id,browser_credential_sha256)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        randomUUID(),
        configuration.organizationId,
        configuration.providerKey,
        sha256(request.pending.state),
        request.pending.nonce,
        request.pending.codeVerifier,
        request.pending.expiresAt,
        platformAdministratorInvitationId,
        returnTo,
        options.identityProviderId ?? configuration.identityProviderId ?? null,
        options.purpose ?? "sign_in",
        options.initiatedByPersonId ?? null,
        options.initiatingSessionId ?? null,
        sha256(browserCredential)
      ]
    );
  });
  return { authorizationUrl: request.authorizationUrl, state: request.pending.state, browserCredential };
}

async function consumeLoginAttempt(
  pool: Pool,
  configuration: OidcProviderConfiguration,
  state: string,
  browserCredential: string,
  correlationId: string,
  now: Date
): Promise<PendingOidcLogin & { platformAdministratorInvitationId: string | null; returnTo: string | null;
  identityProviderId: string | null; purpose: "sign_in" | "provider_test" | "platform_recovery";
  initiatedByPersonId: string | null; initiatingSessionId: string | null }> {
  const pending = await withOrganizationTransaction(pool, configuration.organizationId, async (client) => {
    const result = await client.query<{
      nonce: string;
      code_verifier: string;
      expires_at: Date;
      platform_administrator_invitation_id: string | null;
      return_to: string | null;
      identity_provider_id: string | null;
      purpose: "sign_in" | "provider_test" | "platform_recovery";
      initiated_by_person_id: string | null;
      initiating_session_id: string | null;
    }>(
      `WITH pending AS (
         SELECT id, nonce, code_verifier, expires_at, platform_administrator_invitation_id, return_to,
                identity_provider_id,purpose,initiated_by_person_id,initiating_session_id
           FROM identity.oidc_login_attempts
          WHERE organization_id = $1
            AND provider_key = $2
            AND state_sha256 = $3
            AND consumed_at IS NULL
            AND browser_credential_sha256 = $4
          FOR UPDATE
       ), consumed AS (
         UPDATE identity.oidc_login_attempts attempt
            SET consumed_at = transaction_timestamp(), nonce = '', code_verifier = '', browser_credential_sha256 = NULL
           FROM pending
          WHERE attempt.id = pending.id
      RETURNING pending.nonce, pending.code_verifier, pending.expires_at,
                pending.platform_administrator_invitation_id,pending.return_to,pending.identity_provider_id,
                pending.purpose,pending.initiated_by_person_id,pending.initiating_session_id
       )
       SELECT nonce,code_verifier,expires_at,platform_administrator_invitation_id,return_to,identity_provider_id,
              purpose,initiated_by_person_id,initiating_session_id FROM consumed`,
      [configuration.organizationId, configuration.providerKey, sha256(state), sha256(browserCredential)]
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw authorizationError("UNAUTHENTICATED", "The OIDC login state is invalid or expired.", correlationId);
    }
    return { state, nonce: row.nonce, codeVerifier: row.code_verifier, expiresAt: row.expires_at,
      platformAdministratorInvitationId: row.platform_administrator_invitation_id, returnTo: row.return_to,
      identityProviderId: row.identity_provider_id, purpose: row.purpose,
      initiatedByPersonId: row.initiated_by_person_id, initiatingSessionId: row.initiating_session_id };
  });
  // Commit credential erasure even when the matching transaction has expired.
  if (pending.expiresAt <= now) throw authorizationError("UNAUTHENTICATED", "The OIDC login state is invalid or expired.", correlationId);
  return pending;
}

async function recordAuthenticatedPrincipal(
  client: PoolClient,
  identity: VerifiedOidcIdentity,
  correlationId: string,
  platformAdministratorInvitationId: string | null,
  identityProviderId: string | null
): Promise<AuthenticatedPrincipal> {
  let mapping = await client.query<{
    person_id: string;
    organization_roles: OrganizationRole[];
  }>(
    `SELECT f.person_id,
            COALESCE(array_agg(m.organization_role ORDER BY m.organization_role)
              FILTER (WHERE m.organization_role IS NOT NULL),ARRAY[]::text[])::text[] AS organization_roles
       FROM identity.federated_identities f
       JOIN identity.organizations organization
         ON organization.id = f.organization_id
        AND organization.lifecycle_status = 'active'
       LEFT JOIN identity.memberships m
         ON m.organization_id = f.organization_id
        AND m.person_id = f.person_id
      WHERE f.organization_id = $1
        AND f.issuer = $2
        AND f.subject = $3
        AND f.provider_type = 'oidc'
        AND (
          (m.person_id IS NOT NULL AND identity.person_has_active_organization_access(f.organization_id,f.person_id))
          OR ($4::uuid IS NULL AND identity.person_is_active_platform_administrator(f.person_id))
        )
      GROUP BY f.person_id`,
    [identity.organizationId, identity.issuer, identity.subject, identityProviderId]
  );
  let linked = mapping.rows[0];
  if (linked === undefined && identity.email !== null && identity.emailVerified) {
    if (platformAdministratorInvitationId === null) {
      await client.query(
        `SELECT identity.link_accepted_first_admin_oidc_identity($1,$2,$3,$4,$5,$6)`,
        [identity.organizationId, identity.issuer, identity.subject, sha256(identity.subject), identity.email, correlationId]
      );
    } else {
      await client.query(
        `SELECT identity.link_platform_administrator_oidc_identity($1,$2,$3,$4,$5,$6,$7)`,
        [platformAdministratorInvitationId, identity.organizationId, identity.issuer, identity.subject,
          sha256(identity.subject), identity.email, correlationId]
      );
    }
    await linkOrganizationWorkforceOidcIdentity(client, identity, identityProviderId, correlationId);
    mapping = await client.query<{
      person_id: string;
      organization_roles: OrganizationRole[];
    }>(
      `SELECT f.person_id,
              COALESCE(array_agg(m.organization_role ORDER BY m.organization_role)
                FILTER (WHERE m.organization_role IS NOT NULL),ARRAY[]::text[])::text[] AS organization_roles
         FROM identity.federated_identities f
         JOIN identity.organizations organization
           ON organization.id = f.organization_id
          AND organization.lifecycle_status = 'active'
         LEFT JOIN identity.memberships m
           ON m.organization_id = f.organization_id
          AND m.person_id = f.person_id
        WHERE f.organization_id = $1 AND f.issuer = $2 AND f.subject = $3 AND f.provider_type = 'oidc'
          AND (
            (m.person_id IS NOT NULL AND identity.person_has_active_organization_access(f.organization_id,f.person_id))
            OR ($4::uuid IS NULL AND identity.person_is_active_platform_administrator(f.person_id))
          )
        GROUP BY f.person_id`,
      [identity.organizationId, identity.issuer, identity.subject, identityProviderId]
    );
    linked = mapping.rows[0];
  }
  if (linked === undefined) {
    throw authorizationError("UNAUTHENTICATED", "The identity is not linked to this Organization.", correlationId);
  }

  const authenticationSessionId = randomUUID();
  await client.query(
    `INSERT INTO identity.authentication_sessions
       (id, organization_id, person_id, issuer, subject, authentication_strength, expires_at,identity_provider_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7,$8)`,
    [
      authenticationSessionId,
      identity.organizationId,
      linked.person_id,
      identity.issuer,
      identity.subject,
      identity.authenticationStrength,
      identity.expiresAt,
      identityProviderId
    ]
  );
  await client.query(
    `UPDATE identity.federated_identities
        SET last_authenticated_at = transaction_timestamp(),
            identity_provider_id=COALESCE($4,identity_provider_id),
            verified_email=CASE WHEN $5::boolean THEN $6 ELSE verified_email END
      WHERE organization_id = $1 AND issuer = $2 AND subject = $3`,
    [identity.organizationId, identity.issuer, identity.subject, identityProviderId, identity.emailVerified, identity.email]
  );
  await client.query(
    `INSERT INTO evidence.audit_records
       (id, organization_id, actor_person_id, action, target_ref, details)
     VALUES ($1, $2, $3, 'identity.oidc_authenticated', $4, $5::jsonb)`,
    [
      randomUUID(),
      identity.organizationId,
      linked.person_id,
      `authentication_session:${authenticationSessionId}`,
      JSON.stringify({ issuer: identity.issuer, correlationId })
    ]
  );

  return {
    authenticationSessionId,
    principalId: linked.person_id,
    organizationId: identity.organizationId,
    organizationRoles: linked.organization_roles,
    authenticationStrength: identity.authenticationStrength,
    expiresAt: identity.expiresAt
  };
}

async function recordProviderTest(
  client: PoolClient,
  identity: VerifiedOidcIdentity,
  correlationId: string,
  identityProviderId: string,
  initiatedByPersonId: string,
  initiatingSessionId: string
): Promise<AuthenticatedPrincipal> {
  if (!identity.emailVerified || identity.email === null) throw authorizationError("UNAUTHENTICATED",
    "Provider test authentication requires a verified email claim.", correlationId);
  const actor = await client.query<{
    display_name: string;
    expires_at: Date;
    authentication_strength: string;
    organization_roles: OrganizationRole[];
    expected_email: string | null;
  }>(
    `SELECT person.display_name,session.expires_at,session.authentication_strength,
            array_agg(membership.organization_role ORDER BY membership.organization_role)::text[] AS organization_roles,
            COALESCE(
              (SELECT invitation.email FROM identity.first_admin_invitations invitation
                WHERE invitation.organization_id=$1 AND invitation.accepted_person_id=$2
                ORDER BY invitation.accepted_at DESC LIMIT 1),
              (SELECT federated.verified_email FROM identity.federated_identities federated
                WHERE federated.organization_id=$1 AND federated.person_id=$2 AND federated.verified_email IS NOT NULL
                ORDER BY federated.last_authenticated_at DESC NULLS LAST LIMIT 1)
            ) AS expected_email
       FROM identity.authentication_sessions session
       JOIN identity.persons person ON person.id=session.person_id
       JOIN identity.memberships membership ON membership.organization_id=session.organization_id
        AND membership.person_id=session.person_id
      WHERE session.organization_id=$1 AND session.person_id=$2 AND session.id=$3
        AND session.revoked_at IS NULL AND session.expires_at>transaction_timestamp()
        AND membership.organization_role='admin'
        AND identity.platform_session_is_step_up($2,$3)
      GROUP BY person.display_name,session.expires_at,session.authentication_strength`,
    [identity.organizationId, initiatedByPersonId, initiatingSessionId]
  );
  const admin = actor.rows[0];
  if (admin === undefined || admin.expected_email !== identity.email) throw authorizationError("PERMISSION_DENIED",
    "Provider test identity must match the initiating Organization Admin's verified email.", correlationId);
  const eligible = await client.query<{ eligible: boolean }>(
    `SELECT identity.identity_provider_accepts_email_domain($1,$2,split_part($3,'@',2)) AS eligible`,
    [identity.organizationId, identityProviderId, identity.email]
  );
  if (eligible.rows[0]?.eligible !== true) throw authorizationError("PERMISSION_DENIED",
    "The tested identity email domain is not bound to this provider revision.", correlationId);
  const linked = await client.query<{ linked: boolean }>(
    "SELECT identity.link_tested_identity_provider($1,$2,$3,$4,$5,$6) AS linked",
    [identity.organizationId, identityProviderId, initiatedByPersonId, identity.issuer, identity.subject, identity.email]
  );
  if (linked.rows[0]?.linked !== true) throw authorizationError("TARGET_EXISTS",
    "That provider identity is already linked to another person or is no longer eligible.", correlationId);
  const updated = await client.query(
    `UPDATE identity.organization_identity_provider_revisions
        SET status='tested',tested_by=$3,tested_at=transaction_timestamp()
      WHERE organization_id=$1 AND id=$2 AND status='preflight_passed'`,
    [identity.organizationId, identityProviderId, initiatedByPersonId]
  );
  if (updated.rowCount !== 1) throw authorizationError("INVALID_TRANSITION", "Provider test state changed before completion.", correlationId);
  await client.query(
    `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
     VALUES ($1,$2,$3,'identity.provider_test_succeeded',$4,$5::jsonb)`,
    [randomUUID(), identity.organizationId, initiatedByPersonId, `identity_provider:${identityProviderId}`,
      JSON.stringify({ issuer: identity.issuer, correlationId })]
  );
  return { authenticationSessionId: initiatingSessionId, principalId: initiatedByPersonId,
    organizationId: identity.organizationId, organizationRoles: admin.organization_roles,
    authenticationStrength: admin.authentication_strength, expiresAt: admin.expires_at,
    preserveSession: true };
}

export async function completeOidcLogin(
  pool: Pool,
  configuration: OidcProviderConfiguration,
  input: { code: string; state: string; browserCredential?: string; correlationId: string },
  fetcher: FetchLike = fetch,
  now = new Date()
): Promise<AuthenticatedPrincipal> {
  if (!browserCredentialPattern.test(input.state) || input.browserCredential === undefined ||
      !browserCredentialPattern.test(input.browserCredential)) {
    throw authorizationError("UNAUTHENTICATED", "The OIDC login state is invalid or expired.", input.correlationId);
  }
  const pending = await consumeLoginAttempt(
    pool,
    configuration,
    input.state,
    input.browserCredential,
    input.correlationId,
    now
  );
  const idToken = await exchangeOidcAuthorizationCode(configuration, input.code, pending, fetcher);
  const identity = await verifyOidcIdToken(
    configuration,
    idToken,
    pending.nonce,
    input.correlationId,
    now
  );
  const principal = await withOrganizationTransaction(pool, configuration.organizationId, (client) => {
    if (pending.purpose === "provider_test") {
      if (pending.identityProviderId === null || pending.initiatedByPersonId === null || pending.initiatingSessionId === null) {
        throw authorizationError("UNAUTHENTICATED", "Provider test state is incomplete.", input.correlationId);
      }
      return recordProviderTest(client, identity, input.correlationId, pending.identityProviderId,
        pending.initiatedByPersonId, pending.initiatingSessionId);
    }
    return recordAuthenticatedPrincipal(client, identity, input.correlationId,
      pending.platformAdministratorInvitationId, pending.identityProviderId);
  });
  return { ...principal, ...(pending.returnTo === null ? {} : { returnTo: pending.returnTo }) };
}

export async function revokeAuthenticationSession(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  correlationId: string
): Promise<void> {
  await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const result = await client.query(
      `UPDATE identity.authentication_sessions
          SET revoked_at = transaction_timestamp()
        WHERE id = $1 AND organization_id = $2 AND person_id = $3 AND revoked_at IS NULL`,
      [principal.authenticationSessionId, principal.organizationId, principal.principalId]
    );
    if (result.rowCount !== 1) {
      throw authorizationError("NOT_FOUND", "The Authentication Session was not found.", correlationId);
    }
    await client.query(
      `UPDATE sync.projection_grants g
          SET revoked_at = transaction_timestamp()
         FROM runtime.participants p
        WHERE g.organization_id = $1
          AND g.participant_id = p.id
          AND p.organization_id = $1
          AND p.person_id = $2
          AND g.revoked_at IS NULL`,
      [principal.organizationId, principal.principalId]
    );
    await client.query(
      `INSERT INTO evidence.audit_records
         (id, organization_id, actor_person_id, action, target_ref, details)
       VALUES ($1, $2, $3, 'identity.session_revoked', $4, $5::jsonb)`,
      [
        randomUUID(),
        principal.organizationId,
        principal.principalId,
        `authentication_session:${principal.authenticationSessionId}`,
        JSON.stringify({ correlationId })
      ]
    );
  });
}
