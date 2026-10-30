# PS-720 verification

Status: **VERIFIED; AUTOMATED GATES PASS; HUMAN ACCEPTANCE PASS.** This is not production approval.

## Delivered behavior

- Authorized Publisher Release catalog/detail with immutable provenance, Package digest, real Package export and verified idempotent import.
- Authorized Operator Session catalog/detail and transactional configured Session creation from a visible Release without pasted identifiers.
- Exact Command replay, concurrent duplicate suppression, collision refusal, tenant/role denial, immutable Release digest, and atomic receipt/evidence/outbox/audit persistence.
- Stable Release, Session, staffing/readiness, Runtime, reports, replay, archive, Members, Plugins, Deployment, and Data-policy navigation.
- Loopback-only synthetic-persona harness and ten-minute visible-controls script in `docs/acceptance/PS-720-user-test.md`.

## Automated evidence

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS; contracts registered |
| `npm test` | PASS 104/104 |
| `npm run test:integration` | PASS 27/27 on fresh PostgreSQL 18.6 and SeaweedFS 4.48 |
| `npm run test:e2e:product` | PASS 13/13 in 49.3 seconds on fresh PostgreSQL 18.6 after corrective assertions; includes `PS-720-T01`, `PS-720-T02`, and `AC-03` |
| `npm run test:a11y` | PASS 11/11 in 2.4 minutes on fresh PostgreSQL 18.6 and Playwright Chromium |
| `npm run audit:product-completeness` | PASS 228 obligations; omission check PASS |
| `npm run validate:promptbook` | PASS 48 tasks; REQ 94/94; INV 28/28; no dependency cycles |
| `npm run user-test:ps720` startup + root request | PASS; loopback listener reported ready and `/` returned HTTP 200 |
| Corrective step-1/step-5 browser assertions | PASS in the 13/13 product suite: Release digest/approval metadata and Session readiness progress are visible |
| Ten-minute product-owner test | PASS all ten steps, including focused corrective retest with screenshots on 2026-10-29 |
| Production approval | **NOT RUN** |

## Migration and recovery

Migration `027_release_session_catalog` is additive. It backfills bounded Session titles, adds scheduling/update metadata and catalog indexes, and installs an updated-at trigger. Deploy it before PS-720 code. After use, retain configured Sessions and all receipts/evidence/outbox/audit records; stop new creation and forward-fix rather than dropping populated columns. No production migration or deployment was performed.

## Next eligible task

PS-720 change-level acceptance is complete. PS-730 is the next eligible task. Its `OPEN-004` methodology dependency remains explicitly unratified and must not be invented or silently resolved during implementation.
