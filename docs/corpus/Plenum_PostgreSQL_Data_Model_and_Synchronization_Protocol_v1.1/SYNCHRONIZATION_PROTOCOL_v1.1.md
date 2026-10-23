# Plenum — Synchronization and Offline Runtime Protocol

## Document control

| Field | Value |
|---|---|
| Document ID | SYNC |
| Version | 1.1.2 |
| Date | 2026-10-23 |
| Status | Approved by Product Owner direction on 2026-10-20. Depends on ADR-001, ADR-002 and ADR-010; named specialist sign-offs remain required. OPEN-002, OPEN-014, OPEN-015 and OPEN-017 are resolved. |
| Owner | Technical Lead |
| Approvers | Technical Lead; Security Owner (role placeholders — OPEN-001) |
| Reads from | 01 PRD; 02 Platform; 05 Runtime; 06 Data, Security and Reporting; 09 Contracts; 10 Extension Framework; 11 Polling and Voting; 12 Voice and Radio; PostgreSQL Logical Data Model v1.1; Decision Register; Glossary |
| Read by | Runtime and client implementation; tests |
| Authority | Studio collaboration exchange, Runtime Command submission and receipts, offline client behavior, reconnection, projection cursors, Release-activation compatibility and authority transfer. Error codes are owned by 09 §8.1. |
| Supersedes | `SYNCHRONIZATION_PROTOCOL_v1.0.md` |

---

## 1. Consistency model

1. **Studio:** concurrent Drafts converge through CRDT updates; a Release exists only after a server-side freeze and full validation. Convergence is not correctness (ADR-002).
2. **Runtime:** only the Session Authority, at its current Authority Epoch, accepts Commands. Devices may draft, queue and keep permitted content offline, but never finalize adjudication, official Stage transitions or event order (INV-017, INV-018).
3. **Two outage modes:**
   - *Internet lost, LAN Session Authority reachable:* normal operation; clients talk to the LAN Runtime directly. This is not offline mode.
   - *Client cut off from the Session Authority:* drafts, Offline Outbox and permitted cached views only.
   A cloud replica never becomes a second writer.
4. **Evidence:** every accepted change and every recorded rejection commits atomically with its Evidence Event, receipt and outbox row (DEC-43). Checkpoint signing and anchoring run afterwards (ADR-003).
5. **Information asymmetry:** clients receive authorized projections only, never a full Release or hidden events. Material already delivered to a device cannot be withdrawn retroactively (REQ-008).

## 2. Transport surface

Routes are versioned under `/v1`. Transport choices follow ADR-010.

| Operation | Route | Semantics | In reference slice |
|---|---|---|---|
| Bootstrap | `GET /v1/sessions/{id}/sync/bootstrap` | Authorized snapshot, effective Release metadata, projection revision, opaque cursor, credential expiry, Session Authority identity and epoch | No |
| Submit Command | `POST /v1/sessions/{id}/commands` | One Command per request; receipt per 09 §4 | Yes |
| Submit batch | `POST /v1/sessions/{id}/commands:batch` | Each Command evaluated independently, in order; per-Command receipts | No |
| Receipt lookup | `GET /v1/sessions/{id}/commands/{commandId}` | Original receipt; visible only to its submitter and authorized operators | Yes (submitter only) |
| Live deltas | `GET /v1/sessions/{id}/sync/stream` (Server-Sent Events) | Authorized deltas; SSE `id` is the Projection Cursor; at-least-once | No |
| Catch-up | `GET /v1/sessions/{id}/sync/deltas?cursor=` | Ordered authorized deltas, next cursor, or `SYNC_CURSOR_EXPIRED` | No |
| Snapshot reset | `GET /v1/sessions/{id}/sync/snapshot` | Fresh filtered snapshot after cursor expiry or policy change | No |
| Studio collaboration | `WS /v1/projects/{id}/collaboration` | Authenticated CRDT update exchange; presence is ephemeral | No |
| Studio freeze and publish | `POST /v1/projects/{id}/publish` | Fenced materialization, validation, Definition Revision, Release | Yes (optimistic Draft, no CRDT) |
| Push-to-talk floor control | `POST /v1/sessions/{id}/voice-channels/{channelId}/floor-requests` and `/renew`, `/release` | The one exception to the command endpoint (DEC-48); online only; never queued or replayed | No |
| Voice media | WebRTC through the media provider with a Media Credential from `voice_channel.join` | Outside this protocol (ADR-017) | No |

**Authentication.** The server derives Organization, Person, Participant, Seat Assignments and Active Role Context from credentials and current assignments. `organizationId`, actor and authority fields supplied by clients are ignored. Devices are bound to a Person. Offline authority expires absolutely eight hours after server issuance and cannot renew offline. On expiry, the client keeps only drafts permitted by policy and queues or submits nothing until re-authenticated (OPEN-015).

