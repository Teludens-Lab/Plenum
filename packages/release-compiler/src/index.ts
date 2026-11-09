import { createHash } from "node:crypto";
import { canonicalizeJson, type JsonObject, type JsonValue } from "@plenum/event-contracts";
import {
  RELEASE_MANIFEST_CONTRACT_ID,
  SIMULATION_SCHEMA_VERSION,
  assertRuntimeCoreDesign,
  assertRuntimeScenario,
  hasPinnedPluginDigest,
  projectEnabledConcepts,
  validateMethodologyConcepts,
  type CoreDesignV1,
  type ReleaseManifestV1,
  type ScenarioV1,
  type SimulationReleaseV1
} from "@plenum/simulation-schema";
import { compileModelComposition, previewCompositionFixture, type CompositionPreviewV1 } from "./compositions/index.js";

export const RELEASE_COMPILER_VERSION = "0.2.0";
export { RELEASE_MANIFEST_CONTRACT_ID };
export const PACKAGE_IMPORT_CONTRACT_ID = "package-import-v1";
export const PACKAGE_SCHEMA_VERSION = "1.0.0";
export { compileModelComposition, previewCompositionFixture, type CompositionPreviewV1 };
export { classifyReleaseCompatibility, type CompatibilityReleaseInput } from "./compatibility.js";

export interface ReleasePackageV1 extends JsonObject {
  contractId: typeof PACKAGE_IMPORT_CONTRACT_ID;
  packageSchemaVersion: typeof PACKAGE_SCHEMA_VERSION;
  manifest: ReleaseManifestV1 & JsonObject;
  manifestDigest: string;
  coreDesign: CoreDesignV1 & JsonObject;
  scenario: ScenarioV1 & JsonObject;
}

export interface CompileReleaseInput {
  releaseId: string;
  projectId: string;
  definitionRevisionId: string;
  releaseLabel: string;
  semanticVersion: string;
  methodologyVersion: string;
  materialization: { coreDesign: CoreDesignV1; scenario: ScenarioV1 };
  publishedBy: string;
  approvedBy: string[];
  publishedAt: string;
  releaseNotes: string;
  validationReportId: string;
}

export interface CompiledRelease {
  release: SimulationReleaseV1;
  bytes: Uint8Array;
  contentDigest: string;
  manifestDigest: string;
  packageDigest: string;
}

export const releasePackageV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: PACKAGE_IMPORT_CONTRACT_ID,
  title: "Portable Release Package v1",
  type: "object",
  additionalProperties: false,
  required: ["contractId", "packageSchemaVersion", "manifest", "manifestDigest", "coreDesign", "scenario"],
  properties: {
    contractId: { const: PACKAGE_IMPORT_CONTRACT_ID },
    packageSchemaVersion: { const: PACKAGE_SCHEMA_VERSION },
    manifest: { $ref: RELEASE_MANIFEST_CONTRACT_ID },
    manifestDigest: { type: "string", pattern: "^[0-9a-f]{64}$" },
    coreDesign: { type: "object" },
    scenario: { type: "object" }
  }
} as const;

