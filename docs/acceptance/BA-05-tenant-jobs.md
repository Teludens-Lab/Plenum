# BA-05 — Organization-wide scheduled work

## Status and authority review

**Authority proposal approved by the user on 2026-11-11:** "Approve durable tenant job bindings (Recommended)." Implementation and automated verification are complete from clean `86b4c464eeff9f3537f76ed238d09b07ca591aeb`, Node 24.22.1. Earlier BA-04/PS-830/PS-840/PS-842 evidence and the BA-12 capacity blocker retain their original scope.

The approval satisfies the BA-05 service-authority review and AGENTS.md section 2 gate for the narrow binding below. It does not authorize production deployment or data deletion.

## Existing boundary and gap

- `deploy/compose/profile-service.mjs` starts Injects and Floor reconciliation only for `oidc.organizationId`; retention uses that same Organization and one configured `PLENUM_RETENTION_ACTOR_PERSON_ID`.
- `docs/operations/DEPLOYMENT.md` requires that actor to be a dedicated Person with the Admin Organization Role. `runRetentionEnforcement` checks membership in the target Organization and records that Person in purge/audit records. There is no existing per-Organization assignment identifying which dedicated actor a background process may use. Choosing an arbitrary Admin would invent delegation and misattribute automated work.
- `runtime.session_authorities` identifies the owning Deployment and Epoch for each Session. It does not grant Organization-wide retention authority, including for Organizations without a live Session.
- Organization discovery exists for authenticated Platform Administrators. Migration 033 explicitly separates that authority from access to customer Sessions, exports and evidence. Reusing a human platform principal or querying tenant tables through the database owner is not the proposed solution.
- ADR-005/015 and Data/Security §3–7 require the existing monolith, tenant-scoped application transactions and non-owner RLS boundary. No general service-principal registry, deployment-to-Organization job grant or tenant job actor mapping was found in the current implementation.

## Approved decision — explicit tenant job bindings

Reuse existing dedicated Person identities and Organization Admin permissions. Add a small, audited binding for **Organization + owning Deployment + designated retention actor**, with enabled/revoked state and a revision. Do not create a new role, wildcard administrator, service, queue or datastore. Migration 045 adds the binding and a durable retention deadline; it does not backfill arbitrary tenant Admins.

An active Organization Admin must explicitly authorize the dedicated actor for that Organization. The Deployment ID comes from trusted deployment configuration, not a browser claim. Registration/revocation is auditable and uses existing tenant authorization; Platform Administrator status alone cannot authorize retention. The current bootstrap configuration may be migrated only as its existing explicit assignment. Additional Organizations require their own explicit assignment; a newly provisioned and authorized Organization becomes discoverable without restarting the process.

A narrow database operation returns only bounded, cursor-paged job-binding metadata for the configured Deployment. It does not expose tenant business records or relax their RLS policies. Each job rechecks Organization lifecycle, current binding revision and applicable actor authority in its own tenant transaction. Retention additionally checks active workforce access and current Admin membership. Injects and Floor work retain their existing Session Authority/Epoch checks. Revoked or suspended authority stops new work; legal holds continue to prevent disposal.

One composition-root lifecycle coordinates bounded discovery and work; feature modules retain job semantics. Pages advance despite one tenant's failure. Ticks cannot overlap the same in-flight batch. Retries have a fixed ceiling on cadence and concurrency, and shutdown stops admission and drains admitted work. Readiness must reflect essential discovery/job failures rather than accepting a success from another tenant as global health. The implemented cadence and bounds are recorded below; no measured production capacity is claimed.

**Alternative considered:** an operator-managed per-Organization binding file with hot reload. It could reuse existing Person/Admin checks without a migration, but would require coordinating provisioning and revocation with a separate configuration source. The durable binding is recommended because post-startup discovery, revocation and audit ownership stay in the existing authoritative database. Neither option authorizes selecting the bootstrap actor for another tenant without an explicit grant.

## Job inventory and scope

| Work | Current production wiring | BA-05 boundary |
|---|---|---|
| Scheduled Injects | Bootstrap Organization; immediate start and 1 s ticks; 50 due Sessions per run | Discover all authorized Organizations; preserve claims, lifecycle and Epoch checks |
| Export retention | Bootstrap actor/Organization; initial 30 s delay then daily; one in-flight run; not drained at shutdown | Per-tenant authorized actor, bounded backlog progress, failure visibility and drain |
| Floor revocations (BA-04) | Bootstrap Organization; 250 ms ticks; bounded channel/effect batches | Include every eligible Organization without granting publish rights |
| Form attachments (BA-06) | Explicit Admin call/test only | Reuse discovery later; attachment policy changes remain BA-06 |
| Runtime delta outbox (BA-07) | Publisher exists without production timer | Reuse discovery later; delivery semantics remain BA-07 |
| Evidence checkpoints (BA-10) | Signer/anchor function exists without production timer | Reuse discovery later; signing custody/anchor approval remains BA-10 |

