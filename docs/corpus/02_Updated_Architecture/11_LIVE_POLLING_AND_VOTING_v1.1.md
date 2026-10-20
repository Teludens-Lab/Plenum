# Plenum — Live Polling and Voting

## Document control

| Field | Value |
|---|---|
| Document ID | VOTE |
| Number | 11 |
| Version | 1.1.0 |
| Date | 2026-10-17 |
| Status | Product direction Confirmed (DEC-46, DEC-48, DEC-59); technical design Approved by Product Owner direction on 2026-10-20. First-release scope. |
| Owner | Technical Lead |
| Approvers | Product Owner; Technical Lead; Security Owner (role placeholders — OPEN-001) |
| Reads from | 01 PRD; 03 Schema; 05 Runtime; 06 Data and Security; 09 Contracts; Data Model v1.1; Sync v1.1; Decision Register; Glossary |
| Read by | Studio and Runtime implementation; tests; research exports |
| Authority | Poll and Ballot behavior: definitions, lifecycle, casting, tally, certification, secrecy, offline rules and acceptance tests. |
| Supersedes | Owner-supplied `PLENUM_LIVE_POLLING_AND_VOTING_ARCHITECTURE_v1.0.md` (VOTE-ARCH-001), kept in `archive/` |

---

## 1. Scope

Live polling and institutional voting are core Runtime capabilities configured in Studio (DEC-46). They are not adjudication plugins. The Runtime alone controls eligibility, identity, casting, timing, ballot secrecy, validation, tally, Certification and evidence. A Voting Method Adapter (DEC-59) may supply a tally algorithm; it cannot certify or change a result.

Supported poll types in the first release:

- single choice; multiple choice with minimum and maximum selections; yes / no / abstain;
- simple majority, supermajority and unanimity thresholds; quorum;
- weighted votes per Seat Assignment; configured veto rights;
- non-binding opinion polls.

Ranked-choice voting is deferred (DEC-46). Plurality, denominators, the treatment of abstentions and invalid ballots, and tie behavior are always stated in the Poll Definition; the platform has no implicit default for any of them.

## 2. Poll lifecycle

`draft` → `configured` → `scheduled` → `open` → `closed` → `tallied` → `certified`, with exits `cancelled`, `voided`, `disputed` and `correction_issued` (Glossary §7.9).

- `open` and `close` are authoritative transitions made by Command or by a configured trigger.
- `tallied` is derived from the accepted Ballot set. `certified` requires an authorized person and server-side validation.
- Before `open`, every change is versioned and can be previewed.
- After `open`, nothing changes: options, Electorate, secrecy mode, weights, deadline, tally method and quorum are fixed. A change means `poll.void` and a reissued Poll under a new definition revision. Cast Ballots are never reinterpreted.
- A certified result that starts a workflow or changes Session state does so through an ordinary Command with normal authorization and evidence. A human vote is not a plugin effect, so DEC-54 does not apply to it.

## 3. Poll Definition

Compiled into the Simulation Release (03 Schema §13.2).

| Field | Meaning |
|---|---|
| `id`, `scope` | Stable identifier; Session, Team or Stage scope |
| `question`, `options[]` | Option IDs are stable and immutable once open |
| `pollType` | One of the types in §1 |
| `tallyMethod`, `tallyMethodVersion` | Built-in method or pinned Voting Method Adapter |
| `electoratePolicy` | Information Policy selector for eligible Seat Assignments |
| `oneBallotPer` | `seat_assignment` (default) |
| `allowRevote`, `finalBallotRule` | If revoting is allowed, which submission counts (for example latest accepted) |
| `secrecy` | `open`, `secret_ballot` or `anonymous_survey` |
| `quorumRule`, `thresholdRule` | Explicit denominator and counting rules (§5.1) |
| `weights`, `vetoRule`, `tieRule` | Frozen at open |
| `openTrigger`, `closeTrigger`, `deadlinePolicy` | Manual, scheduled, Stage entry or exit, or condition; server time only |
| `resultVisibilityPolicy` | Who sees tallies and results, and when |
| `certificationPolicy` | Which Session Role or Organization Role may certify |
| `onCertifiedWorkflowBinding` | Optional workflow started by a certified result |
| `retentionClass` | Retention policy for Ballots and receipts |

