import { runtimeFormValue, setRuntimeFormValue, type RuntimeFormDefinitionV1, type RuntimeFormFieldDefinitionV1, type RuntimeFormValidationIssueV1 } from "./index.js";

export const FORM_EXPRESSION_CONTRACT_ID = "form-expression-v1";
export const EXPRESSION_OPERATORS = ["add", "subtract", "multiply", "divide", "equals", "greater_than", "less_than", "if"] as const;
export type FormExpressionV1 = { kind: "literal"; value: string | number | boolean } | { kind: "field"; key: string }
  | { kind: "count"; sectionId: string } | { kind: "total"; sectionId: string; field: string }
  | { kind: "operation"; operator: typeof EXPRESSION_OPERATORS[number]; arguments: FormExpressionV1[] };
export interface FormComputationV1 { contractId: typeof FORM_EXPRESSION_CONTRACT_ID; version: string; expression: FormExpressionV1 }
type Section = RuntimeFormDefinitionV1["sections"][number];
type ValueType = "number" | "boolean" | "string" | "list";
const valueType = (field: RuntimeFormFieldDefinitionV1): ValueType => ["number", "currency", "percentage"].includes(field.type) ? "number"
  : field.type === "yes_no" ? "boolean" : ["multi_select", "artifact_reference"].includes(field.type) || field.entityReference?.multiple ? "list" : "string";
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const boundedNumber = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) throw new Error("Calculation needs a finite number within the safe numeric range");
  return value;
};
const nodeSchema = { oneOf: [
  { type: "object", additionalProperties: false, required: ["kind", "value"], properties: { kind: { const: "literal" }, value: { type: ["string", "number", "boolean"] } } },
  { type: "object", additionalProperties: false, required: ["kind", "key"], properties: { kind: { const: "field" }, key: { type: "string" } } },
  { type: "object", additionalProperties: false, required: ["kind", "sectionId"], properties: { kind: { const: "count" }, sectionId: { type: "string" } } },
  { type: "object", additionalProperties: false, required: ["kind", "sectionId", "field"], properties: { kind: { const: "total" }, sectionId: { type: "string" }, field: { type: "string" } } },
  { type: "object", additionalProperties: false, required: ["kind", "operator", "arguments"], properties: { kind: { const: "operation" }, operator: { enum: EXPRESSION_OPERATORS }, arguments: { type: "array", minItems: 2, maxItems: 3, items: { $ref: "#/$defs/expression" } } } }
] } as const;
export const formExpressionV1Schema = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: FORM_EXPRESSION_CONTRACT_ID,
  title: "Restricted Form expression v1", type: "object", additionalProperties: false, required: ["contractId", "version", "expression"],
  properties: { contractId: { const: FORM_EXPRESSION_CONTRACT_ID }, version: { type: "string", minLength: 1, maxLength: 64 }, expression: { $ref: "#/$defs/expression" } },
  $defs: { expression: nodeSchema } } as const;

