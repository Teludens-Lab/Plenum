import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

import {
  AuthorizationError,
  classifyDeploymentRequest,
  createOidcAuthorizationRequest,
  exchangeOidcAuthorizationCode,
  loadIdentityDeploymentConfiguration,
  validateIdentityProviderMetadata,
  verifyOidcIdToken
} from "../dist/index.js";
import { resolveRuntimeInterfaceProfile } from "../dist/runtime/artifact-workflow.js";
import { artifactFieldAccess, visibleArtifactForm, visibleArtifactPayload, preserveProtectedArtifactValues } from "../dist/runtime/artifact-visibility.js";
import { createPlatformOrganization, updatePlatformOrganizationProvisioning } from "../dist/platform/provisioning.js";

const provisioningInput = {
  name: "Synthetic Organization", slug: "synthetic-organization", legalName: "Synthetic Organization Ltd",
  countryCode: "US", timeZone: "America/New_York", deploymentProfile: "cloud", dataResidencyRegion: "us-east-2",
  entitlements: ["studio_authoring", "session_delivery"], supportContact: "support@example.test"
};
const databaseReached = new Error("validation passed; database access intentionally unavailable");
const validationPool = { async connect() { throw databaseReached; } };
const validationPrincipal = { principalId: "synthetic-person", organizationId: "synthetic-organization" };
const provisioningOperations = [
  (input) => createPlatformOrganization(validationPool, validationPrincipal, input, "validation-test"),
  (input) => updatePlatformOrganizationProvisioning(validationPool, validationPrincipal, "synthetic-organization", input, "validation-test")
];

test("Organization create and update identify the invalid provisioning field before database access", async () => {
  for (const operation of provisioningOperations) {
    for (const [field, value, message] of [
      ["legalName", "x", /^Legal name/u],
      ["countryCode", "USA", /^Country code.*two letters/u],
      ["timeZone", "Eastern time", /^Time zone.*America\/New_York/u],
      ["deploymentProfile", "unknown", /^Select a deployment profile/u],
      ["dataResidencyRegion", "", /^Data residency region.*us-east-2/u],
      ["dataResidencyRegion", "r".repeat(121), /^Data residency region/u],
      ["entitlements", [], /^Select at least one enabled capability/u],
      ["entitlements", ["Studio authoring"], /^Capability keys.*Leave additional keys blank/u],
      ["entitlements", ["a"], /^Capability keys/u],
      ["entitlements", ["a".repeat(81)], /^Capability keys/u],
      ["supportContact", "", /^Support contact/u],
      ["securityContact", "x".repeat(321), /^Security contact/u]
    ]) {
      await assert.rejects(operation({ ...provisioningInput, [field]: value }), (error) =>
        error instanceof AuthorizationError && error.envelope.error.code === "VALIDATION_FAILED" && message.test(error.message), field);
    }
  }
});

test("Organization provisioning accepts normalized examples and existing field boundaries", async () => {
  for (const operation of provisioningOperations) {
    for (const input of [provisioningInput, { ...provisioningInput, countryCode: " us ", timeZone: " America/Indiana/Indianapolis ",
      entitlements: [" STUDIO_AUTHORING ", "session_delivery"], securityContact: "" },
    { ...provisioningInput, timeZone: "UTC", legalName: "a".repeat(300), dataResidencyRegion: "r".repeat(120),
      entitlements: ["ab", "a".repeat(80)], supportContact: "s".repeat(320), securityContact: "s".repeat(320) }]) {
      await assert.rejects(operation(input), (error) => error === databaseReached);
    }
  }
});

test("Organization creation identifies invalid names and workspace addresses", async () => {
  for (const [field, value, message] of [["name", "x", /^Organization name/u], ["slug", "two words", /^Workspace address/u]]) {
    await assert.rejects(provisioningOperations[0]({ ...provisioningInput, [field]: value }),
      (error) => error instanceof AuthorizationError && message.test(error.message));
  }
});

