import { createPublicKey, randomUUID } from "node:crypto";
import {
  assertPluginPermissions,
  satisfiesPluginRange,
  verifyOfflinePluginBundle,
  verifyPluginBundleForIntake,
  verifyPluginRevocations,
  pluginDigest,
  type OfflinePluginBundleV1,
  type PluginManifestV1,
  type PluginRevocationsV1,
  type PluginTrustRoot,
  type VerifiedPluginBundle
} from "@plenum/plugin-sdk";
import { canonicalizeJson } from "@plenum/event-contracts";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import type { ObjectStore } from "../registry/object-store.js";

type RegistryRole = "admin" | "designer" | "publisher" | "operator";
type DeploymentProfile = "connected" | "self_hosted" | "air_gapped";

export interface PluginCompatibilityContext {
  hostApiVersion: string;
  releaseSchemaVersion: string;
  deploymentProfile: DeploymentProfile;
}

export interface RegisteredPluginArtifact {
  artifactId: string;
  pluginId: string;
  version: string;
  digest: string;
  lifecycleStatus: string;
}

export interface InstalledPlugin extends RegisteredPluginArtifact {
  installationId: string;
  deploymentId: string;
}

export interface AuthorizedPluginBinding {
  bindingId: string;
  installationId: string;
  artifactId: string;
  artifactDigest: string;
  configurationDigest: string;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function requireRole(principal: AuthenticatedPrincipal, roles: readonly RegistryRole[], correlationId: string): void {
  if (!principal.organizationRoles.some((role) => roles.includes(role))) {
    throw authorizationError("PERMISSION_DENIED", `One of these Organization Roles is required: ${roles.join(", ")}.`, correlationId);
  }
}

async function requireCurrentRole(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  roles: readonly RegistryRole[],
  correlationId: string
): Promise<void> {
  const membership = await client.query(
    `SELECT 1 FROM identity.memberships
      WHERE organization_id=$1 AND person_id=$2 AND organization_role=ANY($3::text[])`,
    [principal.organizationId, principal.principalId, roles]
  );
  if (membership.rowCount === 0) throw authorizationError("ACCESS_REVOKED", "Plugin registry access is no longer active.", correlationId);
}

async function writeAudit(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  action: string,
  targetRef: string,
  correlationId: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  await client.query(
    `INSERT INTO evidence.audit_records
       (id,organization_id,actor_person_id,action,target_ref,details)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [randomUUID(), principal.organizationId, principal.principalId, action, targetRef,
      JSON.stringify({ ...details, correlationId })]
  );
}

function validationError(error: unknown, correlationId: string) {
  return authorizationError("VALIDATION_FAILED", error instanceof Error ? error.message : "Plugin validation failed.", correlationId);
}

function requireGrantedPermissions(manifest: PluginManifestV1, permissions: readonly string[], correlationId: string): void {
  try {
    assertPluginPermissions(manifest, permissions);
  } catch (error) {
    throw authorizationError("PERMISSION_DENIED", error instanceof Error ? error.message : "Plugin permissions were not granted.", correlationId);
  }
}

function objectDigest(digest: string): string {
  return digest.slice("sha256:".length);
}

function bundleIdentity(bytes: Uint8Array, correlationId: string): { publisherId: string; keyId: string; pluginId: string; version: string } {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw validationError(new Error("Offline Plugin bundle is not valid JSON"), correlationId);
  }
  const bundle = value as Partial<OfflinePluginBundleV1>;
  const publisherId = bundle.manifest?.publisher?.id;
  const keyId = bundle.manifest?.publisher?.signatureKeyId;
  const pluginId = bundle.manifest?.pluginId;
  const version = bundle.manifest?.version;
  if (typeof publisherId !== "string" || !uuidPattern.test(publisherId) || typeof keyId !== "string" ||
      typeof pluginId !== "string" || typeof version !== "string") {
    throw validationError(new Error("Offline Plugin bundle identity is invalid"), correlationId);
  }
  return { publisherId, keyId, pluginId, version };
}

function asTrustRoot(row: {
  publisher_id: string;
  publisher_key_id: string;
  publisher_public_key_pem: string;
  revocation_key_id: string;
  revocation_public_key_pem: string;
}): PluginTrustRoot {
  return {
    publisherId: row.publisher_id,
    publisherKeyId: row.publisher_key_id,
    publisherPublicKey: createPublicKey(row.publisher_public_key_pem),
    revocationKeyId: row.revocation_key_id,
    revocationPublicKey: createPublicKey(row.revocation_public_key_pem)
  };
}

async function cleanupUnreferenced(
  pool: Pool,
  store: ObjectStore,
  organizationId: string,
  objectKey: string,
  digest: string
): Promise<void> {
  try {
    const result = await withOrganizationTransaction(pool, organizationId, (client) =>
      client.query("SELECT 1 FROM extension.plugin_artifacts WHERE organization_id=$1 AND object_key=$2", [organizationId, objectKey]));
    if (result.rowCount === 0) await store.deleteIfDigest(objectKey, objectDigest(digest));
  } catch {
    // An orphan is safer than deleting an object after an ambiguous commit.
  }
}

export async function registerPluginPublisher(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: { publisherId: string; publisherPrincipalId: string; displayName: string; signatureKeyId: string; publicKeyPem: string; correlationId: string }
): Promise<void> {
  requireRole(principal, ["admin"], input.correlationId);
  if (![input.publisherId, input.publisherPrincipalId].every((id) => uuidPattern.test(id)) || input.displayName.length === 0 || input.signatureKeyId.length === 0) {
    throw validationError(new Error("Publisher registration is invalid"), input.correlationId);
  }
  try {
    createPublicKey(input.publicKeyPem);
  } catch {
    throw validationError(new Error("Publisher public key is invalid"), input.correlationId);
  }
  await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["admin"], input.correlationId);
    const publisher = await client.query(
      `SELECT 1 FROM identity.memberships
        WHERE organization_id=$1 AND person_id=$2 AND organization_role='publisher'`,
      [principal.organizationId, input.publisherPrincipalId]
    );
    if (publisher.rowCount !== 1) throw authorizationError("REFERENCE_INVALID", "The publisher is not an active Organization Publisher.", input.correlationId);
    await client.query(
      `INSERT INTO extension.publishers
         (id,organization_id,principal_id,display_name,signature_key_id,public_key_pem,status,approved_by)
       VALUES ($1,$2,$3,$4,$5,$6,'approved',$7)`,
      [input.publisherId, principal.organizationId, input.publisherPrincipalId, input.displayName,
        input.signatureKeyId, input.publicKeyPem, principal.principalId]
    );
    await writeAudit(client, principal, "plugin_publisher.approved", `plugin_publisher:${input.publisherId}`, input.correlationId);
  });
}

export async function provisionPluginTrustRoot(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: { trustRootId: string; publisherId: string; publisherKeyId: string; publisherPublicKeyPem: string; revocationKeyId: string; revocationPublicKeyPem: string; correlationId: string }
): Promise<void> {
  requireRole(principal, ["admin"], input.correlationId);
  if (![input.trustRootId, input.publisherId].every((id) => uuidPattern.test(id))) throw validationError(new Error("Trust root identifiers are invalid"), input.correlationId);
  try {
    createPublicKey(input.publisherPublicKeyPem);
    createPublicKey(input.revocationPublicKeyPem);
  } catch {
    throw validationError(new Error("Trust root contains an invalid public key"), input.correlationId);
  }
  await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["admin"], input.correlationId);
    await client.query(
      `INSERT INTO extension.trust_roots
         (id,organization_id,publisher_id,publisher_key_id,publisher_public_key_pem,
          revocation_key_id,revocation_public_key_pem,provisioned_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [input.trustRootId, principal.organizationId, input.publisherId, input.publisherKeyId,
        input.publisherPublicKeyPem, input.revocationKeyId, input.revocationPublicKeyPem, principal.principalId]
    );
    await writeAudit(client, principal, "plugin_trust_root.provisioned", `plugin_trust_root:${input.trustRootId}`, input.correlationId,
      { publisherId: input.publisherId, publisherKeyId: input.publisherKeyId, revocationKeyId: input.revocationKeyId });
  });
}

