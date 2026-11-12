// Synthetic signed bundle for boundary tests; keys are generated for each invocation.
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createOfflinePluginBundle, pluginDigest } from "@plenum/plugin-sdk";

export async function signedEffectFixture(overrides = {}, source) {
  const keys = generateKeyPairSync("ed25519");
  const root = new URL("./synthetic-effect/", import.meta.url);
  const plugin = source === undefined ? await readFile(new URL("plugin.mjs", root)) : Buffer.from(source);
  const manifest = {
    contractId: "plugin-manifest-v1", manifestVersion: "1.0.0", pluginId: "org.ssg.fixtures.synthetic-effect", version: "1.0.0",
    digest: pluginDigest(plugin), artifactPath: "plugin.mjs", publisher: { id: randomUUID(), signatureKeyId: "synthetic" },
    categories: ["world_and_simulation"], capabilities: ["compute", "propose_effect"],
    execution: { mode: "container", entrypoint: "plugin.mjs", rootless: true, readOnlyRoot: true }, connectivity: "offline_capable",
    contracts: { inputSchema: "input.json", outputSchema: "output.json" }, compatibility: { hostApi: ">=1.0.0 <2.0.0", releaseSchema: ">=1.3.0 <2.0.0" },
    limits: { timeoutSeconds: 5, memoryMiB: 64, cpuMillis: 1000, outputBytes: 8192 }, requestedPermissions: ["state_values.read:mapped", "effects.propose"],
    dataClassificationMaximum: "internal", reproducibility: { deterministic: true, seedInput: "seed" }, dependencies: [],
    provenance: { sourceRevision: "BA-08-synthetic", buildSystem: "test" }, license: "fixture-license-v1", ...overrides
  };
  const files = new Map([["plugin.mjs", plugin],
    ["input.json", await readFile(new URL("input.schema.json", root))],
    ["output.json", await readFile(new URL("output.schema.json", root))],
    ["sbom.json", Buffer.from(JSON.stringify({ bomFormat: "CycloneDX", specVersion: "1.5", version: 1,
      components: [{ type: "application", name: manifest.pluginId, version: manifest.version, licenses: [{ license: { name: manifest.license } }] }] }))]]);
  const built = createOfflinePluginBundle({ manifest, files, supplyChain: { sbomPath: "sbom.json", attestationType: "synthetic-fixture-attestation",
    attestedAt: new Date().toISOString(), vulnerabilities: [], vulnerabilityExceptions: [], license: manifest.license }, privateKey: keys.privateKey });
  return { ...built, keys, request: { bundleBase64: Buffer.from(built.bytes).toString("base64"),
    publisherPublicKey: keys.publicKey.export({ type: "spki", format: "pem" }).toString(),
    bundleDigest: built.bundleDigest, manifestDigest: built.manifestDigest, artifactDigest: built.bundle.manifest.digest,
    inputs: { seed: 42, pressure: 10, effectId: randomUUID(), targetAggregateId: randomUUID() } } };
}
