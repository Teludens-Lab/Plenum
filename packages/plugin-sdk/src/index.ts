import {
  createHash,
  sign,
  verify,
  type KeyLike
} from "node:crypto";
import Ajv2020Import, { type AnySchema, type ErrorObject } from "ajv/dist/2020.js";
import { canonicalizeJson, type JsonObject, type JsonValue } from "@plenum/event-contracts";

export const PLUGIN_MANIFEST_CONTRACT_ID = "plugin-manifest-v1";
export const PLUGIN_REGISTRY_CONTRACT_ID = "plugin-registry-v1";
export const OFFLINE_PLUGIN_BUNDLE_CONTRACT_ID = "offline-plugin-bundle-v1";
export const PLUGIN_REVOCATIONS_CONTRACT_ID = "plugin-revocations-v1";
export const PLUGIN_MANIFEST_VERSION = "1.0.0";
export const OFFLINE_PLUGIN_BUNDLE_VERSION = "1.0.0";
export const PLUGIN_HOST_API_VERSION = "1.0.0";
export const MAX_PLUGIN_BUNDLE_BYTES = 512 * 1024 * 1024;
export const MAX_PLUGIN_SCHEMA_BYTES = 1024 * 1024;

export type PluginCategory =
  | "world_and_simulation"
  | "adjudication_and_assessment"
  | "content_and_experience"
  | "integration_and_export";

export type PluginCapability =
  | "compute"
  | "propose_effect"
  | "propose_inject"
  | "analyze"
  | "render_derived"
  | "read_approved_external"
  | "export_approved";

export type PluginConnectivity = "offline_capable" | "lan_required" | "external_required";

export interface PluginManifestV1 extends JsonObject {
  contractId: typeof PLUGIN_MANIFEST_CONTRACT_ID;
  manifestVersion: typeof PLUGIN_MANIFEST_VERSION;
  pluginId: string;
  version: string;
  digest: string;
  artifactPath: string;
  publisher: { id: string; signatureKeyId: string } & JsonObject;
  categories: PluginCategory[];
  capabilities: PluginCapability[];
  execution: { mode: "container"; entrypoint: string; rootless: true; readOnlyRoot: true } & JsonObject;
  connectivity: PluginConnectivity;
  contracts: { inputSchema: string; outputSchema: string } & JsonObject;
  compatibility: { hostApi: string; releaseSchema: string } & JsonObject;
  limits: { timeoutSeconds: number; memoryMiB: number; cpuMillis: number; outputBytes: number } & JsonObject;
  requestedPermissions: string[];
  dataClassificationMaximum: "public" | "internal" | "confidential" | "restricted";
  reproducibility: { deterministic: boolean; seedInput?: string } & JsonObject;
  dependencies: Array<{ pluginId: string; version: string; digest: string; path: string } & JsonObject>;
  provenance: { sourceRevision: string; buildSystem: string } & JsonObject;
  license: string;
}

export interface PluginBundleFileV1 extends JsonObject {
  path: string;
  digest: string;
  contentBase64: string;
}

