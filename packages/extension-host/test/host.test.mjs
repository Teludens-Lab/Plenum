import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalizeJson } from "@plenum/event-contracts";

import { buildContainerInvocation, verifyHostRequest, assertSupervisorDaemon, invokeExtensionSupervisor, probeExtensionSupervisor, PINNED_EXTENSION_HOST_IMAGE } from "../dist/index.js";
import { signedEffectFixture } from "../fixtures/signed-effect.mjs";

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

test("BA-08 supervisor validates signed custody, exact protocol, input schema and capability limits", async () => {
  const { request } = await signedEffectFixture();
  assert.equal(verifyHostRequest(request).bundle.manifest.digest, request.artifactDigest);
  for (const changed of [{ ...request, artifactDigest: `sha256:${"0".repeat(64)}` },
    { ...request, pluginDirectory: "/etc" }, { ...request, image: "untrusted" },
    { ...request, inputs: { ...request.inputs, secret: "not mapped" } },
    { ...request, bundleBase64: request.bundleBase64 + "=" }]) assert.throws(() => verifyHostRequest(changed));
  const other = await signedEffectFixture();
  assert.throws(() => verifyHostRequest({ ...request, publisherPublicKey: other.request.publisherPublicKey }));
  const online = await signedEffectFixture({ connectivity: "external_required" });
  assert.throws(() => verifyHostRequest(online.request), /Unsupported isolated capability/);
  const exporting = await signedEffectFixture({ requestedPermissions: ["approved_export.write"] });
  assert.throws(() => verifyHostRequest(exporting.request), /Unsupported isolated capability/);
});

test("BA-08 local IPC checks health, provenance and bounded errors without trusting response output", async () => {
  const socket = process.platform === "win32" ? `\\\\.\\pipe\\plenum-ba08-${randomUUID()}` : join(tmpdir(), `ba08-${randomUUID()}.sock`);
  let status = 200, mode = "valid";
  const outputs = { effectProposals: [] };
  const server = createServer(async (req, res) => {
    for await (const _chunk of req) { /* Drain the bounded test request. */ }
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(req.url === "/health" ? { image: PINNED_EXTENSION_HOST_IMAGE, rootless: mode !== "rootful" } :
      status === 422 ? { error: "execution_timeout" } : { outputs, durationMs: 1,
        outputDigest: `sha256:${createHash("sha256").update(canonicalizeJson(outputs)).digest("hex")}`,
        environmentDigest: `sha256:${createHash("sha256").update(mode === "valid" ? PINNED_EXTENSION_HOST_IMAGE : "wrong image").digest("hex")}` }));
  }).listen(socket);
  await once(server, "listening");
  try {
    const { request } = await signedEffectFixture();
    assert.equal(await probeExtensionSupervisor(socket), true);
    assert.deepEqual((await invokeExtensionSupervisor(socket, request, 1000)).outputs, outputs);
    mode = "rootful"; assert.equal(await probeExtensionSupervisor(socket), false);
    await assert.rejects(invokeExtensionSupervisor(socket, request, 1000), /provenance/);
    status = 503; assert.equal(await probeExtensionSupervisor(socket), false);
    await assert.rejects(invokeExtensionSupervisor(socket, request, 1000), /unavailable/);
    status = 422; await assert.rejects(invokeExtensionSupervisor(socket, request, 1000), /timed out/);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  assert.equal(await probeExtensionSupervisor(socket), false);
});

test("BA-08 supervisor refuses rootful or unenforced resource limits", () => {
  const info = { SecurityOptions: ["name=rootless"], CgroupVersion: "2", MemoryLimit: true, CpuCfsQuota: true, PidsLimit: true };
  assert.doesNotThrow(() => assertSupervisorDaemon(info));
  for (const changed of [{ SecurityOptions: [] }, { CgroupVersion: "1" }, { MemoryLimit: false }, { CpuCfsQuota: false }, { PidsLimit: false }]) {
    assert.throws(() => assertSupervisorDaemon({ ...info, ...changed }), /delegated cgroup/);
  }
});
