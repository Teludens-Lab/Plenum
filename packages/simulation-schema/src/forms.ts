import type { RuntimeFormDefinitionV1, RuntimeFormFieldDefinitionV1, RuntimeFormValidationIssueV1, RuntimeTeamCellDefinitionV1 } from "./index.js";
import { assertFormExpressions, formExpressionV1Schema } from "./form-expressions.js";
import { FORMATTED_TEXT_CONTRACT_ID, parseFormattedText } from "./formatted-text.js";

/** OPEN-010: decimal MB; structured content is UTF-8 JSON, excluding file bytes. */
export const STRUCTURED_FORM_CONTRACT_ID = "structured-form-v2";
export const FORM_LIMITS = Object.freeze({ fields: 100, sections: 20, entries: 50,
  structuredBytes: 262_144, attachmentBytes: 20_000_000, attachments: 10, totalAttachmentBytes: 100_000_000 });
export const FORM_ATTACHMENT_CONTRACT_ID = "form-attachments-v1";
export const FORM_ATTACHMENT_MEDIA_TYPES = ["text/plain", "text/markdown", "application/pdf", "image/png", "image/jpeg"] as const;
export const formAttachmentMediaTypeLabel = (type: typeof FORM_ATTACHMENT_MEDIA_TYPES[number]): string => ({
  "text/plain": "Plain text (.txt)", "text/markdown": "Markdown (.md)", "application/pdf": "PDF", "image/png": "PNG image", "image/jpeg": "JPEG image"
})[type];
export interface FormAttachmentPolicyV1 { contractId: typeof FORM_ATTACHMENT_CONTRACT_ID; allowedMediaTypes: Array<typeof FORM_ATTACHMENT_MEDIA_TYPES[number]> }
export const formAttachmentPolicyV1Schema = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: FORM_ATTACHMENT_CONTRACT_ID,
  type: "object", additionalProperties: false, required: ["contractId", "allowedMediaTypes"], properties: {
    contractId: { const: FORM_ATTACHMENT_CONTRACT_ID }, allowedMediaTypes: { type: "array", minItems: 1, maxItems: 5, uniqueItems: true, items: { enum: FORM_ATTACHMENT_MEDIA_TYPES } }
  } } as const;
export const BASIC_FIELD_TYPES = ["short_text", "long_text", "number", "yes_no", "date", "time", "date_time",
  "currency", "percentage", "single_select", "multi_select", "artifact_reference", "entity_reference", "formatted_text"] as const;
