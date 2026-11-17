import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { canonicalizeJson } from "../../packages/event-contracts/dist/index.js";
import { verifyReleasePackage } from "../../packages/release-compiler/dist/index.js";
import { copySimulationTemplate } from "../../packages/simulation-schema/dist/index.js";
import { readSecretBundle } from "../compose/secret-entrypoint.mjs";

export const organization = JSON.parse(await readFile(new URL("./organization.json", import.meta.url), "utf8"));
const reason = "Owner-designated organization and administrators; owner authorized bundled Fractured Order without additional approvals.";
const groupName = `plenum-bootstrap-${organization.id}`;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function validatePasswords(passwords) {
  const names = organization.administrators.map((user) => user.username);
  if (!passwords || Array.isArray(passwords) || typeof passwords !== "object" ||
      Object.keys(passwords).length !== names.length || Object.keys(passwords).some((name) => !names.includes(name)) ||
      names.some((name) => typeof passwords[name] !== "string" || passwords[name].length < 12 || passwords[name].length > 1024)) {
    throw new Error("Supply exactly the five designated usernames, each with a password of 12–1024 characters.");
  }
  if (new Set(Object.values(passwords)).size !== names.length) throw new Error("Use a different password for each administrator.");
  return passwords;
}

function httpsUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Identity and application URLs must use HTTPS without credentials, query strings, or fragments.");
  }
  return url;
}

export async function releaseMaterialization() {
  const bytes = await readFile(new URL("../../definitions/fractured-order/fractured-order-release.json", import.meta.url));
  const verified = verifyReleasePackage(bytes, hash(bytes));
  const materialization = copySimulationTemplate(verified.release.coreDesign, verified.release.scenario,
    organization.projectId, organization.scenarioId, true);
  return { materialization, packageDigest: verified.packageDigest, releaseId: verified.release.manifest.releaseId };
}

// Never echo remote bodies: identity servers can include submitted credentials in errors.
export async function requestJson(url, init = {}, fetcher = fetch) {
  let response;
  try { response = await fetcher(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15_000) }); }
  catch { throw new Error("Identity request could not complete; check connectivity and retry setup."); }
  if (!response.ok) throw new Error(`Identity request failed (HTTP ${response.status}).`);
  if (response.status === 204 || response.status === 201) return null;
  try { return await response.json(); } catch { throw new Error("Identity server returned invalid JSON."); }
}

export async function provisionKeycloak({ issuer, clientId, publicBaseUrl, adminPassword, passwords }, fetcher = fetch) {
  validatePasswords(passwords);
  const issuerUrl = httpsUrl(issuer);
  const base = issuer.replace(/\/realms\/plenum$/u, "");
  if (base === issuer) throw new Error("This setup requires the existing plenum Keycloak realm.");
  const callback = new URL("/auth/callback", httpsUrl(publicBaseUrl)).href;
  const discovery = await requestJson(`${issuer}/.well-known/openid-configuration`, {}, fetcher);
  if (discovery.issuer !== issuer) throw new Error("The discovered issuer does not match the deployment issuer.");
  for (const field of ["authorization_endpoint", "token_endpoint", "jwks_uri"]) {
    if (httpsUrl(discovery[field]).origin !== issuerUrl.origin) throw new Error("Identity metadata points outside the configured identity host.");
  }
  const jwks = await requestJson(discovery.jwks_uri, {}, fetcher);
  if (!Array.isArray(jwks.keys) || !jwks.keys.some((key) => key.kty === "RSA" && (!key.use || key.use === "sig"))) {
    throw new Error("Identity provider has no RSA signing key.");
  }
  const token = await requestJson(`${base}/realms/master/protocol/openid-connect/token`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "password", client_id: "admin-cli", username: "plenum-admin", password: adminPassword })
  }, fetcher);
  if (typeof token.access_token !== "string" || !token.access_token) throw new Error("Keycloak did not return an administrator token.");
  const headers = { authorization: `Bearer ${token.access_token}`, "content-type": "application/json" };
  const admin = (path, init = {}) => requestJson(`${base}/admin/realms/plenum${path}`, { ...init, headers }, fetcher);
  const clients = await admin(`/clients?clientId=${encodeURIComponent(clientId)}`);
  if (clients.length !== 1 || !clients[0].enabled || !clients[0].standardFlowEnabled ||
      !clients[0].redirectUris?.includes(callback)) throw new Error("The existing OIDC client must allow this application's exact callback URL.");

  let groups = await admin(`/groups?search=${encodeURIComponent(groupName)}&exact=true`);
  let group = groups.find((entry) => entry.name === groupName);
  if (!group) {
    await admin("/groups", { method: "POST", body: JSON.stringify({ name: groupName }) });
    groups = await admin(`/groups?search=${encodeURIComponent(groupName)}&exact=true`);
    group = groups.find((entry) => entry.name === groupName);
  }
  if (!group?.id || group.path !== `/${groupName}`) throw new Error("The bootstrap ownership group was not created.");
  const subjects = {};
  for (const user of organization.administrators) {
    const find = () => admin(`/users?username=${encodeURIComponent(user.username)}&exact=true`);
    let matches = await find();
    if (matches.length === 0) {
      const [firstName, ...lastName] = user.name.split(" ");
      await admin("/users", { method: "POST", body: JSON.stringify({ username: user.username, firstName,
        lastName: lastName.join(" "), enabled: true, groups: [group.path],
        credentials: [{ type: "password", value: passwords[user.username], temporary: false }] }) });
      matches = await find();
    }
    if (matches.length !== 1 || !uuid.test(matches[0].id) || matches[0].username !== user.username || !matches[0].enabled) {
      throw new Error(`Account ${user.username} is missing, ambiguous, or disabled; it was not overwritten.`);
    }
    const memberships = await admin(`/users/${matches[0].id}/groups`);
    if (!memberships.some((entry) => entry.id === group.id)) {
      throw new Error(`Account ${user.username} already exists outside this setup; refusing to adopt or reset it.`);
    }
    subjects[user.username] = matches[0].id;
  }
  return { subjects, discovery, metadataDigest: hash(JSON.stringify(discovery)), keysDigest: hash(JSON.stringify(jwks.keys)) };
}

