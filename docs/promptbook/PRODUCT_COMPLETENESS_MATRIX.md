# Product completeness and user-test contract

## Purpose

This ledger defines what “fully functional” means for the Plenum version-1 platform. It extends the P00-P06 engineering slices with a product-completion sequence that begins at `PS-700` and ends at `PS-850`. It is an acceptance contract, not evidence that the work is already complete.

The reference outcome is the complete Fractured Order lifecycle at a meta level: a non-programming Designer can create or import and visually verify the design, publish an immutable Release, staff and operate a Session, complete every role workflow, adjudicate and recover, and produce traceable evidence, reports, replay and archive through ordinary product interfaces. Two contrasting simulations must then prove that the same platform works without Runtime source changes.

## Zero-gap decision rule

2026-11-10 BA-02: audit finding 2 is addressed by address-only Command ingress, authenticated principal quotas after Session access checks, and a distinct workload-sized Session aggregate. [BA-02 evidence](../acceptance/BA-02-command-limits.md) separates local policy/concurrency/HTTP proof from unrun BA-12 capacity gates and deployed-proxy acceptance. Historical acceptance and final PS-850 obligations are unchanged.

2026-11-10 BA-01: audit findings 1/9 are addressed by browser-bound OIDC transactions and normalized same-origin return paths. See [BA-01 identity evidence](../acceptance/BA-01-login.md) for local T01–T03 checks, migration 043, candidate identity and remaining real-provider/human gates. Historical PS-815 internal acceptance is preserved; it does not accept this new candidate or grant PS-850 approval.

2026-11-09 authorized continuation: the Product Owner approved a PS-830 prerequisite exception for PS-840 execution only, deferring the two live golden signed-checkpoint checks. They remain pending and block PS-850. Earlier blocked-entry notes below are historical; all other PS-840 implementation and validation proceeds with actual evidence.

2026-11-09 subsequent owner review: PS-830 product and desktop AT acceptance are **OWNER-REPORTED PASS**, as recorded in [human acceptance](../acceptance/PS-830-human-acceptance.md). Earlier human/AT pending labels for PS-830 below are historical. Independently signed live-golden checkpoints and candidate continuity remain open; PS-840 cross-simulation UAT and PS-850 release acceptance are not established by this confirmation.

2026-11-09 PS-840 entry check: **BLOCKED**, because PS-830 overall acceptance remains partial. The structural audit passes 238 obligations; it does not accept those obligations or close human/AT and live-golden checkpoint gaps. Platform generalization remains unexecuted for PS-840. See [preflight evidence and command ledger](../acceptance/PS-840-preflight.md). Existing row results retain their original evidence scope and candidate; no historical PASS is promoted by this check.

A capability is complete only when all applicable rows have:

- a reachable public UI path with no pasted UUID, raw JSON, direct SQL, fixture-only setup or undocumented command;
- a server-authoritative API/domain path with authorization, validation, concurrency and recovery behavior;
- complete loading, empty, pending, success, error, offline, stale/conflict, revoked and read-only states as applicable;
- keyboard, screen-reader, zoom/reflow, reduced-motion and supported viewport evidence;
- automated evidence plus a short task-based human test;
- an accountable owner and direct artifact link.

The release-mode `CMD-GAP-AUDIT` must fail on a missing row, missing owner, missing evidence, `FAIL`, `BLOCKED`, `NOT RUN`, or an undocumented exception. Product exclusions are acceptable only when the governing product decision explicitly excludes them and the UI does not expose a partial or inert affordance.

The machine-readable authority for obligation enumeration is `product-completeness-ledger.json`. Its structural audit resolves 94 Requirements, 28 invariants, Studio sections 3–27, Runtime sections 2–23, persona journeys, screens, API boundaries, UI states, viewports and release controls. The prose matrix below remains the human-readable completion sequence.

## Binding UI and branding contract

All product surfaces use `references/teludens-design-system-catalog/` as the visual and interaction authority above the universal design standard. This applies to the public entry, authentication, Organization and Project portal, Studio, Runtime, the complete Fractured Order simulation, Operator control room, administration, Plugin operations, reporting, replay and archive.

Required sources are:

