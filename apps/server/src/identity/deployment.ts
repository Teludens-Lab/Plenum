import type { OidcProviderConfiguration } from "./oidc.js";

export type IdentityDeploymentProfile = "cloud" | "self_hosted" | "air_gapped";
export type IdentityProviderKind = "customer_oidc" | "keycloak";

export interface IdentityDeploymentConfiguration {
  profile: IdentityDeploymentProfile;
  providerKind: IdentityProviderKind;
  oidc: OidcProviderConfiguration;
}

type Environment = Record<string, string | undefined>;

function required(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

function exact<T extends string>(value: string, allowed: readonly T[], name: string): T {
  if (!allowed.includes(value as T)) throw new Error(`${name} must be one of ${allowed.join(", ")}`);
  return value as T;
}

function secureUrl(value: string, name: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must use HTTPS`);
  return url;
}

export function loadIdentityDeploymentConfiguration(environment: Environment): IdentityDeploymentConfiguration {
  const profile = exact(required(environment, "PLENUM_DEPLOYMENT_PROFILE"), ["cloud", "self_hosted", "air_gapped"], "PLENUM_DEPLOYMENT_PROFILE");
  const providerKind = exact(required(environment, "PLENUM_IDENTITY_PROVIDER"), ["customer_oidc", "keycloak"], "PLENUM_IDENTITY_PROVIDER");
  if (profile !== "cloud" && providerKind !== "keycloak") {
    throw new Error(`${profile} deployments must use the bundled Keycloak broker`);
  }

  const issuer = secureUrl(required(environment, "PLENUM_OIDC_ISSUER"), "PLENUM_OIDC_ISSUER");
  const authorizationEndpoint = secureUrl(required(environment, "PLENUM_OIDC_AUTHORIZATION_ENDPOINT"), "PLENUM_OIDC_AUTHORIZATION_ENDPOINT");
  const tokenEndpoint = secureUrl(required(environment, "PLENUM_OIDC_TOKEN_ENDPOINT"), "PLENUM_OIDC_TOKEN_ENDPOINT");
  const jwksUri = secureUrl(required(environment, "PLENUM_OIDC_JWKS_URI"), "PLENUM_OIDC_JWKS_URI");
  secureUrl(required(environment, "PLENUM_OIDC_REDIRECT_URI"), "PLENUM_OIDC_REDIRECT_URI");
  const allowedOrigins = new Set(required(environment, "PLENUM_IDENTITY_ALLOWED_ORIGINS").split(",").map((value) => secureUrl(value.trim(), "PLENUM_IDENTITY_ALLOWED_ORIGINS").origin));
  for (const endpoint of [issuer, authorizationEndpoint, tokenEndpoint, jwksUri]) {
    if (!allowedOrigins.has(endpoint.origin)) throw new Error(`Identity endpoint origin ${endpoint.origin} is not allowlisted`);
  }
  if (profile === "air_gapped" && [...allowedOrigins].some((origin) => origin !== issuer.origin)) {
    throw new Error("Air-gapped identity endpoints must remain on the exact local Keycloak origin");
  }

  return {
    profile,
    providerKind,
    oidc: {
      providerKey: required(environment, "PLENUM_IDENTITY_PROVIDER_KEY"),
      organizationId: required(environment, "PLENUM_ORGANIZATION_ID"),
      issuer: issuer.toString().replace(/\/$/u, ""),
      audience: required(environment, "PLENUM_OIDC_AUDIENCE"),
      clientId: required(environment, "PLENUM_OIDC_CLIENT_ID"),
      redirectUri: required(environment, "PLENUM_OIDC_REDIRECT_URI"),
      authorizationEndpoint: authorizationEndpoint.toString(),
      tokenEndpoint: tokenEndpoint.toString(),
      jwksUri: jwksUri.toString()
    }
  };
}
