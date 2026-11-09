import { assertStructuredFormContract, FORM_ATTACHMENT_MEDIA_TYPES, FORM_LIMITS, structuredFormV2Schema } from "./forms.js";
import { numericField } from "./forms.js";
import { runtimeFormValue, setRuntimeFormValue, validateRuntimeFormPayload, type RuntimeFormDefinitionV1 } from "./index.js";
import { recomputeFormValues } from "./form-expressions.js";

export const FORM_INTERCHANGE_CONTRACT_ID = "form-interchange-v1";
export interface FormDefinitionExportV1 { contractId: typeof FORM_INTERCHANGE_CONTRACT_ID; kind: "form"; form: RuntimeFormDefinitionV1 }
export interface FormRecordExportV1 {
  contractId: typeof FORM_INTERCHANGE_CONTRACT_ID; kind: "record"; artifactId: string; governingReleaseId: string;
  formId: string; formVersion: string; payload: Record<string, unknown>;
  attachmentManifest?: { bytesIncluded: false; files: Array<{ id: string; fileName: string; mediaType: string; sizeBytes: number; sha256: string;
    scanStatus: "clean" | "infected" | "failed"; retentionPolicyId: string; expiresAt: string }> };
}
const attachmentManifestSchema = { type: "object", additionalProperties: false, required: ["bytesIncluded", "files"], properties: {
  bytesIncluded: { const: false }, files: { type: "array", maxItems: FORM_LIMITS.attachments, items: { type: "object", additionalProperties: false,
    required: ["id", "fileName", "mediaType", "sizeBytes", "sha256", "scanStatus", "retentionPolicyId", "expiresAt"], properties: {
      id: { type: "string", format: "uuid" }, fileName: { type: "string", minLength: 1, maxLength: 255 }, mediaType: { enum: FORM_ATTACHMENT_MEDIA_TYPES }, sizeBytes: { type: "integer", minimum: 1, maximum: FORM_LIMITS.attachmentBytes },
      sha256: { type: "string", pattern: "^[0-9a-f]{64}$" }, scanStatus: { enum: ["clean", "infected", "failed"] }, retentionPolicyId: { type: "string", format: "uuid" }, expiresAt: { type: "string", format: "date-time" }
    } } }
} } as const;
export const formInterchangeV1Schema = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: FORM_INTERCHANGE_CONTRACT_ID,
  title: "Form definition and record interchange v1", oneOf: [
    { type: "object", additionalProperties: false, required: ["contractId", "kind", "form"], properties: {
      contractId: { const: FORM_INTERCHANGE_CONTRACT_ID }, kind: { const: "form" }, form: { anyOf: [structuredFormV2Schema,
        { type: "object", required: ["id", "name", "formVersion", "sections"], not: { required: ["contractId"] } }] } } },
    { type: "object", additionalProperties: false, required: ["contractId", "kind", "artifactId", "governingReleaseId", "formId", "formVersion", "payload"], properties: {
      contractId: { const: FORM_INTERCHANGE_CONTRACT_ID }, kind: { const: "record" }, artifactId: { type: "string" }, governingReleaseId: { type: "string" },
      formId: { type: "string" }, formVersion: { type: "string" }, payload: { type: "object" }, attachmentManifest: attachmentManifestSchema } }
  ] } as const;
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
function parsed(text: string): Record<string, unknown> {
  if (new TextEncoder().encode(text).byteLength > 2_000_000) throw new Error("Form interchange files must not exceed 2 MB");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("The file is not valid JSON"); }
  if (!record(value) || value.contractId !== FORM_INTERCHANGE_CONTRACT_ID) throw new Error("The file needs a supported Form interchange version");
  const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  while (pending.length) {
    const current = pending.pop()!;
    if (current.depth > 32) throw new Error("Interchange content is nested too deeply");
    if (current.value && typeof current.value === "object") for (const [key, child] of Object.entries(current.value)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Interchange content includes an unsafe key");
      pending.push({ value: child, depth: current.depth + 1 });
    }
  }
  return value;
}
export function importFormDefinition(text: string): RuntimeFormDefinitionV1 {
  const value = parsed(text);
  if (value.kind !== "form" || Object.keys(value).some((key) => !["contractId", "kind", "form"].includes(key)) || !record(value.form)) throw new Error("Choose a Form definition export");
  const form = value.form;
  if (typeof form.id !== "string" || typeof form.name !== "string" || typeof form.formVersion !== "string" || !Array.isArray(form.sections) ||
      form.sections.some((section) => !record(section) || typeof section.id !== "string" || !Array.isArray(section.fields) || section.fields.some((field) => !record(field) ||
        typeof field.id !== "string" || typeof field.key !== "string" || typeof field.label !== "string" || typeof field.type !== "string"))) throw new Error("The Form definition is incomplete");
  assertStructuredFormContract(form as unknown as RuntimeFormDefinitionV1);
  if ((form as unknown as RuntimeFormDefinitionV1).sections.some((section) => ["__proto__", "constructor", "prototype"].includes(section.id))) throw new Error("The Form includes an unsafe section key");
  for (const section of (form as unknown as RuntimeFormDefinitionV1).sections) for (const field of section.fields) {
    if (field.key.split(".").some((part) => ["__proto__", "constructor", "prototype"].includes(part))) throw new Error("The Form includes an unsafe field path");
  }
  return form as unknown as RuntimeFormDefinitionV1;
}
export function importFormRecord(text: string, form: RuntimeFormDefinitionV1, governingReleaseId: string): Record<string, unknown> {
  const value = parsed(text);
  if (value.kind !== "record" || typeof value.artifactId !== "string" || !value.artifactId || Object.keys(value).some((key) => !["contractId", "kind", "artifactId", "governingReleaseId", "formId", "formVersion", "payload", "attachmentManifest"].includes(key)) || !record(value.payload)) throw new Error("Choose a structured record export");
  if (value.attachmentManifest !== undefined) {
    const manifest = value.attachmentManifest;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
    if (!record(manifest) || manifest.bytesIncluded !== false || !Array.isArray(manifest.files) || manifest.files.length > FORM_LIMITS.attachments ||
        Object.keys(manifest).some((key) => !["bytesIncluded", "files"].includes(key)) || manifest.files.some((file) => !record(file) ||
          ["id", "fileName", "mediaType", "sha256", "retentionPolicyId", "expiresAt"].some((key) => typeof file[key] !== "string") ||
          !uuid.test(String(file.id)) || !uuid.test(String(file.retentionPolicyId)) || !FORM_ATTACHMENT_MEDIA_TYPES.some((type) => type === file.mediaType) ||
          typeof file.fileName !== "string" || !file.fileName.trim() || file.fileName.length > 255 || /[\x00-\x1f\x7f/\\]/u.test(file.fileName) || typeof file.sizeBytes !== "number" || !Number.isInteger(file.sizeBytes) || file.sizeBytes < 1 || file.sizeBytes > FORM_LIMITS.attachmentBytes ||
          !/^[0-9a-f]{64}$/u.test(String(file.sha256)) || !["clean", "infected", "failed"].includes(String(file.scanStatus)) || !Number.isFinite(Date.parse(String(file.expiresAt))) ||
          Object.keys(file).some((key) => !["id", "fileName", "mediaType", "sizeBytes", "sha256", "scanStatus", "retentionPolicyId", "expiresAt"].includes(key)))) throw new Error("The attachment manifest is invalid");
    const files = manifest.files as NonNullable<FormRecordExportV1["attachmentManifest"]>["files"];
    if (new Set(files.map((file) => file.id)).size !== files.length || files.reduce((total, file) => total + file.sizeBytes, 0) > FORM_LIMITS.totalAttachmentBytes) throw new Error("The attachment manifest exceeds record limits or repeats a file");
  }
  if (value.formId !== form.id || value.formVersion !== form.formVersion || value.governingReleaseId !== governingReleaseId) throw new Error("This record belongs to another Form version or Release");
  const issues = validateRuntimeFormPayload(form, value.payload, { draft: true });
  if (issues.length) throw new Error(issues.map(({ message }) => message).join("; "));
  return value.payload;
}