export const ENTITY_REFERENCE_KINDS = ["artifact", "team", "session_role", "resource", "capability", "state_variable", "stage"] as const;
/** Resolve authored cell sources from the record's Governing Release, without changing published definitions. */
export function resolveTeamCellFieldOptions(field: RuntimeFormFieldDefinitionV1, cells: readonly (Omit<RuntimeTeamCellDefinitionV1, "name"> & { name?: string })[]): RuntimeFormFieldDefinitionV1 {
  const source = field.optionSource;
  return source === undefined ? field : { ...field, options: cells
    .filter((cell) => cell.enabled && cell.teamId === source.teamId && cell.kind === source.cellKind)
    .map((cell) => ({ value: cell.id, label: cell.name ?? cell.id })) };
}
export type EntityReferenceKind = typeof ENTITY_REFERENCE_KINDS[number];
export interface EntityReferenceV2 { kind: EntityReferenceKind; multiple: boolean }
export interface NumericPresentationV2 { unit: string; precision: number }
export const numericField = (type: string): boolean => ["number", "currency", "percentage"].includes(type);
export const multipleField = (field: { type: string; entityReference?: EntityReferenceV2 }): boolean =>
  ["multi_select", "artifact_reference"].includes(field.type) || (field.type === "entity_reference" && field.entityReference?.multiple === true);
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const safeKey = (key: string): boolean => key.split(".").every((part) => /^[a-zA-Z][a-zA-Z0-9_]*$/u.test(part) && !["__proto__", "constructor", "prototype"].includes(part));
const stringListSchema = { type: "array", items: { type: "string" }, uniqueItems: true } as const;
const conditionSchema = { type: "object", additionalProperties: false, required: ["field", "operator"], properties: {
  field: { type: "string" }, operator: { enum: ["equals", "not_equals", "includes", "present"] }, value: { type: ["string", "number", "boolean"] }
} } as const;
const fieldSchema = { type: "object", additionalProperties: false, required: ["id", "key", "label", "type"], properties: {
  computation: formExpressionV1Schema, formattedTextContractId: { const: FORMATTED_TEXT_CONTRACT_ID },
  id: { type: "string" }, key: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)*$" }, label: { type: "string" },
  type: { enum: BASIC_FIELD_TYPES }, required: { type: "boolean" }, readOnly: { type: "boolean" },
  requiredWhen: conditionSchema, visibleWhen: conditionSchema, helpText: { type: "string" }, reportingLabel: { type: "string" },
  defaultValue: { type: ["string", "number", "boolean", "array"], items: { type: ["string", "number", "boolean"] } },
  dataClassification: { enum: ["public", "internal", "confidential", "restricted"] },
  editableBySessionRoleIds: stringListSchema, editableInWorkflowStates: stringListSchema,
  control: { enum: ["cards", "select", "range"] }, options: { type: "array", items: { type: "object", additionalProperties: false,
    required: ["value", "label"], properties: { value: { type: "string" }, label: { type: "string" }, description: { type: "string" } } } },
  numeric: { type: "object", additionalProperties: false, required: ["unit", "precision"], properties: {
    unit: { type: "string", minLength: 1, maxLength: 32 }, precision: { type: "integer", minimum: 0, maximum: 6 } } },
  entityReference: { type: "object", additionalProperties: false, required: ["kind", "multiple"], properties: {
    kind: { enum: ENTITY_REFERENCE_KINDS }, multiple: { type: "boolean" } } },
  optionSource: { type: "object", additionalProperties: false, required: ["kind", "teamId", "cellKind"], properties: {
    kind: { const: "team_cells" }, teamId: { type: "string" }, cellKind: { type: "string" } } },
  reference: { type: "object", additionalProperties: false, required: ["sourceArtifactTypeIds", "requiredOutcome", "relationship", "multiple", "snapshotFields"], properties: {
    sourceArtifactTypeIds: stringListSchema, requiredOutcome: { const: "accepted_terms" }, relationship: { const: "active_team_is_recipient" },
    multiple: { type: "boolean" }, snapshotFields: stringListSchema } },
  validation: { type: "object", additionalProperties: false, properties: {
    min: { type: "number" }, max: { type: "number" }, integer: { type: "boolean" }, uniqueItems: { type: "boolean" },
    minLength: { type: "integer", minimum: 0 }, maxLength: { type: "integer", minimum: 0 },
    minItems: { type: "integer", minimum: 0 }, maxItems: { type: "integer", minimum: 0 } } }
} } as const;

export const structuredFormV2Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: STRUCTURED_FORM_CONTRACT_ID,
  title: "Structured Form v2", type: "object", required: ["contractId", "id", "name", "formVersion", "sections"],
  properties: { contractId: { const: STRUCTURED_FORM_CONTRACT_ID }, id: { type: "string" }, name: { type: "string" },
    attachments: formAttachmentPolicyV1Schema,
    formVersion: { type: "string", minLength: 1 }, sections: { type: "array", maxItems: FORM_LIMITS.sections,
      items: { type: "object", additionalProperties: false, required: ["id", "fields"], properties: { id: { type: "string" }, repeatable: { type: "boolean" },
        title: { type: "string" }, description: { type: "string" }, page: { type: "integer", minimum: 0 }, columns: { enum: [2, 3, 4] },
        collapsed: { type: "boolean" }, itemLabel: { type: "string" }, itemKeyField: { type: "string" },
        table: { type: "object", properties: { columns: stringListSchema, editor: { const: "groups" }, rows: { type: "array", items: {
          type: "object", required: ["label", "fields"], properties: { label: { type: "string" }, fields: stringListSchema } } } } },
        minItems: { type: "integer", minimum: 0, maximum: FORM_LIMITS.entries }, maxItems: { type: "integer", minimum: 0, maximum: FORM_LIMITS.entries },
        fields: { type: "array", maxItems: FORM_LIMITS.fields, items: fieldSchema } } } } }
} as const;

