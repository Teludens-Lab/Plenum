import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runIsolatedPlugin } from "../packages/extension-host/dist/index.js";

const image = "node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f";
const root = process.cwd();
const evidencePath = join(root, "test-results", "airgap", "ps-220-airgap.json");

const imageCheck = spawnSync("docker", ["image", "inspect", image], { encoding: "utf8" });
if (imageCheck.status !== 0) {
  throw new Error(`CMD-AIRGAP requires the pinned image to exist locally; no pull is allowed.\n${imageCheck.stderr}`);
}

const pluginDirectory = join(root, "packages", "extension-host", "fixtures", "synthetic-effect");
const inputSchema = JSON.parse(await readFile(join(pluginDirectory, "input.schema.json"), "utf8"));
const outputSchema = JSON.parse(await readFile(join(pluginDirectory, "output.schema.json"), "utf8"));
const hostResult = await runIsolatedPlugin({
  pluginDirectory, inputSchema, outputSchema,
  inputs: { seed: 5, pressure: 40, effectId: "25000000-0000-4000-8000-000000000001", targetAggregateId: "25000000-0000-4000-8000-000000000002" },
  manifest: {
    contractId: "plugin-manifest-v1", manifestVersion: "1.0.0", pluginId: "org.ssg.fixtures.synthetic-effect", version: "1.0.0",
    digest: `sha256:${"1".repeat(64)}`, artifactPath: "plugin.mjs", publisher: { id: "fixture", signatureKeyId: "fixture" },
    categories: ["world_and_simulation"], capabilities: ["compute", "propose_effect"],
    execution: { mode: "container", entrypoint: "plugin.mjs", rootless: true, readOnlyRoot: true }, connectivity: "offline_capable",
    contracts: { inputSchema: "input.schema.json", outputSchema: "output.schema.json" },
    compatibility: { hostApi: ">=1.0.0 <2.0.0", releaseSchema: ">=1.3.0 <2.0.0" },
    limits: { timeoutSeconds: 5, memoryMiB: 64, cpuMillis: 1000, outputBytes: 8192 },
    requestedPermissions: ["state_values.read:mapped", "effects.propose"], dataClassificationMaximum: "internal",
    reproducibility: { deterministic: true, seedInput: "seed" }, dependencies: [], provenance: { sourceRevision: "fixture", buildSystem: "none" }, license: "fixture"
  }
});
if (hostResult.outputs.outputs.syntheticScore !== 45 || hostResult.outputs.effectProposals.length !== 1) {
  throw new Error("Isolated Plugin returned an unexpected deterministic result");
}

const args = [
  "run", "--rm", "--pull=never",
  "--network=none",
  "--read-only",
  "--user=65532:65532",
  "--cap-drop=ALL",
  "--security-opt=no-new-privileges:true",
  "--pids-limit=64",
  "--memory=256m",
  "--cpus=1",
  "--tmpfs=/tmp:rw,noexec,nosuid,size=16m",
  "--env=AIRGAP_PROFILE=1",
  `--volume=${root}:/workspace:ro`,
  `--volume=${join(root, "packages", "event-contracts")}:/workspace/node_modules/@plenum/event-contracts:ro`,
  "--workdir=/workspace",
  image,
  "node", "--test",
  "tests/airgap/network-denied.test.mjs",
  "packages/plugin-sdk/test/sdk.test.mjs"
];
const run = spawnSync("docker", args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
const evidence = {
  contractId: "airgap-verification-v1",
  generatedAt: new Date().toISOString(),
  command: "npm run test:airgap",
  image,
  launcher: { node: process.version, platform: process.platform, architecture: process.arch },
  controls: {
    network: "none",
    readOnlyRoot: true,
    rootlessUid: 65532,
    capabilities: [],
    noNewPrivileges: true,
    memoryMiB: 256,
    cpuCount: 1,
    pids: 64,
    isolatedPluginExecution: true
  },
  pluginOutputDigest: hostResult.outputDigest,
  pluginEnvironmentDigest: hostResult.environmentDigest,
  exitCode: run.status,
  status: run.status === 0 ? "PASS" : "FAIL",
  outputSha256: createHash("sha256").update(output).digest("hex")
};
await mkdir(join(root, "test-results", "airgap"), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
process.stdout.write(output);
console.log(`CMD-AIRGAP ${evidence.status}; evidence: ${evidencePath}`);
if (run.error !== undefined) throw run.error;
if (run.status !== 0) process.exitCode = run.status ?? 1;