test("PS-830-T06 protected record fields are omitted and survive authorized edits without a value oracle", () => {
  const allows = artifactFieldAccess([{ fieldsExcluded: ["secret", "nested.private", "items.private"] }]);
  const payload = { title: "Visible", secret: "Protected", nested: { public: 1, private: 2 }, items: [{ public: 3, private: 4 }] };
  const visible = { title: "Visible", nested: { public: 1 }, items: [{ public: 3 }] };
  assert.deepEqual(visibleArtifactPayload(payload, allows), visible);
  assert.deepEqual(preserveProtectedArtifactValues(payload, { ...visible, title: "Edited" }, allows), { ...payload, title: "Edited" });
  for (const next of [{ ...visible, secret: "Protected" }, { ...visible, secret: "Wrong" }, { ...visible, nested: null },
    { ...visible, items: [] }, { ...visible, items: [{ private: 4 }] }]) assert.throws(() => preserveProtectedArtifactValues(payload, next, allows));
  assert.deepEqual(preserveProtectedArtifactValues({ optional: { public: 1 } }, {}, allows), {});
  assert.deepEqual(preserveProtectedArtifactValues(payload, { title: "Only title" }, allows), {
    title: "Only title", secret: "Protected", nested: { private: 2 }, items: [{ private: 4 }]
  });
  assert.deepEqual(visibleArtifactPayload(payload, artifactFieldAccess([{ fieldsExcluded: ["secret"] }, {}])), payload);
  assert.deepEqual(visibleArtifactPayload(payload, artifactFieldAccess([])), {});
  const form = { id: "f", name: "Form", formVersion: "2", sections: [{ id: "s", fields: [
    { id: "title", key: "title", type: "short_text", label: "Title" }, { id: "secret", key: "secret", type: "short_text", label: "Secret", defaultValue: "Protected" },
    { id: "condition", key: "condition", type: "short_text", label: "Conditional", visibleWhen: { field: "secret", operator: "present" } }
  ] }], rules: [{ message: "Protected" }] };
  const projected = visibleArtifactForm(form, allows);
  assert.deepEqual(projected.sections[0].fields.map(({ key }) => key), ["title"]);
  assert.equal(JSON.stringify(projected).includes("Protected"), false);
  assert.equal(form.sections[0].fields.length, 3);
});

const issuer = "https://issuer.example";
const audience = "plenum";
const organizationId = "10000000-0000-4000-8000-000000000001";
const fracturedOrderRelease = JSON.parse(readFileSync(
  new URL("../../../definitions/fractured-order/fractured-order-release.json", import.meta.url), "utf8"
));

test("PS-770 Runtime Interface Profiles preserve authored role navigation and region order", () => {
  const scribe = resolveRuntimeInterfaceProfile(fracturedOrderRelease, "scribe", "orientation", "correlation", "blue");
  const facilitator = resolveRuntimeInterfaceProfile(fracturedOrderRelease, "facilitator", "orientation", "correlation", "blue");
  const control = resolveRuntimeInterfaceProfile(fracturedOrderRelease, "white_cell", "orientation", "correlation", null);
  assert.deepEqual(scribe?.navigationItems.map(({ label }) => label), ["Actions", "RFIs", "Responses", "Received Proposals", "Notifications", "Quick Capture", "Session Timeline", "Tribe Street Journal", "Verba AI Population Sentiments"]);
  assert.deepEqual(scribe?.regions[0]?.moduleIds, ["task-list", "orientation-form", "artifact-form"]);
  assert.deepEqual(facilitator?.navigationItems.map(({ label }) => label), ["Team Action Review", "RFIs", "Communications", "Received Proposals", "Deck", "Present", "Notifications", "Session Timeline", "Tribe Street Journal", "Verba AI Population Sentiments"]);
  assert.deepEqual(facilitator?.regions.find(({ id }) => id === "presentation")?.moduleIds, ["artifact-presentation"]);
  assert.equal(control?.navigationItems[0]?.label, "Simulation Settings");
  for (const resolved of [scribe, facilitator, control]) {
    const authored = fracturedOrderRelease.coreDesign.interfaces.find(({ id }) => id === resolved.id);
    assert.deepEqual(resolved.regions.map(({ id }) => id), authored.layout.regions.map(({ id }) => id));
    assert.equal(resolved.defaultNavigationItemId, authored.navigation.defaultItemId);
  }
});

function request(url, headers = {}, remoteAddress = "192.0.2.10") {
  return { url, headers, socket: { remoteAddress } };
}