export async function importPluginRevocations(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: { revocationListId: string; publisherId: string; document: PluginRevocationsV1; correlationId: string },
  now = new Date()
): Promise<void> {
  requireRole(principal, ["admin"], input.correlationId);
  if (![input.revocationListId, input.publisherId].every((id) => uuidPattern.test(id))) throw validationError(new Error("Revocation list identifiers are invalid"), input.correlationId);
  await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["admin"], input.correlationId);
    const publisher = await client.query(
      `SELECT 1 FROM extension.publishers
        WHERE organization_id=$1 AND id=$2 AND status='approved' FOR UPDATE`,
      [principal.organizationId, input.publisherId]
    );
    if (publisher.rowCount !== 1) throw authorizationError("PLUGIN_NOT_APPROVED", "The Plugin Publisher is not approved.", input.correlationId);
    const result = await client.query<{
      id: string; publisher_id: string; publisher_key_id: string; publisher_public_key_pem: string;
      revocation_key_id: string; revocation_public_key_pem: string;
    }>(
      `SELECT id,publisher_id,publisher_key_id,publisher_public_key_pem,revocation_key_id,revocation_public_key_pem
         FROM extension.trust_roots
        WHERE organization_id=$1 AND publisher_id=$2
        ORDER BY provisioned_at DESC LIMIT 1`,
      [principal.organizationId, input.publisherId]
    );
    const row = result.rows[0];
    if (row === undefined) throw authorizationError("REFERENCE_INVALID", "No institution-provisioned Plugin trust root is available.", input.correlationId);
    try {
      verifyPluginRevocations(input.document, asTrustRoot(row), now);
    } catch (error) {
      throw validationError(error, input.correlationId);
    }
    await client.query(
      `INSERT INTO extension.revocation_lists
         (id,organization_id,publisher_id,trust_root_id,document,document_sha256,generated_at,imported_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`,
      [input.revocationListId, principal.organizationId, input.publisherId, row.id, JSON.stringify(input.document),
        pluginDigest(new TextEncoder().encode(canonicalizeJson(input.document))), input.document.generatedAt, principal.principalId]
    );
    await writeAudit(client, principal, "plugin_revocations.imported", `plugin_revocations:${input.revocationListId}`, input.correlationId,
      { publisherId: input.publisherId, generatedAt: input.document.generatedAt });
  });
}

