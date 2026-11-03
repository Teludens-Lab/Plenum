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

function displayStatus(value: string): string {
  return value.replaceAll("_", " ").replace(/^./u, (first) => first.toUpperCase());
}

type SessionDestinationKey = keyof SessionSummaryV1["urls"];

const sessionDestinationLabels: Record<SessionDestinationKey, string> = {
  detail: "Session detail",
  staffing: "Staffing and readiness",
  runtime: "Session Runtime",
  reports: "Reports",
  replay: "Replay",
  archive: "Archive"
};

function primarySessionAction(session: SessionSummaryV1): { destination: SessionDestinationKey; label: string } {
  const destination: SessionDestinationKey = session.status === "active" ? "runtime" :
    session.status === "completed" || session.status === "archived" ? "reports" :
      session.status === "locked" ? "archive" : "staffing";
  return { destination, label: session.nextActions[0] ?? sessionDestinationLabels[destination] };
}

function sessionDestinationReason(session: SessionSummaryV1, destination: SessionDestinationKey): string | null {
  if (destination === "staffing") return null;
  if (destination === "runtime") {
    if (session.status === "active") return null;
    if (["completed", "locked", "archived"].includes(session.status)) return "Runtime is unavailable after Session completion.";
    if (session.status === "paused") return "Resume the Session before opening Runtime.";
    if (session.status === "open") return "Start the Session before opening Runtime.";
    return "Complete readiness, mark the Session ready, open it, and start it before Runtime is available.";
  }
  if (destination === "reports" || destination === "replay") {
    return ["completed", "locked", "archived"].includes(session.status)
      ? null : `Complete the Session before ${destination === "reports" ? "Reports" : "Replay"} is available.`;
  }
  if (destination === "archive") {
    if (["locked", "archived"].includes(session.status)) return null;
    return session.status === "completed"
      ? "Lock the completed Session before Archive is available."
      : "Complete and lock the Session before Archive is available.";
  }
  return null;
}