- `docs/TELUDENS_DESIGN_LANGUAGE.md`: identity, semantic materials, scarce decision signals, density, components and Node / Branch / Path / Gate / State grammar;
- `docs/SPATIAL_GRAMMAR.md`: application shell, continuous surfaces, panel geometry, responsive transformation and scroll ownership;
- `docs/EXPERIENCE_PHYSICS.md`: immediate feedback, async state ladder, interruption/reversal, focus, loading and reduced motion;
- `docs/PLENUM_REFERENCE_SLICE.md`: canonical Plenum shell, role surfaces, proposal flow, entry/admin variants, Poll, Voice and Extension variants;
- `docs/TELUDENS_TOKENS.json`: semantic design tokens; reusable raw visual values are prohibited;
- `assets/logos/Plenum. Wordmark Primary.png`: the approved platform wordmark. Use the exact asset on light materials and the shared theme-safe monochrome inversion on dark materials without redraw, distortion or simulation-specific substitution.

Fractured Order supplies simulation content and configured behavior; it does not replace Plenum platform branding or introduce a separate shell. `PS-700` establishes the shared Teludens foundation before new completion UI is built. `PS-800` audits every route and removes remaining legacy or one-off presentation.

## Completion sequence

| Phase | Tasks | User-testable exit |
|---|---|---|
| P07 — Product entry and lifecycle | `PS-700`–`PS-720` | Root URL, official Plenum branding, sign-in, Organization/Project/Template/Release/Session navigation and creation work without internal IDs. |
| P08 — Specification-complete Studio | `PS-730`–`PS-760` | Every Studio section 3–27 is reachable and visually authorable; review, rehearsal and publication work without raw schema editing. |
| P09 — Complete delivery and operations | `PS-770`–`PS-790` | Participant, Operator, Admin, Publisher, Reviewer and Research users complete their jobs through role-appropriate interfaces. |
| P10 — Product hardening | `PS-800`–`PS-820` | All routes conform to Teludens; every UI state, CI/security/observability gate, clean install, upgrade, recovery and manual accessibility review passes. |
| P11 — End-to-end acceptance | `PS-830`–`PS-850` | Blank-install Fractured Order golden journey, two-simulation generalization, all ledger rows, release evidence and owner decision pass. |

Each task must leave the application runnable and include a 5–20 minute user-test script. No phase is a long hidden build followed by a final reveal.

## Coverage ledger

`Status` begins as **PLANNED** for the completion work. It changes only with linked evidence. **PASS** means automated and task-based human evidence both pass; **N/A** requires an approved product decision.