const digestPattern = /^[0-9a-f]{64}$/u;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const prohibitedKeys = new Set([
  "apikey", "authorization", "clientsecret", "credential", "credentials", "participant", "participantdata",
  "participantid", "participants", "password", "privatekey", "secretkey", "secretref", "secretreference", "secrets", "sessiondata", "token"
]);
const packageKeys = new Set(["contractId", "packageSchemaVersion", "manifest", "manifestDigest", "coreDesign", "scenario"]);
const manifestKeys = new Set([
  "schemaVersion", "releaseId", "projectId", "definitionRevisionId", "releaseLabel", "semanticVersion",
  "methodologyVersion", "compilerVersion", "contentDigest", "publishedBy", "approvedBy", "publishedAt",
  "releaseNotes", "validationReportId"
]);

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function asJson(value: unknown): JsonValue {
  return value as JsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertPackageShape(value: unknown): asserts value is ReleasePackageV1 {
  if (!isRecord(value) || Object.keys(value).some((key) => !packageKeys.has(key))) throw new Error("Package shape is invalid");
  if (!isRecord(value.manifest) || Object.keys(value.manifest).some((key) => !manifestKeys.has(key))) {
    throw new Error("Release manifest shape is invalid");
  }
  const manifest = value.manifest;
  for (const field of ["releaseId", "projectId", "definitionRevisionId", "publishedBy", "validationReportId"] as const) {
    if (typeof manifest[field] !== "string" || !uuidPattern.test(manifest[field])) throw new Error(`Release manifest ${field} is invalid`);
  }
  for (const field of ["releaseLabel", "methodologyVersion", "compilerVersion"] as const) {
    if (typeof manifest[field] !== "string" || manifest[field].length === 0) throw new Error(`Release manifest ${field} is invalid`);
  }
  if (typeof manifest.semanticVersion !== "string" || !/^\d+\.\d+\.\d+$/u.test(manifest.semanticVersion) ||
      typeof manifest.releaseNotes !== "string" || typeof manifest.contentDigest !== "string" ||
      !digestPattern.test(manifest.contentDigest) || typeof manifest.publishedAt !== "string" ||
      Number.isNaN(Date.parse(manifest.publishedAt)) ||
      !Array.isArray(manifest.approvedBy) || manifest.approvedBy.length === 0 ||
      manifest.approvedBy.some((id) => typeof id !== "string" || !uuidPattern.test(id)) ||
      new Set(manifest.approvedBy).size !== manifest.approvedBy.length) {
    throw new Error("Release manifest values are invalid");
  }
  if (!isRecord(value.coreDesign) || !Array.isArray(value.coreDesign.pluginBindings) ||
      value.coreDesign.pluginBindings.some((binding) => !isRecord(binding) || typeof binding.id !== "string" ||
        typeof binding.pluginVersion !== "string" || typeof binding.pluginDigest !== "string")) {
    throw new Error("Core Design Plugin Bindings are invalid");
  }
  if (!isRecord(value.scenario) || typeof value.scenario.id !== "string" || value.scenario.id.length === 0 ||
      typeof value.scenario.name !== "string" || typeof value.scenario.description !== "string" ||
      !Array.isArray(value.scenario.deliveryModes) || !Array.isArray(value.scenario.tags) ||
      typeof value.manifestDigest !== "string") {
    throw new Error("Package content is incomplete");
  }
}

function assertPortable(value: JsonValue, path = "release"): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPortable(item, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (prohibitedKeys.has(key.replaceAll("_", "").replaceAll("-", "").toLowerCase())) throw new Error(`Package contains prohibited data at ${path}.${key}`);
    assertPortable(child, `${path}.${key}`);
  }
}

function assertPinnedDependencies(coreDesign: CoreDesignV1): void {
  for (const binding of coreDesign.pluginBindings) {
    if (!hasPinnedPluginDigest(binding)) throw new Error(`Plugin Binding ${binding.id} is not pinned by digest`);
  }
  const adapters = coreDesign.platformAdapters;
  if (adapters === undefined) return;
  if (!Array.isArray(adapters) || adapters.some((adapter) =>
    typeof adapter !== "object" || adapter === null ||
    !("digest" in adapter) || typeof adapter.digest !== "string" || !digestPattern.test(adapter.digest))) {
    throw new Error("Every Platform Adapter must be pinned by digest");
  }
}

function assertExecutableRuntimeDesign(coreDesign: CoreDesignV1, scenario: ScenarioV1): void {
  if (coreDesign.teams !== undefined || coreDesign.methodologyContractId !== undefined || coreDesign.forms?.some((form) => form.contractId !== undefined)) {
    assertRuntimeCoreDesign(coreDesign);
    assertRuntimeScenario(coreDesign, scenario);
  }
}