export interface VulnerabilityFindingV1 extends JsonObject {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface OfflinePluginBundleV1 extends JsonObject {
  contractId: typeof OFFLINE_PLUGIN_BUNDLE_CONTRACT_ID;
  bundleVersion: typeof OFFLINE_PLUGIN_BUNDLE_VERSION;
  manifest: PluginManifestV1;
  files: PluginBundleFileV1[];
  supplyChain: {
    sbomPath: string;
    attestationType: string;
    attestedAt: string;
    vulnerabilities: VulnerabilityFindingV1[];
    vulnerabilityExceptions: Array<{ findingId: string; reason: string; expiresAt: string } & JsonObject>;
    license: string;
  } & JsonObject;
  signature: { algorithm: "Ed25519"; keyId: string; value: string } & JsonObject;
}

export interface PluginRevocationsV1 extends JsonObject {
  contractId: typeof PLUGIN_REVOCATIONS_CONTRACT_ID;
  generatedAt: string;
  publisherId: string;
  revokedKeyIds: string[];
  revokedDigests: string[];
  signature: { algorithm: "Ed25519"; keyId: string; value: string } & JsonObject;
}

interface UnsignedOfflinePluginBundleV1 extends JsonObject {
  contractId: typeof OFFLINE_PLUGIN_BUNDLE_CONTRACT_ID;
  bundleVersion: typeof OFFLINE_PLUGIN_BUNDLE_VERSION;
  manifest: PluginManifestV1;
  files: PluginBundleFileV1[];
  supplyChain: OfflinePluginBundleV1["supplyChain"];
}

interface UnsignedPluginRevocationsV1 extends JsonObject {
  contractId: typeof PLUGIN_REVOCATIONS_CONTRACT_ID;
  generatedAt: string;
  publisherId: string;
  revokedKeyIds: string[];
  revokedDigests: string[];
}

export interface PluginTrustRoot {
  publisherId: string;
  publisherKeyId: string;
  publisherPublicKey: KeyLike;
  revocationKeyId: string;
  revocationPublicKey: KeyLike;
}

export interface VerifiedPluginBundle {
  bundle: OfflinePluginBundleV1;
  bundleDigest: string;
  manifestDigest: string;
  files: ReadonlyMap<string, Uint8Array>;
}

export const pluginManifestV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: PLUGIN_MANIFEST_CONTRACT_ID,
  title: "Plugin Manifest v1",
  type: "object",
  additionalProperties: false,
  required: [
    "contractId", "manifestVersion", "pluginId", "version", "digest", "artifactPath", "publisher",
    "categories", "capabilities", "execution", "connectivity", "contracts", "compatibility", "limits",
    "requestedPermissions", "dataClassificationMaximum", "reproducibility", "dependencies", "provenance", "license"
  ],
  properties: {
    contractId: { const: PLUGIN_MANIFEST_CONTRACT_ID },
    manifestVersion: { const: PLUGIN_MANIFEST_VERSION },
    pluginId: { type: "string", pattern: "^[a-z][a-z0-9]*(?:\\.[a-z][a-z0-9_-]*){2,}$", maxLength: 200 },
    version: { type: "string", pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
    digest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    artifactPath: { type: "string", minLength: 1, maxLength: 240 },
    publisher: {
      type: "object", additionalProperties: false, required: ["id", "signatureKeyId"],
      properties: { id: { type: "string", minLength: 1, maxLength: 120 }, signatureKeyId: { type: "string", minLength: 1, maxLength: 120 } }
    },
    categories: { type: "array", minItems: 1, uniqueItems: true, items: { enum: ["world_and_simulation", "adjudication_and_assessment", "content_and_experience", "integration_and_export"] } },
    capabilities: { type: "array", minItems: 1, uniqueItems: true, items: { enum: ["compute", "propose_effect", "propose_inject", "analyze", "render_derived", "read_approved_external", "export_approved"] } },
    execution: {
      type: "object", additionalProperties: false, required: ["mode", "entrypoint", "rootless", "readOnlyRoot"],
      properties: { mode: { const: "container" }, entrypoint: { type: "string", minLength: 1, maxLength: 240 }, rootless: { const: true }, readOnlyRoot: { const: true } }
    },
    connectivity: { enum: ["offline_capable", "lan_required", "external_required"] },
    contracts: {
      type: "object", additionalProperties: false, required: ["inputSchema", "outputSchema"],
      properties: { inputSchema: { type: "string", minLength: 1, maxLength: 240 }, outputSchema: { type: "string", minLength: 1, maxLength: 240 } }
    },
    compatibility: {
      type: "object", additionalProperties: false, required: ["hostApi", "releaseSchema"],
      properties: { hostApi: { type: "string", pattern: "^>=[0-9]+\\.[0-9]+\\.[0-9]+ <[0-9]+\\.[0-9]+\\.[0-9]+$" }, releaseSchema: { type: "string", pattern: "^>=[0-9]+\\.[0-9]+\\.[0-9]+ <[0-9]+\\.[0-9]+\\.[0-9]+$" } }
    },
    limits: {
      type: "object", additionalProperties: false, required: ["timeoutSeconds", "memoryMiB", "cpuMillis", "outputBytes"],
      properties: {
        timeoutSeconds: { type: "integer", minimum: 1, maximum: 300 },
        memoryMiB: { type: "integer", minimum: 32, maximum: 4096 },
        cpuMillis: { type: "integer", minimum: 100, maximum: 300000 },
        outputBytes: { type: "integer", minimum: 1, maximum: 10485760 }
      }
    },
    requestedPermissions: { type: "array", uniqueItems: true, items: { enum: ["state_values.read:mapped", "effects.propose", "injects.propose", "derived_metrics.write", "approved_external.read", "approved_export.write"] } },
    dataClassificationMaximum: { enum: ["public", "internal", "confidential", "restricted"] },
    reproducibility: {
      type: "object", additionalProperties: false, required: ["deterministic"],
      properties: { deterministic: { type: "boolean" }, seedInput: { type: "string", minLength: 1 } }
    },
    dependencies: {
      type: "array", maxItems: 256, uniqueItems: true, items: {
        type: "object", additionalProperties: false, required: ["pluginId", "version", "digest", "path"],
        properties: {
          pluginId: { type: "string", minLength: 1 }, version: { type: "string", pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
          digest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" }, path: { type: "string", minLength: 1, maxLength: 240 }
        }
      }
    },
    provenance: {
      type: "object", additionalProperties: false, required: ["sourceRevision", "buildSystem"],
      properties: { sourceRevision: { type: "string", minLength: 1 }, buildSystem: { type: "string", minLength: 1 } }
    },
    license: { type: "string", minLength: 1, maxLength: 200 }
  }
} as const;

const ajv = new Ajv2020Import.default({ allErrors: true, strict: true });
const manifestValidator = ajv.compile(pluginManifestV1Schema);
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const safePathPattern = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;

function sha256(bytes: Uint8Array | string): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function validationMessage(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`).join("; ");
}

function assertSafePath(path: string): void {
  if (!safePathPattern.test(path) || path.includes("//")) throw new Error(`Unsafe bundle path: ${path}`);
}

function parseVersion(value: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(value);
  if (match === null) throw new Error(`Invalid semantic version: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersion(left: [number, number, number], right: [number, number, number]): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

export function satisfiesPluginRange(version: string, range: string): boolean {
  const match = /^>=(\d+\.\d+\.\d+) <(\d+\.\d+\.\d+)$/u.exec(range);
  if (match === null || match[1] === undefined || match[2] === undefined) return false;
  const candidate = parseVersion(version);
  return compareVersion(candidate, parseVersion(match[1])) >= 0 && compareVersion(candidate, parseVersion(match[2])) < 0;
}

export function assertPluginManifest(value: unknown): asserts value is PluginManifestV1 {
  if (!manifestValidator(value)) throw new Error(`Plugin manifest is invalid: ${validationMessage(manifestValidator.errors)}`);
  const manifest = value as PluginManifestV1;
  for (const path of [manifest.artifactPath, manifest.contracts.inputSchema, manifest.contracts.outputSchema, ...manifest.dependencies.map(({ path }) => path)]) {
    assertSafePath(path);
  }
  if (new Set(manifest.dependencies.map(({ pluginId }) => pluginId)).size !== manifest.dependencies.length) {
    throw new Error("Plugin dependencies must have unique plugin IDs");
  }
  if (manifest.reproducibility.deterministic && manifest.reproducibility.seedInput === undefined) {
    throw new Error("Deterministic Plugins must declare a seed input");
  }
}

export function assertJsonSchemaValue(schema: unknown, value: unknown, label = "value"): void {
  const validator = compileJsonSchema(schema, label);
  if (!validator(value)) throw new Error(`${label} does not match its schema: ${validationMessage(validator.errors)}`);
}

function compileJsonSchema(schema: unknown, label: string) {
  if (!isRecord(schema) || schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
    throw new Error(`${label} schema must declare JSON Schema 2020-12`);
  }
  try {
    return new Ajv2020Import.default({ allErrors: true, strict: true }).compile(schema as AnySchema);
  } catch (error) {
    throw new Error(`${label} schema is invalid: ${error instanceof Error ? error.message : "unknown schema error"}`);
  }
}

function signingPayload(bundle: UnsignedOfflinePluginBundleV1): string {
  return canonicalizeJson({
    contractId: bundle.contractId,
    bundleVersion: bundle.bundleVersion,
    manifest: bundle.manifest,
    files: bundle.files.map(({ path, digest }) => ({ path, digest })),
    supplyChain: bundle.supplyChain
  });
}

function revocationPayload(document: UnsignedPluginRevocationsV1): string {
  return canonicalizeJson(document);
}

function decodeBase64(value: string, label: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    throw new Error(`${label} is not canonical base64`);
  }
  return Buffer.from(value, "base64");
}

function assertCanonicalInstant(value: string, label: string): Date {
  const instant = new Date(value);
  if (Number.isNaN(instant.valueOf()) || instant.toISOString() !== value) throw new Error(`${label} must be a canonical UTC instant`);
  return instant;
}

function assertBundleShape(value: unknown): asserts value is OfflinePluginBundleV1 {
  if (!isRecord(value) || value.contractId !== OFFLINE_PLUGIN_BUNDLE_CONTRACT_ID ||
      value.bundleVersion !== OFFLINE_PLUGIN_BUNDLE_VERSION || !Array.isArray(value.files) ||
      value.files.length > 260 || !isRecord(value.supplyChain) || !isRecord(value.signature) ||
      !hasOnlyKeys(value, ["contractId", "bundleVersion", "manifest", "files", "supplyChain", "signature"]) ||
      !hasOnlyKeys(value.supplyChain, ["sbomPath", "attestationType", "attestedAt", "vulnerabilities", "vulnerabilityExceptions", "license"]) ||
      typeof value.supplyChain.sbomPath !== "string" || typeof value.supplyChain.attestationType !== "string" ||
      typeof value.supplyChain.attestedAt !== "string" || typeof value.supplyChain.license !== "string" ||
      !Array.isArray(value.supplyChain.vulnerabilities) || !Array.isArray(value.supplyChain.vulnerabilityExceptions) ||
      value.supplyChain.vulnerabilities.some((finding) => !isRecord(finding) || !hasOnlyKeys(finding, ["id", "severity"]) ||
        typeof finding.id !== "string" || !["low", "medium", "high", "critical"].includes(String(finding.severity))) ||
      value.supplyChain.vulnerabilityExceptions.some((exception) => !isRecord(exception) ||
        !hasOnlyKeys(exception, ["findingId", "reason", "expiresAt"]) ||
        typeof exception.findingId !== "string" || typeof exception.reason !== "string" || typeof exception.expiresAt !== "string")) {
    throw new Error("Offline Plugin bundle shape is invalid");
  }
  assertPluginManifest(value.manifest);
  if (!hasOnlyKeys(value.signature, ["algorithm", "keyId", "value"]) || value.signature.algorithm !== "Ed25519" ||
      typeof value.signature.keyId !== "string" || value.signature.keyId.length === 0 || typeof value.signature.value !== "string") {
    throw new Error("Offline Plugin bundle signature is invalid");
  }
}

function assertRevocationsShape(value: unknown): asserts value is PluginRevocationsV1 {
  if (!isRecord(value) || !hasOnlyKeys(value, ["contractId", "generatedAt", "publisherId", "revokedKeyIds", "revokedDigests", "signature"]) ||
      value.contractId !== PLUGIN_REVOCATIONS_CONTRACT_ID || typeof value.generatedAt !== "string" ||
      typeof value.publisherId !== "string" || value.publisherId.length === 0 || !Array.isArray(value.revokedKeyIds) ||
      !Array.isArray(value.revokedDigests) || value.revokedKeyIds.some((key) => typeof key !== "string" || key.length === 0) ||
      value.revokedDigests.some((digest) => typeof digest !== "string" || !digestPattern.test(digest)) ||
      !isRecord(value.signature) || !hasOnlyKeys(value.signature, ["algorithm", "keyId", "value"]) ||
      value.signature.algorithm !== "Ed25519" || typeof value.signature.keyId !== "string" ||
      typeof value.signature.value !== "string") {
    throw new Error("Revocation list shape is invalid");
  }
}

function assertSupplyChain(bundle: OfflinePluginBundleV1, now: Date): void {
  const chain = bundle.supplyChain;
  if (chain.license !== bundle.manifest.license || chain.attestationType.length === 0) throw new Error("Supply-chain attestation is incomplete");
  if (assertCanonicalInstant(chain.attestedAt, "Supply-chain attestation time") > now) throw new Error("Supply-chain attestation time is in the future");
  const activeExceptions = new Map(chain.vulnerabilityExceptions.map((exception) => [exception.findingId, exception]));
  for (const finding of chain.vulnerabilities) {
    if (finding.severity === "critical") throw new Error(`Critical vulnerability is not allowed: ${finding.id}`);
    if (finding.severity === "high") {
      const exception = activeExceptions.get(finding.id);
      if (exception === undefined || exception.reason.length === 0 || assertCanonicalInstant(exception.expiresAt, "Vulnerability exception expiry") <= now) {
        throw new Error(`High vulnerability requires an active recorded exception: ${finding.id}`);
      }
    }
  }
}

function bundleFiles(bundle: OfflinePluginBundleV1): ReadonlyMap<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  for (const file of bundle.files) {
    if (!isRecord(file) || !hasOnlyKeys(file, ["path", "digest", "contentBase64"]) ||
        typeof file.path !== "string" || typeof file.digest !== "string" ||
        typeof file.contentBase64 !== "string" || !digestPattern.test(file.digest)) {
      throw new Error("Offline Plugin bundle file entry is invalid");
    }
    assertSafePath(file.path);
    if (files.has(file.path)) throw new Error(`Duplicate bundle path: ${file.path}`);
    const content = decodeBase64(file.contentBase64, file.path);
    if (sha256(content) !== file.digest) throw new Error(`Bundle file digest mismatch: ${file.path}`);
    files.set(file.path, content);
  }
  const references = [bundle.manifest.artifactPath, bundle.manifest.contracts.inputSchema, bundle.manifest.contracts.outputSchema,
    bundle.supplyChain.sbomPath, ...bundle.manifest.dependencies.map(({ path }) => path)];
  if (new Set(references).size !== references.length || references.some((path) => !files.has(path)) || files.size !== references.length) {
    throw new Error("Bundle dependency closure is incomplete or contains unreferenced files");
  }
  if (sha256(files.get(bundle.manifest.artifactPath)!) !== bundle.manifest.digest) throw new Error("Plugin Artifact digest mismatch");
  for (const dependency of bundle.manifest.dependencies) {
    if (sha256(files.get(dependency.path)!) !== dependency.digest) throw new Error(`Plugin dependency digest mismatch: ${dependency.pluginId}`);
  }
  const inputSchemaBytes = files.get(bundle.manifest.contracts.inputSchema)!;
  const outputSchemaBytes = files.get(bundle.manifest.contracts.outputSchema)!;
  if (inputSchemaBytes.byteLength > MAX_PLUGIN_SCHEMA_BYTES || outputSchemaBytes.byteLength > MAX_PLUGIN_SCHEMA_BYTES) {
    throw new Error("Plugin contract schema exceeds the 1 MiB verification limit");
  }
  const inputSchema = JSON.parse(new TextDecoder().decode(inputSchemaBytes)) as unknown;
  const outputSchema = JSON.parse(new TextDecoder().decode(outputSchemaBytes)) as unknown;
  compileJsonSchema(inputSchema, "Plugin input");
  compileJsonSchema(outputSchema, "Plugin output");
  const sbomBytes = files.get(bundle.supplyChain.sbomPath)!;
  let sbom: unknown;
  try {
    sbom = JSON.parse(new TextDecoder().decode(sbomBytes));
  } catch {
    throw new Error("SBOM is not valid JSON");
  }
  if (!isRecord(sbom) || sbom.bomFormat !== "CycloneDX") throw new Error("SBOM must be a CycloneDX document");
  return files;
}

export function createOfflinePluginBundle(input: {
  manifest: PluginManifestV1;
  files: ReadonlyMap<string, Uint8Array>;
  supplyChain: OfflinePluginBundleV1["supplyChain"];
  privateKey: KeyLike;
}): { bundle: OfflinePluginBundleV1; bytes: Uint8Array; bundleDigest: string; manifestDigest: string } {
  assertPluginManifest(input.manifest);
  const totalBytes = [...input.files.values()].reduce((total, content) => total + content.byteLength, 0);
  // shortcut: in-memory bundles are capped at 512 MiB, upgrade to streaming verification before larger model artifacts.
  if (totalBytes > MAX_PLUGIN_BUNDLE_BYTES) throw new Error("Offline Plugin bundle exceeds the 512 MiB verification limit");
  const unsigned: UnsignedOfflinePluginBundleV1 = {
    contractId: OFFLINE_PLUGIN_BUNDLE_CONTRACT_ID,
    bundleVersion: OFFLINE_PLUGIN_BUNDLE_VERSION,
    manifest: input.manifest,
    files: [...input.files.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([path, content]) => ({
      path,
      digest: sha256(content),
      contentBase64: Buffer.from(content).toString("base64")
    })),
    supplyChain: input.supplyChain
  };
  const signatureValue = sign(null, Buffer.from(signingPayload(unsigned)), input.privateKey).toString("base64");
  const bundle: OfflinePluginBundleV1 = {
    ...unsigned,
    signature: { algorithm: "Ed25519", keyId: input.manifest.publisher.signatureKeyId, value: signatureValue }
  };
  const bytes = new TextEncoder().encode(canonicalizeJson(bundle));
  if (bytes.byteLength > MAX_PLUGIN_BUNDLE_BYTES) throw new Error("Offline Plugin bundle exceeds the 512 MiB verification limit");
  return { bundle, bytes, bundleDigest: sha256(bytes), manifestDigest: sha256(canonicalizeJson(input.manifest)) };
}

export function createPluginRevocations(input: {
  generatedAt: string;
  publisherId: string;
  revokedKeyIds?: string[];
  revokedDigests?: string[];
  keyId: string;
  privateKey: KeyLike;
}): PluginRevocationsV1 {
  assertCanonicalInstant(input.generatedAt, "Revocation list generatedAt");
  const unsigned: UnsignedPluginRevocationsV1 = {
    contractId: PLUGIN_REVOCATIONS_CONTRACT_ID,
    generatedAt: input.generatedAt,
    publisherId: input.publisherId,
    revokedKeyIds: [...new Set(input.revokedKeyIds ?? [])].sort(),
    revokedDigests: [...new Set(input.revokedDigests ?? [])].sort()
  };
  return {
    ...unsigned,
    signature: { algorithm: "Ed25519", keyId: input.keyId, value: sign(null, Buffer.from(revocationPayload(unsigned)), input.privateKey).toString("base64") }
  };
}

export function verifyPluginRevocations(document: PluginRevocationsV1, trustRoot: PluginTrustRoot, now = new Date()): void {
  assertRevocationsShape(document);
  if (document.contractId !== PLUGIN_REVOCATIONS_CONTRACT_ID || document.publisherId !== trustRoot.publisherId ||
      document.signature.algorithm !== "Ed25519" || document.signature.keyId !== trustRoot.revocationKeyId) {
    throw new Error("Revocation list trust root mismatch");
  }
  const { signature, ...unsignedValue } = document;
  const unsigned: UnsignedPluginRevocationsV1 = unsignedValue;
  if (!verify(null, Buffer.from(revocationPayload(unsigned)), trustRoot.revocationPublicKey, decodeBase64(signature.value, "Revocation signature"))) {
    throw new Error("Revocation list signature is invalid");
  }
  const generatedAt = assertCanonicalInstant(document.generatedAt, "Revocation list generatedAt");
  if (generatedAt > now || now.valueOf() - generatedAt.valueOf() > 30 * 24 * 60 * 60 * 1000) {
    throw new Error("Revocation list is stale");
  }
  if (document.revokedDigests.some((digest) => !digestPattern.test(digest))) throw new Error("Revocation list contains an invalid digest");
}

export function verifyOfflinePluginBundle(bytes: Uint8Array, input: {
  trustRoot: PluginTrustRoot;
  revocations: PluginRevocationsV1;
  hostApiVersion: string;
  releaseSchemaVersion: string;
  acceptedLicenses: ReadonlySet<string>;
  deploymentProfile: "connected" | "self_hosted" | "air_gapped";
  now?: Date;
}): VerifiedPluginBundle {
  const verified = verifyPluginBundleForIntake(bytes, {
    publisherId: input.trustRoot.publisherId,
    publisherKeyId: input.trustRoot.publisherKeyId,
    publisherPublicKey: input.trustRoot.publisherPublicKey,
    ...(input.now === undefined ? {} : { now: input.now })
  });
  const bundle = verified.bundle;
  const now = input.now ?? new Date();
  verifyPluginRevocations(input.revocations, input.trustRoot, now);
  if (input.revocations.revokedKeyIds.includes(bundle.signature.keyId) || input.revocations.revokedDigests.includes(bundle.manifest.digest)) {
    throw new Error("Plugin Artifact is revoked");
  }
  if (!satisfiesPluginRange(input.hostApiVersion, bundle.manifest.compatibility.hostApi) ||
      !satisfiesPluginRange(input.releaseSchemaVersion, bundle.manifest.compatibility.releaseSchema)) {
    throw new Error("Plugin is incompatible with this host or Release schema");
  }
  if (input.deploymentProfile === "air_gapped" && bundle.manifest.connectivity === "external_required") {
    throw new Error("External-required Plugin is unavailable in an air-gapped profile");
  }
  if (!input.acceptedLicenses.has(bundle.manifest.license)) throw new Error("Organization has not accepted the Plugin license");
  return verified;
}

export function verifyPluginBundleForIntake(bytes: Uint8Array, input: {
  publisherId: string;
  publisherKeyId: string;
  publisherPublicKey: KeyLike;
  now?: Date;
}): VerifiedPluginBundle {
  if (bytes.byteLength > MAX_PLUGIN_BUNDLE_BYTES) throw new Error("Offline Plugin bundle exceeds the 512 MiB verification limit");
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("Offline Plugin bundle is not valid JSON");
  }
  assertBundleShape(value);
  const bundle = value;
  if (canonicalizeJson(bundle) !== new TextDecoder().decode(bytes)) throw new Error("Offline Plugin bundle bytes are not canonical");
  if (bundle.manifest.publisher.id !== input.publisherId ||
      bundle.signature.keyId !== input.publisherKeyId ||
      bundle.manifest.publisher.signatureKeyId !== input.publisherKeyId) {
    throw new Error("Plugin publisher trust root mismatch");
  }
  const { signature, ...unsignedValue } = bundle;
  const unsigned: UnsignedOfflinePluginBundleV1 = unsignedValue;
  if (!verify(null, Buffer.from(signingPayload(unsigned)), input.publisherPublicKey, decodeBase64(signature.value, "Plugin signature"))) {
    throw new Error("Plugin signature is invalid");
  }
  const now = input.now ?? new Date();
  assertSupplyChain(bundle, now);
  const files = bundleFiles(bundle);
  return {
    bundle,
    bundleDigest: sha256(bytes),
    manifestDigest: sha256(canonicalizeJson(bundle.manifest)),
    files
  };
}

