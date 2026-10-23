# Plenum — API, Event, Authorization and Workflow Contracts

## Document control

| Field | Value |
|---|---|
| Document ID | CEW |
| Number | 09 |
| Version | 1.3.1 |
| Date | 2026-10-17 |
| Status | Draft for review. v1.2 addendum merged; header previously read 1.0.0 in a file named v1.2; section numbering repaired (DEC-26). |
| Owner | Technical Lead |
| Approvers | Product Owner; Methodology Lead; Technical Lead; Security Owner (role placeholders — OPEN-001) |
| Reads from | 01 PRD; 08 Canon; 02 Platform; 03 Schema; 10 Extension Framework; 11 Polling and Voting; 12 Voice and Radio; Decision Register; Glossary |
| Read by | Data Model; Synchronization Protocol; frontend; Runtime; tests; operations |
| Authority | Rules every API operation, Command, event, workflow contract and error must follow; the canonical event catalog; the canonical error-code catalog. |
| Supersedes | `09_API_EVENT_WORKFLOW_CONTRACTS_v1.2.md` |

---

## 1. Contract-first rule

Request and response schemas, Command and event payloads, workflow state machines, authorization rules, analytics definitions and error behavior are approved before implementation is declared complete (07 §3). Contracts are versioned and reference Glossary terms only (REQ-071).

## 2. API operation contract

Every operation defines: operation ID; route and method; purpose; permitted principals; required Organization Role or capability; request schema; response schema; validation; errors (§8); idempotency; Evidence or Audit behavior; rate limit; contract version; related events; related workflow transition.

Routes are versioned under `/v1`. Required domains: authentication; organizations and memberships; Simulation Projects and Drafts; validation; Definition Revisions and Releases; Sessions; Seats and Seat Assignments; Session state; Artifacts and Decision Records; approvals; Injects; information release; capabilities; resources; adjudication; communications; measurements; analytics; audit; replay; export; administration.

## 3. Command semantics

- Every mutation in a Session is a Command with a client-generated Command ID unique within the Session, an expected aggregate version where concurrency matters, and the Governing Release the client believes applies.
- The server derives actor, organization, Active Role Context and authority from authenticated context; client claims for these are ignored.
- A response of `accepted` means the change is durable, never merely queued.
- Retrying the same Command ID with the same canonical payload digest returns the original receipt with `replayed: true`. The same ID with a different digest, or from a different Principal, fails with `IDEMPOTENCY_COLLISION`.
- Payload digests use a canonical serialization (sorted keys, no insignificant whitespace), so key order never changes the digest.

### 3.1 Command envelope

```json
{
  "commandId": "uuid",
  "deviceId": "uuid",
  "operationType": "artifact.submit",
  "aggregateId": "uuid",
  "expectedAggregateVersion": 1,
  "governingReleaseId": "uuid",
  "activeSessionRoleId": "scribe",
  "deviceObservedAt": "2026-10-17T15:42:00Z",
  "payload": {}
}
```

`activeSessionRoleId` is required when the Participant holds more than one Session Role. `deviceObservedAt` is an observation only (INV-011).

## 4. Command outcomes

DEC-37 and DEC-43:

| Status | Recorded? | Evidence Event | HTTP |
|---|---|---|---|
| `accepted` | Receipt | Past-tense domain event, e.g. `artifact.submitted` | 200 |
| `rejected` | Receipt | `command.rejected` | Per error code (§8) |
| `needs_reconciliation` | Receipt | `command.reconciliation_required` | 409 |
| `received` | Receipt | None until resolved | 202 (asynchronous processing only) |
| `local_pending` | Client only | None | — |

Requests that never reach the Session — unauthenticated, malformed, from a non-Participant, from an unregistered device, or arriving when this Deployment is not the Session Authority — are refused with an error and no receipt.

### 4.1 Receipt

```json
{
  "commandId": "uuid",
  "status": "accepted",
  "aggregateVersion": 2,
  "evidenceSequence": 14,
  "errorCode": null,
  "message": null,
  "replayed": false
}
```

Receipts are readable only by the submitting Principal and authorized operators.

### 4.2 Adjudication commands and projection

Adjudication mutations use `POST /v1/sessions/{sessionId}/commands` with the standard envelope:

- `adjudication.request` snapshots one or more authorized single-Action records under one Adjudication Model;
- `adjudication.review` appends one attributable perspective input and keeps restricted analytical notes separate;
- `adjudication.draft` creates or revises the authorized lead synthesis, explanation trace, suggestion and override rationale;
- `adjudication.publish` publishes the draft and applies or schedules its effects transactionally.

