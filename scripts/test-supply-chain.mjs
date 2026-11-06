import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const allowedLicenses = new Set([
  "0BSD", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "MIT", "MPL-2.0", "Unlicense",
  "(AFL-2.1 OR BSD-3-Clause)", "(Apache-2.0 AND BSD-3-Clause)", "(UPL-1.0 OR Apache-2.0)"
]);
const root = process.cwd();
const directory = join(root, "test-results", "supply-chain");
await mkdir(directory, { recursive: true });
const lockBytes = await readFile(join(root, "package-lock.json"));
const lock = JSON.parse(lockBytes.toString("utf8"));
const violations = [];
const reviewed = [];
for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  if (path === "" || entry.private === true || entry.link === true || path.startsWith("apps/") || path.startsWith("packages/")) continue;
  const license = typeof entry.license === "string" ? entry.license : "UNDECLARED";
  reviewed.push({ package: entry.name ?? path.replace(/^node_modules\//u, ""), version: entry.version ?? "unknown", license });
  if (!allowedLicenses.has(license)) violations.push({ package: reviewed.at(-1).package, version: reviewed.at(-1).version, license });
}
reviewed.sort((left, right) => `${left.package}@${left.version}`.localeCompare(`${right.package}@${right.version}`));
const npmExecutable = process.env.npm_execpath;
const sbom = npmExecutable
  ? spawnSync(process.execPath, [npmExecutable, "sbom", "--sbom-format", "cyclonedx"], { cwd: root, encoding: "utf8", maxBuffer: 100 * 1024 * 1024 })
  : spawnSync("npm", ["sbom", "--sbom-format", "cyclonedx"], { cwd: root, encoding: "utf8", maxBuffer: 100 * 1024 * 1024 });
let parsedSbom;
try { parsedSbom = JSON.parse(sbom.stdout); } catch { parsedSbom = undefined; }
const sbomValid = sbom.status === 0 && parsedSbom?.bomFormat === "CycloneDX" && Array.isArray(parsedSbom.components);
const sbomPath = join(directory, "sbom.cdx.json");
if (sbomValid) await writeFile(sbomPath, `${JSON.stringify(parsedSbom, null, 2)}\n`);
const revision = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
const status = violations.length === 0 && sbomValid ? "PASS" : "FAIL";
const evidence = {
  contractId: "supply-chain-evidence-v1",
  generatedAt: new Date().toISOString(),
  command: "npm run test:supply-chain",
  revision,
  packageLockSha256: createHash("sha256").update(lockBytes).digest("hex"),
  sbomSha256: sbomValid ? createHash("sha256").update(await readFile(sbomPath)).digest("hex") : null,
  policy: "Explicitly reviewed SPDX expressions only; any new expression fails closed pending owner review.",
  reviewedPackageCount: reviewed.length,
  violations,
  provenanceAttestation: "CI_RELEASE_WORKFLOW_REQUIRED",
  status
};
const evidencePath = join(directory, "ps-810-supply-chain.json");
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`PS-810 supply-chain ${status}; ${reviewed.length} packages reviewed; evidence: ${evidencePath}`);
if (!sbomValid) process.stderr.write(sbom.stderr || "SBOM generation did not return a CycloneDX document.\n");
if (violations.length > 0) console.error(JSON.stringify({ unreviewedLicenses: violations }, null, 2));
if (status !== "PASS") process.exitCode = 1;
