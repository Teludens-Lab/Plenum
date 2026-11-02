# PS-760 verification

Date: 2026-11-02  
Mode: change-level implementation evidence; production approval is separate  
Human user test: **PASS** — all ten steps confirmed by the product owner on 2026-11-02; see `docs/acceptance/PS-760-user-test.md`

## Delivered behavior

- Studio sections 18–24 are reachable through labeled workspaces for Interfaces, Research, Measurements and reports, Access and readiness, Role walkthrough, Test and validate, Review and publish, and Live Changes.
- Fixed-seed rehearsal returns an exact Draft digest and why/why-not trigger traces without changing Session state.
- Versioned Measurement Definitions and governed Report sections participate in validation and research traceability.
- Review and publication use the current exact freeze; no Freeze ID or other internal identifier must be pasted.
- Resolved `OPEN-013` is enforced by person and artifact digest: exact authors cannot approve, Admin alone cannot approve, and one non-author may hold both Reviewer and Publisher roles.
- Template versions and lifecycle events are immutable and attributable. Consequential Release activation requires a fresh distinct-author Reviewer approval; disruptive changes remain blocked and require a new Session.
- Approval, publication, Template lifecycle and activation evidence records actor, active roles, policy version, artifact digest, rationale/evidence and server timestamp.

## Compatibility and migration

- Migration `030_template_review_governance.sql` is additive. It adds exact-author, digest, policy and lifecycle provenance fields plus immutable Template lifecycle events.
- Existing published Releases and Sessions are not rewritten. Legacy activation candidates fall back to the recorded revision author when an exact freeze-author set is unavailable.
- Rollback is application rollback plus forward-fix of the additive schema; dropping the new columns or lifecycle table is not required and would discard evidence.

## Automated evidence

| Reference | Command / evidence | Result |
|---|---|---|
| `CMD-PLATFORM-TEST` | `npm test` | **PASS** — 108/108 |
| `CMD-PLATFORM-INTEGRATION` | `DATABASE_URL=<fresh-pg18> S3_ENDPOINT=<loopback-seaweedfs> npm run test:integration` | **PASS** — 28/28, including immutable Template lifecycle, archive restore, exact-author denial, distinct Reviewer approval, and concurrent immutable object writes |
| `CMD-PRODUCT-E2E` | `DATABASE_URL=<fresh-pg18> npm run test:e2e:product` | **PASS** — 18/18 in 15.3 minutes; focused PS-760 rehearsal/publication/Axe evidence is included |
| `CMD-PLATFORM-A11Y` | `DATABASE_URL=<fresh-pg18> npm run test:a11y` | **PASS** — 11/11 in 26.7 minutes, including independent Reviewer approval and subsequent Operator activation |
| `CMD-GENERALIZATION` | `npm run test:generalization` | **PASS** — 1/1; the validation fixtures now declare the Activities already referenced by their Stages. |
| `CMD-GAP-AUDIT` | `npm run audit:product-completeness` | **PASS** structural mode — 228 obligations and omission check; release mode remains intentionally gated. |

Additional gates: typecheck **PASS**; build **PASS** with the existing >500 KiB chunk warnings; lint/contracts **PASS**; promptbook validation **PASS** for 48 tasks, 94/94 requirements and 28/28 invariants.

Artifacts:

- `output/playwright/ps-760/rehearsal-publication.png`
- `output/playwright/ps-710/results/` for the aggregate product run
- `output/playwright/ps-150/results/` for the aggregate accessibility run

## Acceptance status

Implementation, required automated gates, and independent human acceptance are **PASS**. PS-760 is change-level complete and PS-770 is the next eligible task. Production approval remains separate and **NOT RUN**.