`GET /v1/sessions/{sessionId}/adjudications` re-evaluates current access and omits unauthorized requests, reviews and fields server-side. Unpublished requests are visible only to configured reviewers. Published records follow their Release-owned publication scope. Returning a published record records `released`/`delivered` evidence but does not grant later access or mark it viewed.

## 5. Event contract

Every event type defines: name and integer version; owning producer (exactly one); consumers; trigger; payload schema; correlation and causation IDs; Session ID; Governing Release; aggregate ID and version; Evidence Sequence; ordering (strict per Session); delivery guarantee (at least once to consumers, deduplicated by event ID); retry and dead-letter behavior; retention; classification.

### 5.1 Event catalog

Names follow DEC-38 (`<aggregate>.<past participle>`). All are version 1 unless noted.

| Aggregate | Events |
|---|---|
| Session | `session.created`, `session.configured`, `session.readied`, `session.opened`, `session.started`, `session.paused`, `session.resumed`, `session.completed`, `session.locked`, `session.archived` |
| Session Authority | `authority.transfer_requested`, `authority.fenced`, `authority.transferred` |
| Release | `release.published`, `release.activated` |
| Invitation and join | `invitation.issued`, `invitation.accepted`, `invitation.revoked`, `join_request.submitted`, `participant.admitted`, `participant.rejected` |
| Seat | `seat.reserved`, `seat.claimed`, `seat.vacated`, `seat_assignment.created`, `seat_assignment.changed`, `seat_assignment.ended` |
| Participant | `participant.role_context_changed`, `participant.readiness_changed`, `participant.readiness_overridden`, `participant.disconnected`, `participant.reconnected` |
| Principal and device | `principal.access_revoked`, `device.registered`, `device.revoked`, `display_principal.activated`, `display_principal.revoked` |
| Stage and timer | `stage.started`, `stage.completed`, `stage.reopened`, `stage.skipped`, `timer.started`, `timer.paused`, `timer.resumed`, `timer.extended`, `timer.expired` |
| Artifact and workflow | `artifact.created`, `artifact.edited`, `artifact.submitted`, `artifact.forwarded`, `artifact.returned`, `artifact.accepted`, `artifact.reopened`, `workflow_instance.advanced`, `workflow_instance.overridden` |
| Decision | `decision_record.approved`, `decision_record.clarification_requested` |
| Communication | `message.sent`, `message.delivered`, `message.read` |
| Poll and Ballot | `poll.opened`, `poll.closed`, `poll.tallied`, `poll.certified`, `poll.voided`, `poll.corrected`, `ballot.accepted` (secret ballots: receipt only, never the choice) |
| Voice | `voice_channel.opened`, `voice_channel.closed`, `voice_channel.joined`, `voice_channel.left`, `floor_lease.granted`, `floor_lease.queued`, `floor_lease.released`, `floor_lease.expired`, `floor_lease.preempted`, `media_provider.unavailable`, `voice_recording.started`, `voice_recording.stopped`, `voice_transcription.started`, `voice_transcription.stopped`, `voice_consent.given`, `voice_consent.withdrawn` |
| Inject | `inject.scheduled`, `inject.released`, `inject.acknowledged`, `inject.responded`, `inject.cancelled`, `inject.expired` |
| Information | `information.released`, `information.viewed`, `information.acknowledged` |
| State | `state_value.changed`, `capability.allocated`, `capability.degraded`, `capability.recovered`, `resource.consumed`, `resource.replenished`, `objective_status.changed` |
| Adjudication | `adjudication.requested`, `adjudication.reviewed`, `adjudication.drafted`, `adjudication.published`, `effect.applied`, `effect.scheduled` |
| Plugin registry | `plugin_artifact.approved`, `plugin_artifact.revoked`, `plugin_installation.installed`, `plugin_installation.unavailable`, `plugin_binding.enabled`, `plugin_binding.disabled` |
| Model execution and approval | `composition_run.started`, `composition_run.completed`, `composition_run.failed`, `model_run.started`, `model_run.completed`, `model_run.failed`, `effect_proposal.staged`, `effect_proposal.approved`, `effect_proposal.rejected`, `effect_proposal.returned`, `effect_proposal.applied` |
| Control | `intervention.recorded` |
| Command | `command.rejected`, `command.reconciliation_required` |
| Evidence | `checkpoint.created`, `checkpoint.anchored`, `checkpoint.verification_failed` |
| Analysis and export | `analysis.locked`, `export.requested`, `export.generated`, `export.failed` |
| Assets and presentation | `asset.uploaded`, `asset.processed`, `asset.quarantined`, `organization_brand_profile.updated`, `project_brand_profile.updated`, `semantic_theme.validated`, `interface_profile.updated`, `terminology_profile.updated` |

