import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  type CommandEnvelopeV1,
  type CreatedConfiguredSessionV1,
  type ErrorEnvelopeV1,
  type ReleaseCatalogV1,
  type ReleaseSummaryV1,
  type SessionCatalogV1,
  type SessionSummaryV1
} from "@plenum/event-contracts";

class LifecycleError extends Error {
  constructor(readonly status: number, readonly envelope: ErrorEnvelopeV1) {
    super(envelope.error.message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json() as T | ErrorEnvelopeV1;
  if (!response.ok) {
    if (typeof body === "object" && body !== null && "error" in body) throw new LifecycleError(response.status, body as ErrorEnvelopeV1);
    throw new Error(`Request failed with status ${response.status}`);
  }
  return body as T;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function routeSelection(): { releaseId?: string; sessionId?: string } {
  const release = window.location.pathname.match(/^\/releases\/([0-9a-f-]{36})$/iu)?.[1];
  const session = window.location.pathname.match(/^\/sessions\/([0-9a-f-]{36})$/iu)?.[1];
  return { ...(release === undefined ? {} : { releaseId: release }), ...(session === undefined ? {} : { sessionId: session }) };
}

function AdministrationNavigation() {
  const destination = window.location.pathname.split("/").filter(Boolean).at(1) ?? "members";
  const descriptions: Record<string, { title: string; body: string }> = {
    members: { title: "Members and Organization Roles", body: "Use the Organization members section on this page to verify current least-privilege assignments." },
    plugins: { title: "Approved Plugins", body: "Open a Project in Studio to inspect approved Plugin installations and bind them to a governed Release." },
    deployment: { title: "Deployment posture", body: "Deployment profiles, authority health, backup, and recovery remain governed operational controls." },
    "data-policy": { title: "Data policy", body: "Classification, retention, export, and research-access policy are applied at trusted server boundaries." }
  };
  const selected = descriptions[destination] ?? descriptions.members!;
  return <section className="card administration-navigation" aria-labelledby="administration-title">
    <p className="eyebrow">Administration</p><h2 id="administration-title">{selected.title}</h2><p>{selected.body}</p>
    <nav aria-label="Administration destinations"><ul className="lifecycle-links">
      <li><a href="/admin/members">Members</a></li><li><a href="/admin/plugins">Plugins</a></li>
      <li><a href="/admin/deployment">Deployment</a></li><li><a href="/admin/data-policy">Data policy</a></li>
    </ul></nav>
  </section>;
}

export function LifecyclePortal({ isAdmin }: { isAdmin: boolean }) {
  const [releases, setReleases] = useState<ReleaseCatalogV1 | null>(null);
  const [sessions, setSessions] = useState<SessionCatalogV1 | null>(null);
  const [selectedRelease, setSelectedRelease] = useState<ReleaseSummaryV1 | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionSummaryV1 | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied" | "error">("loading");
  const [message, setMessage] = useState("Loading Release and Session lifecycle state.");
  const [releaseQuery, setReleaseQuery] = useState("");
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessionStatus, setSessionStatus] = useState("all");
  const [creatingFrom, setCreatingFrom] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const creationRef = useRef<{ releaseId: string; title: string; scheduledStartAt: string; sessionId: string; commandId: string; deviceId: string } | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const selection = routeSelection();

  const load = useCallback(async () => {
    setState("loading");
    setMessage("Loading Release and Session lifecycle state.");
    const releaseParameters = new URLSearchParams({ limit: "20" });
    if (releaseQuery.trim() !== "") releaseParameters.set("query", releaseQuery.trim());
    const sessionParameters = new URLSearchParams({ limit: "20", status: sessionStatus });
    if (sessionQuery.trim() !== "") sessionParameters.set("query", sessionQuery.trim());
    try {
      const [releaseResult, sessionResult] = await Promise.allSettled([
        request<ReleaseCatalogV1>(`/v1/releases?${releaseParameters}`),
        request<SessionCatalogV1>(`/v1/sessions?${sessionParameters}`)
      ]);
      const nextReleases = releaseResult.status === "fulfilled" ? releaseResult.value : null;
      const nextSessions = sessionResult.status === "fulfilled" ? sessionResult.value : null;
      if (nextReleases === null && nextSessions === null) {
        const cause = releaseResult.status === "rejected" ? releaseResult.reason : sessionResult.status === "rejected" ? sessionResult.reason : null;
        if (cause instanceof LifecycleError && cause.status === 403) {
          setState("denied"); setMessage("Your current Organization Role does not include Release or Session catalog access."); return;
        }
        throw cause;
      }
      setReleases(nextReleases); setSessions(nextSessions);
      const detailRequests: Promise<void>[] = [];
      if (selection.releaseId !== undefined && nextReleases !== null) detailRequests.push(
        request<ReleaseSummaryV1>(`/v1/releases/${selection.releaseId}`).then(setSelectedRelease)
      ); else setSelectedRelease(null);
      if (selection.sessionId !== undefined && nextSessions !== null) detailRequests.push(
        request<SessionSummaryV1>(`/v1/sessions/${selection.sessionId}`).then(setSelectedSession)
      ); else setSelectedSession(null);
      await Promise.all(detailRequests);
      setState("ready"); setMessage("Release and Session lifecycle state is current.");
    } catch (cause) {
      setState("error"); setMessage(cause instanceof Error ? cause.message : "Lifecycle state could not be loaded.");
    }
  }, [releaseQuery, selection.releaseId, selection.sessionId, sessionQuery, sessionStatus]);

  useEffect(() => { void load(); }, []);

  async function createSession(event: FormEvent<HTMLFormElement>, release: ReleaseSummaryV1): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const scheduledStartAt = String(data.get("scheduledStartAt") ?? "");
    setPending(true); setMessage("Creating and configuring the Session.");
    try {
      let remembered = creationRef.current;
      if (remembered === null || remembered.releaseId !== release.id || remembered.title !== title || remembered.scheduledStartAt !== scheduledStartAt) {
        const device = await request<{ deviceId: string }>("/v1/devices", { method: "POST", body: "{}" });
        remembered = { releaseId: release.id, title, scheduledStartAt, sessionId: crypto.randomUUID(), commandId: crypto.randomUUID(), deviceId: device.deviceId };
        creationRef.current = remembered;
      }
      const command: CommandEnvelopeV1 = {
        commandId: remembered.commandId, deviceId: remembered.deviceId, operationType: "session.create",
        aggregateId: remembered.sessionId, expectedAggregateVersion: 0, governingReleaseId: release.id,
        payload: { title, ...(scheduledStartAt === "" ? {} : { scheduledStartAt: new Date(scheduledStartAt).toISOString() }) }
      };
      const created = await request<CreatedConfiguredSessionV1>(`/v1/releases/${release.id}/sessions`, {
        method: "POST", body: JSON.stringify(command)
      });
      creationRef.current = null; setMessage(created.replayed ? "The original Session creation result was recovered." : "Session created and configured.");
      window.location.assign(created.detailUrl);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "The Session was not created. Your entries are preserved.");
      requestAnimationFrame(() => noticeRef.current?.focus());
    } finally { setPending(false); }
  }

