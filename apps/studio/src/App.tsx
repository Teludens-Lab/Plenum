import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { ProductShellContextV1, PublicationReviewV1, SimulationTemplateSummaryV1, StudioPublishV1, TemplateLibraryV1 } from "@plenum/event-contracts";

import { StudioCollaborationClient, type StudioClientState } from "./collaboration/client.js";
import { editorSectionIdForTarget, editorSectionLabel, VisualCoreDesignEditor } from "./core-design/Editor.js";
import { LiveReleaseActivation } from "./live-changes/LiveReleaseActivation.js";
import { navigateWithLoader, PlenumLoader } from "./PlenumLoader.js";

const initialState: StudioClientState = { connected: false, generation: 1, saveState: "saved_on_device",
  unsynchronizedChanges: 0, validation: null, message: "Connecting to the collaboration service." };

function projectIdFromPath(): string | null {
  return location.pathname.match(/^\/studio\/projects\/([0-9a-f-]{36})\/?$/iu)?.[1] ?? null;
}

function sourceId(path: string): string {
  if (path.startsWith("scenario.name")) return "scenario-name";
  if (path.startsWith("scenario.description")) return "scenario-description";
  const [collection, elementId] = path.split(".");
  const sections: Record<string, string> = {
    teams: "teams", sessionRoles: "roles", seats: "seats", activities: "activities", stages: "stages", stageGroups: "stages",
    forms: "forms", artifactTypes: "forms", workflows: "workflows", informationPolicies: "policies",
    interfaces: "interfaces", methodologyConcepts: "methodology", researchQuestions: "research",
    decisionTraceability: "research", measurementDefinitions: "measurements-reports", reports: "measurements-reports",
    accessPolicy: "access", communications: "policies", pluginBindings: "plugins", compositions: "compositions",
    stateVariables: "advanced-logic", capabilities: "advanced-logic", resourceDefinitions: "advanced-logic",
    adjudicationModels: "adjudication",
    objectives: "overview", identity: "overview", terminology: "overview", coreDesign: "overview", draft: "overview", scenario: "overview"
  };
  if (elementId !== undefined && ["objectives", "teams", "sessionRoles", "seats", "activities", "stages", "stageGroups", "forms", "workflows", "informationPolicies", "interfaces", "pluginBindings", "compositions"].includes(collection ?? "")) {
    return `${collection}-${elementId}`;
  }
  return sections[collection ?? ""] ?? "overview";
}

function focusIssue(source: string, attempt = 0): void {
  const target = document.getElementById(source);
  if (target === null) {
    if (attempt < 6) requestAnimationFrame(() => focusIssue(source, attempt + 1));
    return;
  }
  const details = target instanceof HTMLDetailsElement ? target : target.closest("details");
  if (details instanceof HTMLDetailsElement) details.open = true;
  const control = target.matches("input, select, textarea, button") ? target as HTMLElement :
    target.querySelector<HTMLElement>("input, select, textarea, button");
  requestAnimationFrame(() => control?.focus());
}

function revealIssue(source: string): void {
  location.hash = source;
  requestAnimationFrame(() => focusIssue(source));
}

function saveStateLabel(saveState: StudioClientState["saveState"]): string {
  if (saveState === "saved_on_device") return "Saved on this device";
  if (saveState === "synchronized") return "Synchronized";
  if (saveState === "validation_required") return "Validation required";
  return "Published";
}

function BrandWordmark() {
  return <a className="brand-wordmark" href="/" aria-label="Plenum home">
    <img className="brand-wordmark-dark" src="/branding/plenum-wordmark-primary.png" alt="Plenum" width="2170" height="725" />
    <img className="brand-wordmark-light" src="/branding/plenum-wordmark-primary.png" alt="" width="2170" height="725" aria-hidden="true" />
  </a>;
}

function friendlyReference(value: string, fallback: string): string {
  if (value.trim() === "") return fallback;
  return value.replaceAll(/[-_]+/gu, " ").replaceAll(/\b\w/gu, (letter) => letter.toUpperCase());
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("plenum.theme", theme); } catch { /* The document theme still applies when storage is unavailable. */ }
    const synchronizeTheme = (event: StorageEvent) => {
      if (event.key === "plenum.theme") setTheme(event.newValue === "dark" ? "dark" : "light");
    };
    window.addEventListener("storage", synchronizeTheme);
    return () => window.removeEventListener("storage", synchronizeTheme);
  }, [theme]);
  const nextTheme = theme === "light" ? "dark" : "light";
  return <button className="btn-secondary theme-toggle" type="button"
    aria-label={`Theme: ${theme}. Use ${nextTheme} theme`} title={`Use ${nextTheme} theme`}
    onClick={() => setTheme(nextTheme)}>
    {theme === "light" ? <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
    </svg> : <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />
    </svg>}
  </button>;
}