Every event carries Session ID (where applicable), Governing Release, Principal, Participant, Seat Assignment, actor, correlation ID, causation ID, server time and classification.

## 6. Workflow contracts

Every workflow contract defines: name; aggregate; initial state; terminal states; allowed transitions; actor and capability; preconditions; required data; side effects; events emitted; Evidence behavior; timeout, failure, retry and recovery behavior.

| State machine | Definition |
|---|---|
| Publication | Glossary §7.1 |
| Session | Glossary §7.2 |
| Stage | 05 §5 |
| Artifact workflow | Release-defined (03 §10); reference DEC-42 |
| Decision (default) | Glossary §7.4 |
| Approval | Release-defined quorum rules (03 §10) |
| Inject | Glossary §7.5 |
| Information delivery | `pending` → `released` → `delivered` → `viewed` → `acknowledged`; exit `withdrawn` (future deliveries only) |
| Adjudication | `requested` → `in_progress` → `drafted` → `published`; publication is the authorized lead approval; exits `failed`, `cancelled` |
| Poll | Glossary §7.9 |
| Effect Proposal | Glossary §7.11 |
| Floor Lease | Glossary §7.12 |
| Plugin Artifact | Glossary §7.10 |
| Capability | 03 §13 |
| Seat and onboarding | Glossary §7.8 |
| Command outcome | §4 |
| Session Authority | Glossary §7.7 |
| Export | `requested` → `generating` → `generated`; exit `failed` |
| Analysis lock | `open` → `locked`; reopening creates a new analysis version |

## 7. Authorization contract

Every protected operation and query defines: principal attributes; resource attributes; environment attributes; allowed action; denial reasons; classification constraints; Evidence or Audit behavior. Unauthorized information is never sent to the client; hidden fields are removed server-side (INV-002, REQ-047). Responses never reveal whether an unauthorized resource exists: a Command against an Artifact the actor cannot see fails with `TARGET_NOT_FOUND`, exactly as if it did not exist.

## 8. Error contract

Errors use the envelope below and the codes in §8.1. Responses state whether retry is safe and include a correlation ID, without leaking protected details.

```json
{
  "error": {
    "code": "STALE_AGGREGATE_VERSION",
    "message": "The artifact changed since you loaded it.",
    "details": null,
    "correlationId": "uuid"
  }
}
```

For recorded Command outcomes, the response body is the receipt (§4.1) and the HTTP status follows the table below.

### 8.1 Canonical error codes