export async function preflightDatabase(client, actorId) {
  if (!uuid.test(actorId)) throw new Error("An existing deployment Platform Administrator person ID is required.");
  const privilege = await client.query("SELECT rolsuper OR rolbypassrls AS allowed FROM pg_roles WHERE rolname=current_user");
  if (privilege.rows[0]?.allowed !== true) throw new Error("Run this deployment bootstrap with the privileged migration database connection, never plenum_app.");
  const actor = await client.query("SELECT identity.person_is_active_platform_administrator($1) AS allowed", [actorId]);
  if (actor.rows[0]?.allowed !== true) throw new Error("The deployment actor is not an active Platform Administrator.");
  const prior = await client.query("SELECT details FROM evidence.platform_audit_records WHERE id=$1 AND resource_organization_id=$2 AND action='platform.statecraft_bootstrapped'",
    [organization.auditId, organization.id]);
  if (prior.rows.length) return prior.rows[0].details;
  const collisions = await client.query(`SELECT 1 FROM identity.organizations WHERE id=$1 OR name=$2
    UNION ALL SELECT 1 FROM identity.organization_provisioning WHERE slug=$3`, [organization.id, organization.name, organization.slug]);
  if (collisions.rows.length) throw new Error("An unrecognized Statecraft organization already exists; refusing to overwrite it.");
  const people = await client.query("SELECT 1 FROM identity.persons WHERE id=ANY($1::uuid[])", [organization.administrators.map((user) => user.id)]);
  if (people.rows.length) throw new Error("A designated person ID is already in use; refusing to overwrite it.");
  return null;
}

