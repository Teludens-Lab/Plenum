# PS-520 verification

Updated: 2026-10-23. Change mode: production/high-criticality implementation with synthetic local data only.

## Outcome

PS-520 is implemented and verified. The modular server now produces immutable provenance-bearing Session reports and consent-filtered research exports in JSON, JSONL, CSV, HTML, PDF, and ZIP; stores separate observations, versioned metrics, notes, and findings; records retention policy and compensating corrections; performs pinned deterministic replay with machine-readable divergence; and transactionally rehydrates digest-verified Organization archives into an empty same-Organization deployment.

Migration `024_reporting_research` adds forced-RLS, append-only reporting records. The HTTP surface adds research-consent and report-generation endpoints. A replay adapter is injected at deployment/runtime composition; the HTTP endpoint fails closed when no deterministic adapter is configured.

## Acceptance evidence

| Requirement | Evidence | Result |
|---|---|---|
| Every report element traces to source | `PS-520-T01/T02/T03` and real-DB `AC-06` assert event/metric/analysis source references and reconciliation counts | PASS |
| Research export contains no direct participant identifiers or raw bodies | Real-DB and aggregate HTTP/browser flow assert person/participant IDs and a synthetic direct name are absent | PASS |
| Metric version changes do not rewrite history | Real-DB test generates v1, adds v2, generates again, and verifies the first artifact bytes are unchanged | PASS |
| Replay matches or emits machine-readable divergence | Unit and real-DB adapter tests cover identical input, missing/reordered events, and manifest comparison | PASS |
| Exact idempotent retry and immutable regeneration | Real-DB and HTTP flow return identical bytes for one key, refuse key collision, and create a new artifact for a new key | PASS |
| Portable Organization archive validates and reimports | Real-DB test creates a second fresh database, applies migrations 001-024, adds only the bootstrap Admin identity, imports every declared dataset, compares every table count, then successfully replays a Session and regenerates a report | PASS for logical operational-table hydration |
| Import boundary and atomicity | Import rejects digest, restore-contract, Organization-scope, identity, and non-empty-target mismatches before data insertion; all hydration and audit work share one transaction; the same digest replays without duplicate rows | PASS |
| Required aggregate browser gate | The Windows fixture-server shutdown hang is fixed with a bounded global teardown. The exact clean `npm run test:e2e` aggregate completed with `21 passed`, `1` conditional real-media skip, and a normal final summary in 6.4 minutes. Loaded-host time budgets were widened without weakening assertions, and the timer extension proof now compares its durable deadline rather than a decaying wall-clock value. | PASS |

## Verification commands

Environment: Node 24.18.0, npm 11.16.0, TypeScript 5.9.3, fresh disposable PostgreSQL 18 databases, digest-pinned SeaweedFS 4.48, Playwright 1.64.1 Chromium, synthetic data only.

| Command | Result |
|---|---|
| `npm run typecheck` | PASS, exit 0 |
| `npm run lint` | PASS, exit 0; 62 sources and 37 versioned contracts |
| `npm test` | PASS, exit 0; 103/103 |
| `npm run reconcile:reports` | PASS, exit 0; 3/3 |
| `npm run test:integration` | PASS, exit 0; 24/24 on a clean source database plus real S3-compatible storage and a second freshly migrated logical-restore database |
| focused global-teardown proof | PASS, exit 0; 1/1 in 52.3 seconds and the fixture server terminated in 292 ms without manual intervention |
| focused DEC-42 plus timer-control regression | PASS, exit 0; 2/2 in 2.5 minutes, including an exact 60-second durable-deadline shift |
| focused Studio collaboration regression | PASS, exit 0; 1/1 in 5.2 minutes, including offline reconnect, convergence, validation, freeze, approval, and publication |
| `npm run test:e2e` | PASS, exit 0; exact aggregate `21 passed`, `1` conditional real-media skip in 6.4 minutes on a fresh disposable database; normal final summary and clean fixture shutdown |

## Security, privacy, and operational boundary

Research export requires current Research Analyst membership, an unrevoked project grant, and current purpose-specific consent. Organization and standard exports require current Admin/Operator authorization. RLS and append-only triggers protect every new table, and audit records cover consent, analysis, policy, correction, export, and archive import actions.

No browser UI changed. No production system, KMS/HSM, custodian, backup, or institutional retention configuration was deployed. Logical import is deliberately limited to an empty same-Organization deployment and never merges into authoritative live Runtime tables. Authentication credentials and object-store blobs remain separate. PS-530 owns their deployment and recovery mechanics.

## Readiness

PS-520 is `verified` at change level. Its report/research/replay behavior, logical archive reimport into a second clean database, and exact aggregate browser gate all pass. **PS-530 is the next planned implementation task.**

In simple terms, OPEN-009 now defines how long production records live and where they stay, but the repository has not yet implemented and proved the complete deletion/anonymization, legal-hold and audit process. PS-530 implements deployment/recovery and PS-550 must verify the approved retention policy and production controls before release.
