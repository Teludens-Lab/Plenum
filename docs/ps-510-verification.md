# PS-510 verification

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
