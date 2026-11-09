# Plenum Studio development promptbook v1.5

## Executive summary

This promptbook now schedules 50 dependency-ordered tasks across P00-P11. P00-P06 built and verified the platform's principal technical slices; P07-P11 close the remaining product, workflow, user-interface, operational and acceptance gaps needed for a genuinely usable platform. It generates implementation instructions only; it does not claim that planned completion work is already implemented, deployed, ratified or released.

The retained executable spike remains `references/plenum-runtime-slice/` v0.2.0 and is not a golden source. The Product Owner confirmed Fractured Order commit `ae5d5065bc04a53631815b1b1715a54e21e3ef5b` as the immutable behavioral reference under `references/fractured-order/`. P00-P05 now have extensive Node 24/PostgreSQL 18/browser/accessibility/deployment evidence recorded in `PROJECT_STATE.md`, culminating in PS-550 engineering completion and a production NO-GO. That evidence proves technical slices, not the complete user-facing product; P07-P11 close that distinction explicitly.

## Finished-system definition

The implementation target is a blank-install, UI-only lifecycle: a non-programming Designer can create or import and visually verify Fractured Order, publish a Release, staff and run a Session, complete all role workflows, adjudicate and recover, and produce traceable evidence, reports, replay and archive. The same platform must then author and run two materially different simulations without Runtime code changes. Every product surface uses the Teludens catalog under `references/teludens-design-system-catalog/`, including the complete Fractured Order experience, and uses the approved primary Plenum wordmark with theme-safe presentation as platform branding. Release approval remains separate from implementation completion.

Start the remaining sequence with [APPROVAL_IMPLEMENTATION_PROMPTBOOK.md](APPROVAL_IMPLEMENTATION_PROMPTBOOK.md): PS-815/820 outstanding acceptance, PS-830 approved authoring and golden journey, PS-840 product UAT, PS-842 role-by-role interface consistency, PS-845 controlled authority transfer and PS-850 final convergence.

## Deliverable map

- `tasks.json` and `task.schema.json`: canonical machine-readable task set.
- `prompts/P00` through `prompts/P11`: ready-to-paste Codex prompts.
- `PRODUCT_COMPLETENESS_MATRIX.md`: fail-closed zero-gap definition, Teludens UI/branding contract, coverage ledger and immediate user-test cadence.
- `REQUIREMENTS_TRACEABILITY.md`: complete REQ-001..094 and INV-001..028 mapping.
- `DEPENDENCY_GRAPH.md`: acyclic task graph and unratified labels.
- `COMMAND_REGISTRY.md`: verified versus proposed commands.
- `PROJECT_STATE.md`: current observed maturity and next task.
- `RELEASE_GAP_PROMPTBOOK.md`: ready-to-use work packages for closing the remaining production approval gaps without replacing the PS task graph.
- `TELUDENS_RUNTIME_MIGRATION_PROMPTBOOK.md`: historical detailed migration guide; canonical P07-P11 tasks now control Teludens sequencing and acceptance.
- `PROMPTBOOK_VALIDATION_REPORT.md`: structural, coverage, cycle, and sample-task QA.
- Other matrices and gates provide architecture, deployment, compatibility, security, recovery, migration, change-control, and release context without replacing their authoritative corpus documents.

## Phase milestones