## 3. Command envelope and receipt

The envelope is defined in 09 §3.1:

```json
{
  "commandId": "fb4ff18d-89b8-4c4c-98c1-3c02af84b5c0",
  "deviceId": "54040ee8-26d3-4db8-af89-32d2691f59db",
  "operationType": "artifact.submit",
  "aggregateId": "699d2d3f-3f39-4c40-98df-e315a02130a5",
  "expectedAggregateVersion": 2,
  "governingReleaseId": "d40d7264-226d-4ec4-9703-5aa35c930fe4",
  "activeSessionRoleId": "scribe",
  "deviceObservedAt": "2026-10-17T15:42:00Z",
  "payload": {}
}
```

- `commandId` is unique per Session and stable across retries.
- The payload digest is SHA-256 over the canonical serialization of the envelope (sorted keys), so key order never matters.
- Same ID, same digest, same Principal → the original receipt, `replayed: true`, nothing re-executed.
- Same ID with a different digest or Principal → `IDEMPOTENCY_COLLISION` (409), no receipt.
- The server records Person, Participant, Active Role Context, Deployment, Authority Epoch, receipt time, resulting version and Evidence Sequence.

Receipt (09 §4.1):

```json
{
  "commandId": "fb4ff18d-89b8-4c4c-98c1-3c02af84b5c0",
  "status": "accepted",
  "aggregateVersion": 3,
  "evidenceSequence": 183,
  "errorCode": null,
  "message": null,
  "replayed": false
}
```

| Outcome | Recorded | Meaning |
|---|---|---|
| `accepted` | Receipt + past-tense event | Committed |
| `rejected` | Receipt + `command.rejected` | Not executed; stable code |
| `needs_reconciliation` | Receipt + `command.reconciliation_required` | Stale version or incompatible Release; user or operator action needed |
| `received` | Receipt | Durable but not final (asynchronous processing only) |
| `local_pending` | Client only | Never a server success |

Refused **without** a receipt, because they never reach the Session: unauthenticated or malformed requests, non-Participants, unregistered or revoked devices, a missing Active Role Context for a multi-role Participant, and any request arriving while this Deployment is not the active Session Authority.

## 4. Offline client state machine

### 4.1 States

```text
ONLINE_SYNCED ── connection to authority lost ──> OFFLINE_READY
     ▲                                                 │
     │                                         draft / queue command
     │                                                 ▼
     │                                           LOCAL_PENDING
     │                                                 │
     │                                            reconnect
     │                                                 ▼
     └──────────── all accepted <──────────── RECONCILING
                                                       │
                                  rejected / needs_reconciliation
                                                       ▼
                                             NEEDS_RECONCILIATION
```

### 4.2 Queueing rules

- The draft and the queued Command are persisted locally before the client shows "saved on this device" (REQ-043).
- **Queueable offline (OPEN-015):** only `artifact.create`, `artifact.edit`, `artifact.submit` and `ballot.cast`, when permitted to an eligible non-control Session Role. **Never queued:** Commands requiring a control role (`isControlRole`), adjudication, Stage, timer, Session status, Release Activation, voice, Floor, composition, effect approval or another Approval Decision. New Command types default to live-only. Queued Commands are provisional regardless; the Session Authority decides on reconnection.
- Cached timers and Stage are estimates; the server's deadlines decide eligibility. A late Command may be rejected even though it was drafted in time.

### 4.3 Feature rules — DEC-46 to DEC-58

These rules are fixed by product decisions and the resolved OPEN-015 policy.

| Command or call | Offline behavior |
|---|---|
| `ballot.cast` | May be queued if the offline projection includes the Poll. Judged at server receipt time against the current Electorate, Poll state and deadline; after close it is rejected with `DEADLINE_EXPIRED` unless a recorded grace policy applies (11 §7). |
| `poll.open`, `poll.close`, `poll.tally`, `poll.certify`, `poll.void`, `poll.correct` | Never queued. |
| `voice_channel.*`, `voice_recording.*`, `voice_transcription.*`, `voice_consent.*` | Never queued; voice needs a live connection (12 §8). |
| Push-to-talk floor requests, renewals and releases | Never queued and never replayed after reconnection; the client discards them and re-derives its grants (12 §5). |
| `composition_run.start`, `composition_run.cancel` | Never queued. |
| `effect_proposal.approve`, `.reject`, `.return` | Never queued; an Approval Decision needs the live Session Authority and current state version (10 §10, INV-026). |

## 5. Reconnection