/** Cross-field constraints supplement the machine-readable shape at the authoritative publication boundary. */
export function assertStructuredFormContract(form: RuntimeFormDefinitionV1): void {
  if (form.contractId === undefined) {
    if (form.attachments !== undefined) throw new Error(`Form ${form.id} needs ${STRUCTURED_FORM_CONTRACT_ID} for attachments`);
    if (form.sections.some(({ fields }) => fields.some((field) => field.computation !== undefined || field.formattedTextContractId !== undefined || !["short_text", "long_text", "number", "single_select", "multi_select", "artifact_reference"].includes(field.type)))) {
      throw new Error(`Form ${form.id} needs ${STRUCTURED_FORM_CONTRACT_ID} for its field types`);
    }
    return;
  }
  const fail = (message: string): never => { throw new Error(`Form ${form.id} ${message}`); };
  if (form.contractId !== STRUCTURED_FORM_CONTRACT_ID) fail("unsupported contract version");
  if (!form.formVersion.trim()) fail("a Form version is required");
  if (form.attachments !== undefined && (form.attachments.contractId !== FORM_ATTACHMENT_CONTRACT_ID ||
      Object.keys(form.attachments).some((key) => !["contractId", "allowedMediaTypes"].includes(key)) ||
      !Array.isArray(form.attachments.allowedMediaTypes) || form.attachments.allowedMediaTypes.length === 0 ||
      form.attachments.allowedMediaTypes.some((type) => !FORM_ATTACHMENT_MEDIA_TYPES.includes(type)) ||
      new Set(form.attachments.allowedMediaTypes).size !== form.attachments.allowedMediaTypes.length)) fail("attachments need a supported policy and distinct allowed file types");
  if (form.sections.length > FORM_LIMITS.sections) fail(`at most ${FORM_LIMITS.sections} sections are allowed`);
  const fields = form.sections.flatMap((section) => section.fields);
  assertFormExpressions(form);
  if (fields.length > FORM_LIMITS.fields) fail(`at most ${FORM_LIMITS.fields} field definitions are allowed`);
  for (const section of form.sections) {
    if (["__proto__", "constructor", "prototype"].includes(section.id)) fail("unsafe section key");
    if ("sections" in section || "groups" in section) fail("nested repeating groups are unavailable");
    for (const bound of [section.minItems, section.maxItems]) if (bound !== undefined && (!Number.isInteger(bound) || bound < 0 || bound > FORM_LIMITS.entries)) fail("repeating bounds must be integers from 0 through 50");
    if ((section.minItems ?? 0) > (section.maxItems ?? FORM_LIMITS.entries)) fail("minimum entries exceeds maximum entries");
    for (const field of section.fields) {
      if (!BASIC_FIELD_TYPES.includes(field.type)) fail(`unsupported field type at ${field.key}`);
      if (field.type === "formatted_text" && field.formattedTextContractId !== FORMATTED_TEXT_CONTRACT_ID) fail(`${field.label} needs the safe formatted text contract`);
      if (field.type === "formatted_text" && field.defaultValue !== undefined) {
        try { parseFormattedText(field.defaultValue); } catch (error) { fail(`${field.label}: ${error instanceof Error ? error.message : "Invalid formatted text"}`); }
      }
      if (Object.keys(field).some((key) => !Object.hasOwn(fieldSchema.properties, key))) fail(`${field.label} has an unsupported field setting`);
      if (!safeKey(field.key)) fail(`unsafe field key ${field.key}`);
      if (fields.some((other) => other !== field && (other.key.startsWith(`${field.key}.`) || field.key.startsWith(`${other.key}.`)))) fail(`overlapping field path ${field.key}`);
      if ("fields" in field || "sections" in field) fail("nested fields are unavailable");
      if (form.sections.some((candidate) => candidate.repeatable && (field.key === candidate.id || field.key.startsWith(`${candidate.id}.`)))) fail("field and repeating group paths overlap");
      if (field.type === "currency" || field.type === "percentage") {
        if (!field.numeric || field.validation?.min === undefined || field.validation.max === undefined) fail(`${field.label} needs units, precision and minimum/maximum values`);
        if (field.type === "percentage" && field.numeric?.unit !== "%") fail("percentage values use percentage points and the % unit");
      }
      if (field.numeric && (!numericField(field.type) || !field.numeric.unit.trim() || field.numeric.unit.length > 32 || !Number.isInteger(field.numeric.precision) || field.numeric.precision < 0 || field.numeric.precision > 6)) fail(`${field.label} has invalid numeric presentation`);
      if (field.type === "entity_reference" && (!field.entityReference || !ENTITY_REFERENCE_KINDS.includes(field.entityReference.kind) || typeof field.entityReference.multiple !== "boolean")) fail(`${field.label} needs an entity reference contract`);
      for (const condition of [field.visibleWhen, field.requiredWhen]) if (condition) {
        const sources = section.repeatable ? section.fields : form.sections.filter((item) => !item.repeatable).flatMap((item) => item.fields);
        if (!sources.some((source) => source.key === condition.field && source !== field) || !["equals", "not_equals", "includes", "present"].includes(condition.operator)) fail(`${field.label} has an invalid condition source or operator`);
        if (condition.operator !== "present" && !["string", "number", "boolean"].includes(typeof condition.value)) fail(`${field.label} needs a comparison value`);
      }
      for (const [minimum, maximum] of [[field.validation?.min, field.validation?.max], [field.validation?.minLength, field.validation?.maxLength], [field.validation?.minItems, field.validation?.maxItems]]) {
        if ((minimum !== undefined && !Number.isFinite(minimum)) || (maximum !== undefined && !Number.isFinite(maximum)) || (minimum !== undefined && maximum !== undefined && minimum > maximum)) fail(`${field.label} has invalid validation bounds`);
      }
    }
  }
}

