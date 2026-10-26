import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  type CommandEnvelopeV1,
  type CommandReceiptV1,
  type AdjudicationRequestV1,
  type ErrorEnvelopeV1,
  type EffectProposalV1,
  type JsonObject,
  type OperatorProjectionV1,
  type ReadinessProjectionV1,
  type RuntimeActionV1,
  type RuntimeArtifactV1,
  type RuntimeCreateTaskV1,
  type RuntimeFormV1,
  type RuntimeInjectV1,
  type RuntimeMessageV1,
  type RuntimeModuleV1,
  type RuntimePollV1,
  type RuntimeProjectionV1,
  type RuntimeVoiceChannelV1,
  type FloorLeaseV1
} from "@plenum/event-contracts";
import type { OfflineCommandV1, OfflineOutboxV1, SyncBootstrapV1 } from "@plenum/event-contracts";
import {
  canQueueOffline,
  createOfflineOutbox,
  enqueueOfflineCommand,
  minimizeOfflineProjection,
  orderedOfflineCommands,
  recordOfflineReceipt,
  updateOfflineDraft
} from "@plenum/sync-client";
import {
  runtimeFieldConditionMatches,
  runtimeFormValue,
  setRuntimeFormValue,
  validateRuntimeFormPayload,
  type RuntimeFormDefinitionV1
} from "@plenum/simulation-schema";
import { VoiceControls } from "./voice/VoiceControls.js";
import { AdjudicationReview } from "./adjudication/AdjudicationReview.js";
import { OfflineRuntimeStore } from "./offline/storage.js";

type ConnectionState = "loading" | "online" | "offline" | "error";

const DEVICE_STORAGE_KEY = "plenum.runtime.deviceId";
const offlineStore = new OfflineRuntimeStore();

class ApiError extends Error {
  constructor(readonly status: number, readonly envelope: ErrorEnvelopeV1) {
    super(envelope.error.message);
  }
}

function isCommandReceipt(value: unknown): value is CommandReceiptV1 {
  return typeof value === "object" && value !== null && "commandId" in value &&
    typeof value.commandId === "string" && "status" in value &&
    ["received", "accepted", "rejected", "needs_reconciliation"].includes(String(value.status));
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers }
  });
  const body = await response.json() as T | ErrorEnvelopeV1;
  if (!response.ok) {
    if (typeof body === "object" && body !== null && "error" in body) {
      throw new ApiError(response.status, body as ErrorEnvelopeV1);
    }
    throw new Error(`Request failed with status ${response.status}`);
  }
  return body as T;
}

function sessionId(): string | null {
  return new URLSearchParams(window.location.search).get("sessionId");
}

function ConnectionBadge({ state }: { state: ConnectionState }) {
  const label = state === "online" ? "Connected" : state === "loading" ? "Connecting" : state === "offline" ? "Offline" : "Connection error";
  return <span className={`badge badge-${state}`} aria-label={`Connection status: ${label}`}>{label}</span>;
}

function Shell({ connection, children }: { connection: ConnectionState; children: ReactNode }) {
  return <>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="app-header">
      <a className="brand" href={window.location.pathname + window.location.search}>Plenum</a>
      <ConnectionBadge state={connection} />
    </header>
    {children}
  </>;
}

function StatePage({ connection, title, message, retry }: {
  connection: ConnectionState; title: string; message: string; retry?: () => void;
}) {
  return <Shell connection={connection}>
    <main id="main-content" className="state-page" tabIndex={-1}>
      <section className="card state-card" aria-busy={connection === "loading"}>
        <p className="eyebrow">Runtime status</p>
        <h1>{title}</h1>
        <p role={connection === "error" ? "alert" : "status"}>{message}</p>
        {retry === undefined ? null : <button className="btn-primary" type="button" onClick={retry}>Retry</button>}
      </section>
    </main>
  </Shell>;
}

const clearsOfflineData = (error: ApiError): boolean =>
  ["ACCESS_REVOKED", "NOT_A_PARTICIPANT", "DEVICE_NOT_REGISTERED", "PERMISSION_DENIED"]
    .includes(error.envelope.error.code);

