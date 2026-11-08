import type { JsonObject, RuntimeFormFieldV1, RuntimeFormV1 } from "@plenum/event-contracts";
import { runtimeFieldConditionMatches, runtimeFormValue } from "@plenum/simulation-schema";

export function formatFormValue(field: RuntimeFormFieldV1, payload: JsonObject): string {
  const value = runtimeFormValue(payload, field.key);
  const label = (item: unknown) => field.options?.find((option) => option.value === item)?.label ?? String(item ?? "");
  return (Array.isArray(value) ? value.map(label).join(", ") : label(value)) || "Not provided";
}

export function FormTableSummary({ section, payload }: { section: RuntimeFormV1["sections"][number]; payload: JsonObject }) {
  if (section.table === undefined) return null;
  return <div className="form-table-scroll" role="region" aria-label={section.title ?? "Form summary"} tabIndex={0}>
    <table className="form-table"><caption className="visually-hidden">{section.title}</caption>
      <thead><tr><th scope="col">Item</th>{section.table.columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
      <tbody>{section.table.rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{row.fields.map((key) => {
        const field = section.fields.find((field) => field.key === key);
        return <td key={key}>{field === undefined || !runtimeFieldConditionMatches(field.visibleWhen, payload) ? "—" : formatFormValue(field, payload)}</td>;
      })}</tr>)}</tbody>
    </table>
  </div>;
}
