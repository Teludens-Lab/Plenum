import { createHash, createPublicKey } from "node:crypto";
import { canonicalizeJson, type JsonObject } from "@plenum/event-contracts";
import { invokeExtensionSupervisor, probeExtensionSupervisor, type VerifiedHostBundle } from "@plenum/extension-host";
import { assertPluginPermissions, verifyPluginBundleForIntake, MAX_PLUGIN_BUNDLE_BYTES, type PluginManifestV1 } from "@plenum/plugin-sdk";
import { audienceAllows, type OrganizationRole } from "@plenum/policy-engine";
import { compileModelComposition } from "@plenum/release-compiler";
import type { CoreDesignV1 } from "@plenum/simulation-schema";
import type { Pool, PoolClient } from "pg";
import { withOrganizationTransaction } from "../database.js";
import type { SessionAccessContextV1 } from "../identity/context.js";
import type { ObjectStore } from "../registry/object-store.js";
import type { ExtensionRunPlan, ExtensionRuntime } from "./runtime.js";

const rank = { public: 0, internal: 1, confidential: 2, restricted: 3 } as const;
const digest = (value: unknown) => `sha256:${createHash("sha256").update(canonicalizeJson(value as JsonObject)).digest("hex")}`;

export async function resolveReleaseModelPlan(client: PoolClient, context: SessionAccessContextV1, planId: string,
  deploymentId: string, profile: "cloud" | "institutional" | "air_gapped"): Promise<ExtensionRunPlan | undefined> {
  const release = await client.query<{ snapshot: { coreDesign: CoreDesignV1 }; definition_revision_id: string }>(
    `SELECT revision.snapshot,release.definition_revision_id FROM registry.releases release
       JOIN studio.definition_revisions revision ON revision.organization_id=release.organization_id AND revision.id=release.definition_revision_id
      WHERE release.organization_id=$1 AND release.id=$2`, [context.organizationId, context.activeReleaseId]);
  const row = release.rows[0], core = row?.snapshot.coreDesign;
  const composition = core?.compositions?.find(item => item.id === planId);
  if (!row || !core || !composition?.executionPolicy) return undefined;
  const policy = composition.executionPolicy;
  if (!policy.triggerSessionRoleIds.includes(context.activeSessionRoleId)) return undefined;
  const compiled = compileModelComposition(composition, core.pluginBindings, new Set((core.sessionRoles ?? []).map(role => role.id)));
  if (composition.graphDigest !== undefined && composition.graphDigest !== compiled.graphDigest) throw new Error("Composition digest mismatch");
  const models = composition.nodes.filter(node => node.kind === "model"), gates = composition.nodes.filter(node => node.kind === "approval_gate");
  // Only the existing single-model executor is activated; a graph must never be silently truncated.
  if (models.length !== 1 || gates.length !== 1 || composition.nodes.some(node => !["model", "approval_gate", "output"].includes(node.kind))) return undefined;
  if (!composition.edges.some(edge => edge.fromNodeId === models[0]!.id && edge.toNodeId === gates[0]!.id &&
      models[0]!.outputPorts.some(port => port.id === edge.fromPortId && port.dataType === "effect_proposal") &&
      gates[0]!.inputPorts.some(port => port.id === edge.toPortId && port.dataType === "effect_proposal"))) return undefined;
  const definition = core.pluginBindings.find(binding => binding.id === models[0]!.bindingId);
  if (!definition || definition.dependencies?.length || !definition.enabledInProfiles.includes(profile) || definition.connectivity !== "offline_capable" ||
      definition.configurationDigest !== digest(definition.configuration)) return undefined;
  const binding = await client.query<{ id: string; manifest: PluginManifestV1; permitted_permissions: string[] }>(
    `SELECT binding.id,artifact.manifest,installation.permitted_permissions FROM extension.plugin_bindings binding
       JOIN extension.plugin_installations installation ON installation.organization_id=binding.organization_id AND installation.id=binding.installation_id
       JOIN extension.plugin_artifacts artifact ON artifact.organization_id=installation.organization_id AND artifact.id=installation.artifact_id
      WHERE binding.organization_id=$1 AND binding.definition_revision_id=$2 AND binding.installation_id=$3
        AND binding.artifact_digest=$4 AND binding.configuration_digest=$5 AND installation.deployment_id=$6
        AND artifact.plugin_id=$7 AND artifact.version=$8 AND artifact.digest=$4 AND installation.artifact_digest=$4
        AND binding.status='enabled' AND installation.status='enabled' AND artifact.lifecycle_status='approved' AND binding.deployment_profile=$9
      ORDER BY binding.id LIMIT 2 FOR SHARE OF artifact`,
    [context.organizationId, row.definition_revision_id, definition.installationId, definition.pluginDigest,
      definition.configurationDigest, deploymentId, definition.pluginId, definition.pluginVersion,
      profile === "cloud" ? "connected" : profile === "institutional" ? "self_hosted" : "air_gapped"]);
  if (binding.rows.length !== 1) return undefined;
  const selected = binding.rows[0]!;
  assertPluginPermissions(selected.manifest, selected.permitted_permissions);
  if (!Number.isInteger(definition.timeoutSeconds) || definition.timeoutSeconds < selected.manifest.limits.timeoutSeconds ||
      selected.manifest.connectivity !== "offline_capable" || selected.manifest.dependencies.length ||
      selected.manifest.requestedPermissions.some(permission => !["state_values.read:mapped", "effects.propose"].includes(permission))) return undefined;
  const role = core.sessionRoles?.find(item => item.id === context.activeSessionRoleId);
  const seat = core.seats?.find(item => item.id === context.seatId && item.sessionRoleIds.includes(context.activeSessionRoleId));
  if (!role || !seat) return undefined;
  const visible = (stateVariableId: string, ceiling: keyof typeof rank): boolean => {
    const variable = core.stateVariables?.find(item => item.id === stateVariableId);
    const information = core.informationPolicies?.find(item => item.id === variable?.informationPolicyId);
    return !!information && rank[information.classification ?? "internal"] <= rank[ceiling] && information.grants.some(grant => audienceAllows({
      organizationId: context.organizationId, sessionId: context.sessionId, participantId: context.participantId,
      activeSessionRoleId: role.id, ...(seat.teamId ? { activeTeamId: seat.teamId } : {}), isControlRole: role.isControlRole,
      organizationRoles: context.organizationRoles as OrganizationRole[]
    }, grant.audience));
  };
  if (definition.inputMappings.length > 64 || new Set(definition.inputMappings.map(mapping => mapping.target)).size !== definition.inputMappings.length) return undefined;
  const inputMappings: ExtensionRunPlan["inputMappings"] = [];
  for (const mapping of definition.inputMappings) {
    const stateVariableId = mapping.source.startsWith("state.") ? mapping.source.slice(6) : "";
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(mapping.target) || mapping.target === "seed" ||
        !visible(stateVariableId, mapping.maxClassification ?? "internal") || !visible(stateVariableId, selected.manifest.dataClassificationMaximum) ||
        (mapping.scopeReference ?? "").length > 200) return undefined;
    inputMappings.push({ inputKey: mapping.target, stateVariableId, scopeReference: mapping.scopeReference ?? "" });
  }
  if (policy.allowedEffects.some(effect => !visible(effect.stateVariableId, selected.manifest.dataClassificationMaximum))) return undefined;
  return { id: composition.id, governingReleaseId: context.activeReleaseId, bindingId: selected.id, graphDigest: compiled.graphDigest!,
    seed: policy.seed, triggerSessionRoleIds: policy.triggerSessionRoleIds, reviewerSessionRoleIds: gates[0]!.approverSessionRoleIds!,
    inputMappings, allowedEffects: policy.allowedEffects };
}