test("PS-550-T01 applies the approved route-specific request limits without trusting forwarded addresses by default", () => {
  assert.deepEqual(classifyDeploymentRequest(request("/healthz")), null);
  assert.deepEqual(classifyDeploymentRequest(request("/auth/login", { "x-forwarded-for": "198.51.100.7" })),
    { category: "authentication", limit: 10, scope: "ip:192.0.2.10" });
  assert.deepEqual(classifyDeploymentRequest(request("/auth/login", { "x-forwarded-for": "198.51.100.7" }), true),
    { category: "authentication", limit: 10, scope: "ip:198.51.100.7" });
  assert.deepEqual(classifyDeploymentRequest(request("/v1/sessions/session-a/commands", { authorization: "Bearer token-a" })),
    { category: "session_command", limit: 120, scope: "session:session-a" });
  assert.deepEqual(classifyDeploymentRequest(request("/v1/uploads", { cookie: "plenum_session=token-a" })),
    { category: "upload", limit: 5, scope: "session-token:token-a" });
  assert.deepEqual(classifyDeploymentRequest(request("/v1/projects/project-a/draft", { cookie: "plenum_session=token-a" })),
    { category: "general", limit: 300, scope: "session-token:token-a" });
});

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
  assert.equal(authorization.searchParams.get("scope"), "openid email");
  const stepUpAuthorization = new URL(createOidcAuthorizationRequest(configuration, new Date(), { stepUp: true }).authorizationUrl);
  assert.equal(stepUpAuthorization.searchParams.get("prompt"), "login");
  assert.equal(stepUpAuthorization.searchParams.get("acr_values"), "mfa");

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
  assert.equal(verified.email, null);
  assert.equal(verified.emailVerified, false);

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

test("CONTROL-PLANE-T02 validates OIDC and brokered-SAML discovery without trusting metadata input", async () => {
  const signingCertificate = Buffer.alloc(96, 7).toString("base64");
  const fetcher = { async fetch(url) {
    if (url.endsWith("openid-configuration")) return { body: JSON.stringify({
      issuer: "https://broker.example.test", authorization_endpoint: "https://broker.example.test/authorize",
      token_endpoint: "https://broker.example.test/token", jwks_uri: "https://broker.example.test/jwks"
    }), contentType: "application/json" };
    if (url.endsWith("/jwks")) return { body: JSON.stringify({ keys: [{ kty: "RSA", use: "sig", kid: "rotation-1" }] }), contentType: "application/json" };
    if (url.endsWith("/metadata")) return { body: `<EntityDescriptor entityID="https://saml.example.test/entity"><IDPSSODescriptor><KeyDescriptor use="signing"><KeyInfo><X509Data><X509Certificate>${signingCertificate}</X509Certificate></X509Data></KeyInfo></KeyDescriptor><SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://saml.example.test/sso" /></IDPSSODescriptor></EntityDescriptor>`, contentType: "application/samlmetadata+xml" };
    throw new Error("unexpected URL");
  } };
  const oidc = await validateIdentityProviderMetadata({ protocol: "oidc",
    discoveryUrl: "https://broker.example.test/.well-known/openid-configuration" }, fetcher);
  assert.equal(oidc.oidc.issuer, "https://broker.example.test");
  assert.equal(oidc.saml, null);
  const saml = await validateIdentityProviderMetadata({ protocol: "saml",
    discoveryUrl: "https://broker.example.test/.well-known/openid-configuration",
    metadataUrl: "https://saml.example.test/metadata" }, fetcher);
  assert.equal(saml.saml?.entityId, "https://saml.example.test/entity");
  assert.equal(saml.saml?.fingerprints.length, 1);
  await assert.rejects(validateIdentityProviderMetadata({ protocol: "saml",
    discoveryUrl: "https://broker.example.test/.well-known/openid-configuration",
    metadataUrl: "https://saml.example.test/metadata" }, { async fetch(url) {
      if (url.endsWith("metadata")) return { body: "<!DOCTYPE x [<!ENTITY y SYSTEM 'file:///etc/passwd'>]><EntityDescriptor />", contentType: "text/xml" };
      return fetcher.fetch(url);
    } }), /document type or entity/u);
});