## Acceptance and evidence

The registered database harness imports `apps/server/test/tenant-jobs.integration.mjs`. Its actual child process is `deploy/compose/profile-service.mjs`; it never invokes Inject, retention or Floor workers directly. Fixtures use synthetic Organizations, accepted scheduling receipts, due deadlines, report bytes and a TLS provider stub. Controlled SQL deadlines and test-only child clock advancement avoid waiting daily/readiness windows.

| Acceptance | Result | Observed evidence |
|---|---|---|
| BA-05-T01 | **PASS** | Bootstrap due Inject fires; a second Organization provisioned and explicitly enrolled after startup fires automatically. Duplicate production processes produce one release event per Inject. |
| BA-05-T02 | **PASS** | Expired bytes for both Organizations are purged by their own selected actors. A held export remains intact. Cross-tenant actor substitution is denied; revoked workforce authority preserves due bytes until restored. |
| BA-05-T03 | **PASS** | Discovery crosses a 10-binding page; one revoked actor does not starve a later tenant. No binding, suspended Organization, wrong Deployment and disabled authority remain ineligible. Stale binding revision is rejected. Restart preserves revocation and resumes valid work. Invalid bootstrap authority does not block other tenants. Readiness failure and recovery follow complete sweeps. SIGTERM handler waits for an admitted provider disable; overlapping ticks make one provider call and acknowledge it before exit. |

The same production entrypoint reconciles an additional Organization's expired Floor Lease through the installed LiveKit SDK and synthetic TLS provider after restart. This proves worker integration and request semantics, **not actual browser/media enforcement**. Real provider/browser enforcement retains the scope of [BA-04](BA-04-floor-revocation.md); deployed multi-Organization coverage remains BA-11. Windows integration uses IPC to invoke the production SIGTERM handler; it does not claim a real Windows POSIX signal.

## Configured bounds and authority evidence

- Discovery: page size **10**, **2** Organizations admitted concurrently, one in-flight page, **250 ms** ticks. Fixed **5 s** discovery/bootstrap retry. The dedicated worker pool permits **4** connections, **5 s** acquisition, **10 s** statement and **12 s** query timeouts. Per-tenant failures advance the cursor.
- Retention: **10,000** artifacts per transaction, **90-day** export retention, a database advisory claim, and a durable database-clock deadline. Enrollment is immediately due; success schedules **24 h** later, or the next discovery visit when backlog remains. Purge, deadline and audit commit together. Failures retain due work. Audit-table read restrictions stay intact.
- Existing feature bounds remain: Injects **50** Sessions / **100** Injects per Session; Floor **20** channels, versioned provider obligations and **5 s** provider timeout. Shutdown aborts queued Session/channel work and drains admitted effects before closing pools.
- Readiness retains the **60 s** startup grace, then requires a complete healthy sweep within **60 s**. Failure categories are bounded and contain no Organization/participant identifiers; the existing operations alert contract now pages on `organization_jobs_*` failures.
- Migration 045 grants Deployment-scoped **SELECT only on binding metadata**. Real app-role tests show that discovery grants neither business-record reads nor cross-tenant writes. Jobs recheck active lifecycle, workforce/Admin membership and binding revision inside tenant transactions. Session workers retain Deployment/Epoch fencing. `organization.jobs_configured` records explicit enrollment/revocation; no new identity or global bypass exists.

These are implementation bounds, not measured deployment throughput. The synthetic correctness test is not a tenant-scale capacity measurement. BA-11 must validate sweep latency for the deployed tenant population; BA-12's existing voice p95 blocker remains unchanged.

## Verification

All commands ran from `C:\Users\ssnguna\Local Sites\Plenum` with Node **24.22.1**, the root lockfile, and synthetic fixtures only. PostgreSQL **18.6**, SeaweedFS **4.48**; smoke image runtime Node **24.22.0**. [Candidate hashes](../../test-results/ba05/candidate.json) and [preflight](../../test-results/ba05/preflight.json) identify this worktree.