| Code | HTTP | Retry automatically? | Meaning and client action |
|---|---|---|---|
| `UNAUTHENTICATED` | 401 | No | Sign in |
| `AUTH_EXPIRED` | 401 | No | Re-authenticate; keep local drafts if policy permits |
| `INVALID_ID` | 400 | No | Malformed identifier |
| `INVALID_JSON` | 400 | No | Malformed body |
| `INVALID_COMMAND` | 422 | No | Command envelope invalid; no receipt |
| `VALIDATION_FAILED` | 422 | No | Data invalid; field-level details returned |
| `PERMISSION_DENIED` | 403 | No | Actor lacks the role or capability; a reason such as `not_in_electorate` may be included |
| `RESULT_NOT_RELEASED` | 403 | No | Poll result not yet visible under its result policy (11) |
| `CONSENT_REQUIRED` | 403 | No | Recording or transcription needs consent that has not been given (12) |
| `PLUGIN_NOT_APPROVED` | 403 | No | Plugin Artifact not approved, installed or enabled, or revoked (10) |
| `ACCESS_REVOKED` | 403 | No | Access removed; clear controllable cached material |
| `NOT_A_PARTICIPANT` | 403 | No | Principal has no Participant record in the Session; no receipt |
| `DEVICE_NOT_REGISTERED` | 403 | No | Unregistered or revoked device; no receipt |
| `NOT_FOUND` | 404 | No | Resource does not exist or is not visible |
| `TARGET_NOT_FOUND` | 404 | No | Command target does not exist or is not visible to the actor |
| `TARGET_EXISTS` | 409 | No | Creation Command for an identifier already in use |
| `INVALID_TRANSITION` | 409 | No | Command not available in the current state |
| `ALREADY_VOTED` | 409 | No | This Seat Assignment already has an accepted Ballot and revoting is off (11) |
| `DEADLINE_EXPIRED` | 409 | No | Server deadline passed; the action can no longer be taken (11) |
| `FLOOR_BUSY` | 409 | No | Push-to-talk Floor held and queueing not allowed; try again (12) |
| `FLOOR_TOKEN_EXPIRED` | 409 | No | Floor Lease expired or was preempted; request the Floor again (12) |
| `STALE_PROPOSAL` | 409 | No | State, Release, authority or reviewer changed since the Effect Proposal was staged; re-evaluate (10) |
| `CAPABILITY_UNAVAILABLE` | 409 | No | The Release needs a Plugin, Voting Method Adapter or Media Provider Adapter that this Deployment lacks or cannot run in its profile (10, 11, 12) |
| `SESSION_NOT_ACTIVE` | 409 | No | Session state does not accept the Command |
| `STALE_AGGREGATE_VERSION` | 409 | No | Refresh, then merge explicitly |
| `INCOMPATIBLE_RELEASE` | 409 | No | Governing Release mismatch; revalidate and resubmit with a new Command ID |
| `VERSION_CONFLICT` | 409 | No | Draft changed since loaded |
| `ALREADY_PUBLISHED` | 409 | No | Draft identical to the last published revision |
| `IDEMPOTENCY_COLLISION` | 409 | No | Command ID reused with a different payload or by a different Principal |
| `CONFLICT` | 409 | No | Unique constraint conflict |
| `REFERENCE_INVALID` | 409 | No | Referenced record missing in this Organization |
| `SYNC_CURSOR_EXPIRED` | 410 | Yes, via snapshot | Fetch a fresh authorized snapshot |
| `TOO_LARGE` | 413 | No | Payload over limit |
| `RATE_LIMITED` | 429 | Yes, after delay | Back off |
| `AUTHORITY_UNAVAILABLE` | 503 | Bounded, same authority | This Deployment is not the active Session Authority; no automatic failover |
| `TRANSIENT_DEPENDENCY` | 503 | Yes, bounded | Back off; look up the receipt before resending |
| `PLUGIN_UNAVAILABLE` | 503 | Yes, bounded | Extension Host or Plugin failed to run; no result exists (10) |
| `MEDIA_UNAVAILABLE` | 503 | Yes, bounded | Media provider unreachable; voice shown unavailable (12) |
| `INTERNAL` | 500 | Look up receipt first | Unexpected failure |
| `NETWORK_UNAVAILABLE` | — | Yes, bounded | Client-only; keep Offline Outbox |

## 9. Compatibility

Breaking API or event changes require a new version or an explicit migration. Releases and historical Sessions keep their original contract references. Consumers declare supported versions; contract tests verify them (REQ-070; OPEN-012).

## 10. Session onboarding contracts

### 10.1 Operations

```text
POST /v1/sessions/{sessionId}/invitations
POST /v1/invitations/{token}/accept
POST /v1/sessions/{sessionId}/join-requests
POST /v1/sessions/{sessionId}/join-requests/{participantId}/admit
POST /v1/sessions/{sessionId}/join-requests/{participantId}/reject
POST /v1/sessions/{sessionId}/seats/{seatId}/claim
POST /v1/sessions/{sessionId}/participants                         # operator assignment
POST /v1/sessions/{sessionId}/seat-assignments/{seatAssignmentId}/reassign
POST /v1/sessions/{sessionId}/participants/{participantId}/ready
POST /v1/sessions/{sessionId}/participants/{participantId}/readiness-override
POST /v1/sessions/{sessionId}/participants/{participantId}/active-role
POST /v1/sessions/{sessionId}/display-principals/activate
POST /v1/sessions/{sessionId}/principals/{principalId}/revoke
GET  /v1/sessions/{sessionId}/readiness
GET  /v1/sessions/{sessionId}/access-context
```

Each defines principal, required role or capability, identity assurance, idempotency, validation, events and Evidence behavior.

### 10.2 Active Role Context

A multi-role Participant selects one authorized Session Role before role-sensitive actions; Commands reject inactive, expired or incompatible contexts.

### 10.3 Attribution

Every consequential Command and Artifact transition includes or derives: acting Principal; Participant or Session Operator; active Seat Assignment; Active Role Context; represented Session Team; server commit time; correlation and causation IDs. Client-supplied attribution is checked against server-side Seat Assignments.

## 11. Studio and Release contracts

```text
POST /v1/projects                              # create project with Draft
GET  /v1/projects/{projectId}/draft
PUT  /v1/projects/{projectId}/draft            # optimistic update (expectedVersion)
POST /v1/projects/{projectId}/validate
POST /v1/projects/{projectId}/publish          # freeze, validate, revision, release
WS   /v1/projects/{projectId}/collaboration    # CRDT update exchange (ADR-010)
POST /v1/sessions/{sessionId}/release-activations
```

