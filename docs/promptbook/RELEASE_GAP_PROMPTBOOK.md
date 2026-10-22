# Plenum release-gap closure promptbook

Updated: 2026-10-20.

## Purpose

This book turns the remaining production-release gaps into small, evidence-producing work packages. It supplements the existing PS task graph; it does not replace `tasks.json`, the generated PS prompts, the corpus, or the Decision Register.

In simple terms: much of the product works locally, but production approval needs proof that it is secure, operable, recoverable, accessible, and faithful to the approved product. Each prompt below creates one part of that proof.

## Current starting point

- PS-300 is implementation-complete and locally verified.
- PS-310 is the next product implementation task.
- P03 must finish before the complete first-product proof can pass.
- P04 provides advanced logic, adjudication, live Release activation, and the two-simulation generalization proof.
- P05 owns most release-assurance work: durable offline behavior, signed evidence, reports, deployment profiles, recovery, load, accessibility, security, and the final go/no-go package.
- P06 may add production Plugins only after the first release gates close.

## Authority and status rules

1. Read `PROJECT_STATE.md`, the selected PS prompt, its prerequisite verification records, and the smallest relevant corpus sections before acting.
2. The Decision Register controls `DEC-*`, `ADR-*`, and `OPEN-*` status. Do not silently resolve an OPEN item.
3. Product Owner approval of a document does not replace a named Technical Lead, Security Owner, Operations Owner, Methodology Lead, research-governance, legal/privacy, QA, or accessibility sign-off.
4. Code completion, test completion, phase approval, and production release approval are separate states.
5. Record every required result as `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`. Missing evidence is never a pass.
6. Use only Verified commands from `COMMAND_REGISTRY.md`. A Proposed command must be implemented and evidenced by its owning PS task before use.
7. Use synthetic data and disposable environments. Never run destructive restore, load, DAST, network, or key-rotation exercises against production.
8. Do not deploy, buy a service, alter a production firewall, issue a production certificate, rotate a production key, or accept risk without explicit authorization.

## Recommended sequence

| Order | Work package | Primary PS owner | May begin when | Complete when |
|---:|---|---|---|---|
| 1 | GAP-01 approval ownership and evidence ledger | PS-550 preparation | Now | Named owners and required evidence are recorded |
| 2 | GAP-02 recording/transcription consent | PS-320, PS-550 | PS-310 and policy owners available | OPEN-027 is resolved and consent behavior passes |
| 3 | GAP-03 secret-ballot custody | PS-320, PS-550 | PS-310 and security/research owners available | OPEN-028 is resolved and privacy tests pass |
| 4 | GAP-04 Plugin trust operations | PS-330, PS-530, PS-550, PS-600 | Existing PS-220/230 evidence available | Production trust/key/revocation procedures pass |
| 5 | GAP-05 persistent offline-device policy | PS-500 | PS-420 complete and OPEN-014/015 inputs supplied | Durable outbox and reconciliation evidence pass |
| 6 | GAP-06 backup and restore rehearsal | PS-530 | PS-500/510/520 complete | Isolated restore meets approved RPO/RTO and integrity checks |
| 7 | GAP-07 institutional media validation | PS-530, PS-540 | Deployable media profile and approved test network exist | LAN/TLS/TURN/firewall/restart evidence passes |
| 8 | GAP-08 load and capacity evidence | PS-540 | PS-350, PS-500 and PS-530 complete | All approved workloads have named-environment results |
| 9 | GAP-09 manual assistive-technology review | PS-550 | Stable release candidate exists | Required journeys pass human AT review or defects are resolved |
| 10 | GAP-10 Fractured Order parity and AC-01–AC-13 | PS-350, PS-420, PS-430, PS-500, PS-550 | P03 complete; P04/P05 evidence available where required | Every acceptance row has objective evidence, including deferred AC-07 from PS-420 and AC-11 from PS-420/PS-500 |
| 11 | GAP-11 final go/no-go package | PS-550 | GAP-01–10 complete | Owners sign or release remains blocked |

The order is deliberately conservative. Policy decisions may be prepared early, but final operational evidence must use the exact release candidate intended for approval.

## Evidence package layout

When PS-550 creates the release evidence directory, use one index rather than scattered claims:

```text
docs/release-evidence/<release-id>/
  README.md                  # build identity, environment, overall decision
  gate-matrix.md             # every gate and PASS/FAIL/BLOCKED/NOT RUN
  approvals.md               # named human decisions and dates
  security/                  # scans and negative-control results
  privacy/                   # consent, ballot privacy, retention
  offline/                   # device and reconciliation evidence
  recovery/                  # backup/restore commands and results
  media/                     # LAN/TLS/TURN/firewall/restart evidence
  performance/               # raw and summarized load results
  accessibility/             # automated and manual AT evidence
  parity/                    # golden-reference and AC-01–AC-13 mapping
```

Large machine-generated artifacts should live in the repository's approved evidence store and be linked by digest; do not commit secrets, personal data, private keys, raw recordings, or oversized logs.

---

## GAP-01 — Establish approval ownership and the release evidence ledger

### Goal

Make it unambiguous who is allowed to sign each release area and what evidence they must review. This prepares formal sign-off; it does not grant sign-off.

### Governing links

- `OPEN-001` for named approvers.
- Roadmap sections 13 and 15.
- `RELEASE_GATES.md` and PS-550.

### Ready-to-use prompt

You are preparing the Plenum release approval ledger. Do not implement product features or approve the release.

Inspect the Decision Register, `PROJECT_STATE.md`, `RELEASE_GATES.md`, PS-550, all completed task verification files, and the intended release identifier. Confirm the exact build commit, dependency lockfile digest, database migration level, Release digest, Plugin/adapter digests, and deployment profile.

Create or update one gate matrix that names:

- Product Owner, Methodology Lead, Technical Lead, Security Owner, Operations Owner, QA owner, accessibility reviewer, and any required privacy/legal or research-governance reviewer.
- Which gates each person owns.
- The evidence each person must review.
- Current status: PASS, FAIL, BLOCKED, or NOT RUN.
- Decision date, evidence digest/link, conditions, and expiry/re-review trigger.

Do not use role placeholders as completed signatures. If OPEN-001 lacks the required identities, mark formal approval BLOCKED and list the exact missing names/titles.

Security evidence must include authentication, authorization, tenant isolation, privacy, dependency scanning, secret scanning, applicable static/dynamic testing, and open findings. Operations evidence must include deployment, observability, backup/restore, recovery, LAN/media operation, and load behavior. Accessibility evidence must include automated and manual results. Product/methodology evidence must include AC-01–AC-13, parity, and generalization.

Acceptance:

- Every blocking release gate has one named owner and one evidence source.
- No person is shown as having signed without an attributable decision.
- Missing evidence remains BLOCKED or NOT RUN.
- Signatures are bound to one immutable build and evidence package.

Handoff with the matrix path, missing owners, missing evidence, expired evidence, and the next safe gap package.

---

## GAP-02 — Resolve recording and transcription consent

### Goal

Define and prove when recording or transcription may start, how every affected person consents, and what happens when consent is withdrawn.

### Governing links

- `DEC-50`, `OPEN-027`, document 12, PS-320, PS-550.

### Ready-to-use prompt

Implement and evidence the smallest production consent flow for Plenum recording and transcription. Recording and transcription must remain off until OPEN-027 has an authorized decision.

Before editing, obtain or record BLOCKED for these human decisions: legal basis, consent wording/version, who must consent, whether consent may be role- or channel-specific, retention period, access/export roles, correction/deletion rules, approved transcription engines, and whether each engine may run in an air-gapped deployment.

Build only the approved behavior:

- Explicit opt-in with no preselected control.
- Consent bound to Principal, Session, Voice Channel, purpose, policy version, capture time, and applicable Release.
- Server-side refusal with `CONSENT_REQUIRED` when any required consent is absent or stale.
- Visible recording/transcription state and a non-audio indication.
- Withdrawal that stops new capture/transcription promptly, writes immutable evidence, and applies the approved rule to already captured material.
- Role- and tenant-scoped access, export, retention, and audit behavior.
- No raw transcript or recording content in ordinary logs, analytics, screenshots, or test fixtures.

Test opt-in, refusal, mixed-consent rooms, late join, reconnect, policy-version change, withdrawal during speech, provider failure, duplicate requests, unauthorized access/export, retention, and air-gap engine selection. Use synthetic audio only.