export async function acceptPluginLicense(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: { acceptanceId: string; pluginId: string; license: string; termsDigest: string; correlationId: string }
): Promise<void> {
  requireRole(principal, ["admin"], input.correlationId);
  if (!uuidPattern.test(input.acceptanceId) || !/^sha256:[0-9a-f]{64}$/u.test(input.termsDigest) || input.pluginId.length === 0 || input.license.length === 0) {
    throw validationError(new Error("Plugin license acceptance is invalid"), input.correlationId);
  }
  await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["admin"], input.correlationId);
    await client.query(
      `INSERT INTO extension.license_acceptances
         (id,organization_id,plugin_id,license,terms_digest,accepted_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [input.acceptanceId, principal.organizationId, input.pluginId, input.license, input.termsDigest, principal.principalId]
    );
    await writeAudit(client, principal, "plugin_license.accepted", `plugin_license:${input.acceptanceId}`, input.correlationId,
      { pluginId: input.pluginId, license: input.license, termsDigest: input.termsDigest });
  });
}

export async function submitPluginArtifact(
  pool: Pool,
  store: ObjectStore,
  principal: AuthenticatedPrincipal,
  bytes: Uint8Array,
  correlationId: string,
  now = new Date()
): Promise<RegisteredPluginArtifact> {
  requireRole(principal, ["publisher"], correlationId);
  const publisher = await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["publisher"], correlationId);
    const result = await client.query<{ id: string; signature_key_id: string; public_key_pem: string }>(
      `SELECT id,signature_key_id,public_key_pem FROM extension.publishers
        WHERE organization_id=$1 AND principal_id=$2 AND status='approved'`,
      [principal.organizationId, principal.principalId]
    );
    const row = result.rows[0];
    if (row === undefined) throw authorizationError("PERMISSION_DENIED", "This Publisher is not approved for Plugin submission.", correlationId);
    return row;
  });
  let verified: VerifiedPluginBundle;
  try {
    verified = verifyPluginBundleForIntake(bytes, {
      publisherId: publisher.id,
      publisherKeyId: publisher.signature_key_id,
      publisherPublicKey: createPublicKey(publisher.public_key_pem),
      now
    });
  } catch (error) {
    throw validationError(error, correlationId);
  }
  const artifactId = randomUUID();
  const { manifest } = verified.bundle;
  const objectKey = `plugins/${manifest.pluginId}/${manifest.version}/${objectDigest(verified.bundleDigest)}.json`;
  await store.putImmutable(objectKey, bytes, objectDigest(verified.bundleDigest));
  try {
    return await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
      await requireCurrentRole(client, principal, ["publisher"], correlationId);
      const currentPublisher = await client.query(
        `SELECT 1 FROM extension.publishers
          WHERE organization_id=$1 AND id=$2 AND principal_id=$3 AND status='approved' FOR UPDATE`,
        [principal.organizationId, publisher.id, principal.principalId]
      );
      if (currentPublisher.rowCount !== 1) throw authorizationError("ACCESS_REVOKED", "Publisher approval is no longer active.", correlationId);
      const existing = await client.query<{ id: string; digest: string; bundle_digest: string; lifecycle_status: string }>(
        `SELECT id,digest,bundle_digest,lifecycle_status FROM extension.plugin_artifacts
          WHERE organization_id=$1 AND plugin_id=$2 AND version=$3`,
        [principal.organizationId, manifest.pluginId, manifest.version]
      );
      const prior = existing.rows[0];
      if (prior !== undefined) {
        if (prior.digest !== manifest.digest || prior.bundle_digest !== verified.bundleDigest) {
          throw authorizationError("IDEMPOTENCY_COLLISION", "Plugin ID and version already identify different signed bundle bytes.", correlationId);
        }
        return { artifactId: prior.id, pluginId: manifest.pluginId, version: manifest.version, digest: manifest.digest, lifecycleStatus: prior.lifecycle_status };
      }
      await client.query(
        `INSERT INTO extension.plugin_artifacts
           (id,organization_id,publisher_id,plugin_id,version,digest,manifest_digest,bundle_digest,
            object_key,manifest,supply_chain,lifecycle_status,submitted_by,submitted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,'contract_validated',$12,$13)`,
        [artifactId, principal.organizationId, publisher.id, manifest.pluginId, manifest.version, manifest.digest,
          verified.manifestDigest, verified.bundleDigest, objectKey, JSON.stringify(manifest),
          JSON.stringify(verified.bundle.supplyChain), principal.principalId, now]
      );
      await writeAudit(client, principal, "plugin_artifact.submitted", `plugin_artifact:${artifactId}`, correlationId,
        { pluginId: manifest.pluginId, version: manifest.version, digest: manifest.digest });
      return { artifactId, pluginId: manifest.pluginId, version: manifest.version, digest: manifest.digest, lifecycleStatus: "contract_validated" };
    });
  } catch (error) {
    await cleanupUnreferenced(pool, store, principal.organizationId, objectKey, verified.bundleDigest);
    throw error;
  }
}

export async function approvePluginArtifact(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  artifactId: string,
  correlationId: string,
  now = new Date()
): Promise<RegisteredPluginArtifact> {
  requireRole(principal, ["admin"], correlationId);
  if (!uuidPattern.test(artifactId)) throw validationError(new Error("Plugin Artifact ID is invalid"), correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["admin"], correlationId);
    const result = await client.query<{
      plugin_id: string; version: string; digest: string; lifecycle_status: string; submitted_by: string;
    }>(
      `SELECT plugin_id,version,digest,lifecycle_status,submitted_by FROM extension.plugin_artifacts
        WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
      [principal.organizationId, artifactId]
    );
    const artifact = result.rows[0];
    if (artifact === undefined) throw authorizationError("NOT_FOUND", "The Plugin Artifact was not found.", correlationId);
    if (artifact.submitted_by === principal.principalId) throw authorizationError("PERMISSION_DENIED", "Plugin Artifact approval requires a different person.", correlationId);
    if (artifact.lifecycle_status !== "contract_validated") throw authorizationError("INVALID_TRANSITION", "The Plugin Artifact is not ready for approval.", correlationId);
    await client.query(
      `UPDATE extension.plugin_artifacts
          SET lifecycle_status='approved',approved_by=$1,approved_at=$2
        WHERE organization_id=$3 AND id=$4`,
      [principal.principalId, now, principal.organizationId, artifactId]
    );
    await writeAudit(client, principal, "plugin_artifact.approved", `plugin_artifact:${artifactId}`, correlationId,
      { pluginId: artifact.plugin_id, version: artifact.version, digest: artifact.digest });
    return { artifactId, pluginId: artifact.plugin_id, version: artifact.version, digest: artifact.digest, lifecycleStatus: "approved" };
  });
}