/** Limits apply to drafts too. Legacy submissions keep the limits of their pinned contract. */
export function structuredPayloadIssues(form: RuntimeFormDefinitionV1, payload: Record<string, unknown>): RuntimeFormValidationIssueV1[] {
  if (form.contractId !== STRUCTURED_FORM_CONTRACT_ID) return [];
  const issues: RuntimeFormValidationIssueV1[] = [];
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > FORM_LIMITS.structuredBytes) return [{ field: "", message: `Structured content exceeds ${FORM_LIMITS.structuredBytes} UTF-8 JSON bytes` }];
  const checkKeys = (value: Record<string, unknown>, keys: string[], prefix: string) => {
    for (const [key, child] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) { issues.push({ field: prefix + key, message: "Unsafe field key" }); continue; }
      if (keys.includes(key)) continue;
      const descendants = keys.filter((candidate) => candidate.startsWith(`${key}.`)).map((candidate) => candidate.slice(key.length + 1));
      if (descendants.length > 0 && record(child)) checkKeys(child, descendants, `${prefix}${key}.`);
      else issues.push({ field: prefix + key, message: "Content includes an undefined field" });
    }
  };
  checkKeys(payload, form.sections.flatMap((section) => section.repeatable ? [section.id] : section.fields.map(({ key }) => key)), "");
  for (const section of form.sections.filter((section) => section.repeatable)) {
    const entries = payload[section.id];
    if (entries === undefined) continue;
    if (!Array.isArray(entries)) { issues.push({ field: section.id, message: "Repeating content must be a list" }); continue; }
    if (entries.length > Math.min(section.maxItems ?? FORM_LIMITS.entries, FORM_LIMITS.entries)) issues.push({ field: section.id, message: "Repeating content exceeds the entry limit" });
    entries.forEach((entry, index) => { if (record(entry)) checkKeys(entry, section.fields.map(({ key }) => key), `${section.id}.${index}.`); });
  }
  return issues;
}

export function basicFieldValueIssue(field: RuntimeFormFieldDefinitionV1, value: unknown): string | undefined {
  if (field.type === "formatted_text") {
    try { parseFormattedText(value); } catch (error) { return `${field.label}: ${error instanceof Error ? error.message : "Invalid formatted text"}`; }
  }
  if (field.type === "yes_no" && typeof value !== "boolean") return `${field.label} must be yes or no`;
  if (numericField(field.type)) {
    if (typeof value !== "number" || !Number.isFinite(value)) return `${field.label} must be a finite number`;
    if (field.numeric && Math.abs(value * 10 ** field.numeric.precision - Math.round(value * 10 ** field.numeric.precision)) > 1e-7) return `${field.label} exceeds its declared precision`;
  }
  if (field.type === "date") {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) return `${field.label} must be a calendar date (YYYY-MM-DD)`;
  }
  if (field.type === "time" && (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/u.test(value))) return `${field.label} must be a time (HH:MM:SS)`;
  if (field.type === "date_time" && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value)) return `${field.label} must be a UTC date/time`;
  if (field.type === "entity_reference") {
    const selected = field.entityReference?.multiple ? value : [value];
    if (!Array.isArray(selected) || selected.some((item) => typeof item !== "string" || item.length === 0) || new Set(selected).size !== selected.length) return `${field.label} has invalid references`;
    if (field.options && selected.some((item) => !field.options!.some((option) => option.value === item))) return `${field.label} includes an unavailable reference`;
  }
  if (field.type === "artifact_reference" && Array.isArray(value) && (value.some((item) => typeof item !== "string" || (field.options !== undefined && !field.options.some((option) => option.value === item))) || new Set(value).size !== value.length)) return `${field.label} includes an unavailable reference`;
  return undefined;
}

export function fieldEditable(field: RuntimeFormFieldDefinitionV1, sessionRoleId: string, state: string): boolean {
  return field.computation === undefined && field.readOnly !== true && (!field.editableBySessionRoleIds?.length || field.editableBySessionRoleIds.includes(sessionRoleId)) &&
    (!field.editableInWorkflowStates?.length || field.editableInWorkflowStates.includes(state));
}
