import { readFile } from "node:fs/promises";

const path = new URL("../docs/promptbook/product-completeness-ledger.json", import.meta.url);
const allowedDimensions = new Set(["prd-requirement", "prd-invariant", "studio-section", "runtime-section", "persona-journey", "product-screen", "api-boundary", "ui-state", "viewport", "release-control"]);

function expand(group) {
  if (group.range !== undefined) {
    const { prefix, start, end, width } = group.range;
    return Array.from({ length: end - start + 1 }, (_, index) => `${prefix}${String(start + index).padStart(width, "0")}`);
  }
  return group.obligations ?? [];
}

export function validateLedger(ledger, release = false) {
  const errors = [];
  if (ledger.contractId !== "product-completeness-ledger-v1") errors.push("contractId must be product-completeness-ledger-v1");
  const groups = Array.isArray(ledger.groups) ? ledger.groups : [];
  const resolved = new Map();
  for (const group of groups) {
    if (!allowedDimensions.has(group.dimension)) errors.push(`unknown dimension ${group.dimension}`);
    if (typeof group.owner !== "string" || group.owner.trim() === "") errors.push(`${group.dimension} has no owner`);
    if (typeof group.evidenceTarget !== "string" || group.evidenceTarget.trim() === "") errors.push(`${group.dimension} has no evidence target`);
    if (!ledger.statusVocabulary?.includes(group.status)) errors.push(`${group.dimension} has invalid status ${group.status}`);
    for (const obligation of expand(group)) {
      const key = `${group.dimension}:${obligation}`;
      if (resolved.has(key)) errors.push(`duplicate obligation ${key}`);
      resolved.set(key, { ...group, obligation });
    }
  }
  for (const override of ledger.overrides ?? []) {
    const key = `${override.dimension}:${override.obligation}`;
    if (!resolved.has(key)) errors.push(`override references missing obligation ${key}`);
    if (typeof override.owner !== "string" || override.owner.trim() === "") errors.push(`${key} override has no owner`);
    if (typeof override.evidenceTarget !== "string" || override.evidenceTarget.trim() === "") errors.push(`${key} override has no evidence target`);
    if (!ledger.statusVocabulary?.includes(override.status)) errors.push(`${key} override has invalid status`);
    resolved.set(key, { ...resolved.get(key), ...override });
  }
  const expectedRanges = [["prd-requirement", "REQ-", 1, 94, 3], ["prd-invariant", "INV-", 1, 28, 3], ["studio-section", "STUDIO-", 3, 27, 2], ["runtime-section", "RUNTIME-", 2, 23, 2]];
  for (const [dimension, prefix, start, end, width] of expectedRanges) {
    for (let number = start; number <= end; number += 1) {
      const key = `${dimension}:${prefix}${String(number).padStart(width, "0")}`;
      if (!resolved.has(key)) errors.push(`missing obligation ${key}`);
    }
  }
  const expectedExact = {
    "persona-journey": ["simulation-designer", "studio-administrator", "reviewer-methodology-owner", "session-operator", "control-staff", "participant", "subject-matter-adjudicator", "research-evaluation-analyst"],
    "product-screen": ["root-entry", "authentication", "organization-portal", "project-portal", "template-catalog", "release-catalog", "session-catalog", "studio", "participant-runtime", "operator-console", "administration", "reporting-replay-archive"],
    "api-boundary": ["product-shell-v1", "identity", "organization-project-template", "publication-package", "session-lifecycle", "studio-authoring", "runtime-command", "operator-control", "evidence-report-replay", "administration-policy"],
    "ui-state": ["loading", "empty", "pending", "success", "error", "unauthorized", "offline", "stale-conflict", "revoked", "disabled-read-only"],
    "viewport": ["desktop", "narrow-width", "200-percent-text", "reduced-motion", "forced-colors"],
    "release-control": ["CMD-PLATFORM-LINT", "CMD-PLATFORM-TYPECHECK", "CMD-PLATFORM-TEST", "CMD-PRODUCT-E2E", "CMD-GAP-AUDIT", "CMD-PLATFORM-A11Y", "CMD-TELUDENS-AUDIT", "clean-install", "upgrade-forward-fix", "backup-restore", "security-review", "observability", "human-acceptance", "production-owner-decision"]
  };
  for (const [dimension, obligations] of Object.entries(expectedExact)) {
    for (const obligation of obligations) {
      if (!resolved.has(`${dimension}:${obligation}`)) errors.push(`missing obligation ${dimension}:${obligation}`);
    }
  }
  for (const dimension of allowedDimensions) {
    if (![...resolved.keys()].some((key) => key.startsWith(`${dimension}:`))) errors.push(`dimension ${dimension} is empty`);
  }
  for (const [key, row] of resolved) {
    if (typeof row.owner !== "string" || row.owner.trim() === "") errors.push(`${key} resolves without an owner`);
    if (typeof row.evidenceTarget !== "string" || row.evidenceTarget.trim() === "") errors.push(`${key} resolves without evidence`);
    if (release && !["PASS", "N/A"].includes(row.status)) errors.push(`${key} is ${row.status}`);
  }
  return { errors, resolved };
}

const ledger = JSON.parse(await readFile(path, "utf8"));
const release = process.argv.includes("--release");
const result = validateLedger(ledger, release);
const omitted = structuredClone(ledger);
omitted.groups.find(({ dimension }) => dimension === "ui-state").obligations.pop();
const negative = validateLedger(omitted).errors.some((error) => error === "missing obligation ui-state:disabled-read-only");
if (!negative) result.errors.push("negative omission check did not detect the removed obligation");
if (result.errors.length > 0) {
  console.error(result.errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`product-completeness-ledger-v1 PASS: ${result.resolved.size} obligations; omission check PASS${release ? "; release mode" : ""}`);
}
