import { readFile, writeFile } from "node:fs/promises";

import { compileRelease } from "../packages/release-compiler/dist/index.js";
import { hydrateReleaseSourceAssets } from "./release-source-assets.mjs";

const sourceUrl = new URL("../definitions/fractured-order/fractured-order-release-source.json", import.meta.url);
const targetUrl = new URL("../definitions/fractured-order/fractured-order-release.json", import.meta.url);
const input = await hydrateReleaseSourceAssets(JSON.parse(await readFile(sourceUrl, "utf8")), sourceUrl);
const compiled = compileRelease(input);
await writeFile(targetUrl, new TextDecoder().decode(compiled.bytes), "utf8");
console.log(`Compiled Fractured Order Release ${compiled.release.manifest.releaseId} (${compiled.packageDigest})`);
