import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { CommandReceiptV1, JsonObject, RuntimeFormV1, RuntimeActionV1, RuntimeArtifactV1, RuntimeCreateTaskV1 } from "@plenum/event-contracts";
import { StructuredForm, FormField, type FieldEditorProps } from "./StructuredForm.js";
import { FormTableSummary, FormValue } from "./FormTableSummary.js";
import { LocalDraft } from "./LocalDrafts.js";
import { RecordImport, RecordExport } from "./RecordInterchange.js";
import { FORM_LIMITS, multipleField, numericField, recomputeFormValues, runtimeFieldConditionMatches, runtimeFormValue, setRuntimeFormValue, validateRuntimeFormPayload, type RuntimeFormDefinitionV1 } from "@plenum/simulation-schema";

export const createTaskKey = (task: RuntimeCreateTaskV1): string => `${task.artifactTypeKey}:${String(task.initialValues?.industryCellId ?? "")}`;

export function CreateWorkspace({ tasks, disabled, send }: {
  tasks: RuntimeCreateTaskV1[]; disabled: boolean;
  send(action: RuntimeActionV1, artifact: RuntimeArtifactV1 | null, content?: JsonObject, artifactTypeKey?: string): Promise<CommandReceiptV1 | null>;
}) {
  const [selected, setSelected] = useState("");
  const current = tasks.find((task) => createTaskKey(task) === selected) ?? tasks[0];
  return <div className="artifact-composer">
    {tasks.length === 0 ? <p>No forms are available in this Stage.</p> : <>
      {tasks.length <= 1 ? null : <div className="artifact-type-tabs" role="group" aria-label="Choose a form">
        {tasks.map((task) => <button className="btn-secondary" key={createTaskKey(task)} type="button" aria-pressed={task === current}
          onClick={() => setSelected(createTaskKey(task))}>{task.title}</button>)}
      </div>}
      {tasks.map((task) => <div key={createTaskKey(task)} hidden={task !== current}><CreateTask task={task} disabled={disabled} send={send} /></div>)}
    </>}
  </div>;
}

export function FieldEditor(props: FieldEditorProps) {
  return props.form.sections.some((section) => section.repeatable === true)
    ? <RepeatableFieldEditor {...props} />
    : <StructuredForm {...props} />;
}