export function App() {
  const projectId = projectIdFromPath();
  const client = useMemo(() => projectId === null ? null : new StudioCollaborationClient(projectId), [projectId]);
  const [state, setState] = useState(initialState);
  const [publishing, setPublishing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [freezeId, setFreezeId] = useState("");
  const [reviewWorkspace, setReviewWorkspace] = useState<PublicationReviewV1 | null>(null);
  const [templates, setTemplates] = useState<SimulationTemplateSummaryV1[]>([]);
  const [templatePublishing, setTemplatePublishing] = useState(false);
  const [templateLifecycleId, setTemplateLifecycleId] = useState("");
  const [templateLifecycleRationale, setTemplateLifecycleRationale] = useState("");
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [productContext, setProductContext] = useState<ProductShellContextV1 | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLElement>(null);
  const accountToggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (client === null) return;
    const unsubscribe = client.subscribe(setState);
    client.connect();
    return () => { unsubscribe(); client.stop(); };
  }, [client]);

  useEffect(() => {
    let active = true;
    void fetch("/v1/product-context").then(async (response) => {
      if (!response.ok) return;
      const context = await response.json() as ProductShellContextV1;
      if (active) setProductContext(context);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const dismissOnPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || accountMenuRef.current?.contains(event.target) || accountToggleRef.current?.contains(event.target)) return;
      setAccountOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAccountOpen(false);
      requestAnimationFrame(() => accountToggleRef.current?.focus());
    };
    document.addEventListener("pointerdown", dismissOnPointerDown);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOnPointerDown);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [accountOpen]);

  async function signOut(): Promise<void> {
    try {
      const response = await fetch("/v1/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error("Sign out failed.");
      navigateWithLoader("/");
    } catch {
      setAccountOpen(false);
      setPublishMessage("Sign out failed. Check your connection and try again.");
    }
  }

  function toggleAccount(): void {
    setAccountOpen((open) => {
      if (!open) requestAnimationFrame(() => accountMenuRef.current?.focus());
      return !open;
    });
  }

  async function loadReviewWorkspace(): Promise<void> {
    if (projectId === null) return;
    try {
      const response = await fetch(`/v1/projects/${projectId}/publication-review`);
      const body = await response.json() as PublicationReviewV1 | { error?: { message?: string } };
      if (!response.ok || !("freeze" in body)) throw new Error((body as { error?: { message?: string } }).error?.message ?? "Review workspace failed to load.");
      setReviewWorkspace(body);
      setFreezeId(body.freeze?.id ?? "");
      const templatesResponse = await fetch("/v1/templates?limit=50");
      const templateBody = await templatesResponse.json() as TemplateLibraryV1;
      if (templatesResponse.ok) {
        setTemplates(templateBody.templates);
        setTemplateLifecycleId((current) => current || templateBody.templates[0]?.id || "");
      }
    } catch (error) {
      setPublishMessage(error instanceof Error ? error.message : "Review workspace failed to load.");
    }
  }

  useEffect(() => { if (projectId !== null) void loadReviewWorkspace(); }, [projectId]);

  async function publish(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (client === null || projectId === null) return;
    setPublishing(true);
    setPublishMessage(null);
    const form = new FormData(event.currentTarget);
    const releaseLabel = String(form.get("releaseLabel") ?? "Release");
    try {
      const response = await fetch(`/v1/projects/${projectId}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        freezeId,
        releaseLabel, semanticVersion: form.get("semanticVersion"), methodologyVersion: "1.3.1",
        releaseNotes: form.get("releaseNotes"), warningsAcknowledged: form.get("warningsAcknowledged") === "on",
        classificationReviewId: form.get("classificationReviewId"), accessibilityReviewStatus: "reviewed",
        retentionPolicyId: form.get("retentionPolicyId"), approvalNotes: form.get("approvalNotes")
      }) });
      const body = await response.json() as StudioPublishV1 | { error?: { message?: string } };
      if (!response.ok || !("releaseId" in body)) throw new Error("error" in body ? body.error?.message : "Publication failed.");
      client.markPublished();
      setPublishMessage(`Published ${releaseLabel}.`);
    } catch (error) {
      setPublishMessage(error instanceof Error ? error.message : "Publication failed.");
    } finally {
      setPublishing(false);
    }
  }

  async function freezeForReview(): Promise<void> {
    if (projectId === null) return;
    setReviewing(true);
    setPublishMessage(null);
    try {
      const response = await fetch(`/v1/projects/${projectId}/publication-freezes`, { method: "POST" });
      const body = await response.json() as { freezeId?: string; error?: { message?: string } };
      if (!response.ok || body.freezeId === undefined) throw new Error(body.error?.message ?? "The Draft could not be frozen.");
      setFreezeId(body.freezeId);
      setPublishMessage("The synchronized Draft is frozen and ready for Reviewer approval.");
      await loadReviewWorkspace();
    } catch (error) {
      setPublishMessage(error instanceof Error ? error.message : "The Draft could not be frozen.");
    } finally {
      setReviewing(false);
    }
  }

  async function approveFreeze(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (projectId === null || freezeId === "") return;
    setReviewing(true);
    setPublishMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/v1/projects/${projectId}/publication-freezes/${freezeId}/approve`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notes: form.get("reviewNotes") })
      });
      const body = await response.json() as { reviewerPersonId?: string; error?: { message?: string } };
      if (!response.ok || body.reviewerPersonId === undefined) throw new Error(body.error?.message ?? "The review could not be recorded.");
      setPublishMessage("Reviewer approval was recorded for this frozen Draft.");
      await loadReviewWorkspace();
    } catch (error) {
      setPublishMessage(error instanceof Error ? error.message : "The review could not be recorded.");
    } finally {
      setReviewing(false);
    }
  }

  async function publishTemplate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (projectId === null) return;
    setTemplatePublishing(true); setPublishMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const supersedesTemplateId = String(form.get("supersedesTemplateId") ?? "");
      const response = await fetch(`/v1/projects/${projectId}/templates`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        title: form.get("templateTitle"), summary: form.get("templateSummary"),
        includeScenario: form.get("includeScenario") === "on", rationale: form.get("templateRationale"),
        ...(supersedesTemplateId === "" ? {} : { supersedesTemplateId })
      }) });
      const body = await response.json() as { templateId?: string; version?: number; error?: { message?: string } };
      if (!response.ok || body.templateId === undefined) throw new Error(body.error?.message ?? "Template publication failed.");
      setPublishMessage(`Published immutable Template version ${body.version}.`);
      await loadReviewWorkspace();
    } catch (error) { setPublishMessage(error instanceof Error ? error.message : "Template publication failed."); }
    finally { setTemplatePublishing(false); }
  }

  async function changeTemplateLifecycle(action: "deprecate" | "archive"): Promise<void> {
    if (templateLifecycleId === "" || templateLifecycleRationale.trim() === "") return;
    setTemplatePublishing(true); setPublishMessage(null);
    try {
      const response = await fetch(`/v1/templates/${templateLifecycleId}/${action}`, { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ rationale: templateLifecycleRationale }) });
      const body = await response.json() as { lifecycleStatus?: string; error?: { message?: string } };
      if (!response.ok || body.lifecycleStatus === undefined) throw new Error(body.error?.message ?? "Template lifecycle change failed.");
      setPublishMessage(`Template history now records ${body.lifecycleStatus}.`);
      setTemplateLifecycleRationale(""); await loadReviewWorkspace();
    } catch (error) { setPublishMessage(error instanceof Error ? error.message : "Template lifecycle change failed."); }
    finally { setTemplatePublishing(false); }
  }

  if (projectId === null || client === null) return <>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="app-header studio-app-header"><BrandWordmark />
      <div className="product-header-context" aria-label="Current workspace context"><h1 className="product-header-title">Studio</h1></div>
      <div className="header-actions product-header-actions"><ThemeToggle /></div>
    </header>
    <main id="main-content" className="state-page" tabIndex={-1}><section className="card state-card teludens-state">
      <h1>No Project selected</h1>
      <p>Open a saved Project link to continue editing, or return home to choose another Plenum workspace.</p>
      <a className="btn-primary link-button" href="/">Return to Plenum home</a>
    </section></main>
  </>;
  const valid = state.validation?.valid === true;
  const materialization = client.materialization();
  const coreDesignTitle = materialization.coreDesign?.identity?.title?.trim() || materialization.scenario?.name?.trim() || "Untitled Core Design";
  const organizationName = productContext?.organization.name ?? "Projects";
  const accountRole = friendlyReference(productContext?.organization.roles[0] ?? "", "Designer");
  const validationLabel = state.validation === null ? "Checking" : valid ? "Ready for review" :
    `${state.validation.issues.length} issue${state.validation.issues.length === 1 ? "" : "s"}`;
  const validationPanel = <section id="validation" className="card validation-inspector" aria-labelledby="validation-title">
    <div className="card-heading"><h2 id="validation-title">Draft checks</h2><span className={`badge ${valid ? "badge-online" : state.validation === null ? "badge-info" : "badge-error"}`}>{validationLabel}</span></div>
    {state.validation === null ? <p>Checking the synchronized Draft. You can keep editing while this finishes.</p> : state.validation.issues.length === 0 ?
      <p>No blocking issues were found. This Draft can move to review when the authoring work is complete.</p> : <>
        <p>Resolve these issues before the Draft can move to review.</p>
        <ul className="issue-list">{state.validation.issues.map((issue) => {
          const source = sourceId(issue.path);
          const section = editorSectionIdForTarget(source);
          return <li key={`${issue.code}:${issue.path}`}><a href={`#${source}`} onClick={(event) => { event.preventDefault(); revealIssue(source); }}>Open {editorSectionLabel(section)}</a><span>{issue.message}</span>
            <details className="issue-technical"><summary>Technical location</summary><code>{issue.path}</code></details></li>;
        })}</ul>
      </>}
  </section>;
  const reviewPublishWorkspace = <section id="review-publish" className="card publish-card" aria-labelledby="publish-title">
    <h2 id="publish-title" tabIndex={-1}>Review and publish</h2>
    <p className="hint">A Publisher freezes the exact synchronized state, a Reviewer approves that freeze, and a Publisher publishes it. Later edits remain in the next Draft.</p>
    <button className="btn-secondary" type="button" disabled={!reviewWorkspace?.permissions.canFreeze || !state.connected || !valid || state.unsynchronizedChanges > 0 || reviewing} onClick={() => void freezeForReview()}>{reviewing ? "Working…" : "Freeze for review"}</button>
    {reviewWorkspace?.freeze === null || reviewWorkspace === null ? <p>No frozen revision is awaiting review.</p> : <div className="freeze-summary">
      <p><strong>Frozen revision ready for review</strong></p>
      <p>Frozen {new Date(reviewWorkspace.freeze.frozenAt).toLocaleString()} by {reviewWorkspace.freeze.frozenBy.displayName}.</p>
      <p>{reviewWorkspace.approvals.length} current approval{reviewWorkspace.approvals.length === 1 ? "" : "s"}.</p>
      {reviewWorkspace.approvals.map((approval) => <p key={approval.reviewerPersonId}>Approved by {approval.reviewerDisplayName}: {approval.rationale}</p>)}
      <details className="technical-details"><summary>Technical provenance</summary><dl>
        <div><dt>Freeze reference</dt><dd><code>{reviewWorkspace.freeze.id}</code></dd></div>
        <div><dt>Artifact digest</dt><dd><code>{reviewWorkspace.freeze.artifactDigest}</code></dd></div>
        <div><dt>Validation report digest</dt><dd><code>{reviewWorkspace.freeze.validationReportDigest}</code></dd></div>
        <div><dt>Policy version</dt><dd><code>{reviewWorkspace.freeze.policyVersion}</code></dd></div>
      </dl></details>
    </div>}
    <form onSubmit={(event) => void approveFreeze(event)} aria-labelledby="review-title">
      <h3 id="review-title">Reviewer approval</h3>
      <div className="field"><label htmlFor="review-notes">Methodology review notes</label><textarea id="review-notes" name="reviewNotes" required rows={3} /></div>
      <button className="btn-secondary" type="submit" disabled={!reviewWorkspace?.permissions.canApprove || freezeId === "" || reviewing}>{reviewing ? "Working…" : "Approve freeze"}</button>
    </form>
    <form onSubmit={(event) => void publish(event)} aria-labelledby="release-title">
      <h3 id="release-title">Release details</h3>
      <div className="field"><label htmlFor="release-label">Release label</label><input id="release-label" name="releaseLabel" required maxLength={200} defaultValue="Collaborative Draft" /></div>
      <div className="field"><label htmlFor="semantic-version">Semantic version</label><input id="semantic-version" name="semanticVersion" required pattern="\d+\.\d+\.\d+" defaultValue="1.0.0" /></div>
      <div className="field"><label htmlFor="release-notes">Release notes</label><textarea id="release-notes" name="releaseNotes" required rows={4} /></div>
      <details className="technical-details governance-details"><summary>Governance references</summary>
        <p className="hint">These governed references are required by publication policy and remain attached to the Release record.</p>
        <div className="field"><label htmlFor="classification-review">Classification review reference</label><input id="classification-review" name="classificationReviewId" required onInvalid={(event) => { event.currentTarget.closest("details")?.setAttribute("open", ""); }} /></div>
        <div className="field"><label htmlFor="retention-policy">Retention policy reference</label><input id="retention-policy" name="retentionPolicyId" required onInvalid={(event) => { event.currentTarget.closest("details")?.setAttribute("open", ""); }} /></div>
      </details>
      <div className="field"><label htmlFor="approval-notes">Approval notes</label><textarea id="approval-notes" name="approvalNotes" required rows={3} /></div>
      <label className="choice"><input type="checkbox" name="warningsAcknowledged" />I acknowledge the validation warnings.</label>
      <button className="btn-primary" type="submit" disabled={!reviewWorkspace?.permissions.canPublish || (reviewWorkspace?.approvals.length ?? 0) === 0 || !state.connected || !valid || state.unsynchronizedChanges > 0 || freezeId === "" || publishing}>{publishing ? "Publishing…" : "Publish approved freeze"}</button>
    </form>
    <form onSubmit={(event) => void publishTemplate(event)} aria-labelledby="template-title">
      <h3 id="template-title">Template version</h3>
      <p className="hint">Publish the same approved frozen revision as an immutable Organization Template. Supersession preserves the earlier version and its history.</p>
      <div className="field"><label htmlFor="template-name">Template title</label><input id="template-name" name="templateTitle" required maxLength={200} /></div>
      <div className="field"><label htmlFor="template-summary">Summary</label><textarea id="template-summary" name="templateSummary" maxLength={1000} rows={3} /></div>
      <div className="field"><label htmlFor="template-supersedes">Supersedes (optional)</label><select id="template-supersedes" name="supersedesTemplateId"><option value="">New Template line</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.title} v{template.version} · {template.lifecycleStatus}</option>)}</select></div>
      <label className="choice"><input type="checkbox" name="includeScenario" />Include the optional Scenario</label>
      <div className="field"><label htmlFor="template-rationale">Publication rationale</label><textarea id="template-rationale" name="templateRationale" required rows={3} /></div>
      <button className="btn-primary" type="submit" disabled={!reviewWorkspace?.permissions.canPublish || (reviewWorkspace?.approvals.length ?? 0) === 0 || templatePublishing}>{templatePublishing ? "Publishing…" : "Publish immutable Template version"}</button>
    </form>
    <section aria-labelledby="template-history-title"><h3 id="template-history-title">Template lifecycle history</h3>
      {templates.length === 0 ? <p>No published Templates are available.</p> : <><div className="field"><label htmlFor="template-lifecycle-choice">Template version</label><select id="template-lifecycle-choice" value={templateLifecycleId} onChange={(event) => setTemplateLifecycleId(event.target.value)}>{templates.map((template) => <option key={template.id} value={template.id}>{template.title} v{template.version} · {template.lifecycleStatus}</option>)}</select></div>
        {templates.filter(({ id }) => id === templateLifecycleId).map((template) => <details key={template.id}><summary>Attributable history</summary><ol>{template.lifecycleHistory.length === 0 ? <li>Published before lifecycle attribution was introduced.</li> : template.lifecycleHistory.map((item) => <li key={`${item.eventType}-${item.occurredAt}`}>{item.eventType} by {item.actorDisplayName} on {new Date(item.occurredAt).toLocaleString()}: {item.rationale}</li>)}</ol></details>)}
        <div className="field"><label htmlFor="template-lifecycle-rationale">Lifecycle rationale</label><textarea id="template-lifecycle-rationale" rows={3} value={templateLifecycleRationale} onChange={(event) => setTemplateLifecycleRationale(event.target.value)} /></div>
        <div className="item-actions"><button className="btn-secondary" type="button" disabled={!reviewWorkspace?.permissions.canPublish || templatePublishing || templateLifecycleRationale.trim() === ""} onClick={() => void changeTemplateLifecycle("deprecate")}>Record deprecation</button><button className="btn-secondary" type="button" disabled={!reviewWorkspace?.permissions.canPublish || templatePublishing || templateLifecycleRationale.trim() === ""} onClick={() => void changeTemplateLifecycle("archive")}>Record archival</button></div></>}
    </section>
  </section>;

  return <>
    <a className="skip-link" href="#main-content">Skip to Draft editor</a>
    <header className="app-header studio-app-header"><BrandWordmark />
      <div className="product-header-context" aria-label="Current workspace context">
        <a className="product-header-organization" href="/?workspace=projects" title={`Return to Projects in ${organizationName}`}>{organizationName}</a>
        <svg className="product-header-separator" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7" /></svg>
        <h1 className="product-header-title" title={coreDesignTitle}>{coreDesignTitle}</h1>
      </div>
      <div className="header-actions product-header-actions">
        <span className={`connection-indicator connection-indicator-${state.connected ? "online" : "offline"}`} role="status" aria-live="polite" aria-label={`Plenum status: ${state.connected ? "Connected" : "Offline"}`}>
          <span className="visually-hidden">{state.connected ? "Connected" : "Offline"}</span>
        </span>
        <ThemeToggle />
        {productContext === null ? null : <>
          <button ref={accountToggleRef} className="account-context-toggle" type="button" aria-expanded={accountOpen}
            aria-haspopup="dialog" aria-controls="studio-account-context-menu"
            aria-label={`${accountRole}. ${accountOpen ? "Close" : "Open"} account menu for ${productContext.principal.displayName}`} onClick={toggleAccount}>
            <span className="account-role-label">{accountRole}</span>
            <svg className="account-menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 7h14M5 12h14M5 17h14" /></svg>
          </button>
          {accountOpen ? <section ref={accountMenuRef} id="studio-account-context-menu" className="account-context-menu" role="dialog"
            aria-labelledby="studio-account-menu-title" tabIndex={-1}>
            <div className="account-menu-identity"><h2 id="studio-account-menu-title">{productContext.principal.displayName}</h2>
              <p>{productContext.organization.name}</p><span className="badge badge-state">{productContext.organization.roles.map((role) => friendlyReference(role, "Designer")).join(", ")}</span></div>
            <p className="account-menu-connection"><span className={`connection-indicator connection-indicator-${state.connected ? "online" : "offline"}`} aria-hidden="true" />{state.connected ? "Connected" : "Offline"}</p>
            <button className="account-menu-sign-out" type="button" onClick={() => void signOut()}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" /></svg>
              Sign out
            </button>
          </section> : null}
        </>}
      </div>
    </header>
    <main id="main-content" className="studio-layout">
      <section className="studio-state-strip" aria-label="Draft status">
        <div><span className={`status-dot ${state.connected ? "is-online" : "is-offline"}`} aria-hidden="true" /><strong>{saveStateLabel(state.saveState)}</strong><span>{state.unsynchronizedChanges === 0 ? "All changes received by the server" : `${state.unsynchronizedChanges} change${state.unsynchronizedChanges === 1 ? "" : "s"} waiting to synchronize`}</span></div>
        <div><strong>{validationLabel}</strong><span>{valid ? "Publication checks passed" : "Publication remains unavailable"}</span></div>
        <details><summary>Sync details</summary><span>Draft generation {state.generation}</span></details>
      </section>
      <p className="live-region" aria-live="polite">{publishMessage ?? state.message}</p>
      {materialization.coreDesign === undefined || materialization.scenario === undefined ? <PlenumLoader label="Loading synchronized Core Design Draft" /> :
        <VisualCoreDesignEditor projectId={projectId} client={client} core={materialization.coreDesign} scenario={materialization.scenario} inspector={validationPanel}
          reviewWorkspace={reviewPublishWorkspace} liveChangesWorkspace={<LiveReleaseActivation projectId={projectId} />} />}
    </main>
  </>;
}
