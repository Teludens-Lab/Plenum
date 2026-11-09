import { useId, useRef, useState } from "react";
import { FORM_INTERCHANGE_CONTRACT_ID, importFormDefinition, type RuntimeFormDefinitionV1 } from "@plenum/simulation-schema";

export function FormInterchange({ form, apply }: { form: RuntimeFormDefinitionV1; apply(form: RuntimeFormDefinitionV1): void }) {
  const id = useId();
  const fileGeneration = useRef(0);
  const [candidate, setCandidate] = useState<RuntimeFormDefinitionV1 | null>(null);
  const [message, setMessage] = useState("");
  return <details className="nested-editor"><summary>Import or export Form definition</summary>
    <p className="hint">Import a versioned Form file, review its fields, then apply it to this Draft. Publication validation checks all references.</p>
    <button type="button" className="btn-secondary" onClick={() => {
      const url = URL.createObjectURL(new Blob([JSON.stringify({ contractId: FORM_INTERCHANGE_CONTRACT_ID, kind: "form", form }, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "form-definition.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>Export Form JSON</button>
    <label htmlFor={id}>Choose Form JSON file</label><input id={id} type="file" accept=".json,application/json" onChange={async (event) => {
      const file = event.target.files?.[0]; const generation = ++fileGeneration.current; setCandidate(null); setMessage("");
      if (!file) return;
      try {
        if (file.size > 2_000_000) throw new Error("Choose a file no larger than 2 MB.");
        const text = await file.text();
        if (generation === fileGeneration.current) setCandidate(importFormDefinition(text));
      } catch (error) { if (generation === fileGeneration.current) setMessage(error instanceof Error ? error.message : "The Form file could not be read."); }
    }} />
    {message ? <p role="status">{message}</p> : null}
    {candidate ? <section aria-label="Imported Form review"><h3>{candidate.name} · version {candidate.formVersion}</h3>
      {candidate.sections.map((section) => <div key={section.id}><h4>{section.title ?? "Section"}{section.repeatable ? " (repeating)" : ""}</h4>
        <ul>{section.fields.map((field) => <li key={field.id}>{field.label} · {field.type.replaceAll("_", " ")}{field.required ? " · required" : ""}</li>)}</ul></div>)}
      <p>This replaces this Draft’s Form fields while keeping its Artifact Type link. Existing published versions stay unchanged.</p>
      <button type="button" className="btn-primary" onClick={() => { apply({ ...candidate, id: form.id }); setCandidate(null); setMessage("Imported into this Draft. Review the Form and validate before publication."); }}>Apply reviewed Form</button>
      <button type="button" className="btn-secondary" onClick={() => setCandidate(null)}>Cancel import</button>
    </section> : null}
  </details>;
}