function RepeatableFieldEditor({ form, initial, disabled, onSubmit, submitLabel, onChange }: FieldEditorProps) {
  const idPrefix = useId().replaceAll(":", "");
  const blankItem = (section: RuntimeFormV1["sections"][number]): JsonObject => {
    const result: JsonObject = {};
    for (const field of section.fields) setRuntimeFormValue(result, field.key, field.defaultValue ?? (multipleField(field) ? [] : ""));
    return result;
  };
  const [values, setValues] = useState<JsonObject>(() => {
    const result = structuredClone(initial ?? {}) as JsonObject;
    for (const section of form.sections) {
      if (section.repeatable === true) {
        if (!Array.isArray(result[section.id])) result[section.id] = Array.from({ length: section.minItems ?? 0 }, () => blankItem(section));
      } else {
        for (const field of section.fields) {
          if (runtimeFormValue(result, field.key) === undefined) setRuntimeFormValue(result, field.key, field.defaultValue ?? (multipleField(field) ? [] : ""));
        }
      }
    }
    return result;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setValue = (path: string, value: unknown) => {
    const next = structuredClone(values) as JsonObject;
    setRuntimeFormValue(next, path, value);
    setValues(next); setErrors({});
  };
  const content = (): JsonObject => {
    const result = structuredClone(values) as JsonObject;
    for (const section of form.sections) {
      const entries = section.repeatable === true && Array.isArray(result[section.id])
        ? result[section.id] as JsonObject[] : [result];
      entries.forEach((entry) => section.fields.filter((field) => numericField(field.type)).forEach((field) => {
        const value = runtimeFormValue(entry, field.key);
        if (value !== "" && value !== undefined) setRuntimeFormValue(entry, field.key, Number(value));
      }));
    }
    return result;
  };
  const canonicalForm = (): RuntimeFormDefinitionV1 => ({
    ...form,
    sections: form.sections.map((section) => ({ ...section, fields: section.fields.map((field) => ({
      ...field, id: `${form.id}-${section.id}-${field.key}`, type: field.type === "text" ? "short_text" : field.type
    })) }))
  });
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    onChange?.(values);
  }, [values]);
  const computed = recomputeFormValues(canonicalForm(), content());
  const conditionValues = computed.payload as JsonObject;
  const renderField = (field: RuntimeFormV1["fields"][number], context: JsonObject, path: string, id: string) => {
    return <FormField key={path} field={field} context={context} value={runtimeFormValue(field.computation ? conditionValues : values, path)}
      id={id} disabled={disabled} error={errors[path]} change={(value) => setValue(path, value)} />;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = conditionValues;
    const nextErrors = Object.fromEntries([...computed.issues, ...validateRuntimeFormPayload(canonicalForm(), payload)].map((issue) => [issue.field, issue.message]));
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSubmit(payload);
  };
  return <form onSubmit={submit} noValidate>
    {form.sections.map((section) => section.repeatable === true ? <fieldset key={section.id}>
      {section.title === undefined ? null : <legend>{section.title}</legend>}
      {section.description === undefined ? null : <p className="hint">{section.description}</p>}
      {(Array.isArray(values[section.id]) ? values[section.id] as JsonObject[] : []).map((entry, index) => <fieldset className="repeatable-item" key={index}>
        <legend>{section.itemLabel ?? "Item"} {index + 1}</legend>
        {section.fields.map((field) => renderField(field, (conditionValues[section.id] as JsonObject[])[index] ?? entry, `${section.id}.${index}.${field.key}`, `${idPrefix}-${form.id}-${section.id}-${index}-${field.key.replaceAll(".", "-")}`))}
        <button className="btn-secondary" type="button" disabled={disabled || (values[section.id] as JsonObject[]).length <= (section.minItems ?? 0)} onClick={() => {
          const entries = [...(values[section.id] as JsonObject[])]; entries.splice(index, 1); setValues({ ...values, [section.id]: entries });
        }}>Remove {section.itemLabel ?? "item"}</button>
      </fieldset>)}
      <button className="btn-secondary" type="button" disabled={disabled || (values[section.id] as JsonObject[]).length >= (section.maxItems ?? (form.contractId ? FORM_LIMITS.entries : Infinity))} onClick={() => {
        setValues({ ...values, [section.id]: [...(values[section.id] as JsonObject[]), blankItem(section)] });
      }}>Add {section.itemLabel ?? "item"}</button>
      {errors[section.id] === undefined ? null : <p className="field-error" role="alert">Error: {errors[section.id]}</p>}
    </fieldset> : <fieldset key={section.id}>
      {section.title === undefined ? null : <legend>{section.title}</legend>}
      {section.description === undefined ? null : <p className="hint">{section.description}</p>}
      {section.fields.map((field) => renderField(field, conditionValues, field.key, `${idPrefix}-${form.id}-${field.key.replaceAll(".", "-")}`))}
    </fieldset>)}
    <button className="btn-primary" type="submit" disabled={disabled}>{submitLabel}</button>
  </form>;
}

export function CreateTask({ task, disabled, send, submitLabel = "Save draft", compact = false }: {
  task: RuntimeCreateTaskV1; disabled: boolean;
  submitLabel?: string; compact?: boolean;
  send(action: RuntimeActionV1, artifact: RuntimeArtifactV1 | null, content?: JsonObject, artifactTypeKey?: string): Promise<CommandReceiptV1 | null>;
}) {
  const headingId = useId();
  return <section className="card" aria-labelledby={headingId}>
    <h2 id={headingId} className={compact ? "visually-hidden" : undefined}>{task.title}</h2>
    <LocalDraft draftKey={`${createTaskKey(task)}:${task.form.id}:${task.form.formVersion}`} {...(task.initialValues === undefined ? {} : { initial: task.initialValues })}>
      {(initial, changed, accepted, reset) => <FieldEditor key={reset} form={task.form} {...(initial === undefined ? {} : { initial })}
        disabled={disabled} submitLabel={submitLabel} onChange={changed} onSubmit={async (content) => {
          const receipt = await send(task.action, null, content, task.artifactTypeKey);
          if (receipt?.status === "accepted") await accepted();
        }} />}
    </LocalDraft>
  </section>;
}

function DisplayFields({ fields, payload }: { fields: RuntimeFormV1["fields"]; payload: JsonObject }) {
  return <dl className="artifact-content">{fields.map((field) => {
    return <div key={field.key} data-field-type={field.type}><dt>{field.label}</dt><dd><FormValue field={field} payload={payload} /></dd></div>;
  })}</dl>;
}

