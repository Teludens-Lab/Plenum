import { readFile } from "node:fs/promises";

import { verifyEvidenceExport } from "../apps/server/dist/index.js";

const [exportPath, trustRootsPath, anchorsPath] = process.argv.slice(2);
if (exportPath === undefined || trustRootsPath === undefined || anchorsPath === undefined) {
  console.error("Usage: node scripts/verify-evidence.mjs <verification-export.json> <trusted-public-keys.json> <independent-anchors.json>");
  process.exitCode = 2;
} else {
  try {
    const [exported, trustedPublicKeys, independentAnchors] = await Promise.all(
      [exportPath, trustRootsPath, anchorsPath].map(async (path) => JSON.parse(await readFile(path, "utf8")))
    );
    const result = verifyEvidenceExport(exported, trustedPublicKeys, independentAnchors);
    console.log(JSON.stringify(result, null, 2));
    if (!result.verified) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
