import { useId, useRef, useState } from "react";
import type { JsonObject, RuntimeFormV1 } from "@plenum/event-contracts";
import { importFormRecord, parseFormCsv, previewFormCsv, runtimeFormValue, type RuntimeFormDefinitionV1 } from "@plenum/simulation-schema";
import { FormValue } from "./FormTableSummary.js";

export function RecordImport({ form, releaseId, disabled, apply }: {
  form: RuntimeFormV1; releaseId: string; disabled: boolean; apply(payload: JsonObject): void;
}) {
  const id = useId();
  const fileGeneration = useRef(0);
  const [csv, setCsv] = useState<ReturnType<typeof parseFormCsv> | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<ReturnType<typeof previewFormCsv>>([]);
  const [message, setMessage] = useState("");
  const canonical: RuntimeFormDefinitionV1 = { ...form, sections: form.sections.map((section) => ({ ...section, fields: section.fields.map((field) => ({
    ...field, id: `${section.id}-${field.key}`, type: field.type === "text" ? "short_text" : field.type
  })) })) };
  const fields = canonical.sections.filter((section) => !section.repeatable).flatMap((section) => section.fields).filter((field) => !field.readOnly && !field.computation);
  return <details className="artifact-edit"><summary>Import record values</summary>
    <p>Choose JSON from this Form version and Release, or map CSV columns to fields. Review one row and load it into the editor before saving. Attachment manifests are references; file bytes are uploaded separately.</p>
    <label htmlFor={id}>Import records file</label><input id={id} type="file" accept=".json,.csv,application/json,text/csv" disabled={disabled} onChange={async (event) => {
      const file = event.target.files?.[0]; const generation = ++fileGeneration.current; setMessage(""); setCsv(null); setRows([]); setMapping({});
      if (!file) return;
      try {
        if (file.size > 2_000_000) throw new Error("Choose a file no larger than 2 MB.");
        const text = await file.text();
        if (generation !== fileGeneration.current) return;
        if (file.name.toLowerCase().endsWith(".csv")) setCsv(parseFormCsv(text));
        else setRows([{ rowNumber: 1, payload: importFormRecord(text, canonical, releaseId), issues: [] }]);
      } catch (error) { if (generation === fileGeneration.current) setMessage(error instanceof Error ? error.message : "The file could not be read."); }
    }} />
    {csv ? <fieldset><legend>Map CSV columns</legend>{csv.headers.map((header, index) => <div className="field" key={header}><label htmlFor={`${id}-${index}`}>{header}</label>
      <select id={`${id}-${index}`} value={Object.hasOwn(mapping, header) ? mapping[header] : ""} disabled={disabled} onChange={(event) => { setMapping({ ...mapping, [header]: event.target.value }); setRows([]); }}>
        <option value="">Skip column</option>{fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
      </select></div>)}
      <button className="btn-secondary" type="button" disabled={disabled} onClick={() => {
        try { setRows(previewFormCsv(canonical, csv, mapping)); setMessage(csv.rows.length ? "" : "The CSV contains no data rows."); }
        catch (error) { setMessage(error instanceof Error ? error.message : "Review the mappings."); }
      }}>Preview mapped rows</button>
    </fieldset> : null}
    {message ? <p role="status">{message}</p> : null}
    {rows.map((row) => <details key={row.rowNumber}><summary>Row {row.rowNumber} · {row.issues.length ? `${row.issues.length} validation issues` : "Ready to review"}</summary>
      {form.sections.map((section) => {
        const entries = section.repeatable ? row.payload[section.id] : [row.payload];
        return !Array.isArray(entries) ? null : <section key={section.id} aria-label={section.title ?? "Values"}>{entries.map((entry, index) =>
          typeof entry !== "object" || entry === null ? null : <div key={index}>{section.repeatable ? <p>{section.itemLabel ?? "Entry"} {index + 1}</p> : null}
            <dl>{section.fields.filter((field) => runtimeFormValue(entry as JsonObject, field.key) !== undefined).map((field) => <div key={field.key}>
              <dt>{field.label}</dt><dd><FormValue field={field} payload={entry as JsonObject} /></dd></div>)}</dl>
          </div>)}</section>;
      })}
      {row.issues.length ? <ul>{row.issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul> : null}
      <button className="btn-secondary" type="button" disabled={disabled || row.issues.length > 0} onClick={() => {
        apply(row.payload as JsonObject); setMessage(`Row ${row.rowNumber} loaded into the editor. Review all fields, then save.`);
      }}>Load row {row.rowNumber} into editor</button>
    </details>)}
  </details>;
}

export function RecordExport({ disabled, download }: { disabled: boolean; download(format: "json" | "csv" | "pdf"): Promise<void> }) {
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  return <details className="artifact-record-details"><summary>Export record</summary><p>Exports contain the fields available in your current role. CSV includes linked repeating-group tables and the original JSON. Attachment manifests preserve file identity; download clean files separately.</p>
    <div className="actions">{(["json", "csv", "pdf"] as const).map((format) => <button className="btn-secondary" type="button" key={format} disabled={disabled || pending} onClick={async () => {
      setPending(true); setError("");
      try { await download(format); } catch (error) { setError(error instanceof Error ? error.message : "Export unavailable. Retry when connected."); }
      finally { setPending(false); }
    }}>Export {format === "csv" ? "linked CSV tables" : format.toUpperCase()}</button>)}</div>
    {error ? <p role="alert">{error}</p> : null}
  </details>;
}