1. Authenticate to the registered Session Authority; verify Session ID, Deployment identity and epoch (the epoch is informational for the client, not proof of leadership) and credential state.
2. The server resolves membership, Seat Assignments, revocations, projection policy and active Release; the client discards cached material it is no longer permitted to hold where it can.
3. Fetch a snapshot if the cursor expired, the policy revision changed or the server reports a gap; otherwise consume ordered deltas first.
4. Send queued Commands in dependency order, unchanged: same Command ID, digest, expected version and Governing Release. Never bump versions or rewrite Release IDs automatically.
5. For each receipt: mark accepted only on `accepted`; keep rejected or reconciliation items with the local draft for correction; retry transient failures with bounded exponential backoff and jitter, looking up the receipt before each retry; never retry refusals.
6. Advance the cursor only after deltas are stored locally; an interruption restarts from the stored cursor and Command IDs.
7. Report "fully synchronized" only when no Commands are pending or unresolved and credentials are valid.

## 6. Release activation compatibility

Every Artifact and Workflow Instance pins its Governing Release (INV-021). Default policy (ADR-004): existing instances keep their Release; new instances use the newly activated Release; safe prospective changes apply after activation; consequential changes need impact review and approval.

A queued Command is checked against: the target's Governing Release; current revocations; target version and state; server deadlines; and any approved migration. A creation Command naming a superseded Release returns `needs_reconciliation` with `INCOMPATIBLE_RELEASE`; the client revalidates and resubmits under a new Command ID.

## 7. Client actions by error code

Codes, HTTP statuses and retry rules are defined in 09 §8.1. Client behavior:

| Code | Client action |
|---|---|
| `NETWORK_UNAVAILABLE`, `TRANSIENT_DEPENDENCY` | Keep outbox and draft; bounded retry after receipt lookup |
| `AUTH_EXPIRED` | Re-authenticate; keep encrypted local draft if policy permits |
| `ACCESS_REVOKED`, `NOT_A_PARTICIPANT`, `DEVICE_NOT_REGISTERED` | Stop submitting; clear controllable cached material |
| `AUTHORITY_UNAVAILABLE` | Retry the same authority; never fail over automatically |
| `IDEMPOTENCY_COLLISION` | Protocol error; never reinterpret the payload |
| `STALE_AGGREGATE_VERSION` | Refresh projection; explicit merge; new Command ID |
| `INCOMPATIBLE_RELEASE` | Guide mapping; revalidate; new Command ID |
| `INVALID_TRANSITION`, `PERMISSION_DENIED`, `TARGET_NOT_FOUND` | Explain the allowed next action without revealing protected state |
| `SYNC_CURSOR_EXPIRED` | Fetch a fresh snapshot; keep the outbox |
| `VALIDATION_FAILED` | Restore editable data with field-level details |

## 8. Authority transfer and fencing

`runtime.session_authorities` is the single authority record in the authoritative environment. Transfer is an operator-run procedure, never a browser decision or DNS failover (ADR-001, OPEN-016):

1. Suspend new intake; drain in-flight Commands; unknown outcomes are resolved by receipt lookup.
2. Prove the old authority is fenced (for example by revoking its write credentials) before enabling the successor. Without proof, do not declare the transfer successful.
3. In one controlled transaction, advance the epoch and name the successor Deployment. Every write path checks Deployment and epoch inside its own transaction.
4. Restore database, objects, receipts, evidence sequence and outbox to a consistent point; verify the checkpoint chain; resume from the last committed state.
5. Record operator, reason, fencing proof, old and new epochs and recovery status as an Evidence Event and an `authority_transfers` row.

Air-gapped Sessions are authoritative locally from creation. A cloud and an institutional Deployment never both process Commands for one Session; cross-site moves are maintenance-window procedures until a validated transfer protocol exists.

**Reference slice:** every Command checks that the authority row is `active` and names the server's configured Deployment; foreign and fenced authorities are refused with `AUTHORITY_UNAVAILABLE` and leave no receipt (tested). There is no transfer procedure yet.

## 9. Studio collaboration

- Authenticated Designers join project documents over WebSocket with server-checked editing scope; they exchange immutable CRDT updates and state vectors. Presence is never security or evidence.
- Accepted updates are persisted (`studio.document_updates`) and can be replayed to a reconnecting client. Size, rate and quota limits apply.
- Structural validation runs continuously on materializations and fully at publication; provisional errors never block convergence.
- Publication freezes an exact materialization; later updates belong to the next Draft state.
- Yjs is the candidate library; any CRDT that passes SYNC-01 and SYNC-02 is acceptable.

## 10. Deltas and cursors

