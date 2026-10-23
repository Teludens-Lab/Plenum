# PS-140 verification

Date: 2026-10-18. Status: implementation evidence, not release approval.

## Environment

- Node.js 24.22.0 container pinned as `node@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f`; npm 11.19.1; TypeScript 5.9.3.
- PostgreSQL 18.6 Alpine pinned as `postgres@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873` with synthetic disposable databases.
- SeaweedFS 4.48 remained in the complete integration regression environment.
- Root `npm ci --ignore-scripts`: PASS; 52 packages installed; 60 packages audited with zero vulnerabilities.

## Evidence

| Gate | Result | Demonstrated behavior |
|---|---|---|
| `npm run typecheck` | PASS, exit 0 | Strict types across seven workspaces and the Runtime sync boundaries |
| `npm run build` | PASS, exit 0 | All seven workspaces compiled from the root lockfile |
| `npm test` | PASS 9/9, exit 0 | Duplicate/reordered convergence, projection-before-cursor persistence, polling fallback, `local_pending` separation and prior regressions |
| `npm run test:integration` | PASS 8/8, exit 0 | Real Pg18 publish-after-commit, opaque scoped cursors, role-change invalidation, bounded replay, hidden-delta omission, SSE framing, snapshot reset and revoked-client denial plus S3 regressions |
| `npm run test:db` | PASS 7/7, exit 0 | Independent fresh-database execution of the PostgreSQL boundary suite through migration 008 |
| `npm run lint` | PASS, exit 0 | 17 application/package sources, eight versioned contracts, canonical naming and acyclic workspaces |
| `node scripts/validate-promptbook.mjs` | PASS, exit 0 | 31 tasks, REQ 94/94, INV 28/28 and no dependency cycles |
| `CMD-PLATFORM-E2E` | NOT RUN | The command remains Proposed by PS-150; there is no rendered Runtime shell or HTTP composition root yet |

Required evidence IDs `SYNC-08`, `SYNC-10`, and `SYNC-11` are present in passing output. The server reloads current Session Access Context for each sync call, never exposes Evidence Sequence, issues UUID Projection Cursors scoped to Participant, Device, Active Role Context, access revision, policy version and projection version, and returns a new opaque cursor even when all scanned events are omitted.

The SSE and polling boundaries share one authorized delta builder. Unknown event types fail closed. The currently implemented `seat_assignment.changed`, `command.rejected`, and `command.reconciliation_required` projections expose only allow-listed payload fields to their authorized audience. Replay is at-least-once and limited to 100 source events per request; the client deduplicates by delta ID and applies only newer aggregate versions.

## Data, deployment, and recovery

Migration `008_projection_cursors.sql` is additive. It adds `published_at` to the existing outbox and creates the RLS-protected cursor table and indexes. The nullable column does not require a data backfill; index creation scans existing outbox rows and should be rehearsed before a populated deployment. Older application code ignores the additions. After new sync traffic starts, disable the endpoints and forward-fix rather than deleting cursor or outbox data.

Cursor expiry follows the current Authentication Session expiry. The implementation temporarily retains the current bounded replay batch per Device; PS-530 must replace that implementation limit with the approved deployment-profile retention setting.

## Open governance and QA limits

- ADR-010 is Approved as of 2026-10-20 and ADR-015 is Confirmed; named Technical Lead and Security Owner sign-offs for ADR-010 remain.
- At PS-140 completion, no Offline Outbox, offline credential policy or provisional Command submission was added. OPEN-015 was resolved by user direction on 2026-10-23 and its implementation baseline was added by PS-500; the approved eight-hour production authority still requires follow-up enforcement evidence.
- No HTTP server composition, browser workflow, HTTP/2/proxy test, sustained SSE connection, reconnect-burst load test, Node 26 run, deployment or release approval was performed. PS-150 owns the first rendered end-to-end Runtime flow; PS-540 owns measured reconnect load.
