# PS-510 verification

## BA-10 scheduled checkpoint work — 2026-11-12

Baseline: clean `2e9ace12438221a617126f1f3c63f67ace89411a`, Node 24.22.1/npm 11.19.1, Windows. **Production custody and both live-golden proofs remain BLOCKED.** The owner has an AWS setup but has not identified an approved signing key, trusted public-key distribution or independently controlled anchor. No AWS account was inspected, no production key was created, and no resource was purchased or activated. The original and Energy live Sessions were not modified. Historical PS-830 owner product/desktop AT acceptance and the PS-840 execution exception retain their scope; missing live checkpoint evidence still blocks PS-850.

### Implementation and compatibility

BA-05 now schedules Evidence work for each eligible Organization using its designated current Admin actor, binding revision and active Session Authority Epoch. The feature selects ten due Sessions per tenant pass, with at most 1,000 Events per checkpoint. Due policy remains five minutes, 1,000 Events or Session completion/lock/archive (OPEN-017); no retention or cadence policy is invented. Existing Sessions participate without recreating them. The Organization loop still has two tenants in flight, no overlapping batches and shutdown cancellation/drain.

Migration `048_evidence_checkpoint_work` adds one tenant-RLS operational journal row per Session. It freezes the exact checkpoint before provider I/O, retains a validated public signature before anchoring and removes the work row only with the completed batch/signature/receipt transaction. A pending or failed anchor is never recorded as a completed checkpoint. Each attempt has a 60-second claim with a unique token; late output cannot commit after claim or authority replacement. Effects are bounded to ten seconds each, with one SDK attempt, and failures retry after 5/10/20/40/80/160/300 seconds, capped at five minutes. A lost acknowledgement is reconciled against the same immutable anchor key. No transaction spans external I/O. Failed/remaining work degrades the existing readiness signal; structured errors use `organization_jobs_checkpoints` without keys or protected bodies.

The optional AWS bridge uses the existing Ed25519/SHA-256 checkpoint format, not replacement cryptography: KMS `ED25519_SHA_512` signs the 32 digest bytes as `RAW`. The pinned public JWK is supplied independently, and the service checks the returned signature against it. S3 anchors use a separate bucket/account owner assertion, conditional creation, a fixed Session/starting-sequence object key, seven-year Compliance retention, content equality and a version-specific receipt. These application checks do not establish independent IAM/account ownership; that remains an external deployment gate. Cloud and connected institutional profiles can be configured; air-gapped deployments reject this AWS adapter and still require an approved offline custodian adapter.

Compatibility: authorized `GET /v1/sessions/{sessionId}/evidence/verification` exposes the existing body-free `verification-export-v1` through current Admin and tenant checks. No verification format changes. Separately, logical archives containing pending checkpoint work require `databaseSchema: plenum-048` and carry that journal. Older importers reject that marker rather than silently lose an already signed range. Archives without pending work retain `plenum-042`; new readers retain v1/v2 compatibility. Physical database backups include the journal automatically. Do not down-convert a pending-work archive.

Deploy migration 048 before the application. Existing checkpoint batches/signatures/receipts and Evidence remain unchanged. Stop older checkpoint producers before switching: their internal helper does not know about reserved work. Rollback stops new work and preserves the journal and original proof tables for forward recovery; never delete pending signatures or rewrite Evidence to clear an error. Preserve historical public keys and independently retained anchors across restore and rotation. No production rollout or rollback exercise is claimed.