export async function seedDatabase(client, { actorId, deploymentId, issuer, clientId, identity, release }) {
  if (!uuid.test(deploymentId)) throw new Error("A valid deployment ID is required.");
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [organization.id]);
    const previous = await preflightDatabase(client, actorId);
    if (previous) { await client.query("COMMIT"); return { created: false, ...previous }; }
    const { discovery, metadataDigest, keysDigest, subjects } = identity;
    if (organization.administrators.some((user) => !uuid.test(subjects[user.username])) || new Set(Object.values(subjects)).size !== 5) {
      throw new Error("Five distinct Keycloak subjects are required.");
    }
    await client.query("SELECT set_config('app.organization_id',$1,true)", [organization.id]);
    await client.query("INSERT INTO identity.organizations(id,name,lifecycle_status,activated_at) VALUES ($1,$2,'active',transaction_timestamp())",
      [organization.id, organization.name]);
    for (const user of organization.administrators) {
      await client.query("INSERT INTO identity.persons(id,display_name) VALUES ($1,$2)", [user.id, user.name]);
      // The existing membership trigger creates active workforce rows for deployment bootstrap identities.
      await client.query("INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'admin')", [organization.id, user.id]);
    }
    await client.query(`INSERT INTO identity.organization_provisioning
      (organization_id,slug,legal_name,deployment_profile,entitlements,configuration_status,configured_by)
      VALUES ($1,$2,$3,'cloud',ARRAY['studio_authoring','session_delivery'],'needs_reconciliation',$4)`,
    [organization.id, organization.slug, organization.name, actorId]);
    // This is owner-authorized deployment bootstrap, not a claimed provider test or email/domain verification.
    await client.query(`INSERT INTO identity.organization_identity_provider_revisions
      (id,organization_id,provider_key,version,protocol,display_name,status,discovery_url,client_id,audience,
       issuer,authorization_endpoint,token_endpoint,jwks_uri,metadata_sha256,signing_keys_sha256,
       staged_by,preflighted_by,preflighted_at,activated_by,activated_at)
      VALUES ($1,$2,'statecraft-deployment',1,'oidc','Plenum Keycloak','active',$3,$4,$4,$5,$6,$7,$8,$9,$10,
        $11,$11,transaction_timestamp(),$11,transaction_timestamp())`,
    [organization.providerId, organization.id, `${issuer}/.well-known/openid-configuration`, clientId, issuer,
      discovery.authorization_endpoint, discovery.token_endpoint, discovery.jwks_uri, metadataDigest, keysDigest, actorId]);
    for (const user of organization.administrators) {
      await client.query(`INSERT INTO identity.federated_identities(id,organization_id,person_id,issuer,subject,provider_type,identity_provider_id)
        VALUES ($1,$2,$3,$4,$5,'oidc',$6)`, [randomUUID(), organization.id, user.id, issuer, subjects[user.username], organization.providerId]);
    }
    const owner = organization.administrators.find((user) => user.username === "sethu.nguna").id;
    await client.query("INSERT INTO studio.simulation_projects(id,organization_id,title,created_by) VALUES ($1,$2,'Fractured Order',$3)",
      [organization.projectId, organization.id, owner]);
    await client.query("INSERT INTO studio.drafts(id,organization_id,project_id,document,updated_by) VALUES ($1,$2,$3,$4::jsonb,$5)",
      [randomUUID(), organization.id, organization.projectId, JSON.stringify(release.materialization), owner]);
    await client.query("INSERT INTO studio.project_collaborators(organization_id,project_id,person_id,project_role,added_by) VALUES ($1,$2,$3,'owner',$3)",
      [organization.id, organization.projectId, owner]);
    const artifactDigest = hash(canonicalizeJson(release.materialization));
    await client.query(`INSERT INTO studio.simulation_templates(id,organization_id,title,summary,source_project_id,
      core_design,scenario,published_by,version,artifact_sha256)
      VALUES ($1,$2,'Fractured Order','Owner-designated bundled template, including the original scenario.',$3,$4::jsonb,$5::jsonb,$6,1,$7)`,
    [organization.templateId, organization.id, organization.projectId, JSON.stringify(release.materialization.coreDesign),
      JSON.stringify(release.materialization.scenario), actorId, artifactDigest]);
    const evidence = { authorization: reason, packageDigest: release.packageDigest, sourceReleaseId: release.releaseId,
      organizationId: organization.id, templateId: organization.templateId, projectId: organization.projectId,
      administratorUsernames: organization.administrators.map((user) => user.username), providerBrowserTest: "not_run" };
    await client.query(`INSERT INTO studio.template_lifecycle_events(id,organization_id,template_id,event_type,
      actor_person_id,actor_roles,policy_version,artifact_sha256,rationale,evidence)
      VALUES ($1,$2,$3,'published',$4,ARRAY['platform_administrator'],'owner-designated-bootstrap-v1',$5,$6,$7::jsonb)`,
    [randomUUID(), organization.id, organization.templateId, actorId, artifactDigest, reason, JSON.stringify(evidence)]);
    await client.query(`INSERT INTO operations.organization_job_bindings(organization_id,deployment_id,actor_person_id,enabled,authorized_by)
      VALUES ($1,$2,$3,true,$4)`, [organization.id, deploymentId, owner, actorId]);
    await client.query(`INSERT INTO evidence.platform_audit_records(id,actor_person_id,action,resource_organization_id,target_ref,after_state,details)
      VALUES ($1,$2,'platform.statecraft_bootstrapped',$3,$4,$5::jsonb,$6::jsonb)`,
    [organization.auditId, actorId, organization.id, `organization:${organization.id}`,
      JSON.stringify({ status: "active", organizationRole: "admin", administratorCount: 5 }), JSON.stringify(evidence)]);
    await client.query("COMMIT");
    return { created: true, ...evidence };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function promptPasswords() {
  if (!process.stdin.isTTY) throw new Error("Use an interactive terminal or STATECRAFT_PASSWORDS_FILE; passwords are never command-line arguments.");
  let muted = false;
  const output = new Writable({ write(chunk, encoding, done) { if (!muted) process.stdout.write(chunk, encoding); done(); } });
  const prompt = createInterface({ input: process.stdin, output, terminal: true });
  const secret = async (label) => {
    const answer = prompt.question(label);
    muted = true;
    try { return await answer; } finally { muted = false; process.stdout.write("\n"); }
  };
  try {
    const passwords = {};
    for (const user of organization.administrators) {
      passwords[user.username] = await secret(`Password for ${user.username}: `);
      if (passwords[user.username] !== await secret("Confirm password: ")) throw new Error("Passwords did not match; no accounts were changed.");
    }
    return validatePasswords(passwords);
  } finally { prompt.close(); }
}

