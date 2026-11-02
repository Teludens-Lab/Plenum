import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { PublicationReviewV1, SimulationTemplateSummaryV1, StudioPublishV1, TemplateLibraryV1 } from "@plenum/event-contracts";

import { StudioCollaborationClient, type StudioClientState } from "./collaboration/client.js";
import { VisualCoreDesignEditor } from "./core-design/Editor.js";
import { LiveReleaseActivation } from "./live-changes/LiveReleaseActivation.js";

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

function revealIssue(source: string): void {
  const target = document.getElementById(source);
  if (target instanceof HTMLDetailsElement) target.open = true;
  requestAnimationFrame(() => target?.querySelector<HTMLElement>("input, select, textarea, button")?.focus());
}

function BrandWordmark() {
  return <a className="brand-wordmark" href="/" aria-label="Plenum home">
    <img className="brand-wordmark-dark" src="/branding/plenum-wordmark-dark.png" alt="Plenum" width="2170" height="725" />
    <img className="brand-wordmark-light" src="/branding/plenum-wordmark-light.png" alt="" width="2170" height="725" aria-hidden="true" />
  </a>;
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

  useEffect(() => {
    if (client === null) return;
    const unsubscribe = client.subscribe(setState);
    client.connect();
    return () => { unsubscribe(); client.stop(); };
  }, [client]);

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
    try {
      const response = await fetch(`/v1/projects/${projectId}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        freezeId,
        releaseLabel: form.get("releaseLabel"), semanticVersion: form.get("semanticVersion"), methodologyVersion: "1.3.1",
        releaseNotes: form.get("releaseNotes"), warningsAcknowledged: form.get("warningsAcknowledged") === "on",
        classificationReviewId: form.get("classificationReviewId"), accessibilityReviewStatus: "reviewed",
        retentionPolicyId: form.get("retentionPolicyId"), approvalNotes: form.get("approvalNotes")
      }) });
      const body = await response.json() as StudioPublishV1 | { error?: { message?: string } };
      if (!response.ok || !("releaseId" in body)) throw new Error("error" in body ? body.error?.message : "Publication failed.");
      client.markPublished();
      setPublishMessage(`Published release ${body.releaseId}.`);
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
      setPublishMessage(`Freeze ${body.freezeId} is ready for Reviewer approval.`);
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
      setPublishMessage(`Reviewer approval recorded for freeze ${freezeId}.`);
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
    <header className="app-header"><BrandWordmark /><span className="badge badge-state">Studio</span></header>
    <main id="main-content" className="state-page" tabIndex={-1}><section className="card state-card teludens-state">
      <p className="eyebrow">Studio</p><h1>No Project selected</h1>
      <p>Open a saved Project link to continue editing, or return home to choose another Plenum workspace.</p>
      <a className="btn-primary link-button" href="/">Return to Plenum home</a>
    </section></main>
  </>;
  const valid = state.validation?.valid === true;
  const materialization = client.materialization();

  return <>
    <a className="skip-link" href="#main-content">Skip to Draft editor</a>
    <header className="app-header"><BrandWordmark /><span className={`badge ${state.connected ? "badge-online" : "badge-offline"}`}>{state.connected ? "Connected" : "Offline"}</span></header>
    <main id="main-content" className="studio-layout">
      <section className="hero"><p className="eyebrow">Collaborative Draft</p><h1>Core Design editor</h1><p>Build the first-proof Core Design and Scenario with visual controls. Edits merge live and must pass validation before Publication.</p></section>
      <div className="status-panel status-warning" role="status"><div><strong>Save state: {state.saveState.replaceAll("_", " ")}</strong><p>{state.unsynchronizedChanges} unsynchronized change{state.unsynchronizedChanges === 1 ? "" : "s"}</p></div><span>Generation {state.generation}</span></div>
      <p className="live-region" aria-live="polite">{publishMessage ?? state.message}</p>
      {materialization.coreDesign === undefined || materialization.scenario === undefined ? <section className="card" aria-busy="true"><h2>Loading Draft</h2><p>Waiting for the synchronized Core Design.</p></section> :
        <VisualCoreDesignEditor projectId={projectId} client={client} core={materialization.coreDesign} scenario={materialization.scenario} />}
      <div className="review-grid">
        <section id="validation" className="card" aria-labelledby="validation-title">
          <div className="card-heading"><h2 id="validation-title">Validation</h2><span className={`badge ${valid ? "badge-online" : "badge-error"}`}>{valid ? "Valid" : "Needs attention"}</span></div>
          {state.validation === null ? <p>Waiting for the authoritative validation report.</p> : state.validation.issues.length === 0 ? <p>No validation errors were found.</p> :
            <ul className="issue-list">{state.validation.issues.map((issue) => { const source = sourceId(issue.path); return <li key={`${issue.code}:${issue.path}`}><a href={`#${source}`} onClick={() => revealIssue(source)}>{issue.path}</a><span>{issue.message}</span></li>; })}</ul>}
        </section>
        <section id="review-publish" className="card publish-card" aria-labelledby="publish-title">
          <h2 id="publish-title">Review and publish</h2>
          <p className="hint">A Publisher freezes the exact synchronized state, a Reviewer approves that freeze, and a Publisher publishes it. Later edits remain in the next Draft.</p>
          <button className="btn-secondary" type="button" disabled={!reviewWorkspace?.permissions.canFreeze || !state.connected || !valid || state.unsynchronizedChanges > 0 || reviewing} onClick={() => void freezeForReview()}>{reviewing ? "Working…" : "Freeze for review"}</button>
          {reviewWorkspace?.freeze === null || reviewWorkspace === null ? <p>No frozen revision is awaiting review.</p> : <div className="freeze-summary"><p><strong>Exact frozen revision</strong></p><p className="digest-line">Artifact digest {reviewWorkspace.freeze.artifactDigest}</p><p className="digest-line">Validation report digest {reviewWorkspace.freeze.validationReportDigest}</p><p>Frozen {new Date(reviewWorkspace.freeze.frozenAt).toLocaleString()} by {reviewWorkspace.freeze.frozenBy.displayName}. Policy {reviewWorkspace.freeze.policyVersion}.</p><p>{reviewWorkspace.approvals.length} current approval{reviewWorkspace.approvals.length === 1 ? "" : "s"}.</p>{reviewWorkspace.approvals.map((approval) => <p key={approval.reviewerPersonId}>Approved by {approval.reviewerDisplayName}: {approval.rationale}</p>)}</div>}
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
          <div className="field"><label htmlFor="classification-review">Classification review ID</label><input id="classification-review" name="classificationReviewId" required /></div>
          <div className="field"><label htmlFor="retention-policy">Retention policy ID</label><input id="retention-policy" name="retentionPolicyId" required /></div>
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
        </section>
      </div>
      <LiveReleaseActivation projectId={projectId} />
    </main>
  </>;
}
