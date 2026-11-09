import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const runtimeSourceRoots = [
  "apps/runtime-web/src",
  "apps/server/src",
  "packages/event-contracts/src",
  "packages/extension-host/src",
  "packages/media-adapter/src",
  "packages/plugin-sdk/src",
  "packages/policy-engine/src",
  "packages/release-compiler/src",
  "packages/simulation-schema/src",
  "packages/sync-client/src",
  "packages/validation-engine/src",
  "packages/workflow-engine/src"
];

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  }))).flat();
}

export async function runtimeSourceHash() {
  const files = (await Promise.all(runtimeSourceRoots.map((root) => filesUnder(path.join(repoRoot, root)))))
    .flat().sort((left, right) => left.localeCompare(right));
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(path.relative(repoRoot, file).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return { digest: hash.digest("hex"), fileCount: files.length };
}