function SessionDestinationNavigation({ session }: { session: SessionSummaryV1 }) {
  const primary = primarySessionAction(session);
  const destinations: SessionDestinationKey[] = ["staffing", "runtime", "reports", "replay", "archive"];
  return <nav aria-label="Session destinations"><ul className="lifecycle-links">{destinations.map((destination) => {
    const reason = sessionDestinationReason(session, destination);
    const reasonId = `session-${session.id}-${destination}-reason`;
    const label = destination === primary.destination ? primary.label : sessionDestinationLabels[destination];
    return <li className={destination === primary.destination ? "is-primary" : undefined} key={destination}>
      {reason === null ? <a className={destination === primary.destination ? "btn-primary link-button" : undefined} href={session.urls[destination]}>{label}</a> :
        <span className="disabled-destination" role="link" aria-disabled="true" aria-describedby={reasonId} tabIndex={0}>{label}</span>}
      {reason === null ? null : <span className="destination-reason" id={reasonId}>{reason}</span>}
    </li>;
  })}</ul></nav>;
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
  const [noticeKind, setNoticeKind] = useState<"status" | "error">("status");
  const [partialFailure, setPartialFailure] = useState<"releases" | "sessions" | null>(null);
  const creationRef = useRef<{ releaseId: string; title: string; scheduledStartAt: string; sessionId: string; commandId: string; deviceId: string } | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const sessionTitleRef = useRef<HTMLInputElement>(null);
  const createSessionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const selection = routeSelection();

  const load = useCallback(async (filters?: { releaseQuery?: string; sessionQuery?: string; sessionStatus?: string }) => {
    const requestedReleaseQuery = filters?.releaseQuery ?? releaseQuery;
    const requestedSessionQuery = filters?.sessionQuery ?? sessionQuery;
    const requestedSessionStatus = filters?.sessionStatus ?? sessionStatus;
    setState("loading");
    setNoticeKind("status");
    setPartialFailure(null);
    setMessage(releases === null && sessions === null ? "Loading Releases and Sessions." : "Refreshing Releases and Sessions.");
    const releaseParameters = new URLSearchParams({ limit: "20" });
    if (requestedReleaseQuery.trim() !== "") releaseParameters.set("query", requestedReleaseQuery.trim());
    const sessionParameters = new URLSearchParams({ limit: "20", status: requestedSessionStatus });
    if (requestedSessionQuery.trim() !== "") sessionParameters.set("query", requestedSessionQuery.trim());
    try {
      const [releaseResult, sessionResult] = await Promise.allSettled([
        request<ReleaseCatalogV1>(`/v1/releases?${releaseParameters}`),
        request<SessionCatalogV1>(`/v1/sessions?${sessionParameters}`)
      ]);
      const nextReleases = releaseResult.status === "fulfilled" ? releaseResult.value : null;
      const nextSessions = sessionResult.status === "fulfilled" ? sessionResult.value : null;
      const releasesDenied = releaseResult.status === "rejected" && releaseResult.reason instanceof LifecycleError && releaseResult.reason.status === 403;
      const sessionsDenied = sessionResult.status === "rejected" && sessionResult.reason instanceof LifecycleError && sessionResult.reason.status === 403;
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
      if ((nextReleases === null && !releasesDenied) || (nextSessions === null && !sessionsDenied)) {
        setState("error"); setNoticeKind("error");
        setPartialFailure(nextReleases === null ? "releases" : "sessions");
        setMessage(nextReleases === null
          ? "Releases could not be loaded. Sessions remain available; retry to restore the Release catalog."
          : "Sessions could not be loaded. Releases remain available; retry to restore the Session catalog.");
      } else {
        setState("ready");
        setPartialFailure(null);
        setMessage(nextSessions === null
          ? `${nextReleases?.releases.length ?? 0} Release${nextReleases?.releases.length === 1 ? "" : "s"} shown. Sessions are not available to your current Organization Role.`
          : nextReleases === null ? `${nextSessions.sessions.length} Session${nextSessions.sessions.length === 1 ? "" : "s"} shown. Releases are not available to your current Organization Role.`
            : `${nextReleases.releases.length} Release${nextReleases.releases.length === 1 ? "" : "s"} and ${nextSessions.sessions.length} Session${nextSessions.sessions.length === 1 ? "" : "s"} shown.`);
      }
    } catch (cause) {
      setState("error"); setNoticeKind("error"); setPartialFailure(null);
      setMessage(`Releases and Sessions could not be loaded. ${cause instanceof Error ? cause.message : "Try again."}`);
    }
  }, [releaseQuery, releases, selection.releaseId, selection.sessionId, sessionQuery, sessionStatus, sessions]);

  useEffect(() => { void load(); }, []);

  async function createSession(event: FormEvent<HTMLFormElement>, release: ReleaseSummaryV1): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const scheduledStartAt = String(data.get("scheduledStartAt") ?? "");
    setPending(true); setNoticeKind("status"); setMessage("Creating and configuring the Session.");
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
      setNoticeKind("error");
      setMessage(`Session was not created. ${cause instanceof Error ? cause.message : "Review the form and try again."} Your entries are preserved.`);
      requestAnimationFrame(() => noticeRef.current?.focus());
    } finally { setPending(false); }
  }

  async function importPackage(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("releasePackage") as HTMLInputElement;
    const file = input.files?.[0];
    if (file === undefined) return;
    setPending(true); setNoticeKind("status"); setMessage("Verifying and importing the Release Package.");
    try {
      const response = await fetch("/v1/releases/import", { method: "POST", headers: { "content-type": "application/vnd.plenum.release+json" }, body: file });
      const body = await response.json() as { imported?: boolean } | ErrorEnvelopeV1;
      if (!response.ok) throw new Error("error" in body ? body.error.message : `Import failed with status ${response.status}`);
      const imported = "imported" in body ? body.imported : undefined;
      input.value = ""; await load();
      setMessage(imported === false ? "This immutable Release Package was already present." : "Release Package imported and verified.");
    } catch (cause) {
      setNoticeKind("error");
      setMessage(`Release Package was not imported. ${cause instanceof Error ? cause.message : "Choose a verified Package and try again."}`);
      requestAnimationFrame(() => noticeRef.current?.focus());
    } finally { setPending(false); }
  }

  function openSessionCreation(releaseId: string, trigger: HTMLButtonElement): void {
    createSessionTriggerRef.current = trigger;
    setCreatingFrom(releaseId);
    requestAnimationFrame(() => sessionTitleRef.current?.focus());
  }

  function cancelSessionCreation(): void {
    setCreatingFrom(null);
    requestAnimationFrame(() => createSessionTriggerRef.current?.focus());
  }

  function clearReleaseSearch(): void {
    setReleaseQuery("");
    void load({ releaseQuery: "" });
  }

  function clearSessionFilters(): void {
    setSessionQuery("");
    setSessionStatus("all");
    void load({ sessionQuery: "", sessionStatus: "all" });
  }

  async function copyPackageDigest(digest: string, releaseLabel: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(digest);
      setNoticeKind("status");
      setMessage(`Package digest copied for ${releaseLabel}.`);
    } catch {
      setNoticeKind("error");
      setMessage("Package digest was not copied. Select the digest in Package provenance and copy it manually.");
      requestAnimationFrame(() => noticeRef.current?.focus());
    }
  }

  if (state === "loading" && releases === null && sessions === null) return <section id="lifecycle" className="card portal-state teludens-state" aria-busy="true">
    <h2>Loading Releases and Sessions</h2><p>Checking current Organization authority and immutable Release state.</p>
  </section>;
  if (state === "denied") return <section id="lifecycle" className="card portal-state teludens-state" data-state="unauthorized">
    <h2>Release and Session access unavailable</h2><p>Publisher or Operator authority is required. Protected catalog data was not loaded.</p>
  </section>;
  if (state === "error" && releases === null && sessions === null) return <section id="lifecycle" className="card portal-state teludens-state" data-state="error">
    <h2>Releases and Sessions did not load</h2><p>{message}</p><button className="btn-secondary" type="button" onClick={() => void load()}>Retry loading Releases and Sessions</button>
  </section>;

  return <section id="lifecycle" className="portal-workspace" aria-label="Release and Session lifecycle">
    <div className="lifecycle-brief teludens-gate" aria-label="Lifecycle policy">
      <p><strong>Published Releases are immutable.</strong></p>
      <p>Each Session stays pinned to the Release selected at creation.</p>
    </div>
    <div className="portal-notice-area"><p ref={noticeRef} className="live-region portal-notice" role={noticeKind === "error" ? "alert" : "status"} aria-live={noticeKind === "error" ? "assertive" : "polite"} aria-atomic="true" tabIndex={-1}>{message}</p>
      {partialFailure === null ? null : <button className="btn-secondary" type="button" onClick={() => void load()}>Retry loading {partialFailure === "releases" ? "Releases" : "Sessions"}</button>}</div>

    {selectedRelease === null ? null : <article className="card lifecycle-detail" aria-labelledby="release-detail-title">
      <nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/#release-catalog">Releases</a></nav>
      <div className="card-heading"><h2 id="release-detail-title">{selectedRelease.label}</h2><span className="badge badge-state">Immutable</span></div>
      <p>{selectedRelease.project.title} · Release {selectedRelease.releaseNumber}</p>
      <dl className="project-metadata"><div><dt>Published</dt><dd>{formatDate(selectedRelease.publishedAt)}</dd></div>
        <div><dt>Publisher</dt><dd>{selectedRelease.publishedBy.displayName}</dd></div>
        <div><dt>Approvals</dt><dd>{selectedRelease.approvalCount}</dd></div><div><dt>Sessions</dt><dd>{selectedRelease.sessionCount}</dd></div></dl>
      <details className="provenance-disclosure"><summary>Package provenance</summary><dl className="provenance-grid">
        <div><dt>Schema version</dt><dd>{selectedRelease.packageSchemaVersion}</dd></div><div><dt>Compiler version</dt><dd>{selectedRelease.compilerVersion}</dd></div>
        <div className="provenance-digest"><dt>Package digest</dt><dd><code>{selectedRelease.packageDigest}</code></dd></div></dl>
        <button className="btn-secondary" type="button" onClick={() => void copyPackageDigest(selectedRelease.packageDigest, selectedRelease.label)}>Copy package digest</button></details>
      {releases?.permissions.canExportPackage ? <a className="btn-secondary link-button" href={selectedRelease.packageUrl}>Export verified Package</a> : null}
    </article>}
    {selectedSession === null ? null : <article className="card lifecycle-detail" aria-labelledby="session-detail-title">
      <nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/#session-catalog">Sessions</a></nav>
      <div className="card-heading"><h2 id="session-detail-title">{selectedSession.title}</h2><span className="badge badge-state">{displayStatus(selectedSession.status)}</span></div>
      <p>{selectedSession.project.title} · {selectedSession.governingRelease.label}</p>
      <p>{selectedSession.readiness.complete} of {selectedSession.readiness.total} readiness checks complete. {selectedSession.readiness.blockingIncomplete} blocking check{selectedSession.readiness.blockingIncomplete === 1 ? " remains" : "s remain"}.</p>
      <p>Next step: <strong>{primarySessionAction(selectedSession).label}</strong>.</p>
      <SessionDestinationNavigation session={selectedSession} />
    </article>}

    {releases === null ? null : <section id="release-catalog" aria-labelledby="releases-title">
      <div className="section-heading"><h2 id="releases-title">Simulation Releases</h2></div>
      <form className="card portal-filter" onSubmit={(event) => { event.preventDefault(); void load(); }} aria-label="Find Releases">
        <div className="field"><label htmlFor="release-search">Search Releases</label><input id="release-search" type="search" maxLength={100} value={releaseQuery} onChange={(event) => setReleaseQuery(event.target.value)} /></div>
        <div className="filter-actions"><button className="btn-secondary" type="submit">Search Releases</button>
          {releaseQuery.trim() === "" ? null : <button className="btn-secondary" type="button" onClick={clearReleaseSearch}>Clear Release search</button>}</div></form>
      {releases.permissions.canImportPackage ? <form className="card package-import" onSubmit={(event) => void importPackage(event)}>
        <h3>Import a Release Package</h3><p className="hint">Plenum verifies the Package before adding its immutable Release. Importing an existing Package does not create a duplicate.</p>
        <div className="field"><label htmlFor="release-package">Release Package file</label><input id="release-package" name="releasePackage" type="file" accept="application/json,.json" required aria-describedby="release-package-help" />
          <p className="hint" id="release-package-help">Choose a Plenum Release Package in JSON format.</p></div>
        <button className="btn-secondary" type="submit" disabled={pending}>{pending ? "Verifying Package..." : "Verify and import Release"}</button></form> : null}
      {releases.releases.length === 0 ? <div className="empty-state"><h3>{releaseQuery.trim() === "" ? "No Releases published yet" : "No matching Releases"}</h3>
        <p>{releaseQuery.trim() === "" ? "Publish a validated Project Draft to create the first immutable Release." : `No Release or Project name matches “${releaseQuery.trim()}”.`}</p>
        {releaseQuery.trim() === "" ? null : <button className="btn-secondary" type="button" onClick={clearReleaseSearch}>Show all Releases</button>}</div> :
        <ul className="release-list catalog-list">{releases.releases.map((release) => <li className="lifecycle-row catalog-row" id={`release-row-${release.id}`} key={release.id}><div>
          <div className="card-heading"><h3><a href={release.detailUrl}>{release.label}</a></h3><span className="badge badge-state">Immutable</span></div>
          <dl className="catalog-facts"><div><dt>Project</dt><dd>{release.project.title}</dd></div>
            <div><dt>Published</dt><dd><time dateTime={release.publishedAt}>{formatDate(release.publishedAt)}</time><span className="fact-context"> by {release.publishedBy.displayName}</span></dd></div>
            <div><dt>Approvals</dt><dd>{release.approvalCount}</dd></div><div><dt>Sessions</dt><dd>{release.sessionCount}</dd></div></dl>
          <details className="provenance-disclosure"><summary>Package provenance</summary><dl className="provenance-grid"><div><dt>Schema version</dt><dd>{release.packageSchemaVersion}</dd></div>
            <div><dt>Compiler version</dt><dd>{release.compilerVersion}</dd></div><div className="provenance-digest"><dt>Package digest</dt><dd><code>{release.packageDigest}</code></dd></div></dl>
            <button className="btn-secondary" type="button" onClick={() => void copyPackageDigest(release.packageDigest, release.label)}>Copy package digest</button></details></div>
          <div className="project-actions catalog-row-actions">
            {releases.permissions.canExportPackage ? <a className={`${releases.permissions.canCreateSession ? "btn-secondary" : "btn-primary catalog-primary-action"} link-button`} href={release.packageUrl}>Export verified Package</a> : null}
            {releases.permissions.canCreateSession ? <button className="btn-primary catalog-primary-action" type="button" disabled={pending} aria-expanded={creatingFrom === release.id}
              aria-controls={`session-create-${release.id}`} onClick={(event) => openSessionCreation(release.id, event.currentTarget)}>Create Session from this Release</button> : releases.permissions.canExportPackage ? null : <a className="btn-primary link-button catalog-primary-action" href={release.detailUrl}>Review Release</a>}</div>
          {creatingFrom === release.id ? <form id={`session-create-${release.id}`} className="session-create" onSubmit={(event) => void createSession(event, release)}>
            <h4>Create a Session from {release.label}</h4>
            <div className="field"><label htmlFor={`session-title-${release.id}`}>Session name</label><input ref={sessionTitleRef} id={`session-title-${release.id}`} name="title" required maxLength={200} aria-describedby={`session-title-help-${release.id}`} />
              <p className="hint" id={`session-title-help-${release.id}`}>Use a name Operators and Participants can recognize.</p></div>
            <div className="field"><label htmlFor={`session-start-${release.id}`}>Scheduled start <span className="hint">(optional)</span></label><input id={`session-start-${release.id}`} name="scheduledStartAt" type="datetime-local" aria-describedby={`session-start-help-${release.id}`} />
              <p className="hint" id={`session-start-help-${release.id}`}>Leave blank if the start time has not been decided.</p></div>
            <p className="hint">The new Session will be configured with this immutable Release. Staffing and readiness come next.</p>
            <div className="actions"><button className="btn-secondary" type="button" onClick={cancelSessionCreation}>Cancel Session creation</button><button className="btn-primary" type="submit" disabled={pending}>{pending ? "Creating Session..." : "Create configured Session"}</button></div>
          </form> : null}</li>)}</ul>}
    </section>}

    {sessions === null ? null : <section id="session-catalog" aria-labelledby="sessions-title">
      <div className="section-heading"><h2 id="sessions-title">Sessions</h2></div>
      <form className="card portal-filter" onSubmit={(event) => { event.preventDefault(); void load(); }} aria-label="Find Sessions">
        <div className="field"><label htmlFor="session-search">Search Sessions</label><input id="session-search" type="search" maxLength={100} value={sessionQuery} onChange={(event) => setSessionQuery(event.target.value)} /></div>
        <div className="field"><label htmlFor="session-status">Session status</label><select id="session-status" value={sessionStatus} onChange={(event) => setSessionStatus(event.target.value)}>
          <option value="all">All</option><option value="configured">Configured</option><option value="ready">Ready</option><option value="open">Open</option>
          <option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="locked">Locked</option><option value="archived">Archived</option>
        </select></div><div className="filter-actions"><button className="btn-secondary" type="submit">Search Sessions</button>
          {sessionQuery.trim() === "" && sessionStatus === "all" ? null : <button className="btn-secondary" type="button" onClick={clearSessionFilters}>Clear Session filters</button>}</div></form>
      {sessions.sessions.length === 0 ? <div className="empty-state"><h3>{sessionQuery.trim() === "" && sessionStatus === "all" ? "No Sessions created yet" : "No matching Sessions"}</h3>
        <p>{sessionQuery.trim() === "" && sessionStatus === "all"
          ? sessions.permissions.canCreateSession ? "Create a Session from a published Release above. Staffing and readiness will follow." : "An Operator must create the first Session from a published Release."
          : "No Session matches the current search and status. Your filters are preserved."}</p>
        {sessionQuery.trim() === "" && sessionStatus === "all" ? null : <button className="btn-secondary" type="button" onClick={clearSessionFilters}>Show all Sessions</button>}</div> :
        <ul className="session-list catalog-list">{sessions.sessions.map((session) => <li className="lifecycle-row catalog-row" key={session.id}><div>
          <div className="card-heading"><h3><a href={session.urls.detail}>{session.title}</a></h3><span className="badge badge-state">{displayStatus(session.status)}</span></div>
          <dl className="catalog-facts"><div><dt>Project</dt><dd>{session.project.title}</dd></div><div><dt>Release</dt><dd>{session.governingRelease.label}</dd></div>
            <div><dt>Readiness</dt><dd>{session.readiness.complete} of {session.readiness.total}</dd></div><div><dt>Participants</dt><dd>{session.participantCount}</dd></div></dl></div>
          <div className="project-actions catalog-row-actions"><a className="btn-primary link-button catalog-primary-action" href={session.urls[primarySessionAction(session).destination]}>{primarySessionAction(session).label}</a></div>
        </li>)}</ul>}
    </section>}
    {isAdmin ? <AdministrationNavigation /> : null}
  </section>;
}
