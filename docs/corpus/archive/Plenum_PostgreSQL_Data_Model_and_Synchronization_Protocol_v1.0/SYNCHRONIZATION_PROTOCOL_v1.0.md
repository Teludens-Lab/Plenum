# Plenum — Synchronization and Offline Runtime Protocol v1.0

**Status:** Implementable target contract, approved architecture principles; exact transport, identity TTL, and security policy parameters require institutional configuration. **Date:** 2026-10-17. **Companion:** `POSTGRESQL_LOGICAL_DATA_MODEL_v1.0.md`. **Authority:** Foundational Product Definition v0.2, Platform/Runtime/Canonical Schema/API contracts v1.2. This document does not claim any production-tested offline deployment.

## 1. Non-negotiable consistency model

1. **Studio** supports concurrent drafts using CRDT update convergence; published Releases exist only after a **server-authoritative freeze and semantic validation**. Draft convergence ≠ simulation correctness.
2. **Runtime** accepts participant commands only at the session's designated authoritative deployment and authority epoch. Participant devices can create drafts, prepare commands, and maintain permitted offline content but cannot finalize adjudication or authoritative workflow state offline.
3. **Two outage modes:** (a) Internet unavailable, LAN authoritative Runtime available ⇒ normal locally authoritative operation; (b) client disconnected from all authoritative Runtimes ⇒ drafts/outbox and locally permitted reversible work only. A cloud replica does not become a second writer.
4. **Tamper-evident journal:** accepted authoritative mutation, evidence, receipt and notification outbox commit atomically. Evidence checkpoint signing/anchoring runs later and must be able to detect missing/altered records.
5. **Information asymmetry:** never send the client a complete confidential simulation definition or hidden events; use authorized projections and default-deny field filtering. Offline confidentiality cannot be retrospectively revoked from a fully compromised or long-disconnected device.

## 2. Transport surface (logical endpoints)

These are **illustrative REST/WS routes**; adopt a stable versioned API prefix and preserve any already approved public route names by mapping rather than silent replacement.

| Operation | Logical request | Response / semantics |
|---|---|---|
| Bootstrap | `GET /v1/sessions/{id}/sync/bootstrap` | Authorized projection snapshot, effective release metadata, projection revision, opaque cursor, capability expiry, authority identity/epoch |
| Submit one or batch | `POST /v1/sessions/{id}/commands` | Per-command durable receipt/result; no `accepted` until transaction committed |
| Receipt lookup | `GET /v1/sessions/{id}/commands/{commandId}` | Idempotent accepted/rejected/needs_reconciliation receipt; permission checks apply |
| Catch-up | `GET /v1/sessions/{id}/sync/deltas?cursor=...` | Ordered *authorized* deltas, next cursor, resnapshot signal; no information leakage through skipped-event metadata |
| Live push | Session-scoped WS or SSE | Hints/deltas only, at-least-once and potentially duplicated; reconnect with cursor |
| Reset | `GET /v1/sessions/{id}/sync/snapshot` | Fresh filtered snapshot when cursor expires or visibility policy changes |
| Studio collaboration | `join/update/ack/snapshot` | Authenticated CRDT update exchange; accepted draft updates do not imply publish eligibility |
| Studio freeze | `POST /v1/projects/{id}/revisions` | Fenced immutable materialization and validation receipt; eventual Release publication is distinct |

**Authentication:** server computes tenant/user/actor/seat context from authenticated credentials and current assignments; `actorId`, `organizationId`, `deviceId` in payloads are untrusted claims. All operations reauthorize at the trusted boundary. Bind a device registration to credentials. Fail closed after identity expiration unless institution approves a bounded local capability for permitted drafting only.

## 3. Command envelope and durable receipt