async function verificationMaterial(client: PoolClient, organizationId: string, publisherId: string, pluginId: string, license: string) {
  const trust = await client.query<{
    id: string; publisher_id: string; publisher_key_id: string; publisher_public_key_pem: string;
    revocation_key_id: string; revocation_public_key_pem: string;
  }>(
    `SELECT id,publisher_id,publisher_key_id,publisher_public_key_pem,revocation_key_id,revocation_public_key_pem
       FROM extension.trust_roots
      WHERE organization_id=$1 AND publisher_id=$2 ORDER BY provisioned_at DESC LIMIT 1`,
    [organizationId, publisherId]
  );
  const revocations = await client.query<{ document: PluginRevocationsV1 }>(
    `SELECT document FROM extension.revocation_lists
      WHERE organization_id=$1 AND publisher_id=$2 ORDER BY generated_at DESC LIMIT 1`,
    [organizationId, publisherId]
  );
  const accepted = await client.query(
    `SELECT 1 FROM extension.license_acceptances
      WHERE organization_id=$1 AND plugin_id=$2 AND license=$3`,
    [organizationId, pluginId, license]
  );
  const trustRow = trust.rows[0];
  const document = revocations.rows[0]?.document;
  if (trustRow === undefined || document === undefined) throw new Error("Plugin trust or revocation data is unavailable");
  if (accepted.rowCount === 0) throw new Error("Organization has not accepted the Plugin license");
  return { trustRoot: asTrustRoot(trustRow), revocations: document, acceptedLicenses: new Set([license]) };
}

