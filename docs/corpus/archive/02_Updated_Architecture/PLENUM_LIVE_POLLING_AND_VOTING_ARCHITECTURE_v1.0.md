# Plenum Live Polling & Voting Architecture v1.0

**Document:** VOTE-ARCH-001 · **Status:** Approved feature direction; technical design proposed for implementation · **Date:** 2026-10-17  
**Owner:** Runtime Polling & Voting capability · **Depends on:** enterprise PRD/Foundation v0.2, Platform/Runtime/Schema/API v1.2, PostgreSQL Data Model and Synchronization v1.0, evidence architecture.

## 1. Scope and foundational authority
Live polling and institutional voting are **core Runtime capabilities**, configurable through Studio, with optional bounded voting-method and presentation adapters. They are not model adjudication plugins. Runtime controls eligibility, identity, authorized cast, time, ballot secrecy, validation, tally, certification and evidence. Plugins cannot independently certify or mutate voting results.

Supported baseline vote types: single-choice, multiple-choice with bounds, yes/no/abstain, simple majority, supermajority, unanimity, quorum, per-seat weighted votes, configured veto rights and nonbinding opinion polls. Ranked-choice is a subsequent **method adapter** only after explicit published method definition, tie rules, and independent tally conformance tests. Plurality, denominators, abstentions and tie behavior MUST be explicit, never implicit defaults.

## 2. Lifecycle and states
`draft -> configured -> scheduled -> open -> closed -> tallied -> certified`, with explicit exceptional `cancelled`, `voided`, `disputed` and `correction_issued`. `open` and `close` are authoritative transitions. `tallied` is derived; `certified` requires authorized procedure and server-side validation. Polls can be informational; if a certified result initiates a consequential state mutation or workflow, that mutation passes ordinary Runtime authorization and command/evidence rules. A vote submitted by a human participant does not itself count as a plugin-generated proposed effect.

No editing options, eligibility rules, secrecy mode, weights, cutoff, tally method, or quorum after opening: changes require close/void-and-reissue under a new immutable ballot revision, not silent reinterpretation of cast votes. Before open, changes are versioned and previewed.

## 3. Definitions compiled into Simulation Release
`PollDefinition` contains `id`, `scope`, `question`, options with stable IDs, `pollType`, `tallyMethodVersion`, `eligibilityPolicy`, `oneBallotPer` (`seat_assignment` default), `allowRevote`, `anonymousOrSecret`, `quorumRule`, `weights`, `vetoRule`, `tieRule`, `openTrigger`, `closeTrigger`, `deadlinePolicy`, `resultVisibilityPolicy`, `certificationPolicy`, `onCertifiedWorkflowBinding`, `retentionClass`.

Distinguish **anonymous survey** (no personally linkable identity by design, subject to anti-duplication design) from **secret ballot** (eligibility verified but choices protected from general operators). Metadata leakage from small cohorts is a real possibility; suppression thresholds/reporting policies are configuration and research/privacy gates. Do not claim coercion resistance or cryptographic end-to-end verifiability from server-side secrecy alone.

## 4. Data model (logical; reconcile migrations with canonical data spec)
- `voting.poll_definitions`: versioned definitions bound to a Simulation Release.
- `voting.poll_instances`: tenant/session/release, definition reference, status, open/close/certification timestamps, version, authority epoch.
- `voting.ballot_options`: immutable at poll open, scoped stable option identifiers.
- `voting.eligible_voters`: eligible seat assignment, policy/role snapshot, weight and status; frozen at open unless explicit versioned exception policy.
- `voting.ballot_receipts`: `(organization_id,session_id,poll_id,command_id)` unique; seat/token consumption identifier, ciphertext/restricted vote pointer where applicable, accepted server sequence/time, status; cross-tenant scoped FK. Prevent duplicate accepted ballots for each seat if `allowRevote=false`; with revote, preserve all submissions and specify final-count selection.
- `voting.ballots`: choice data, ballot revision, immutable accepted sequence and eligibility proof reference; access restrictions separate identity from choices for secret votes.
- `voting.tally_snapshots`: source ballot set hash, method version, count data, tally version, computed_at; provisional/not official.
- `voting.certifications`: unique accepted result per poll revision, authority epoch, reviewer/certifier identity, certified tally hash, method version, result event, timestamp, correction link.

Use PostgreSQL transactions, row locks/unique constraints and signed/checkpointed Plenum evidence, not a standalone vote ledger. Tenant and resource authorization enforced both before casting and before revealing results. In secret-ballot mode, full identities must not be exposed to tally readers; encryption, token issuance and administrator ability to recover ballots require security design review.

## 5. Casting and finalization
1. Participant opens authorized poll projection. Runtime decides seat eligibility server-side and returns short-lived ballot capability scoped to poll/seat; no client-provided eligibility is trusted.
2. `POST /v1/sessions/{id}/polls/{pollId}/ballots` carries `commandId`, immutable definition revision, expected poll version/epoch, capability and option IDs (or secret ballot envelope). **Server** verifies authorization, eligible voter uniqueness, phase/time gates and live authority.
3. On accept, atomic transaction consumes single-use ballot eligibility as configured, stores ballot and receipt, appends evidence, updates outbox; retry of same command returns same receipt. Different duplicate commands obey explicitly configured revote policy.
4. On close, reject late casts according to the *server-authoritative* deadline. A disconnected device's local creation timestamp does not confer timeliness. Exceptional grace policy must be explicit and evidence-backed; default no late acceptance.
5. Tally is computed over accepted ballot set and pinned method/version; independent recount and source hash must agree. Certificate uses conditional version compare, certifier permissions and `resultHash` bound to ballot-set hash and published method.
6. Certified vote may emit authorized `poll.result.certified` and optionally trigger a normal Runtime workflow; no model plugin may bypass the standard consequential-effect approval boundary.

