import { createHash, randomBytes } from "node:crypto";
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JSONWebKeySet
} from "jose";

import { authorizationError } from "../errors.js";

export interface OidcProviderConfiguration {
  providerKey: string;
  organizationId: string;
  issuer: string;
  audience: string;
  clientId: string;
  redirectUri: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwks?: JSONWebKeySet;
  jwksUri?: string;
  /** Governed Organization provider revision. Omitted only for recovery/bootstrap identity. */
  identityProviderId?: string;
}

export interface PendingOidcLogin {
  state: string;
  nonce: string;
  codeVerifier: string;
  expiresAt: Date;
}

export interface OidcAuthorizationRequest {
  authorizationUrl: string;
  pending: PendingOidcLogin;
}

export interface OidcAuthorizationOptions {
  stepUp?: boolean;
}

export interface VerifiedOidcIdentity {
  organizationId: string;
  issuer: string;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  authenticationStrength: string;
  expiresAt: Date;
}

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function requireHttps(url: string, field: string): void {
  if (new URL(url).protocol !== "https:") throw new Error(`${field} must use HTTPS`);
}

const remoteKeySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function verificationKeySet(configuration: OidcProviderConfiguration) {
  if (configuration.jwks !== undefined) return createLocalJWKSet(configuration.jwks);
  if (configuration.jwksUri === undefined) throw new Error("jwks or jwksUri is required");
  requireHttps(configuration.jwksUri, "jwksUri");
  let keySet = remoteKeySets.get(configuration.jwksUri);
  if (keySet === undefined) {
    keySet = createRemoteJWKSet(new URL(configuration.jwksUri), {
      timeoutDuration: 5_000,
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60 * 1000
    });
    remoteKeySets.set(configuration.jwksUri, keySet);
  }
  return keySet;
}

export function createOidcAuthorizationRequest(
  configuration: OidcProviderConfiguration,
  now = new Date(),
  options: OidcAuthorizationOptions = {}
): OidcAuthorizationRequest {
  requireHttps(configuration.authorizationEndpoint, "authorizationEndpoint");
  requireHttps(configuration.tokenEndpoint, "tokenEndpoint");

  const state = base64Url(randomBytes(32));
  const nonce = base64Url(randomBytes(32));
  const codeVerifier = base64Url(randomBytes(32));
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const url = new URL(configuration.authorizationEndpoint);
  url.search = new URLSearchParams({
    client_id: configuration.clientId,
    redirect_uri: configuration.redirectUri,
    response_type: "code",
    scope: "openid email",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  }).toString();
  if (options.stepUp === true) {
    url.searchParams.set("prompt", "login");
    url.searchParams.set("acr_values", "mfa");
  }

  return {
    authorizationUrl: url.toString(),
    pending: {
      state,
      nonce,
      codeVerifier,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000)
    }
  };
}

export async function exchangeOidcAuthorizationCode(
  configuration: OidcProviderConfiguration,
  code: string,
  pending: PendingOidcLogin,
  fetcher: FetchLike = fetch
): Promise<string> {
  if (code.length === 0) throw new Error("OIDC authorization code is required");
  const response = await fetcher(configuration.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: configuration.clientId,
      redirect_uri: configuration.redirectUri,
      code_verifier: pending.codeVerifier
    })
  });
  if (!response.ok) throw new Error("OIDC token exchange failed");
  const body: unknown = await response.json();
  if (
    typeof body !== "object" || body === null ||
    !("id_token" in body) || typeof body.id_token !== "string"
  ) throw new Error("OIDC token response did not contain an ID token");
  return body.id_token;
}

export async function verifyOidcIdToken(
  configuration: OidcProviderConfiguration,
  idToken: string,
  expectedNonce: string,
  correlationId: string,
  now = new Date()
): Promise<VerifiedOidcIdentity> {
  try {
    const result = await jwtVerify(idToken, verificationKeySet(configuration), {
      issuer: configuration.issuer,
      audience: configuration.audience,
      algorithms: ["RS256"],
      currentDate: now,
      requiredClaims: ["exp", "iat", "sub", "nonce"]
    });
    if (result.payload.nonce !== expectedNonce) {
      throw authorizationError("UNAUTHENTICATED", "OIDC nonce validation failed.", correlationId);
    }
    const expiration = result.payload.exp;
    if (typeof result.payload.sub !== "string" || result.payload.sub.length === 0 || expiration === undefined) {
      throw authorizationError("UNAUTHENTICATED", "OIDC subject validation failed.", correlationId);
    }
    const authenticationStrength = typeof result.payload.acr === "string"
      ? result.payload.acr
      : Array.isArray(result.payload.amr) ? result.payload.amr.join(" ") : "oidc";
    return {
      organizationId: configuration.organizationId,
      issuer: configuration.issuer,
      subject: result.payload.sub,
      email: typeof result.payload.email === "string" ? result.payload.email.trim().toLowerCase() : null,
      emailVerified: result.payload.email_verified === true,
      authenticationStrength,
      expiresAt: new Date(expiration * 1000)
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AuthorizationError") throw error;
    const code = error instanceof Error && "code" in error ? String(error.code) : "";
    if (code === "ERR_JWT_EXPIRED") {
      throw authorizationError("AUTH_EXPIRED", "The identity token has expired.", correlationId);
    }
    throw authorizationError("UNAUTHENTICATED", "The identity token is invalid.", correlationId);
  }
}
