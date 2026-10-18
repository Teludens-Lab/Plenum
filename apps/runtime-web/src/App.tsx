import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  type CommandEnvelopeV1,
  type CommandReceiptV1,
  type ErrorEnvelopeV1,
  type JsonObject,
  type OperatorProjectionV1,
  type RuntimeActionV1,
  type RuntimeArtifactV1,
  type RuntimeCreateTaskV1,
  type RuntimeFormV1,
  type RuntimeProjectionV1
} from "@plenum/event-contracts";

type ConnectionState = "loading" | "online" | "offline" | "error";

interface PendingCommand {
  status: "local_pending";
  command: CommandEnvelopeV1;
}

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

function FieldEditor({ form, initial, disabled, onSubmit, submitLabel }: {
  form: RuntimeFormV1;
  initial?: JsonObject;
  disabled: boolean;
  onSubmit(payload: JsonObject): void;
  submitLabel: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(
    form.fields.map((field) => [field.key, typeof initial?.[field.key] === "string" ? initial[field.key] as string : ""])
  ));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = Object.fromEntries(form.fields.flatMap((field) =>
      field.required && (values[field.key] ?? "").trim().length === 0 ? [[field.key, `${field.label} is required.`]] : []));
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSubmit(values);
  };
  return <form onSubmit={submit} noValidate>
    {form.fields.map((field) => {
      const id = `${form.id}-${field.key}`;
      const error = errors[field.key];
      const describedBy = [field.helpText === undefined ? null : `${id}-help`, error === undefined ? null : `${id}-error`]
        .filter(Boolean).join(" ") || undefined;
      return <div className="field" key={field.key}>
        <label htmlFor={id}>{field.label}{field.required ? <span aria-hidden="true"> *</span> : null}</label>
        {field.type === "long_text"
          ? <textarea id={id} name={field.key} rows={4} value={values[field.key] ?? ""} disabled={disabled}
              required={field.required} aria-invalid={error !== undefined} aria-describedby={describedBy}
              onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} />
          : <input id={id} name={field.key} value={values[field.key] ?? ""} disabled={disabled}
              required={field.required} aria-invalid={error !== undefined} aria-describedby={describedBy}
              onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} />}
        {field.helpText === undefined ? null : <p id={`${id}-help`} className="hint">{field.helpText}</p>}
        {error === undefined ? null : <p id={`${id}-error`} className="field-error" role="alert">Error: {error}</p>}
      </div>;
    })}
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

function ArtifactCard({ artifact, disabled, send }: {
  artifact: RuntimeArtifactV1; disabled: boolean;
  send(action: RuntimeActionV1, artifact: RuntimeArtifactV1, content?: JsonObject): void;
}) {
  const edit = artifact.actions.find((action) => action.requiresForm);
  const actions = artifact.actions.filter((action) => !action.requiresForm);
  return <article className="card artifact" aria-labelledby={`artifact-${artifact.id}`}>
    <div className="card-heading">
      <div>
        <p className="eyebrow">{artifact.createdByMe ? "Your Artifact" : "Assigned task"}</p>
        <h3 id={`artifact-${artifact.id}`}>{artifact.title}</h3>
      </div>
      <span className="badge badge-state">{artifact.stateLabel}</span>
    </div>
    <dl className="metadata"><div><dt>Version</dt><dd>{artifact.version}</dd></div><div><dt>Form</dt><dd>{artifact.form.formVersion}</dd></div></dl>
    {edit === undefined ? <dl className="artifact-content">{artifact.form.fields.map((field) =>
      <div key={field.key}><dt>{field.label}</dt><dd>{String(artifact.payload[field.key] ?? "Not provided")}</dd></div>)}</dl>
      : <FieldEditor form={artifact.form} initial={artifact.payload} disabled={disabled} submitLabel={edit.label}
          onSubmit={(content) => send(edit, artifact, content)} />}
    {actions.length === 0 ? null : <div className="actions" aria-label={`${artifact.title} workflow actions`}>
      {actions.map((action, index) => <button key={action.operationType}
        className={index === 0 ? "btn-primary" : "btn-secondary"} type="button" disabled={disabled}
        onClick={() => send(action, artifact)}>{action.label}</button>)}
    </div>}
  </article>;
}

