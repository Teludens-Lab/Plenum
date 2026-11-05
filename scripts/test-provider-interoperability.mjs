import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the real-provider staging test`);
  return value;
};
const provider = required("PLENUM_STAGING_PROVIDER").toLowerCase();
if (!["entra", "okta"].includes(provider)) throw new Error("PLENUM_STAGING_PROVIDER must be entra or okta");
const baseUrl = new URL(required("PLENUM_STAGING_BASE_URL"));
if (baseUrl.protocol !== "https:") throw new Error("PLENUM_STAGING_BASE_URL must use HTTPS");
const token = required("PLENUM_STAGING_SCIM_TOKEN");
const testDomain = required("PLENUM_STAGING_TEST_DOMAIN").toLowerCase();
const groupId = process.env.PLENUM_STAGING_SCIM_GROUP_ID?.trim();
const runId = `${provider}-${Date.now()}`;
const email = `plenum-step6-${Date.now()}@${testDomain}`;
const headers = {
  authorization: `Bearer ${token}`,
  "content-type": "application/scim+json",
  accept: "application/scim+json",
  "x-plenum-provider": provider
};
const requests = [];

async function scim(path, init = {}) {
  const startedAt = Date.now();
  const providerRequestId = `${runId}-${requests.length + 1}`;
  const response = await fetch(new URL(path, baseUrl), { ...init, headers: { ...headers,
    ...(provider === "entra" ? { "x-ms-correlation-id": providerRequestId } : { "x-okta-request-id": providerRequestId }),
    ...init.headers } });
  const text = await response.text();
  let body = null;
  if (text) { try { body = JSON.parse(text); } catch { body = { unparsed: true }; } }
  requests.push({ method: init.method ?? "GET", path, status: response.status, elapsedMs: Date.now() - startedAt });
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return body;
}

let personId;
try {
  const configuration = await scim("/scim/v2/ServiceProviderConfig");
  if (configuration?.patch?.supported !== true || configuration?.filter?.supported !== true) {
    throw new Error("The SCIM service-provider contract does not advertise required PATCH and filter support");
  }
  const created = await scim("/scim/v2/Users", { method: "POST", body: JSON.stringify({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], externalId: runId,
    userName: email, displayName: `Step 6 ${provider} interoperability`, active: true,
    roles: [{ value: "designer" }]
  }) });
  personId = created?.id;
  if (typeof personId !== "string") throw new Error("The provider create response did not return a SCIM User id");
  await scim(`/scim/v2/Users/${personId}`, { method: "PATCH", body: JSON.stringify({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"], Operations: [{ op: "Replace", path: "active", value: false }]
  }) });
  await scim(`/scim/v2/Users/${personId}`, { method: "PATCH", body: JSON.stringify({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"], Operations: [{ op: "Replace", path: "active", value: true }]
  }) });
  if (groupId) {
    await scim(`/scim/v2/Groups/${groupId}`, { method: "PATCH", body: JSON.stringify({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
      Operations: [{ op: "Add", path: "members", value: [{ value: personId }] }]
    }) });
    await scim(`/scim/v2/Groups/${groupId}`, { method: "PATCH", body: JSON.stringify({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
      Operations: [{ op: "Remove", path: "members", value: [{ value: personId }] }]
    }) });
  }
  await scim(`/scim/v2/Users/${personId}`, { method: "DELETE" });
  const evidence = { status: "PASS", provider, runId, testAccount: email, groupJourneyRun: Boolean(groupId), requests,
    note: "Secrets and response bodies are intentionally excluded. OIDC/SAML interactive sign-in approval is recorded separately by an authorized human tester." };
  const directory = join(process.cwd(), "test-results", "identity-provider");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${provider}-scim-interoperability.json`), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`STEP6-${provider.toUpperCase()}-SCIM PASS; evidence: test-results/identity-provider/${provider}-scim-interoperability.json`);
} catch (error) {
  if (personId) {
    try { await scim(`/scim/v2/Users/${personId}`, { method: "DELETE" }); } catch { /* Preserve the original failure. */ }
  }
  throw error;
}
