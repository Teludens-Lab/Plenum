# BA-02 — Isolate anonymous and authenticated Command limits

## Outcome

- Pre-production, high-risk security remediation of build-audit finding 2. Code completion and BA-02-T01–T03 local evidence: **PASS**. Measured converged-candidate capacity and deployed-ingress proof: **NOT RUN**. Final release decision: **not granted**.
- Anonymous/invalid/unauthorized traffic cannot debit a participant's Command or Session aggregate allowance. Address abuse protection remains before authentication; principal and aggregate protection follow trusted Session access resolution. Canonical errors, atomic database updates and Command receipt idempotency are retained.
- Sources: BA-02; PS-120/810; REQ-051/067 and INV-001/017; Roadmap §16, PRD reference capacity, Data Security §§5–9/19, DEC-16/OPEN-019 and `deploy/load-fixtures/reference-profile.json`. No identity, tenancy or topology change; no dependency or migration.
- Starting tree was clean at `9d32a9e14a2cd731098901cc580675a769549ddc`. BA-01 is part of that baseline. Implementation manifest SHA-256: `34ad8993282da2c59f0ceba1fdb1dff66cde24b38623a1404d4b3b7ff712266e`. The uncommitted per-file and root lockfile hashes are in [candidate.json](../../test-results/ba-02/candidate.json); this is source identity, not a deployed image digest. The [original audit](../release-evidence/2026-11-10-build-audit.md) remains unchanged.

## Acceptance and evidence

| ID | Result | Observed evidence |
|---|---|---|
| Finding 2 reproduction | PASS | Unmodified compiled baseline and migration-025 limiter: 120 anonymous requests exhausted the known Session bucket and denied an authenticated request from a different address. Disposable database, fixed clock. [Reproduction](../../test-results/ba-02/reproduction.json), [log](../../test-results/ba-02/reproduction.log). |
| BA-02-T01 | PASS | Actual `profile-service.mjs`, real PostgreSQL and trusted synthetic ingress. Missing, malformed and nonexistent credentials return 401; nonparticipant and cross-Organization access remain denied with no principal/aggregate debit. After prefilling ingress to 11,999, eight concurrent anonymous HTTP requests produce one 401 and seven 429s; invalid credentials and a nonparticipant remain ingress-throttled. A valid participant from another address opens a poll successfully. [Final DB log](../../test-results/ba-02/platform-db-final.log). |
| BA-02-T02 | PASS | Prefill principal A to 119; eight concurrent HTTP retries produce one accepted receipt and seven 429s, despite spoofed principal/Organization headers. A new throttled Command creates no receipt. Participant C can cast a valid ballot in that same Session; six concurrent identical ballot retries yield one ballot, two total receipts/events/outbox rows including the poll open. Receipt GET remains available after principal exhaustion. Session aggregate denial is independently enforced; retry after synthetic-window expiry preserves one ballot. Same log. |
| BA-02-T03 | PASS | Table-driven credential/address/identity spoofing, trusted rightmost IP, invalid header fallback, canonical IPv6 and stable principal ownership. Real DB contention at each bucket boundary admits exactly two of eight with two tokens left; rollover restores allowance with deterministic time, and expired rows are removed. Reference-profile policy test consumes all three layers for 11,000 requests across ten 500-person Sessions without a denial. HTTP child Date is frozen using Node's test facility; production gains no clock override. [Unit log](../../test-results/ba-02/platform-test.log), final DB log. |

Boundary prefill is explicitly synthetic database fixture setup, not a claim that 12,000 anonymous HTTP requests were sent. HTTP requests use the production authentication query and Session resolver, with real seeded Authentication Sessions; this task does not reprove OIDC interoperability. The policy workload reads the checked-in profile, repeats its 100-actor application workload six times, then adds 500 ballots per Session. It exercises actual limiter queries with concurrency 50, not 5,000 full domain Sessions. Final focused HTTP execution took 1.93 s and the policy/concurrency test 7.08 s locally; neither duration is a throughput SLO or production capacity measurement.

## Configured policy and operational assumptions

| Bucket | Fixed-minute maximum | Rationale |
|---|---:|---|
| Ingress address | 12,000 | Ten reference Sessions share an address; counts rejected and authenticated requests plus receipt reads. |
| Organization + principal | 120 | Preserves the prior per-minute Command bound as an individual allowance, independent of login token/device/role/Session. |
| Organization + authorized Session | 1,200 | Six 100-Command application windows + 500-ballot burst + 100 control/retry headroom. |

These finite limits are code policy, not new environment switches. All keys include deployment identity before hashing. Principal denial stops before aggregate debit. Aggregate denial may spend the caller's principal attempt. Authorized retries count as requests, but the existing kernel still commits each Command once. Fixed-minute windows can allow two windows' allowance across a minute boundary; this is unchanged, documented fixed-window behavior.

Existing migration 025 is compatible: same categories, hash storage and atomic upsert. New scope prefixes separate all three buckets from the legacy Session-only key. Key expiry is minute-end, with lazy deletion after five additional minutes on the next limiter call; idle databases may retain expired hashes until traffic resumes. Command keys vary only by observed IP or trusted Organization/principal/Session, never attacker-supplied tokens or path identities.