function compiledCoreDesign(coreDesign: CoreDesignV1): CoreDesignV1 {
  const compiled = structuredClone(coreDesign);
  if (compiled.compositions !== undefined) {
    const roles = new Set(compiled.sessionRoles?.map(({ id }) => id) ?? []);
    compiled.compositions = compiled.compositions.map((composition) =>
      compileModelComposition(composition, compiled.pluginBindings, roles));
  }
  return compiled;
}

function assertCompiledCompositions(coreDesign: CoreDesignV1): void {
  const roles = new Set(coreDesign.sessionRoles?.map(({ id }) => id) ?? []);
  for (const composition of coreDesign.compositions ?? []) {
    const compiled = compileModelComposition(composition, coreDesign.pluginBindings, roles);
    if (composition.graphDigest !== compiled.graphDigest ||
        canonicalizeJson(asJson(composition.dependencyClosure ?? [])) !== canonicalizeJson(asJson(compiled.dependencyClosure ?? []))) {
      throw new Error(`Model Composition ${composition.id} digest or dependency closure is invalid`);
    }
  }
}

function validateInput(input: CompileReleaseInput): void {
  for (const id of [input.releaseId, input.projectId, input.definitionRevisionId, input.publishedBy, input.validationReportId]) {
    if (!uuidPattern.test(id)) throw new Error("Release identifiers must be UUIDs");
  }
  if (input.releaseLabel.length === 0 || input.methodologyVersion.length === 0) {
    throw new Error("Release label and methodology version are required");
  }
  if (!/^\d+\.\d+\.\d+$/u.test(input.semanticVersion)) throw new Error("semanticVersion must be semantic version core syntax");
  if (input.approvedBy.length === 0 || input.approvedBy.some((id) => !uuidPattern.test(id)) ||
      new Set(input.approvedBy).size !== input.approvedBy.length) {
    throw new Error("At least one valid publication approval is required");
  }
  const publishedAt = new Date(input.publishedAt);
  if (Number.isNaN(publishedAt.valueOf()) || publishedAt.toISOString() !== input.publishedAt) {
    throw new Error("publishedAt must be a canonical UTC timestamp");
  }
  if (input.materialization.scenario.id.length === 0 || !Array.isArray(input.materialization.coreDesign.pluginBindings)) {
    throw new Error("The frozen materialization is incomplete");
  }
  assertPortable(asJson(input.materialization));
  const conceptIssues = validateMethodologyConcepts(input.materialization);
  if (conceptIssues.length > 0) throw new Error(conceptIssues.map(({ message }) => message).join("\n"));
  const active = projectEnabledConcepts(input.materialization);
  assertPinnedDependencies(active.coreDesign);
  assertExecutableRuntimeDesign(active.coreDesign, active.scenario);
}

