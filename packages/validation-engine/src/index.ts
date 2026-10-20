import { createHash } from "node:crypto";

import {
  canonicalizeJson,
  type JsonObject,
  type JsonValue,
  type StudioValidationIssueV1,
  type StudioValidationReportV1
} from "@plenum/event-contracts";
import {
  assertRuntimeCoreDesign,
  assertRuntimeScenario,
  type CoreDesignV1,
  type ScenarioV1
} from "@plenum/simulation-schema";

export interface StudioMaterialization {
  coreDesign: CoreDesignV1;
  scenario: ScenarioV1;
}

export class StudioValidationError extends Error {
  constructor(readonly report: StudioValidationReportV1) {
    super("The Draft has validation errors.");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sourceFor(message: string): { path: string; elementId: string | null } {
  const match = message.match(/^(Workflow|Stage|Form|Artifact Type|Information Policy|Interface Profile|Communication Route|Message Channel|Voice Channel|Poll|Inject|Report|Seat|Team Cell|Scenario content|Readiness check) ([^ ]+)/u);
  if (match === null) return { path: "coreDesign", elementId: null };
  const collections: Record<string, string> = {
    "Workflow": "workflows", "Stage": "stages", "Form": "forms", "Artifact Type": "artifactTypes",
    "Information Policy": "informationPolicies", "Interface Profile": "interfaceProfiles",
    "Communication Route": "communications.routes", "Message Channel": "communications.messageChannels",
    "Voice Channel": "communications.voiceChannels", "Poll": "polls", "Inject": "scenario.injects",
    "Report": "reports", "Seat": "seats", "Team Cell": "teams", "Scenario content": "scenario.content",
    "Readiness check": "readinessChecks"
  };
  const label = match[1] ?? "";
  const elementId = match[2] ?? null;
  const prefix = collections[label] ?? "coreDesign";
  return { path: `${prefix}.${elementId ?? ""}`, elementId };
}

function issue(code: string, message: string, path: string, elementId: string | null): StudioValidationIssueV1 {
  return { code, severity: "error", message, path, elementId };
}

function digestReport(valid: boolean, issues: StudioValidationIssueV1[]): StudioValidationReportV1 {
  const payload = { contractId: "studio-validation-v1", valid, issues } as const;
  return {
    ...payload,
    reportDigest: createHash("sha256").update(canonicalizeJson(payload as unknown as JsonValue)).digest("hex")
  };
}

export function validateStudioDraft(value: unknown): StudioValidationReportV1 {
  if (!record(value)) return digestReport(false, [issue("draft.required", "The Draft materialization is missing.", "draft", null)]);
  if (!record(value.coreDesign) || !record(value.scenario)) {
    return digestReport(false, [issue("draft.structure", "The Draft needs both a Core Design and a Scenario.", "draft", null)]);
  }
  const materialization = value as unknown as StudioMaterialization;
  const issues: StudioValidationIssueV1[] = [];
  try {
    assertRuntimeCoreDesign(materialization.coreDesign);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Core Design is invalid.";
    const source = sourceFor(message);
    issues.push(issue("core_design.invalid", message, source.path, source.elementId));
  }
  try {
    assertRuntimeScenario(materialization.coreDesign, materialization.scenario);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Scenario is invalid.";
    const source = sourceFor(message);
    issues.push(issue("scenario.invalid", message, source.path.startsWith("coreDesign") ? "scenario" : source.path, source.elementId));
  }
  return digestReport(issues.length === 0, issues);
}

export function requireValidStudioDraft(value: unknown): StudioMaterialization {
  const report = validateStudioDraft(value);
  if (!report.valid) throw new StudioValidationError(report);
  return value as StudioMaterialization;
}

export function asJsonMaterialization(value: StudioMaterialization): JsonObject {
  return value as unknown as JsonObject;
}