| Area | Required product surface and behavior | Owning completion tasks | Release evidence target | Status |
|---|---|---|---|---|
| Teludens foundation and brand | Shared tokens, primitives, density, motion, shell and exact approved primary Plenum wordmark with theme-safe presentation | `PS-700`, `PS-800` | Teludens audit, route screenshots, visual review | PASS — PS-800 reconciles the approved wordmark with the catalog contract and verifies both applications against its exact hash |
| Entry and identity | Root entry, sign-in/out, callback, expired/unavailable/denied states, Organization context | `PS-700` | Product E2E + keyboard/screen-reader smoke | PASS — automated evidence and nine-step product-owner smoke complete |
| Organization and Project lifecycle | Switch, search, create, archive/reopen, ownership and collaboration | `PS-710` | Persona user test + authorization integration | PASS — automated evidence and independent ten-minute user test completed 2026-10-29 |
| Templates | Browse, preview, copy semantics, optional Scenario inclusion | `PS-710` | Template-copy browser and contract evidence | PASS — Core Design/default Scenario evidence and independent user test completed 2026-10-29 |
| Releases and Packages | Review, publish, immutable catalog, export/import, provenance and compatibility | `PS-720`, `PS-760` | Publication/package E2E and digest evidence | PASS — exact-digest non-author review, immutable publication provenance, negative authorization, and independent PS-760 user testing pass |
| Sessions | Create from Release, configure, readiness, lifecycle, catalogs and safe deep links | `PS-720`, `PS-780` | Operator lifecycle E2E | PASS — automated evidence and independent user tests cover configured creation, catalogs, and live operations |
| Studio overview/methodology | Orientation, terminology, dependency and provenance controls | `PS-730` | Studio workspace inventory + user test | PASS — guided controls and product-owner acceptance completed 2026-10-30; `OPEN-004` remains unratified |
| Teams, roles and Seats | Identity, objectives, resources, relationships, capabilities, Seat planning and previews | `PS-730`, `PS-760` | Role/Seat authoring and projection parity | PASS — PS-730 authoring and PS-760 access/readiness additions pass automated and independent human evidence |
| Stages and activities | Groups, timers, activities, transitions, gates, conditional and bounded parallel flow | `PS-730` | Authoring/rehearsal/state-machine evidence | PASS — flat, nested, timed, conditional and bounded-parallel authoring passed automated and product-owner evidence 2026-10-30 |
| Artifacts and forms | Artifact Types, field canvas, versions, validations and responsive/read-only previews | `PS-740` | Form/Artifact authoring and historical-render test | PASS — automated and product-owner evidence completed 2026-11-01; `OPEN-010` remains unratified |
| Workflows | Guarded visual graph, DEC-42 forward/return paths and Runtime parity | `PS-740` | Workflow E2E + forbidden-path evidence | PASS — complete DEC-42 forward/return paths passed automated and product-owner evidence |
| Communications and Injects | Channels, routes, recipient policy, Inject library/timeline/triggers | `PS-740` | Leakage denial + exactly-once E2E | PASS — leakage blocking/recovery and Inject timeline/gate authoring passed |
| Content Library | Governed upload, scan boundary, versions, search, reuse and Package inclusion | `PS-740` | Safe/unsafe/interrupted upload evidence | PASS — clean/versioned/replay/quarantine/failure/size/type/RLS and product-owner evidence completed 2026-11-01 |
| World state and adjudication | Variables, resources, capabilities, effects, doctrine, rubric, perspectives and outputs | `PS-750` | Preview, approval and atomic-effect evidence | PASS — automated and product-owner evidence confirm visual authoring, constrained rules, four-phase preview and zero authoritative state changes |
| Extensions and composition | Catalog, bindings, typed graph, compatibility, provisional output and human approval | `PS-750`, `PS-790` | EXT suites + lifecycle user test | PASS — Studio profile/binding/composition evidence and PS-790 Publisher/Admin lifecycle operations pass automated and independent product-owner testing |
| Polling and voting | Explicit methods, electorate, secrecy, lifecycle, ballots, tally and certification | `PS-750`, `PS-770` | VOTE suites + participant/operator E2E | AUTOMATED AND HUMAN PASS FOR CURRENT SCOPE — accessible ballot/tally/certification and offline exclusions pass |
| Voice and radio | Four modes, permissions, consent posture, provider health, floor queue/grant/preemption | `PS-750`, `PS-770`, `PS-780` | VOICE/media + non-audio-path evidence | AUTOMATED AND HUMAN PASS — authoring, participant Runtime, consent, withdrawal, role grants, offline exclusions, and Operator visibility pass |
| Interfaces and access | Role/module configuration, server-filtered preview, invitations, lobby, Guest/display entry | `PS-760`, `PS-770` | Access denial and role-entry E2E | AUTOMATED AND HUMAN PASS — addressed invitation, admitted lobby, labeled Seat selection, role entry and denial pass |
| Research and measurement | Questions, uncertainty, metrics, reports and traceability | `PS-760`, `PS-790` | Research/report user test + reproducibility | PASS — versioned definitions, governed report traceability, consent/purpose/grant filtering and creator-scoped exports pass automated and independent product-owner testing |
| Validation and rehearsal | Linked issues, role walkthrough, deterministic trigger why/why-not traces | `PS-760` | Rehearsal evidence and reviewer user test | PASS — fixed-seed rehearsal repeats the exact digest, explains fired/did-not-fire triggers without Session mutation, and passes independent reviewer testing |
| Participant Runtime | Briefing, objectives, content, modules, configured navigation and role switching | `PS-770` | Role-by-role product E2E | AUTOMATED AND HUMAN PASS — addressed invitation entry, labeled Seat selection, two-role switching, configured navigation, module empty/success states and least-privilege entry pass |
| Offline and reconciliation | Local/synchronized/submitted/rejected distinctions, reconnect and conflict recovery | `PS-770` | Offline E2E with duplicate/stale cases | AUTOMATED AND HUMAN PASS — protected offline load, local-pending distinctions, ordered receipt recovery and duplicate/reordered convergence pass |
| Operator control floor | Lifecycle, timers, Stage gates, Injects, queues, interventions and recovery | `PS-780` | Full live-session rehearsal | PASS — automated evidence and all ten independent product-owner script points passed 2026-11-02 |
| Administration | Members, roles, grants, deployment posture, policy and protected operations | `PS-720`, `PS-790` | Least-privilege persona matrix | PASS — transactional role replacement, stale/final-Admin protection, Plugin governance, data policy and explicit persona denials pass automated and independent product-owner testing |
| Platform identity and workforce production acceptance | Platform Administrator authority, Organization provider revisions, invitations, SCIM provisioning, reconciliation, migration recovery and accessible workforce operations | `PS-815` | Frozen-candidate internal, real-provider, mail-provider, recovery, supported desktop device/AT and named-approval evidence | **INTERNAL PASS / FINAL DECISION DEFERRED** — server, desktop browser/zoom, accessible lifecycle error recovery, migration and security gates pass; external-provider, mail-provider, supported desktop device/AT, named approvals and PS-810 environment evidence remain `NOT RUN` for final production acceptance; mobile/touch is N/A |
| Evidence, reports and replay | Trace, export, multi-page reports, captured/reconstructed replay and divergence | `PS-790` | Reconciliation + evidence verification | PASS — multi-page delivery, reusable artifacts, source trace, independent reconciliation, digest match/divergence and no-mutation replay pass automated and independent product-owner testing |
| Archive, retention and legal hold | Archive, correction, hold, purge policy, portable export/import | `PS-790` | Retention/hold/reimport evidence | PASS — policy/hold/correction history, purge prevention, consequence preview and portable export/import pass automated and independent product-owner testing |
| Complete UI state inventory | Loading, empty, error, pending, stale, conflict, offline, revoked, disabled, success | `PS-700`–`PS-800` | Route × state × viewport matrix | PASS — PS-800 automated state assertions and 25 fail-closed route/state/family captures complete the accepted risk-based matrix; Product Owner accepted the remaining human review on 2026-11-05 |
| Accessibility and desktop adaptive behavior | Keyboard, focus, names, announcements, contrast, desktop browser zoom/reflow, desktop AT, reduced motion | `PS-700`–`PS-820` | Automated plus qualified desktop review | PASS for PS-800; PS-815 confirms a desktop-only production scope with a 1024 × 768 minimum and equivalent 200% browser-zoom viewport. Mobile, iOS, Android and touch-device acceptance are N/A. PS-820 retains its separate supported-desktop accessibility gate |
| CI, security and observability | Repeatable gates, SAST/DAST, SBOM/provenance, uploads, logs/metrics/traces/alerts | `PS-810` | Clean CI and incident/rotation rehearsal | IMPLEMENTED / ACCEPTANCE PENDING â€” local contracts, unit/security, integration/migration, browser/accessibility, deployment/offline bundle, license/SBOM and plan checks pass; GitHub CI/CodeQL/DAST/attestation, live alerts, rotation rehearsal and operator script remain NOT RUN |
| Install, upgrade and recovery | Three profiles, no-Internet install, upgrade, forward-fix, backup/restore and custody | `PS-820` | Clean-install and institution drill artifacts | **AUTOMATED PASS / HUMAN DESKTOP ACCEPTANCE NOT RUN** — prior-schema forward-fix and compatibility, all three profile shells, zero-egress controls, encrypted restore and independent Evidence verification pass; qualified Windows/macOS keyboard/screen-reader review and named approval remain pending |
| Fractured Order complete lifecycle | Blank-install UI-only design-to-archive workflow using shared Teludens Plenum UI | `PS-830` | Golden-journey bundle and human acceptance | AUTOMATED GATES PASS / ACCEPTANCE PARTIAL on the local blank-install candidate: original/Energy archive and restore pass, but independent signed live-Session checkpoint verification and named human/desktop AT acceptance remain open |
| Platform generalization | Policy-negotiation and crisis-response designs exercise approved optional concepts and forms without Runtime edits | `PS-840` | Independent cross-simulation UI evidence | AUTOMATED_PASS: PS-430 fixture 1/1 and new blank-authored policy/crisis UI 2/2; nine defects corrected. New observed human UAT and second target-user review pending. See [PS-840 evidence](../acceptance/PS-840-UAT.md). |
| Approved authoring behavior | OPEN-004/010 and DEC-63/64 across Studio, server, Runtime and export; original/Energy golden journey | `PS-830` | Checkpoint A–H coverage and version-compatible evidence | AUTOMATED PASS on the local candidate, including converged product/a11y/install/security gates; named human/desktop AT and live-golden signed Evidence checkpoint acceptance remain open |
| Role-by-role interface consistency | One navigation model, vocabulary and Teludens layout grammar for every persona and participant role; no internal identifiers as labels | `PS-842` | [IC-01–IC-40 ledger](../acceptance/PS-842-interface-consistency.md), `CMD-INTERFACE-CONSISTENCY` and human role-by-role walkthrough | IMPLEMENTED; automated gates PASS with recorded candidate impact; human walkthrough and retained prerequisite evidence pending; acceptance BLOCKED |
| Controlled authority transfer | Resolved OPEN-016 implementation, fencing, continuity and timed operator rehearsal | `PS-845` | Positive/negative transfer cases and named operational review | PLANNED |
| Production decision | Exact artifacts, all gates, support/operations handoff and authorized GO | `PS-850` | Signed release evidence index | PLANNED |