async function main() {
  const mode = process.argv.slice(2);
  if (mode.length !== 1 || !["--plan", "--apply"].includes(mode[0])) throw new Error("Usage: node deploy/statecraft/setup.mjs --plan|--apply");
  const release = await releaseMaterialization();
  if (mode[0] === "--plan") {
    console.log(JSON.stringify({ organization, template: "Fractured Order", packageDigest: release.packageDigest,
      roles: ["admin"], signIn: `/auth/login?organization=${organization.slug}`, writes: false }, null, 2));
    return;
  }
  const bundle = await readSecretBundle();
  const connectionString = bundle?.DATABASE_URL ?? process.env.DATABASE_URL;
  const { OIDC_ISSUER: issuer, OIDC_CLIENT_ID: clientId, PLENUM_PUBLIC_BASE_URL: publicBaseUrl,
    PLENUM_RETENTION_ACTOR_PERSON_ID: actorId, PLENUM_DEPLOYMENT_ID: deploymentId } = process.env;
  if (!connectionString || !issuer || !clientId || !publicBaseUrl || !uuid.test(deploymentId ?? "")) throw new Error("The application deployment environment is incomplete.");
  httpsUrl(issuer); httpsUrl(publicBaseUrl);
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 30_000 });
  const client = await pool.connect();
  try {
    // A session lock covers external identity creation without holding a database transaction open.
    await client.query("SELECT pg_advisory_lock(hashtextextended($1,0))", [organization.id]);
    const previous = await preflightDatabase(client, actorId);
    if (previous) { console.log("Statecraft was already provisioned. Existing accounts, access and content were left unchanged."); return; }
    let passwords;
    if (process.env.STATECRAFT_PASSWORDS_FILE) {
      let parsed;
      try { parsed = JSON.parse(await readFile(process.env.STATECRAFT_PASSWORDS_FILE, "utf8")); }
      catch { throw new Error("The password file could not be read as JSON."); }
      passwords = validatePasswords(parsed);
    } else passwords = await promptPasswords();
    const adminPassword = (await readFile(process.env.KEYCLOAK_ADMIN_PASSWORD_FILE ?? "/run/plenum-bootstrap/keycloak-admin-password", "utf8")).trim();
    if (!adminPassword) throw new Error("The Keycloak administrator password file is empty.");
    const identity = await provisionKeycloak({ issuer, clientId, publicBaseUrl, adminPassword, passwords });
    const result = await seedDatabase(client, { actorId, deploymentId, issuer, clientId, identity, release });
    console.log(JSON.stringify(result, null, 2));
    console.log(`Sign in: ${new URL(`/auth/login?organization=${organization.slug}`, publicBaseUrl)}`);
  } finally {
    // Destroy this connection to release the session advisory lock even after a failed transaction.
    client.release(true);
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Database diagnostics can contain row values; never print raw server errors or connection URLs.
    console.error(error.code ? `Statecraft setup failed (${error.code}); no database bootstrap was committed.` : error.message);
    process.exitCode = 1;
  });
}