/** Bounded declarative trees only. References cannot read state, time, network, or another record. */
export function assertFormExpressions(form: RuntimeFormDefinitionV1, excludedFields: readonly string[] = []): void {
  const owners = new Map(form.sections.flatMap((section) => section.fields.map((field) => [field.key, { section, field }] as const)));
  const dependencies = new Map<string, Set<string>>();
  const fail = (field: RuntimeFormFieldDefinitionV1, message: string): never => { throw new Error(`Form ${form.id} ${field.label}: ${message}`); };
  for (const section of form.sections) for (const field of section.fields) {
    if (!field.computation) continue;
    const calculation = field.computation;
    if (calculation.contractId !== FORM_EXPRESSION_CONTRACT_ID || typeof calculation.version !== "string" || !calculation.version.trim() || calculation.version.length > 64 ||
        Object.keys(calculation).some((key) => !["contractId", "version", "expression"].includes(key))) fail(field, "unsupported calculation contract or version");
    const inputs = new Set<string>(); dependencies.set(field.key, inputs);
    let nodes = 0;
    const reference = (key: string, sourceSection: Section) => {
      const source = owners.get(key);
      if (!source || (sourceSection.repeatable ? source.section !== sourceSection : source.section.repeatable)) return fail(field, "calculation references a missing or out-of-scope input");
      if (excludedFields.some((excluded) => key === excluded || key.startsWith(`${excluded}.`) || source.section.id === excluded)) return fail(field, "calculation cannot use an input excluded by an Information Policy");
      inputs.add(key); return source.field;
    };
    const inspect = (node: FormExpressionV1, depth: number): ValueType => {
      if (++nodes > 100 || depth > 8 || !record(node)) return fail(field, "calculation exceeds 100 nodes or 8 levels");
      const keys = node.kind === "literal" ? ["kind", "value"] : node.kind === "field" ? ["kind", "key"] : node.kind === "count" ? ["kind", "sectionId"]
        : node.kind === "total" ? ["kind", "sectionId", "field"] : ["kind", "operator", "arguments"];
      if (Object.keys(node).some((key) => !keys.includes(key))) return fail(field, "unsupported calculation setting");
      if (node.kind === "literal") {
        if (!["number", "string", "boolean"].includes(typeof node.value) || (typeof node.value === "string" && node.value.length > 4096)) return fail(field, "invalid literal");
        if (typeof node.value === "number") boundedNumber(node.value);
        return typeof node.value as ValueType;
      }
      if (node.kind === "field") return valueType(reference(node.key, section));
      if (node.kind === "count" || node.kind === "total") {
        const group = form.sections.find(({ id, repeatable }) => id === node.sectionId && repeatable);
        if (!group || section.repeatable) return fail(field, "counts and totals require a root field and a repeating group");
        if (excludedFields.includes(group.id)) return fail(field, "calculation cannot count an excluded group");
        if (node.kind === "total" && valueType(reference(node.field, group)) !== "number") return fail(field, "totals require a numeric input");
        return "number";
      }
      if (node.kind !== "operation" || !EXPRESSION_OPERATORS.includes(node.operator) || !Array.isArray(node.arguments) || node.arguments.length !== (node.operator === "if" ? 3 : 2)) return fail(field, "unsupported operation or argument count");
      const types = node.arguments.map((item) => inspect(item, depth + 1));
      if (node.operator === "if") {
        if (types[0] !== "boolean" || types[1] !== types[2] || types[1] === "list") return fail(field, "conditional values need a boolean condition and matching scalar results");
        return types[1]!;
      }
      if (node.operator === "equals") {
        if (types[0] !== types[1] || types[0] === "list") return fail(field, "comparisons need matching scalar inputs");
        return "boolean";
      }
      if (types.some((type) => type !== "number")) return fail(field, "arithmetic and ordered comparisons require numbers");
      return ["greater_than", "less_than"].includes(node.operator) ? "boolean" : "number";
    };
    if (inspect(calculation.expression, 1) !== valueType(field)) fail(field, "calculation result does not match its field type");
    if (valueType(field) === "list" || field.type === "entity_reference" || field.type === "artifact_reference") fail(field, "computed references and lists are unavailable");
  }
  const visiting = new Set<string>(); const visited = new Set<string>();
  const visit = (key: string): void => {
    if (visiting.has(key)) fail(owners.get(key)!.field, "calculation cycle; choose independent inputs");
    if (visited.has(key)) return;
    visiting.add(key); dependencies.get(key)?.forEach(visit); visiting.delete(key); visited.add(key);
  };
  dependencies.forEach((_inputs, key) => visit(key));
}