| Command ID | Command | Result / exit | Duration | Evidence |
|---|---|---|---|---|
| CMD-PLATFORM-TYPECHECK | `npm run typecheck` | **PASS / 0** | 14.00 s | [typecheck.json](../../test-results/ba05/typecheck.json), [log](../../test-results/ba05/typecheck.log) |
| CMD-PLATFORM-TEST | `npm test` | **PASS / 0** | 10.97 s | [unit.json](../../test-results/ba05/unit.json), [log](../../test-results/ba05/unit.log) |
| CMD-PLATFORM-INTEGRATION | `npm run test:integration` | **PASS / 0** | 126.15 s | [integration.json](../../test-results/ba05/integration.json), [log](../../test-results/ba05/integration.log) |
| CMD-DEPLOYMENT-SMOKE | `npm run test:deployment` | **PASS / 0** | 48.35 s | [deployment.json](../../test-results/ba05/deployment.json), [log](../../test-results/ba05/deployment.log) |
| CMD-OBSERVABILITY-CONTRACT | `npm run validate:observability` | **PASS / 0** | 0.86 s | [observability.json](../../test-results/ba05/observability.json), [log](../../test-results/ba05/observability.log) |
| CMD-PLATFORM-LINT | `npm run lint` | **PASS / 0** | 5.46 s | [lint.json](../../test-results/ba05/lint.json), [log](../../test-results/ba05/lint.log) |
| CMD-GAP-AUDIT | `npm run audit:product-completeness` | **PASS / 0** | 1.06 s | [continuity.json](../../test-results/ba05/continuity.json), [log](../../test-results/ba05/continuity.log) |

Unit/contract: **164/164**. Integration: **45/45**, including BA-05 T01-T03, earlier BA-01-04 regressions, tenant isolation, retention/archive, claims, receipts and provider failure tests. Deployment: **6/6**, plus offline Session completion, across cloud/institutional/air-gapped profiles. Observability: **8 alerts / 4 panels**. Lint: **134 sources / 52 contracts**. Continuity: **240 obligations**, structural verification only.

The first full integration run failed an older assertion matching retention error text; it now asserts the canonical `ACCESS_REVOKED` code. [Original failure](../../test-results/ba05/integration-first.log) and [command record](../../test-results/ba05/integration-first.json) are retained. Focused development runs also caught fixture constraints/TLS requirements and a real implementation error: audit records cannot be read by the app role. The retention cursor was moved onto the job binding instead of widening audit permissions. A protobuf assertion now decodes the installed SDK's default-false field rather than assuming false appears literally in JSON. No acceptance timeout was increased or test skipped.

## Compatibility, operations and recovery

Migration **045** is additive and must precede this application. No Package, Release, receipt, event or Session schema is rewritten. The new Admin GET/PUT endpoint is registered in the current OpenAPI contract and inherits JSON/Origin protections. The explicitly configured bootstrap actor is enrolled only when no binding exists; additional Organizations require their own active Admin authorization. No environment-variable expansion or new service/datastore is introduced.

