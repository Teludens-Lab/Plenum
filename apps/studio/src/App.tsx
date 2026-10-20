import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { StudioPublishV1 } from "@plenum/event-contracts";

import { StudioCollaborationClient, type StudioClientState } from "./collaboration/client.js";

const initialState: StudioClientState = { connected: false, generation: 1, saveState: "saved_on_device",
  unsynchronizedChanges: 0, validation: null, message: "Connecting to the collaboration service." };

function projectIdFromPath(): string | null {
  return location.pathname.match(/^\/studio\/projects\/([0-9a-f-]{36})\/?$/iu)?.[1] ?? null;
}

function sourceId(path: string): string {
  return path.startsWith("scenario.name") ? "scenario-name" : path.startsWith("scenario.description") ? "scenario-description" : "draft-editor";
}

export function App() {
  const projectId = projectIdFromPath();
  const client = useMemo(() => projectId === null ? null : new StudioCollaborationClient(projectId), [projectId]);
  const [state, setState] = useState(initialState);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  useEffect(() => {
    if (client === null) return;
    const unsubscribe = client.subscribe(setState);
    client.connect();
    return () => { unsubscribe(); client.stop(); };
  }, [client]);

  async function publish(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (client === null || projectId === null) return;
    setPublishing(true);
    setPublishMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/v1/projects/${projectId}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
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

  if (projectId === null || client === null) return <main className="state-page"><section className="card"><h1>Project not found</h1><p>Open Studio with a valid project address.</p></section></main>;
  const valid = state.validation?.valid === true;
  const scenarioName = client.scenarioField("name");
  const scenarioDescription = client.scenarioField("description");

  return <>
    <a className="skip-link" href="#main-content">Skip to Draft editor</a>
    <header className="app-header"><a className="brand" href="/studio/">PLENUM STUDIO</a><span className={`badge ${state.connected ? "badge-online" : "badge-offline"}`}>{state.connected ? "Connected" : "Offline"}</span></header>
    <main id="main-content" className="studio-layout">
      <section className="hero"><p className="eyebrow">Collaborative Draft</p><h1>Scenario editor</h1><p>Edits merge live. A merged Draft must still pass validation before it can be frozen and published.</p></section>
      <div className="status-panel status-warning" role="status"><div><strong>Save state: {state.saveState.replaceAll("_", " ")}</strong><p>{state.unsynchronizedChanges} unsynchronized change{state.unsynchronizedChanges === 1 ? "" : "s"}</p></div><span>Generation {state.generation}</span></div>
      <p className="live-region" aria-live="polite">{publishMessage ?? state.message}</p>
      <div className="studio-grid">
        <section id="draft-editor" className="card" aria-labelledby="editor-title">
          <h2 id="editor-title">Draft source</h2>
          <div className="field"><label htmlFor="scenario-name">Scenario name</label><input id="scenario-name" value={scenarioName} onChange={(event) => client.setScenarioField("name", event.target.value)} /></div>
          <div className="field"><label htmlFor="scenario-description">Scenario description</label><textarea id="scenario-description" rows={8} value={scenarioDescription} onChange={(event) => client.setScenarioField("description", event.target.value)} /></div>
          <p className="hint">This slice edits scenario identity fields. Other definition sections remain in the shared Draft and are validated continuously.</p>
        </section>
        <section className="card" aria-labelledby="validation-title">
          <div className="card-heading"><h2 id="validation-title">Validation</h2><span className={`badge ${valid ? "badge-online" : "badge-error"}`}>{valid ? "Valid" : "Needs attention"}</span></div>
          {state.validation === null ? <p>Waiting for the authoritative validation report.</p> : state.validation.issues.length === 0 ? <p>No validation errors were found.</p> :
            <ul className="issue-list">{state.validation.issues.map((issue) => <li key={`${issue.code}:${issue.path}`}><a href={`#${sourceId(issue.path)}`}>{issue.path}</a><span>{issue.message}</span></li>)}</ul>}
        </section>
        <form className="card publish-card" onSubmit={(event) => void publish(event)} aria-labelledby="publish-title">
          <h2 id="publish-title">Freeze and publish</h2>
          <p className="hint">Publication freezes the exact synchronized state vector. Edits arriving afterward remain in the next Draft.</p>
          <div className="field"><label htmlFor="release-label">Release label</label><input id="release-label" name="releaseLabel" required maxLength={200} defaultValue="Collaborative Draft" /></div>
          <div className="field"><label htmlFor="semantic-version">Semantic version</label><input id="semantic-version" name="semanticVersion" required pattern="\d+\.\d+\.\d+" defaultValue="1.0.0" /></div>
          <div className="field"><label htmlFor="release-notes">Release notes</label><textarea id="release-notes" name="releaseNotes" required rows={4} /></div>
          <div className="field"><label htmlFor="classification-review">Classification review ID</label><input id="classification-review" name="classificationReviewId" required /></div>
          <div className="field"><label htmlFor="retention-policy">Retention policy ID</label><input id="retention-policy" name="retentionPolicyId" required /></div>
          <div className="field"><label htmlFor="approval-notes">Approval notes</label><textarea id="approval-notes" name="approvalNotes" required rows={3} /></div>
          <label className="choice"><input type="checkbox" name="warningsAcknowledged" />I acknowledge the validation warnings.</label>
          <button className="btn-primary" type="submit" disabled={!state.connected || !valid || state.unsynchronizedChanges > 0 || publishing}>{publishing ? "Publishing…" : "Freeze and publish"}</button>
        </form>
      </div>
    </main>
  </>;
}