Acceptance:

- Recording and transcription default off.
- Capture cannot start unless every required participant has valid consent.
- Withdrawal has a measured, documented stop behavior and immutable evidence.
- Unauthorized users cannot discover or retrieve recording/transcript content.
- OPEN-027 has an authorized decision linked to the tests and runbook.

Do not choose the legal basis, waive consent, or enable production capture on behalf of an owner.

---

## GAP-03 — Resolve production secret-ballot custody

### Goal

Protect ballot choices from unauthorized recovery while preserving eligibility, one-vote rules, tallying, certification, and correction.

### Governing links

- `OPEN-028`, document 11, PS-240, PS-320, PS-550.

### Ready-to-use prompt

Design, implement, and verify Plenum's approved production secret-ballot profile. Keep production secret polls blocked until Security Owner and research-governance decisions are recorded.

Obtain decisions for: ballot encryption method using a reviewed library, key generation and storage, split or single-person custody, key rotation, recovery/destruction, whether any administrator can recover individual choices, receipt/linkage rules, result suppression for small groups, export rules, and incident response.

Preserve the existing authoritative Poll, frozen electorate, idempotent Ballot, deterministic Tally, Certification, and correction model. Add only the approved privacy boundary. Separate eligibility proof from stored ballot choice wherever the approved design requires it. Never expose choice linkage through APIs, events, logs, metrics, support tools, backups, or evidence packages.

Test eligible and ineligible voting, duplicate and concurrent casting, close races, tally reproducibility, certification contention, key unavailability, key rotation, backup/restore, administrator and database-operator access attempts, small-group suppression, export, and incident recovery.

Acceptance:

- The documented threat model states exactly who can and cannot recover a choice.
- Stored data, APIs, logs, backups, and exports match that claim.
- Loss or unavailability of custody material fails closed without inventing a result.
- Deterministic tally and certification remain independently reproducible where allowed.
- OPEN-028 is resolved by authorized owners before the production feature is enabled.

Do not write custom cryptography or claim coercion resistance/end-to-end verifiability unless the approved design and independent evidence actually support it.

---

## GAP-04 — Operationalize Plugin trust

### Goal

Turn the implemented Plugin signature, registry, isolation, approval, and revocation controls into a repeatable production operating procedure.

### Governing links

- `DEC-52`, resolved `OPEN-029`, PS-220, PS-230, PS-330, PS-530, PS-550, PS-600.

### Ready-to-use prompt

Complete the production Plugin trust operating model without weakening the existing signed-bundle and isolated-execution controls.

Inspect the Plugin SDK, registry, Extension Host, trust-root records, revocation handling, license acceptance, SBOM checks, Artifact approval, Installation, Binding, run authorization, Effect Proposal approval, and prior negative tests.

Deliver:

- Key ceremony, storage, rotation, compromise, revocation, expiry, backup, and recovery procedures.
- Publisher onboarding/offboarding and separation-of-duties rules.
- Signed revocation distribution and freshness monitoring, including disconnected deployments.
- Vulnerability and SBOM intake, severity handling, time-limited exception ownership, and re-scan cadence.
- License acceptance and expiry/change handling.
- Catalog curation, Organization-scoped installation, rollback/disable, and incident procedures.
- Per-Plugin evidence template for P06.

Exercise valid install/run, tampered bundle, unknown/revoked/expired key, stale revocation data, critical vulnerability, changed license, incompatible contract, permission excess, air-gap import, Plugin failure, malformed output, timeout, host restart, attempted network/filesystem escape, and post-revocation provenance access.

Acceptance:

- A new production Plugin cannot become runnable without all required independent approvals.
- Revocation blocks new runs while preserving prior evidence.
- Disconnected sites receive and enforce bounded-freshness trust data.
- Key loss or compromise has a rehearsed recovery path.
- Each P06 Plugin can be reviewed independently.

Never place private keys in PostgreSQL, source control, images, evidence, or ordinary backups.

---

## GAP-05 — Approve and prove persistent offline-device behavior

### Goal

Let permitted work survive a browser or device restart without letting the offline device become authoritative.

### Governing links

- `OPEN-014`, `OPEN-015`, Synchronization Protocol section 4.3, PS-500.

### Ready-to-use prompt

