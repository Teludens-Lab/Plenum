import { execFile } from "node:child_process";
import { createHash, createPublicKey } from "node:crypto";
import { chmod, lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, request, type IncomingMessage } from "node:http";
import { connect } from "node:net";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { canonicalizeJson, type JsonObject } from "@plenum/event-contracts";
import { MAX_PLUGIN_BUNDLE_BYTES, assertJsonSchemaValue, verifyPluginBundleForIntake } from "@plenum/plugin-sdk";
import { ExtensionHostCleanupError, PINNED_EXTENSION_HOST_IMAGE, runIsolatedPlugin, type ExtensionHostResult } from "./host.js";

const docker = promisify(execFile);
const maxInputBytes = 1024 * 1024;
const maxRequestBytes = Math.ceil(MAX_PLUGIN_BUNDLE_BYTES * 4 / 3) + maxInputBytes + 16384;
export interface VerifiedHostBundle {
  bundleBase64: string;
  publisherPublicKey: string;
  bundleDigest: string;
  manifestDigest: string;
  artifactDigest: string;
}
export interface HostRequest extends VerifiedHostBundle { inputs: JsonObject }

export function assertSupervisorDaemon(info: { SecurityOptions?: string[]; CgroupVersion?: string; MemoryLimit?: boolean; CpuCfsQuota?: boolean; PidsLimit?: boolean }) {
  if (!info.SecurityOptions?.includes("name=rootless") || info.CgroupVersion !== "2" ||
      info.MemoryLimit !== true || info.CpuCfsQuota !== true || info.PidsLimit !== true) {
    throw new Error("A rootless Docker daemon with delegated cgroup v2 memory, CPU and process limits is required");
  }
}

export function verifyHostRequest(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid invocation");
  const record = value as Record<string, unknown>;
  const keys = ["bundleBase64", "publisherPublicKey", "bundleDigest", "manifestDigest", "artifactDigest", "inputs"];
  if (Object.keys(record).length !== keys.length || Object.keys(record).some(key => !keys.includes(key)) ||
      keys.slice(0, 5).some(key => typeof record[key] !== "string") ||
      typeof record.inputs !== "object" || record.inputs === null || Array.isArray(record.inputs) ||
      Buffer.byteLength(canonicalizeJson(record.inputs as JsonObject)) > maxInputBytes) throw new Error("Invalid invocation");
  const input = value as HostRequest;
  if (input.bundleBase64.length > Math.ceil(MAX_PLUGIN_BUNDLE_BYTES * 4 / 3)) throw new Error("Bundle too large");
  const bytes = Buffer.from(input.bundleBase64, "base64");
  if (bytes.toString("base64") !== input.bundleBase64) throw new Error("Invalid bundle encoding");
  const envelope = JSON.parse(bytes.toString("utf8")) as { manifest: { publisher: { id: string; signatureKeyId: string } } };
  const verified = verifyPluginBundleForIntake(bytes, {
    publisherId: envelope.manifest.publisher.id, publisherKeyId: envelope.manifest.publisher.signatureKeyId,
    publisherPublicKey: createPublicKey(input.publisherPublicKey)
  });
  if (verified.bundleDigest !== input.bundleDigest || verified.manifestDigest !== input.manifestDigest ||
      verified.bundle.manifest.digest !== input.artifactDigest) throw new Error("Immutable artifact mismatch");
  const manifest = verified.bundle.manifest;
  if (manifest.execution.mode !== "container" || !manifest.execution.rootless || !manifest.execution.readOnlyRoot ||
      manifest.connectivity !== "offline_capable" || manifest.dependencies.length !== 0 ||
      manifest.requestedPermissions.some(permission => !["state_values.read:mapped", "effects.propose"].includes(permission))) {
    throw new Error("Unsupported isolated capability");
  }
  const inputSchema = JSON.parse(Buffer.from(verified.files.get(manifest.contracts.inputSchema)!).toString("utf8")) as unknown;
  const outputSchema = JSON.parse(Buffer.from(verified.files.get(manifest.contracts.outputSchema)!).toString("utf8")) as unknown;
  assertJsonSchemaValue(inputSchema, input.inputs, "Plugin input");
  return { ...verified, inputSchema, outputSchema, inputs: input.inputs };
}

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []; let size = 0;
  request.setTimeout(5000, () => request.destroy());
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > maxRequestBytes) throw new Error("Invocation too large");
    chunks.push(chunk as Buffer);
  }
  request.setTimeout(0);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** One supervisor per dedicated rootless account. No network listener or caller-selected paths. */