## 12. Customization, asset and plugin contracts

```text
/v1/organization-brand-profiles
/v1/project-brand-profiles
/v1/semantic-themes
/v1/interface-profiles
/v1/terminology-profiles
/v1/assets
/v1/assets/{assetId}/variants
/v1/projects/{projectId}/plugin-bindings
```

### 12.1 Extension Framework (10 §12)

```text
POST /v1/plugins/submissions                         # approved publishers only (DEC-52)
POST /v1/plugins/{artifactId}/approve                # separation of duties
POST /v1/organizations/{orgId}/plugin-installations
GET  /v1/organizations/{orgId}/plugin-catalog
POST /v1/projects/{projectId}/compositions/validate
GET  /v1/sessions/{sessionId}/composition-runs/{runId}
GET  /v1/sessions/{sessionId}/effect-proposals
```

Session Commands: `composition_run.start`, `composition_run.cancel`, `effect_proposal.approve`, `effect_proposal.reject`, `effect_proposal.return`. A Plugin can only propose effects; a consequential effect is applied only by the Command that follows an Approval Decision (DEC-54, INV-020).

### 12.2 Polls (11 §6)

Session Commands through the standard endpoint (DEC-48): `poll.open`, `poll.close`, `poll.tally`, `poll.certify`, `poll.void`, `poll.correct`, `ballot.cast`.

```text
GET /v1/sessions/{sessionId}/polls
GET /v1/sessions/{sessionId}/polls/{pollId}
GET /v1/sessions/{sessionId}/polls/{pollId}/my-receipt
GET /v1/sessions/{sessionId}/polls/{pollId}/result     # only when the result policy allows
GET /v1/sessions/{sessionId}/polls/{pollId}/audit      # restricted
```

### 12.3 Voice (12 §6)

Session Commands through the standard endpoint: `voice_channel.open`, `voice_channel.close`, `voice_channel.join`, `voice_channel.leave`, `voice_channel.moderate`, `voice_recording.start`, `voice_recording.stop`, `voice_transcription.start`, `voice_transcription.stop`, `voice_consent.give`, `voice_consent.withdraw`.

Push-to-talk floor control is the one exception to the command endpoint (DEC-48). These calls carry a request ID and the expected Authority Epoch, return a grant, queue position or `FLOOR_BUSY`, write Evidence Events, and are never queued offline or replayed:

```text
POST /v1/sessions/{sessionId}/voice-channels/{channelId}/floor-requests
POST /v1/sessions/{sessionId}/voice-channels/{channelId}/floor-requests/{requestId}/renew
POST /v1/sessions/{sessionId}/voice-channels/{channelId}/floor-requests/{requestId}/release
GET  /v1/sessions/{sessionId}/voice-channels
GET  /v1/sessions/{sessionId}/voice-channels/{channelId}/status
```

## 13. Synchronization contracts

Bootstrap, Command submission, receipt lookup, delta catch-up, live push, snapshot reset and Studio collaboration are specified in the Synchronization Protocol v1.1 §2.

## 14. Coherence checklist

- Every API field and event field resolves to a Glossary term.
- Every Session mutation is a Command through the command endpoint, except push-to-talk floor control (DEC-48).
- Every event has exactly one owning producer.
- Ordering and duplicate handling are explicit.
- Workflow authority and recovery are explicit.
- Authorization is enforced server-side; contracts never expose information outside policy.
- Fixtures and examples exist for every critical contract.

## 15. Open items

OPEN-012 (compatibility), OPEN-015 (offline Command types and credential lifetime), OPEN-016 (authority transfer), OPEN-022 (remaining engineering ADRs), OPEN-027 (recording and transcription consent), OPEN-028 (secret ballots), OPEN-029 (plugin trust). OPEN-021 is resolved.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.3.1 | 2026-10-17 | Added poll, voice, plugin-registry and model-execution events; Poll, Effect Proposal, Floor Lease and Plugin Artifact state machines; eleven error codes; §12.1 to §12.3 contracts with the push-to-talk exception (DEC-48); replaced `plugin_execution` and `plugin_output` events with `model_run` and `effect_proposal`. |
| 1.3.0 | 2026-10-17 | Merged v1.2 addendum; replaced `run` routes and fields with Session terms; adopted DEC-37 outcomes and DEC-43 rejection evidence; renamed events to DEC-38 convention and added the full catalog; made this document the owner of the canonical error-code catalog; added Studio and Release contracts; repaired section numbering. |
| 1.2.0 | 2026-10-17 | Reconciliation addendum (archived). Header incorrectly read 1.0.0. |