Implement the approved persistent offline Draft and Command outbox policy for Plenum.

Before editing, obtain decisions for device data-at-rest protection, supported device/browser posture, credential lifetime, maximum disconnection duration, revocation behavior, retention/expiry, device loss, local deletion, shared-device restrictions, and the final allowlist of offline-command types.

Use the existing synchronization contracts and server-authoritative receipts. Local state must visibly remain `local_pending`; it must never appear submitted or accepted until the server returns the canonical result. Queue only explicitly permitted Commands. Never queue voice/Floor operations, Stage/Session control, adjudication, composition execution, Effect approvals, or other prohibited live-authority actions.

Implement bounded encrypted local storage using an approved platform/library approach, schema/version migration, ordered reconnect, idempotent replay, conflict classification, explicit reconciliation UI, expiry cleanup, and safe failure when storage or keys are unavailable.

Test reload/restart survival, duplicate reconnect, stale identity, revoked role, changed Release/Authority Epoch, expired credentials, closed Ballot, corrupted local data, storage quota exhaustion, schema upgrade, two tabs, device-clock manipulation, partial server failure, and user-requested cleanup.

Acceptance:

- Permitted local work survives the approved restart scenario.
- Revoked or expired authority cannot submit queued work.
- Duplicate replay commits at most once.
- Rejected and reconciliation-required items remain understandable and recoverable.
- The product makes no unsupported remote-wipe claim.

---

## GAP-06 — Rehearse backup and restore

### Goal

Prove that an institution can recover the complete system without losing the integrity or meaning of its records.

### Governing links

- `OPEN-009`, `OPEN-017`, REQ-066/067, PS-510, PS-520, PS-530.

### Ready-to-use prompt

Create and run a non-production backup/restore rehearsal for the exact release candidate and deployment profile.

Obtain approved RPO, RTO, retention, residency, encryption, backup-custody, and independent evidence-anchor custody targets. Inventory PostgreSQL, object storage, Release packages, Plugin bundles/trust data, media metadata and any approved recordings, signer/anchor references, configuration, and required secrets. State which materials are deliberately excluded and how they are reprovisioned.

Create repeatable backup and isolated-restore procedures. Restore into a clean target with no connection to production. Verify migrations, tenant isolation, row counts and constraints, object digests, Release/Definition provenance, event sequences, Command receipts, evidence checkpoint chains, Plugin provenance, Poll certification, and the ability to start the restored application safely.

Exercise a successful restore plus at least one damaged/missing database backup, object, checkpoint, and configuration case. Confirm failures are visible and do not produce false success. Measure actual RPO/RTO against approved targets.

Acceptance:

- An independently followed runbook restores a usable, internally consistent system.
- Immutable history and cryptographic/provenance checks still verify.
- Missing or corrupt material is detected.
- Actual restore time and recoverable point are recorded.
- No production data or destructive production restore is used.

Register and verify `CMD-BACKUP-RESTORE` only after the command passes on the declared disposable environment.

---

## GAP-07 — Validate institutional LAN, TLS, TURN, firewall, and media recovery

### Goal

Prove that voice works across realistic institutional network boundaries and recovers safely from media-service failure.

### Governing links

- ADR-013, ADR-017, `OPEN-027`, VOICE-06/07/12/13, PS-250, PS-530, PS-540, PS-550.

### Ready-to-use prompt

Validate the Plenum media profile on an approved non-production institutional network or representative segmented lab.

Record the exact application, SFU, TURN, browser, certificate, DNS, NAT, firewall, subnet, proxy, and hardware versions. Obtain authorization before any network/firewall change. Use test certificates or approved institutional PKI; never bypass TLS verification for a passing result.

Test:

- HTTPS/WSS signaling and certificate trust/renewal behavior.
- Direct and TURN-relayed audio across separate LAN segments.
- Required inbound/outbound firewall flows and proof that undeclared public egress is absent.
- Join/leave, private call, broadcast, push-to-talk, preemption, revocation, reconnect, and stale credential behavior.
- SFU restart, TURN restart, application restart, transient packet loss, dependency unavailability, and recovery reconciliation.
- Visible/non-audio status, keyboard operation, and consent-off defaults.
- Logs and metrics that diagnose failure without exposing tokens or audio content.

Acceptance:

- At least two real browsers exchange audio through every supported network path.
- Failure and recovery behavior is observed, bounded, and accurately shown to users.
- Revoked permissions and expired credentials remain denied after restart/reconnect.
- The documented firewall rule set is minimal and reproducible.
- Recording/transcription stays disabled unless GAP-02 has passed.

Do not convert a loopback-only result into an institutional-LAN claim.

---

## GAP-08 — Produce full load and capacity evidence

### Goal

Replace planning assumptions with measured behavior on named hardware and approved budgets.

### Governing links

- `DEC-16`, approved OPEN-019 recommendation, DB-10, SYNC-15, VOTE-14, VOICE-12, EXT-19, PS-540.

### Ready-to-use prompt

Implement and run the PS-540 load profiles only against an approved isolated environment.

Before running load, obtain Technical Lead and Operations Owner sign-off on the OPEN-019 budgets. Record hardware, operating system, container/runtime versions, network topology, database/object/media configuration, build and Release digests, data size, actor mix, activity rates, warm-up, duration, repetitions, and monitoring method.

Create separate profiles for:

- Application/API workload up to 500 Participants per Session and 10 concurrent Sessions.
- Reconnect and submission bursts.
- Poll opening/casting/closing/tally/certification contention.
- Plugin verification and isolated execution.
- Voice rooms by concurrent listeners, active speakers, relay percentage, bitrate, and room count.

Measure latency percentiles, throughput, errors, integrity, saturation, queue/backlog behavior, database connections/locks, CPU, memory, disk, network, recovery time, and cost-relevant resource use. Verify no lost/duplicated authoritative operations and no cross-tenant leak during pressure.

Acceptance:

- Every published number names its environment and workload.
- PASS/FAIL is evaluated against approved budgets, not invented thresholds.
- Recovery after saturation or dependency restart is observed.
- Any proposed cache, broker, replica, or service split is supported by a measured bottleneck and an operational-cost analysis.

Register `CMD-LOAD-APP`, `CMD-LOAD-VOTING`, `CMD-LOAD-VOICE`, and `CMD-LOAD-EXTENSIONS` only after reproducible passes. Never target production.

---

## GAP-09 — Complete manual assistive-technology review

### Goal

Verify with human-operated assistive technology that critical Studio and Runtime journeys are understandable and operable.

### Governing links

- PS-150 deferred review, VOICE-11, PS-320, PS-340, PS-550, WCAG 2.2 AA requirements.

### Ready-to-use prompt

Run the manual accessibility review against the stable release candidate. Automated axe results are supporting evidence, not a substitute.

First define the supported browser, operating-system, keyboard-only, screen-reader, zoom/reflow, high-contrast, reduced-motion, and speech/input combinations with the accessibility owner. Reuse `docs/ps-150-manual-screen-reader-review.md` and extend it for all critical new screens.

Review at minimum:

- Authentication/join, waiting room, Seat assignment, and readiness.
- Studio editing, validation navigation, collaboration/save announcements, freeze and publication.
- Runtime forms, messages, proposals, Injects, Polls, Voice/Floor controls, Plugin Effect approval, error/retry/offline/reconciliation states.
- Reports/exports and the operator release checklist.

For each step record expected announcement/operation, actual result, AT/browser/version, severity, screenshot or transcript that contains no sensitive data, and retest status. Test focus order/visibility/return, accessible names/descriptions, live announcements, validation association, table/list semantics, keyboard traps, timing, 200% text, constrained viewport reflow, non-color and non-audio cues, and reduced motion.

Acceptance:

- Every critical journey is completed without pointer-only or sight-only dependence.
- No unresolved WCAG Level A/AA defect blocks a required journey.
- Any lower-severity issue has an owner and authorized disposition.
- The accessibility reviewer signs the exact build/evidence package.

Do not mark NOT RUN combinations as PASS or treat an automated scan as manual review.

---

## GAP-10 — Complete Fractured Order parity and AC-01–AC-13 evidence

### Goal

Prove that the configured product preserves the required Fractured Order behavior and completes the full first-product journey.

### Governing links

- Official snapshot commit `ae5d5065bc04a53631815b1b1715a54e21e3ef5b`.
- `PARITY_TEST_PLAN.md`, PS-350, PS-430, AC-01–AC-13.

### Ready-to-use prompt