The only new dependency is pinned `@aws-sdk/client-kms@3.1152.0`, matching the existing S3 SDK. The default SDK credential chain is used; private signing material is never loaded into the application. Required deployed configuration, ownership checks and verification procedure are in [recovery operations](operations/PS-820-INSTALL-UPGRADE-RECOVERY.md#ba-10-evidence-signing-and-anchor-activation).

### Acceptance boundaries

| ID | Status | Actual boundary |
|---|---|---|
| BA-10-T01 | Local production-entrypoint harness PASS; actual custody BLOCKED | The real profile service, database scheduler, KMS/S3 adapters and HTTP export create and verify synthetic checkpoints in two Organizations. HTTPS AWS-protocol fixtures own the synthetic keys and locked-object responses; this is not an AWS/HSM or independent-custodian proof. |
| BA-10-T02 | Local recovery PASS; actual provider recovery NOT RUN | Controlled retry boundaries, frozen ranges with new Events, competing and expired claims, saved signatures, lost anchor acknowledgements, restart, fenced Sessions and portable pending-work restore pass. Missing configuration leaves unsigned work pending and degrades readiness after the existing 60-second startup grace. |
| BA-10-T03 | BLOCKED / NOT RUN | Neither original nor Energy live-golden exports has been checked against approved real keys and independently obtained anchors. Fixture CLI successes cannot close this gate. |

The existing offline verifier tests retain tamper, omission, reordering, key rotation and missing-independent-anchor negatives. New AWS boundary tests reject unexpected signing identity, private JWK material, mutable storage and conflicting stored records. The production test uses automatic scheduling, not direct checkpoint creation calls, for both tenant exports; an external CLI process checks them using separately supplied synthetic public-key and anchor files.

### Verification record

All task evidence is under `output/ba-10/`; commands run at `C:\Users\ssnguna\Local Sites\Plenum`. Synthetic PostgreSQL 18.6, SeaweedFS 4.48 and local HTTPS AWS-protocol fixtures only. `candidate-manifest.json` records final source hashes. The first integration attempt failed two storage-dependent tests because PowerShell split unquoted dotted SeaweedFS flags; it is retained as `integration-initial.log`, not a product or custody PASS. Correcting the disposable container arguments produced 47 PASS / 1 BA-08 environment SKIP in 132.74 seconds (`integration-retry.log`). A stalled SDK download was stopped and a bounded retry succeeded; the first typecheck before installation reported the missing SDK and strict optional signal types, which were corrected.

| Command | Result | Evidence / wall time |
|---|---|---|
| `npm run typecheck` | PASS | `typecheck.log`, 17.04 s |
| `npm run lint` | PASS | `lint.log`, 4.90 s |
| `npm test` | PASS, 174 tests | `unit.log`, 14.22 s |
| `npm run verify:evidence` | PASS, 7 tests | `verify-evidence.log`, 5.91 s |
| `npm run test:backup-restore` | PASS, synthetic physical backup and restore | `backup-restore.log`, 61.16 s; one restored Session verified, observed RPO 2 s / RTO 7 s |
| `npm run test:integration` | Latest full run FAIL: 46 PASS, 1 FAIL, 1 environment SKIP | `integration-verified.log`, 201.98 s; known Command/scheduled-Inject deadlock, detailed below |
| `node --test --test-name-pattern=BA-05-T01 apps/server/test/identity.integration.test.mjs` | PASS, production-entrypoint BA-05/07/08/09/10 case | `production-verified.log`, 40.53 s |
| `npm run audit:product-completeness` | PASS, 240 obligations; required Evidence remains BLOCKED | `audit-product-completeness.log`, 0.58 s |
| `npm run validate:promptbook` | PASS | `validate-promptbook.log`, 0.60 s |

The earlier full integration run passed 47 tests with one BA-08 environment skip (`integration-final.log`, 177.20 s). After adding expired-claim and missing-configuration regressions, the latest full run reproduced the previously recorded BA-09 Command/scheduled-Inject deadlock: a Command holds the Evidence sequence lock while requesting a Session FK lock, while the scheduled Inject holds the Session lock and waits for that sequence. `database-deadlock.log` preserves the database diagnosis. This remains an unresolved BA-11/12 release risk; a focused checkpoint PASS does not clear it. The new expired-claim and archive cases passed in that full run. The subsequent focused run initially failed the readiness assertion because the harness had not advanced past startup grace (`production-focused.log`, 56.80 s); advancing its existing controlled clock corrected the test without changing production readiness policy. The corrected production case then passed. No retry was added to hide the Command deadlock.

Required golden journeys remain BLOCKED by BA-09's genuine Replay gap and the missing live signing custody. Rerunning fixture journeys would not satisfy T03. Next independent work: BA-11 deployment coverage; actual AWS custody setup, independent retrieval and the two live-golden proofs remain release obligations.

### Resource and handoff record

Only task-owned tmpfs containers `plenum-ba10-db` (`d893cf75af4ad8060acd4251fec632e44aa50f5034ce641ca09b9f79f46c0dc0`) and `plenum-ba10-s3` (`cd5bac83034c056f700afd8518b6eb95ba2baeb9285d971a165c4c23b605765e`) were used, then removed after verifying zero other database clients. The initial misconfigured S3 container (`5792b64ccf22ac8bb54dac1d0f83a5eedcba512452b604c93675cb25ffec0734`) was replaced during fixture setup. Disposable databases were `postgres`, `ba10_retry`, `ba10_final`, `ba10_boundary`, `ba10_production`, `ba10_health`, plus harness-created archive databases. The physical recovery pair `plenum_ps530_source_4eace91af1b0` / `plenum_ps530_restore_4eace91af1b0` and corresponding synthetic buckets were cleaned by the recovery harness. Dedicated image `plenum-platform:ba10-restore` (`sha256:a9ac27ca4b6d78a2cd05d9b594f767f846a310e23116c47da88e4fdb3155a3d6`) was removed; unrelated services and images were preserved. Preflight free disk was 164,136,038,400 bytes. Tracked generated evidence was restored from the preflight backup; this run's evidence remains under `output/ba-10/`.

No commit, push, deployment, live AWS call, key issuance or production Session mutation occurred. UI is unchanged; no fresh browser or human AT claim. Actual AWS permission enforcement, independent custodian access and live golden verification remain NOT RUN. The latest broad integration gate remains FAIL because of the recorded deadlock; all passing local checkpoint results are scoped above.

Date: 2026-10-23. Status: **implementation complete; change-level GO; production signer, custodian and full recovery evidence remain required**.

## Delivered behavior

- Canonical `checkpoint-v1` records cover only contiguous Evidence Sequence ranges. Each Checkpoint commits event metadata and a canonical body digest into a SHA-256 Merkle root, then chains to the prior Checkpoint digest.
- `createDueEvidenceCheckpoint` creates at most 1,000 events at a time and becomes due at five minutes, 1,000 events, or Session completion/lock/archive. The database unique key and deterministic Checkpoint identity make a repeated starting range idempotent.
- `EvidenceSigner` and `EvidenceAnchor` are external ports. Only the public verification JWK is stored in PostgreSQL; a signer response containing private JWK material is rejected. The anchor receives only the Checkpoint ID, Session/range, digest, timestamp and signing-key ID.
- Ed25519 signatures and verified Anchor Receipts are stored atomically after both external operations succeed. A custodian failure leaves no partial Checkpoint row.
- Admin-only `verification-export-v1` omits event bodies and exports their hashes, signed Checkpoints, public keys and claimed receipts. Export access is rechecked against the current Authentication Session and membership and is audited.
- The offline verifier requires separately supplied trusted public keys and custodian records. Database receipts alone never pass. It rejects modified, missing, reordered, uncheckpointed, untrusted-key, incorrectly signed and unanchored history, including deletion of the final Checkpoint.
- Historical verification succeeds across key rotation when both old and new public keys remain in the external trust file.

## Acceptance evidence

| Acceptance / evidence ID | Result | Evidence |
|---|---|---|
| `SYNC-13` cadence and persistence | PASS | Boundary tests cover 5:00, 1,000 events and Session close; PostgreSQL integration creates one due signed/anchored Checkpoint and a repeated run with no pending range performs no external call. |
| `PS-510-T01` key rotation | PASS | Two chained Checkpoints signed by distinct Ed25519 keys verify with retained historical public keys. |
| `PS-510-T02` tamper/omission/reorder | PASS | Body-digest modification, event removal, event reorder and final-Checkpoint removal each fail verification. The final-removal case is detected from the independently supplied custodian record even if the export's last-sequence claim is also reduced. |
| Independent anchor required | PASS | Removing the separate custodian input fails every Checkpoint with `MISSING_INDEPENDENT_ANCHOR`; a database receipt cannot establish integrity by itself. |
| Restricted/body-free export | PASS | Current Admin membership is required; a Designer is denied. Exported event proof contains `bodyDigest`, never `body`. |
| Partial external failure | PASS | A synthetic custodian outage after signing leaves zero Checkpoint rows for that Session. |
| Restored offline files | PASS within PS-510 scope | The CLI reads a copied export, external trust-root file and custodian file from a temporary offline directory and verifies the chain end to end. Full database/object-store backup and RPO/RTO restoration belongs to PS-530. |

## Verification

Environment: repository root; Node 24.19.0; npm 11.19.1; TypeScript 5.9.3; fresh disposable PostgreSQL 18.6 database; temporary SeaweedFS 4.48 S3-compatible service; synthetic keys and data only.

| Gate | Result | Evidence |
|---|---|---|
| `CMD-PLATFORM-TEST` / `npm test` | **PASS**, exit 0, 100/100 | Full unit/contract regression, including checkpoint cadence, rotation, tamper, omission, reordering, separate-anchor and CLI round-trip cases. |
| `CMD-PLATFORM-INTEGRATION` / `npm run test:integration` | **PASS**, exit 0, 23/23, 36.5 s | Fresh migration 001-023; real RLS/append-only PostgreSQL path; due Checkpoint, external signing/anchoring, authorization, body-free export, verification and custodian-failure atomicity; S3 regression also passes. |
| `CMD-EVIDENCE-VERIFY` / `npm run verify:evidence` | **PASS**, exit 0, 6/6 | Focused offline verifier and restored-file CLI evidence. |
| `npm run typecheck` | **PASS**, exit 0 | Strict TypeScript diagnostics. |
| `npm run lint` | **PASS**, exit 0 | Build plus contract lint: 59 sources, 34 versioned contracts, canonical naming and acyclic workspaces. |
| `CMD-PROMPTBOOK-VALIDATE` / `npm run validate:promptbook` | **PASS**, exit 0 | 31 tasks, REQ 94/94, INV 28/28, no dependency cycles or warnings. |

The existing Vite warning for a generated chunk over 500 kB remains non-blocking and is unrelated to PS-510.

## Migration and recovery

`apps/server/migrations/023_evidence_checkpoints.sql` is an additive expansion of the existing schema-only Checkpoint tables. It retains public JWKs, enforces one signature per Checkpoint, records the signing-key ID with each Anchor Receipt, prevents duplicate per-endpoint receipts and adds a range lookup index. It stores no private or symmetric signing key.

The `ALTER TABLE` statements take brief locks. Migration 002 explicitly had no earlier signer/anchor producer, so the tested path is empty proof tables. If an institution has populated them out of band, deployment must stop and recover the real historical public keys before applying the new `NOT NULL` columns; fabricating a backfill would destroy the assurance claim.

Deploy migration 023 before enabling the checkpoint worker. Rollback means stopping new Checkpoints and rolling application code back while preserving every existing batch, signature and receipt. Once proof rows exist, use a forward fix; never delete or rewrite them. The CLI proves restored export-file verification, while PS-530 owns the approved RPO <=15 minutes, RTO <=4 hours and full PostgreSQL/object-store restore exercise.

## Files changed

- Contracts: `packages/event-contracts/src/index.ts`, `tests/platform/contracts.test.mjs`, `scripts/contract-lint.mjs`.
- Server/data: `apps/server/src/evidence/checkpoints.ts`, `apps/server/src/index.ts`, `apps/server/migrations/023_evidence_checkpoints.sql`.
- Verification: `tests/evidence/evidence-verification.test.mjs`, `scripts/verify-evidence.mjs`, `apps/server/test/identity.integration.test.mjs`, `tests/e2e/global-setup.mjs`, `package.json`.
- Continuity: this record and the promptbook task, command, dependency, migration, state, readiness and security/recovery registers.

## Remaining release work and plain-language risk

- Current-prompt risk: the code proves that changed or missing evidence is detected, but the tests use synthetic keys and a synthetic custodian. If production put the signer key in ordinary application storage or kept the "independent" anchor beside PostgreSQL, one compromise could alter both sides and create false confidence.
- Future handling: PS-530 must wire and restore-test the institution's actual KMS, HSM or hardware token and genuinely separate custodian under the approved 15-minute RPO / 4-hour RTO policy. PS-550 must review that evidence and make the final production release decision. This risk is therefore **not yet closed for production**.
- PS-520 will build reports/replay on this verified chain; PS-540 will test capacity. Neither replaces PS-530 recovery proof or PS-550 approval.
- No production key, custodian, environment, tenant or data was touched, and no commit or deployment was made.

Next exact task: **PS-520 — Generate traceable reports, research exports, and replay**.