## Golden-journey release test

`PS-830` must begin on a supported blank installation and use ordinary authorized product routes to:

1. establish the Organization and identities;
2. create or import Fractured Order and visually verify every configured element in Studio;
3. review, rehearse, approve and publish an immutable Release;
4. create, staff and ready a Session;
5. execute Scribe, Facilitator, Notetaker, White Cell, SME, Operator and applicable Poll/Voice/Plugin workflows;
6. exercise rejection, return, stale, disconnect, retry, recovery and correction paths;
7. complete and archive the Session;
8. generate and independently verify evidence, reports and replay;
9. restore the retained outcome and confirm provenance.

The journey fails if a tester must open developer tools, paste an internal identifier, edit JSON, run SQL, invoke a hidden seed, bypass authorization, or switch to non-Teludens/legacy simulation chrome.

## Immediate testing cadence

- After `PS-700`: five-minute root-entry, brand, authentication, navigation and recovery smoke test.
- After `PS-710`: ten-minute Organization/Project/Template test.
- After `PS-720`: Release-to-Session lifecycle test.
- After each P08 task: the newly completed Studio workspaces are tested by a non-programming Designer.
- After each P09 task: affected personas run task-based delivery tests against a published Release.
- After `PS-800`: full route/state/viewport Teludens conformance review.
- After `PS-820`: a new tester follows clean-install and accessibility scripts.
- After `PS-830`: complete Fractured Order golden journey.
- After `PS-840`: independent product UAT and structural audit; external/operational rows remain explicitly pending.
- After `PS-842`: role-by-role walkthrough for every persona and participant role, plus affected PS-830/PS-840 reruns.
- After `PS-845`: controlled authority-transfer evidence and affected upstream reruns.
- At `PS-850`: final-candidate convergence and the unscoped fail-closed release audit.

