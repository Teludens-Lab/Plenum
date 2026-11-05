import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const started = Date.now();
const run = (command, arguments_) => spawnSync(command, arguments_, {
  cwd: process.cwd(), encoding: "utf8", maxBuffer: 100 * 1024 * 1024
});
const tests = run(process.execPath, ["--test", "tests/security/release-security.test.mjs"]);
const audit = process.env.npm_execpath
  ? run(process.execPath, [process.env.npm_execpath, "audit", "--audit-level=high", "--json"])
  : run("npm", ["audit", "--audit-level=high", "--json"]);
let auditReport;
try { auditReport = JSON.parse(audit.stdout); } catch { auditReport = { error: audit.stderr || audit.stdout }; }
const lock = await readFile(join(process.cwd(), "package-lock.json"));
const revision = run("git", ["rev-parse", "HEAD"]).stdout.trim();
const sourceFiles = run("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
  .stdout.split("\0").filter(Boolean).sort();
const sourceManifest = createHash("sha256");
for (const file of sourceFiles) {
  const path = join(process.cwd(), file);
  try {
    if (!(await stat(path)).isFile()) continue;
    sourceManifest.update(file).update("\0").update(await readFile(path)).update("\0");
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    throw error;
  }
}
const output = `${tests.stdout}${tests.stderr}`;
const status = tests.status === 0 && audit.status === 0 ? "PASS" : "FAIL";
const evidence = {
  contractId: "release-security-evidence-v1",
  generatedAt: new Date().toISOString(),
  command: "npm run test:security",
  revision,
  sourceManifestSha256: sourceManifest.digest("hex"),
  nodeVersion: process.version,
  packageLockSha256: createHash("sha256").update(lock).digest("hex"),
  evidenceIds: ["REQ-051", "REQ-052", "INV-002", "INV-025", "INV-027", "PS-550-T01"],
  checks: {
    sourceAndHistorySecrets: tests.status === 0 ? "PASS" : "FAIL",
    deploymentSecurityConfiguration: tests.status === 0 ? "PASS" : "FAIL",
    dependencyAudit: audit.status === 0 ? "PASS" : "FAIL"
  },
  vulnerabilities: auditReport.metadata?.vulnerabilities ?? null,
  durationMs: Date.now() - started,
  exitCode: status === "PASS" ? 0 : tests.status || audit.status || 1,
  status,
  testOutputSha256: createHash("sha256").update(output).digest("hex")
};
const directory = join(process.cwd(), "test-results", "security");
await mkdir(directory, { recursive: true });
const evidencePath = join(directory, "ps-550-security.json");
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(output);
if (audit.stderr) process.stderr.write(audit.stderr);
console.log(`CMD-SECURITY ${status}; evidence: ${evidencePath}`);
if (status !== "PASS") process.exitCode = evidence.exitCode;