export function ArtifactContent({ form, payload }: { form: RuntimeFormV1; payload: JsonObject }) {
  return <div className="artifact-sections">{form.sections.map((section) => {
    if (section.repeatable !== true) return <section key={section.id}>
      {section.title === undefined ? null : <h4>{section.title}</h4>}
      <DisplayFields fields={section.fields.filter((field) => runtimeFieldConditionMatches(field.visibleWhen, payload)
        && !section.table?.rows.some((row) => row.fields.includes(field.key)))} payload={payload} />
      <FormTableSummary section={section} payload={payload} /></section>;
    const entries = Array.isArray(payload[section.id]) ? payload[section.id] as JsonObject[] : [];
    return <section key={section.id} aria-labelledby={`${form.id}-${section.id}-content`}>
      {section.title === undefined ? null : <h4 id={`${form.id}-${section.id}-content`}>{section.title}</h4>}
      {entries.length === 0 ? <p>Not provided</p> : entries.map((entry, index) => <section className="repeatable-item" key={index}>
        <h5>{section.itemLabel ?? "Item"} {index + 1}</h5>
        <DisplayFields fields={section.fields} payload={entry} />
      </section>)}
    </section>;
  })}</div>;
}

export function ArtifactCard({ artifact, disabled, send, download }: {
  artifact: RuntimeArtifactV1; disabled: boolean;
  send(action: RuntimeActionV1, artifact: RuntimeArtifactV1, content?: JsonObject): void;
  download?(format: "json" | "csv" | "pdf"): Promise<void>;
}) {
  const [imported, setImported] = useState<{ payload: JsonObject; revision: number } | null>(null);
  const edit = artifact.actions.find((action) => action.requiresForm);
  const actions = artifact.actions.filter((action) => !action.requiresForm);
  const { rules: _rules, layout: _layout, ...formWithoutRules } = artifact.form;
  const editForm = edit?.editableFieldKeys === undefined ? artifact.form : {
    ...formWithoutRules,
    fields: artifact.form.fields.filter((field) => edit.editableFieldKeys?.includes(field.key)),
    sections: artifact.form.sections.map(({ page: _page, table: _table, collapsed: _collapsed, ...section }) => ({
      ...section, fields: section.fields.filter((field) => edit.editableFieldKeys?.includes(field.key))
    })).filter((section) => section.fields.length > 0)
  };
  return <article className="card artifact" aria-labelledby={`artifact-${artifact.id}`}>
    <div className="card-heading">
      <div>
        <h3 id={`artifact-${artifact.id}`}>{artifact.title}</h3>
      </div>
      <span className={`badge ${["completed", "accepted"].includes(artifact.state) ? "badge-success" : "badge-state"}`}>{artifact.stateLabel}</span>
    </div>
    <ArtifactContent form={artifact.form} payload={artifact.payload} />
    {edit === undefined ? null : <details className="artifact-edit"><summary>{edit.label}</summary>
      <RecordImport form={editForm} releaseId={artifact.governingReleaseId} disabled={disabled}
        apply={(payload) => {
          const next = structuredClone(artifact.payload);
          for (const section of editForm.sections) {
            if (section.repeatable) { if (Array.isArray(payload[section.id])) next[section.id] = payload[section.id]!; }
            else for (const field of section.fields) {
              const value = runtimeFormValue(payload, field.key);
              if (!field.readOnly && !field.computation && value !== undefined) setRuntimeFormValue(next, field.key, value);
            }
          }
          setImported({ payload: next, revision: (imported?.revision ?? 0) + 1 });
        }} />
      <FieldEditor key={imported?.revision ?? 0} form={editForm} initial={imported?.payload ?? artifact.payload} disabled={disabled} submitLabel={edit.label}
          onSubmit={(content) => send(edit, artifact, content)} /></details>}
    {artifact.exportable && download ? <RecordExport disabled={disabled} download={download} /> : null}
    {actions.length === 0 ? null : <div className="actions" aria-label={`${artifact.title} workflow actions`}>
      {actions.map((action, index) => <button key={action.operationType}
        className={index === 0 ? "btn-primary" : "btn-secondary"} type="button" disabled={disabled}
        onClick={() => send(action, artifact)}>{action.label}</button>)}
    </div>}
    <details className="artifact-record-details"><summary>Record details</summary>
      <dl className="metadata"><div><dt>Version</dt><dd>{artifact.version}</dd></div><div><dt>Form</dt><dd>{artifact.form.formVersion}</dd></div></dl>
    </details>
  </article>;
}