Complete the remaining parity fixtures and first-product acceptance journey on one immutable build.

Inspect the pinned snapshot manifest, reference audit, parity plan, current `CMD-PARITY` output, all AC requirement rows, completed PS verification files, and the exact release candidate. Do not infer methodology from unclassified reference behavior.

For every AC-01–AC-13 row, record:

- Preconditions, actors/roles, Release and fixture IDs.
- Observable success and required negative path.
- Authoritative records/events/receipts produced.
- Exact automated or manual evidence and artifact digest.
- PASS, FAIL, BLOCKED, or NOT RUN.

Exercise the complete path: visually author a valid design, collaborate and publish, configure access/readiness, run Fractured Order, exchange governed information, execute Plugin proposals with human approval, vote and certify, use push-to-talk voice, adjudicate where required, preserve evidence, and reconcile exports. Finish the eight parity targets currently marked OUT_OF_SCOPE only when their owning phases have implemented them.

Also run two materially different simulation Releases through PS-430 without Runtime source changes. Configuration differences are allowed; hidden per-simulation Runtime branches are not.

Acceptance:

- AC-01–AC-13 all have current, attributable evidence.
- `CMD-PARITY` reports no required target as BLOCKED or OUT_OF_SCOPE.
- Exported evidence reconciles with canonical database/event records.
- Failures identify their owning task and block the completion claim.
- No legacy defect or hard-coded behavior is copied merely for visual similarity.

Do not waive AC-09 or claim complete parity from inventory coverage alone.

---

## GAP-11 — Assemble the final go/no-go package

### Goal

Give authorized owners one honest, reviewable decision package for the exact release candidate.

### Governing links

- PS-550, `RELEASE_GATES.md`, Roadmap sections 13 and 15, REQ-069.

### Ready-to-use prompt

Assemble—but do not approve—the final Plenum release packet.

Verify that GAP-01 through GAP-10 point to the same immutable build, lockfile, migrations, Release/configuration digests, deployment profile, and evidence index. Re-run or invalidate evidence that does not apply to that build.

The gate matrix must cover product scope, decisions, contracts, functional behavior, parity, authorization/privacy, Plugin trust, data/migrations, recovery, accessibility, performance, deployment, air gap, observability, operational readiness, supply chain, evidence integrity, defects, rollback/forward-fix, and final human approval.

Security evidence must include applicable static and dynamic checks, dependency and secret scanning, authenticated/unauthenticated route coverage, and cross-tenant denial. Dynamic security testing must target staging or a disposable production-like environment, never production. All high/critical findings are blocking unless governing policy explicitly permits and an authorized owner records a bounded exception.

Produce:

- Executive go/no-go summary in plain language.
- Complete gate matrix with PASS/FAIL/BLOCKED/NOT RUN.
- Evidence manifest with digests and environment identity.
- Open-defect list with severity, owner, mitigation, and retest state.
- Deployment, rollback/forward-fix, backup/restore, monitoring, and incident contacts.
- Approval page for named owners.

Acceptance:

- No required gate is blank or described vaguely.
- No blocking FAIL, BLOCKED, or NOT RUN is presented as releasable.
- Advisory findings have owners and due dates.
- Every signature is attributable and bound to the evidence package.
- The final release decision is made by authorized humans, not by the coding agent.

Handoff with one recommendation: GO only if every blocking gate passes and required owners sign; otherwise NO-GO with the shortest ordered list of work needed to reconsider.

## Plain-language explanation of the earlier documentation mismatch

The code moved faster than three summary files:

- The root `README.md` still said Studio authoring was future work.
- `tasks.json` still labeled completed tasks, including PS-300, as planned.
- `RELEASE_READINESS.md` still described capabilities from before the recent implementation work.

That did not mean the PS-300 code was missing. The code, commit history, tests, `PROJECT_STATE.md`, and `docs/ps-300-verification.md` showed that it had been built. It meant the repository had several status summaries and not all of them were updated together.

Going forward, use this order when status disagrees:

1. Actual code and immutable commit/build identity.
2. Task-specific verification evidence.
3. `PROJECT_STATE.md`.
4. Generated task metadata and general summaries.

Then correct the stale summaries in the same change. A planning label is not implementation evidence, and implementation evidence is not release approval.
