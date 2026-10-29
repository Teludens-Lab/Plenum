import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const SECRET_KEYS = Object.freeze([
  "DATABASE_URL",
  "FLOOR_TOKEN_SECRET",
  "MEDIA_API_KEY",
  "MEDIA_API_SECRET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY"
]);

export function parseSecretBundle(raw) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("The Plenum secret bundle must be valid JSON.");
  }
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("The Plenum secret bundle must be a JSON object.");
  }
  const unknown = Object.keys(value).filter((key) => !SECRET_KEYS.includes(key));
  if (unknown.length > 0) throw new Error(`Unknown Plenum secret keys: ${unknown.sort().join(", ")}`);
  const missing = SECRET_KEYS.filter((key) => typeof value[key] !== "string" || value[key].trim() === "");
  if (missing.length > 0) throw new Error(`Missing Plenum secret keys: ${missing.join(", ")}`);
  return Object.fromEntries(SECRET_KEYS.map((key) => [key, value[key]]));
}

export async function readSecretBundle(environment = process.env) {
  const file = environment.PLENUM_SECRET_BUNDLE_FILE?.trim();
  const secretId = environment.PLENUM_SECRET_BUNDLE_OCID?.trim();
  if (file && secretId) throw new Error("Configure one Plenum secret-bundle source, not both.");
  if (file) return parseSecretBundle(await readFile(file, "utf8"));
  if (!secretId) return undefined;

  const [commonImport, secretsImport] = await Promise.all([import("oci-common"), import("oci-secrets")]);
  const common = commonImport.default ?? commonImport;
  const secrets = secretsImport.default ?? secretsImport;
  const authenticationDetailsProvider = common.ResourcePrincipalAuthenticationDetailsProvider.builder();
  const client = new secrets.SecretsClient({ authenticationDetailsProvider });
  try {
    const response = await client.getSecretBundle({ secretId, stage: "CURRENT" });
    const content = response.secretBundle?.secretBundleContent?.content;
    if (typeof content !== "string" || content === "") throw new Error("OCI Vault returned an empty secret bundle.");
    return parseSecretBundle(Buffer.from(content, "base64").toString("utf8"));
  } finally {
    client.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bundle = await readSecretBundle();
  if (bundle) Object.assign(process.env, bundle);
  await import("./profile-service.mjs");
}