  async function importPackage(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("releasePackage") as HTMLInputElement;
    const file = input.files?.[0];
    if (file === undefined) return;
    setPending(true); setMessage("Verifying and importing the Release Package.");
    try {
      const response = await fetch("/v1/releases/import", { method: "POST", headers: { "content-type": "application/vnd.plenum.release+json" }, body: file });
      const body = await response.json() as { imported?: boolean } | ErrorEnvelopeV1;
      if (!response.ok) throw new Error("error" in body ? body.error.message : `Import failed with status ${response.status}`);
      const imported = "imported" in body ? body.imported : undefined;
      input.value = ""; await load();
      setMessage(imported === false ? "This immutable Release Package was already present." : "Release Package imported and verified.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "The Release Package could not be imported.");
      requestAnimationFrame(() => noticeRef.current?.focus());
    } finally { setPending(false); }
  }

  if (state === "loading" && releases === null && sessions === null) return <section id="lifecycle" className="card portal-state teludens-state" aria-busy="true">
    <p className="eyebrow">Lifecycle</p><h2>Loading Releases and Sessions</h2><p>Checking current Organization authority and immutable Release state.</p>
  </section>;
  if (state === "denied") return <section id="lifecycle" className="card portal-state teludens-state" data-state="unauthorized">
    <p className="eyebrow">Lifecycle</p><h2>Release and Session access unavailable</h2><p>Publisher or Operator authority is required. Protected catalog data was not loaded.</p>
  </section>;
  if (state === "error" && releases === null && sessions === null) return <section id="lifecycle" className="card portal-state teludens-state" data-state="error">
    <p className="eyebrow">Lifecycle</p><h2>Lifecycle state did not load</h2><p>{message}</p><button className="btn-secondary" type="button" onClick={() => void load()}>Retry lifecycle</button>
  </section>;

  return <section id="lifecycle" className="portal-workspace" aria-labelledby="lifecycle-title">
    <div className="card portal-toolbar teludens-gate"><div><p className="eyebrow">Governed lifecycle</p><h2 id="lifecycle-title">Releases and Sessions</h2></div>
      <p>Published Releases are immutable. Sessions pin the selected Release when they are created.</p></div>
    <p ref={noticeRef} className="live-region portal-notice" role={state === "error" ? "alert" : "status"} aria-live="polite" aria-atomic="true" tabIndex={-1}>{message}</p>

    {selectedRelease === null ? null : <article className="card lifecycle-detail" aria-labelledby="release-detail-title">
      <nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/#release-catalog">Releases</a></nav>
      <p className="eyebrow">Immutable Release</p><h3 id="release-detail-title">{selectedRelease.label}</h3>
      <p>{selectedRelease.project.title} / Release {selectedRelease.releaseNumber}</p>
      <dl className="project-metadata"><div><dt>Published</dt><dd>{formatDate(selectedRelease.publishedAt)}</dd></div>
        <div><dt>Publisher</dt><dd>{selectedRelease.publishedBy.displayName}</dd></div><div><dt>Package digest</dt><dd className="digest-value">{selectedRelease.packageDigest}</dd></div>
        <div><dt>Approvals</dt><dd>{selectedRelease.approvalCount}</dd></div><div><dt>Sessions</dt><dd>{selectedRelease.sessionCount}</dd></div></dl>
      {releases?.permissions.canExportPackage ? <a className="btn-secondary link-button" href={selectedRelease.packageUrl}>Export verified Package</a> : null}
    </article>}
    {selectedSession === null ? null : <article className="card lifecycle-detail" aria-labelledby="session-detail-title">
      <nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/#session-catalog">Sessions</a></nav>
      <p className="eyebrow">Session overview</p><div className="card-heading"><h3 id="session-detail-title">{selectedSession.title}</h3><span className="badge badge-state">{selectedSession.status}</span></div>
      <p>{selectedSession.project.title} / {selectedSession.governingRelease.label}</p>
      <p>Readiness {selectedSession.readiness.complete}/{selectedSession.readiness.total}; {selectedSession.readiness.blockingIncomplete} blocking check{selectedSession.readiness.blockingIncomplete === 1 ? "" : "s"} incomplete.</p>
      <p>Next valid actions: {selectedSession.nextActions.join("; ")}.</p>
      <nav aria-label="Session destinations"><ul className="lifecycle-links"><li><a href={selectedSession.urls.staffing}>Staffing and readiness</a></li>
        <li><a href={selectedSession.urls.runtime}>Runtime</a></li><li><a href={selectedSession.urls.reports}>Reports</a></li>
        <li><a href={selectedSession.urls.replay}>Replay</a></li><li><a href={selectedSession.urls.archive}>Archive</a></li></ul></nav>
    </article>}

    {releases === null ? null : <section id="release-catalog" aria-labelledby="releases-title">
      <div className="section-heading"><p className="eyebrow">Registry</p><h3 id="releases-title">Simulation Releases</h3></div>
      <form className="card portal-filter" onSubmit={(event) => { event.preventDefault(); void load(); }} aria-label="Find Releases">
        <div className="field"><label htmlFor="release-search">Search Releases</label><input id="release-search" type="search" maxLength={100} value={releaseQuery} onChange={(event) => setReleaseQuery(event.target.value)} /></div>
        <button className="btn-secondary" type="submit">Apply</button></form>
      {releases.permissions.canImportPackage ? <form className="card package-import" onSubmit={(event) => void importPackage(event)}>
        <div className="field"><label htmlFor="release-package">Import a verified Release Package</label><input id="release-package" name="releasePackage" type="file" accept="application/json,.json" required /></div>
        <button className="btn-secondary" type="submit" disabled={pending}>Verify and import</button></form> : null}
      {releases.releases.length === 0 ? <div className="empty-state"><p>No published Releases match this view.</p><p>Publish a validated Draft or clear the search.</p></div> :
        <ul className="release-list">{releases.releases.map((release) => <li className="card lifecycle-row" key={release.id}><div>
          <div className="card-heading"><h4><a href={release.detailUrl}>{release.label}</a></h4><span className="badge badge-online">immutable</span></div>
          <p>{release.project.title} / Release {release.releaseNumber}</p>
          <p className="hint">Published {formatDate(release.publishedAt)} by {release.publishedBy.displayName}. {release.approvalCount} Approval{release.approvalCount === 1 ? "" : "s"}. {release.sessionCount} Session{release.sessionCount === 1 ? "" : "s"}.</p>
          <p className="hint digest-value">Package digest {release.packageDigest}</p></div>
          <div className="project-actions">{releases.permissions.canExportPackage ? <a className="btn-secondary link-button" href={release.packageUrl}>Export Package</a> : null}
            {releases.permissions.canCreateSession ? <button className="btn-primary" type="button" disabled={pending} onClick={() => setCreatingFrom(release.id)}>Create Session</button> : null}</div>
          {creatingFrom === release.id ? <form className="session-create" onSubmit={(event) => void createSession(event, release)}>
            <div className="field"><label htmlFor={`session-title-${release.id}`}>Session name</label><input id={`session-title-${release.id}`} name="title" required maxLength={200} /></div>
            <div className="field"><label htmlFor={`session-start-${release.id}`}>Scheduled start (optional)</label><input id={`session-start-${release.id}`} name="scheduledStartAt" type="datetime-local" /></div>
            <div className="actions"><button className="btn-secondary" type="button" onClick={() => setCreatingFrom(null)}>Cancel</button><button className="btn-primary" type="submit" disabled={pending}>{pending ? "Creating..." : "Create configured Session"}</button></div>
          </form> : null}</li>)}</ul>}
    </section>}

    {sessions === null ? null : <section id="session-catalog" aria-labelledby="sessions-title">
      <div className="section-heading"><p className="eyebrow">Operations</p><h3 id="sessions-title">Sessions</h3></div>
      <form className="card portal-filter" onSubmit={(event) => { event.preventDefault(); void load(); }} aria-label="Find Sessions">
        <div className="field"><label htmlFor="session-search">Search Sessions</label><input id="session-search" type="search" maxLength={100} value={sessionQuery} onChange={(event) => setSessionQuery(event.target.value)} /></div>
        <div className="field"><label htmlFor="session-status">Status</label><select id="session-status" value={sessionStatus} onChange={(event) => setSessionStatus(event.target.value)}>
          <option value="all">All</option><option value="configured">Configured</option><option value="ready">Ready</option><option value="open">Open</option>
          <option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="locked">Locked</option><option value="archived">Archived</option>
        </select></div><button className="btn-secondary" type="submit">Apply</button></form>
      {sessions.sessions.length === 0 ? <div className="empty-state"><p>No Sessions match this view.</p><p>Create one from a published Release or clear the filters.</p></div> :
        <ul className="session-list">{sessions.sessions.map((session) => <li className="card lifecycle-row" key={session.id}><div>
          <div className="card-heading"><h4><a href={session.urls.detail}>{session.title}</a></h4><span className="badge badge-state">{session.status}</span></div>
          <p>{session.project.title} / {session.governingRelease.label}</p><p className="hint">Readiness {session.readiness.complete}/{session.readiness.total}; {session.participantCount} Participant{session.participantCount === 1 ? "" : "s"}. Next: {session.nextActions.join("; ")}.</p></div>
          <div className="project-actions"><a className="btn-secondary link-button" href={session.urls.staffing}>Open administration</a><a className="btn-secondary link-button" href={session.urls.runtime}>Open Runtime</a></div>
        </li>)}</ul>}
    </section>}
    {isAdmin ? <AdministrationNavigation /> : null}
  </section>;
}