export async function startExtensionSupervisor(socketPath: string, stagingRoot: string) {
  if (process.platform !== "linux" || !isAbsolute(socketPath) || !isAbsolute(stagingRoot) || process.getuid?.() === 0) {
    throw new Error("Extension supervisor requires absolute paths and a non-root Linux account");
  }
  const daemonPath = process.env.DOCKER_HOST?.startsWith("unix:///") ? process.env.DOCKER_HOST.slice(7) : undefined;
  if (!daemonPath || process.env.DOCKER_CONTEXT || resolve(daemonPath) === resolve(socketPath)) throw new Error("An explicit local Docker socket is required");
  const daemonSocket = await lstat(daemonPath);
  if (!daemonSocket.isSocket() || daemonSocket.uid !== process.getuid?.()) throw new Error("Docker socket must belong to the dedicated rootless account");
  const options = { timeout: 10_000, maxBuffer: 16384, windowsHide: true };
  const checkDaemon = async () => {
    const info = await docker("docker", ["info", "--format", "{{json .}}"], { ...options, maxBuffer: 1024 * 1024 });
    assertSupervisorDaemon(JSON.parse(info.stdout) as Parameters<typeof assertSupervisorDaemon>[0]);
    await docker("docker", ["image", "inspect", PINNED_EXTENSION_HOST_IMAGE], { ...options, maxBuffer: 1024 * 1024 });
  };
  await checkDaemon();
  await mkdir(stagingRoot, { recursive: true, mode: 0o700 });
  const root = await lstat(stagingRoot);
  if (!root.isDirectory() || root.isSymbolicLink() || root.uid !== process.getuid?.() || (root.mode & 0o077) !== 0) throw new Error("Staging custody is not private");
  // The service account owns this lock and daemon; a second live supervisor must not reap its containers.
  const lock = join(stagingRoot, "supervisor.pid");
  try {
    const pid = Number(await readFile(lock, "utf8"));
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error("Invalid supervisor lock");
    try { process.kill(pid, 0); throw new Error("Supervisor already running"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
    await rm(lock);
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await writeFile(lock, String(process.pid), { flag: "wx", mode: 0o600 });
  try {
    const orphaned = (await docker("docker", ["ps", "-aq", "--filter", "label=io.plenum.extension-host=true"], options)).stdout.trim().split(/\s+/u).filter(Boolean);
    if (orphaned.length > 2 || orphaned.some(id => !/^[a-f0-9]{12,64}$/u.test(id))) throw new Error("Unbounded orphan recovery requires operator review");
    if (orphaned.length) await docker("docker", ["rm", "--force", ...orphaned], options);
    const entries = (await readdir(stagingRoot)).filter(name => name.startsWith("invocation-"));
    if (entries.length > 2) throw new Error("Unbounded staging recovery requires operator review");
    for (const name of entries) await rm(join(stagingRoot, name), { recursive: true });
    try {
      const socket = await lstat(socketPath);
      if (!socket.isSocket() || socket.uid !== process.getuid?.()) throw new Error("Unsafe supervisor socket path");
      const live = await new Promise<boolean>(resolveLive => {
        const probe = connect(socketPath); probe.setTimeout(1000);
        probe.once("connect", () => { probe.destroy(); resolveLive(true); });
        probe.once("error", error => resolveLive((error as NodeJS.ErrnoException).code !== "ECONNREFUSED"));
        probe.once("timeout", () => { probe.destroy(); resolveLive(true); });
      });
      if (live) throw new Error("Supervisor socket is active");
      await rm(socketPath);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    let active = 0, closing = false, uncertain = false;
    let checkedAt = Date.now(), healthy = true, checking: Promise<boolean> | undefined;
    const health = async (fresh = false) => {
      if (!fresh && Date.now() - checkedAt < 1000) return healthy;
      checking ??= checkDaemon().then(() => true, () => false).then(value => { healthy = value; checkedAt = Date.now(); return value; })
        .finally(() => { checking = undefined; });
      return checking;
    };
    const work = new Set<Promise<void>>();
    const server = createServer((request, response) => {
      const reply = (status: number, value: unknown) => { response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); response.end(JSON.stringify(value)); };
      if (request.method === "GET" && request.url === "/health") {
        void health().then(ready => reply(closing || uncertain || !ready ? 503 : 200, { image: PINNED_EXTENSION_HOST_IMAGE, rootless: true })); return;
      }
      if (request.method !== "POST" || request.url !== "/invoke" || request.headers["content-type"] !== "application/json") { reply(400, { error: "invalid_invocation" }); return; }
      if (closing || uncertain || active >= 2) { reply(503, { error: "executor_unavailable" }); return; }
      active++;
      const invocation = (async () => {
        let directory: string | undefined, retain = false;
        try {
          const verified = verifyHostRequest(await body(request));
          if (!await health(true)) { reply(503, { error: "executor_unavailable" }); return; }
          directory = await mkdtemp(join(stagingRoot, "invocation-"));
          await chmod(directory, 0o755);
          for (const [name, bytes] of verified.files) {
            const target = resolve(directory, name);
            if (!target.startsWith(directory + sep)) throw new Error("Unsafe artifact path");
            await mkdir(dirname(target), { recursive: true, mode: 0o755 });
            await writeFile(target, bytes, { flag: "wx", mode: 0o444 });
          }
          const result = await runIsolatedPlugin({ manifest: verified.bundle.manifest, pluginDirectory: directory,
            inputSchema: verified.inputSchema, outputSchema: verified.outputSchema, inputs: verified.inputs });
          reply(200, result);
        } catch (error) {
          if (error instanceof ExtensionHostCleanupError) { uncertain = true; retain = true; }
          const message = error instanceof Error ? error.message.toLowerCase() : "";
          reply(422, { error: message.includes("timed out") ? "execution_timeout" : message.includes("output") || message.includes("schema") ? "output_invalid" : "execution_failed" });
        } finally {
          if (directory && !retain) await rm(directory, { recursive: true });
          active--;
        }
      })().catch(() => { uncertain = true; response.destroy(); }).finally(() => work.delete(invocation));
      work.add(invocation);
    });
    server.maxConnections = 4;
    server.requestTimeout = 10_000;
    await new Promise<void>((resolveListen, reject) => { server.once("error", reject); server.listen(socketPath, resolveListen); });
    await chmod(socketPath, 0o660);
    return { close: async () => { closing = true; const closed = new Promise<void>(resolveClose => server.close(() => resolveClose()));
      await Promise.allSettled(work); server.closeAllConnections(); await closed; await rm(lock); } };
  } catch (error) { await rm(lock); throw error; }
}

export async function invokeExtensionSupervisor(socketPath: string, input: HostRequest, timeoutMs: number): Promise<ExtensionHostResult> {
  if (!isAbsolute(socketPath)) throw new Error("Executor socket must be absolute");
  const bytes = Buffer.from(JSON.stringify(input));
  if (bytes.length > maxRequestBytes) throw new Error("Invocation too large");
  return new Promise((resolveResult, reject) => {
    const client = request({ socketPath, path: "/invoke", method: "POST", signal: AbortSignal.timeout(timeoutMs),
      headers: { "content-type": "application/json", "content-length": bytes.length } }, response => {
      const chunks: Buffer[] = []; let count = 0;
      response.on("data", (chunk: Buffer) => { count += chunk.length; if (count > 11 * 1024 * 1024) response.destroy(new Error("Executor output too large")); else chunks.push(chunk); });
      response.once("error", reject);
      response.once("end", () => {
        try {
          const value = JSON.parse(Buffer.concat(chunks).toString("utf8")) as ExtensionHostResult;
          if (response.statusCode !== 200) throw new Error(response.statusCode === 503 ? "Extension Host unavailable" :
            (value as unknown as { error: string }).error === "execution_timeout" ? "Plugin execution timed out" :
            (value as unknown as { error: string }).error === "output_invalid" ? "Plugin output invalid" : "Extension Host execution failed");
          if (value.outputDigest !== `sha256:${createHash("sha256").update(canonicalizeJson(value.outputs)).digest("hex")}` ||
              value.environmentDigest !== `sha256:${createHash("sha256").update(PINNED_EXTENSION_HOST_IMAGE).digest("hex")}` ||
              !Number.isSafeInteger(value.durationMs) || value.durationMs < 0 || value.durationMs > timeoutMs) throw new Error("Executor provenance mismatch");
          resolveResult(value);
        } catch (error) { reject(error); }
      });
    });
    client.once("error", reject); client.end(bytes);
  });
}

export async function probeExtensionSupervisor(socketPath: string): Promise<boolean> {
  return new Promise(resolveProbe => {
    const client = request({ socketPath, path: "/health", signal: AbortSignal.timeout(1000) }, response => {
      let body = "";
      response.on("data", (chunk: Buffer) => { body += chunk.toString("utf8"); if (body.length > 1024) response.destroy(); });
      response.once("error", () => resolveProbe(false));
      response.once("end", () => {
        try { const health = JSON.parse(body) as { image: string; rootless: boolean };
          resolveProbe(response.statusCode === 200 && health.image === PINNED_EXTENSION_HOST_IMAGE && health.rootless === true);
        } catch { resolveProbe(false); }
      });
    });
    client.once("error", () => resolveProbe(false)); client.end();
  });
}