/** Replaces client-supplied computed values. Missing inputs/errors never become zero or a successful value. */
export function recomputeFormValues(form: RuntimeFormDefinitionV1, input: Record<string, unknown>): { payload: Record<string, unknown>; issues: RuntimeFormValidationIssueV1[] } {
  const payload = structuredClone(input); const issues: RuntimeFormValidationIssueV1[] = [];
  const owners = new Map(form.sections.flatMap((section) => section.fields.map((field) => [field.key, { section, field }] as const)));
  const completed = new Set<string>(); const active = new Set<string>();
  const evaluateField = (field: RuntimeFormFieldDefinitionV1, section: Section, entry: Record<string, unknown>, index?: number): unknown => {
    const path = section.repeatable ? `${section.id}.${index}.${field.key}` : field.key;
    if (!field.computation) {
      const value = runtimeFormValue(entry, field.key);
      if (value === undefined || value === null || value === "") throw new Error(`Missing input: ${field.label}`);
      return value;
    }
    if (completed.has(path)) return runtimeFormValue(entry, field.key);
    if (active.has(path)) throw new Error("Calculation cycle");
    active.add(path);
    let nodes = 0;
    const evaluate = (node: FormExpressionV1, depth = 1): unknown => {
      if (++nodes > 100 || depth > 8) throw new Error("Calculation limit exceeded");
      if (node.kind === "literal") return node.value;
      if (node.kind === "field") {
        const owner = owners.get(node.key);
        if (!owner || (section.repeatable ? owner.section !== section : owner.section.repeatable)) throw new Error("Unavailable calculation input");
        return evaluateField(owner.field, owner.section, entry, index);
      }
      if (node.kind === "count" || node.kind === "total") {
        const group = form.sections.find(({ id, repeatable }) => id === node.sectionId && repeatable);
        const entries = payload[node.sectionId];
        if (!group || section.repeatable || !Array.isArray(entries) || entries.length > 50 || entries.some((item) => !record(item))) throw new Error("Missing or invalid repeating input");
        if (node.kind === "count") return entries.length;
        const source = group.fields.find(({ key }) => key === node.field);
        if (!source) throw new Error("Unavailable total input");
        return entries.reduce((total: number, item, itemIndex) => boundedNumber(total + boundedNumber(evaluateField(source, group, item as Record<string, unknown>, itemIndex))), 0);
      }
      if (node.kind !== "operation") throw new Error("Unsupported calculation");
      const first = evaluate(node.arguments[0]!, depth + 1);
      if (node.operator === "if") {
        if (typeof first !== "boolean") throw new Error("Calculation condition must be yes or no");
        return evaluate(node.arguments[first ? 1 : 2]!, depth + 1);
      }
      const second = evaluate(node.arguments[1]!, depth + 1);
      if (node.operator === "equals") return first === second;
      const left = boundedNumber(first), right = boundedNumber(second);
      if (node.operator === "greater_than") return left > right;
      if (node.operator === "less_than") return left < right;
      if (node.operator === "divide" && right === 0) throw new Error("Division by zero");
      if (!["add", "subtract", "multiply", "divide"].includes(node.operator)) throw new Error("Unsupported calculation operation");
      return boundedNumber(node.operator === "add" ? left + right : node.operator === "subtract" ? left - right : node.operator === "multiply" ? left * right : left / right);
    };
    try {
      let value = evaluate(field.computation.expression);
      if (typeof value === "number") { boundedNumber(value); if (field.numeric) value = Number(value.toFixed(field.numeric.precision)); }
      setRuntimeFormValue(entry, field.key, value); completed.add(path); return value;
    } finally { active.delete(path); }
  };
  for (const section of form.sections) {
    const entries = section.repeatable ? Array.isArray(payload[section.id]) ? payload[section.id] as unknown[] : [] : [payload];
    entries.forEach((entry, index) => { if (record(entry)) for (const field of section.fields) if (field.computation) {
      try { evaluateField(field, section, entry, index); }
      catch (error) {
        setRuntimeFormValue(entry, field.key, null);
        issues.push({ field: section.repeatable ? `${section.id}.${index}.${field.key}` : field.key,
          message: `${field.label}: ${error instanceof Error ? error.message : "Calculation failed"}` });
      }
    } });
  }
  return { payload, issues };
}