- The evidence stream has a strict per-Session sequence. A Participant's projection omits restricted events and must not reveal gaps, counts or metadata that disclose hidden activity.
- Cursors are opaque and server-validated, scoped to Session, Participant or Seat, policy revision and projection version, with an expiry.
- Delivery is at least once; clients deduplicate by visible update ID. There is no ordering across Sessions.
- A Seat reassignment or revocation invalidates cursors; old cursors cannot retrieve newly unauthorized content.
- Clients acknowledge stored cursors, not received frames. Bounded replay storage; gaps require a snapshot.

## 11. Profiles and threats

- **Cloud:** managed control plane; provider object storage; Keycloak or customer identity provider.
- **Institutional:** self-contained API, PostgreSQL, worker, object storage and Keycloak.
- **Air-gapped:** no mandatory outbound dependency; pre-provisioned Packages, trust roots and offline upgrades; external model plugins disabled or replaced by trusted local plugins (REQ-065).
- **Threats requiring negative tests:** stolen offline device, stale grants, replayed Commands, corrupted queues, duplicated delivery, compromised signing key, misleading device time, sensitive export, split-brain operators, restored old database.

## 12. Acceptance tests

| ID | Test | Status (reference slice, 2026-10-17) |
|---|---|---|
| SYNC-01 | Two Designers edit concurrently, partition, reconnect and converge to identical materialized bytes; invalid merged workflow is rejected at validation. | Not implemented |
| SYNC-02 | Freeze after concurrent edits yields one immutable, digested revision; later updates do not change it. | Partial: immutability and digest proven; no CRDT |
| SYNC-03 | LAN Runtime accepts Commands without Internet; air-gapped install makes no external request. | Not run |
| SYNC-04 | A disconnected Participant drafts and queues; nothing reports accepted locally. | Not implemented (no client outbox) |
| SYNC-05 | The same Command submitted repeatedly after a lost acknowledgement commits once with one Evidence Event. | Pass (six concurrent submissions) |
| SYNC-06 | Same Command ID with a different payload is refused. | Pass |
| SYNC-07 | Two competing actors on the same version yield one accepted transition and one conflict. | Partial: stale-version reconciliation proven for Artifact transitions |
| SYNC-08 | A delayed Command after role revocation is refused and no new projection is sent. | Not implemented |
| SYNC-09 | A Command against a pinned Artifact is validated against its Governing Release. | Partial: Governing Release mismatch returns `INCOMPATIBLE_RELEASE`; live activation not implemented |
| SYNC-10 | A cursor from an earlier role or policy revision cannot reveal new content. | Not implemented |
| SYNC-11 | Socket loss with duplicated and reordered deltas reconciles via catch-up. | Not implemented |
| SYNC-12 | A partition cannot auto-promote a writer; stale or foreign authority writes are refused. | Partial: foreign and fenced authority refused; no transfer |
| SYNC-13 | A changed historical event fails independent checkpoint verification. | Not implemented |
| SYNC-14 | An outbox with expired credentials keeps only permitted drafts; nothing is accepted before re-authentication. | Not implemented |
| SYNC-15 | The DEC-16 reconnect and submission fixture is measured against agreed targets. | Not run (OPEN-019) |
| SYNC-16 | A Ballot queued offline and delivered after the Poll closes is rejected with `DEADLINE_EXPIRED`. | Not implemented |
| SYNC-17 | After reconnection no stale floor request is replayed and no Approval Decision is accepted from a queue. | Not implemented |

## 13. Institution-owned values

OPEN-014, OPEN-015 and OPEN-017 now define the managed-device posture, key custody, offline lifetime and Command allowlist, and recovery/anchor targets. Deployments must implement and evidence those approved values. Institution-owned values still awaiting resolution include the transfer runbook (OPEN-016), recording and transcription consent handling (OPEN-027), retention of objects and cursors, Command size, outbox and delta limits, and plugins permitted in air-gapped mode. Their absence blocks production release, not implementation and testing of these contracts.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.1.2 | 2026-10-23 | Applied resolved OPEN-014/015/017 policy: eight-hour offline authority, the exact four-Command allowlist, managed-device/key-custody constraints and recovery/anchor targets. |
| 1.1.1 | 2026-10-17 | Added §4.3 offline feature rules for Ballots, voice, floor control and Effect Proposal approvals (DEC-48, INV-026); floor endpoints and voice media in the transport table; SYNC-16 and SYNC-17; split §4 into subsections. |
| 1.1.0 | 2026-10-17 | Adopted Glossary terms and DEC-37 outcomes (renamed NEEDS_REVIEW to NEEDS_RECONCILIATION); recorded rejections with evidence (DEC-43); canonical digest; `activeSessionRoleId`; listed requests refused without receipts; SSE stream and WebSocket collaboration per ADR-010; proposed offline-queueable Command rule pending OPEN-015; moved the error catalog to 09 §8.1; added implementation status to every acceptance test. |
| 1.0.0 | 2026-10-17 | Initial proposal (archived). |
