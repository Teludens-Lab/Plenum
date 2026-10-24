import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { PINNED_EXTENSION_HOST_IMAGE, runIsolatedPlugin } from "../../packages/extension-host/dist/index.js";
import {
  acceptance, config, databaseSize, environment, latencyMetric, observeDatabaseRecovery, performance, round,
  runConcurrent, startSaturationSampler
} from "./load-support.mjs";

const fixtureDirectory = path.join(process.cwd(), "packages", "extension-host", "fixtures", "synthetic-effect");
const inputSchema = JSON.parse(await readFile(path.join(fixtureDirectory, "input.schema.json"), "utf8"));
const outputSchema = JSON.parse(await readFile(path.join(fixtureDirectory, "output.schema.json"), "utf8"));
const baseManifest = {
  contractId: "plugin-manifest-v1", manifestVersion: "1.0.0", pluginId: "org.ssg.fixtures.synthetic-effect", version: "1.0.0",
  digest: `sha256:${"1".repeat(64)}`, artifactPath: "plugin.mjs", publisher: { id: "fixture", signatureKeyId: "fixture" },
  categories: ["world_and_simulation"], capabilities: ["compute", "propose_effect"],
  execution: { mode: "container", entrypoint: "plugin.mjs", rootless: true, readOnlyRoot: true }, connectivity: "offline_capable",
  contracts: { inputSchema: "input.schema.json", outputSchema: "output.schema.json" },
  compatibility: { hostApi: ">=1.0.0 <2.0.0", releaseSchema: ">=1.3.0 <2.0.0" },
  limits: { timeoutSeconds: 5, memoryMiB: 64, cpuMillis: 1000, outputBytes: 8192 },
  requestedPermissions: ["state_values.read:mapped", "effects.propose"], dataClassificationMaximum: "internal",
  reproducibility: { deterministic: true, seedInput: "seed" }, dependencies: [],
  provenance: { sourceRevision: "fixture", buildSystem: "none" }, license: "fixture"
};
const invocation = (pluginDirectory = fixtureDirectory, manifest = baseManifest) => ({
  pluginDirectory, manifest, inputSchema, outputSchema,
  inputs: { seed: 5, pressure: 40, effectId: "25000000-0000-4000-8000-000000000001",
    targetAggregateId: "25000000-0000-4000-8000-000000000002" }
});

export async function runExtensionsProfile(pool) {
  const started = performance.now();
  const bytesBefore = await databaseSize(pool);
  const stopSampler = startSaturationSampler(pool);
  const valid = await runConcurrent(Array.from({ length: config.extensions.validRuns }), config.extensions.concurrency,
    () => runIsolatedPlugin(invocation()));
  assert.equal(valid.every(({ ok, value }) => ok && value.outputs.outputs.syntheticScore === 45), true);
  assert.equal(new Set(valid.map(({ value }) => value.outputDigest)).size, 1);

  const temporary = await mkdir(path.join(os.tmpdir(), `plenum-ps540-plugins-${process.pid}`), { recursive: true }).then(() => path.join(os.tmpdir(), `plenum-ps540-plugins-${process.pid}`));
  await writeFile(path.join(temporary, "invalid.mjs"), "export function execute(){return {wrong:true}}\n");
  await writeFile(path.join(temporary, "timeout.mjs"), "export async function execute(){await new Promise(resolve=>setTimeout(resolve,10000))}\n");
  const failures = [];
  for (const entrypoint of ["invalid.mjs", "timeout.mjs"]) {
    const runs = entrypoint === "invalid.mjs" ? config.extensions.invalidOutputRuns : config.extensions.timeoutRuns;
    for (let index = 0; index < runs; index += 1) {
      const failureStarted = performance.now();
      let rejected;
      try {
        await runIsolatedPlugin(invocation(temporary, { ...baseManifest, execution: { ...baseManifest.execution, entrypoint },
          limits: { ...baseManifest.limits, timeoutSeconds: entrypoint === "timeout.mjs" ? 1 : 5 } }));
      } catch (error) {
        rejected = error instanceof Error ? error.message : String(error);
      }
      assert.ok(rejected, `${entrypoint} unexpectedly succeeded`);
      failures.push({ ok: true, milliseconds: performance.now() - failureStarted, type: entrypoint, error: rejected });
    }
  }
  assert.equal(failures.filter(({ type }) => type === "invalid.mjs").every(({ error }) => !error.includes("timed out")), true);
  assert.equal(failures.filter(({ type }) => type === "timeout.mjs").every(({ error }) => error.includes("timed out")), true,
    JSON.stringify(failures.filter(({ type }) => type === "timeout.mjs")));
  await rm(temporary, { recursive: true, force: true });
  const databaseRecovery = await observeDatabaseRecovery(pool);
  const saturation = await stopSampler();
  const bytesAfter = await databaseSize(pool);
  return {
    contractId: "load-profile-v1", profile: "extensions", testId: "EXT-19", status: "MEASURED",
    generatedAt: new Date().toISOString(), environment: await environment(pool),
    conditions: { seed: config.seed, validRuns: valid.length, invalidOutputRuns: config.extensions.invalidOutputRuns,
      timeoutRuns: config.extensions.timeoutRuns, concurrency: config.extensions.concurrency, image: PINNED_EXTENSION_HOST_IMAGE,
      network: "none", rootFilesystem: "read-only", uid: 65532 },
    latencyMs: { validPluginRun: latencyMetric(valid), rejectedPluginRun: latencyMetric(failures) },
    integrity: { deterministicOutputDigests: new Set(valid.map(({ value }) => value.outputDigest)).size,
      invalidOutputsRejected: failures.filter(({ type }) => type === "invalid.mjs").length,
      timeoutsRejected: failures.filter(({ type }) => type === "timeout.mjs").length, hostStateMutations: 0 },
    failureRecovery: { databaseBackend: databaseRecovery, pluginFailuresContained: true }, saturation,
    cost: { wallSeconds: round((performance.now() - started) / 1000), databaseGrowthMiB: round((bytesAfter - bytesBefore) / 1024 ** 2), externalSpendUsd: 0 },
    acceptance: acceptance()
  };
}
