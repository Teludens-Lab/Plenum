import type { JsonObject, JsonValue } from "@plenum/event-contracts";
import type { RuntimeFormDefinitionV1 } from "@plenum/simulation-schema";

/** Matching grants are additive. Excluding a parent excludes its descendants. */
export function artifactFieldAccess(grants: Array<{ fieldsExcluded?: string[] }>): (path: string) => boolean {
  return (path) => grants.some((grant) => !(grant.fieldsExcluded ?? []).some((excluded) => path === excluded || path.startsWith(`${excluded}.`)));
}

export function visibleArtifactPayload(payload: JsonObject, allows: (path: string) => boolean): JsonObject {
  const walk = (value: JsonValue, path: string): JsonValue => Array.isArray(value) ? value.map((entry) => walk(entry, path))
    : value !== null && typeof value === "object" ? Object.fromEntries(Object.entries(value).flatMap(([key, child]) => {
      const childPath = path ? `${path}.${key}` : key;
      return allows(childPath) ? [[key, walk(child, childPath)]] : [];
    })) : value;
  return walk(payload, "") as JsonObject;
}

export function visibleArtifactForm(form: RuntimeFormDefinitionV1, allows: (path: string) => boolean): RuntimeFormDefinitionV1 & { fields: RuntimeFormDefinitionV1["sections"][number]["fields"] } {
  const sections = form.sections.flatMap((section) => {
    if (section.repeatable && !allows(section.id)) return [];
    const path = (key: string) => section.repeatable ? `${section.id}.${key}` : key;
    const fields = section.fields.filter((field) => allows(path(field.key)) &&
      [field.visibleWhen, field.requiredWhen].every((condition) => !condition || allows(path(condition.field))));
    if (fields.length === section.fields.length) return [section];
    const { table: _table, itemKeyField, ...safeSection } = section;
    return fields.length ? [{ ...safeSection, fields, ...(itemKeyField && allows(path(itemKeyField)) ? { itemKeyField } : {}) }] : [];
  });
  if (sections.every((section, index) => section === form.sections[index]) && sections.length === form.sections.length) return { ...form, fields: sections.flatMap((section) => section.fields) };
  // Layout/rule expressions may name hidden fields; the authorized sections are sufficient to render safely.
  const { rules: _rules, layout: _layout, ...safeForm } = form;
  return { ...safeForm, sections, fields: sections.flatMap((section) => section.fields) };
}

/** Omitted protected values survive edits. Supplying a protected key is always denied, regardless of its value. */
export function preserveProtectedArtifactValues(previous: JsonObject, incoming: JsonObject, allows: (path: string) => boolean): JsonObject {
  const hasProtected = (value: JsonValue, prefix: string): boolean => Array.isArray(value) ? value.some((item) => hasProtected(item, prefix))
    : value !== null && typeof value === "object" && Object.entries(value).some(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return !allows(path) || hasProtected(child, path);
    });
  const walk = (old: JsonValue | undefined, next: JsonValue, path: string): JsonValue => {
    if (Array.isArray(next)) {
      const before = Array.isArray(old) ? old : [];
      if (before.length !== next.length && hasProtected(before, path)) throw new Error("Repeating entries with protected fields cannot be added or removed in this role context.");
      return next.map((item, index) => walk(before[index], item, path));
    }
    if (next !== null && typeof next === "object") {
      const before = old !== null && typeof old === "object" && !Array.isArray(old) ? old : {};
      const result: JsonObject = {};
      for (const [key, value] of Object.entries(next)) {
        const childPath = path ? `${path}.${key}` : key;
        if (!allows(childPath)) throw new Error("A supplied field is unavailable in this role context.");
        result[key] = walk(before[key], value, childPath);
      }
      for (const [key, value] of Object.entries(before)) {
        const childPath = path ? `${path}.${key}` : key;
        if (!allows(childPath)) result[key] = structuredClone(value);
        else if (!(key in result) && value !== null && typeof value === "object" && hasProtected(value, childPath)) {
          const protectedOnly = walk(value, Array.isArray(value) ? value.map(() => ({})) : {}, childPath);
          if (JSON.stringify(protectedOnly) !== "{}" && JSON.stringify(protectedOnly) !== "[]") result[key] = protectedOnly;
        }
      }
      return result;
    }
    if (old !== null && typeof old === "object") {
      if (hasProtected(old, path)) throw new Error("A value containing protected fields cannot be replaced in this role context.");
    }
    return next;
  };
  return walk(previous, incoming, "") as JsonObject;
}