function RuntimeView() {
  const id = sessionId();
  const [connection, setConnection] = useState<ConnectionState>("loading");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [projection, setProjection] = useState<RuntimeProjectionV1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>("");
  const [pending, setPending] = useState<PendingCommand | null>(null);
  const main = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    if (id === null) { setConnection("error"); setError("A Session link is required."); return; }
    setConnection("loading");
    setError(null);
    try {
      const registered = deviceId === null ? await api<{ deviceId: string }>("/v1/devices", { method: "POST", body: "{}" }) : { deviceId };
      setDeviceId(registered.deviceId);
      setProjection(await api<RuntimeProjectionV1>(`/v1/sessions/${id}/runtime-projection`, { headers: { "x-device-id": registered.deviceId } }));
      setConnection("online");
    } catch (cause) {
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

  const handleReceipt = async (receipt: CommandReceiptV1) => {
    setPending(null);
    if (receipt.status === "accepted") setNotice(receipt.replayed ? "The original server receipt was recovered." : "The server accepted the Command.");
    else setNotice(receipt.status === "needs_reconciliation" ? `Authoritative state changed: ${receipt.message ?? receipt.errorCode}.` : `Command refused: ${receipt.message ?? receipt.errorCode}.`);
    await load();
    requestAnimationFrame(() => main.current?.focus());
  };

  const post = async (command: CommandEnvelopeV1) => {
    if (id === null) return;
    setPending({ status: "local_pending", command });
    setNotice("Saved on this device. Waiting for a server receipt.");
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
      await handleReceipt(body);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setPending(null);
        setConnection("error");
        setNotice(`Command failed: ${cause.message}`);
        return;
      }
      setConnection(navigator.onLine ? "error" : "offline");
      setNotice("Delivery acknowledgement was lost. This Command is still local pending, not accepted.");
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

  const retryPending = async () => {
    if (pending === null || id === null) return;
    setNotice("Checking for the original server receipt before retrying.");
    try {
      const receipt = await api<CommandReceiptV1>(`/v1/sessions/${id}/commands/${pending.command.commandId}`);
      await handleReceipt(receipt);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) await post(pending.command);
      else setNotice(cause instanceof Error ? cause.message : "Receipt lookup failed.");
    }
  };

  if (projection === null) {
    return <StatePage connection={connection} title={connection === "loading" ? "Loading Runtime" : connection === "offline" ? "Runtime offline" : "Runtime unavailable"}
      message={connection === "loading" ? "Resolving your authorized Session view." : error ?? "Reconnect and try again."}
      {...(connection === "loading" ? {} : { retry: () => void load() })} />;
  }
  const taskModule = projection.modules.find((module) => module.type === "task_list");
  const formModule = projection.modules.find((module) => module.type === "artifact_form");
  return <Shell connection={connection}>
    <main id="main-content" className={`runtime-layout layout-${projection.layout}`} ref={main} tabIndex={-1}>
      <section className="hero" aria-labelledby="runtime-title">
        <p className="eyebrow">{projection.releaseLabel}</p>
        <h1 id="runtime-title">{projection.activeSessionRoleLabel} workspace</h1>
        <p>{projection.currentStageLabel ?? "Session workspace"} · Session {projection.sessionStatus}</p>
      </section>
      <div className="live-region" aria-live="polite" aria-atomic="true">{notice}</div>
      {pending === null ? null : <section className="status-panel status-warning" aria-labelledby="pending-title">
        <div><h2 id="pending-title">Command awaiting confirmation</h2><p><code>local_pending</code> is not a server acceptance.</p></div>
        <button className="btn-secondary" type="button" onClick={() => void retryPending()}>Check receipt and retry</button>
      </section>}
      {formModule === undefined ? null : <section aria-labelledby="create-heading">
        <div className="section-heading"><p className="eyebrow">Configured module</p><h2 id="create-heading">{formModule.title}</h2></div>
        {projection.createTasks.length === 0 ? <p className="empty-state">{formModule.emptyStateText}</p>
          : <div className="card-grid">{projection.createTasks.map((task) => <CreateTask key={task.artifactTypeKey} task={task}
              disabled={pending !== null} send={send} />)}</div>}
      </section>}
      {taskModule === undefined ? null : <section aria-labelledby="tasks-heading">
        <div className="section-heading"><p className="eyebrow">Configured module</p><h2 id="tasks-heading">{taskModule.title}</h2></div>
        {projection.artifacts.length === 0 ? <p className="empty-state">{taskModule.emptyStateText}</p>
          : <div className="card-grid">{projection.artifacts.map((artifact) => <ArtifactCard key={artifact.id}
              artifact={artifact} disabled={pending !== null} send={send} />)}</div>}
      </section>}
      <button className="btn-secondary refresh" type="button" onClick={() => void load()}>Refresh authoritative state</button>
    </main>
  </Shell>;
}

function OperatorView() {
  const id = sessionId();
  const [connection, setConnection] = useState<ConnectionState>("loading");
  const [projection, setProjection] = useState<OperatorProjectionV1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (id === null) { setConnection("error"); setError("A Session link is required."); return; }
    setConnection("loading");
    try {
      setProjection(await api<OperatorProjectionV1>(`/v1/operator/sessions/${id}`));
      setConnection("online"); setError(null);
    } catch (cause) { setConnection(navigator.onLine ? "error" : "offline"); setError(cause instanceof Error ? cause.message : "Operator view unavailable."); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  if (projection === null) return <StatePage connection={connection} title={connection === "loading" ? "Loading operator view" : "Access denied"}
    message={connection === "loading" ? "Reading authoritative Session state." : error ?? "This view is unavailable."}
    {...(connection === "loading" ? {} : { retry: () => void load() })} />;
  const states = Object.entries(projection.artifactsByState);
  return <Shell connection={connection}>
    <main id="main-content" className="runtime-layout" tabIndex={-1}>
      <section className="hero"><p className="eyebrow">Operator console</p><h1>Session control view</h1><p>{projection.releaseLabel} · Session {projection.sessionStatus}</p></section>
      <section className="metric-grid" aria-label="Session summary">
        <div className="card metric"><span>Participants</span><strong>{projection.participantCount}</strong></div>
        <div className="card metric"><span>Occupied Seats</span><strong>{projection.occupiedSeatCount}</strong></div>
        <div className="card metric"><span>Active tasks</span><strong>{projection.activeTasks.length}</strong></div>
      </section>
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
