import type { JsonObject, RuntimeFormFieldV1, RuntimeFormV1 } from "@plenum/event-contracts";
import { runtimeFieldConditionMatches, runtimeFormValue } from "@plenum/simulation-schema";
import { FormattedText } from "./FormattedText.js";

export function FormValue({ field, payload }: { field: RuntimeFormFieldV1; payload: JsonObject }) {
  return field.type === "formatted_text" ? <FormattedText value={runtimeFormValue(payload, field.key) ?? ""} /> : <>{formatFormValue(field, payload)}</>;
}

export function formatFormValue(field: RuntimeFormFieldV1, payload: JsonObject): string {
  const value = runtimeFormValue(payload, field.key);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && field.numeric) return `${value.toFixed(field.numeric.precision)} ${field.numeric.unit}`;
  const label = (item: unknown) => field.options?.find((option) => option.value === item)?.label ??
    (field.type === "entity_reference" && item ? "Unavailable reference" : String(item ?? ""));
  return (Array.isArray(value) ? value.map(label).join(", ") : label(value)) || "Not provided";
}

export function FormTableSummary({ section, payload }: { section: RuntimeFormV1["sections"][number]; payload: JsonObject }) {
  if (section.table === undefined) return null;
  return <div className="form-table-scroll" role="group" aria-label={section.title ?? "Form summary"} tabIndex={0}>
    <table className="form-table"><caption className="visually-hidden">{section.title}</caption>
      <thead><tr><th scope="col">Item</th>{section.table.columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
      <tbody>{section.table.rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{row.fields.map((key) => {
        const field = section.fields.find((field) => field.key === key);
        return <td key={key}>{field === undefined || !runtimeFieldConditionMatches(field.visibleWhen, payload) ? "—" : <FormValue field={field} payload={payload} />}</td>;
      })}</tr>)}</tbody>
    </table>
  </div>;
}