### Example numerical definitions
- Quorum basis: eligible seats frozen at open, or explicitly enumerated custom electorate snapshot; abstention counts toward participation only if policy says so.
- Simple majority: specify `yes > no` versus `yes > floor(validVotes/2)` and how abstain/invalid ballots affect denominator; default **must be set in definition**.
- Weighted/veto voting: weights and veto rights frozen at open; no hidden platform fallback. Tie and threshold rules are first-class typed configuration.

## 6. Realtime events, participant projections and API
- `POST /v1/sessions/{sessionId}/polls/{pollId}/open|close|tally|certify|void` — authorized operation, expected version, command ID and reason where applicable.
- `GET /v1/sessions/{sessionId}/polls` — authorized available polls; `GET .../{pollId}` — participant-specific projection; `POST .../{pollId}/ballots`; `GET .../{pollId}/my-receipt`.
- `GET .../{pollId}/result` — only when tally/result visibility permits; `GET .../{pollId}/audit` — restricted operator/auditor view.
- Events: `poll.opened`, `ballot.accepted`, `poll.closed`, `poll.tally.computed`, `poll.result.certified`, `poll.voided`, `poll.correction.issued`.
- Typed errors: `POLL_NOT_OPEN`, `NOT_ELIGIBLE`, `ALREADY_VOTED`, `INVALID_BALLOT`, `STALE_POLL_VERSION`, `DEADLINE_EXPIRED`, `AUTHORITY_UNAVAILABLE`, `RESULT_NOT_RELEASED`, `CERTIFICATION_CONFLICT`.

For secret ballots, participant receipts must prove acceptance without revealing others' selections; do not publish individual-choice events on shared streams. Realtime counters cannot leak confidential votes before release. UI uses `pending on device`, `submitted to authority`, `accepted`, `rejected`, `certified result` distinctly.

## 7. Offline and air-gap behavior
Institutional LAN with local authoritative Runtime: full ballot issuance, cast, tally and certification work without Internet. Disconnected individual device: may compose a provisional ballot if an authorized offline projection permits; it **cannot cast an authoritative vote**, reserve a floor, certify or advance the poll. On reconnect, submitted queued ballot is subject to actual acceptance time, eligibility and current poll/release state. Default is no late ballot after closed deadline. Never fabricate vote success. Server may explicitly configure a signed bounded offline voting window in a future protocol revision, but this is NOT a v1 requirement.

## 8. Voting method plugins
Plugin can supply declarative method adapter with signed artifact, exact algorithm version, deterministic fixture vectors, inputs and outputs, and reproducibility metadata. Core Runtime still checks permission, freezes electorate, accepts ballots, controls certification and evidence. An external voting service is not a second authority. In air gap, method bundles must be locally installed, hash-pinned and independent of public egress. If method unavailable, poll cannot open or certify; fail visibly.

## 9. Security and research evidence
Record poll-definition digest, electorate snapshot digest, accepted-ballot-set digest, tally algorithm/version, certification actor and signed evidence checkpoint anchor. Secret ballots require storage separation and purpose-specific access policies, plus visibility/retention safeguards. Do not export private ballot choices to general analytic or plugin interfaces. Corrections create a new linked certification with cause and authorized reviewer, never rewrite original event or erase ballots. Institutional policy must resolve retention, encryption/key custody, legal/privacy basis and researcher access.

## 10. Acceptance and verification matrix
| ID | Scenario | Required observation |
|---|---|---|
| VOTE-01 | Eligible voter casts | One accepted ballot and atomic receipt/evidence |
| VOTE-02 | Ineligible/cross-tenant cast | Denied at authoritative boundary |
| VOTE-03 | Retry same command | Same receipt; no second ballot |
| VOTE-04 | Two concurrent ballots same seat | Correct one-vote/revote policy without race |
| VOTE-05 | Cast while offline, reconnect after close | Clear rejection under default no-late rule |
| VOTE-06 | Operator edits open poll options | Denied; must void/reissue |
| VOTE-07 | Weighted, veto, quorum and tie fixtures | Independently reproducible, explicit denominators |
| VOTE-08 | Unauthorized observer queries votes | Neither ballots nor early tally leaked |
| VOTE-09 | Secret ballot results requested early | Denied; no identity-choice leak in events/logs |
| VOTE-10 | Two simultaneous certifications | At most one accepted current certification |
| VOTE-11 | Method plugin unavailable | Poll blocked/fails safely; no fabricated result |
| VOTE-12 | Air-gapped LAN | End-to-end vote with zero public egress |
| VOTE-13 | Research export | Recount/provenance, governed secrecy and correction chain |
| VOTE-14 | 500×10 reconnect/cast burst | Measure p95/p99 latency, contention and integrity |
| VOTE-15 | Screen-reader/keyboard and zoom | Fully operable and perceivable ballot states |

**Status:** Specification only; executable DDL, contract-test fixtures and runtime tests NOT RUN.
