import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  type ErrorEnvelopeV1,
  type ProjectMutationV1,
  type ProjectPortalV1,
  type SimulationTemplateSummaryV1,
  type TemplateLibraryV1
} from "@plenum/event-contracts";

class PortalError extends Error {
  constructor(readonly status: number, readonly envelope: ErrorEnvelopeV1) {
    super(envelope.error.message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json() as T | ErrorEnvelopeV1;
  if (!response.ok) {
    if (typeof body === "object" && body !== null && "error" in body) throw new PortalError(response.status, body as ErrorEnvelopeV1);
    throw new Error(`Request failed with status ${response.status}`);
  }
  return body as T;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function templateLabel(template: SimulationTemplateSummaryV1): string {
  return template.includesOptionalScenario ? `${template.title} (optional Scenario available)` : template.title;
}

export function ProjectPortal() {
  const [portal, setPortal] = useState<ProjectPortalV1 | null>(null);
  const [templates, setTemplates] = useState<TemplateLibraryV1 | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied" | "error">("loading");
  const [message, setMessage] = useState("Loading recent Project work.");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"active" | "archived" | "all">("active");
  const [mode, setMode] = useState<"blank" | "template">("blank");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [includeScenario, setIncludeScenario] = useState(false);
  const [pending, setPending] = useState(false);
  const [noticeKind, setNoticeKind] = useState<"status" | "error">("status");
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const archiveTriggerRef = useRef<HTMLButtonElement | null>(null);
  const archiveCancelRef = useRef<HTMLButtonElement | null>(null);
  const createRequestIdRef = useRef<string | null>(null);
  const lifecycleRequestRef = useRef<{ key: string; requestId: string } | null>(null);

  const load = useCallback(async (options?: { cursor?: string; append?: boolean; query?: string; status?: typeof status }) => {
    const requestedQuery = options?.query ?? query;
    const requestedStatus = options?.status ?? status;
    if (!options?.append) setState("loading");
    setNoticeKind("status");
    setMessage(options?.append ? "Loading more Projects." : portal === null ? "Loading Projects." : "Refreshing Projects.");
    const parameters = new URLSearchParams({ limit: "10", status: requestedStatus });
    if (requestedQuery.trim() !== "") parameters.set("query", requestedQuery.trim());
    if (options?.cursor !== undefined) parameters.set("cursor", options.cursor);
    try {
      const [nextPortal, nextTemplates] = await Promise.all([
        request<ProjectPortalV1>(`/v1/projects?${parameters}`),
        templates === null ? request<TemplateLibraryV1>("/v1/templates?limit=20") : Promise.resolve(templates)
      ]);
      setPortal((current) => options?.append && current !== null
        ? { ...nextPortal, projects: [...current.projects, ...nextPortal.projects] }
        : nextPortal);
      setTemplates(nextTemplates);
      setState("ready");
      setMessage(nextPortal.projects.length === 0
        ? requestedQuery.trim() === "" ? `No ${requestedStatus === "all" ? "" : `${requestedStatus} `}Projects are available.` : "No Projects match your search."
        : `${nextPortal.projects.length} Project${nextPortal.projects.length === 1 ? "" : "s"} shown.`);
    } catch (cause) {
      setNoticeKind("error");
      if (cause instanceof PortalError && cause.status === 403) {
        setPortal(null);
        setTemplates(null);
        setState("denied");
        setMessage("Your current Organization Role does not include Project access.");
      } else {
        setState("error");
        setMessage(`Projects could not be loaded. ${cause instanceof Error ? cause.message : "Try again."}`);
      }
    }
  }, [portal, query, status, templates]);

  useEffect(() => { void load(); }, []); // The first load uses the default active view.

  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const requestId = createRequestIdRef.current ?? crypto.randomUUID();
    createRequestIdRef.current = requestId;
    setPending(true);
    setNoticeKind("status");
    setMessage("Creating the Project and its Draft.");
    try {
      const result = await request<ProjectMutationV1>("/v1/projects", {
        method: "POST",
        body: JSON.stringify({ requestId, title,
          ...(mode === "template" ? { templateId: selectedTemplateId, includeScenario } : {}) })
      });
      createRequestIdRef.current = null;
      setMessage("Project created. Opening its Draft.");
      window.location.assign(result.editorUrl);
    } catch (cause) {
      setNoticeKind("error");
      setMessage(`Project was not created. ${cause instanceof Error ? cause.message : "Review the form and try again."} Your entries are preserved.`);
      setPending(false);
      requestAnimationFrame(() => noticeRef.current?.focus());
    }
  }

  async function changeLifecycle(projectId: string, expectedVersion: number, action: "archive" | "reopen"): Promise<void> {
    const key = `${projectId}:${expectedVersion}:${action}`;
    const requestId = lifecycleRequestRef.current?.key === key
      ? lifecycleRequestRef.current.requestId
      : crypto.randomUUID();
    lifecycleRequestRef.current = { key, requestId };
    setPending(true);
    setNoticeKind("status");
    setMessage(action === "archive" ? "Archiving the Project." : "Reopening the Project.");
    try {
      await request<ProjectMutationV1>(`/v1/projects/${projectId}/${action}`, {
        method: "POST", body: JSON.stringify({ requestId, expectedVersion })
      });
      lifecycleRequestRef.current = null;
      setConfirmArchiveId(null);
      await load();
      setMessage(action === "archive" ? "Project archived. Published Releases remain available and unchanged." : "Project reopened and returned to Active Projects.");
      requestAnimationFrame(() => noticeRef.current?.focus());
    } catch (cause) {
      setNoticeKind("error");
      setMessage(`Project status did not change. ${cause instanceof Error ? cause.message : "Refresh and try again."}`);
      if (cause instanceof PortalError && cause.status === 409) {
        lifecycleRequestRef.current = null;
        setConfirmArchiveId(null);
        await load();
        setNoticeKind("error");
        setMessage("Project state changed in another tab. This view was refreshed.");
        requestAnimationFrame(() => noticeRef.current?.focus());
      }
    } finally {
      setPending(false);
    }
  }

  function openArchive(projectId: string, trigger: HTMLButtonElement): void {
    archiveTriggerRef.current = trigger;
    setConfirmArchiveId(projectId);
    requestAnimationFrame(() => archiveCancelRef.current?.focus());
  }

  function cancelArchive(): void {
    setConfirmArchiveId(null);
    requestAnimationFrame(() => archiveTriggerRef.current?.focus());
  }

  function clearProjectFilters(): void {
    setQuery("");
    setStatus("active");
    void load({ query: "", status: "active" });
  }

  function chooseTemplate(templateId: string): void {
    setMode("template");
    setSelectedTemplateId(templateId);
    setIncludeScenario(false);
    setMessage("Simulation Template selected. Scenario content remains excluded unless you choose it.");
    requestAnimationFrame(() => titleRef.current?.focus());
  }

  if (state === "loading" && portal === null) return <section className="card portal-state teludens-state" aria-busy="true">
    <p className="eyebrow">Projects</p><h2>Loading recent work</h2><p>Checking current Organization access and Project status.</p>
  </section>;

  if (state === "denied") return <section className="card portal-state teludens-state" data-state="unauthorized">
    <p className="eyebrow">Projects</p><h2>Project access unavailable</h2>
    <p>Designer, Admin, Publisher, or Reviewer authority is required. Operator authority remains separate.</p>
  </section>;

  if (state === "error" && portal === null) return <section className="card portal-state teludens-state" data-state="error">
    <p className="eyebrow">Projects</p><h2>Projects did not load</h2><p>{message}</p>
    <button className="btn-secondary" type="button" onClick={() => void load()}>Retry Projects</button>
  </section>;

  if (portal === null) return null;
  const selectedTemplate = templates?.templates.find(({ id }) => id === selectedTemplateId);
  const nextCursor = portal.nextCursor;

  return <section id="projects" className="portal-workspace" aria-labelledby="projects-title">
    <div className="card portal-toolbar teludens-gate">
      <div><p className="eyebrow">Current workspace</p><h2 id="projects-title">Projects</h2></div>
      <div className="field organization-switcher"><label htmlFor="organization-context">Organization</label>
        <select id="organization-context" value={portal.organization.id} disabled aria-describedby="organization-context-help">
          {portal.availableOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
        </select><p className="hint" id="organization-context-help">Sign out to change to another authenticated Organization context.</p></div>
    </div>
    <p ref={noticeRef} className="live-region portal-notice" role={noticeKind === "error" ? "alert" : "status"} aria-live={noticeKind === "error" ? "assertive" : "polite"}
      aria-atomic="true" tabIndex={-1}>{message}</p>

    <form className="card portal-filter" onSubmit={(event) => { event.preventDefault(); void load(); }} aria-label="Find Projects">
      <div className="field"><label htmlFor="project-search">Search Projects</label><input id="project-search" type="search" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <div className="field"><label htmlFor="project-status">Status</label><select id="project-status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
        <option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option>
      </select></div>
      <div className="filter-actions"><button className="btn-secondary" type="submit">Search Projects</button>
        {query.trim() === "" && status === "active" ? null : <button className="btn-secondary" type="button" onClick={clearProjectFilters}>Clear Project filters</button>}</div>
    </form>

    {portal.permissions.canCreateProject ? <form className="card project-create teludens-path" onSubmit={(event) => void create(event)}>
      <p className="eyebrow">Start work</p><h3>Create a Project</h3>
      <fieldset><legend>Starting point</legend>
        <label className="choice"><input type="radio" name="startingPoint" value="blank" checked={mode === "blank"} onChange={() => { setMode("blank"); setSelectedTemplateId(""); setIncludeScenario(false); }} />Blank Core Design</label>
        <label className="choice"><input type="radio" name="startingPoint" value="template" checked={mode === "template"} onChange={() => setMode("template")} disabled={(templates?.templates.length ?? 0) === 0} />Simulation Template</label>
      </fieldset>
      <div className="field"><label htmlFor="new-project-title">Project name</label><input ref={titleRef} id="new-project-title" name="title" required maxLength={200} aria-describedby="new-project-title-help" />
        <p className="hint" id="new-project-title-help">Use a name that distinguishes this design from other work in the Organization.</p></div>
      {mode === "template" ? <><div className="field"><label htmlFor="new-project-template">Simulation Template</label><select id="new-project-template" required value={selectedTemplateId} onChange={(event) => { setSelectedTemplateId(event.target.value); setIncludeScenario(false); }}>
        <option value="" disabled>Choose a Simulation Template</option>{templates?.templates.map((template) => <option key={template.id} value={template.id}>{templateLabel(template)}</option>)}
      </select></div>
      <label className="choice"><input type="checkbox" checked={includeScenario} disabled={selectedTemplate?.includesOptionalScenario !== true} onChange={(event) => setIncludeScenario(event.target.checked)} />Copy optional Scenario content</label>
      <p className="hint">Core Design is copied. Scenario content is excluded by default.</p></> : null}
      <button className="btn-primary" type="submit" disabled={pending || (mode === "template" && selectedTemplateId === "")}>{pending ? "Creating Project..." : "Create Project and open Draft"}</button>
    </form> : <section className="card portal-readonly"><p className="eyebrow">Read-only</p><h3>Review access</h3><p>Your Organization Role can inspect Project status and open review work, but cannot create, archive, or reopen Projects.</p></section>}

    <section aria-labelledby="recent-projects-title">
      <div className="section-heading"><p className="eyebrow">Recent work</p><h3 id="recent-projects-title">{status === "active" ? "Active Projects" : status === "archived" ? "Archived Projects" : "All Projects"}</h3></div>
      {portal.projects.length === 0 ? <div className="empty-state"><h4>{query.trim() !== "" ? "No matching Projects" : status === "archived" ? "No archived Projects" : "No active Projects yet"}</h4>
        <p>{query.trim() !== "" ? `No Project name matches “${query.trim()}” in the selected status.` : status === "archived" ? "Archived Projects will appear here and can be reopened." : portal.permissions.canCreateProject ? "Create a blank Project or start from a Simulation Template." : "There are no active Projects available to review."}</p>
        {query.trim() === "" && status === "active" ? null : <button className="btn-secondary" type="button" onClick={clearProjectFilters}>Show active Projects</button>}</div> :
        <ul className="project-list catalog-list">{portal.projects.map((project) => <li className="project-row catalog-row" key={project.id}>
          <div className="project-row-main"><div className="card-heading"><h4><a href={project.editorUrl}>{project.title}</a></h4><span className={`badge ${project.lifecycleStatus === "active" ? "badge-online" : "badge-state"}`}>{project.lifecycleStatus === "active" ? "Active" : "Archived"}</span></div>
            <dl className="project-metadata"><div><dt>Owner</dt><dd>{project.owner.displayName}</dd></div><div><dt>Last activity</dt><dd><time dateTime={project.updatedAt}>{formatDate(project.updatedAt)}</time></dd></div><div><dt>Release status</dt><dd>{project.releaseCount === 0 ? "Draft only" : `${project.releaseCount} published Release${project.releaseCount === 1 ? "" : "s"}`}</dd></div>
              <div><dt>Starting point</dt><dd>{project.sourceTemplate?.title ?? "Blank Core Design"}</dd></div></dl>
            {project.collaborators.length > 0 ? <p className="hint">Collaborators: {project.collaborators.map(({ displayName, roles }) => `${displayName} (${roles.join(", ")})`).join("; ")}</p> : null}
          </div>
          <div className="project-actions catalog-row-actions">
            {project.lifecycleStatus === "active" ? <a className="btn-primary link-button catalog-primary-action" href={project.editorUrl}>{portal.permissions.canManageProjects ? "Open Project Draft" : "Review Project"}</a> : null}
            {portal.permissions.canManageProjects && project.lifecycleStatus === "active" ? <button className="btn-secondary" type="button" disabled={pending} aria-expanded={confirmArchiveId === project.id}
              aria-controls={`archive-confirmation-${project.id}`} onClick={(event) => openArchive(project.id, event.currentTarget)}>Archive Project</button> : null}
            {portal.permissions.canManageProjects && project.lifecycleStatus === "archived" ? <button className="btn-primary catalog-primary-action" type="button" disabled={pending} onClick={() => void changeLifecycle(project.id, project.version, "reopen")}>Reopen Project</button> : null}
            {!portal.permissions.canManageProjects && project.lifecycleStatus === "archived" ? <a className="btn-primary link-button catalog-primary-action" href={project.editorUrl}>Review archived Project</a> : null}
          </div>
          {confirmArchiveId === project.id ? <div id={`archive-confirmation-${project.id}`} className="archive-confirmation" role="group" aria-labelledby={`archive-title-${project.id}`}>
            <h5 id={`archive-title-${project.id}`}>Archive “{project.title}”?</h5><p>The Project will leave Active Projects. Existing published Releases remain available and unchanged. You can reopen the Project later.</p>
            <div className="actions"><button ref={archiveCancelRef} className="btn-secondary" type="button" disabled={pending} onClick={cancelArchive}>Keep Project active</button>
              <button className="btn-primary" type="button" disabled={pending} onClick={() => void changeLifecycle(project.id, project.version, "archive")}>Archive Project</button></div></div> : null}
        </li>)}</ul>}
      {nextCursor === null ? null : <button className="btn-secondary" type="button" disabled={pending} onClick={() => void load({ cursor: nextCursor, append: true })}>Load more Projects</button>}
    </section>

    <section aria-labelledby="templates-title"><div className="section-heading"><p className="eyebrow">Organization library</p><h3 id="templates-title">Simulation Templates</h3></div>
      {(templates?.templates.length ?? 0) === 0 ? <div className="empty-state"><h4>No Simulation Templates available</h4><p>No Templates are published to this Organization library. You can still start with a blank Core Design.</p></div> : <ul className="template-list">{templates?.templates.map((template) => <li className="card template-row" key={template.id}><div><h4>{template.title}</h4><p>{template.summary || "Reusable Core Design"}</p><p className="hint">Published {formatDate(template.publishedAt)}. {template.includesOptionalScenario ? "Optional Scenario content is available." : "Core Design only."}</p></div>
        {portal.permissions.canCreateProject ? <button className="btn-secondary" type="button" onClick={() => chooseTemplate(template.id)}>Start from Template</button> : null}</li>)}</ul>}
    </section>

    {portal.permissions.canViewMembers && portal.members !== undefined ? <section className="card organization-members" aria-labelledby="members-title"><p className="eyebrow">Admin view</p><h3 id="members-title">Organization members and roles</h3><ul>{portal.members.map((member) => <li key={member.id}><span>{member.displayName}</span><span>{member.roles.join(", ")}</span></li>)}</ul></section> : null}
  </section>;
}
