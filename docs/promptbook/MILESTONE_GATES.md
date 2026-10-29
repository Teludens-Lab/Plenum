# Milestone gates

This file applies Roadmap v1.3 sections 3, 4, 13, and 15 to the generated task graph. It sequences evidence; it does not redefine requirements or approve a release.

## Universal phase gate

Every phase exit requires:

- Contract-first evidence: mapped requirement IDs, canonical entities, API/event contracts, state transitions, authorization, error behavior, analytics definitions, and acceptance tests.
- Evidence records with test ID, type, expected and actual behavior, artifact, owner, and acceptance state.
- No failed required gate, no unresolved severity-1 defect, and an explicit disposition for all lower-severity defects.
- Updated `PROJECT_STATE.md`, `REQUIREMENTS_TRACEABILITY.md`, compatibility/migration registers, and command status.
- A focused handoff with PASS / FAIL / BLOCKED / NOT RUN classifications.
- Owner approval where `approval_gate` requires it; implementation completion alone is not approval.

## Phase exits

| Phase | Slice/outcome | Required objective evidence | Human or decision gate |
|---|---|---|---|
| P00 | Audited reference and supported baseline | Pinned source identity; classified inventory; Node 24+ and PostgreSQL 18 run; unit, syntax, migration, smoke, and database artifacts | Source pin satisfied; classification and supported-stack evidence pending; ADR-009 is Approved with named specialist sign-offs remaining |
| P01 | S1 authority kernel | Atomic command/evidence/receipt/outbox tests; reconnect replay; authorization and tenant denial; accessible S1 browser flow | ADR-001/003/015 confirmed; ADR-008/010 approved by Product Owner, with named specialist sign-offs still required; formal approver roles subject to OPEN-001 |
| P02 | Configured Fractured Order plus extension, voting, and voice cores | AC-02/03/04/05/07/08/09; EXT-01..11; VOTE-01..10; VOICE-01..05; LAN checks | ADR-016/018 confirmed and ADR-017 Approved; named specialist sign-offs remain; AC-09 parity must pass; OPEN-027..029 production gates remain closed |
| P03 | S3 Studio and complete first-product proof | Concurrent editing and convergence; immutable publication; authoring/access/readiness flows; AC-01..13 package | OPEN-027 consent, OPEN-028 ballot custody, OPEN-029 plugin trust, and OPEN-001 approvers |
| P04 | S4 live activation and generalization | Release pinning/activation; adjudication; policy-negotiation and crisis-response designs without Runtime edits | Semantic OPEN items named in affected prompts must be resolved or accepted by owner |
| P05 | S2, S5, S6, S7 and release-assurance package | Offline reconciliation; evidence verification; reports; migration/recovery; deployment; air-gap; accessibility; load and security results | Implement and evidence resolved OPEN-001/009/014/015/017/019/024/027/028 policy; PS-545 performance remediation is complete, while PS-550 production controls and approval remain |
| P06 | Production Plugin catalog expansion | Per-Plugin contract, permission, isolation, offline bundle, license, lifecycle, and compatibility evidence | OPEN-011 approves the first candidate; resolved OPEN-022/029 controls and explicit digest-bound Artifact approval still apply per Plugin |
| P07 | Teludens product entry and lifecycle | Shared semantic tokens/components, exact catalog wordmarks, root entry, auth recovery, Organization/Project/Template/Release/Session journeys and structural completeness audit | A five-minute test must start at `/`; no pasted identifier, hidden seed, legacy brand or simulation-specific shell |
| P08 | Specification-complete Studio | Reachable workspaces for Studio sections 3-27, visual authoring, previews, collaboration, role walkthrough, deterministic rehearsal, review and publication | A non-programming Designer completes each task script without raw JSON/SQL or developer tooling |
| P09 | Complete Runtime and operations | Participant, Operator, Admin, Publisher, Reviewer and Research workflows; recovery, reporting, replay, archive and Plugin lifecycle UI | Every persona has least-privilege task evidence; no core workflow is CLI-only |
| P10 | Product/operations hardening | Full-route Teludens audit, route/state/viewport visual matrix, CI, security, observability, clean install/upgrade/restore and manual assistive-technology review | Any missing UI state, legacy logo, conformance exception or NOT RUN required control blocks exit |
| P11 | Golden journey and release | Blank-install UI-only Fractured Order lifecycle, two contrasting UI-authored simulations, fail-closed completeness audit and exact-artifact evidence | Every applicable completeness row and S0-S2 defect is PASS; owner GO is explicit and deployment remains separate |

## P07-P11 product-completeness gate

`PRODUCT_COMPLETENESS_MATRIX.md` is mandatory evidence for the completion phases. The release-mode gap audit fails if a required capability lacks a public UI path, server-authoritative behavior, complete applicable states, Teludens conformance, official Plenum branding, automated evidence, task-based human evidence or accountable ownership. Fractured Order must run inside the same Teludens platform shell as every other simulation.

## Roadmap section 13 evidence categories

The combined release package must include unit, integration, API contract, event contract, state-machine, authorization, tenant-isolation, trigger, state-transition, adjudication, analytics-reproducibility, deterministic-replay, load, recovery, migration, accessibility, browser, and end-to-end Session evidence. `REQUIREMENTS_TRACEABILITY.md` identifies task/test ownership; missing categories block release but do not retroactively fail unrelated completed tasks.

## Roadmap section 15 operational readiness / REQ-069

Before any live Session, the operator must verify and record: Release version, Seat Assignments, permissions, Inject triggers, adjudication guidance, time controls, export path, fallback procedures, technical operators, backup and recovery, connectivity contingency, pause/resume, state recovery, and incident-command ownership. PS-340 creates the checklist; PS-550 verifies its use. Any absent item is a no-go for that Session.
