import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMMAND_ENVELOPE_CONTRACT_ID,
  ARTIFACT_COMMAND_CONTRACT_ID,
  STAGE_COMMAND_CONTRACT_ID,
  INJECT_COMMAND_CONTRACT_ID,
  MESSAGE_COMMAND_CONTRACT_ID,
  COMMAND_RECEIPT_CONTRACT_ID,
  DOMAIN_EVENT_CONTRACT_ID,
  ERROR_ENVELOPE_CONTRACT_ID,
  EVENT_ENVELOPE_CONTRACT_ID,
  RUNTIME_SSE_CONTRACT_ID,
  RUNTIME_PROJECTION_CONTRACT_ID,
  MODEL_RUN_CONTRACT_ID,
  EFFECT_PROPOSAL_CONTRACT_ID,
  APPROVAL_DECISION_CONTRACT_ID,
  VOICE_COMMAND_CONTRACT_ID,
  MEDIA_CREDENTIAL_CONTRACT_ID,
  FLOOR_LEASE_CONTRACT_ID,
  VOICE_CONSENT_CONTRACT_ID,
  STUDIO_CRDT_CONTRACT_ID,
  STUDIO_PUBLISH_CONTRACT_ID,
  ROLE_PREVIEW_CONTRACT_ID,
  SYNC_DELTAS_CONTRACT_ID,
  SYNC_SNAPSHOT_CONTRACT_ID,
  commandEnvelopeV1Schema,
  artifactCommandV1Schema,
  stageCommandV1Schema,
  injectCommandV1Schema,
  messageCommandV1Schema,
  commandReceiptV1Schema,
  domainEventV1Schema,
  errorEnvelopeV1Schema,
  eventEnvelopeV1Schema,
  runtimeSseV1Schema,
  runtimeProjectionV1Schema,
  modelRunV1Schema,
  effectProposalV1Schema,
  approvalDecisionV1Schema,
  voiceCommandV1Schema,
  mediaCredentialV1Schema,
  floorLeaseV1Schema,
  voiceConsentV1Schema,
  studioCrdtV1Schema,
  studioPublishV1Schema,
  rolePreviewV1Schema,
  syncDeltasV1Schema,
  syncSnapshotV1Schema,
  isCommandOperationType,
  isPastTenseEventType
} from "../packages/event-contracts/dist/index.js";
import {
  PLUGIN_MANIFEST_CONTRACT_ID,
  pluginManifestV1Schema
} from "../packages/plugin-sdk/dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  }));
  return nested.flat();
}

function checkCamelCaseProperties(schema, location = schema.$id) {
  for (const [name, value] of Object.entries(schema.properties ?? {})) {
    assert.match(name, /^[a-z][A-Za-z0-9]*$/, `${location}.${name} must use camelCase`);
    if (value && typeof value === "object" && "properties" in value) {
      checkCamelCaseProperties(value, `${location}.${name}`);
    }
  }
}

async function readPackageGraph() {
  const manifests = await Promise.all(
    ["apps", "packages"].map(async (folder) => {
      const paths = (await filesBelow(path.join(root, folder)))
        .filter((file) => path.basename(file) === "package.json");
      return Promise.all(paths.map(async (file) => JSON.parse(await readFile(file, "utf8"))));
    })
  );
  const packages = new Map(manifests.flat().map((manifest) => [manifest.name, manifest]));

  const visiting = new Set();
  const visited = new Set();
  function visit(name) {
    if (visiting.has(name)) throw new Error(`Circular workspace dependency at ${name}`);
    if (visited.has(name)) return;
    visiting.add(name);
    const manifest = packages.get(name);
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (packages.has(dependency)) visit(dependency);
    }
    visiting.delete(name);
    visited.add(name);
  }
  for (const name of packages.keys()) visit(name);
}

