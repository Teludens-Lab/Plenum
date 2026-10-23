# PS-410 verification

Date: 2026-10-22. Status: **implementation complete; change-level GO**. Product Owner direction resolved OPEN-018, and the corrected final diff passed clean database and aggregate browser reruns.

## Delivered behavior

- One versioned contract supports manual, rubric, rules, Plugin and hybrid adjudication. Rules traces retain every evaluated condition, including failures; model and Plugin output remains advisory.
- A request pins one Governing Release and immutable snapshots of one or more Action records. A Decision Record contains exactly one Action, while one adjudication may cover several Actions.
- Artifact revisions retain an ordered actor/co-author list resolved from current Session Participants. Each author snapshot carries stable Person/Participant identifiers plus submission-time display name and Organization name. Reviewer submissions are likewise append-only and attributable; perspective inputs remain distinct from lead synthesis.
- Only a Release-configured lead reviewer can draft or publish the outcome. A final result that differs from the system suggestion requires an override rationale; unpublished drafts are omitted from unauthorized projections.
- Publication, State Effects, Command Receipt, Evidence Event and transactional outbox remain atomic through the existing Command kernel. State Effects are bounded to 100, validate their shape, and limit delay to seven days.
- Per-recipient delivery rows distinguish `releasedAt`, `deliveredAt`, `viewedAt` and `acknowledgedAt`. Delivery records evidence an authorized version made available; they neither grant access nor prove viewing. Runtime queries re-evaluate current authorization.
- The Fractured Order Action workflow now follows Scribe -> Facilitator -> White Cell. The Facilitator may edit before forwarding and after a White Cell return, then resubmit; accepted submitted revisions remain immutable and attributed.
- Simulation Objectives attach to the Release/package as a whole. Team- or Session Role-specific guidance remains governed content rather than a second Objective attachment model.

Client mutation state continues to use the existing Runtime `local_pending` and canonical Command receipt states. PS-410 does not add a second client persistence model.

## Mechanism matrix

| Mechanism | Suggestion source | Human authority | Explanation evidence |
|---|---|---|---|
| manual | none | lead reviewer | explicit human-judgment trace plus reviewer inputs |
| rubric | weighted configured criteria | lead reviewer | every criterion, score validity and weight |
| rules | first satisfied Release rule | lead reviewer | every evaluated Gate condition, pass/fail and explanation |
| Plugin | approved, hash-pinned proposal(s) from the current authority epoch | lead reviewer | proposal ID and hash; failed/unapproved proposals are excluded |
| hybrid | rules, rubric, approved Plugin proposals and reviews | lead reviewer | combined trace retaining each source separately |

All mechanisms produce `adjudication-record-v1`; none may publish without an authorized lead reviewer Command.

## Evidence

Environment: Node 24.10.0/npm launcher; TypeScript 5.9.3; PostgreSQL 18.6; SeaweedFS 4.48; Playwright 1.64.1 Chromium 156.

| Gate | Result | Evidence |
|---|---|---|
| `npm run typecheck` | PASS | Final strict source type check, including bounded State Effect validation. |
| `CMD-PLATFORM-TEST` / `npm test` | PASS, 87/87 | `PS-410-T01` covers the unified mechanism contract; `AC-12` covers complete rules traces; Release/workflow regression checks pass. |
| `CMD-PLATFORM-INTEGRATION` / `npm run test:integration` | PASS, 20/20 | Clean final run on a fresh PostgreSQL 18.6 database. `PS-410-T02` passed with governed Action eligibility, current evidence rechecks, ordered attribution, duplicate-review conflict handling, publication-time delivery rows and one accepted competing synthesis. |
| `npm run build` | PASS as part of `npm test` and integration | Server/shared TypeScript and both web applications compiled; only the existing Vite chunk-size warning remains. |
| aggregate `CMD-PLATFORM-E2E` | PASS, 19 passed / 1 conditional media skip | Clean final run on a fresh PostgreSQL 18.6 database. The axe-tagged PS-410 browser journey reviewed, explained and published an adjudication, verified ordered co-author attribution, and did not expose hidden notes or participant-restricted traces. Screenshot: `output/playwright/ps-150/ps-410-adjudication.png`. |
| Fractured Order compilation | PASS | Source compiled to the checked-in Release with the revised Action custody workflow, package Objective and manual White Cell adjudication model. |
| `CMD-PLATFORM-LINT` / `npm run lint` | PASS | 54 sources, 28 versioned contracts, canonical naming and acyclic workspaces; OpenAPI includes the adjudication contracts and query. |
| `CMD-PROMPTBOOK-VALIDATE` | PASS | 31 tasks, REQ 94/94, INV 28/28 and no dependency cycles. |
| migration 001-020 through integration setup | PASS | `020_adjudication_records.sql` applied after the existing world-state migration on a fresh disposable PostgreSQL 18.6 database and passed the final behavioral integration gate. |

## Migration and recovery

Migration `020_adjudication_records.sql` is additive. It adds immutable Artifact revision history and ordered actor/co-author snapshots, adjudication requests and Action snapshots, append-only perspective reviews, draft/published records, per-recipient delivery evidence, forced tenant RLS, indexes and mutation-refusal triggers. It is numbered 020 because migration 019 already owns PS-400 world-state automation.

Deploy the migration before code that accepts adjudication Commands. Older application versions ignore the new relations. Rollback means stopping new adjudication publication and rolling back application code while preserving revisions, reviews, published outcomes and delivery history; forward-fix any data defect instead of dropping evidence tables.

## Remaining release work

- Formal security and accessibility review remain pending; the browser flow includes automated axe coverage but is not a manual assistive-technology review.
- Production migration rehearsal, backup/restore validation and authorized deployment remain PS-530/release-gate work.
- No production environment or production data was changed.
