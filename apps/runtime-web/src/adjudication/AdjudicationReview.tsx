import { useState, type FormEvent } from "react";

import type { AdjudicationRequestV1, JsonObject } from "@plenum/event-contracts";

type SendAdjudication = (operationType: string, requestId: string, expectedVersion: number, payload: JsonObject) => void;

export function AdjudicationReview({ adjudications, disabled, send }: {
  adjudications: AdjudicationRequestV1[]; disabled: boolean; send: SendAdjudication;
}) {
  if (adjudications.length === 0) return null;
  return <section aria-labelledby="adjudications-title">
    <div className="section-heading"><p className="eyebrow">Explainable decision workflow</p><h2 id="adjudications-title">Adjudications</h2></div>
    <p className="hint">Reviewer inputs remain distinct. Only the lead synthesis can be published, and publication applies approved effects atomically.</p>
    <div className="card-grid">{adjudications.map((request) => <AdjudicationCard key={request.id}
      request={request} disabled={disabled} send={send} />)}</div>
  </section>;
}

function AdjudicationCard({ request, disabled, send }: {
  request: AdjudicationRequestV1; disabled: boolean; send: SendAdjudication;
}) {
  const perspective = request.perspectives.find(({ reviewerSessionRoleIds }) => reviewerSessionRoleIds.length > 0);
  const [recommendation, setRecommendation] = useState("");
  const [reviewRationale, setReviewRationale] = useState("");
  const [hiddenNotes, setHiddenNotes] = useState("");
  const [reviewConfidence, setReviewConfidence] = useState("0.5");
  const [outcome, setOutcome] = useState("");
  const [rationale, setRationale] = useState("");
  const [participantRationale, setParticipantRationale] = useState("");
  const [synthesis, setSynthesis] = useState("");
  const [overrideRationale, setOverrideRationale] = useState("");
  const [finalConfidence, setFinalConfidence] = useState("0.5");
  const submitReview = (event: FormEvent) => {
    event.preventDefault();
    if (perspective === undefined) return;
    send("adjudication.review", request.id, request.version, { perspectiveId: perspective.id,
      recommendation: recommendation.trim(), rationale: reviewRationale.trim(),
      ...(hiddenNotes.trim() === "" ? {} : { hiddenAnalyticalNotes: hiddenNotes.trim() }),
      confidence: Number(reviewConfidence), evidenceArtifactIds: request.actionSnapshots.map(({ artifactId }) => artifactId) });
  };
  const draft = (event: FormEvent) => {
    event.preventDefault();
    send("adjudication.draft", request.id, request.version, { outcome: outcome.trim(), rationale: rationale.trim(),
      participantRationale: participantRationale.trim(), synthesis: synthesis.trim(), confidence: Number(finalConfidence),
      ...(overrideRationale.trim() === "" ? {} : { overrideRationale: overrideRationale.trim() }),
      effects: [], facts: {}, rubricScores: {}, pluginProposalIds: [] });
  };
  return <article className="card adjudication" aria-labelledby={`adjudication-${request.id}`}>
    <div className="card-heading"><div><p className="eyebrow">{request.mechanism} model</p>
      <h3 id={`adjudication-${request.id}`}>{request.modelName}</h3></div>
      <span className="badge badge-state">{request.status.replaceAll("_", " ")}</span></div>
    <dl className="metadata"><div><dt>Actions</dt><dd>{request.actionSnapshots.length}</dd></div>
      <div><dt>Version</dt><dd>{request.version}</dd></div></dl>
    <ul className="action-snapshots">{request.actionSnapshots.map((action) => <li key={action.artifactId}>
      <code>{action.artifactId}</code> <span>version {action.artifactVersion}</span>
    </li>)}</ul>
    {request.reviews.length === 0 ? <p className="hint">No reviewer input has been submitted.</p> : <details>
      <summary>Reviewer inputs ({request.reviews.length})</summary>
      {request.reviews.map((review) => <section className="review-input" key={review.id} aria-label={`${review.perspectiveId} review`}>
        <p><strong>{review.reviewerDisplayName}</strong> · {review.reviewerOrganizationName}</p>
        <p>{review.rationale}</p><p className="hint">Confidence {Math.round(review.confidence * 100)}%</p>
        {review.hiddenAnalyticalNotes === undefined ? null : <p className="hidden-note"><strong>Restricted analytical note:</strong> {review.hiddenAnalyticalNotes}</p>}
      </section>)}
    </details>}
    {request.canReview && perspective !== undefined ? <form onSubmit={submitReview}>
      <fieldset disabled={disabled}><legend>Submit a distinct reviewer input</legend>
        <div className="field"><label htmlFor={`recommendation-${request.id}`}>Recommendation</label>
          <textarea id={`recommendation-${request.id}`} required maxLength={8000} value={recommendation} onChange={(event) => setRecommendation(event.target.value)} /></div>
        <div className="field"><label htmlFor={`review-rationale-${request.id}`}>Rationale</label>
          <textarea id={`review-rationale-${request.id}`} required maxLength={8000} value={reviewRationale} onChange={(event) => setReviewRationale(event.target.value)} /></div>
        <div className="field"><label htmlFor={`hidden-notes-${request.id}`}>Restricted analytical notes <span className="hint">(optional)</span></label>
          <textarea id={`hidden-notes-${request.id}`} maxLength={20000} value={hiddenNotes} onChange={(event) => setHiddenNotes(event.target.value)} />
          <p className="hint">Visible only to you and authorized lead reviewers; never included in participant-facing rationale.</p></div>
        <div className="field"><label htmlFor={`review-confidence-${request.id}`}>Confidence</label>
          <input id={`review-confidence-${request.id}`} type="number" min="0" max="1" step="0.05" required value={reviewConfidence}
            onChange={(event) => setReviewConfidence(event.target.value)} /></div>
      </fieldset><button className="btn-secondary" type="submit" disabled={disabled}>Submit reviewer input</button>
    </form> : null}
    {request.canSynthesize ? <form onSubmit={draft}>
      <fieldset disabled={disabled}><legend>Lead synthesis</legend>
        <div className="field"><label htmlFor={`outcome-${request.id}`}>Final outcome</label>
          <textarea id={`outcome-${request.id}`} required maxLength={8000} value={outcome} onChange={(event) => setOutcome(event.target.value)} /></div>
        <div className="field"><label htmlFor={`rationale-${request.id}`}>Decision rationale</label>
          <textarea id={`rationale-${request.id}`} required maxLength={8000} value={rationale} onChange={(event) => setRationale(event.target.value)} /></div>
        <div className="field"><label htmlFor={`participant-rationale-${request.id}`}>Participant-facing rationale</label>
          <textarea id={`participant-rationale-${request.id}`} required maxLength={8000} value={participantRationale} onChange={(event) => setParticipantRationale(event.target.value)} /></div>
        <div className="field"><label htmlFor={`synthesis-${request.id}`}>Reviewer synthesis</label>
          <textarea id={`synthesis-${request.id}`} required maxLength={8000} value={synthesis} onChange={(event) => setSynthesis(event.target.value)} /></div>
        <div className="field"><label htmlFor={`override-${request.id}`}>Override rationale <span className="hint">(required when differing from a system suggestion)</span></label>
          <textarea id={`override-${request.id}`} maxLength={8000} value={overrideRationale} onChange={(event) => setOverrideRationale(event.target.value)} /></div>
        <div className="field"><label htmlFor={`final-confidence-${request.id}`}>Confidence</label>
          <input id={`final-confidence-${request.id}`} type="number" min="0" max="1" step="0.05" required value={finalConfidence}
            onChange={(event) => setFinalConfidence(event.target.value)} /></div>
      </fieldset><button className="btn-secondary" type="submit" disabled={disabled}>Save draft synthesis</button>
    </form> : null}
    {request.record === null ? null : <section className="adjudication-record" aria-labelledby={`record-${request.id}`}>
      <h4 id={`record-${request.id}`}>{request.record.status === "published" ? "Published outcome" : "Draft outcome"}</h4>
      <p>{String(request.record.outcome)}</p><p>{request.record.rationale}</p>
      {request.record.explanationTrace.length === 0 ? null : <details><summary>Explanation trace ({request.record.explanationTrace.length})</summary><ol>
        {request.record.explanationTrace.map((entry, index) => <li key={`${entry.referenceId}-${index}`}>
          <strong>{entry.source}: {entry.referenceId}</strong> — {entry.explanation}
        </li>)}</ol></details>}
      {request.record.overrideRationale === null ? null : <p><strong>Override rationale:</strong> {request.record.overrideRationale}</p>}
      <p className="hint">Lead: {request.record.leadDisplayName} · {request.record.leadOrganizationName}</p>
      {request.record.status !== "draft" || !request.canSynthesize ? null : <button className="btn-primary" type="button" disabled={disabled}
        onClick={() => send("adjudication.publish", request.id, request.version, {})}>Publish outcome and effects</button>}
    </section>}
  </article>;
}