```json
{
  "protocolVersion": "1.0",
  "commandId": "fb4ff18d-89b8-4c4c-98c1-3c02af84b5c0",
  "sessionId": "3b47d833-21f2-47ae-8272-205cf7f5e7b3",
  "deviceId": "54040ee8-26d3-4db8-af89-32d2691f59db",
  "operationType": "artifact.submit",
  "aggregateId": "699d2d3f-3f39-4c40-98df-e315a02130a5",
  "expectedAggregateVersion": 7,
  "governingReleaseId": "d40d7264-226d-4ec4-9703-5aa35c930fe4",
  "deviceObservedAt": "2026-10-17T15:42:00Z",
  "payload": {"artifactVersion": 2, "submission": {}}
}
```

`commandId` is unique per session and stable over retries; canonical payload digest covers all immutable client-specified business fields. The server separately records authenticated actor, verified deployment, accepted authority epoch, `receivedAt`, `committedAt`, committed aggregate version and evidence sequence. A replay of the same ID+same digest returns the original result **without executing again**. Same ID+different digest ⇒ `IDEMPOTENCY_COLLISION` (409). Command batches are independently evaluated unless a separate transactional batch contract is explicitly defined.

```json
{
  "commandId": "fb4ff18d-89b8-4c4c-98c1-3c02af84b5c0",
  "status": "accepted",
  "aggregateVersion": 8,
  "evidenceSequence": 183,
  "authoritativeAt": "2026-10-17T15:44:13Z",
  "correlationId": "opaque-id"
}
```

Response statuses: `received` (durable receipt, processing not final), `accepted` (transaction committed), `rejected` (not executed; stable error), `needs_reconciliation` (user/operator action). Client-only `local_pending` is never a server success status. Returned receipt must itself be visible only to its authorized submitter/operator.

## 4. Offline state machine

```text
ONLINE_SYNCED ── network loss ──> OFFLINE_READY
     ▲                                 │
     │                              edit draft
     │                                 ▼
     │                           LOCAL_PENDING
     │                                 │
     │                            reconnect
     │                                 ▼
     └──── accepted <────────── RECONCILING
                                       │
                         denied/stale/incompatible
                                       ▼
                               NEEDS_REVIEW
```

- Local storage must persist draft plus pending command before displaying `saved on device`. A local pending state must be clearly separate from authoritative submission.
- If device is only Internet-disconnected but its session-local Runtime is reachable, send commands normally to that Runtime. LAN operation is not a second offline outbox authority.
- Offline permissions are conservative: draft, edit permitted local content, prepare submission; view only previously authorized cached projections within an institutionally configured validity period. Adjudication and authoritative phase transitions are unavailable without Runtime connectivity.
- Device clock and locally cached phase/timer are advisory; server determines authoritative deadlines and eligibility. A late arrival might be rejected despite an on-device draft timestamp.

## 5. Reconnect algorithm

1. Restore network and cryptographically authenticate to the **registered designated authority**, verify session ID, deployment identity, authority epoch (epoch from server is informational to client, not proof of independent leadership), and credential state.
2. Resolve device/participant membership, latest assignment, revocations, projection policy, and active release; invalidate cached data no longer within permitted projection where controllable.
3. Fetch current projection snapshot if cursor expired, policy revision changed, or server reports gap; otherwise consume ordered authorized deltas to catch up before commands whose preconditions depend on latest state.
4. Send outbox in causal/dependency order, preserving each stable command ID, digest and expected version. Do **not** blindly bump stale expected versions or rewrite governing release IDs.
5. For each receipt: mark accepted only on committed receipt; retain rejected conflicts and local draft for correction; honor retryable/transient failures with bounded exponential backoff/jitter and avoid retrying denied commands.
6. Advance sync cursor only when deltas are durably incorporated into the local projection. On interruption repeat safely from the persisted cursor and command IDs.
7. Post-sync, refresh capability expiry and projection scope. Do not announce `fully synchronized` if pending conflicts, expired credentials, or unresolved commands remain.

## 6. Release activation compatibility

Every `artifact_instance` and `workflow_instance` pins `governing_release_id`, definition key and state version. Default safe activation policy: existing active workflows retain their governing Release; new instances use the newly activated Release; presentation-only compatible changes may take effect prospectively; consequential permission/schema/graph/phase changes require impact analysis and explicit approval. Historical evidence remains bound to the actual Release.