async function submitQueuedCommand(sessionId: string, command: CommandEnvelopeV1): Promise<CommandReceiptV1> {
  try {
    return await api<CommandReceiptV1>(`/v1/sessions/${sessionId}/commands/${command.commandId}`);
  } catch (cause) {
    if (!(cause instanceof ApiError) || cause.status !== 404) throw cause;
  }
  const response = await fetch(`/v1/sessions/${sessionId}/commands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(command)
  });
  const body: unknown = await response.json();
  if (isCommandReceipt(body)) return body;
  if (typeof body === "object" && body !== null && "error" in body) {
    throw new ApiError(response.status, body as ErrorEnvelopeV1);
  }
  throw new Error(`Command returned an invalid response with status ${response.status}`);
}

async function reconcileOfflineOutbox(sessionId: string, outbox: OfflineOutboxV1): Promise<{
  outbox: OfflineOutboxV1;
  accepted: number;
  rejected: number;
  reconciliation: number;
}> {
  let current = outbox;
  let accepted = 0;
  let rejected = 0;
  let reconciliation = 0;
  for (const entry of orderedOfflineCommands(outbox.entries.filter(({ status }) =>
    status === "local_pending" || status === "received"))) {
    const receipt = await submitQueuedCommand(sessionId, entry.command);
    current = recordOfflineReceipt(current, receipt);
    if (receipt.status === "accepted") {
      accepted += 1;
      current = { ...current, entries: current.entries.filter(({ command }) => command.commandId !== receipt.commandId) };
    } else if (receipt.status === "rejected") rejected += 1;
    else if (receipt.status === "needs_reconciliation") reconciliation += 1;
  }
  return { outbox: current, accepted, rejected, reconciliation };
}

function OfflineDraftEditor({ entry, save }: { entry: OfflineCommandV1; save(payload: JsonObject): Promise<void> }) {
  const [error, setError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("draft");
    try {
      const payload: unknown = JSON.parse(String(value));
      if (typeof payload !== "object" || payload === null || Array.isArray(payload)) throw new Error("object required");
      setError("");
      void save(payload as JsonObject);
    } catch {
      setError("Draft data must be a JSON object.");
    }
  };
  return <form className="offline-draft" onSubmit={submit}>
    <label htmlFor={`offline-draft-${entry.command.commandId}`}>Editable local draft</label>
    <textarea id={`offline-draft-${entry.command.commandId}`} name="draft" rows={6}
      defaultValue={JSON.stringify(entry.draftPayload, null, 2)} aria-describedby={`offline-error-${entry.command.commandId}`} />
    <p id={`offline-error-${entry.command.commandId}`} className="field-error">{error}</p>
    <button className="btn-secondary" type="submit">Save draft on this device</button>
  </form>;
}

function OfflineOutboxPanel({ outbox, retry, saveDraft }: {
  outbox: OfflineOutboxV1;
  retry(): void;
  saveDraft(commandId: string, payload: JsonObject): Promise<void>;
}) {
  if (outbox.entries.length === 0) return null;
  const pending = outbox.entries.some(({ status }) => status === "local_pending" || status === "received");
  return <section className="status-panel status-warning offline-outbox" aria-labelledby="offline-outbox-title">
    <div>
      <h2 id="offline-outbox-title">Offline Outbox</h2>
      <p><code>local_pending</code> means saved on this device, not submitted.</p>
    </div>
    <ol className="offline-command-list">
      {outbox.entries.map((entry) => <li key={entry.command.commandId}>
        <div className="card-heading">
          <strong>{entry.command.operationType}</strong>
          <span className="badge badge-state">{entry.status.replaceAll("_", " ")}</span>
        </div>
        {entry.receipt?.message === null || entry.receipt?.message === undefined ? null : <p>{entry.receipt.message}</p>}
        {entry.status === "rejected" || entry.status === "needs_reconciliation"
          ? <OfflineDraftEditor entry={entry} save={(payload) => saveDraft(entry.command.commandId, payload)} />
          : null}
      </li>)}
    </ol>
    {pending ? <button className="btn-secondary" type="button" onClick={retry}>Reconcile with Session Authority</button> : null}
  </section>;
}

type FieldEditorProps = {
  form: RuntimeFormV1;
  initial?: JsonObject;
  disabled: boolean;
  onSubmit(payload: JsonObject): void;
  submitLabel: string;
};

function FieldEditor(props: FieldEditorProps) {
  return props.form.sections.some((section) => section.repeatable === true)
    ? <RepeatableFieldEditor {...props} />
    : <FlatFieldEditor {...props} />;
}

function FlatFieldEditor({ form, initial, disabled, onSubmit, submitLabel }: FieldEditorProps) {
  const idPrefix = useId().replaceAll(":", "");
  const [values, setValues] = useState<Record<string, string | string[] | number>>(() => Object.fromEntries(
    form.fields.map((field) => {
      const value = runtimeFormValue(initial ?? {}, field.key);
      const supported = typeof value === "string" || typeof value === "number" ||
        (Array.isArray(value) && value.every((item) => typeof item === "string"));
      return [field.key, supported ? value : field.type === "multi_select" || field.type === "artifact_reference" ? [] : ""];
    })
  ));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const payload = (): JsonObject => {
    const result: JsonObject = {};
    for (const field of form.fields) {
      const value = values[field.key];
      setRuntimeFormValue(result, field.key, field.type === "number" && value !== "" ? Number(value) : value);
    }
    return result;
  };
  const canonicalForm = (): RuntimeFormDefinitionV1 => ({
    ...form,
    sections: form.sections.map((section) => ({ ...section, fields: section.fields.map((field) => ({
      ...field, id: `${form.id}-${field.key}`, type: field.type === "text" ? "short_text" : field.type
    })) }))
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const content = payload();
    const nextErrors = Object.fromEntries(validateRuntimeFormPayload(canonicalForm(), content).map((issue) => [issue.field, issue.message]));
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSubmit(content);
  };
  return <form onSubmit={submit} noValidate>
    {form.sections.map((section) => <fieldset key={section.id}>
      {section.title === undefined ? null : <legend>{section.title}</legend>}
      {section.fields.filter((field) => runtimeFieldConditionMatches(field.visibleWhen, payload())).map((field) => {
      const id = `${idPrefix}-${form.id}-${field.key}`;
      const error = errors[field.key];
      const required = field.required || (field.requiredWhen !== undefined && runtimeFieldConditionMatches(field.requiredWhen, payload()));
      const describedBy = [field.helpText === undefined ? null : `${id}-help`, error === undefined ? null : `${id}-error`]
        .filter(Boolean).join(" ") || undefined;
      return <div className="field" key={field.key}>
        <label htmlFor={id}>{field.label}{required ? <span aria-hidden="true"> *</span> : null}</label>
        {field.type === "long_text"
          ? <textarea id={id} name={field.key} rows={4} value={typeof values[field.key] === "string" ? values[field.key] : ""} disabled={disabled || field.readOnly === true}
              required={required} aria-invalid={error !== undefined} aria-describedby={describedBy}
              onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} />
          : field.type === "single_select"
            ? <select id={id} name={field.key} value={typeof values[field.key] === "string" ? values[field.key] : ""} disabled={disabled || field.readOnly === true}
                required={required} aria-invalid={error !== undefined} aria-describedby={describedBy}
                onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}>
                <option value="">Select an option</option>
                {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            : field.type === "multi_select" || field.type === "artifact_reference"
              ? <select id={id} name={field.key} multiple value={Array.isArray(values[field.key]) ? values[field.key] : []}
                  disabled={disabled || field.readOnly === true} required={required} aria-invalid={error !== undefined} aria-describedby={describedBy}
                  onChange={(event) => setValues({ ...values, [field.key]: [...event.target.selectedOptions].map((option) => option.value) })}>
                  {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              : <input id={id} name={field.key} type={field.type === "number" ? "number" : "text"}
              value={typeof values[field.key] === "string" || typeof values[field.key] === "number" ? values[field.key] : ""} disabled={disabled || field.readOnly === true}
              required={required} min={field.validation?.min} max={field.validation?.max} minLength={field.validation?.minLength} maxLength={field.validation?.maxLength}
              aria-invalid={error !== undefined} aria-describedby={describedBy}
              onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} />}
        {field.helpText === undefined ? null : <p id={`${id}-help`} className="hint">{field.helpText}</p>}
        {error === undefined ? null : <p id={`${id}-error`} className="field-error" role="alert">Error: {error}</p>}
      </div>;
    })}</fieldset>)}
    <button className="btn-primary" type="submit" disabled={disabled}>{submitLabel}</button>
  </form>;
}

function RepeatableFieldEditor({ form, initial, disabled, onSubmit, submitLabel }: FieldEditorProps) {
  const idPrefix = useId().replaceAll(":", "");
  const blankItem = (section: RuntimeFormV1["sections"][number]): JsonObject => Object.fromEntries(
    section.fields.map((field) => [field.key, field.type === "multi_select" || field.type === "artifact_reference" ? [] : ""])
  ) as JsonObject;
  const [values, setValues] = useState<JsonObject>(() => {
    const result = structuredClone(initial ?? {}) as JsonObject;
    for (const section of form.sections) {
      if (section.repeatable === true) {
        if (!Array.isArray(result[section.id])) result[section.id] = Array.from({ length: section.minItems ?? 0 }, () => blankItem(section));
      } else {
        for (const field of section.fields) {
          if (runtimeFormValue(result, field.key) === undefined) setRuntimeFormValue(result, field.key, field.type === "multi_select" || field.type === "artifact_reference" ? [] : "");
        }
      }
    }
    return result;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setValue = (path: string, value: unknown) => {
    const next = structuredClone(values) as JsonObject;
    setRuntimeFormValue(next, path, value);
    setValues(next);
  };
  const content = (): JsonObject => {
    const result = structuredClone(values) as JsonObject;
    for (const section of form.sections) {
      const entries = section.repeatable === true && Array.isArray(result[section.id])
        ? result[section.id] as JsonObject[] : [result];
      entries.forEach((entry) => section.fields.filter((field) => field.type === "number").forEach((field) => {
        const value = runtimeFormValue(entry, field.key);
        if (value !== "") setRuntimeFormValue(entry, field.key, Number(value));
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
  const renderField = (field: RuntimeFormV1["fields"][number], context: JsonObject, path: string, id: string) => {
    if (!runtimeFieldConditionMatches(field.visibleWhen, context)) return null;
    const value = runtimeFormValue(values, path);
    const error = errors[path];
    const required = field.required || (field.requiredWhen !== undefined && runtimeFieldConditionMatches(field.requiredWhen, context));
    const describedBy = [field.helpText === undefined ? null : `${id}-help`, error === undefined ? null : `${id}-error`].filter(Boolean).join(" ") || undefined;
    const common = { disabled: disabled || field.readOnly === true, required, "aria-invalid": error !== undefined, "aria-describedby": describedBy };
    return <div className="field" key={path}>
      <label htmlFor={id}>{field.label}{required ? <span aria-hidden="true"> *</span> : null}</label>
      {field.type === "long_text" ? <textarea {...common} id={id} name={path} rows={4} value={typeof value === "string" ? value : ""} onChange={(event) => setValue(path, event.target.value)} />
        : field.type === "single_select" ? <select {...common} id={id} name={path} value={typeof value === "string" ? value : ""} onChange={(event) => setValue(path, event.target.value)}>
            <option value="">Select an option</option>{(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        : field.type === "multi_select" || field.type === "artifact_reference" ? <select {...common} id={id} name={path} multiple value={Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []}
            onChange={(event) => setValue(path, [...event.target.selectedOptions].map((option) => option.value))}>
            {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        : <input {...common} id={id} name={path} type={field.type === "number" ? "number" : "text"} value={typeof value === "string" || typeof value === "number" ? value : ""}
            min={field.validation?.min} max={field.validation?.max} minLength={field.validation?.minLength} maxLength={field.validation?.maxLength}
            onChange={(event) => setValue(path, event.target.value)} />}
      {field.helpText === undefined ? null : <p id={`${id}-help`} className="hint">{field.helpText}</p>}
      {error === undefined ? null : <p id={`${id}-error`} className="field-error" role="alert">Error: {error}</p>}
    </div>;
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = content();
    const nextErrors = Object.fromEntries(validateRuntimeFormPayload(canonicalForm(), payload).map((issue) => [issue.field, issue.message]));
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSubmit(payload);
  };
  return <form onSubmit={submit} noValidate>
    {form.sections.map((section) => section.repeatable === true ? <fieldset key={section.id}>
      {section.title === undefined ? null : <legend>{section.title}</legend>}
      {section.description === undefined ? null : <p className="hint">{section.description}</p>}
      {(Array.isArray(values[section.id]) ? values[section.id] as JsonObject[] : []).map((entry, index) => <fieldset className="repeatable-item" key={index}>
        <legend>{section.itemLabel ?? "Item"} {index + 1}</legend>
        {section.fields.map((field) => renderField(field, entry, `${section.id}.${index}.${field.key}`, `${idPrefix}-${form.id}-${section.id}-${index}-${field.key.replaceAll(".", "-")}`))}
        <button className="btn-secondary" type="button" disabled={disabled || (values[section.id] as JsonObject[]).length <= (section.minItems ?? 0)} onClick={() => {
          const entries = [...(values[section.id] as JsonObject[])]; entries.splice(index, 1); setValues({ ...values, [section.id]: entries });
        }}>Remove {section.itemLabel ?? "item"}</button>
      </fieldset>)}
      <button className="btn-secondary" type="button" disabled={disabled || (section.maxItems !== undefined && (values[section.id] as JsonObject[]).length >= section.maxItems)} onClick={() => {
        setValues({ ...values, [section.id]: [...(values[section.id] as JsonObject[]), blankItem(section)] });
      }}>Add {section.itemLabel ?? "item"}</button>
      {errors[section.id] === undefined ? null : <p className="field-error" role="alert">Error: {errors[section.id]}</p>}
    </fieldset> : <fieldset key={section.id}>
      {section.title === undefined ? null : <legend>{section.title}</legend>}
      {section.description === undefined ? null : <p className="hint">{section.description}</p>}
      {section.fields.map((field) => renderField(field, values, field.key, `${idPrefix}-${form.id}-${field.key.replaceAll(".", "-")}`))}
    </fieldset>)}
    <button className="btn-primary" type="submit" disabled={disabled}>{submitLabel}</button>
  </form>;
}

function CreateTask({ task, disabled, send }: {
  task: RuntimeCreateTaskV1; disabled: boolean;
  send(action: RuntimeActionV1, artifact: RuntimeArtifactV1 | null, content?: JsonObject, artifactTypeKey?: string): void;
}) {
  return <section className="card" aria-labelledby={`create-${task.artifactTypeKey}`}>
    <p className="eyebrow">New Artifact</p>
    <h2 id={`create-${task.artifactTypeKey}`}>{task.title}</h2>
    <FieldEditor form={task.form} disabled={disabled} submitLabel="Save draft"
      onSubmit={(content) => send(task.action, null, content, task.artifactTypeKey)} />
  </section>;
}

function DisplayFields({ fields, payload }: { fields: RuntimeFormV1["fields"]; payload: JsonObject }) {
  return <dl className="artifact-content">{fields.map((field) => {
    const value = runtimeFormValue(payload, field.key);
    const display = Array.isArray(value) ? value.join(", ") : String(value ?? "Not provided");
    return <div key={field.key}><dt>{field.label}</dt><dd>{display || "Not provided"}</dd></div>;
  })}</dl>;
}

function ArtifactContent({ form, payload }: { form: RuntimeFormV1; payload: JsonObject }) {
  return <div className="artifact-sections">{form.sections.map((section) => {
    if (section.repeatable !== true) return <DisplayFields key={section.id} fields={section.fields} payload={payload} />;
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

function ArtifactCard({ artifact, disabled, send }: {
  artifact: RuntimeArtifactV1; disabled: boolean;
  send(action: RuntimeActionV1, artifact: RuntimeArtifactV1, content?: JsonObject): void;
}) {
  const edit = artifact.actions.find((action) => action.requiresForm);
  const actions = artifact.actions.filter((action) => !action.requiresForm);
  const { rules: _rules, ...formWithoutRules } = artifact.form;
  const editForm = edit?.editableFieldKeys === undefined ? artifact.form : {
    ...formWithoutRules,
    fields: artifact.form.fields.filter((field) => edit.editableFieldKeys?.includes(field.key)),
    sections: artifact.form.sections.map((section) => ({
      ...section, fields: section.fields.filter((field) => edit.editableFieldKeys?.includes(field.key))
    })).filter((section) => section.fields.length > 0)
  };
  return <article className="card artifact" aria-labelledby={`artifact-${artifact.id}`}>
    <div className="card-heading">
      <div>
        <p className="eyebrow">{artifact.createdByMe ? "Your Artifact" : "Assigned task"}</p>
        <h3 id={`artifact-${artifact.id}`}>{artifact.title}</h3>
      </div>
      <span className="badge badge-state">{artifact.stateLabel}</span>
    </div>
    <dl className="metadata"><div><dt>Version</dt><dd>{artifact.version}</dd></div><div><dt>Form</dt><dd>{artifact.form.formVersion}</dd></div></dl>
    {edit === undefined ? <ArtifactContent form={artifact.form} payload={artifact.payload} />
      : <FieldEditor form={editForm} initial={artifact.payload} disabled={disabled} submitLabel={edit.label}
          onSubmit={(content) => send(edit, artifact, content)} />}
    {actions.length === 0 ? null : <div className="actions" aria-label={`${artifact.title} workflow actions`}>
      {actions.map((action, index) => <button key={action.operationType}
        className={index === 0 ? "btn-primary" : "btn-secondary"} type="button" disabled={disabled}
        onClick={() => send(action, artifact)}>{action.label}</button>)}
    </div>}
  </article>;
}

type SendInformation = (operationType: string, aggregateId: string, expectedVersion: number, payload: JsonObject) => void;

function EffectProposalReview({ proposals, disabled, decide }: {
  proposals: EffectProposalV1[];
  disabled: boolean;
  decide(proposal: EffectProposalV1, decision: "approve" | "reject" | "return", reason: string): void;
}) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  if (proposals.length === 0) return null;
  return <section aria-labelledby="effect-proposals-title">
    <div className="section-heading"><p className="eyebrow">Human approval required</p><h2 id="effect-proposals-title">Effect Proposals</h2></div>
    <p className="hint">Plugin output is staged only. Authoritative state changes only after an approved Command receives a server receipt.</p>
    <div className="card-grid">{proposals.map((proposal) => {
      const reason = reasons[proposal.id] ?? "";
      return <article className="card effect-proposal" key={proposal.id} aria-labelledby={`effect-${proposal.id}`}>
        <div className="card-heading"><h3 id={`effect-${proposal.id}`}>{proposal.targetStateVariableId.replaceAll("_", " ")}</h3>
          <span className="badge badge-state">{proposal.status.replaceAll("_", " ")}</span></div>
        <dl className="metadata"><div><dt>Operation</dt><dd>{proposal.operation}</dd></div><div><dt>Proposed value</dt><dd><code>{JSON.stringify(proposal.value)}</code></dd></div></dl>
        <p>{proposal.rationale}</p>
        <details><summary>Provenance</summary><dl className="proposal-provenance">
          <div><dt>Plugin digest</dt><dd><code>{proposal.pluginDigest}</code></dd></div>
          <div><dt>Input digest</dt><dd><code>{proposal.inputDigest}</code></dd></div>
          <div><dt>Proposal hash</dt><dd><code>{proposal.proposalHash}</code></dd></div>
        </dl></details>
        {proposal.status !== "in_review" ? null : <>
          <div className="field"><label htmlFor={`reason-${proposal.id}`}>Decision reason</label>
            <textarea id={`reason-${proposal.id}`} value={reason} maxLength={2000} disabled={disabled}
              onChange={(event) => setReasons((current) => ({ ...current, [proposal.id]: event.target.value }))} />
            <p className="hint">Required for approve, reject, or return.</p></div>
          <div className="actions" aria-label={`Decision for ${proposal.targetStateVariableId}`}>
            <button className="btn-primary" type="button" disabled={disabled || reason.trim().length === 0} onClick={() => decide(proposal, "approve", reason.trim())}>Approve effect</button>
            <button className="btn-secondary" type="button" disabled={disabled || reason.trim().length === 0} onClick={() => decide(proposal, "return", reason.trim())}>Return for review</button>
            <button className="btn-secondary" type="button" disabled={disabled || reason.trim().length === 0} onClick={() => decide(proposal, "reject", reason.trim())}>Reject effect</button>
          </div>
        </>}
      </article>;
    })}</div>
  </section>;
}

function messageSummary(message: RuntimeMessageV1): string {
  for (const key of ["text", "body", "title"]) {
    const value = message.content[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return message.operationType.replaceAll("_", " ").replace("message.", "");
}

function MessageInbox({ module, projection, disabled, send }: {
  module: RuntimeModuleV1; projection: RuntimeProjectionV1; disabled: boolean; send: SendInformation;
}) {
  const [text, setText] = useState("");
  const channelIds = Array.isArray(module.configuration.channelIds)
    ? module.configuration.channelIds.filter((id): id is string => typeof id === "string") : [];
  const routeId = typeof module.configuration.sendRouteId === "string" ? module.configuration.sendRouteId : null;
  const messages = projection.messages.filter((message) => channelIds.includes(message.channelId));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (routeId === null || value.length === 0) return;
    send("message.send", crypto.randomUUID(), 0, { routeId, content: { text: value } });
    setText("");
  };
  return <section aria-labelledby={`${module.id}-heading`}>
    <div className="section-heading"><p className="eyebrow">Configured module</p><h2 id={`${module.id}-heading`}>{module.title}</h2></div>
    {module.mode !== "write" || routeId === null ? null : <form className="card" onSubmit={submit}>
      <div className="field"><label htmlFor={`${module.id}-text`}>Message</label>
        <textarea id={`${module.id}-text`} rows={3} required value={text} disabled={disabled}
          onChange={(event) => setText(event.target.value)} /></div>
      <button className="btn-primary" type="submit" disabled={disabled || text.trim().length === 0}>Send Message</button>
    </form>}
    {messages.length === 0 ? <p className="empty-state">{module.emptyStateText}</p> : <ol className="event-list">
      {messages.map((message) => <li key={message.id}><span>{messageSummary(message)}</span>
        <time dateTime={message.sentAt}>{new Date(message.sentAt).toLocaleString()}</time></li>)}
    </ol>}
  </section>;
}

function InjectCard({ inject, disabled, send }: { inject: RuntimeInjectV1; disabled: boolean; send: SendInformation }) {
  const [artifactId, setArtifactId] = useState("");
  const body = typeof inject.content.body === "string" ? inject.content.body : "No details were provided.";
  return <article className="card" aria-labelledby={`inject-${inject.id}`}>
    <div className="card-heading"><h3 id={`inject-${inject.id}`}>{inject.title}</h3><span className="badge badge-state">{inject.state}</span></div>
    <p>{body}</p>
    {inject.acknowledgedAt === null ? <button className="btn-primary" type="button" disabled={disabled}
      onClick={() => send("inject.acknowledge", inject.id, inject.version, {})}>Acknowledge</button> : null}
    {inject.requiredResponseArtifactTypeId === null || inject.acknowledgedAt === null || inject.respondedAt !== null ? null : <form onSubmit={(event) => {
      event.preventDefault();
      if (artifactId.trim().length > 0) send("inject.respond", inject.id, inject.version, { artifactId: artifactId.trim() });
    }}>
      <div className="field"><label htmlFor={`inject-${inject.id}-artifact`}>Response Artifact ID</label>
        <input id={`inject-${inject.id}-artifact`} required value={artifactId} disabled={disabled}
          onChange={(event) => setArtifactId(event.target.value)} /></div>
      <button className="btn-primary" type="submit" disabled={disabled || artifactId.trim().length === 0}>Submit response</button>
    </form>}
  </article>;
}

function InjectInbox({ module, projection, disabled, send }: {
  module: RuntimeModuleV1; projection: RuntimeProjectionV1; disabled: boolean; send: SendInformation;
}) {
  return <section aria-labelledby={`${module.id}-heading`}>
    <div className="section-heading"><p className="eyebrow">Configured module</p><h2 id={`${module.id}-heading`}>{module.title}</h2></div>
    {projection.injects.length === 0 ? <p className="empty-state">{module.emptyStateText}</p> : <div className="card-grid">
      {projection.injects.map((inject) => <InjectCard key={inject.id} inject={inject} disabled={disabled} send={send} />)}
    </div>}
  </section>;
}

function ProposalThreadCard({ messages, projection, disabled, send }: {
  messages: RuntimeMessageV1[]; projection: RuntimeProjectionV1; disabled: boolean; send: SendInformation;
}) {
  const [text, setText] = useState("");
  const latest = messages.at(-1);
  if (latest?.threadId === null || latest === undefined) return null;
  const sourceTeam = typeof latest.content.sourceTeam === "string" ? latest.content.sourceTeam : null;
  const recipientTeam = typeof latest.content.recipientTeam === "string" ? latest.content.recipientTeam : null;
  const side = projection.activeTeamId === sourceTeam ? "source" : projection.activeTeamId === recipientTeam ? "recipient" : null;
  const version = latest.threadVersion ?? 0;
  const submitText = (operationType: string) => {
    const value = text.trim();
    if (value.length === 0) return;
    send(operationType, latest.threadId!, version, { content: { text: value } });
    setText("");
  };
  return <article className="card" aria-labelledby={`thread-${latest.threadId}`}>
    <div className="card-heading"><h3 id={`thread-${latest.threadId}`}>{sourceTeam ?? "Source"} to {recipientTeam ?? "recipient"}</h3>
      <span className="badge badge-state">{latest.threadState ?? "open"}</span></div>
    <ol className="event-list">{messages.map((message) => <li key={message.id}>
      <span>{messageSummary(message)}{message.approvedAt === null ? " (awaiting Control approval)" : ""}</span>
      <time dateTime={message.sentAt}>{new Date(message.sentAt).toLocaleString()}</time>
    </li>)}</ol>
    {side === null || latest.threadState === "closed" ? null : <>
      {latest.threadState === "open" ? <div className="field"><label htmlFor={`thread-${latest.threadId}-text`}>Negotiation message</label>
        <textarea id={`thread-${latest.threadId}-text`} rows={3} value={text} disabled={disabled}
          onChange={(event) => setText(event.target.value)} /></div> : null}
      <div className="actions">
        {side === "recipient" && latest.threadState === "open" ? <>
          <button className="btn-primary" type="button" disabled={disabled} onClick={() => send("message.proposal_accept", latest.threadId!, version, { content: {} })}>Accept</button>
          <button className="btn-secondary" type="button" disabled={disabled} onClick={() => send("message.proposal_reject", latest.threadId!, version, { content: {} })}>Not Interested</button>
          <button className="btn-secondary" type="button" disabled={disabled || text.trim().length === 0} onClick={() => submitText("message.proposal_negotiate")}>Negotiate</button>
        </> : null}
        {side === "source" && latest.threadState === "open" ? <button className="btn-primary" type="button" disabled={disabled || text.trim().length === 0}
          onClick={() => submitText("message.proposal_reply")}>Reply with next round</button> : null}
        <button className="btn-secondary" type="button" disabled={disabled}
          onClick={() => send(`message.proposal_close_${side}`, latest.threadId!, version, { content: {} })}>Close thread</button>
      </div>
    </>}
  </article>;
}

function ProposalThreads({ module, projection, disabled, send }: {
  module: RuntimeModuleV1; projection: RuntimeProjectionV1; disabled: boolean; send: SendInformation;
}) {
  const channelId = typeof module.configuration.channelId === "string" ? module.configuration.channelId : "";
  const actorMode = module.configuration.actorMode;
  const messages = projection.messages.filter((message) => message.channelId === channelId && message.threadId !== null);
  const threads = [...new Set(messages.map(({ threadId }) => threadId!))].map((threadId) =>
    messages.filter((message) => message.threadId === threadId));
  const openable = actorMode === "custodian" ? projection.artifacts.flatMap((artifact) => {
    if (artifact.state !== "recipient_threads") return [];
    const teams = Array.isArray(artifact.payload.recipientTeams)
      ? artifact.payload.recipientTeams.filter((team): team is string => typeof team === "string") : [];
    return teams.filter((team) => !messages.some((message) => message.content.sourceArtifactId === artifact.id && message.content.recipientTeam === team))
      .map((team) => ({ artifact, team }));
  }) : [];
  const pending = actorMode === "custodian" ? messages.filter((message) => message.approvedAt === null) : [];
  return <section aria-labelledby={`${module.id}-heading`}>
    <div className="section-heading"><p className="eyebrow">Configured module</p><h2 id={`${module.id}-heading`}>{module.title}</h2></div>
    {openable.length === 0 ? null : <div className="card"><h3>Open approved recipient threads</h3><div className="actions">
      {openable.map(({ artifact, team }) => <button key={`${artifact.id}-${team}`} className="btn-secondary" type="button" disabled={disabled}
        onClick={() => send("message.proposal_forward", crypto.randomUUID(), 0, { sourceArtifactId: artifact.id, recipientTeamId: team })}>
        {artifact.title}: forward to {team}</button>)}
    </div></div>}
    {pending.length === 0 ? null : <div className="card"><h3>Rounds awaiting approval</h3><div className="actions">
      {pending.map((message) => <button key={message.id} className="btn-primary" type="button" disabled={disabled}
        onClick={() => send("message.proposal_approve_round", message.threadId!, message.threadVersion ?? 0, { messageId: message.id })}>
        Approve {messageSummary(message)}</button>)}
    </div></div>}
    {threads.length === 0 ? <p className="empty-state">{module.emptyStateText}</p> : <div className="card-grid">
      {threads.map((thread) => <ProposalThreadCard key={thread[0]?.threadId} messages={thread} projection={projection} disabled={disabled} send={send} />)}
    </div>}
  </section>;
}

type SendPoll = (operationType: string, poll: RuntimePollV1, payload: JsonObject) => void;

function PollCard({ poll, disabled, send }: { poll: RuntimePollV1; disabled: boolean; send: SendPoll }) {
  const [selected, setSelected] = useState<string[]>([]);
  const multiple = poll.pollType === "multiple_choice";
  const choose = (optionId: string, checked: boolean) => setSelected(multiple
    ? checked ? [...selected, optionId] : selected.filter((id) => id !== optionId)
    : [optionId]);
  const valid = multiple ? selected.length >= Number(poll.minSelections) && selected.length <= Number(poll.maxSelections) : selected.length === 1;
  const result = poll.tally;
  return <article className="card poll-card" aria-labelledby={`poll-${poll.id}`}>
    <div className="card-heading"><h3 id={`poll-${poll.id}`}>{poll.question}</h3><span className="badge badge-state">{poll.status}</span></div>
    {poll.deadlineAt === null ? null : <p className="hint">Ballots close <time dateTime={poll.deadlineAt}>{new Date(poll.deadlineAt).toLocaleString()}</time>.</p>}
    {poll.status === "open" && poll.eligible && !poll.hasVoted ? <form onSubmit={(event) => {
      event.preventDefault();
      if (valid && poll.ballotCapability !== null) send("ballot.cast", poll, {
        pollDefinitionRevision: poll.definitionRevision, ballotCapability: poll.ballotCapability, optionIds: selected
      });
    }}>
      <fieldset disabled={disabled}><legend>{multiple ? `Choose ${poll.minSelections} to ${poll.maxSelections} options` : "Choose one option"}</legend>
        {poll.options.map((option) => <label className="choice" key={option.id}>
          <input type={multiple ? "checkbox" : "radio"} name={`poll-${poll.id}`} value={option.id}
            checked={selected.includes(option.id)} onChange={(event) => choose(option.id, event.target.checked)} />
          <span>{option.label}</span>
        </label>)}
      </fieldset>
      <button className="btn-primary" type="submit" disabled={disabled || !valid}>Cast Ballot</button>
    </form> : null}
    {poll.hasVoted && poll.receipt !== null ? <p className="status-success" role="status">Ballot accepted at <time dateTime={poll.receipt.acceptedAt}>{new Date(poll.receipt.acceptedAt).toLocaleString()}</time>. Receipt revision {poll.receipt.ballotRevision}.</p> : null}
    {!poll.eligible && poll.status === "open" ? <p className="hint">Your active Seat Assignment is not in this Electorate.</p> : null}
    {result === null ? null : <section aria-labelledby={`poll-${poll.id}-result`}><h4 id={`poll-${poll.id}-result`}>{poll.certification === null ? "Unofficial tally" : "Certified result"}</h4>
      <dl className="poll-results">{poll.options.map((option) => <div key={option.id}><dt>{option.label}</dt><dd>{result.counts[option.id] ?? 0}</dd></div>)}</dl>
      <p>{result.quorumMet ? "Quorum met" : "Quorum not met"} · {result.passed ? "Passed" : "Not passed"}</p>
      {poll.certification === null ? null : <p className="hint">Certified {new Date(poll.certification.certifiedAt).toLocaleString()} · result <code>{poll.certification.resultSha256.slice(0, 12)}</code></p>}
    </section>}
    {!poll.canManage || !["open", "closed", "tallied"].includes(poll.status) ? null : <div className="actions" role="group" aria-label="Poll management">
      {poll.status === "open" ? <button className="btn-secondary" type="button" disabled={disabled} onClick={() => send("poll.close", poll, {})}>Close Poll</button> : null}
      {poll.status === "closed" ? <button className="btn-secondary" type="button" disabled={disabled} onClick={() => send("poll.tally", poll, {})}>Compute Tally</button> : null}
      {poll.status === "tallied" && result !== null ? <button className="btn-primary" type="button" disabled={disabled} onClick={() => send("poll.certify", poll, { resultSha256: result.resultSha256 })}>Certify result</button> : null}
    </div>}
  </article>;
}

function RuntimeView() {
  const id = sessionId();
  const [connection, setConnection] = useState<ConnectionState>("loading");
  const [deviceId, setDeviceId] = useState<string | null>(() => localStorage.getItem(DEVICE_STORAGE_KEY));
  const [bootstrap, setBootstrap] = useState<SyncBootstrapV1 | null>(null);
  const [outbox, setOutbox] = useState<OfflineOutboxV1 | null>(null);
  const [projection, setProjection] = useState<RuntimeProjectionV1 | null>(null);
  const [effectProposals, setEffectProposals] = useState<EffectProposalV1[]>([]);
  const [adjudications, setAdjudications] = useState<AdjudicationRequestV1[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>("");
  const main = useRef<HTMLElement>(null);
  const loadVersion = useRef(0);
  const pending = outbox?.entries.some(({ status }) => status === "local_pending" || status === "received") === true;
  const submitting = connection === "online" && pending;

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    if (id === null) { setConnection("error"); setError("A Session link is required."); return; }
    setConnection((current) => current === "online" ? current : "loading");
    setError(null);
    try {
      const registered = deviceId === null ? await api<{ deviceId: string }>("/v1/devices", { method: "POST", body: "{}" }) : { deviceId };
      if (version !== loadVersion.current) return;
      setDeviceId(registered.deviceId);
      localStorage.setItem(DEVICE_STORAGE_KEY, registered.deviceId);
      const headers = { "x-device-id": registered.deviceId };
      const [nextBootstrap, initialProjection, proposalResponse, adjudicationResponse] = await Promise.all([
        api<SyncBootstrapV1>(`/v1/sessions/${id}/sync/bootstrap`, { headers }),
        api<RuntimeProjectionV1>(`/v1/sessions/${id}/runtime-projection`, { headers }),
        api<{ proposals: EffectProposalV1[] }>(`/v1/sessions/${id}/effect-proposals`, { headers }),
        api<{ adjudications: AdjudicationRequestV1[] }>(`/v1/sessions/${id}/adjudications`, { headers })
      ]);
      if (version !== loadVersion.current) return;
      const previous = await offlineStore.load(id, registered.deviceId);
      const sameScope = previous !== null &&
        previous.bootstrap.participantId === nextBootstrap.participantId &&
        previous.bootstrap.activeSessionRoleId === nextBootstrap.activeSessionRoleId;
      let nextOutbox = sameScope ? {
        ...previous.outbox,
        authorityEpoch: nextBootstrap.authorityEpoch,
        accessRevision: nextBootstrap.accessRevision,
        credentialExpiresAt: nextBootstrap.credentialExpiresAt
      } : createOfflineOutbox(nextBootstrap);
      let nextProjection = initialProjection;
      const unresolved = nextOutbox.entries.some(({ status }) => status === "local_pending" || status === "received");
      if (unresolved) {
        const reconciled = await reconcileOfflineOutbox(id, nextOutbox);
        nextOutbox = reconciled.outbox;
        if (reconciled.accepted > 0) {
          nextProjection = await api<RuntimeProjectionV1>(`/v1/sessions/${id}/runtime-projection`, { headers });
        }
        const outcomes = [
          reconciled.accepted === 0 ? "" : `${reconciled.accepted} accepted`,
          reconciled.rejected === 0 ? "" : `${reconciled.rejected} rejected`,
          reconciled.reconciliation === 0 ? "" : `${reconciled.reconciliation} need reconciliation`
        ].filter(Boolean).join(", ");
        if (outcomes.length > 0) setNotice(`Reconnect complete: ${outcomes}.`);
      }
      await offlineStore.save({
        bootstrap: nextBootstrap,
        projection: minimizeOfflineProjection(nextProjection),
        outbox: nextOutbox
      });
      if (version !== loadVersion.current) return;
      setBootstrap(nextBootstrap);
      setOutbox(nextOutbox);
      setProjection(nextProjection);
      setEffectProposals(proposalResponse.proposals);
      setAdjudications(adjudicationResponse.adjudications);
      setConnection("online");
    } catch (cause) {
      if (version !== loadVersion.current) return;
      if (cause instanceof ApiError && clearsOfflineData(cause) && deviceId !== null) {
        await offlineStore.clear(id, deviceId);
        setBootstrap(null);
        setOutbox(null);
        setProjection(null);
        if (cause.envelope.error.code === "DEVICE_NOT_REGISTERED") {
          localStorage.removeItem(DEVICE_STORAGE_KEY);
          setDeviceId(null);
        }
        setConnection("error");
        setError(`${cause.message} Protected offline data was cleared.`);
        return;
      }
      if (deviceId !== null) {
        let cached: Awaited<ReturnType<typeof offlineStore.load>>;
        try {
          cached = await offlineStore.load(id, deviceId);
        } catch (storageError) {
          setConnection("error");
          setError(storageError instanceof Error ? storageError.message : "Protected offline data could not be read.");
          return;
        }
        if (cached !== null && Date.parse(cached.bootstrap.credentialExpiresAt) <= Date.now()) {
          await offlineStore.save({ ...cached, projection: null });
          setBootstrap(cached.bootstrap);
          setOutbox(cached.outbox);
          setProjection(null);
          setConnection("error");
          setError("The offline credential expired. Local drafts were retained, but cached Session data and submission are unavailable until re-authentication.");
          return;
        }
        if (cached !== null && cached.projection !== null && !(cause instanceof ApiError && cause.envelope.error.code === "AUTH_EXPIRED")) {
          setBootstrap(cached.bootstrap);
          setOutbox(cached.outbox);
          setProjection(cached.projection);
          setEffectProposals([]);
          setAdjudications([]);
          setConnection("offline");
          setNotice("Using the protected offline view. Local pending work is not submitted.");
          return;
        }
        if (cached !== null) setOutbox(cached.outbox);
      }
      setConnection(navigator.onLine ? "error" : "offline");
      setError(cause instanceof Error ? cause.message : "The Runtime could not be loaded.");
    }
  }, [deviceId, id]);

  useEffect(() => { void load(); }, []); // Initial load owns device registration.
  useEffect(() => {
    const offline = () => setConnection("offline");
    const online = () => { setNotice("Connection restored. Refreshing authoritative state."); void load(); };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => { window.removeEventListener("offline", offline); window.removeEventListener("online", online); };
  }, [load]);

  const post = async (command: CommandEnvelopeV1): Promise<CommandReceiptV1 | null> => {
    if (id === null || bootstrap === null || outbox === null || projection === null) return null;
    const queueable = canQueueOffline(command, bootstrap);
    if (!queueable && !navigator.onLine) {
      setConnection("offline");
      setNotice("This operation requires the live Session Authority and was not queued.");
      return null;
    }
    let storedOutbox = outbox;
    if (queueable) {
      storedOutbox = enqueueOfflineCommand(outbox, command, new Date().toISOString());
      try {
        await offlineStore.save({ bootstrap, projection: minimizeOfflineProjection(projection), outbox: storedOutbox });
      } catch (cause) {
        setNotice(cause instanceof Error
          ? `The Command was not queued because protected device storage failed: ${cause.message}`
          : "The Command was not queued because protected device storage failed.");
        return null;
      }
      setOutbox(storedOutbox);
      setNotice("Saved on this device as local pending. It has not been submitted.");
      if (!navigator.onLine) { setConnection("offline"); return null; }
    } else setNotice("Submitting a live-only operation. It will not enter the Offline Outbox.");
    try {
      const response = await fetch(`/v1/sessions/${id}/commands`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command)
      });
      const body: unknown = await response.json();
      if (!isCommandReceipt(body)) {
        if (typeof body === "object" && body !== null && "error" in body) {
          throw new ApiError(response.status, body as ErrorEnvelopeV1);
        }
        throw new Error(`Command returned an invalid response with status ${response.status}`);
      }
      if (queueable) {
        let resolved = recordOfflineReceipt(storedOutbox, body);
        if (body.status === "accepted") {
          resolved = { ...resolved, entries: resolved.entries.filter(({ command: queued }) => queued.commandId !== body.commandId) };
        }
        await offlineStore.save({ bootstrap, projection: minimizeOfflineProjection(projection), outbox: resolved });
        setOutbox(resolved);
      }
      if (body.status === "accepted") setNotice(body.replayed ? "The original server receipt was recovered." : "The server accepted the Command.");
      else setNotice(body.status === "needs_reconciliation"
        ? `Authoritative state changed: ${body.message ?? body.errorCode}. Your local draft was kept.`
        : `Command refused: ${body.message ?? body.errorCode}. Your local draft was kept.`);
      await load();
      requestAnimationFrame(() => main.current?.focus());
      return body;
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (clearsOfflineData(cause)) {
          await offlineStore.clear(id, bootstrap.deviceId);
          setBootstrap(null);
          setOutbox(null);
          setProjection(null);
        }
        setConnection("error");
        setNotice(`Command failed: ${cause.message}`);
        return null;
      }
      setConnection(navigator.onLine ? "error" : "offline");
      setNotice(queueable ? "Delivery acknowledgement was lost. This Command is still local pending, not accepted."
        : "The live-only operation failed without acknowledgement and was not queued.");
      return null;
    }
  };

  const send = (action: RuntimeActionV1, artifact: RuntimeArtifactV1 | null, content?: JsonObject, artifactTypeKey?: string) => {
    if (projection === null || deviceId === null) return;
    const command: CommandEnvelopeV1 = {
      commandId: crypto.randomUUID(),
      deviceId,
      operationType: action.operationType,
      aggregateId: artifact?.id ?? crypto.randomUUID(),
      expectedAggregateVersion: artifact?.version ?? 0,
      governingReleaseId: artifact?.governingReleaseId ?? projection.releaseId,
      activeSessionRoleId: projection.activeSessionRoleId,
      deviceObservedAt: new Date().toISOString(),
      payload: {
        ...(artifactTypeKey === undefined ? {} : { artifactTypeKey }),
        ...(content === undefined ? {} : { content })
      }
    };
    void post(command);
  };

  const sendInformation: SendInformation = (operationType, aggregateId, expectedAggregateVersion, payload) => {
    if (projection === null || deviceId === null) return;
    const publication = operationType === "adjudication.publish";
    if (publication && !navigator.onLine) {
      setConnection("offline");
      setNotice("Adjudication publication requires the live Session Authority and was not queued.");
      return;
    }
    void post({
      commandId: crypto.randomUUID(), deviceId, operationType, aggregateId, expectedAggregateVersion,
      governingReleaseId: projection.releaseId, activeSessionRoleId: projection.activeSessionRoleId,
      deviceObservedAt: new Date().toISOString(), payload
    });
  };

  const sendPoll: SendPoll = (operationType, poll, payload) => {
    if (projection === null || deviceId === null) return;
    if (operationType.startsWith("poll.") && !navigator.onLine) {
      setConnection("offline");
      setNotice("Poll management requires the live Session Authority and was not queued.");
      return;
    }
    void post({ commandId: crypto.randomUUID(), deviceId, operationType, aggregateId: poll.id,
      expectedAggregateVersion: poll.version, governingReleaseId: poll.governingReleaseId,
      activeSessionRoleId: projection.activeSessionRoleId, deviceObservedAt: new Date().toISOString(), payload });
  };

  const sendVoice = async (channel: RuntimeVoiceChannelV1, operationType: string,
    payload: JsonObject = {}): Promise<CommandReceiptV1 | null> => {
    if (projection === null || deviceId === null || !navigator.onLine) {
      setConnection("offline"); setNotice("Voice needs the live Session Authority and was not queued."); return null;
    }
    const receipt = await post({ commandId: crypto.randomUUID(), deviceId, operationType,
      aggregateId: channel.id, expectedAggregateVersion: channel.version, governingReleaseId: channel.governingReleaseId,
      activeSessionRoleId: projection.activeSessionRoleId, deviceObservedAt: new Date().toISOString(), payload });
    return receipt;
  };

  const sendFloor = async (channel: RuntimeVoiceChannelV1, action: "request" | "renew" | "release",
    body: Record<string, unknown>): Promise<FloorLeaseV1> => {
    if (id === null || deviceId === null || !navigator.onLine) throw new Error("Floor operations require a live connection");
    const path = action === "request" ? "floor-requests" : `floor-requests/${String(body.requestId)}/${action}`;
    const requestBody = action === "request" ? body : { ...body, requestId: undefined };
    return api<FloorLeaseV1>(`/v1/sessions/${id}/voice-channels/${channel.id}/${path}`,
      { method: "POST", headers: { "x-device-id": deviceId }, body: JSON.stringify(requestBody) });
  };

  const decideEffect = async (proposal: EffectProposalV1, decision: "approve" | "reject" | "return", reason: string) => {
    if (id === null || projection === null || deviceId === null) return;
    if (!navigator.onLine) { setConnection("offline"); setNotice("Approval Decisions require a live Session Authority and were not queued."); return; }
    setNotice("Submitting the Approval Decision to the Session Authority.");
    try {
      const response = await fetch(`/v1/sessions/${id}/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        commandId: crypto.randomUUID(), deviceId, operationType: `effect_proposal.${decision}`, aggregateId: proposal.id,
        expectedAggregateVersion: proposal.version, governingReleaseId: proposal.governingReleaseId,
        activeSessionRoleId: projection.activeSessionRoleId, deviceObservedAt: new Date().toISOString(),
        payload: { proposalHash: proposal.proposalHash, reason }
      } satisfies CommandEnvelopeV1) });
      const receipt: unknown = await response.json();
      if (!isCommandReceipt(receipt)) throw new Error(`Approval Decision returned an invalid response with status ${response.status}`);
      setNotice(receipt.status === "accepted" ? "The server accepted the Command." : receipt.message ?? "The Approval Decision was not accepted.");
      await load();
    } catch (cause) {
      setNotice(cause instanceof Error ? `Approval Decision was not queued: ${cause.message}` : "Approval Decision was not queued.");
      await load();
    }
  };

  const retryPending = async () => {
    setNotice("Checking original receipts before ordered reconnect.");
    await load();
  };

  const saveOfflineDraft = async (commandId: string, payload: JsonObject) => {
    if (bootstrap === null || projection === null || outbox === null) return;
    const updated = updateOfflineDraft(outbox, commandId, payload);
    await offlineStore.save({ bootstrap, projection: minimizeOfflineProjection(projection), outbox: updated });
    setOutbox(updated);
    setNotice("The revised draft is saved on this device. It has not been submitted.");
  };

  if (projection === null) {
    return <StatePage connection={connection} title={connection === "loading" ? "Loading Runtime" : connection === "offline" ? "Runtime offline" : "Runtime unavailable"}
      message={connection === "loading" ? "Resolving your authorized Session view." : error ?? "Reconnect and try again."}
      {...(connection === "loading" ? {} : { retry: () => void load() })} />;
  }
  const taskModule = projection.modules.find((module) => module.type === "task_list");
  const formModule = projection.modules.find((module) => module.type === "artifact_form");
  const messageModules = projection.modules.filter((module) => module.type === "message_inbox");
  const proposalModules = projection.modules.filter((module) => module.type === "proposal_thread");
  const injectModules = projection.modules.filter((module) => module.type === "inject_inbox");
  return <Shell connection={connection}>
    <main id="main-content" className={`runtime-layout layout-${projection.layout}`} ref={main} tabIndex={-1}>
      <section className="hero" aria-labelledby="runtime-title">
        <p className="eyebrow">{projection.releaseLabel}</p>
        <h1 id="runtime-title">{projection.activeTeamLabel === null ? projection.activeSessionRoleLabel : `${projection.activeTeamLabel} ${projection.activeSessionRoleLabel}`} workspace</h1>
        <p>{projection.currentStageLabel ?? "Session workspace"} · Session {projection.sessionStatus}</p>
      </section>
      <div className="live-region" aria-live="polite" aria-atomic="true">{notice}</div>
      {outbox === null ? null : <OfflineOutboxPanel outbox={outbox} retry={() => void retryPending()} saveDraft={saveOfflineDraft} />}
      {formModule === undefined ? null : <section aria-labelledby="create-heading">
        <div className="section-heading"><p className="eyebrow">Configured module</p><h2 id="create-heading">{formModule.title}</h2></div>
        {projection.createTasks.length === 0 ? <p className="empty-state">{formModule.emptyStateText}</p>
          : <div className="card-grid">{projection.createTasks.map((task) => <CreateTask key={task.artifactTypeKey} task={task}
              disabled={submitting} send={send} />)}</div>}
      </section>}
      {taskModule === undefined ? null : <section aria-labelledby="tasks-heading">
        <div className="section-heading"><p className="eyebrow">Configured module</p><h2 id="tasks-heading">{taskModule.title}</h2></div>
        {projection.artifacts.length === 0 ? <p className="empty-state">{taskModule.emptyStateText}</p>
          : <div className="card-grid">{projection.artifacts.map((artifact) => <ArtifactCard key={artifact.id}
              artifact={artifact} disabled={submitting} send={send} />)}</div>}
      </section>}
      {messageModules.map((module) => <MessageInbox key={module.id} module={module} projection={projection}
        disabled={submitting} send={sendInformation} />)}
      {proposalModules.map((module) => <ProposalThreads key={module.id} module={module} projection={projection}
        disabled={submitting} send={sendInformation} />)}
      {injectModules.map((module) => <InjectInbox key={module.id} module={module} projection={projection}
        disabled={submitting} send={sendInformation} />)}
      {projection.polls.length === 0 ? null : <section aria-labelledby="polls-heading">
        <div className="section-heading"><p className="eyebrow">Authoritative voting</p><h2 id="polls-heading">Polls</h2></div>
        <div className="card-grid">{projection.polls.map((poll) => <PollCard key={poll.id} poll={poll} disabled={submitting} send={sendPoll} />)}</div>
      </section>}
      {projection.voiceChannels.length === 0 || id === null || deviceId === null ? null : <VoiceControls projection={projection}
        online={connection === "online"} disabled={submitting} command={sendVoice} floor={sendFloor} notice={setNotice} />}
      <EffectProposalReview proposals={effectProposals} disabled={submitting} decide={(proposal, decision, reason) => void decideEffect(proposal, decision, reason)} />
      <AdjudicationReview adjudications={adjudications} disabled={submitting} send={sendInformation} />
      <button className="btn-secondary refresh" type="button" onClick={() => void load()}>Refresh authoritative state</button>
    </main>
  </Shell>;
}

