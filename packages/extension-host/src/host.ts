import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeJson, type JsonObject } from "@plenum/event-contracts";
import { assertJsonSchemaValue, type PluginManifestV1 } from "@plenum/plugin-sdk";

export const PINNED_EXTENSION_HOST_IMAGE = "node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f";
const docker = promisify(execFile);
export class ExtensionHostCleanupError extends Error {}

export interface ExtensionHostInvocation {
  manifest: PluginManifestV1;
  pluginDirectory: string;
  inputSchema: unknown;
  outputSchema: unknown;
  inputs: JsonObject;
}

export interface ExtensionHostResult {
  outputs: JsonObject;
  outputDigest: string;
  environmentDigest: string;
  durationMs: number;
}

export interface ContainerInvocation { command: "docker"; args: string[]; timeoutMs: number; outputBytes: number }

function safeEntrypoint(path: string): string {
  if (!/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u.test(path)) throw new Error("Plugin entrypoint is unsafe");
  return `/plugin/${path}`;
}

export function buildContainerInvocation(input: ExtensionHostInvocation): ContainerInvocation {
  const { manifest } = input;
  if (manifest.execution.mode !== "container" || !manifest.execution.rootless || !manifest.execution.readOnlyRoot) {
    throw new Error("Plugin does not satisfy the container isolation contract");
  }
  if (manifest.connectivity !== "offline_capable") throw new Error("Only offline-capable Plugins may use the no-egress host");
  const runner = fileURLToPath(new URL("../runner.mjs", import.meta.url));
  const timeoutMs = manifest.limits.timeoutSeconds * 1000;
  const cpuCount = Math.max(0.1, Math.min(1, manifest.limits.cpuMillis / timeoutMs));
  return {
    command: "docker", timeoutMs, outputBytes: manifest.limits.outputBytes,
    args: [
      "run", "--rm", "--interactive", "--pull=never", "--network=none", "--read-only", "--user=65532:65532",
      "--cap-drop=ALL", "--security-opt=no-new-privileges:true", "--pids-limit=64",
      `--memory=${manifest.limits.memoryMiB}m`, `--cpus=${cpuCount}`,
      "--tmpfs=/tmp:rw,noexec,nosuid,size=16m",
      `--env=PLENUM_PLUGIN_ENTRYPOINT=${safeEntrypoint(manifest.execution.entrypoint)}`,
      `--env=PLENUM_PLUGIN_OUTPUT_BYTES=${manifest.limits.outputBytes}`,
      `--volume=${resolve(input.pluginDirectory)}:/plugin:ro`, `--volume=${runner}:/host/runner.mjs:ro`,
      PINNED_EXTENSION_HOST_IMAGE, "timeout", "-s", "KILL", `${manifest.limits.timeoutSeconds}s`, "node", "/host/runner.mjs"
    ]
  };
}

export async function runIsolatedPlugin(input: ExtensionHostInvocation): Promise<ExtensionHostResult> {
  assertJsonSchemaValue(input.inputSchema, input.inputs, "Plugin input");
  const invocation = buildContainerInvocation(input);
  const name = `plenum-extension-${randomUUID()}`;
  invocation.args.splice(invocation.args.indexOf("--rm"), 1, "--name", name, "--label=io.plenum.extension-host=true");
  const started = Date.now();
  try { return await new Promise<ExtensionHostResult>((resolveResult, reject) => {
    const child = spawn(invocation.command, invocation.args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    const stdout: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let timer: NodeJS.Timeout;
    const finish = (error?: Error, value?: ExtensionHostResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error !== undefined) reject(error); else resolveResult(value!);
    };
    timer = setTimeout(() => { child.kill("SIGKILL"); finish(new Error("Plugin execution timed out")); }, invocation.timeoutMs + 2_000);
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > invocation.outputBytes) { child.kill("SIGKILL"); finish(new Error("Plugin output exceeded its declared limit")); }
      else stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => { stderrBytes += chunk.byteLength; if (stderrBytes > 16_384) child.kill("SIGKILL"); });
    child.once("error", (error) => finish(new Error(`Extension Host could not start: ${error.message}`)));
    child.once("close", (code) => {
      if (settled) return;
      if (code === 124 || code === 137) return finish(new Error("Plugin execution timed out"));
      if (code !== 0) return finish(new Error("Plugin execution failed in isolation"));
      try {
        const value = JSON.parse(Buffer.concat(stdout).toString("utf8")) as unknown;
        assertJsonSchemaValue(input.outputSchema, value, "Plugin output");
        if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Plugin output must be an object");
        const outputs = value as JsonObject;
        finish(undefined, {
          outputs,
          outputDigest: `sha256:${createHash("sha256").update(canonicalizeJson(outputs)).digest("hex")}`,
          environmentDigest: `sha256:${createHash("sha256").update(PINNED_EXTENSION_HOST_IMAGE).digest("hex")}`,
          durationMs: Date.now() - started
        });
      } catch (error) { finish(error instanceof Error ? error : new Error("Plugin returned malformed output")); }
    });
    child.stdin.end(JSON.stringify({ inputs: input.inputs }));
    child.stdin.on("error", () => finish(new Error("Extension Host input delivery failed")));
  }); } finally {
    try { await docker("docker", ["rm", "--force", name], { timeout: 10_000, maxBuffer: 16384, windowsHide: true }); }
    catch {
      try {
        const remaining = await docker("docker", ["ps", "-aq", "--filter", `name=^/${name}$`], { timeout: 10_000, maxBuffer: 16384, windowsHide: true });
        if (remaining.stdout.trim()) throw new Error("Container remains");
      } catch { throw new ExtensionHostCleanupError("Extension Host termination is unconfirmed"); }
    }
  }
}