**Secrecy modes.** A secret ballot verifies eligibility but hides choices from operators and general readers. An anonymous survey collects no personally linkable identity by design, subject to duplicate prevention. Small groups can leak choices through metadata; suppression thresholds belong to OPEN-028. Server-side secrecy alone is not coercion resistance or end-to-end verifiability, and the platform does not claim either.

## 4. Casting and Certification

1. The Participant opens the authorized Poll projection. The Runtime decides eligibility server-side and returns a short-lived ballot capability scoped to the Poll and the Seat Assignment. Client-supplied eligibility is never trusted.
2. The client sends `ballot.cast` through the command endpoint (09 §3, DEC-48). The payload carries the Poll definition revision, the capability, and option IDs or a secret-ballot envelope; `expectedAggregateVersion` is the Poll version.
3. The server checks authorization, Electorate membership, uniqueness, Poll state, server deadline and Session Authority. On acceptance one transaction stores the Ballot and receipt, consumes eligibility as configured, writes the Evidence Event and adds the outbox entry. Retrying the same Command ID returns the same receipt. A different Command for the same Seat Assignment follows the revote policy.
4. After close, late Ballots are rejected against the server deadline. A device timestamp never makes a Ballot timely (INV-011). A grace policy must be explicit and recorded; the default is no late acceptance.
5. The Tally runs over the accepted Ballot set with the pinned method version. An independent recount must produce the same counts and the same source hash.
6. `poll.certify` checks the expected Poll version, the certifier's permission and a `resultHash` bound to the Ballot-set hash and method version. At most one current Certification exists per Poll revision. A correction issues a new linked Certification; nothing is overwritten.

### 4.1 Counting rules

- Quorum basis: the Electorate frozen at open, or an explicitly enumerated custom snapshot. Abstentions count toward participation only if the definition says so.
- Simple majority: the definition states either `yes > no` or `yes > floor(validVotes / 2)`, and how abstentions and invalid Ballots affect the denominator.
- Weights and veto rights are frozen at open. Tie and threshold rules are typed configuration.

## 5. Data model

Schema `voting` (ADR-016). Entity status and constraints are in Data Model v1.1 §4.7.

| Table | Key contents |
|---|---|
| `voting.polls` | Organization, Session, Governing Release, definition ID and revision, status, open, close and certification times, version, Authority Epoch |
| `voting.poll_options` | Stable option IDs, immutable after open |
| `voting.electorate_members` | Seat Assignment, policy snapshot, weight, veto, status; frozen at open |
| `voting.ballot_receipts` | Unique `(session_id, command_id)`; eligibility-consumption ID; accepted sequence and time; status. Unique accepted Ballot per Seat Assignment when revoting is off |
| `voting.ballots` | Choice data or restricted pointer, ballot revision, accepted sequence; in secret-ballot mode stored apart from voter identity |
| `voting.tallies` | Ballot-set hash, method version, counts, computed time; unofficial |
| `voting.certifications` | One current per Poll revision; certifier, Authority Epoch, Tally hash, method version, correction link |

There is no separate vote ledger: PostgreSQL transactions, row locks, unique constraints and the Evidence Event journal (ADR-003) provide integrity. Tenant isolation follows ADR-015.

## 6. Commands, events and errors

**Commands** (09 §3; DEC-38): `poll.open`, `poll.close`, `poll.tally`, `poll.certify`, `poll.void`, `poll.correct`, `ballot.cast`.

**Queries:** `GET /v1/sessions/{sessionId}/polls`; `GET .../polls/{pollId}` (Participant projection); `GET .../polls/{pollId}/my-receipt`; `GET .../polls/{pollId}/result` (only when the result visibility policy allows); `GET .../polls/{pollId}/audit` (restricted).

**Events:** `poll.opened`, `ballot.accepted`, `poll.closed`, `poll.tallied`, `poll.certified`, `poll.voided`, `poll.corrected`. For secret ballots, `ballot.accepted` carries the receipt, never the choice, and is not sent on shared streams.

**Error codes** (09 §8.1):

