import { useId } from "react";
import { EXPRESSION_OPERATORS, type FormExpressionV1, type RuntimeFormFieldDefinitionV1, type RuntimeFormDefinitionV1 } from "@plenum/simulation-schema";

export function FormExpressionEditor({ expression, fields, groups, onChange, depth = 1, label = "Calculation" }: {
  expression: FormExpressionV1; fields: RuntimeFormFieldDefinitionV1[]; groups: RuntimeFormDefinitionV1["sections"];
  onChange(value: FormExpressionV1): void; depth?: number; label?: string;
}) {
  const id = useId();
  const selected = expression.kind === "literal" ? `literal_${typeof expression.value}` : expression.kind === "operation" ? expression.operator : expression.kind;
  const choose = (kind: string) => {
    if (kind === "literal_number") onChange({ kind: "literal", value: 0 });
    else if (kind === "literal_string") onChange({ kind: "literal", value: "" });
    else if (kind === "literal_boolean") onChange({ kind: "literal", value: false });
    else if (kind === "field") onChange({ kind: "field", key: fields[0]?.key ?? "" });
    else if (kind === "count") onChange({ kind: "count", sectionId: groups[0]?.id ?? "" });
    else if (kind === "total") onChange({ kind: "total", sectionId: groups[0]?.id ?? "", field: groups[0]?.fields[0]?.key ?? "" });
    else onChange({ kind: "operation", operator: kind as typeof EXPRESSION_OPERATORS[number], arguments: kind === "if"
      ? [{ kind: "literal", value: false }, { kind: "literal", value: 0 }, { kind: "literal", value: 0 }]
      : [{ kind: "literal", value: 0 }, { kind: "literal", value: 0 }] });
  };
  return <fieldset className="nested-editor"><legend>{label}</legend>
    <label htmlFor={`${id}-kind`}>Value or operation</label><select id={`${id}-kind`} value={selected} onChange={(event) => choose(event.target.value)}>
      <option value="literal_number">Number</option><option value="literal_string">Text</option><option value="literal_boolean">Yes or no</option>
      <option value="field" disabled={fields.length === 0}>Field value</option>
      <option value="count" disabled={groups.length === 0}>Count entries</option><option value="total" disabled={groups.length === 0}>Total a repeating field</option>
      {EXPRESSION_OPERATORS.map((operator) => <option key={operator} value={operator} disabled={depth >= 8}>{operator === "if" ? "Conditional value" : operator.replaceAll("_", " ")}</option>)}
    </select>
    {expression.kind === "literal" ? <>
      <label htmlFor={`${id}-literal`}>Constant value</label>
      {typeof expression.value === "boolean" ? <select id={`${id}-literal`} value={String(expression.value)} onChange={(event) => onChange({ ...expression, value: event.target.value === "true" })}>
        <option value="false">No</option><option value="true">Yes</option></select>
        : <input id={`${id}-literal`} type={typeof expression.value === "number" ? "number" : "text"} step="any" value={expression.value}
          onChange={(event) => onChange({ ...expression, value: typeof expression.value === "number" ? Number(event.target.value) : event.target.value })} />}
    </> : expression.kind === "field" ? <>
      <label htmlFor={`${id}-field`}>Input field</label><select id={`${id}-field`} value={expression.key} onChange={(event) => onChange({ ...expression, key: event.target.value })}>
        {fields.map((field) => <option key={field.id} value={field.key}>{field.label}</option>)}</select>
    </> : expression.kind === "count" || expression.kind === "total" ? <>
      <label htmlFor={`${id}-group`}>Repeating group</label><select id={`${id}-group`} value={expression.sectionId} onChange={(event) => onChange({ ...expression, sectionId: event.target.value,
        ...(expression.kind === "total" ? { field: groups.find(({ id }) => id === event.target.value)?.fields[0]?.key ?? "" } : {}) })}>
        {groups.map((group) => <option key={group.id} value={group.id}>{group.title ?? "Repeating group"}</option>)}</select>
      {expression.kind === "total" ? <><label htmlFor={`${id}-total`}>Field to total</label><select id={`${id}-total`} value={expression.field} onChange={(event) => onChange({ ...expression, field: event.target.value })}>
        {groups.find(({ id }) => id === expression.sectionId)?.fields.map((field) => <option key={field.id} value={field.key}>{field.label}</option>)}</select></> : null}
    </> : <>{expression.arguments.map((argument, index) => <FormExpressionEditor key={index} expression={argument} fields={fields} groups={groups} depth={depth + 1}
      label={expression.operator === "if" ? ["Condition", "When yes", "When no"][index]! : index === 0 ? "Left value" : "Right value"}
      onChange={(next) => onChange({ ...expression, arguments: expression.arguments.map((current, position) => position === index ? next : current) })} />)}</>}
  </fieldset>;
}
