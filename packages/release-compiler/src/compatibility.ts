import {
  COMPATIBILITY_REPORT_CONTRACT_ID,
  type CompatibilityChangeV1,
  type CompatibilityReportV1,
  type ReleaseChangeClassV1
} from "@plenum/event-contracts";
import type { CoreDesignV1, ScenarioV1 } from "@plenum/simulation-schema";

export interface CompatibilityReleaseInput {
  releaseId: string;
  schemaVersion: string;
  compilerVersion: string;
  coreDesign: CoreDesignV1;
  scenario: ScenarioV1;
}

const safePrefixes = [
  "coreDesign.identity", "coreDesign.presentation", "coreDesign.terminology",
  "scenario.name", "scenario.description", "scenario.tags"
];
const securityPrefixes = [
  "coreDesign.accessPolicy", "coreDesign.informationPolicies", "coreDesign.sessionRoles",
  "coreDesign.seats", "coreDesign.teams"
];
const rank: Record<ReleaseChangeClassV1, number> = {
  safe_prospective: 0,
  compatibility_dependent: 1,
  consequential: 2
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pathMatches(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`));
}

function classify(path: string, kind: CompatibilityChangeV1["kind"]): ReleaseChangeClassV1 {
  if (pathMatches(path, safePrefixes)) return "safe_prospective";
  return kind === "added" ? "compatibility_dependent" : "consequential";
}

function addChange(changes: CompatibilityChangeV1[], path: string, kind: CompatibilityChangeV1["kind"]): void {
  const classification = classify(path, kind);
  changes.push({ path, kind, classification, summary: `${path} was ${kind}` });
}

function compareArrays(before: unknown[], after: unknown[], path: string, changes: CompatibilityChangeV1[]): void {
  const identified = [...before, ...after].every((item) => isRecord(item) && typeof item.id === "string");
  if (!identified) {
    if (JSON.stringify(before) !== JSON.stringify(after)) addChange(changes, path, "changed");
    return;
  }
  const oldItems = new Map(before.map((item) => [(item as { id: string }).id, item]));
  const newItems = new Map(after.map((item) => [(item as { id: string }).id, item]));
  for (const id of [...new Set([...oldItems.keys(), ...newItems.keys()])].sort()) {
    const itemPath = `${path}[${id}]`;
    if (!oldItems.has(id)) addChange(changes, itemPath, "added");
    else if (!newItems.has(id)) addChange(changes, itemPath, "removed");
    else compare(oldItems.get(id), newItems.get(id), itemPath, changes);
  }
}

function compare(before: unknown, after: unknown, path: string, changes: CompatibilityChangeV1[]): void {
  if (Object.is(before, after)) return;
  if (Array.isArray(before) && Array.isArray(after)) return compareArrays(before, after, path, changes);
  if (isRecord(before) && isRecord(after)) {
    for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
      const childPath = path.length === 0 ? key : `${path}.${key}`;
      if (!(key in before)) addChange(changes, childPath, "added");
      else if (!(key in after)) addChange(changes, childPath, "removed");
      else compare(before[key], after[key], childPath, changes);
    }
    return;
  }
  addChange(changes, path, "changed");
}

export function classifyReleaseCompatibility(
  from: CompatibilityReleaseInput,
  to: CompatibilityReleaseInput
): CompatibilityReportV1 {
  const changes: CompatibilityChangeV1[] = [];
  compare(from.coreDesign, to.coreDesign, "coreDesign", changes);
  compare(from.scenario, to.scenario, "scenario", changes);
  changes.sort((left, right) => left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind));
  const blockedReasons: string[] = [];
  if (from.schemaVersion !== to.schemaVersion || from.compilerVersion !== to.compilerVersion) {
    blockedReasons.push("Cross-version live activation is not supported. A tested, versioned compatibility adapter and Technical Lead approval are required.");
  }
  if (changes.some((change) => pathMatches(change.path, securityPrefixes))) {
    blockedReasons.push("Live activation cannot migrate access, role, seat, Team, or information-policy topology. Start a new Session; security revocations still apply immediately.");
  }
  const classification = changes.reduce<ReleaseChangeClassV1>(
    (highest, change) => rank[change.classification] > rank[highest] ? change.classification : highest,
    "safe_prospective"
  );
  return {
    contractId: COMPATIBILITY_REPORT_CONTRACT_ID,
    fromReleaseId: from.releaseId,
    toReleaseId: to.releaseId,
    classification,
    changes,
    blockedReasons,
    requiresImpactReview: classification === "consequential",
    existingInstanceHandling: "keep_existing"
  };
}