Drain old application instances before relying on binding revocation: older timers ignore it and cover only the bootstrap Organization. Preserve 045, audit history and job deadlines on rollback; prefer a reviewed forward-fix. Portable archives deliberately do not transfer Deployment authority; reauthorize locally after restore. Changing an Organization binding does not transfer Session Authority. [Deployment procedure](../operations/DEPLOYMENT.md#organization-scheduled-work-ba-05) and [runbook](../operations/PS-810-OBSERVABILITY-SECURITY.md#organization-scheduled-work) cover enrollment, actor ownership, failures and shutdown.

## Workspace and continuity

Started clean at `86b4c464eeff9f3537f76ed238d09b07ca591aeb` on `main`; proposed branch/subject remain proposals. Changes are confined to binding persistence/authorization, existing worker modules, composition, contracts, tests and operations/evidence records. The original build audit remains unchanged. No dependency, service, UI, production operation, commit, push or deployment was added.

Initial disk preflight observed **170,280,083,456** free bytes. [Resource inventory](../../test-results/ba05/resources.json) records exact fixture IDs; [database inventory](../../test-results/ba05/databases-final.json) records eleven synthetic databases and no remaining application connections. PostgreSQL and SeaweedFS used tmpfs and loopback-only ports. One failed SeaweedFS launch split dotted PowerShell flags; its replacement used literal arguments. The permission reviewer also timed out once before container creation; the permitted retry succeeded. All three exact task-owned container IDs were removed after verification; cleanup is recorded in [cleanup.log](../../test-results/ba05/cleanup.log). The local smoke image `plenum-platform:ba05` remains as a verification artifact. No broad pruning or unrelated resource changes.

PS-830 owner-reported acceptance, PS-840's checkpoint exception, PS-842 decisions and PS-850 release obligations retain their existing scope. PROJECT_STATE, PRODUCT_COMPLETENESS_MATRIX, the existing completeness ledger and migration register link this evidence.

**Next: BA-06.** Attachment retention (BA-06), outbox delivery (BA-07) and checkpoint signing (BA-10) remain owned by their feature modules and are not wired here. BA-11 still owes deployed multi-Organization proof. Actual provider/browser tests and load tests were **NOT RUN for BA-05**; no new media enforcement or capacity claim is made.

## CI browser setup follow-up - 2026-11-11

The initial attempt and retry of [Platform CI run 43034123502](https://github.com/Teludens-Lab/Plenum/actions/runs/43034123502), commit `68dfc7e80d402e5fa8ac076b8ec113f44ae14f2f`, failed before browser assertions. Both product/accessibility jobs on runner image `ubuntu-26.04` / `20261101.186.1` failed `npx playwright install --with-deps chromium`: apt could not resolve `azure.archive.ubuntu.com`, `archive.ubuntu.com` or `security.ubuntu.com`, exiting 100. [Hosted log extract](../../test-results/ba05-ci/hosted-failure-extract.log). Repeating the same workflow did not repair that setup dependency.

Only the browser matrix now runs in the [official Playwright image](https://playwright.dev/docs/docker), `v1.64.1-noble`, pinned to amd64 digest `sha256:ee15712262f017b8157421b212b12099146645f44b1bc5c0514cbbe6a229b1d0`. Its preinstalled browsers/system libraries replace apt bootstrap; the image version matches the root lockfile. `setup-node` retains Node **24.22.1**, PostgreSQL uses the container-network hostname `postgres`, and both existing suites remain blocking with unchanged timeouts. The existing `CMD-SECURITY` contract guards version matching, service networking and absence of bootstrap/bypass steps. No application, schema, dependency, authorization or test-expectation change.

Local checks use that exact image, Node **24.22.1**, npm **11.19.1**, PostgreSQL **18.6**, a copied worktree at `/work`, and isolated synthetic databases `plenum_a11y` / `plenum_product`. The image's default Node 26 is not the tested runtime. [Locked install](../../test-results/ba05-ci/npm-ci.log) succeeded without installing OS packages or browsers. [Resource identities](../../test-results/ba05-ci/resources.log) identify the two task-owned containers and network. The initial manual Node extraction used xz, unavailable in this image; gzip succeeded without adding packages.

The Windows security check initially failed because `bash` selected the WSL launcher. Rerunning with the already-installed Git Bash first on PATH and TLS verification enabled passed **8/8**, with zero dependency vulnerabilities: [final log](../../test-results/ba05-ci/security-final.log), [command record](../../test-results/ba05-ci/security-final.json). The [first failure](../../test-results/ba05-ci/security.log) is retained; no product or test changes were needed for that local shell issue.

| Check | Result / exit | Duration | Evidence |
|---|---|---|---|
| `CMD-PLATFORM-A11Y`: `npm run test:a11y` in the pinned image | **PASS / 0**, 11/11 | 180.38 s | [log](../../test-results/ba05-ci/a11y.log), [command](../../test-results/ba05-ci/a11y.json) |
| `CMD-PRODUCT-E2E`: `npm run test:e2e:product` in the pinned image | **PASS / 0**, 39/39, including real sibling-origin cookie and synthetic OIDC flows | 342.91 s | [log](../../test-results/ba05-ci/product.log), [command](../../test-results/ba05-ci/product.json) |
| `CMD-SECURITY`: `npm run test:security`, Windows / Git Bash | **PASS / 0**, 8/8; zero vulnerabilities | 51.77 s | [log](../../test-results/ba05-ci/security-final.log), [command](../../test-results/ba05-ci/security-final.json) |
| `CMD-GAP-AUDIT`: `npm run audit:product-completeness`, Windows | **PASS / 0**, 240 obligations; structural check | 0.92 s | [log](../../test-results/ba05-ci/continuity.log), [command](../../test-results/ba05-ci/continuity.json) |

[Candidate hashes](../../test-results/ba05-ci/candidate.json), [runtime versions](../../test-results/ba05-ci/runtime.log) and [browser artifacts](../../test-results/ba05-ci/playwright/) identify the local run. Both exact task-owned containers and the network were removed after verification: [cleanup](../../test-results/ba05-ci/cleanup.log). PostgreSQL used tmpfs; no unrelated Docker resources were changed. The pinned image remains cached locally. The original hosted failures remain **FAIL**; they did not reach the tests.

Hosted execution of this changed workflow remains **NOT RUN** until committed/pushed. The GitHub connector returned HTTP 403 for the earlier rerun request; this patch does not change repository permissions. No commit, push or deployment was performed. Registry/image availability remains an external setup dependency. Existing BA-05 authority evidence and BA-11/12 release limitations above remain unchanged.