assert.equal(commandEnvelopeV1Schema.$id, COMMAND_ENVELOPE_CONTRACT_ID);
assert.equal(artifactCommandV1Schema.$id, ARTIFACT_COMMAND_CONTRACT_ID);
assert.equal(stageCommandV1Schema.$id, STAGE_COMMAND_CONTRACT_ID);
assert.equal(injectCommandV1Schema.$id, INJECT_COMMAND_CONTRACT_ID);
assert.equal(messageCommandV1Schema.$id, MESSAGE_COMMAND_CONTRACT_ID);
assert.equal(commandReceiptV1Schema.$id, COMMAND_RECEIPT_CONTRACT_ID);
assert.equal(domainEventV1Schema.$id, DOMAIN_EVENT_CONTRACT_ID);
assert.equal(eventEnvelopeV1Schema.$id, EVENT_ENVELOPE_CONTRACT_ID);
assert.equal(errorEnvelopeV1Schema.$id, ERROR_ENVELOPE_CONTRACT_ID);
assert.equal(runtimeSseV1Schema.$id, RUNTIME_SSE_CONTRACT_ID);
assert.equal(runtimeProjectionV1Schema.$id, RUNTIME_PROJECTION_CONTRACT_ID);
assert.equal(modelRunV1Schema.$id, MODEL_RUN_CONTRACT_ID);
assert.equal(effectProposalV1Schema.$id, EFFECT_PROPOSAL_CONTRACT_ID);
assert.equal(approvalDecisionV1Schema.$id, APPROVAL_DECISION_CONTRACT_ID);
assert.equal(voiceCommandV1Schema.$id, VOICE_COMMAND_CONTRACT_ID);
assert.equal(mediaCredentialV1Schema.$id, MEDIA_CREDENTIAL_CONTRACT_ID);
assert.equal(floorLeaseV1Schema.$id, FLOOR_LEASE_CONTRACT_ID);
assert.equal(voiceConsentV1Schema.$id, VOICE_CONSENT_CONTRACT_ID);
assert.equal(studioCrdtV1Schema.$id, STUDIO_CRDT_CONTRACT_ID);
assert.equal(studioPublishV1Schema.$id, STUDIO_PUBLISH_CONTRACT_ID);
assert.equal(rolePreviewV1Schema.$id, ROLE_PREVIEW_CONTRACT_ID);
assert.equal(syncDeltasV1Schema.$id, SYNC_DELTAS_CONTRACT_ID);
assert.equal(syncSnapshotV1Schema.$id, SYNC_SNAPSHOT_CONTRACT_ID);
assert.equal(pluginManifestV1Schema.$id, PLUGIN_MANIFEST_CONTRACT_ID);

const contractSchemas = [artifactCommandV1Schema, stageCommandV1Schema, injectCommandV1Schema, messageCommandV1Schema,
  commandEnvelopeV1Schema, commandReceiptV1Schema, domainEventV1Schema,
  eventEnvelopeV1Schema, errorEnvelopeV1Schema, runtimeProjectionV1Schema, runtimeSseV1Schema,
  syncDeltasV1Schema, syncSnapshotV1Schema, modelRunV1Schema, effectProposalV1Schema,
  approvalDecisionV1Schema, voiceCommandV1Schema, mediaCredentialV1Schema, floorLeaseV1Schema,
  voiceConsentV1Schema,
  studioCrdtV1Schema, studioPublishV1Schema,
  rolePreviewV1Schema,
  pluginManifestV1Schema];
for (const schema of contractSchemas) {
  checkCamelCaseProperties(schema);
}

assert.equal(isCommandOperationType("artifact.submit"), true);
assert.equal(isCommandOperationType("artifact.submitted"), false);
assert.equal(isCommandOperationType("ARTIFACT_SUBMIT"), false);
assert.equal(isPastTenseEventType("artifact.submitted"), true);
assert.equal(isPastTenseEventType("ballot.cast"), true);
assert.equal(isPastTenseEventType("artifact.submit"), false);

const sourceFiles = (await Promise.all(
  ["apps", "packages"].map((folder) => filesBelow(path.join(root, folder)))
)).flat().filter((file) => (file.endsWith(".ts") || file.endsWith(".tsx")) && !file.split(path.sep).includes("dist"));

const forbiddenAliases = /\b(?:runId|phaseId|roleId|tenantId|gameId|playerId|matchId)\b/u;
const simulationSpecific = /(?:fractured[ -]order|white_cell|\bscribe\b|\bfacilitator\b|\b(?:blue|red|green|industry) team\b)/iu;
const demoIdentity = /(?:x-demo-|demo-(?:user|role)|PLENUM_LOCAL_DEMO)/u;

for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  assert.doesNotMatch(source, forbiddenAliases, `${path.relative(root, file)} uses a noncanonical Glossary alias`);
  assert.doesNotMatch(source, simulationSpecific, `${path.relative(root, file)} contains simulation-specific vocabulary`);
  if (file.includes(`${path.sep}apps${path.sep}`)) {
    assert.doesNotMatch(source, demoIdentity, `${path.relative(root, file)} contains demo identity handling`);
  }
  if (
    file.includes(`${path.sep}packages${path.sep}event-contracts${path.sep}`) ||
    file.includes(`${path.sep}packages${path.sep}simulation-schema${path.sep}`)
  ) {
    assert.doesNotMatch(source, /\borganizationId\b/u, `${path.relative(root, file)} exposes a tenant identifier`);
  }
}

await readPackageGraph();

const workspaceLockfiles = (await Promise.all(
  ["apps", "packages"].map((folder) => filesBelow(path.join(root, folder)))
)).flat().filter((file) => path.basename(file) === "package-lock.json");
assert.deepEqual(workspaceLockfiles, [], "apps and packages must use the root lockfile");

console.log(`Contract lint PASS: ${sourceFiles.length} sources, ${contractSchemas.length} versioned contracts, canonical naming, acyclic workspaces.`);
