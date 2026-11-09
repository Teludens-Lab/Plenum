import { formatDate, displayStatus, statusClass } from "../../../../packages/design-system/src/presentation.mjs";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  type ErrorEnvelopeV1,
  type ProjectMutationV1,
  type ProjectPortalV1,
  type SimulationTemplateSummaryV1,
  type TemplateLibraryV1
} from "@plenum/event-contracts";
import { navigateWithLoader, PlenumLoader } from "../PlenumLoader.js";

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
  const [mode, setMode] = useState<"blank" | "template" | "package">("blank");
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
      let result: ProjectMutationV1;
      if (mode === "package") {
        const file = form.get("releasePackage");
        if (!(file instanceof File) || file.size === 0 || file.size > 32_000_000) throw new Error("Choose a Release Package of at most 32 MB.");
        const bytes = await file.arrayBuffer();
        const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (value) => value.toString(16).padStart(2, "0")).join("");
        result = await request<ProjectMutationV1>(`/v1/projects/import-package?${new URLSearchParams({ requestId, title, sha256 })}`, {
          method: "POST", headers: { "content-type": "application/vnd.plenum.release+json" }, body: bytes
        });
      } else result = await request<ProjectMutationV1>("/v1/projects", {
        method: "POST",
        body: JSON.stringify({ requestId, title,
          ...(mode === "template" ? { templateId: selectedTemplateId, includeScenario } : {}) })
      });
      createRequestIdRef.current = null;
      setMessage("Project created. Opening its Draft.");
      navigateWithLoader(result.editorUrl);
    } catch (cause) {
      setNoticeKind("error");
      setMessage(`${cause instanceof PortalError ? "Project creation was rejected." : "Project creation could not be confirmed."} ${cause instanceof Error ? cause.message : "Try again."} Your entries are preserved; retry unchanged entries to recover the original result.`);
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
    createRequestIdRef.current = null;
    setMode("template");
    setSelectedTemplateId(templateId);
    setIncludeScenario(false);
    setMessage("Simulation Template selected. Scenario content remains excluded unless you choose it.");
    requestAnimationFrame(() => titleRef.current?.focus());
  }

  if (state === "loading" && portal === null) return <PlenumLoader label="Loading recent Project work" />;

  if (state === "denied") return <section className="workspace-section portal-state teludens-state" data-state="unauthorized">
    <p className="eyebrow">Projects</p><h2>Project access unavailable</h2>
    <p>Designer, Admin, Publisher, or Reviewer authority is required. Operator authority remains separate.</p>
  </section>;

  if (state === "error" && portal === null) return <section className="workspace-section portal-state teludens-state" data-state="error">
    <p className="eyebrow">Projects</p><h2>Projects did not load</h2><p>{message}</p>
    <button className="btn-secondary" type="button" onClick={() => void load()}>Retry Projects</button>
  </section>;

  if (portal === null) return null;
  const selectedTemplate = templates?.templates.find(({ id }) => id === selectedTemplateId);
  const nextCursor = portal.nextCursor;

  return <section id="projects" className="portal-workspace" aria-label="Projects workspace">
    <p ref={noticeRef} className="live-region portal-notice" role={noticeKind === "error" ? "alert" : "status"} aria-live={noticeKind === "error" ? "assertive" : "polite"}
      aria-atomic="true" tabIndex={-1}>{message}</p>

    <form className="workspace-section portal-filter" onSubmit={(event) => { event.preventDefault(); void load(); }} aria-label="Find Projects">
      <div className="field"><label htmlFor="project-search">Search Projects</label><input id="project-search" type="search" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <div className="field"><label htmlFor="project-status">Status</label><select id="project-status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
        <option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option>
      </select></div>
      <div className="filter-actions"><button className="btn-secondary" type="submit">Search Projects</button>
        {query.trim() === "" && status === "active" ? null : <button className="btn-secondary" type="button" onClick={clearProjectFilters}>Clear Project filters</button>}</div>
    </form>

    {portal.permissions.canCreateProject ? <form className="workspace-section project-create teludens-path" onChange={() => { if (!pending) createRequestIdRef.current = null; }} onSubmit={(event) => void create(event)}>
      <h2>Create a Project</h2>
      <fieldset disabled={pending}><legend>Starting point</legend>
        <label className="choice"><input type="radio" name="startingPoint" value="blank" checked={mode === "blank"} onChange={() => { setMode("blank"); setSelectedTemplateId(""); setIncludeScenario(false); }} />Blank Core Design</label>
        <label className="choice"><input type="radio" name="startingPoint" value="template" checked={mode === "template"} onChange={() => setMode("template")} disabled={(templates?.templates.length ?? 0) === 0} />Simulation Template</label>
        <label className="choice"><input type="radio" name="startingPoint" value="package" checked={mode === "package"} onChange={() => setMode("package")} />Release Package file</label>
      </fieldset>
      <div className="field"><label htmlFor="new-project-title">Project name</label><input ref={titleRef} id="new-project-title" name="title" required disabled={pending} maxLength={200} aria-describedby="new-project-title-help" />
        <p className="hint" id="new-project-title-help">Use a name that distinguishes this design from other work in the Organization.</p></div>
      {mode === "template" ? <><div className="field"><label htmlFor="new-project-template">Simulation Template</label><select id="new-project-template" required disabled={pending} value={selectedTemplateId} onChange={(event) => { setSelectedTemplateId(event.target.value); setIncludeScenario(false); }}>
        <option value="" disabled>Choose a Simulation Template</option>{templates?.templates.map((template) => <option key={template.id} value={template.id}>{templateLabel(template)}</option>)}
      </select></div>
      <label className="choice"><input type="checkbox" checked={includeScenario} disabled={pending || selectedTemplate?.includesOptionalScenario !== true} onChange={(event) => setIncludeScenario(event.target.checked)} />Copy optional Scenario content</label>
      <p className="hint">Core Design is copied. Scenario content is excluded by default.</p></> : null}
      {mode === "package" ? <div className="field"><label htmlFor="project-release-package">Release Package</label>
        <input id="project-release-package" name="releasePackage" type="file" required disabled={pending} accept=".json,application/vnd.plenum.release+json" aria-describedby="project-package-help" />
        <p className="hint" id="project-package-help">Choose an exported Release Package, up to 32 MB. Its Core Design and Scenario become a new local Draft. Review every element before requesting local approval and publication.</p>
      </div> : null}
      <button className="btn-primary" type="submit" disabled={pending || (mode === "template" && selectedTemplateId === "")}>{pending ? "Creating Project..." : "Create Project and open Draft"}</button>
    </form> : <section className="workspace-section portal-readonly"><p className="eyebrow">Read-only</p><h2>Review access</h2><p>Your Organization Role can inspect Project status and open review work, but cannot create, archive, or reopen Projects.</p></section>}

    <section aria-labelledby="recent-projects-title">
      <div className="section-heading"><h2 id="recent-projects-title">{status === "active" ? "Active Projects" : status === "archived" ? "Archived Projects" : "All Projects"}</h2></div>
      {portal.projects.length === 0 ? <div className="empty-state"><h3>{query.trim() !== "" ? "No matching Projects" : status === "archived" ? "No archived Projects" : "No active Projects yet"}</h3>
        <p>{query.trim() !== "" ? `No Project name matches “${query.trim()}” in the selected status.` : status === "archived" ? "Archived Projects will appear here and can be reopened." : portal.permissions.canCreateProject ? "Create a blank Project or start from a Simulation Template." : "There are no active Projects available to review."}</p>
        {query.trim() === "" && status === "active" ? null : <button className="btn-secondary" type="button" onClick={clearProjectFilters}>Show active Projects</button>}</div> :
        <ul className="project-list catalog-list">{portal.projects.map((project) => <li className="project-row catalog-row" key={project.id}>
          <div className="project-row-main"><div className="card-heading"><h3><a href={project.editorUrl}>{project.title}</a></h3><span className={statusClass(project.lifecycleStatus)}>{project.lifecycleStatus === "active" ? "Active" : "Archived"}</span></div>
            <dl className="project-metadata"><div><dt>Owner</dt><dd>{project.owner.displayName}</dd></div><div><dt>Last activity</dt><dd><time dateTime={project.updatedAt}>{formatDate(project.updatedAt)}</time></dd></div><div><dt>Release status</dt><dd>{project.releaseCount === 0 ? "Draft only" : `${project.releaseCount} published Release${project.releaseCount === 1 ? "" : "s"}`}</dd></div>
              <div><dt>Starting point</dt><dd>{project.sourceTemplate?.title ?? "Local Draft"}</dd></div></dl>
            {project.collaborators.length > 0 ? <p className="hint">Collaborators: {project.collaborators.map(({ displayName, roles }) => `${displayName} (${roles.map(displayStatus).join(", ")})`).join("; ")}</p> : null}
          </div>
          <div className="project-actions catalog-row-actions">
            <a className="btn-secondary link-button" href={`/projects/${project.id}/demo`}>Open QA demo</a>
            {project.lifecycleStatus === "active" ? <a className="btn-primary link-button catalog-primary-action" href={project.editorUrl}>{portal.permissions.canManageProjects ? "Open Project Draft" : "Review Project"}</a> : null}
            {portal.permissions.canManageProjects && project.lifecycleStatus === "active" ? <button className="btn-secondary" type="button" disabled={pending} aria-expanded={confirmArchiveId === project.id}
              aria-controls={`archive-confirmation-${project.id}`} onClick={(event) => openArchive(project.id, event.currentTarget)}>Archive Project</button> : null}
            {portal.permissions.canManageProjects && project.lifecycleStatus === "archived" ? <button className="btn-primary catalog-primary-action" type="button" disabled={pending} onClick={() => void changeLifecycle(project.id, project.version, "reopen")}>Reopen Project</button> : null}
            {!portal.permissions.canManageProjects && project.lifecycleStatus === "archived" ? <a className="btn-primary link-button catalog-primary-action" href={project.editorUrl}>Review archived Project</a> : null}
          </div>
          {confirmArchiveId === project.id ? <div id={`archive-confirmation-${project.id}`} className="archive-confirmation" role="group" aria-labelledby={`archive-title-${project.id}`}>
            <h4 id={`archive-title-${project.id}`}>Archive “{project.title}”?</h4><p>The Project will leave Active Projects. Existing published Releases remain available and unchanged. You can reopen the Project later.</p>
            <div className="actions"><button ref={archiveCancelRef} className="btn-secondary" type="button" disabled={pending} onClick={cancelArchive}>Keep Project active</button>
              <button className="btn-primary" type="button" disabled={pending} onClick={() => void changeLifecycle(project.id, project.version, "archive")}>Archive Project</button></div></div> : null}
        </li>)}</ul>}
      {nextCursor === null ? null : <button className="btn-secondary" type="button" disabled={pending} onClick={() => void load({ cursor: nextCursor, append: true })}>Load more Projects</button>}
    </section>

    <section aria-labelledby="templates-title"><div className="section-heading"><h2 id="templates-title">Simulation Templates</h2></div>
      {(templates?.templates.length ?? 0) === 0 ? <div className="empty-state"><h3>No Simulation Templates available</h3><p>No Templates are published to this Organization library. You can still start with a blank Core Design.</p></div> : <ul className="template-list">{templates?.templates.map((template) => <li className="template-row" key={template.id}><div><h3>{template.title}</h3><p>{template.summary || "Reusable Core Design"}</p><p className="hint">Published {formatDate(template.publishedAt)}. {template.includesOptionalScenario ? "Optional Scenario content is available." : "Core Design only."}</p></div>
        {portal.permissions.canCreateProject ? <button className="btn-secondary" type="button" disabled={pending} onClick={() => chooseTemplate(template.id)}>Start from Template</button> : null}</li>)}</ul>}
    </section>

    {portal.permissions.canViewMembers && portal.members !== undefined ? <section className="workspace-section organization-members" aria-labelledby="members-title"><h2 id="members-title">Organization members and roles</h2><ul>{portal.members.map((member) => <li key={member.id}><span>{member.displayName}</span><span>{member.roles.join(", ")}</span></li>)}</ul></section> : null}
  </section>;
}