A previously prepared offline command is rechecked against (a) its target's governing release, (b) latest authoritative permission revocation, (c) target version/state, (d) server-enforced deadline and (e) explicit migration/compatibility policy. Do not treat old authorization or cached access as continuing permission. If new release changes a field schema but the target remains pinned to old schema, validate with the old schema unless a ratified migration requires otherwise.

## 7. Errors and client actions

| Code | Retry automatically? | Action |
|---|---|---|
| `NETWORK_UNAVAILABLE` | Yes, bounded | Retain outbox/draft; retry after reconnect |
| `TRANSIENT_DEPENDENCY` | Yes, bounded | Backoff; consult durable receipt before new attempt |
| `AUTH_EXPIRED` | No | Reauthenticate; keep local draft encrypted if policy permits |
| `ACCESS_REVOKED` | No | Block submission and clear controllable unauthorized cached material |
| `AUTHORITY_UNAVAILABLE` | No immediate failover | Retry designated authority; operator-run transfer only |
| `IDEMPOTENCY_COLLISION` | No | Developer/protocol error; never reinterpret payload |
| `STALE_AGGREGATE_VERSION` | No blind retry | Refresh projection; manual or explicit safe merge |
| `INCOMPATIBLE_RELEASE` | No | Guide mapping, revalidate and resubmit new command with new ID |
| `INVALID_TRANSITION` | No | Explain allowed next action without exposing protected state |
| `SYNC_CURSOR_EXPIRED` | Yes via snapshot | Fetch fresh authorized snapshot, preserve outbox |
| `VALIDATION_FAILED` | No | Restore editable data and field-level correction details |

HTTP mappings illustrative: 401 for identity, 403 for denial, 409 for concurrency/compatibility, 422 for invalid payload, 410 for expired cursor if implemented that way, 503 for temporary outage. Use consistent problem envelope and correlation ID; avoid leaking whether an unauthorized target exists.

## 8. Authority transfer and fencing

`runtime.session_authorities` is the one durable registry within the authoritative environment. Authority change is an **operationally controlled procedure**, not a browser decision or DNS fallback. Guardrails:

1. Suspend new authoritative intake and drain/resolve in-flight commands or mark unknown responses retriable by receipt lookup.
2. Prove old authority is fenced (e.g., revoke its durable write credentials/lock) **before** enabling a replacement. If proof is unavailable due to partition, do not assert transfer successful.
3. Atomically advance epoch and designate successor under a uniquely coordinated control-plane transaction. All write paths check epoch and actual deployment identity within each transaction; stale epochs are rejected.
4. Recover database, objects, receipts, session evidence sequence and event outbox to a consistent point; verify checkpoint chain; resume from last committed state.
5. Record authorized operator, reason, fencing proof, previous/new epoch and recovery status as an evidence/governance event.

For air-gapped operation, authority is local from session inception. A cloud installation and an institutional LAN installation must not both process authoritative commands for a session. Cross-site migration is offline/maintenance-window and human authorized until an independently validated transfer protocol exists.

## 9. Studio collaborative draft protocol

- Authenticated users join project/branch documents with server-checked editing scope. Exchange immutable CRDT binary updates and state vectors; presence/awareness is **ephemeral**, not a security or evidence authority.
- Persist accepted updates and support resuming missing updates after disconnection. Enforce update payload size, rate limits, document/tenant quotas, and access controls.
- Structural validations (unresolved refs, duplicate semantic keys, unsatisfiable gates, visibility leaks) run on materialization and at publish. UI may highlight provisional errors immediately without blocking CRDT convergence.
- Freeze/publish uses an exclusively validated materialization boundary; concurrent edits arriving after freeze belong to the next draft version. Publication cannot compile an indeterminate peer-specific state.
- Yjs is an implementation candidate, not required by the product contract; a compatible CRDT implementation must pass the same convergence, recovery, ACL and freeze tests.

## 10. Delta ordering and projection cursors

