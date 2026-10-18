import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { OrganizationRole } from "@plenum/policy-engine";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
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
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function beginOidcLogin(
  pool: Pool,
  configuration: OidcProviderConfiguration,
  now = new Date()
): Promise<{ authorizationUrl: string; state: string }> {
  const request = createOidcAuthorizationRequest(configuration, now);
  await withOrganizationTransaction(pool, configuration.organizationId, async (client) => {
    await client.query(
      `INSERT INTO identity.oidc_login_attempts
         (id, organization_id, provider_key, state_sha256, nonce, code_verifier, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        configuration.organizationId,
        configuration.providerKey,
        sha256(request.pending.state),
        request.pending.nonce,
        request.pending.codeVerifier,
        request.pending.expiresAt
      ]
    );
  });
  return { authorizationUrl: request.authorizationUrl, state: request.pending.state };
}

async function consumeLoginAttempt(
  pool: Pool,
  configuration: OidcProviderConfiguration,
  state: string,
  correlationId: string,
  now: Date
): Promise<PendingOidcLogin> {
  return withOrganizationTransaction(pool, configuration.organizationId, async (client) => {
    const result = await client.query<{
      nonce: string;
      code_verifier: string;
      expires_at: Date;
    }>(
      `WITH pending AS (
         SELECT id, nonce, code_verifier, expires_at
           FROM identity.oidc_login_attempts
          WHERE organization_id = $1
            AND provider_key = $2
            AND state_sha256 = $3
            AND consumed_at IS NULL
            AND expires_at > $4
          FOR UPDATE
       ), consumed AS (
         UPDATE identity.oidc_login_attempts attempt
            SET consumed_at = transaction_timestamp(), nonce = '', code_verifier = ''
           FROM pending
          WHERE attempt.id = pending.id
      RETURNING pending.nonce, pending.code_verifier, pending.expires_at
       )
       SELECT nonce, code_verifier, expires_at FROM consumed`,
      [configuration.organizationId, configuration.providerKey, sha256(state), now]
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw authorizationError("UNAUTHENTICATED", "The OIDC login state is invalid or expired.", correlationId);
    }
    return { state, nonce: row.nonce, codeVerifier: row.code_verifier, expiresAt: row.expires_at };
  });
}

async function recordAuthenticatedPrincipal(
  client: PoolClient,
  identity: VerifiedOidcIdentity,
  correlationId: string
): Promise<AuthenticatedPrincipal> {
  const mapping = await client.query<{
    person_id: string;
    organization_roles: OrganizationRole[];
  }>(
    `SELECT f.person_id,
            array_agg(m.organization_role ORDER BY m.organization_role)::text[] AS organization_roles
       FROM identity.federated_identities f
       JOIN identity.memberships m
         ON m.organization_id = f.organization_id
        AND m.person_id = f.person_id
      WHERE f.organization_id = $1
        AND f.issuer = $2
        AND f.subject = $3
        AND f.provider_type = 'oidc'
      GROUP BY f.person_id`,
    [identity.organizationId, identity.issuer, identity.subject]
  );
  const linked = mapping.rows[0];
  if (linked === undefined) {
    throw authorizationError("UNAUTHENTICATED", "The identity is not linked to this Organization.", correlationId);
  }

  const authenticationSessionId = randomUUID();
  await client.query(
    `INSERT INTO identity.authentication_sessions
       (id, organization_id, person_id, issuer, subject, authentication_strength, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      authenticationSessionId,
      identity.organizationId,
      linked.person_id,
      identity.issuer,
      identity.subject,
      identity.authenticationStrength,
      identity.expiresAt
    ]
  );
  await client.query(
    `UPDATE identity.federated_identities
        SET last_authenticated_at = transaction_timestamp()
      WHERE organization_id = $1 AND issuer = $2 AND subject = $3`,
    [identity.organizationId, identity.issuer, identity.subject]
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

export async function completeOidcLogin(
  pool: Pool,
  configuration: OidcProviderConfiguration,
  input: { code: string; state: string; correlationId: string },
  fetcher: FetchLike = fetch,
  now = new Date()
): Promise<AuthenticatedPrincipal> {
  const pending = await consumeLoginAttempt(
    pool,
    configuration,
    input.state,
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
  return withOrganizationTransaction(pool, configuration.organizationId, (client) =>
    recordAuthenticatedPrincipal(client, identity, input.correlationId)
  );
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
