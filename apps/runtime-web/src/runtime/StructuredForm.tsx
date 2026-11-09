import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { JsonObject, RuntimeFormFieldV1, RuntimeFormV1 } from "@plenum/event-contracts";
import { multipleField, numericField, recomputeFormValues, runtimeFieldConditionMatches, runtimeFormValue, setRuntimeFormValue, validateRuntimeFormPayload, type RuntimeFormDefinitionV1 } from "@plenum/simulation-schema";
import { FormTableSummary, formatFormValue } from "./FormTableSummary.js";
import { FormattedTextInput } from "./FormattedText.js";

export type FieldEditorProps = {
  form: RuntimeFormV1; initial?: JsonObject; disabled: boolean;
  onSubmit(payload: JsonObject): void; submitLabel: string; onChange?(payload: JsonObject): void;
};

export function FormField({ field, value, context, id, disabled, error, change }: {
  field: RuntimeFormFieldV1; value: unknown; context: JsonObject; id: string; disabled: boolean;
  error?: string | undefined; change(value: string | string[] | boolean): void;
}) {
  if (!runtimeFieldConditionMatches(field.visibleWhen, context)) return null;
  const required = field.required || (field.requiredWhen !== undefined && runtimeFieldConditionMatches(field.requiredWhen, context));
  const describedBy = [field.helpText === undefined ? null : `${id}-help`, error === undefined ? null : `${id}-error`].filter(Boolean).join(" ") || undefined;
  const common = { disabled: disabled || field.readOnly === true || field.computation !== undefined, required, "aria-invalid": error !== undefined, "aria-describedby": describedBy };
  const multi = multipleField(field);
  const numericCards = field.type === "number" && field.control === "cards" && field.validation?.min !== undefined && field.validation.max !== undefined
    && field.validation.max - field.validation.min >= 0 && field.validation.max - field.validation.min < 10;
  const options = numericCards ? Array.from({ length: field.validation!.max! - field.validation!.min! + 1 }, (_, index) => ({
    value: String(field.validation!.min! + index), label: String(field.validation!.min! + index), description: undefined
  })) : field.options;
  const cards = numericCards || (field.type === "single_select" && field.readOnly !== true && (field.control === "cards" || (field.control !== "select" && (field.options?.length ?? 0) <= 4)));
  const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const text = typeof value === "string" || typeof value === "number" ? value : "";
  return <div className={`field${cards ? " field-cards" : ""}`}>
    {cards || multi ? <span className="field-label" id={`${id}-label`}>{field.label}{required ? " *" : ""}</span>
      : <label htmlFor={id}>{field.label}{required ? " *" : ""}</label>}
    {cards || multi ? <div className={`runtime-form-choices${multi ? " is-checkboxes" : ""}`} role={cards ? "radiogroup" : "group"}
      aria-labelledby={`${id}-label`} aria-describedby={describedBy} aria-invalid={error !== undefined}>
      {(options ?? []).map((option, index) => <label key={option.value}>
        <input {...common} required={cards && required} id={`${id}-${index}`} type={multi ? "checkbox" : "radio"} name={id} aria-label={option.label}
          aria-describedby={[describedBy, option.description === undefined ? undefined : `${id}-${index}-description`].filter(Boolean).join(" ") || undefined}
          checked={multi ? selected.includes(option.value) : String(value) === option.value}
          onChange={(event) => change(multi ? event.target.checked ? [...selected, option.value] : selected.filter((item) => item !== option.value) : option.value)} />
        <span><strong>{option.label}</strong>{option.description === undefined ? null : <small id={`${id}-${index}-description`}>{option.description}</small>}</span>
      </label>)}
      {(options?.length ?? 0) === 0 ? <p className="hint">No choices are available.</p> : null}
    </div> : field.type === "formatted_text" ? <FormattedTextInput {...common} id={id} name={field.key} value={String(text)} change={change} />
      : field.type === "long_text" ? <textarea {...common} id={id} name={field.key} rows={4} value={text}
      minLength={field.validation?.minLength} maxLength={field.validation?.maxLength} onChange={(event) => change(event.target.value)} />
      : field.type === "yes_no" ? <select {...common} id={id} name={field.key} value={typeof value === "boolean" ? String(value) : ""} onChange={(event) => change(event.target.value === "" ? "" : event.target.value === "true")}>
        <option value="">Select an answer</option><option value="true">Yes</option><option value="false">No</option>
      </select> : field.type === "date_time" ? <input {...common} id={id} name={field.key} type="datetime-local" step="0.001"
        aria-label={`${field.label} (UTC)`} value={typeof value === "string" ? value.replace(/Z$/u, "") : ""}
        onChange={(event) => { const next = event.target.value; change(next === "" ? "" : new Date(`${next}Z`).toISOString()); }} />
      : field.type === "single_select" || field.type === "entity_reference" ? <select {...common} id={id} name={field.key} value={text} onChange={(event) => change(event.target.value)}>
        <option value="">Select an option</option>{(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select> : field.control === "range" ? <div className="runtime-form-range">
        <input {...common} id={id} name={field.key} type="range" min={field.validation?.min} max={field.validation?.max} step="1"
          value={text === "" ? field.validation?.min ?? 0 : text} onChange={(event) => change(event.target.value)} />
        <output htmlFor={id}>{text === "" ? "Not rated" : `${text} / ${field.validation?.max ?? 10}`}</output>
      </div> : <input {...common} id={id} name={field.key} type={numericField(field.type) ? "number" : field.type === "date" || field.type === "time" ? field.type : "text"} value={text}
        step={field.type === "time" ? 1 : field.numeric ? 10 ** -field.numeric.precision : "any"}
        min={field.validation?.min} max={field.validation?.max} minLength={field.validation?.minLength} maxLength={field.validation?.maxLength}
        onChange={(event) => change(field.type === "time" && event.target.value.length === 5 ? `${event.target.value}:00` : event.target.value)} />}
    {field.numeric ? <p className="hint">Unit: {field.numeric.unit}; {field.numeric.precision} decimal places.</p> : null}
    {field.computation ? <p className="hint">Calculated value · Formula {field.computation.version}. Confirmed by the server when submitted.</p> : null}
    {field.type === "date_time" ? <p className="hint">Enter the date and time in UTC.</p> : null}
    {field.helpText === undefined ? null : <p id={`${id}-help`} className="hint">{field.helpText}</p>}
    {error === undefined ? null : <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
  </div>;
}

/** Layout comes from the published form; payload keys and validation stay canonical. */
export function StructuredForm({ form, initial, disabled, onSubmit, submitLabel, onChange }: FieldEditorProps) {
  const prefix = useId().replaceAll(":", "");
  const root = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [values, setValues] = useState<JsonObject>(() => {
    const result = structuredClone(initial ?? {});
    for (const field of form.fields) if (runtimeFormValue(result, field.key) === undefined) {
      setRuntimeFormValue(result, field.key, field.defaultValue ?? (multipleField(field) ? [] : ""));
    }
    return result;
  });
  const [page, setPage] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusError, setFocusError] = useState(0);
  const pages = form.layout?.pages ?? [];
  const pageCount = pages.length;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    onChange?.(values);
  }, [values]);
  useEffect(() => {
    if (focusError === 0) return;
    const element = root.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    element?.closest("details")?.setAttribute("open", "");
    (element?.matches("input,select,textarea") ? element : element?.querySelector<HTMLElement>("input,select,textarea"))?.focus();
  }, [focusError]);
  const content = () => {
    const result = structuredClone(values);
    for (const field of form.fields) {
      const value = runtimeFormValue(result, field.key);
      if (numericField(field.type) && value !== "" && value !== undefined) setRuntimeFormValue(result, field.key, Number(value));
    }
    return result;
  };
  const canonical: RuntimeFormDefinitionV1 = { ...form, sections: form.sections.map((section) => ({ ...section,
    fields: section.fields.map((field) => ({ ...field, id: `${form.id}-${field.key}`, type: field.type === "text" ? "short_text" : field.type })) })) };
  const computed = recomputeFormValues(canonical, content());
  const conditionValues = computed.payload as JsonObject;
  const validate = (currentPageOnly: boolean) => {
    const issues = [...computed.issues, ...validateRuntimeFormPayload(canonical, conditionValues)].filter((issue) => !currentPageOnly ||
      form.sections.some((section) => (section.page ?? 0) === page && section.fields.some((field) => field.key === issue.field)));
    setErrors(Object.fromEntries(issues.map((issue) => [issue.field, issue.message])));
    if (issues.length === 0) return true;
    const section = form.sections.find((section) => section.fields.some((field) => field.key === issues[0]?.field));
    setPage(section?.page ?? 0);
    setFocusError((value) => value + 1);
    return false;
  };
  const navigate = (next: number) => { setPage(next); heading.current?.focus(); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pageCount > 0 && page < pageCount - 1) { if (validate(true)) navigate(page + 1); }
    else if (validate(false)) onSubmit(conditionValues);
  };
  const renderField = (key: string) => {
    const field = form.fields.find((field) => field.key === key);
    if (field === undefined) return null;
    return <FormField key={key} field={field} context={conditionValues} value={runtimeFormValue(field.computation ? conditionValues : values, key)} id={`${prefix}-${key.replaceAll(".", "-")}`}
      disabled={disabled} error={errors[key]} change={(value) => {
        const next = structuredClone(values); setRuntimeFormValue(next, key, value); setValues(next); setErrors({});
      }} />;
  };
  return <form className="structured-form" ref={root} onSubmit={submit} noValidate>
    {pageCount === 0 ? null : <header className="form-page-heading">
      <p role="status">Page {page + 1} of {pageCount}</p><h3 ref={heading} tabIndex={-1}>{pages[page]}</h3>
      <ol className="form-progress" aria-label="Form progress">{pages.map((title, index) => <li key={index} aria-current={index === page ? "step" : undefined}><span className="visually-hidden">{title}</span></li>)}</ol>
    </header>}
    {Object.keys(errors).length === 0 ? null : <p className="field-error" role="alert">Complete the highlighted fields before continuing.</p>}
    {form.layout?.review !== true || page !== pageCount - 1 ? null : <div className="form-review">
      {form.sections.map((section) => <section key={section.id}>
        <h4>{section.title}</h4><dl className="artifact-content">{section.fields.filter((field) => runtimeFieldConditionMatches(field.visibleWhen, values)
          && !section.table?.rows.some((row) => row.fields.includes(field.key))).map((field) =>
          <div key={field.key}><dt>{field.label}</dt><dd>{formatFormValue(field, values)}</dd></div>)}</dl>
        <FormTableSummary section={section} payload={values} />
        <button className="btn-secondary" type="button" onClick={() => navigate(section.page ?? 0)}>Edit {section.title}</button>
      </section>)}
    </div>}
    {form.sections.map((section) => {
      const tableFields = new Set(section.table?.rows.flatMap((row) => row.fields) ?? []);
      const contents = <>
        {section.description === undefined ? null : <p className="hint">{section.description}</p>}
        <div className="form-section-fields" data-columns={section.columns}>{section.fields.filter((field) => !tableFields.has(field.key)).map((field) => renderField(field.key))}</div>
        {section.table === undefined ? null : section.table.editor === "groups" ? section.table.rows.map((row) => <fieldset className="form-row-group" key={row.label}>
          <legend>{row.label}</legend><div className="form-section-fields" data-columns={section.table?.columns.length}>{row.fields.map(renderField)}</div>
        </fieldset>) : <div className="form-table-scroll" role="group" aria-label={section.title ?? "Form table"} tabIndex={0}>
          <table className="form-table"><caption className="visually-hidden">{section.title}</caption>
            <thead><tr><th scope="col">Item</th>{section.table.columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
            <tbody>{section.table.rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{row.fields.map((key) => <td key={key}>{renderField(key)}</td>)}</tr>)}</tbody>
          </table></div>}
      </>;
      return <fieldset key={section.id} hidden={pageCount > 0 && (section.page ?? 0) !== page}>
        {section.collapsed ? <details><summary>{section.title}</summary>{contents}</details> : <>
          {section.title === undefined ? null : <legend>{section.title}</legend>}{contents}
        </>}
      </fieldset>;
    })}
    <footer className="form-actions">
      {pageCount === 0 ? null : <button className="btn-secondary" type="button" disabled={disabled || page === 0} onClick={() => navigate(page - 1)}>Back</button>}
      <button className="btn-primary" type="submit" disabled={disabled}>{pageCount > 0 && page < pageCount - 1 ? "Next" : submitLabel}</button>
    </footer>
  </form>;
}