function verifyForInstallation(
  bytes: Uint8Array,
  material: Awaited<ReturnType<typeof verificationMaterial>>,
  compatibility: PluginCompatibilityContext,
  now: Date,
  correlationId: string
): VerifiedPluginBundle {
  try {
    return verifyOfflinePluginBundle(bytes, { ...material, ...compatibility, now });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plugin installation validation failed.";
    if (message.includes("air-gapped")) throw authorizationError("CAPABILITY_UNAVAILABLE", message, correlationId);
    throw validationError(error, correlationId);
  }
}

export async function installPluginArtifact(
  pool: Pool,
  store: ObjectStore,
  principal: AuthenticatedPrincipal,
  input: { installationId: string; deploymentId: string; artifactId: string; permittedPermissions: string[]; compatibility: PluginCompatibilityContext; correlationId: string },
  now = new Date()
): Promise<InstalledPlugin> {
  requireRole(principal, ["admin"], input.correlationId);
  if (![input.installationId, input.deploymentId, input.artifactId].every((id) => uuidPattern.test(id))) throw validationError(new Error("Plugin Installation identifiers are invalid"), input.correlationId);
  const prepared = await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["admin"], input.correlationId);
    const result = await client.query<{
      publisher_id: string; plugin_id: string; version: string; digest: string; lifecycle_status: string;
      object_key: string; manifest: PluginManifestV1;
    }>(
      `SELECT publisher_id,plugin_id,version,digest,lifecycle_status,object_key,manifest
         FROM extension.plugin_artifacts WHERE organization_id=$1 AND id=$2`,
      [principal.organizationId, input.artifactId]
    );
    const artifact = result.rows[0];
    if (artifact === undefined) throw authorizationError("NOT_FOUND", "The Plugin Artifact was not found.", input.correlationId);
    if (artifact.lifecycle_status !== "approved") throw authorizationError("PLUGIN_NOT_APPROVED", "The Plugin Artifact is not approved.", input.correlationId);
    const material = await verificationMaterial(client, principal.organizationId, artifact.publisher_id, artifact.plugin_id, artifact.manifest.license);
    return { artifact, material };
  });
  const bytes = await store.get(prepared.artifact.object_key);
  const verified = verifyForInstallation(bytes, prepared.material, input.compatibility, now, input.correlationId);
  requireGrantedPermissions(verified.bundle.manifest, input.permittedPermissions, input.correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["admin"], input.correlationId);
    const currentPublisher = await client.query(
      `SELECT 1 FROM extension.publishers
        WHERE organization_id=$1 AND id=$2 AND status='approved' FOR SHARE`,
      [principal.organizationId, prepared.artifact.publisher_id]
    );
    if (currentPublisher.rowCount !== 1) throw authorizationError("PLUGIN_NOT_APPROVED", "The Plugin Publisher is not approved.", input.correlationId);
    const artifact = await client.query<{ lifecycle_status: string; digest: string }>(
      `SELECT lifecycle_status,digest FROM extension.plugin_artifacts
        WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
      [principal.organizationId, input.artifactId]
    );
    if (artifact.rows[0]?.lifecycle_status !== "approved" || artifact.rows[0]?.digest !== verified.bundle.manifest.digest) {
      throw authorizationError("PLUGIN_NOT_APPROVED", "The Plugin Artifact changed status before installation.", input.correlationId);
    }
    const latestRevocations = await client.query<{ document: PluginRevocationsV1 }>(
      `SELECT document FROM extension.revocation_lists
        WHERE organization_id=$1 AND publisher_id=$2 ORDER BY generated_at DESC LIMIT 1`,
      [principal.organizationId, prepared.artifact.publisher_id]
    );
    const latest = latestRevocations.rows[0]?.document;
    if (latest === undefined || latest.revokedKeyIds.includes(verified.bundle.manifest.publisher.signatureKeyId) ||
        latest.revokedDigests.includes(verified.bundle.manifest.digest)) {
      throw authorizationError("PLUGIN_NOT_APPROVED", "The Plugin Artifact was revoked before installation.", input.correlationId);
    }
    await client.query(
      `INSERT INTO extension.plugin_installations
         (id,organization_id,deployment_id,artifact_id,artifact_digest,status,permitted_permissions,installed_by,installed_at)
       VALUES ($1,$2,$3,$4,$5,'enabled',$6,$7,$8)`,
      [input.installationId, principal.organizationId, input.deploymentId, input.artifactId,
        verified.bundle.manifest.digest, input.permittedPermissions, principal.principalId, now]
    );
    await writeAudit(client, principal, "plugin_installation.installed", `plugin_installation:${input.installationId}`, input.correlationId,
      { artifactId: input.artifactId, deploymentId: input.deploymentId, digest: verified.bundle.manifest.digest });
    return { artifactId: input.artifactId, pluginId: prepared.artifact.plugin_id, version: prepared.artifact.version,
      digest: prepared.artifact.digest, lifecycleStatus: "approved", installationId: input.installationId, deploymentId: input.deploymentId };
  });
}

export async function importOfflinePluginBundle(
  pool: Pool,
  store: ObjectStore,
  principal: AuthenticatedPrincipal,
  bytes: Uint8Array,
  input: { artifactId: string; compatibility: PluginCompatibilityContext; correlationId: string },
  now = new Date()
): Promise<RegisteredPluginArtifact> {
  requireRole(principal, ["admin"], input.correlationId);
  if (!uuidPattern.test(input.artifactId)) throw validationError(new Error("Offline Plugin Artifact ID is invalid"), input.correlationId);
  const identity = bundleIdentity(bytes, input.correlationId);
  const material = await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["admin"], input.correlationId);
    const bundle = JSON.parse(new TextDecoder().decode(bytes)) as OfflinePluginBundleV1;
    return verificationMaterial(client, principal.organizationId, identity.publisherId, identity.pluginId, bundle.manifest.license);
  });
  const verified = verifyForInstallation(bytes, material, input.compatibility, now, input.correlationId);
  const objectKey = `plugins/${identity.pluginId}/${identity.version}/${objectDigest(verified.bundleDigest)}.json`;
  await store.putImmutable(objectKey, bytes, objectDigest(verified.bundleDigest));
  try {
    return await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
      await requireCurrentRole(client, principal, ["admin"], input.correlationId);
      const publisher = await client.query(
        `SELECT 1 FROM extension.publishers WHERE organization_id=$1 AND id=$2 AND status='approved' FOR UPDATE`,
        [principal.organizationId, identity.publisherId]
      );
      if (publisher.rowCount !== 1) throw authorizationError("PLUGIN_NOT_APPROVED", "The Plugin Publisher is not approved.", input.correlationId);
      const existing = await client.query<{ id: string; digest: string; bundle_digest: string; lifecycle_status: string }>(
        `SELECT id,digest,bundle_digest,lifecycle_status FROM extension.plugin_artifacts
          WHERE organization_id=$1 AND plugin_id=$2 AND version=$3`,
        [principal.organizationId, identity.pluginId, identity.version]
      );
      const prior = existing.rows[0];
      if (prior !== undefined) {
        if (prior.digest !== verified.bundle.manifest.digest || prior.bundle_digest !== verified.bundleDigest) {
          throw authorizationError("IDEMPOTENCY_COLLISION", "Plugin ID and version already identify different signed bundle bytes.", input.correlationId);
        }
        return { artifactId: prior.id, pluginId: identity.pluginId, version: identity.version,
          digest: verified.bundle.manifest.digest, lifecycleStatus: prior.lifecycle_status };
      }
      await client.query(
        `INSERT INTO extension.plugin_artifacts
           (id,organization_id,publisher_id,plugin_id,version,digest,manifest_digest,bundle_digest,object_key,
            manifest,supply_chain,lifecycle_status,submitted_by,submitted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,'contract_validated',$12,$13)`,
        [input.artifactId, principal.organizationId, identity.publisherId, identity.pluginId, identity.version,
          verified.bundle.manifest.digest, verified.manifestDigest, verified.bundleDigest, objectKey,
          JSON.stringify(verified.bundle.manifest), JSON.stringify(verified.bundle.supplyChain), principal.principalId, now]
      );
      await writeAudit(client, principal, "plugin_artifact.submitted", `plugin_artifact:${input.artifactId}`, input.correlationId,
        { importedOffline: true, pluginId: identity.pluginId, version: identity.version, digest: verified.bundle.manifest.digest });
      return { artifactId: input.artifactId, pluginId: identity.pluginId, version: identity.version,
        digest: verified.bundle.manifest.digest, lifecycleStatus: "contract_validated" };
    });
  } catch (error) {
    await cleanupUnreferenced(pool, store, principal.organizationId, objectKey, verified.bundleDigest);
    throw error;
  }
}

export async function bindPluginInstallation(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: {
    bindingId: string; projectId: string; definitionRevisionId: string; installationId: string;
    configurationDigest: string; compatibility: PluginCompatibilityContext; correlationId: string;
  },
  now = new Date()
): Promise<AuthorizedPluginBinding> {
  requireRole(principal, ["designer", "admin"], input.correlationId);
  if (![input.bindingId, input.projectId, input.definitionRevisionId, input.installationId].every((id) => uuidPattern.test(id)) ||
      !/^sha256:[0-9a-f]{64}$/u.test(input.configurationDigest)) throw validationError(new Error("Plugin Binding is invalid"), input.correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["designer", "admin"], input.correlationId);
    const result = await client.query<{
      artifact_id: string; artifact_digest: string; status: string; publisher_id: string; plugin_id: string;
      lifecycle_status: string; manifest: PluginManifestV1; permitted_permissions: string[];
    }>(
      `SELECT installation.artifact_id,installation.artifact_digest,installation.status,
              artifact.publisher_id,artifact.plugin_id,artifact.lifecycle_status,artifact.manifest,
              installation.permitted_permissions
         FROM extension.plugin_installations installation
         JOIN extension.plugin_artifacts artifact
           ON artifact.organization_id=installation.organization_id AND artifact.id=installation.artifact_id
        WHERE installation.organization_id=$1 AND installation.id=$2 FOR UPDATE OF artifact`,
      [principal.organizationId, input.installationId]
    );
    const row = result.rows[0];
    if (row === undefined) throw authorizationError("NOT_FOUND", "The Plugin Installation was not found.", input.correlationId);
    if (row.status !== "enabled" || row.lifecycle_status !== "approved") throw authorizationError("PLUGIN_NOT_APPROVED", "The Plugin Installation is not enabled and approved.", input.correlationId);
    const currentPublisher = await client.query(
      `SELECT 1 FROM extension.publishers
        WHERE organization_id=$1 AND id=$2 AND status='approved' FOR SHARE`,
      [principal.organizationId, row.publisher_id]
    );
    if (currentPublisher.rowCount !== 1) throw authorizationError("PLUGIN_NOT_APPROVED", "The Plugin Publisher is not approved.", input.correlationId);
    const material = await verificationMaterial(client, principal.organizationId, row.publisher_id, row.plugin_id, row.manifest.license);
    try {
      verifyPluginRevocations(material.revocations, material.trustRoot, now);
    } catch (error) {
      throw validationError(error, input.correlationId);
    }
    if (material.revocations.revokedKeyIds.includes(row.manifest.publisher.signatureKeyId) || material.revocations.revokedDigests.includes(row.artifact_digest)) {
      throw authorizationError("PLUGIN_NOT_APPROVED", "The Plugin Artifact is revoked.", input.correlationId);
    }
    if (!satisfiesPluginRange(input.compatibility.hostApiVersion, row.manifest.compatibility.hostApi) ||
        !satisfiesPluginRange(input.compatibility.releaseSchemaVersion, row.manifest.compatibility.releaseSchema)) {
      throw authorizationError("INCOMPATIBLE_RELEASE", "The Plugin is incompatible with this host or Release schema.", input.correlationId);
    }
    if (input.compatibility.deploymentProfile === "air_gapped" && row.manifest.connectivity === "external_required") {
      throw authorizationError("CAPABILITY_UNAVAILABLE", "External-required Plugin is unavailable in an air-gapped profile.", input.correlationId);
    }
    requireGrantedPermissions(row.manifest, row.permitted_permissions, input.correlationId);
    const revision = await client.query(
      `SELECT 1 FROM studio.definition_revisions
        WHERE organization_id=$1 AND project_id=$2 AND id=$3`,
      [principal.organizationId, input.projectId, input.definitionRevisionId]
    );
    if (revision.rowCount !== 1) throw authorizationError("REFERENCE_INVALID", "The target Definition Revision is unavailable.", input.correlationId);
    await client.query(
      `INSERT INTO extension.plugin_bindings
         (id,organization_id,project_id,definition_revision_id,installation_id,artifact_digest,
          configuration_digest,deployment_profile,status,bound_by,bound_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'enabled',$9,$10)`,
      [input.bindingId, principal.organizationId, input.projectId, input.definitionRevisionId,
        input.installationId, row.artifact_digest, input.configurationDigest,
        input.compatibility.deploymentProfile, principal.principalId, now]
    );
    await writeAudit(client, principal, "plugin_binding.enabled", `plugin_binding:${input.bindingId}`, input.correlationId,
      { installationId: input.installationId, artifactDigest: row.artifact_digest, definitionRevisionId: input.definitionRevisionId });
    return { bindingId: input.bindingId, installationId: input.installationId, artifactId: row.artifact_id,
      artifactDigest: row.artifact_digest, configurationDigest: input.configurationDigest };
  });
}

export async function authorizePluginRun(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  bindingId: string,
  correlationId: string
): Promise<AuthorizedPluginBinding> {
  requireRole(principal, ["operator"], correlationId);
  if (!uuidPattern.test(bindingId)) throw validationError(new Error("Plugin Binding ID is invalid"), correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["operator"], correlationId);
    const result = await client.query<{
      installation_id: string; artifact_id: string; artifact_digest: string; configuration_digest: string;
      binding_status: string; installation_status: string; lifecycle_status: string; publisher_id: string;
      manifest: PluginManifestV1;
    }>(
      `SELECT binding.installation_id,installation.artifact_id,binding.artifact_digest,binding.configuration_digest,
              binding.status AS binding_status,installation.status AS installation_status,artifact.lifecycle_status,
              artifact.publisher_id,artifact.manifest
         FROM extension.plugin_bindings binding
         JOIN extension.plugin_installations installation
           ON installation.organization_id=binding.organization_id AND installation.id=binding.installation_id
         JOIN extension.plugin_artifacts artifact
           ON artifact.organization_id=installation.organization_id AND artifact.id=installation.artifact_id
        WHERE binding.organization_id=$1 AND binding.id=$2 FOR SHARE OF artifact`,
      [principal.organizationId, bindingId]
    );
    const row = result.rows[0];
    if (row === undefined) throw authorizationError("NOT_FOUND", "The Plugin Binding was not found.", correlationId);
    if (row.binding_status !== "enabled" || row.installation_status !== "enabled" || row.lifecycle_status !== "approved") {
      throw authorizationError("PLUGIN_NOT_APPROVED", "The Plugin is not authorized for a new run.", correlationId);
    }
    const publisher = await client.query(
      `SELECT 1 FROM extension.publishers
        WHERE organization_id=$1 AND id=$2 AND status='approved' FOR SHARE`,
      [principal.organizationId, row.publisher_id]
    );
    if (publisher.rowCount !== 1) throw authorizationError("PLUGIN_NOT_APPROVED", "The Plugin Publisher is not approved for a new run.", correlationId);
    const revocations = await client.query<{ document: PluginRevocationsV1 }>(
      `SELECT document FROM extension.revocation_lists
        WHERE organization_id=$1 AND publisher_id=$2 ORDER BY generated_at DESC LIMIT 1`,
      [principal.organizationId, row.publisher_id]
    );
    const document = revocations.rows[0]?.document;
    if (document === undefined || document.revokedKeyIds.includes(row.manifest.publisher.signatureKeyId) ||
        document.revokedDigests.includes(row.artifact_digest)) {
      throw authorizationError("PLUGIN_NOT_APPROVED", "The Plugin is revoked or current revocation data is unavailable.", correlationId);
    }
    return { bindingId, installationId: row.installation_id, artifactId: row.artifact_id,
      artifactDigest: row.artifact_digest, configurationDigest: row.configuration_digest };
  });
}

export async function revokePluginArtifact(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  artifactId: string,
  correlationId: string,
  now = new Date()
): Promise<void> {
  requireRole(principal, ["admin"], correlationId);
  if (!uuidPattern.test(artifactId)) throw validationError(new Error("Plugin Artifact ID is invalid"), correlationId);
  await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["admin"], correlationId);
    const result = await client.query<{ lifecycle_status: string; digest: string }>(
      `SELECT lifecycle_status,digest FROM extension.plugin_artifacts
        WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
      [principal.organizationId, artifactId]
    );
    const artifact = result.rows[0];
    if (artifact === undefined) throw authorizationError("NOT_FOUND", "The Plugin Artifact was not found.", correlationId);
    if (artifact.lifecycle_status === "revoked") return;
    await client.query(
      `UPDATE extension.plugin_artifacts SET lifecycle_status='revoked',revoked_at=$1
        WHERE organization_id=$2 AND id=$3`,
      [now, principal.organizationId, artifactId]
    );
    await writeAudit(client, principal, "plugin_artifact.revoked", `plugin_artifact:${artifactId}`, correlationId,
      { digest: artifact.digest });
  });
}

export async function getPluginCatalog(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  correlationId: string
): Promise<Array<RegisteredPluginArtifact & { installed: boolean }>> {
  requireRole(principal, ["admin", "designer", "publisher"], correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["admin", "designer", "publisher"], correlationId);
    const result = await client.query<{
      id: string; plugin_id: string; version: string; digest: string; lifecycle_status: string; installed: boolean;
    }>(
      `SELECT artifact.id,artifact.plugin_id,artifact.version,artifact.digest,artifact.lifecycle_status,
              EXISTS (SELECT 1 FROM extension.plugin_installations installation
                WHERE installation.organization_id=artifact.organization_id AND installation.artifact_id=artifact.id
                  AND installation.status='enabled') AS installed
         FROM extension.plugin_artifacts artifact
        WHERE artifact.organization_id=$1 AND artifact.lifecycle_status IN ('approved','revoked','suspended')
        ORDER BY artifact.plugin_id,artifact.version`,
      [principal.organizationId]
    );
    return result.rows.map((row) => ({ artifactId: row.id, pluginId: row.plugin_id, version: row.version,
      digest: row.digest, lifecycleStatus: row.lifecycle_status, installed: row.installed }));
  });
}
