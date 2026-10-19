import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertPluginPermissions,
  createOfflinePluginBundle,
  createPluginHostApiStub,
  createPluginRevocations,
  pluginDigest,
  runPluginFixtures,
  verifyOfflinePluginBundle
} from "../dist/index.js";
import { execute } from "../fixtures/synthetic-risk-score/plugin.mjs";

const fixtureRoot = new URL("../fixtures/synthetic-risk-score/", import.meta.url);
const publisherId = "22000000-0000-4000-8000-000000000001";
const publisherKeyId = "synthetic-publisher-key-1";
const revocationKeyId = "synthetic-revocation-key-1";
const now = new Date("2026-10-19T12:00:00.000Z");
const publisherKeys = generateKeyPairSync("ed25519");
const revocationKeys = generateKeyPairSync("ed25519");

async function fixtureBundle(connectivity = "offline_capable", vulnerabilities = [], sbomOverride) {
  const plugin = await readFile(new URL("plugin.mjs", fixtureRoot));
  const inputSchema = await readFile(new URL("input.schema.json", fixtureRoot));
  const outputSchema = await readFile(new URL("output.schema.json", fixtureRoot));
  const sbom = sbomOverride ?? await readFile(new URL("sbom.cdx.json", fixtureRoot));
  const manifest = {
    contractId: "plugin-manifest-v1",
    manifestVersion: "1.0.0",
    pluginId: "org.ssg.fixtures.synthetic-risk-score",
    version: "1.0.0",
    digest: pluginDigest(plugin),
    artifactPath: "plugin/plugin.mjs",
    publisher: { id: publisherId, signatureKeyId: publisherKeyId },
    categories: ["world_and_simulation"],
    capabilities: ["compute", "propose_effect"],
    execution: { mode: "container", entrypoint: "plugin/plugin.mjs", rootless: true, readOnlyRoot: true },
    connectivity,
    contracts: { inputSchema: "schemas/input.json", outputSchema: "schemas/output.json" },
    compatibility: { hostApi: ">=1.0.0 <2.0.0", releaseSchema: ">=1.3.0 <2.0.0" },
    limits: { timeoutSeconds: 5, memoryMiB: 64, cpuMillis: 1000, outputBytes: 4096 },
    requestedPermissions: ["state_values.read:mapped", "effects.propose"],
    dataClassificationMaximum: "internal",
    reproducibility: { deterministic: true, seedInput: "seed" },
    dependencies: [],
    provenance: { sourceRevision: "synthetic-fixture-only", buildSystem: "none" },
    license: "fixture-license-v1"
  };
  const files = new Map([
    ["plugin/plugin.mjs", plugin],
    ["schemas/input.json", inputSchema],
    ["schemas/output.json", outputSchema],
    ["sbom/sbom.cdx.json", sbom]
  ]);
  return createOfflinePluginBundle({
    manifest,
    files,
    supplyChain: {
      sbomPath: "sbom/sbom.cdx.json",
      attestationType: "synthetic-fixture-attestation",
      attestedAt: now.toISOString(),
      vulnerabilities,
      vulnerabilityExceptions: [],
      license: manifest.license
    },
    privateKey: publisherKeys.privateKey
  });
}

function trustRoot() {
  return {
    publisherId,
    publisherKeyId,
    publisherPublicKey: publisherKeys.publicKey,
    revocationKeyId,
    revocationPublicKey: revocationKeys.publicKey
  };
}

function revocations(generatedAt = now.toISOString(), revokedDigests = []) {
  return createPluginRevocations({
    generatedAt,
    publisherId,
    revokedDigests,
    keyId: revocationKeyId,
    privateKey: revocationKeys.privateKey
  });
}

function verify(bytes, options = {}) {
  return verifyOfflinePluginBundle(bytes, {
    trustRoot: trustRoot(),
    revocations: options.revocations ?? revocations(),
    hostApiVersion: "1.0.0",
    releaseSchemaVersion: "1.3.1",
    acceptedLicenses: new Set(["fixture-license-v1"]),
    deploymentProfile: options.deploymentProfile ?? "air_gapped",
    now
  });
}

test("REQ-094 EXT-02/04 SDK signs, validates, and runs the clearly synthetic fixture", async () => {
  const built = await fixtureBundle();
  const verified = verify(built.bytes);
  assert.equal(verified.bundle.manifest.digest, built.bundle.manifest.digest);
  assertPluginPermissions(verified.bundle.manifest, ["state_values.read:mapped", "effects.propose"]);

  const inputSchema = JSON.parse(await readFile(new URL("input.schema.json", fixtureRoot), "utf8"));
  const outputSchema = JSON.parse(await readFile(new URL("output.schema.json", fixtureRoot), "utf8"));
  const fixtures = JSON.parse(await readFile(new URL("fixtures.json", fixtureRoot), "utf8"));
  const host = createPluginHostApiStub({ permissions: verified.bundle.manifest.requestedPermissions });
  await runPluginFixtures({ inputSchema, outputSchema, fixtures, execute, host });
});

test("EXT-03 rejects tampered and stale offline trust material without network access", async () => {
  const built = await fixtureBundle();
  const tampered = built.bytes.slice();
  tampered[Math.floor(tampered.byteLength / 2)] ^= 1;
  assert.throws(() => verify(tampered), /bundle|canonical|signature|digest|JSON/i);

  const stale = revocations("2026-09-18T11:59:59.000Z");
  assert.throws(() => verify(built.bytes, { revocations: stale }), /stale/i);
});

test("EXT-05 blocks external-required Plugins in an air-gapped profile", async () => {
  const built = await fixtureBundle("external_required");
  assert.throws(() => verify(built.bytes), /air-gapped/i);
  assert.equal(verify(built.bytes, { deploymentProfile: "connected" }).bundle.manifest.connectivity, "external_required");
});

test("EXT-16 and the approval gate reject revoked or critically vulnerable artifacts", async () => {
  const built = await fixtureBundle();
  assert.throws(() => verify(built.bytes, { revocations: revocations(now.toISOString(), [built.bundle.manifest.digest]) }), /revoked/i);

  const vulnerable = await fixtureBundle("offline_capable", [{ id: "CVE-SYNTHETIC-1", severity: "critical" }]);
  assert.throws(() => verify(vulnerable.bytes), /critical vulnerability/i);

  const invalidSbom = await fixtureBundle("offline_capable", [], new TextEncoder().encode("{}"));
  assert.throws(() => verify(invalidSbom.bytes), /CycloneDX/i);
});

test("SDK permission checks fail closed", async () => {
  const built = await fixtureBundle();
  assert.throws(() => assertPluginPermissions(built.bundle.manifest, ["effects.propose"]), /not granted/i);
  const host = createPluginHostApiStub({ permissions: [] });
  assert.throws(() => host.readMappedState("hidden"), /permission/i);
  assert.throws(() => host.proposeEffect({ type: "synthetic" }), /permission/i);
});
