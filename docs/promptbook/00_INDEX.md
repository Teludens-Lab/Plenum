# Plenum Studio development promptbook v1.3

## Executive summary

This promptbook schedules the complete first release described by PRD v0.7.3 and Roadmap v1.3.2 as 31 dependency-ordered tasks across Phases 0-6. It generates implementation instructions only; it does not implement, deploy, ratify, or release the application.

The executable baseline is `references/plenum-runtime-slice/` v0.2.0; its upstream source revision was not recorded, so it remains observed spike evidence rather than a golden source. Separately, the Product Owner confirmed Fractured Order commit `ae5d5065bc04a53631815b1b1715a54e21e3ef5b` as the official immutable golden reference; its verified export is under `references/fractured-order/`. Historical evidence from 2026-10-17 reports 12 unit, 31 HTTP smoke, and 7 database checks passing on PostgreSQL 16. During promptbook generation, the 12 unit tests and syntax checks passed on Node 22.16.0, but that runtime is below the slice's Node 24 floor. PostgreSQL 18, browser, accessibility, load, offline, air-gap, and restore checks were not run in this generation environment.

## Finished-system definition

The implementation target is Roadmap section 12: Fractured Order and a basic new simulation run from published Releases; Studio supports collaborative visual authoring; Runtime renders role-specific interfaces and enforces configured workflows and communications; evidence and reports are traceable; Polls include Certification and secret-ballot behavior; Voice Channels support all four modes and consent-based transcription; and the full Extension Framework installs, composes, runs, and approves Plugins in disconnected deployments. Release approval remains separate from implementation completion.

## Deliverable map

- `tasks.json` and `task.schema.json`: canonical machine-readable task set.
- `prompts/P00` through `prompts/P06`: ready-to-paste Codex prompts.
- `REQUIREMENTS_TRACEABILITY.md`: complete REQ-001..094 and INV-001..028 mapping.
- `DEPENDENCY_GRAPH.md`: acyclic task graph and unratified labels.
- `COMMAND_REGISTRY.md`: verified versus proposed commands.
- `PROJECT_STATE.md`: current observed maturity and next task.
- `PROMPTBOOK_VALIDATION_REPORT.md`: structural, coverage, cycle, and sample-task QA.
- Other matrices and gates provide architecture, deployment, compatibility, security, recovery, migration, change-control, and release context without replacing their authoritative corpus documents.

## Phase milestones

| Phase | Vertical outcome | Entry | Exit | Exit blockers |
|---|---|---|---|---|
| P00 | Source and reference baseline; no numbered slice | Corpus available | Golden reference classified; slice verified on supported stack | Reference classification; ADR-009 for ratified Pg 18 baseline |
| P01 | Platform kernel and Slice S1 (single-session authority) | PS-001 PASS | Shared contracts, trusted context, command/evidence kernel, Runtime deltas, accessible S1 UI | ADR-001/003/008/010/015 confirmation; accessibility evidence |
| P02 | Configuration-driven Runtime plus extension, voting, and voice cores | P01 evidence | Fractured Order runs from Release; EXT-01..11, VOTE-01..10, VOICE-01..05 pass | AC-09 parity evidence; ADR-016..018; production trust/privacy gates remain closed |
| P03 | Collaborative Studio, Slice S3, and complete first proof | P02 core behavior | Visual authoring, concurrent convergence, Poll/Voice/Plugin editors, access/readiness, AC-01..13 | OPEN-027/028/029 for production use; OPEN-001 for formal phase approval |
| P04 | Advanced logic and Slice S4 (Release activation) | P03 proof | Active workflows remain pinned; compatible live change works; two contrasting simulations run without Runtime edits | OPEN-004/005/006/008/010/012/018/022/026 where semantics are required |
| P05 | S2 offline, S5 evidence, S6 deployment, S7 load, reporting, and release assurance | P04 generalization | S2, S5, S6, S7 evidence and owner go/no-go package | OPEN-001, 009, 014, 017, 019, 024, 027, 028, 029 |
| P06 | Approved production Plugin catalog expansion | First-release framework released | Each Plugin has independent contract, security, license, profile, and lifecycle approval | OPEN-011/022/029 per Plugin |

## Status by authority

- Approved: ADR-006 no-Supabase principle; ADR-007 React/TypeScript frontend.
- Confirmed product scope: DEC-01..20 and DEC-41..60, including collaboration, offline/LAN, single authority, voting, voice, and the whole Extension Framework.
- Assumed: DEC-21..27 and DEC-30..40; tasks may design against them but phase exits remain labeled.
- Proposed: ADR-001..005 and ADR-008..018; no prompt calls them approved.
- Candidates: Yjs, LiveKit, React Router, TanStack Query, Zustand, React Hook Form, Zod, dnd-kit, React Flow, Vitest, Playwright, Vite, Radix, Tailwind, Tiptap, Kysely, IndexedDB/Dexie, structured logging, OpenTelemetry. A task must pin only what it actually uses.

## Coverage and exclusions

- Vertical tasks: 31.
- Normative coverage: 94/94 REQs and 28/28 INVs.
- Product exclusions preserved: AI-assisted authoring, ranked-choice voting, video, feedback loops, public Plugin marketplace, arbitrary custom code, mandatory Kubernetes, and unsupported production claims.
- Dependency cycles: none, verified by the promptbook validator.

## Exact next runnable prompt

Run [PS-000 - Pin and classify the Fractured Order reference](prompts/P00/PS-000-pin-and-audit-fractured-order.md) next; its owner-approved source pin is now satisfied and it produces the inventory required by PS-200. [PS-001 - Verify the v0.2 slice on Node 24 and PostgreSQL 18](prompts/P00/PS-001-verify-reference-slice-on-supported-stack.md) is independently runnable in parallel, but its preflight still needs Node 24+ and PostgreSQL 18.