export function assertPluginPermissions(manifest: PluginManifestV1, grantedPermissions: readonly string[]): void {
  const granted = new Set(grantedPermissions);
  const denied = manifest.requestedPermissions.filter((permission) => !granted.has(permission));
  if (denied.length > 0) throw new Error(`Plugin permissions were not granted: ${denied.join(", ")}`);
}

export interface PluginHostApiStub {
  readMappedState(key: string): JsonValue;
  proposeEffect(effect: JsonObject): void;
  proposedEffects: readonly JsonObject[];
}

export function createPluginHostApiStub(input: {
  permissions: readonly string[];
  mappedState?: Readonly<Record<string, JsonValue>>;
}): PluginHostApiStub {
  const permissions = new Set(input.permissions);
  const proposedEffects: JsonObject[] = [];
  return {
    readMappedState(key) {
      if (!permissions.has("state_values.read:mapped")) throw new Error("Mapped state permission is required");
      if (!Object.hasOwn(input.mappedState ?? {}, key)) throw new Error(`Mapped state is unavailable: ${key}`);
      return structuredClone(input.mappedState![key]!);
    },
    proposeEffect(effect) {
      if (!permissions.has("effects.propose")) throw new Error("Effect proposal permission is required");
      proposedEffects.push(structuredClone(effect));
    },
    proposedEffects
  };
}

export async function runPluginFixtures(input: {
  inputSchema: unknown;
  outputSchema: unknown;
  fixtures: Array<{ name: string; input: JsonValue; expectedOutput: JsonValue }>;
  execute: (value: JsonValue, host: PluginHostApiStub) => JsonValue | Promise<JsonValue>;
  host: PluginHostApiStub;
}): Promise<void> {
  for (const fixture of input.fixtures) {
    assertJsonSchemaValue(input.inputSchema, fixture.input, `${fixture.name} input`);
    const output = await input.execute(structuredClone(fixture.input), input.host);
    assertJsonSchemaValue(input.outputSchema, output, `${fixture.name} output`);
    if (canonicalizeJson(output) !== canonicalizeJson(fixture.expectedOutput)) throw new Error(`${fixture.name} output did not match the fixture`);
  }
}

export function pluginDigest(bytes: Uint8Array): string {
  return sha256(bytes);
}