export function compileRelease(input: CompileReleaseInput): CompiledRelease {
  validateInput(input);
  const active = projectEnabledConcepts(input.materialization);
  const materialization = { coreDesign: compiledCoreDesign(active.coreDesign), scenario: active.scenario };
  const frozen = JSON.parse(canonicalizeJson(asJson(materialization))) as {
    coreDesign: CoreDesignV1 & JsonObject;
    scenario: ScenarioV1 & JsonObject;
  };
  const contentDigest = sha256(canonicalizeJson(frozen));
  const manifest: ReleaseManifestV1 & JsonObject = {
    schemaVersion: SIMULATION_SCHEMA_VERSION,
    releaseId: input.releaseId,
    projectId: input.projectId,
    definitionRevisionId: input.definitionRevisionId,
    releaseLabel: input.releaseLabel,
    semanticVersion: input.semanticVersion,
    methodologyVersion: input.methodologyVersion,
    compilerVersion: input.materialization.coreDesign.methodologyContractId === undefined && !input.materialization.coreDesign.forms?.some((form) => form.contractId !== undefined) ? "0.1.0" : RELEASE_COMPILER_VERSION,
    contentDigest,
    publishedBy: input.publishedBy,
    approvedBy: [...input.approvedBy].sort(),
    publishedAt: new Date(input.publishedAt).toISOString(),
    releaseNotes: input.releaseNotes,
    validationReportId: input.validationReportId
  };
  const manifestDigest = sha256(canonicalizeJson(manifest));
  const releasePackage: ReleasePackageV1 = {
    contractId: PACKAGE_IMPORT_CONTRACT_ID,
    packageSchemaVersion: PACKAGE_SCHEMA_VERSION,
    manifest,
    manifestDigest,
    coreDesign: frozen.coreDesign,
    scenario: frozen.scenario
  };
  const canonical = canonicalizeJson(releasePackage);
  return {
    release: { manifest, coreDesign: frozen.coreDesign, scenario: frozen.scenario },
    bytes: new TextEncoder().encode(canonical),
    contentDigest,
    manifestDigest,
    packageDigest: sha256(canonical)
  };
}

export function verifyReleasePackage(bytes: Uint8Array, expectedPackageDigest: string): CompiledRelease {
  if (sha256(bytes) !== expectedPackageDigest) throw new Error("Package digest mismatch");
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("Package is not valid JSON");
  }
  assertPackageShape(value);
  const pkg = value;
  if (pkg.contractId !== PACKAGE_IMPORT_CONTRACT_ID || pkg.packageSchemaVersion !== PACKAGE_SCHEMA_VERSION) {
    throw new Error("Package contract is incompatible");
  }
  if (canonicalizeJson(pkg) !== new TextDecoder().decode(bytes)) throw new Error("Package bytes are not canonical");
  if (pkg.manifest.schemaVersion !== SIMULATION_SCHEMA_VERSION || !["0.1.0", RELEASE_COMPILER_VERSION].includes(pkg.manifest.compilerVersion)) {
    throw new Error("Release schema or compiler is incompatible");
  }
  if (sha256(canonicalizeJson(pkg.manifest)) !== pkg.manifestDigest) throw new Error("Manifest digest mismatch");
  const contentDigest = sha256(canonicalizeJson({ coreDesign: pkg.coreDesign, scenario: pkg.scenario }));
  if (contentDigest !== pkg.manifest.contentDigest) throw new Error("Release content digest mismatch");
  if (pkg.coreDesign.forms?.some((form) => form.contractId !== undefined) && pkg.manifest.compilerVersion !== RELEASE_COMPILER_VERSION) throw new Error("Structured Forms require compiler 0.2.0");
  if (pkg.coreDesign.methodologyContractId !== undefined) {
    const authored = { coreDesign: pkg.coreDesign, scenario: pkg.scenario };
    const issues = validateMethodologyConcepts(authored);
    if (issues.length > 0) throw new Error(issues.map(({ message }) => message).join("\n"));
    if (pkg.manifest.compilerVersion !== RELEASE_COMPILER_VERSION ||
        canonicalizeJson(asJson(projectEnabledConcepts(authored))) !== canonicalizeJson(asJson(authored))) {
      throw new Error("Package contains inactive definitions or an incompatible methodology compiler version");
    }
  }
  assertPortable(asJson({ coreDesign: pkg.coreDesign, scenario: pkg.scenario }));
  assertPinnedDependencies(pkg.coreDesign);
  assertExecutableRuntimeDesign(pkg.coreDesign, pkg.scenario);
  assertCompiledCompositions(pkg.coreDesign);
  return {
    release: { manifest: pkg.manifest, coreDesign: pkg.coreDesign, scenario: pkg.scenario },
    bytes,
    contentDigest,
    manifestDigest: pkg.manifestDigest,
    packageDigest: expectedPackageDigest
  };
}