| Specification v1.0 code | Canonical code |
|---|---|
| `POLL_NOT_OPEN` | `INVALID_TRANSITION` |
| `NOT_ELIGIBLE` | `PERMISSION_DENIED` (reason `not_in_electorate`) |
| `ALREADY_VOTED` | `ALREADY_VOTED` |
| `INVALID_BALLOT` | `VALIDATION_FAILED` |
| `STALE_POLL_VERSION` | `STALE_AGGREGATE_VERSION` |
| `DEADLINE_EXPIRED` | `DEADLINE_EXPIRED` |
| `AUTHORITY_UNAVAILABLE` | `AUTHORITY_UNAVAILABLE` |
| `RESULT_NOT_RELEASED` | `RESULT_NOT_RELEASED` |
| `CERTIFICATION_CONFLICT` | `STALE_AGGREGATE_VERSION` |

The interface distinguishes `pending on device`, `submitted`, `accepted`, `rejected` and `certified result`. Live counters never reveal confidential votes before release.

## 7. Offline and air-gapped operation

- An institutional LAN Runtime issues, accepts, tallies and certifies with no Internet access.
- A disconnected device may compose a ballot if its offline projection allows and queue `ballot.cast` in the Offline Outbox (Sync §4.3). It cannot cast an authoritative Ballot, tally, certify or advance the Poll.
- On reconnection the queued Ballot is judged at its actual server receipt time against the current Electorate, Poll state and Release. After close it is rejected with `DEADLINE_EXPIRED` unless a recorded grace policy applies.
- A signed, bounded offline voting window is not a first-release requirement.

## 8. Voting Method Adapters

A Voting Method Adapter (DEC-59) is a signed artifact with an exact algorithm version, deterministic fixture vectors, declared inputs and outputs, and reproducibility metadata, installed and verified like a Plugin (10 §6). The Runtime still freezes the Electorate, accepts Ballots, controls Certification and writes evidence. An external voting service is never a second authority. In air-gapped profiles the adapter is installed locally and pinned by hash. If the method is unavailable, the Poll cannot open or certify and fails with `CAPABILITY_UNAVAILABLE`.

## 9. Security and research evidence

- Record the Poll definition digest, Electorate snapshot digest, accepted Ballot-set digest, tally method and version, certifier and the Checkpoint that covers them.
- Secret-ballot choices are stored separately with purpose-specific access; they never reach general analytics, plugin inputs or research exports (06 §24.1).
- Corrections create a new linked Certification with cause and reviewer; Ballots and original events are never erased.
- Encryption, token issuance, key custody, administrator recovery and suppression thresholds: OPEN-028. Retention and researcher access: OPEN-009.

## 10. Acceptance tests

| ID | Scenario | Required observation |
|---|---|---|
| VOTE-01 | Eligible voter casts | One accepted Ballot with atomic receipt and Evidence Event |
| VOTE-02 | Ineligible or cross-tenant cast | Denied at the authoritative boundary |
| VOTE-03 | Same Command retried | Same receipt with `replayed: true`; no second Ballot |
| VOTE-04 | Two concurrent Ballots from one Seat Assignment | Correct one-vote or revote result, no race |
| VOTE-05 | Ballot queued offline, sent after close | Rejected with `DEADLINE_EXPIRED` under the default rule |
| VOTE-06 | Operator edits options of an open Poll | Denied; void and reissue required |
| VOTE-07 | Weighted, veto, quorum and tie fixtures | Independently reproducible with explicit denominators |
| VOTE-08 | Unauthorized observer queries | No Ballots or early Tally leaked |
| VOTE-09 | Secret-ballot result requested early | Denied; no identity-choice link in events or logs |
| VOTE-10 | Two simultaneous certifications | At most one current Certification |
| VOTE-11 | Voting Method Adapter unavailable | Poll blocked with `CAPABILITY_UNAVAILABLE`; no invented result |
| VOTE-12 | Air-gapped LAN | End-to-end vote with zero public egress |
| VOTE-13 | Research export | Recount, provenance, secrecy and correction chain preserved |
| VOTE-14 | DEC-16 reconnect and cast burst | p95 and p99 latency, contention and integrity measured (OPEN-019) |
| VOTE-15 | Screen reader, keyboard and zoom | Ballot states fully operable and perceivable (06 §20) |

Status: specification only. No DDL, fixtures or tests have been run.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-10-17 | Owner-supplied specification VOTE-ARCH-001 (archived). |
| 1.1.0 | 2026-10-17 | Integrated into the document set: Session and Stage terms; Commands through the standard endpoint (DEC-48); canonical event names and error codes; Voting Method Adapter as a Platform Adapter (DEC-59); offline rule linked to Sync §4.3; secrecy and key custody open items (OPEN-028). |