- The **server evidence stream** has strict per-session sequence. The *client-visible projection stream* may omit restricted events; therefore do not expose gaps or event counts that reveal hidden actions. Cursor tokens are opaque, signed or server-stored, scoped to `(session, principal/seat, policy revision, projection version)` and bound to expiration.
- Delta transport is at least once: duplicate notifications can arrive and are deduplicated by stable visible update ID. No global ordering is promised across different sessions.
- Visibility changes force reauthorization and often a projection reset. A cursor must not permit retrieving deltas after seat reassignment or access revocation.
- Clients acknowledge persisted projection cursor, not merely receipt of WS frames. The server bounds replay storage; missing history requires fresh authorized snapshot.

## 11. Evidence, security, operational profiles

- The server writes aggregate state + evidence event + durable command result + outbox in one transaction. Background evidence checkpoints cryptographically cover exactly specified ordered event sequence ranges, include previous checkpoint digest, canonical hashing algorithm/version and signer key ID. Independently anchored signatures allow offline verifier to detect mismatches.
- Cloud profile uses managed institutional or provider control plane; institutional profile packages self-contained API, PostgreSQL, worker, blob store and identity configuration; air-gapped profile has **no mandatory outbound dependency**, uses pre-provisioned packages, signing/trust roots and offline installation/upgrades. External model adjudication disabled or replaced by a trusted local adapter when unavailable.
- Threats: stolen offline laptop, stale permission grants, replayed commands, queue corruption, duplicated delivery, compromised signing key, misleading device time, sensitive export, split-brain operators, restored old database. Negative tests are mandatory.
- Concrete offline token TTL, high-security device controls, post-revocation cache disposal, trusted signing custody, classification boundary and recovery RPO/RTO remain institution-specific controlled policy values; their owner and acceptance evidence must be recorded before production use.

## 12. Protocol acceptance and property tests

- **SYNC-01:** Two Studio designers concurrently edit one document, partition, reconnect, converge to identical materialized bytes, and semantic validation rejects invalid merged workflow.
- **SYNC-02:** Freeze after concurrent edits yields exactly one immutable hash-linked definition; post-freeze update does not mutate released content.
- **SYNC-03:** Local-LAN Runtime accepts commands without Internet; air-gapped deployment has no required external request.
- **SYNC-04:** Disconnected participant can draft and queue; no local adjudication reports accepted.
- **SYNC-05:** Same command submitted three times after ack loss commits one transition/evidence event.
- **SYNC-06:** Payload collision for same ID rejected.
- **SYNC-07:** Two competing adjudicators under same version yield exactly one authoritative accepted transition and a conflict for the other.
- **SYNC-08:** Delayed offline command after role revocation is denied; server sends no new confidential projection.
- **SYNC-09:** Old-release command against pinned workflow is validated against pinned definition and current authorization; incompatible migration is not silently forced.
- **SYNC-10:** Cursor from previous role/visibility revision cannot reveal newly unauthorized content.
- **SYNC-11:** Loss of socket + duplicated/out-of-order push is reconciled through bounded delta catch-up.
- **SYNC-12:** Unfenced dual-site partition cannot auto-promote a writer; stale epoch writes rejected after fenced transfer.
- **SYNC-13:** Changed historical event fails independent checkpoint verification.
- **SYNC-14:** Offline/outbox with expired identity retains only permitted local draft; no authoritative acceptance until fresh authentication.
- **SYNC-15:** 5,000-participant reconnect and submission fixture is measured with documented hardware/configuration and agreed p95/p99 targets; no capacity success assumed.

## 13. Unresolved institution-owned operating values (not architecture reapproval)

Appropriate sign-off owners must specify: offline credential lease and validation TTL; device classification and managed-device posture; permitted offline operations by security class; authoritative transfer and fencing operations runbook; recovery RPO/RTO; checkpoint signing/HSM custody and independent anchor cadence; object and sync cursor retention; numeric command size/outbox/delta limits; external integrations permitted in air-gapped mode; and eventual REST/WS/SSE transport choice. Their absence is a production release gate, not a blocker to implementing and testing the v1 reference contracts.
