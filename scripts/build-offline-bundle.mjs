import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const root = process.cwd();
const output = resolve(required("PLENUM_OFFLINE_BUNDLE_DIRECTORY"));
const source = JSON.parse(await readFile(join(root, "deploy/offline-bundle/deployment-manifest.json"), "utf8"));
const applicationImage = process.env.PLENUM_APPLICATION_IMAGE ?? source.applicationImage;
const images = [applicationImage, ...source.images];

await mkdir(output, { recursive: false, mode: 0o700 });
for (const image of images) {
  const inspect = spawnSync("docker", ["image", "inspect", image, "--format", "{{.Id}}"], { encoding: "utf8" });
  if (inspect.status !== 0) throw new Error(`Offline image is not cached: ${image}\n${inspect.stderr}`);
}
const imageArchive = join(output, "images.tar");
const saved = spawnSync("docker", ["save", "--output", imageArchive, ...images], { encoding: "utf8" });
if (saved.status !== 0) throw new Error(`docker save failed: ${saved.stderr}`);

await cp(join(root, "deploy/compose"), join(output, "compose"), { recursive: true });
await cp(join(root, "docs/operations"), join(output, "operations"), { recursive: true });
const resolvedManifest = {
  ...source,
  generatedAt: new Date().toISOString(),
  applicationImage,
  applicationImageId: spawnSync("docker", ["image", "inspect", applicationImage, "--format", "{{.Id}}"], { encoding: "utf8" }).stdout.trim(),
  images
};
await writeFile(join(output, "deployment-manifest.json"), `${JSON.stringify(resolvedManifest, null, 2)}\n`, { flag: "wx" });

async function bundledFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await bundledFiles(path));
    else if (entry.isFile()) files.push(relative(output, path).replaceAll("\\", "/"));
  }
  return files;
}
const uniqueFiles = (await bundledFiles(output)).filter((file) => !file.startsWith("SHA256SUMS")).sort();
const checksums = [];
for (const file of uniqueFiles) {
  checksums.push(`${sha256(await readFile(join(output, file)))}  ${file}`);
}
const checksumBytes = Buffer.from(`${checksums.join("\n")}\n`);
await writeFile(join(output, "SHA256SUMS"), checksumBytes, { flag: "wx" });
const privateKey = createPrivateKey(await readFile(required("PLENUM_OFFLINE_SIGNING_KEY_FILE")));
if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("Offline bundle signing key must be Ed25519");
const publicKey = createPublicKey(privateKey);
const signature = sign(null, checksumBytes, privateKey);
if (!verify(null, checksumBytes, publicKey, signature)) throw new Error("Offline bundle signature self-check failed");
await writeFile(join(output, "SHA256SUMS.sig"), signature.toString("base64") + "\n", { flag: "wx" });
await writeFile(join(output, "signing-public-key.pem"), publicKey.export({ type: "spki", format: "pem" }), { flag: "wx" });
console.log(`Offline bundle PASS: ${output}`);