`PLENUM_TRUST_PROXY=0` ignores forwarded addresses. With `1`, the application must be reachable only from an ingress that replaces the header or appends its observed peer. Only the last valid IP is used; invalid/ambiguous headers fall back to the socket, and IPv6 spellings normalize. Multi-hop profiles must normalize their final hop correctly. Same-NAT clients share the address allowance and can still affect each other at ingress; rejected anonymous traffic cannot spend their authenticated allowances. Network-level distributed abuse protection and actual deployed proxy behavior remain deployment responsibilities. See the [PS-810 runbook](../operations/PS-810-OBSERVABILITY-SECURITY.md#command-rate-limits--ba-02).

Limiter responses retain generic `RATE_LIMITED`, HTTP 429, no-store and `Retry-After`; rate events/metrics omit bucket keys, addresses, Session existence and participant identity. RLS and Session checks remain intact. No UI change, new consent behavior, ballot-visibility change or new trust boundary.

## Verification

All commands ran from `C:\Users\ssnguna\Local Sites\Plenum`, Node **v24.22.1**, Windows, root lockfile. JSON artifacts record exact command, cwd, runtime, start, duration, exit and status; adjacent logs retain output. No failed command is relabeled PASS.

| Command | Result | Evidence |
|---|---|---|
| CMD-PLATFORM-TYPECHECK — `npm run typecheck` | PASS / 0; 16.93 s | [typecheck.json](../../test-results/ba-02/typecheck.json) |
| CMD-PLATFORM-TEST — `npm test` | PASS / 0; 163/163; 14.06 s | [platform-test.json](../../test-results/ba-02/platform-test.json) |
| CMD-PLATFORM-DB — `npm run test:db` | PASS / 0; 42/42 on both runs; final 142.75 s | [initial](../../test-results/ba-02/platform-db.json), [final controlled-clock run](../../test-results/ba-02/platform-db-final.json) |
| CMD-SECURITY — `npm run test:security` | PASS / 0; 8/8 and zero dependency findings; 73.16 s | [security.json](../../test-results/ba-02/security.json), [details](../../test-results/ba-02/security-details.json); strict TLS, system CAs, Git Bash |
| CMD-PLATFORM-LINT — `npm run lint` | PASS / 0; build + 131 sources/52 contracts; 14.57 s | [lint.json](../../test-results/ba-02/lint.json) |
| CMD-GAP-AUDIT — `npm run audit:product-completeness` | PASS / 0; 240 obligations plus omission check; 2.01 s | [completeness.json](../../test-results/ba-02/completeness.json); structural, not release approval |
| CMD-LOAD-APP / CMD-LOAD-VOTING | NOT RUN here; assigned to BA-12 | Both must be rerun on the converged candidate. Existing load harnesses call the kernel directly; the new HTTP test supplies separate limiter integration proof. |
| Deployed proxy, production capacity/soak, backup restore and new human review | NOT RUN | No deployment authorized; no data migration or UI changes. Existing human approvals retain their scope. |

## Changed files, compatibility and recovery

Implementation: `apps/server/src/security/rate-limit.ts`, `apps/server/src/http/runtime-http.ts`, `deploy/compose/profile-service.mjs`.

Tests: `apps/server/test/identity.unit.test.mjs`, `apps/server/test/operational-security.unit.test.mjs`, `apps/server/test/identity.integration.test.mjs`, `apps/server/test/command-rate-limit.integration.mjs`. The helper is reached by existing `npm run test:db` and integration scripts; no new validation command.

Continuity: this handoff and its narrow `.gitignore` exception, `docs/operations/PS-810-OBSERVABILITY-SECURITY.md`, `docs/promptbook/PROJECT_STATE.md`, `PRODUCT_COMPLETENESS_MATRIX.md`, `product-completeness-ledger.json`.

No schema, public JSON contract, Release, receipt or persisted Session transformation. Drain old application instances when deploying: mixed old/new instances still expose the legacy shared bucket on old code, and new bucket scopes begin empty. Keep the existing limiter table/function. Code rollback is schema-compatible but reopens finding 2; prefer a reviewed forward-fix or temporarily restrict ingress. Rollback/deployment was not executed. No commits, branch publication, PR, push or deployment; proposed branch/subject remain proposals.

Task infrastructure: C: preflight free space 178,666,684,416 bytes. Named disposable PostgreSQL 18.6 container `plenum-ba02-pg`, ID `0f2a7a379c4bd0cf177aaa11515c6a2c53ad48a8c9055a25149f1d3eac781f74`, loopback port 55452, tmpfs storage. Only `ba02_reproduction`, `ba02_db` and `ba02_final` were created for this task. Production HTTP child processes stop in test cleanup. Final infrastructure cleanup is recorded in `test-results/ba-02/cleanup.log`; no broad prune or unrelated-service changes.

## Risks and continuation

BA-02 local acceptance is separate from measured capacity, external proof, human acceptance and PS-850 release approval. Preserve PS-830 owner-reported product/desktop AT acceptance, PS-840's signed-checkpoint execution exception and PS-842 decisions. No new layout/AT review is needed for this server-only patch. Other audit findings remain outside scope.

Next: **BA-03**. BA-12 rechecks application/voting load on the converged candidate. Revisit these limits when supported participant/workload/retry assumptions, ingress topology or authentication identity ownership changes. Main deployment risk: incorrect trusted-proxy configuration or hostile traffic sharing a legitimate client's NAT address can exhaust ingress allowance even though authenticated quotas remain isolated.
