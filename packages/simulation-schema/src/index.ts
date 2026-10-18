/** Canonical release types owned by Simulation Schema v1.3.1. */

export const SIMULATION_SCHEMA_VERSION = "1.3.1";
export const RELEASE_MANIFEST_SCHEMA_ID = "release-manifest-v1.3.1";

export interface ReleaseManifestV1 {
  schemaVersion: string;
  releaseId: string;
  projectId: string;
  definitionRevisionId: string;
  releaseLabel: string;
  semanticVersion: string;
  methodologyVersion: string;
  compilerVersion: string;
  contentDigest: string;
  publishedBy: string;
  approvedBy: string[];
  publishedAt: string;
  releaseNotes: string;
  validationReportId: string;
}

export interface PluginBindingV1 {
  id: string;
  pluginId: string;
  pluginVersion: string;
  pluginDigest: string;
  installationId: string;
  categories: string[];
  connectivity: "offline_capable" | "lan_required" | "external_required";
  configuration: Record<string, unknown>;
  configurationDigest: string;
  inputMappings: Array<{
    target: string;
    source: string;
    maxClassification?: "public" | "internal" | "confidential" | "restricted";
  }>;
  timeoutSeconds: number;
  enabledInProfiles: Array<"cloud" | "institutional" | "air_gapped">;
  localReplacementBindingId?: string;
}

export interface CoreDesignV1 {
  pluginBindings: PluginBindingV1[];
  [key: string]: unknown;
}

export interface ScenarioV1 {
  id: string;
  name: string;
  description: string;
  deliveryModes: Array<"in_person" | "virtual" | "hybrid" | "asynchronous">;
  tags: string[];
  [key: string]: unknown;
}

export interface SimulationReleaseV1 {
  manifest: ReleaseManifestV1;
  coreDesign: CoreDesignV1;
  scenario: ScenarioV1;
}

type ManifestSchema = Readonly<{
  $schema: "https://json-schema.org/draft/2020-12/schema";
  $id: string;
  title: string;
  type: "object";
  additionalProperties: false;
  required: readonly (keyof ReleaseManifestV1 & string)[];
  properties: { readonly [K in keyof Required<ReleaseManifestV1>]: Readonly<Record<string, unknown>> };
}>;

const uuidProperty = { type: "string", format: "uuid" } as const;
const nonEmptyStringProperty = { type: "string", minLength: 1 } as const;

export const releaseManifestV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: RELEASE_MANIFEST_SCHEMA_ID,
  title: "Release Manifest v1.3.1",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "releaseId",
    "projectId",
    "definitionRevisionId",
    "releaseLabel",
    "semanticVersion",
    "methodologyVersion",
    "compilerVersion",
    "contentDigest",
    "publishedBy",
    "approvedBy",
    "publishedAt",
    "releaseNotes",
    "validationReportId"
  ],
  properties: {
    schemaVersion: { const: SIMULATION_SCHEMA_VERSION },
    releaseId: uuidProperty,
    projectId: uuidProperty,
    definitionRevisionId: uuidProperty,
    releaseLabel: nonEmptyStringProperty,
    semanticVersion: { type: "string", pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
    methodologyVersion: nonEmptyStringProperty,
    compilerVersion: nonEmptyStringProperty,
    contentDigest: { type: "string", pattern: "^[0-9a-f]{64}$" },
    publishedBy: uuidProperty,
    approvedBy: { type: "array", items: uuidProperty },
    publishedAt: { type: "string", format: "date-time" },
    releaseNotes: { type: "string" },
    validationReportId: uuidProperty
  }
} as const satisfies ManifestSchema;

export function hasPinnedPluginDigest(binding: PluginBindingV1): boolean {
  return binding.pluginVersion.length > 0 && /^[0-9a-f]{64}$/u.test(binding.pluginDigest);
}
