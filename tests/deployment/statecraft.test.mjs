import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { organization, provisionKeycloak, releaseMaterialization, requestJson, validatePasswords } from "../../deploy/statecraft/setup.mjs";

const issuer = "https://identity.example.invalid/realms/plenum";
const passwords = Object.fromEntries(organization.administrators.map((user) => [user.username, `synthetic-${user.username}-password`]));
const input = { issuer, clientId: "plenum", publicBaseUrl: "https://app.example.invalid", adminPassword: "synthetic-admin", passwords };

function identityServer({ externalUser = false, failureAt = null } = {}) {
  const users = new Map();
  const calls = [];
  let group;
  if (externalUser) users.set("trenton.ford", { id: randomUUID(), username: "trenton.ford", enabled: true, owned: false });
  const fetcher = async (value, init) => {
    const url = new URL(value);
    const method = init.method ?? "GET";
    assert.equal(init.redirect, "error");
    assert.ok(init.signal);
    calls.push({ path: url.pathname, method });
    const json = (body) => Response.json(body);
    if (url.pathname.endsWith("openid-configuration")) return json({ issuer, authorization_endpoint: `${issuer}/auth`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/certs` });
    if (url.pathname.endsWith("/certs")) return json({ keys: [{ kty: "RSA", use: "sig" }] });
    if (url.pathname.includes("/master/")) return json({ access_token: "synthetic-token" });
    assert.equal(init.headers.authorization, "Bearer synthetic-token");
    if (url.pathname.endsWith("/clients")) return json([{ enabled: true, standardFlowEnabled: true, redirectUris: ["https://app.example.invalid/auth/callback"] }]);
    if (url.pathname.endsWith("/groups") && !url.pathname.includes("/users/")) {
      if (method === "GET") return json(group ? [group] : []);
      const body = JSON.parse(init.body);
      group = { id: randomUUID(), name: body.name, path: `/${body.name}` };
      return new Response(null, { status: 201 });
    }
    if (url.pathname.endsWith("/users")) {
      if (method === "GET") return json(users.has(url.searchParams.get("username")) ? [users.get(url.searchParams.get("username"))] : []);
      const body = JSON.parse(init.body);
      if (body.username === failureAt) return new Response("must not leak this remote diagnostic", { status: 503 });
      assert.equal(body.credentials[0].temporary, false);
      assert.equal(body.credentials[0].value, passwords[body.username]);
      assert.equal(body.emailVerified, undefined);
      assert.equal(body.realmRoles, undefined);
      assert.deepEqual(body.groups, [group.path]);
      users.set(body.username, { id: randomUUID(), username: body.username, enabled: true, owned: true });
      return new Response(null, { status: 201 });
    }
    if (url.pathname.endsWith("/groups")) {
      const user = [...users.values()].find((entry) => url.pathname.includes(entry.id));
      return json(user.owned ? [group] : []);
    }
    throw new Error("Unexpected identity request");
  };
  return { fetcher, users, calls, recover() { failureAt = null; } };
}

test("the bundled organization contains exactly the five designated people and a valid Fractured Order scenario", async () => {
  assert.deepEqual(organization.administrators.map((user) => user.name), ["Trenton Ford", "Chloe Carr", "Sethu Nguna", "Ryan Paoloni", "Ben Petrihos"]);
  assert.equal(new Set(organization.administrators.map((user) => user.id)).size, 5);
  const release = await releaseMaterialization();
  assert.match(release.packageDigest, /^[a-f0-9]{64}$/u);
  assert.equal(release.materialization.scenario.id, organization.scenarioId);
  assert.ok(release.materialization.coreDesign.stages.length > 0);
  assert.ok(release.materialization.coreDesign.forms.length > 0);
});

test("password input rejects missing, extra, duplicate, short and non-string secrets without echoing values", () => {
  assert.equal(validatePasswords(passwords), passwords);
  for (const candidate of [null, [], {}, { ...passwords, extra: "secret" }, { ...passwords, "trenton.ford": "short" },
    { ...passwords, "trenton.ford": 123 }, { ...passwords, "trenton.ford": passwords["chloe.carr"] }]) {
    assert.throws(() => validatePasswords(candidate));
  }
});

test("accounts resume after partial failure without resetting existing credentials or granting platform roles", async () => {
  const server = identityServer({ failureAt: "chloe.carr" });
  await assert.rejects(provisionKeycloak(input, server.fetcher), /HTTP 503/u);
  assert.equal(server.users.size, 1);
  const originalId = server.users.get("trenton.ford").id;
  server.recover();
  const result = await provisionKeycloak(input, server.fetcher);
  assert.equal(result.subjects["trenton.ford"], originalId);
  assert.equal(Object.keys(result.subjects).length, 5);
  const writes = server.calls.filter((call) => call.method === "POST" && call.path.startsWith("/admin/")).length;
  await provisionKeycloak(input, server.fetcher);
  assert.equal(server.calls.filter((call) => call.method === "POST" && call.path.startsWith("/admin/")).length, writes);
  assert.ok(server.calls.every((call) => !["PUT", "DELETE"].includes(call.method)));
});

test("existing foreign or disabled accounts are not adopted or re-enabled", async () => {
  const foreign = identityServer({ externalUser: true });
  await assert.rejects(provisionKeycloak(input, foreign.fetcher), /refusing to adopt/u);
  assert.equal(foreign.calls.filter((call) => call.path.endsWith("/users") && call.method === "POST").length, 0);
  const disabled = identityServer();
  await provisionKeycloak(input, disabled.fetcher);
  disabled.users.get("chloe.carr").enabled = false;
  await assert.rejects(provisionKeycloak(input, disabled.fetcher), /disabled/u);
  assert.equal(disabled.users.get("chloe.carr").enabled, false);
});

test("identity metadata cannot redirect credentials and failures do not disclose remote bodies", async () => {
  await assert.rejects(provisionKeycloak({ ...input, issuer: issuer.replace("https:", "http:") }, async () => assert.fail()), /HTTPS/u);
  await assert.rejects(provisionKeycloak(input, async () => Response.json({ issuer, authorization_endpoint: "https://other.example/auth" })), /outside/u);
  await assert.rejects(requestJson(issuer, {}, async () => new Response("sensitive-value", { status: 400 })),
    (error) => error.message === "Identity request failed (HTTP 400).");
  await assert.rejects(requestJson(issuer, {}, async () => new Response("sensitive-value")), /invalid JSON/u);
});
