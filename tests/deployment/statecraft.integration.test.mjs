import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { Pool } from "pg";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { organization, preflightDatabase, releaseMaterialization, seedDatabase } from "../../deploy/statecraft/setup.mjs";
import { beginOidcLogin, completeOidcLogin } from "../../apps/server/dist/identity/login.js";
import { resolveOrganizationIdentityProvider } from "../../apps/server/dist/identity/organization-providers.js";
import { createProject, listSimulationTemplates } from "../../apps/server/dist/studio/portal.js";
import { listPlatformOrganizations } from "../../apps/server/dist/platform/provisioning.js";

test("Statecraft bootstrap: real schema, rollback, five logins, scoped template access and non-destructive rerun", async () => {
  const connectionString = process.env.STATECRAFT_TEST_DATABASE_URL;
  if (!connectionString || !/^\/plenum_statecraft_test_[a-z0-9_]+$/u.test(new URL(connectionString).pathname)) {
    throw new Error("STATECRAFT_TEST_DATABASE_URL must name a blank disposable plenum_statecraft_test_<suffix> database.");
  }
  const pool = new Pool({ connectionString, max: 3 });
  const client = await pool.connect();
  try {
    assert.equal(Number((await client.query("SELECT count(*) FROM information_schema.tables WHERE table_schema IN ('identity','studio','runtime')")).rows[0].count), 0,
      "Refusing a nonblank test database");
    for (const directory of ["references/plenum-runtime-slice/migrations", "apps/server/migrations"]) {
      for (const file of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
        await client.query(await readFile(`${directory}/${file}`, "utf8"));
      }
    }
    const actorId = randomUUID();
    const otherOrganization = randomUUID();
    await client.query("INSERT INTO identity.organizations(id,name) VALUES ($1,'Synthetic existing organization')", [otherOrganization]);
    await client.query("INSERT INTO identity.persons(id,display_name) VALUES ($1,'Synthetic bootstrap operator')", [actorId]);
    await client.query("INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'admin')", [otherOrganization, actorId]);
    await client.query("SELECT identity.bootstrap_platform_administrator($1,$2)", [actorId, randomUUID()]);
    const issuer = "https://synthetic-identity.invalid/realms/plenum";
    const release = await releaseMaterialization();
    const input = { actorId, deploymentId: randomUUID(), issuer, clientId: "plenum", release,
      identity: { subjects: Object.fromEntries(organization.administrators.map((user) => [user.username, randomUUID()])),
        discovery: { authorization_endpoint: `${issuer}/auth`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/certs` },
        metadataDigest: "a".repeat(64), keysDigest: "b".repeat(64) } };
    await assert.rejects(seedDatabase(client, { ...input, release: { ...release, materialization: {} } }));
    assert.equal((await client.query("SELECT 1 FROM identity.organizations WHERE id=$1", [organization.id])).rowCount, 0);
    assert.equal((await client.query("SELECT 1 FROM identity.persons WHERE id=ANY($1::uuid[])", [organization.administrators.map((user) => user.id)])).rowCount, 0);
    assert.equal((await seedDatabase(client, input)).created, true);
    assert.equal((await client.query("SELECT 1 FROM identity.platform_role_assignments WHERE person_id=ANY($1::uuid[])", [organization.administrators.map((user) => user.id)])).rowCount, 0);
    assert.equal((await client.query("SELECT 1 FROM identity.memberships WHERE organization_id=$1 AND organization_role='admin'", [organization.id])).rowCount, 5);
    assert.equal((await client.query("SELECT 1 FROM identity.organization_workforce_members WHERE organization_id=$1 AND status='active'", [organization.id])).rowCount, 5);
    const provider = (await client.query("SELECT * FROM identity.organization_identity_provider_revisions WHERE id=$1", [organization.providerId])).rows[0];
    assert.equal(provider.tested_at, null);
    assert.equal(provider.approved_at, null);
    assert.equal((await client.query("SELECT 1 FROM identity.organization_domains WHERE organization_id=$1", [organization.id])).rowCount, 0);
    const configuration = await resolveOrganizationIdentityProvider(pool, { slug: organization.slug }, "https://synthetic-app.invalid/auth/callback", randomUUID());
    assert.equal(configuration.organizationId, organization.id);
    const keys = await generateKeyPair("RS256");
    const jwk = { ...await exportJWK(keys.publicKey), kid: "statecraft-test", use: "sig", alg: "RS256" };
    const localConfiguration = { ...configuration, jwks: { keys: [jwk] } };
    const login = async (subject) => {
      const attempt = await beginOidcLogin(pool, localConfiguration);
      const nonce = new URL(attempt.authorizationUrl).searchParams.get("nonce");
      const token = await new SignJWT({ nonce, acr: "pwd" }).setProtectedHeader({ alg: "RS256", kid: jwk.kid })
        .setIssuer(issuer).setAudience("plenum").setSubject(subject).setIssuedAt().setExpirationTime("5m").sign(keys.privateKey);
      return completeOidcLogin(pool, localConfiguration, { code: "synthetic-code", state: attempt.state,
        browserCredential: attempt.browserCredential, correlationId: randomUUID() }, async () => Response.json({ id_token: token }));
    };
    let principal;
    for (const user of organization.administrators) {
      principal = await login(input.identity.subjects[user.username]);
      assert.equal(principal.principalId, user.id);
      assert.deepEqual(principal.organizationRoles, ["admin"]);
      const catalog = await listSimulationTemplates(pool, principal, {}, randomUUID());
      assert.equal(catalog.templates.length, 1);
      assert.equal(catalog.templates[0].id, organization.templateId);
      assert.equal(catalog.templates[0].includesOptionalScenario, true);
      await assert.rejects(listPlatformOrganizations(pool, principal, randomUUID()));
      await assert.rejects(listSimulationTemplates(pool, { ...principal, organizationId: otherOrganization }, {}, randomUUID()));
    }
    await assert.rejects(login(randomUUID()), /not linked/u);
    const created = await createProject(pool, principal, { requestId: randomUUID(), title: "Synthetic template copy",
      templateId: organization.templateId, includeScenario: true }, randomUUID());
    const draft = (await client.query("SELECT document FROM studio.drafts WHERE organization_id=$1 AND project_id=$2", [organization.id, created.projectId])).rows[0].document;
    assert.ok(draft.coreDesign.stages.length > 0);
    await client.query("UPDATE studio.drafts SET document=jsonb_set(document,'{scenario,name}','\"Edited after bootstrap\"') WHERE organization_id=$1 AND project_id=$2", [organization.id, organization.projectId]);
    await client.query("DELETE FROM identity.memberships WHERE organization_id=$1 AND person_id=$2", [organization.id, organization.administrators[0].id]);
    await client.query("UPDATE identity.organizations SET lifecycle_status='suspended' WHERE id=$1", [organization.id]);
    assert.equal((await seedDatabase(client, input)).created, false);
    assert.equal((await client.query("SELECT 1 FROM identity.memberships WHERE organization_id=$1 AND person_id=$2", [organization.id, organization.administrators[0].id])).rowCount, 0);
    assert.equal((await client.query("SELECT document->'scenario'->>'name' AS name FROM studio.drafts WHERE project_id=$1", [organization.projectId])).rows[0].name, "Edited after bootstrap");
    assert.equal((await client.query("SELECT lifecycle_status FROM identity.organizations WHERE id=$1", [organization.id])).rows[0].lifecycle_status, "suspended");
    await client.query("SET ROLE plenum_app");
    await assert.rejects(preflightDatabase(client, actorId), /privileged migration/u);
    await client.query("RESET ROLE");
  } finally { client.release(); await pool.end(); }
});
