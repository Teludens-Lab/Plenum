import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMMAND_ENVELOPE_CONTRACT_ID,
  COMMAND_RECEIPT_CONTRACT_ID,
  DOMAIN_EVENT_CONTRACT_ID,
  ERROR_ENVELOPE_CONTRACT_ID,
  EVENT_ENVELOPE_CONTRACT_ID,
  commandEnvelopeV1Schema,
  commandReceiptV1Schema,
  domainEventV1Schema,
  errorEnvelopeV1Schema,
  eventEnvelopeV1Schema,
  isCommandOperationType,
  isPastTenseEventType
} from "../packages/event-contracts/dist/index.js";

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
assert.equal(commandReceiptV1Schema.$id, COMMAND_RECEIPT_CONTRACT_ID);
assert.equal(domainEventV1Schema.$id, DOMAIN_EVENT_CONTRACT_ID);
assert.equal(eventEnvelopeV1Schema.$id, EVENT_ENVELOPE_CONTRACT_ID);
assert.equal(errorEnvelopeV1Schema.$id, ERROR_ENVELOPE_CONTRACT_ID);

for (const schema of [commandEnvelopeV1Schema, commandReceiptV1Schema, domainEventV1Schema, eventEnvelopeV1Schema, errorEnvelopeV1Schema]) {
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
)).flat().filter((file) => file.endsWith(".ts") && !file.split(path.sep).includes("dist"));

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

console.log(`Contract lint PASS: ${sourceFiles.length} sources, 5 versioned contracts, canonical naming, acyclic workspaces.`);
