import { useEffect, useState, type FormEvent } from "react";
import type { CompatibilityReportV1 } from "@plenum/event-contracts";

type ReleaseImpact = {
  projectId: string;
  currentReleaseId: string;
  candidateReleaseId: string;
  activationSequence: number;
  report: CompatibilityReportV1;
  reportDigest: string;
  existingWorkflows: Array<{ governing_release_id: string; workflow_key: string; state: string; count: number }>;
  openPolls: Array<{ id: string; definition_id: string; governing_release_id: string; status: string }>;
  inFlightCompositions: Array<{ id: string; governing_release_id: string; status: string }>;
  queuedCommandCount: number;
  approvedImpactReviewId: string | null;
  approvedBy: string | null;
};

function message(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = body.error;
    if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") return error.message;
  }
  return fallback;
}

export function LiveReleaseActivation({ projectId }: { projectId: string }) {
  const [sessionId, setSessionId] = useState("");
  const [candidateReleaseId, setCandidateReleaseId] = useState("");
  const [impact, setImpact] = useState<ReleaseImpact | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Enter a Session and candidate Release to preview the live impact.");
  const [sessionOptions, setSessionOptions] = useState<Array<{ id: string; name: string; projectId: string }>>([]);
  const [releaseOptions, setReleaseOptions] = useState<Array<{ id: string; label: string; projectId: string }>>([]);

  useEffect(() => {
    const applyOptions = (sessions: Array<{ id: string; name: string; projectId: string }>, releases: Array<{ id: string; label: string; projectId: string }>) => {
      setSessionOptions(sessions); setReleaseOptions(releases);
      setSessionId((current) => current || sessions[0]?.id || "");
      setCandidateReleaseId((current) => current || releases[0]?.id || "");
    };
    void fetch(`/v1/projects/${projectId}/publication-review`).then(async (reviewResponse) => {
      if (reviewResponse.ok) {
        const review = await reviewResponse.json() as { liveChangeOptions?: {
          sessions?: Array<{ id: string; label: string }>; releases?: Array<{ id: string; label: string }>
        } };
        if (review.liveChangeOptions !== undefined) {
          applyOptions((review.liveChangeOptions.sessions ?? []).map((session) => ({ ...session, name: session.label, projectId })),
            (review.liveChangeOptions.releases ?? []).map((release) => ({ ...release, projectId })));
          return;
        }
      }
      const [sessionsResponse, releasesResponse] = await Promise.all([fetch("/v1/sessions?limit=50"), fetch("/v1/releases?limit=50")]);
      if (!sessionsResponse.ok || !releasesResponse.ok) return;
      const sessions = await sessionsResponse.json() as { sessions?: Array<{ id: string; title: string; project?: { id: string } }> };
      const releases = await releasesResponse.json() as { releases?: Array<{ id: string; label: string; project: { id: string } }> };
      const nextSessions = (sessions.sessions ?? []).map((session) => ({ id: session.id, name: session.title, projectId: session.project?.id ?? "" })).filter((session) => session.projectId === projectId);
      const nextReleases = (releases.releases ?? []).map((release) => ({ id: release.id, label: release.label, projectId: release.project.id })).filter((release) => release.projectId === projectId);
      applyOptions(nextSessions, nextReleases);
    }).catch(() => setStatus("Release and Session choices could not be loaded. Retry after reconnecting."));
  }, [projectId]);

  async function preview(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setConfirmed(false);
    setImpact(null);
    try {
      const response = await fetch(`/v1/sessions/${sessionId}/release-impact?candidateReleaseId=${encodeURIComponent(candidateReleaseId)}`);
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(message(body, "Impact preview failed."));
      const next = body as ReleaseImpact;
      if (next.projectId !== projectId) throw new Error("This Session belongs to a different Studio Project.");
      setImpact(next);
      setStatus(next.report.blockedReasons.length === 0
        ? "Impact preview is ready for explicit review."
        : "Activation is blocked by the approved compatibility policy.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Impact preview failed.");
    } finally {
      setBusy(false);
    }
  }

  async function activate(): Promise<void> {
    if (impact === null || !confirmed || impact.report.blockedReasons.length > 0) return;
    setBusy(true);
    try {
      let impactReviewId = impact.approvedImpactReviewId;
      if (impactReviewId === null) {
        const reviewResponse = await fetch(`/v1/sessions/${sessionId}/release-impact-reviews`, {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
            candidateReleaseId: impact.candidateReleaseId,
            reportDigest: impact.reportDigest,
            existingInstanceHandling: "keep_existing"
          })
        });
        const review: unknown = await reviewResponse.json();
        if (!reviewResponse.ok || typeof review !== "object" || review === null || !("impactReviewId" in review) || typeof review.impactReviewId !== "string") {
          throw new Error(message(review, "Impact review could not be recorded."));
        }
        impactReviewId = review.impactReviewId;
        if (impact.report.classification === "consequential") {
          setStatus("Fresh Reviewer approval recorded. An assigned Operator can now activate this exact reviewed impact.");
          const response = await fetch(`/v1/sessions/${sessionId}/release-impact?candidateReleaseId=${encodeURIComponent(candidateReleaseId)}`);
          if (response.ok) setImpact(await response.json() as ReleaseImpact);
          return;
        }
      }
      const deviceResponse = await fetch("/v1/devices", { method: "POST" });
      const device: unknown = await deviceResponse.json();
      if (!deviceResponse.ok || typeof device !== "object" || device === null || !("deviceId" in device)) {
        throw new Error(message(device, "A command Device could not be registered."));
      }
      const activationResponse = await fetch(`/v1/sessions/${sessionId}/release-activations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
          commandId: crypto.randomUUID(),
          deviceId: device.deviceId,
          operationType: "release.activate",
          aggregateId: sessionId,
          expectedAggregateVersion: impact.activationSequence,
          governingReleaseId: impact.currentReleaseId,
          payload: {
            candidateReleaseId: impact.candidateReleaseId,
            impactReviewId,
            reportDigest: impact.reportDigest,
            existingInstanceHandling: "keep_existing"
          }
        })
      });
      const receipt: unknown = await activationResponse.json();
      if (!activationResponse.ok) throw new Error(message(receipt, "Release activation failed."));
      const candidateLabel = releaseOptions.find((release) => release.id === impact.candidateReleaseId)?.label ?? "The candidate Release";
      setStatus(`${candidateLabel} is active for new work. Existing work remains pinned.`);
      setImpact(null);
      setConfirmed(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Release activation failed.");
    } finally {
      setBusy(false);
    }
  }

  return <section id="live-changes" className="card live-changes" aria-labelledby="live-changes-title">
    <div className="card-heading"><h2 id="live-changes-title" tabIndex={-1}>Live Changes</h2>{impact === null ? null : <span className="badge badge-info">{impact.report.classification.replaceAll("_", " ")}</span>}</div>
    <p className="hint">Activation applies the candidate Release to new work only. Existing workflow instances, open Polls, and in-flight Model Compositions keep their governing Release.</p>
    <p role="status" aria-live="polite">{status}</p>
    <form className="live-change-form" onSubmit={(event) => void preview(event)}>
      <div className="field"><label htmlFor="live-session-id">Session</label><select id="live-session-id" required value={sessionId} onChange={(event) => setSessionId(event.target.value)}><option value="">Choose a Session</option>{sessionOptions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></div>
      <div className="field"><label htmlFor="candidate-release-id">Candidate Release</label><select id="candidate-release-id" required value={candidateReleaseId} onChange={(event) => setCandidateReleaseId(event.target.value)}><option value="">Choose a Release</option>{releaseOptions.map((release) => <option key={release.id} value={release.id}>{release.label}</option>)}</select></div>
      <button className="btn-secondary" type="submit" disabled={busy}>{busy ? "Working…" : "Preview impact"}</button>
    </form>
    {impact === null ? null : <div className="impact-preview">
      <dl className="impact-counts">
        <div><dt>Existing workflow groups</dt><dd>{impact.existingWorkflows.length}</dd></div>
        <div><dt>Open Polls</dt><dd>{impact.openPolls.length}</dd></div>
        <div><dt>In-flight compositions</dt><dd>{impact.inFlightCompositions.length}</dd></div>
        <div><dt>Queued Commands</dt><dd>{impact.queuedCommandCount}</dd></div>
      </dl>
      <h3>Classified changes</h3>
      {impact.report.changes.length === 0 ? <p>No definition changes were detected.</p> : <ul className="issue-list">{impact.report.changes.map((change) =>
        <li key={`${change.path}:${change.kind}`}><strong>{change.kind.replaceAll("_", " ")}</strong><span>{change.classification.replaceAll("_", " ")}</span><details className="issue-technical"><summary>Technical location</summary><code>{change.path}</code></details></li>)}</ul>}
      {impact.report.blockedReasons.length === 0 ? null : <div className="status-error" role="alert"><strong>Activation blocked</strong><ul>{impact.report.blockedReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}
      {impact.approvedImpactReviewId === null ? <p>No current approval is recorded for this exact impact.</p> : <p><strong>Current approval:</strong> {impact.approvedBy}</p>}
      <details className="technical-details"><summary>Technical provenance</summary><dl>
        <div><dt>Session reference</dt><dd><code>{sessionId}</code></dd></div>
        <div><dt>Current Release reference</dt><dd><code>{impact.currentReleaseId}</code></dd></div>
        <div><dt>Candidate Release reference</dt><dd><code>{impact.candidateReleaseId}</code></dd></div>
        <div><dt>Impact report digest</dt><dd><code>{impact.reportDigest}</code></dd></div>
        {impact.approvedImpactReviewId === null ? null : <div><dt>Approval reference</dt><dd><code>{impact.approvedImpactReviewId}</code></dd></div>}
      </dl></details>
      <label className="choice"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I reviewed this exact impact and approve keeping all existing instances on their current Release.</label>
      <button className="btn-primary" type="button" disabled={busy || !confirmed || impact.report.blockedReasons.length > 0} onClick={() => void activate()}>{busy ? "Working…" : impact.report.classification === "consequential" && impact.approvedImpactReviewId === null ? "Record fresh Reviewer approval" : "Activate for new work"}</button>
    </div>}
  </section>;
}
