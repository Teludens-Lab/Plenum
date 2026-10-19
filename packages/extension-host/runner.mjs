import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
const entrypoint = process.env.PLENUM_PLUGIN_ENTRYPOINT;
if (entrypoint === undefined || !entrypoint.startsWith("/plugin/")) throw new Error("Plugin entrypoint is unavailable");
await readFile(entrypoint);
const plugin = await import(pathToFileURL(entrypoint).href);
if (typeof plugin.execute !== "function") throw new Error("Plugin must export execute(input)");
const output = await plugin.execute(request.inputs);
const serialized = JSON.stringify(output);
const outputLimit = Number(process.env.PLENUM_PLUGIN_OUTPUT_BYTES);
if (!Number.isSafeInteger(outputLimit) || outputLimit < 1 || Buffer.byteLength(serialized) > outputLimit) {
  throw new Error("Plugin output exceeded its declared limit");
}
process.stdout.write(serialized);