## Evidence status vocabulary

- **PLANNED** — owned by an executable prompt but not implemented.
- **IMPLEMENTED** — code exists; completion evidence is incomplete.
- **AUTOMATED PASS** — required automated gates pass on the declared environment.
- **HUMAN PASS** — task-based human test passes with artifacts.
- **PASS** — all applicable automated, human and operational evidence passes.
- **FAIL** — acceptance behavior is incorrect.
- **BLOCKED** — a named external prerequisite prevents execution.
- **NOT RUN** — required evidence has not been executed.
- **N/A** — an approved source decision makes the row inapplicable.

Only **PASS** or approved **N/A** is acceptable to `PS-850`.

## Remaining-sequence ownership — 2026-11-08

PS-830 checkpoints A–D have local focused automated evidence in [PS-830-checkpoints.md](../acceptance/PS-830-checkpoints.md). OPEN-004 concepts and OPEN-010 bounded basic Forms, calculations and safe text have domain, publication/integration and Studio/shared-renderer browser proof. This does not close the full capability row: E–H, named human/AT and final-candidate gates remain outstanding. No historical PASS is transferred to this candidate.

APPROVAL_IMPLEMENTATION_PROMPTBOOK.md assigns approved capabilities to PS-830 and operational transfer to PS-845. PS-840 closes applicable product-owned rows only; it cannot close future transfer or missing provider/human rows. PS-850 accepts the entire ledger only after all mandatory evidence is present. The machine ledger adds explicit release-control obligations for these approvals with PLANNED status, so historical structural PASS does not conceal the new work.

PS-830 focused A?G evidence now exists in [PS-830-checkpoints.md](../acceptance/PS-830-checkpoints.md). G demonstrates supported Package/Template authoring, workforce staffing, Orientation coverage and all four Energy variations through a reviewed rubric result. This does not upgrade the overall capability rows to PASS: H full original/customized journeys, final-candidate gates and named acceptance remain required. The known scheduled/rescheduled Inject gap is retained for H resolution.

2026-11-09 H update: the scheduled/rescheduled Inject gap has a focused migration 042 integration pass. The full registered blank-install golden command passed 2/2 on disposable `plenum_ps830_g_browser4`, and its 109 MB Organization archive was imported through Admin UI into isolated `plenum_ps830_g_browser5`; both restored Sessions replayed with no differences and generated fresh reports. Product E2E passed 37/37, accessibility 11/11, clean-install/upgrade across three profiles, security 8/8 plus zero reported npm vulnerabilities, post-limit unit 154/154 and integration 39/39, and all other required local commands passed. The local lifecycle and authoring rows above record this bounded result. A supported way to create and independently verify signed checkpoints from the live golden Sessions is still missing; named human/desktop AT, external provider and production gates also remain open. PS-830 overall and release approval are not PASS. Exact candidate identity and artifacts are in the checkpoint record.
