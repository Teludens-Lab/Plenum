# PS-120 verification

Date: 2026-10-18. Status: implementation evidence, not release approval.

## Environment

- Node.js 24.22.0 container pinned by digest; npm 11.19.1; TypeScript 5.9.3.
- PostgreSQL 18.6 Alpine container with synthetic disposable data.

## Evidence

| Gate | Result | Demonstrated behavior |
|---|---|---|
| `npm run typecheck` | PASS | Strict command-kernel and contract types |
| `npm test` | PASS, 5/5 | Canonical serialization and five versioned contracts plus PS-100/110 regressions |
| `npm run test:integration` | PASS, 4/4 | Six concurrent retries commit once; collision refused; rejection and reconciliation each write one receipt/event; stale/wrong Authority writes nothing; forced receipt failure rolls back state/event/outbox/sequence |
| `npm run test:db` | PASS, 4/4 | Same Pg18 database boundary suite exposed as CMD-PLATFORM-DB |
| `npm run lint` | PASS | Contract IDs, names and dependency graph |
| `node scripts/validate-promptbook.mjs` | PASS | 31 tasks, REQ 94/94, INV 28/28, no cycles |

Migration `006_command_kernel.sql` is additive. It extends receipts and events with correlation and aggregate metadata and adds one recorded outcome per Command. Recovery is forward-fix; no destructive rollback is authorized after production data uses the new columns/index.

ADR-001, ADR-003 and ADR-015 are Confirmed; ADR-014 was Approved on 2026-10-20 with named Technical Lead sign-off remaining. OPEN-016 authority transfer and OPEN-017 recovery/custody remain unresolved. No publisher is implemented: committed rows stay `pending` for the later outbox worker, so no external call occurs inside the transaction.
