import assert from "node:assert/strict";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

import {
  AuthorizationError,
  createOidcAuthorizationRequest,
  exchangeOidcAuthorizationCode,
  loadIdentityDeploymentConfiguration,
  verifyOidcIdToken
} from "../dist/index.js";

const issuer = "https://issuer.example";
const audience = "plenum";
const organizationId = "10000000-0000-4000-8000-000000000001";

async function fixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "test-key";
  const configuration = {
    providerKey: "local-test",
    organizationId,
    issuer,
    audience,
    clientId: audience,
    redirectUri: "https://plenum.example/v1/auth/oidc/callback",
    authorizationEndpoint: `${issuer}/authorize`,
    tokenEndpoint: `${issuer}/token`,
    jwks: { keys: [jwk] }
  };
  return { configuration, privateKey };
}

async function token(privateKey, claims = {}, protectedHeader = { alg: "RS256", kid: "test-key" }) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ nonce: "expected-nonce", acr: "urn:mfa", ...claims })
    .setProtectedHeader(protectedHeader)
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject("person-at-issuer")
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);
}

test("PS-110-T01 validates OIDC state, PKCE and server-owned tenant mapping", async () => {
  const { configuration, privateKey } = await fixture();
  const request = createOidcAuthorizationRequest(configuration);
  const authorization = new URL(request.authorizationUrl);
  assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
  assert.equal(authorization.searchParams.get("state"), request.pending.state);
  assert.equal(authorization.searchParams.get("nonce"), request.pending.nonce);

  const idToken = await token(privateKey, {
    nonce: request.pending.nonce,
    organization_id: "hostile-client-tenant",
    organization_roles: ["admin"]
  });
  const verified = await verifyOidcIdToken(
    configuration,
    idToken,
    request.pending.nonce,
    "20000000-0000-4000-8000-000000000001"
  );
  assert.equal(verified.organizationId, organizationId);
  assert.equal(verified.subject, "person-at-issuer");
  assert.equal(verified.authenticationStrength, "urn:mfa");

  let postedBody = "";
  const exchanged = await exchangeOidcAuthorizationCode(
    configuration,
    "authorization-code",
    request.pending,
    async (_url, init) => {
      postedBody = String(init?.body);
      return new Response(JSON.stringify({ id_token: idToken }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  );
  assert.equal(exchanged, idToken);
  assert.match(postedBody, /code_verifier=/);
});

test("PS-110-T01 rejects invalid issuer, audience, nonce and expiry", async () => {
  const { configuration, privateKey } = await fixture();
  const correlationId = "20000000-0000-4000-8000-000000000002";
  const valid = await token(privateKey);

  await assert.rejects(
    verifyOidcIdToken({ ...configuration, issuer: "https://other.example" }, valid, "expected-nonce", correlationId),
    (error) => error instanceof AuthorizationError && error.envelope.error.code === "UNAUTHENTICATED"
  );
  await assert.rejects(
    verifyOidcIdToken({ ...configuration, audience: "other" }, valid, "expected-nonce", correlationId),
    (error) => error instanceof AuthorizationError && error.envelope.error.code === "UNAUTHENTICATED"
  );
  await assert.rejects(
    verifyOidcIdToken(configuration, valid, "wrong-nonce", correlationId),
    (error) => error instanceof AuthorizationError && error.envelope.error.code === "UNAUTHENTICATED"
  );

  const now = Math.floor(Date.now() / 1000);
  const expired = await new SignJWT({ nonce: "expected-nonce" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(issuer).setAudience(audience).setSubject("subject")
    .setIssuedAt(now - 600).setExpirationTime(now - 300).sign(privateKey);
  await assert.rejects(
    verifyOidcIdToken(configuration, expired, "expected-nonce", correlationId),
    (error) => error instanceof AuthorizationError && error.envelope.error.code === "AUTH_EXPIRED"
  );
});

test("ADR-012 loads cloud, self-hosted and air-gapped identity profiles with exact endpoint allowlists", () => {
  const base = {
    PLENUM_IDENTITY_PROVIDER_KEY: "primary",
    PLENUM_ORGANIZATION_ID: organizationId,
    PLENUM_OIDC_ISSUER: "https://identity.plenum.test/realms/plenum",
    PLENUM_OIDC_AUDIENCE: "plenum",
    PLENUM_OIDC_CLIENT_ID: "plenum",
    PLENUM_OIDC_REDIRECT_URI: "https://app.plenum.test/v1/auth/oidc/callback",
    PLENUM_OIDC_AUTHORIZATION_ENDPOINT: "https://identity.plenum.test/realms/plenum/protocol/openid-connect/auth",
    PLENUM_OIDC_TOKEN_ENDPOINT: "https://identity.plenum.test/realms/plenum/protocol/openid-connect/token",
    PLENUM_OIDC_JWKS_URI: "https://identity.plenum.test/realms/plenum/protocol/openid-connect/certs",
    PLENUM_IDENTITY_ALLOWED_ORIGINS: "https://identity.plenum.test"
  };
  for (const profile of ["self_hosted", "air_gapped"]) {
    const configuration = loadIdentityDeploymentConfiguration({ ...base,
      PLENUM_DEPLOYMENT_PROFILE: profile, PLENUM_IDENTITY_PROVIDER: "keycloak" });
    assert.equal(configuration.profile, profile);
    assert.equal(configuration.oidc.jwksUri, base.PLENUM_OIDC_JWKS_URI);
  }
  assert.equal(loadIdentityDeploymentConfiguration({ ...base,
    PLENUM_DEPLOYMENT_PROFILE: "cloud", PLENUM_IDENTITY_PROVIDER: "customer_oidc" }).providerKind, "customer_oidc");
  assert.throws(() => loadIdentityDeploymentConfiguration({ ...base,
    PLENUM_DEPLOYMENT_PROFILE: "air_gapped", PLENUM_IDENTITY_PROVIDER: "customer_oidc" }), /bundled Keycloak/u);
  assert.throws(() => loadIdentityDeploymentConfiguration({ ...base,
    PLENUM_DEPLOYMENT_PROFILE: "cloud", PLENUM_IDENTITY_PROVIDER: "customer_oidc",
    PLENUM_OIDC_TOKEN_ENDPOINT: "https://token.attacker.test/token" }), /not allowlisted/u);
});
