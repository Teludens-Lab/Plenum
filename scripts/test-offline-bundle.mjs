import { createHash, createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "plenum-ps530-offline-"));
const output = join(directory, "bundle");
const keyFile = join(directory, "offline-signing-key.pem");
const evidencePath = join(process.cwd(), "test-results", "deployment", "ps-530-offline-bundle.json");
try {
  const { privateKey } = generateKeyPairSync("ed25519");
  await writeFile(keyFile, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  const result = spawnSync(process.execPath, ["scripts/build-offline-bundle.mjs"], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, PLENUM_APPLICATION_IMAGE: process.env.PLENUM_APPLICATION_IMAGE ?? "plenum-platform:ps-530",
      PLENUM_OFFLINE_BUNDLE_DIRECTORY: output, PLENUM_OFFLINE_SIGNING_KEY_FILE: keyFile } });
  if (result.status !== 0) throw new Error(`Offline bundle build failed:\n${result.stdout}\n${result.stderr}`);
  const sums = await readFile(join(output, "SHA256SUMS"));
  const signature = Buffer.from((await readFile(join(output, "SHA256SUMS.sig"), "utf8")).trim(), "base64");
  const publicKey = createPublicKey(await readFile(join(output, "signing-public-key.pem")));
  if (!verify(null, sums, publicKey, signature)) throw new Error("Offline bundle signature verification failed");
  for (const line of sums.toString("utf8").trim().split(/\r?\n/u)) {
    const match = /^([0-9a-f]{64})  (.+)$/u.exec(line);
    if (!match) throw new Error(`Invalid checksum line: ${line}`);
    const actual = createHash("sha256").update(await readFile(join(output, match[2]))).digest("hex");
    if (actual !== match[1]) throw new Error(`Checksum mismatch: ${match[2]}`);
  }
  const manifest = JSON.parse(await readFile(join(output, "deployment-manifest.json"), "utf8"));
  const archiveBytes = (await stat(join(output, "images.tar"))).size;
  if (manifest.images.length !== 6 || archiveBytes === 0) throw new Error("Offline image closure is incomplete");
  await mkdir(join(process.cwd(), "test-results", "deployment"), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify({ contractId: "offline-bundle-evidence-v1", status: "PASS",
    generatedAt: new Date().toISOString(), applicationImageId: manifest.applicationImageId, imageCount: manifest.images.length,
    archiveBytes, signatureVerified: true, checksumsVerified: sums.toString("utf8").trim().split(/\r?\n/u).length }, null, 2)}\n`);
  console.log(`Offline bundle PASS; evidence: ${evidencePath}`);
} finally {
  await rm(directory, { recursive: true, force: true });
}