export function createProductionExtensionRuntime(pool: Pool, store: ObjectStore, deploymentId: string,
  profile: "cloud" | "institutional" | "air_gapped", socketPath: string): ExtensionRuntime {
  if (!socketPath.startsWith("/") || socketPath.includes("\0")) throw new Error("PLENUM_EXTENSION_SOCKET must be an absolute Unix socket path");
  let checkedAt = 0, available = false, checking: Promise<boolean> | undefined;
  const isAvailable = async () => {
    if (Date.now() - checkedAt < 1000) return available;
    checking ??= probeExtensionSupervisor(socketPath).then(result => { available = result; checkedAt = Date.now(); return result; })
      .finally(() => { checking = undefined; });
    return checking;
  };
  return {
    deploymentId, isAvailable,
    plans: async (client, context, planId) => await isAvailable() ? resolveReleaseModelPlan(client, context, planId, deploymentId, profile) : undefined,
    loadArtifact: async (artifactId, organizationId) => {
      const artifact = await withOrganizationTransaction(pool, organizationId, async client => {
        const result = await client.query<{ object_key: string; digest: string; bundle_digest: string; manifest_digest: string; publisher_public_key_pem: string }>(
          `SELECT artifact.object_key,artifact.digest,artifact.bundle_digest,artifact.manifest_digest,trust.publisher_public_key_pem
             FROM extension.plugin_artifacts artifact JOIN extension.publishers publisher
               ON publisher.organization_id=artifact.organization_id AND publisher.id=artifact.publisher_id AND publisher.status='approved'
             JOIN LATERAL (SELECT publisher_public_key_pem FROM extension.trust_roots
               WHERE organization_id=artifact.organization_id AND publisher_id=artifact.publisher_id
                 AND publisher_key_id=artifact.manifest#>>'{publisher,signatureKeyId}' ORDER BY provisioned_at DESC LIMIT 1) trust ON true
            WHERE artifact.organization_id=$1 AND artifact.id=$2 AND artifact.lifecycle_status='approved'`, [organizationId, artifactId]);
        if (!result.rows[0]) throw new Error("Approved artifact unavailable");
        return result.rows[0];
      });
      const bytes = await store.get(artifact.object_key, AbortSignal.timeout(10_000));
      if (bytes.byteLength > MAX_PLUGIN_BUNDLE_BYTES) throw new Error("Plugin bundle exceeds custody limit");
      const verifiedBundle: VerifiedHostBundle = { bundleBase64: Buffer.from(bytes).toString("base64"), publisherPublicKey: artifact.publisher_public_key_pem,
        bundleDigest: artifact.bundle_digest, manifestDigest: artifact.manifest_digest, artifactDigest: artifact.digest };
      // Verify custody here, and again at the supervisor. Input validation follows after snapshot loading.
      const envelope = JSON.parse(Buffer.from(bytes).toString("utf8")) as { manifest: PluginManifestV1 };
      const verified = verifyPluginBundleForIntake(bytes, { publisherId: envelope.manifest.publisher.id,
        publisherKeyId: envelope.manifest.publisher.signatureKeyId, publisherPublicKey: createPublicKey(artifact.publisher_public_key_pem) });
      if (verified.bundleDigest !== artifact.bundle_digest || verified.manifestDigest !== artifact.manifest_digest || verified.bundle.manifest.digest !== artifact.digest) throw new Error("Immutable artifact mismatch");
      return { manifest: verified.bundle.manifest, verifiedBundle,
        inputSchema: JSON.parse(Buffer.from(verified.files.get(verified.bundle.manifest.contracts.inputSchema)!).toString("utf8")) as unknown,
        outputSchema: JSON.parse(Buffer.from(verified.files.get(verified.bundle.manifest.contracts.outputSchema)!).toString("utf8")) as unknown };
    },
    execute: async artifact => {
      if (!artifact.verifiedBundle) throw new Error("Verified artifact custody is required");
      const request = { ...artifact.verifiedBundle, inputs: artifact.inputs };
      return invokeExtensionSupervisor(socketPath, request, artifact.manifest.limits.timeoutSeconds * 1000 + 25_000);
    }
  };
}