function OperatorView() {
  const id = sessionId();
  const [connection, setConnection] = useState<ConnectionState>("loading");
  const [projection, setProjection] = useState<OperatorProjectionV1 | null>(null);
  const [readiness, setReadiness] = useState<ReadinessProjectionV1 | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (id === null) { setConnection("error"); setError("A Session link is required."); return; }
    setConnection("loading");
    try {
      const registered = deviceId === null ? await api<{ deviceId: string }>("/v1/devices", { method: "POST", body: "{}" }) : { deviceId };
      setDeviceId(registered.deviceId);
      const [nextProjection, nextReadiness] = await Promise.all([
        api<OperatorProjectionV1>(`/v1/operator/sessions/${id}`),
        api<ReadinessProjectionV1>(`/v1/sessions/${id}/readiness`).catch((cause: unknown) => {
          if (cause instanceof ApiError && cause.envelope.error.code === "INVALID_TRANSITION") return null;
          throw cause;
        })
      ]);
      setProjection(nextProjection); setReadiness(nextReadiness);
      setConnection("online"); setError(null);
    } catch (cause) { setConnection(navigator.onLine ? "error" : "offline"); setError(cause instanceof Error ? cause.message : "Operator view unavailable."); }
  }, [deviceId, id]);
  useEffect(() => { void load(); }, [load]);
  if (projection === null) return <StatePage connection={connection} title={connection === "loading" ? "Loading operator view" : "Access denied"}
    message={connection === "loading" ? "Reading authoritative Session state." : error ?? "This view is unavailable."}
    {...(connection === "loading" ? {} : { retry: () => void load() })} />;
  const states = Object.entries(projection.artifactsByState);
  const send = async (path: string, operationType: string, payload: JsonObject = {}, aggregateId = id,
    expectedAggregateVersion = readiness?.assignmentVersion ?? 0) => {
    if (id === null || deviceId === null || readiness === null || pending || aggregateId === null) return null;
    setPending(true); setNotice("Submitting authoritative Session change.");
    try {
      const result = await api<CommandReceiptV1 | { receipt: CommandReceiptV1; invitationToken: string | null }>(path, { method: "POST", body: JSON.stringify({
        commandId: crypto.randomUUID(), deviceId, operationType, aggregateId,
        expectedAggregateVersion, governingReleaseId: readiness.governingReleaseId, payload
      }) });
      const receipt = "receipt" in result ? result.receipt : result;
      setNotice(receipt.status === "accepted" ? "Authoritative Session state updated." : receipt.message ?? "The change was not accepted.");
      await load();
      return result;
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "The Session change failed."); }
    finally { setPending(false); }
    return null;
  };
  const retryDeadLetter = async (outboxId: string) => {
    if (id === null || pending) return;
    setPending(true); setNotice("Retrying the failed delivery.");
    try {
      await api(`/v1/operator/sessions/${id}/dead-letters/${outboxId}/retry`, { method: "POST", body: "{}" });
      setNotice("Delivery returned to the pending queue.");
      await load();
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "The delivery retry failed."); }
    finally { setPending(false); }
  };
  return <Shell connection={connection}>
    <main id="main-content" className="runtime-layout" tabIndex={-1}>
      <section className="hero"><p className="eyebrow">Operator console</p><h1>Session control view</h1><p>{projection.releaseLabel} · Session {projection.sessionStatus}</p></section>
      <section className="metric-grid" aria-label="Session summary">
        <div className="card metric"><span>Participants</span><strong>{projection.participantCount}</strong></div>
        <div className="card metric"><span>Occupied Seats</span><strong>{projection.occupiedSeatCount}</strong></div>
        <div className="card metric"><span>Active tasks</span><strong>{projection.activeTasks.length}</strong></div>
      </section>
      <section aria-labelledby="delivery-health-title">
        <div className="section-heading"><p className="eyebrow">Delivery health</p><h2 id="delivery-health-title">Runtime deliveries</h2></div>
        <p>{projection.deliveryHealth.pending} pending · {projection.deliveryHealth.deadLettered} dead-lettered</p>
        {projection.deliveryHealth.deadLetters.length === 0 ? <p className="empty-state">No dead-lettered deliveries.</p> :
          <ul className="readiness-list">{projection.deliveryHealth.deadLetters.map((item) => <li key={item.outboxId}>
            <span><strong>{item.eventType}</strong> · {item.attempts} failed attempts<br /><small>Queued <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></small></span>
            <button className="btn-secondary" type="button" disabled={pending} onClick={() => void retryDeadLetter(item.outboxId)}>
              Retry delivery
            </button>
          </li>)}</ul>}
      </section>
      {readiness === null ? null : <section aria-labelledby="staffing-title">
        <div className="section-heading"><p className="eyebrow">Verified onboarding</p><h2 id="staffing-title">Session staffing</h2></div>
        <div className="card-grid">
          <article className="card"><h3>Issue invitation</h3>
            <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget);
              const personId = String(data.get("personId") ?? "").trim(), seatId = String(data.get("seatId") ?? "");
              const payload: JsonObject = { expiresInHours: 24 };
              if (personId !== "") payload.recipientPersonId = personId;
              if (seatId !== "") payload.seatId = seatId;
              void send(`/v1/sessions/${id}/invitations`, "invitation.issue", payload, crypto.randomUUID(), 0)
                .then((result) => setInvitationToken(result !== null && "invitationToken" in result ? result.invitationToken : null)); }}>
              <div className="field"><label htmlFor="invite-person">Recipient Person ID <span className="hint">(optional)</span></label>
                <input id="invite-person" name="personId" type="text" autoComplete="off" /></div>
              <div className="field"><label htmlFor="invite-seat">Reserved Seat <span className="hint">(optional)</span></label>
                <select id="invite-seat" name="seatId"><option value="">Any eligible Seat</option>
                  {readiness.staffing.seats.map((item) => <option key={item.seatId} value={item.seatId}>{item.seatId}</option>)}</select></div>
              <button className="btn-primary" type="submit" disabled={pending}>Issue invitation</button>
            </form>
            {invitationToken === null ? null : <p className="credential" role="status">Copy this one-time token now: <code>{invitationToken}</code></p>}
          </article>
          <article className="card"><h3>Assign Participant</h3>
            <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget);
              void send(`/v1/sessions/${id}/participants`, "participant.assign", {
                personId: String(data.get("personId")), seatId: String(data.get("seatId")), sessionRoleId: String(data.get("sessionRoleId"))
              }, crypto.randomUUID()); }}>
              <div className="field"><label htmlFor="assign-person">Person ID</label><input id="assign-person" name="personId" type="text" required autoComplete="off" /></div>
              <div className="field"><label htmlFor="assign-seat">Seat</label><select id="assign-seat" name="seatId" required defaultValue=""><option value="" disabled>Select a Seat</option>
                {readiness.staffing.seats.map((item) => <option key={item.seatId} value={item.seatId}>{item.seatId}</option>)}</select></div>
              <div className="field"><label htmlFor="assign-role">Session Role ID</label><input id="assign-role" name="sessionRoleId" type="text" required autoComplete="off" /></div>
              <button className="btn-primary" type="submit" disabled={pending}>Assign Seat</button>
            </form>
          </article>
        </div>
        <h3>Seat occupancy</h3>
        <ul className="readiness-list">{readiness.staffing.seats.map((item) => <li key={item.seatId}><span><strong>{item.seatId}</strong>{item.teamId === null ? "" : ` · Team ${item.teamId}`}</span>
          <span>{item.occupied} / {item.maximum ?? "unlimited"} occupied · minimum {item.minimum}</span></li>)}</ul>
        <h3>Waiting room</h3>
        {readiness.staffing.joinRequests.length === 0 ? <p className="empty-state">No pending join requests.</p> : <ul className="readiness-list">
          {readiness.staffing.joinRequests.map((item) => <li key={`${item.personId}-${item.submittedAt}`}><span><strong>{item.personId}</strong> · {item.status}{item.requestedSeatId === null ? "" : ` · ${item.requestedSeatId}`}</span>
            <span className="actions"><button className="btn-primary" type="button" disabled={pending}
              onClick={() => void send(`/v1/sessions/${id}/join-requests/${item.personId}/admit`, "participant.admit", {}, item.personId, 0)}>Admit</button>
              <button className="btn-secondary" type="button" disabled={pending}
                onClick={() => void send(`/v1/sessions/${id}/join-requests/${item.personId}/reject`, "participant.reject", {}, item.personId, 0)}>Reject</button></span></li>)}</ul>}
        <h3>Roster review</h3>
        {readiness.staffing.rosterReview.length === 0 ? <p className="empty-state">No ambiguous roster rows.</p> : <ul className="readiness-list">
          {readiness.staffing.rosterReview.map((item) => <li key={item.rowId}><span><strong>Row {item.rowNumber}</strong> · {item.personId ?? "Unresolved person"} · {item.seatId ?? "No Seat"}</span>
            <span>{item.reasons.join(", ")}</span></li>)}</ul>}
        <h3>Active assignments</h3>
        {readiness.staffing.assignments.length === 0 ? <p className="empty-state">No active Seat Assignments.</p> : <ul className="readiness-list">
          {readiness.staffing.assignments.map((item) => <li key={item.seatAssignmentId}><span><strong>{item.seatId}</strong> · {item.personId} · {item.sessionRoleId}</span>
            <details><summary>Reassign</summary><form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget);
              void send(`/v1/sessions/${id}/seat-assignments/${item.seatAssignmentId}/reassign`, "participant.reassign", {
                previousSeatAssignmentId: item.seatAssignmentId, newSeatId: String(data.get("seatId")),
                newSessionRoleId: String(data.get("sessionRoleId")), reason: String(data.get("reason")),
                exposureAcknowledged: data.get("exposureAcknowledged") === "on"
              }, item.participantId, item.accessRevision); }}>
              <div className="field"><label htmlFor={`reassign-seat-${item.seatAssignmentId}`}>Destination Seat</label><select id={`reassign-seat-${item.seatAssignmentId}`} name="seatId" required defaultValue=""><option value="" disabled>Select a Seat</option>
                {readiness.staffing.seats.map((seat) => <option key={seat.seatId} value={seat.seatId}>{seat.seatId}</option>)}</select></div>
              <div className="field"><label htmlFor={`reassign-role-${item.seatAssignmentId}`}>Session Role ID</label><input id={`reassign-role-${item.seatAssignmentId}`} name="sessionRoleId" required /></div>
              <div className="field"><label htmlFor={`reassign-reason-${item.seatAssignmentId}`}>Reason</label><input id={`reassign-reason-${item.seatAssignmentId}`} name="reason" required minLength={3} maxLength={500} /></div>
              <label className="choice"><input name="exposureAcknowledged" type="checkbox" /> I acknowledge that previously viewed information cannot be withdrawn.</label>
              <button className="btn-primary" type="submit" disabled={pending}>Reassign</button>
            </form></details></li>)}</ul>}
      </section>}
      {readiness === null ? null : <section aria-labelledby="readiness-title">
        <div className="section-heading"><p className="eyebrow">Release and assignment version {readiness.assignmentVersion}</p><h2 id="readiness-title">Operator readiness</h2></div>
        <div className="live-region" aria-live="polite" aria-atomic="true">{notice}</div>
        <ul className="readiness-list">
          {readiness.checks.map((check) => <li key={check.key}>
            <span><strong>{check.complete ? "Complete" : "Incomplete"}</strong> — {check.label}</span>
            {check.key === "release_current" || check.key === "required_seats" || check.key === "operator_assignment" || check.complete
              ? null : <button className="btn-secondary" type="button" disabled={pending}
                onClick={() => void send(`/v1/sessions/${id}/readiness/${encodeURIComponent(check.key)}/confirm`, "readiness.confirm", { checkKey: check.key })}>Confirm</button>}
          </li>)}
        </ul>
        <div className="actions">
          {projection.sessionStatus === "configured" ? <button className="btn-primary" type="button" disabled={pending || !readiness.ready}
            onClick={() => void send(`/v1/sessions/${id}/ready`, "session.ready")}>Mark Session ready</button> : null}
          {projection.sessionStatus === "ready" ? <button className="btn-primary" type="button" disabled={pending || !readiness.ready}
            onClick={() => void send(`/v1/sessions/${id}/open`, "session.open")}>Open Session</button> : null}
        </div>
      </section>}
      <section aria-labelledby="artifact-status-title"><h2 id="artifact-status-title">Artifact status</h2>
        {states.length === 0 ? <p className="empty-state">No Artifacts have been created.</p> : <ul className="status-list">
          {states.map(([state, count]) => <li key={state}><span>{state.replaceAll("_", " ")}</span><strong>{count}</strong></li>)}</ul>}
      </section>
      <section aria-labelledby="event-title"><h2 id="event-title">Recent authoritative events</h2>
        {projection.recentEvents.length === 0 ? <p className="empty-state">No Session events recorded.</p> : <ol className="event-list">
          {projection.recentEvents.map((event, index) => <li key={`${event.type}-${event.recordedAt}-${index}`}><span>{event.type}</span><time dateTime={event.recordedAt}>{new Date(event.recordedAt).toLocaleString()}</time></li>)}</ol>}
      </section>
      <button className="btn-secondary refresh" type="button" onClick={() => void load()}>Refresh authoritative state</button>
    </main>
  </Shell>;
}

export function App() {
  const operator = useMemo(() => window.location.pathname.startsWith("/admin/"), []);
  return operator ? <OperatorView /> : <RuntimeView />;
}