/** RFC 4180-style CSV, bounded before mapping. Embedded commas, newlines and doubled quotes survive. */
export function parseFormCsv(text: string): { headers: string[]; rows: string[][] } {
  if (new TextEncoder().encode(text).byteLength > FORM_LIMITS.structuredBytes) throw new Error("CSV exceeds the structured-content byte limit");
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false, closed = false;
  const pushCell = () => { row.push(cell); cell = ""; closed = false; if (row.length > 100) throw new Error("CSV supports at most 100 columns"); };
  const pushRow = () => { pushCell(); rows.push(row); row = []; if (rows.length > 101) throw new Error("CSV preview supports at most 100 data rows"); };
  const source = text.replace(/^\uFEFF/u, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; } else cell += char;
    } else if (char === '"') {
      if (cell || closed) throw new Error("CSV has an unexpected quote"); quoted = true;
    } else if (char === ",") pushCell();
    else if (char === "\n" || char === "\r") { if (char === "\r" && source[i + 1] === "\n") i++; pushRow(); }
    else { if (closed) throw new Error("CSV has text after a closing quote"); cell += char; }
  }
  if (quoted) throw new Error("CSV has an unfinished quoted cell");
  if (cell || row.length || closed) pushRow();
  const headers = rows.shift() ?? [];
  if (!headers.length || headers.some((header) => !header.trim()) || new Set(headers).size !== headers.length) throw new Error("CSV needs unique, non-empty column headers");
  if (rows.some((item) => item.length !== headers.length)) throw new Error("CSV rows must have the same number of columns as the header");
  return { headers, rows };
}
export function previewFormCsv(form: RuntimeFormDefinitionV1, csv: ReturnType<typeof parseFormCsv>, mapping: Readonly<Record<string, string>>) {
  const fields = form.sections.filter((section) => !section.repeatable).flatMap((section) => section.fields).filter((field) => !field.computation);
  const selected = Object.entries(mapping).filter(([, key]) => key !== "");
  if (!selected.length || new Set(selected.map(([, key]) => key)).size !== selected.length || selected.some(([header, key]) => !csv.headers.includes(header) || !fields.some((field) => field.key === key))) throw new Error("Map at least one CSV column; each mapping must select a distinct declared root field");
  return csv.rows.map((row, index) => {
    const payload: Record<string, unknown> = {};
    for (const [header, key] of selected) {
      const field = fields.find((field) => field.key === key)!; const text = row[csv.headers.indexOf(header)] ?? "";
      let value: unknown = text;
      if (numericField(field.type)) value = !text.trim() ? "" : /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/iu.test(text.trim()) ? Number(text) : text;
      else if (field.type === "yes_no" && /^(?:true|false|yes|no)$/iu.test(text)) value = /^(?:true|yes)$/iu.test(text);
      else if (["multi_select", "artifact_reference"].includes(field.type) || field.entityReference?.multiple) {
        try { value = JSON.parse(text); } catch { value = text; }
      }
      setRuntimeFormValue(payload, key, value);
    }
    const computed = recomputeFormValues(form, payload);
    return { rowNumber: index + 2, payload: computed.payload, issues: [...computed.issues, ...validateRuntimeFormPayload(form, computed.payload, { draft: true })] };
  });
}

