import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { buildContainerInvocation } from "../dist/index.js";

const fixture = fileURLToPath(new URL("../fixtures/synthetic-effect", import.meta.url));
const inputSchema = JSON.parse(await readFile(new URL("../fixtures/synthetic-effect/input.schema.json", import.meta.url), "utf8"));
const outputSchema = JSON.parse(await readFile(new URL("../fixtures/synthetic-effect/output.schema.json", import.meta.url), "utf8"));
const manifest = {
  contractId: "plugin-manifest-v1", manifestVersion: "1.0.0", pluginId: "org.ssg.fixtures.synthetic-effect", version: "1.0.0",
  digest: `sha256:${"1".repeat(64)}`, artifactPath: "plugin.mjs", publisher: { id: "fixture", signatureKeyId: "fixture" },
  categories: ["world_and_simulation"], capabilities: ["compute", "propose_effect"],
  execution: { mode: "container", entrypoint: "plugin.mjs", rootless: true, readOnlyRoot: true }, connectivity: "offline_capable",
  contracts: { inputSchema: "input.schema.json", outputSchema: "output.schema.json" }, compatibility: { hostApi: ">=1.0.0 <2.0.0", releaseSchema: ">=1.3.0 <2.0.0" },
  limits: { timeoutSeconds: 5, memoryMiB: 64, cpuMillis: 1000, outputBytes: 8192 }, requestedPermissions: ["state_values.read:mapped", "effects.propose"],
  dataClassificationMaximum: "internal", reproducibility: { deterministic: true, seedInput: "seed" }, dependencies: [],
  provenance: { sourceRevision: "fixture", buildSystem: "none" }, license: "fixture"
};

test("EXT-04 host invocation is rootless, read-only, bounded, and has no network", () => {
  const invocation = buildContainerInvocation({ manifest, pluginDirectory: fixture, inputSchema, outputSchema, inputs: {} });
  for (const control of ["--network=none", "--read-only", "--user=65532:65532", "--cap-drop=ALL", "--security-opt=no-new-privileges:true", "--pull=never"]) {
    assert.ok(invocation.args.includes(control), control);
  }
  assert.ok(invocation.args.some((value) => value.endsWith(":/plugin:ro")));
  assert.ok(invocation.args.includes("--env=PLENUM_PLUGIN_OUTPUT_BYTES=8192"));
  assert.deepEqual(invocation.args.slice(-6), ["timeout", "-s", "KILL", "5s", "node", "/host/runner.mjs"]);
  assert.equal(invocation.timeoutMs, 5000);
  assert.equal(invocation.outputBytes, 8192);
});

test("host rejects non-offline and path-traversing entrypoints", () => {
  const base = { manifest, pluginDirectory: fixture, inputSchema, outputSchema, inputs: {} };
  assert.throws(() => buildContainerInvocation({ ...base, manifest: { ...manifest, connectivity: "external_required" } }), /offline-capable/);
  assert.throws(() => buildContainerInvocation({ ...base, manifest: { ...manifest, execution: { ...manifest.execution, entrypoint: "../escape.mjs" } } }), /unsafe/);
});
