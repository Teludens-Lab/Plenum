import { readFile, writeFile } from "node:fs/promises";
import { compileRelease } from "../packages/release-compiler/dist/index.js";
import { hydrateReleaseSourceAssets } from "./release-source-assets.mjs";

for (const path of [
  "definitions/fractured-order/fractured-order-interface-release-source.json",
  "definitions/validation/crisis-response/interface-release-source.json",
  "definitions/validation/policy-negotiation/interface-release-source.json"
]) {
  const url = new URL(`../${path}`, import.meta.url);
  const source = await hydrateReleaseSourceAssets(JSON.parse(await readFile(url, "utf8")), url);
  const compiled = compileRelease(source);
  const target = new URL(`../${path.replace("-source.json", ".json")}`, import.meta.url);
  await writeFile(target, compiled.bytes);
  console.log(`${path}: ${compiled.release.manifest.releaseId} ${compiled.packageDigest}`);
}