| Phase | Vertical outcome | Entry | Exit | Exit blockers |
|---|---|---|---|---|
| P00 | Source and reference baseline; no numbered slice | Corpus available | Golden reference classified; slice verified on supported stack | Reference classification; ADR-009 for ratified Pg 18 baseline |
| P01 | Platform kernel and Slice S1 (single-session authority) | PS-001 PASS | Shared contracts, trusted context, command/evidence kernel, Runtime deltas, accessible S1 UI | ADR-001/003/008/010/015 confirmation; accessibility evidence |
| P02 | Configuration-driven Runtime plus extension, voting, and voice cores | P01 evidence | Fractured Order runs from Release; EXT-01..11, VOTE-01..10, VOICE-01..05 pass | AC-09 parity evidence; ADR-016..018; production trust/privacy gates remain closed |
| P03 | Collaborative Studio, Slice S3, and complete first proof | P02 core behavior | Visual authoring, concurrent convergence, Poll/Voice/Plugin editors, access/readiness, AC-01..13 | Resolved OPEN-027/028/029 controls require implementation evidence; recording, transcription and secret ballots stay disabled |
| P04 | Advanced logic and Slice S4 (Release activation) | P03 proof | Active workflows remain pinned; compatible live change works; two contrasting simulations run without Runtime edits | OPEN-004/005/006/008/010/012/018/022/026 where semantics are required |
| P05 | S2 offline, S5 evidence, S6 deployment, S7 load, reporting, and release assurance | P04 generalization | S2, S5, S6, S7 evidence and owner go/no-go package | Implement and evidence the resolved owner, retention, security, recovery, capacity and restricted-feature policies |
| P06 | Approved production Plugin catalog expansion | First-release framework released | Each Plugin has independent contract, security, license, profile, and lifecycle approval | First OPEN-011 candidate approved; Artifact evidence and resolved OPEN-022/029 controls still apply |
| P07 | Teludens product entry and lifecycle | PS-550 engineering baseline | Root entry, authentication, Organization/Project/Template/Release/Session flows and a completeness ledger are immediately user-testable | No internal-ID, fixture-only, legacy-brand or non-Teludens entry dependency |
| P08 | Specification-complete Studio | P07 lifecycle shell | Every Studio section 3-27 is reachable, visually authorable, previewable, reviewable, rehearsable and publishable | Any raw JSON/SQL requirement, missing workspace or incomplete state blocks exit |
| P09 | Complete Runtime and operations | Published Release from P08 | Participant, Operator, Admin, Reviewer, Publisher and Research roles complete their jobs in role-appropriate Teludens interfaces | Any CLI-only core operation, missing recovery or authorization gap blocks exit |
| P10 | Product and operational hardening | P08/P09 workflows | All routes conform to Teludens; UI states, CI, observability, security, install, upgrade, recovery and manual accessibility pass | Missing visual/state evidence or external control remains a no-go |
| P11 | Golden journey, UAT and release | P10 evidence | Blank-install Fractured Order journey, two-simulation generalization, no-gap audit and exact-artifact owner decision | Every applicable ledger row must be PASS; deployment remains separately authorized |

## Status by authority

- Approved: ADR-006 no-Supabase principle; ADR-007 React/TypeScript frontend.
- Confirmed product scope: DEC-01..20 and DEC-41..60, including collaboration, offline/LAN, single authority, voting, voice, and the whole Extension Framework.
- Confirmed 2026-11-08: the former assumptions DEC-21..27 and DEC-30..40, with amended entries superseded by DEC-62..64; both DEC-51 names confirmed. OPEN-004/010/016/023 resolved; implementation and specialist/release evidence remain separate.
- Approved 2026-10-20: ADR-002, ADR-004/005, ADR-008..014 and ADR-017. ADR-006/007 were already Approved; ADR-001/003/015/016/018 remain Confirmed. Named specialist sign-offs remain explicit.
- Candidates: Yjs, LiveKit, React Router, TanStack Query, Zustand, React Hook Form, Zod, dnd-kit, React Flow, Vitest, Playwright, Vite, Radix, Tailwind, Tiptap, Kysely, IndexedDB/Dexie, structured logging, OpenTelemetry. A task must pin only what it actually uses.

## Coverage and exclusions

- Vertical tasks: 50 (32 P00-P06 tasks plus 18 product-completion tasks in P07-P11).
- Normative coverage: 94/94 REQs and 28/28 INVs.
- Product exclusions preserved: AI-assisted authoring, ranked-choice voting, video, feedback loops, public Plugin marketplace, arbitrary custom code, mandatory Kubernetes, and unsupported production claims.
- Dependency cycles: none, verified by the promptbook validator.

## Remaining-task entry

Use the linked implementation promptbook and current PROJECT_STATE.md. No remaining task is marked unconditionally ready: verify prerequisite evidence and the recorded PS-815→PS-820 exception; preserve external/human gates. Independent safe preparation may proceed without claiming task acceptance. PS-770 is historical completed work, not the current next-task pointer.