/** Analytical CSV neutralizes spreadsheet formulas. JSON remains the exact interchange representation. */
const cell = (value: unknown): string => {
  const text = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
  return `"${((/^\s*[=+@-]/u.test(text) || /^[\u0000-\u001f]/u.test(text)) && typeof value !== "number" ? "'" : "") + text.replaceAll('"', '""')}"`;
};
export function formRecordTables(form: RuntimeFormDefinitionV1, records: FormRecordExportV1[]): Array<{ name: string; csv: string }> {
  if (records.length > 100) throw new Error("Export at most 100 records at once");
  const rootFields = form.sections.filter((section) => !section.repeatable).flatMap((section) => section.fields);
  const encode = (rows: unknown[][]) => rows.map((row) => row.map(cell).join(",")).join("\r\n");
  const tables = [{ name: "records.csv", csv: encode([["recordId", "governingReleaseId", "formId", "formVersion", ...rootFields.map(({ key }) => key)],
    ...records.map((record) => [record.artifactId, record.governingReleaseId, record.formId, record.formVersion, ...rootFields.map(({ key }) => runtimeFormValue(record.payload, key))])]) }];
  form.sections.filter((section) => section.repeatable).forEach((section, index) => {
    tables.push({ name: `group-${index + 1}.csv`, csv: encode([["recordId", "sectionId", "entryIndex", ...section.fields.map(({ key }) => key)],
      ...records.flatMap((record) => (Array.isArray(record.payload[section.id]) ? record.payload[section.id] as unknown[] : []).map((entry, position) =>
        [record.artifactId, section.id, position + 1, ...section.fields.map(({ key }) => typeof entry === "object" && entry !== null ? runtimeFormValue(entry as Record<string, unknown>, key) : "")]))]) });
  });
  return tables;
}
