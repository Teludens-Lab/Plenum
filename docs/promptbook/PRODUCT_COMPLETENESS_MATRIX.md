# Product completeness and user-test contract

## Purpose

This ledger defines what “fully functional” means for the Plenum version-1 platform. It extends the P00-P06 engineering slices with a product-completion sequence that begins at `PS-700` and ends at `PS-850`. It is an acceptance contract, not evidence that the work is already complete.

The reference outcome is the complete Fractured Order lifecycle at a meta level: a non-programming Designer can create or import and visually verify the design, publish an immutable Release, staff and operate a Session, complete every role workflow, adjudicate and recover, and produce traceable evidence, reports, replay and archive through ordinary product interfaces. Two contrasting simulations must then prove that the same platform works without Runtime source changes.

## Zero-gap decision rule

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
- `assets/logos/Plenum. Wordmark Dark.png` and `assets/logos/Plenum. Wordmark Light.png`: the only platform wordmarks. Use the dark asset on light materials and the light asset on dark materials without redraw, recolor, distortion or simulation-specific substitution.

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
| Teludens foundation and brand | Shared tokens, primitives, density, motion, shell and exact catalog dark/light Plenum wordmarks | `PS-700`, `PS-800` | Teludens audit, route screenshots, visual review | AUTOMATED PASS — PS-700 foundation; full-route PS-800 remains |
| Entry and identity | Root entry, sign-in/out, callback, expired/unavailable/denied states, Organization context | `PS-700` | Product E2E + keyboard/screen-reader smoke | PASS — automated evidence and nine-step product-owner smoke complete |
| Organization and Project lifecycle | Switch, search, create, archive/reopen, ownership and collaboration | `PS-710` | Persona user test + authorization integration | PASS — automated evidence and independent ten-minute user test completed 2026-10-29 |
| Templates | Browse, preview, copy semantics, optional Scenario inclusion | `PS-710` | Template-copy browser and contract evidence | PASS — Core Design/default Scenario evidence and independent user test completed 2026-10-29 |
| Releases and Packages | Review, publish, immutable catalog, export/import, provenance and compatibility | `PS-720`, `PS-760` | Publication/package E2E and digest evidence | PLANNED |
| Sessions | Create from Release, configure, readiness, lifecycle, catalogs and safe deep links | `PS-720`, `PS-780` | Operator lifecycle E2E | PLANNED |
| Studio overview/methodology | Orientation, terminology, dependency and provenance controls | `PS-730` | Studio workspace inventory + user test | PLANNED |
| Teams, roles and Seats | Identity, objectives, resources, relationships, capabilities, Seat planning and previews | `PS-730`, `PS-760` | Role/Seat authoring and projection parity | PLANNED |
| Stages and activities | Groups, timers, activities, transitions, gates, conditional and bounded parallel flow | `PS-730` | Authoring/rehearsal/state-machine evidence | PLANNED |
| Artifacts and forms | Artifact Types, field canvas, versions, validations and responsive/read-only previews | `PS-740` | Form/Artifact authoring and historical-render test | PLANNED |
| Workflows | Guarded visual graph, DEC-42 forward/return paths and Runtime parity | `PS-740` | Workflow E2E + forbidden-path evidence | PLANNED |
| Communications and Injects | Channels, routes, recipient policy, Inject library/timeline/triggers | `PS-740` | Leakage denial + exactly-once E2E | PLANNED |
| Content Library | Governed upload, scan boundary, versions, search, reuse and Package inclusion | `PS-740` | Safe/unsafe/interrupted upload evidence | PLANNED |
| World state and adjudication | Variables, resources, capabilities, effects, doctrine, rubric, perspectives and outputs | `PS-750` | Preview, approval and atomic-effect evidence | PLANNED |
| Extensions and composition | Catalog, bindings, typed graph, compatibility, provisional output and human approval | `PS-750`, `PS-790` | EXT suites + lifecycle user test | PLANNED |
| Polling and voting | Explicit methods, electorate, secrecy, lifecycle, ballots, tally and certification | `PS-750`, `PS-770` | VOTE suites + participant/operator E2E | PLANNED |
| Voice and radio | Four modes, permissions, consent posture, provider health, floor queue/grant/preemption | `PS-750`, `PS-770`, `PS-780` | VOICE/media + non-audio-path evidence | PLANNED |
| Interfaces and access | Role/module configuration, server-filtered preview, invitations, lobby, Guest/display entry | `PS-760`, `PS-770` | Access denial and role-entry E2E | PLANNED |
| Research and measurement | Questions, uncertainty, metrics, reports and traceability | `PS-760`, `PS-790` | Research/report user test + reproducibility | PLANNED |
| Validation and rehearsal | Linked issues, role walkthrough, deterministic trigger why/why-not traces | `PS-760` | Rehearsal evidence and reviewer user test | PLANNED |
| Participant Runtime | Briefing, objectives, content, modules, configured navigation and role switching | `PS-770` | Role-by-role product E2E | PLANNED |
| Offline and reconciliation | Local/synchronized/submitted/rejected distinctions, reconnect and conflict recovery | `PS-770` | Offline E2E with duplicate/stale cases | PLANNED |
| Operator control floor | Lifecycle, timers, Stage gates, Injects, queues, interventions and recovery | `PS-780` | Full live-session rehearsal | PLANNED |
| Administration | Members, roles, grants, deployment posture, policy and protected operations | `PS-720`, `PS-790` | Least-privilege persona matrix | PLANNED |
| Evidence, reports and replay | Trace, export, multi-page reports, captured/reconstructed replay and divergence | `PS-790` | Reconciliation + evidence verification | PLANNED |
| Archive, retention and legal hold | Archive, correction, hold, purge policy, portable export/import | `PS-790` | Retention/hold/reimport evidence | PLANNED |
| Complete UI state inventory | Loading, empty, error, pending, stale, conflict, offline, revoked, disabled, success | `PS-700`–`PS-800` | Route × state × viewport matrix | PLANNED |
| Accessibility and responsive behavior | Keyboard, focus, names, announcements, contrast, 200% zoom/reflow, AT, reduced motion | `PS-700`–`PS-820` | Automated plus qualified manual review | PLANNED |
| CI, security and observability | Repeatable gates, SAST/DAST, SBOM/provenance, uploads, logs/metrics/traces/alerts | `PS-810` | Clean CI and incident/rotation rehearsal | PLANNED |
| Install, upgrade and recovery | Three profiles, no-Internet install, upgrade, forward-fix, backup/restore and custody | `PS-820` | Clean-install and institution drill artifacts | PLANNED |
| Fractured Order complete lifecycle | Blank-install UI-only design-to-archive workflow using shared Teludens Plenum UI | `PS-830` | Golden-journey bundle and human acceptance | PLANNED |
| Platform generalization | Policy-negotiation and crisis-response designs run without Runtime edits | `PS-840` | Cross-simulation UI evidence | PLANNED |
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
- After `PS-840`: independent UAT and fail-closed no-gap audit.

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
