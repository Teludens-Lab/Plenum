# PS-530 verification

Date: 2026-10-23  
Runtime: Node 24.22.1, npm 11.19.1, PostgreSQL 18.6, SeaweedFS 4.48, Playwright 1.64.1 Chromium 156, Docker Desktop on Windows  
Data: synthetic only

## Delivered behavior

- One built application image runs the cloud, institutional, and air-gapped configurations. The image contains the OIDC/API/WebSocket composition root, Runtime and Studio assets, Extension Host code, PostgreSQL recovery utilities, and migrations 001-024.
- Institutional dependencies are digest-pinned: PostgreSQL 18.6, SeaweedFS 4.48, Keycloak 26.8.1, and LiveKit 1.13.10. The air-gapped overlay uses an internal Docker network and local trust endpoints.
- The offline builder archives all five images plus deployment files and runbooks, hashes every artifact, and signs the checksum file with an external Ed25519 key.
- Backup encrypts the PostgreSQL dump, objects, trusted Evidence public keys, and independent-anchor records with AES-256-GCM. Restore refuses non-disposable or populated targets and independently verifies restored Evidence.
- Operator delivery health exposes pending and dead-lettered Runtime deltas. A current Session Operator can return a dead letter to the pending queue; unauthorized and revoked contexts fail closed, and the retry is audited.

## Required validation references

| Reference | Command | Result | Evidence |
|---|---|---|---|
| `CMD-DEPLOYMENT-SMOKE` | `npm run test:deployment` | PASS, 4/4 | `test-results/deployment/ps-530-smoke.json`; image `sha256:b0f3f1cada1b93ff81956d49a02053f8bdebf78ad97866f1cd25fe24e74642ac`, three profiles, real entrypoint started and released Session completed to `stabilized`/`approved` under `--network=none` |
| `CMD-AIRGAP` | `npm run test:airgap` | PASS, 9/9 | `test-results/airgap/ps-220-airgap.json`; rootless/read-only/no-egress execution, local media and Plugin controls |
| `CMD-BACKUP-RESTORE` | `npm run test:backup-restore` | PASS | `test-results/recovery/ps-530-restore.json`; 2-second RPO, 9-second RTO, one object restored byte-for-byte, one signed Session verified |
| `CMD-EVIDENCE-VERIFY` | `npm run verify:evidence` | PASS, 6/6 | Complete, tampered, missing, reordered, rotated-key and separate-anchor cases |

Supporting checks:

- `npm run test:offline-bundle`: PASS; temporary 713,439,744-byte archive, five images, one Ed25519 signature and 13 checksums verified; temporary bundle deleted after verification.
- `npm test`: PASS, 103/103.
- `npm run test:integration`: PASS, 24/24 on a fresh disposable database and object store.
- `npm run test:e2e`: PASS, 21 with one conditional real-media skip in 13.0 minutes; final summary completed. The PS-210 proposal journey initially hit its local 90-second override on this slower run and passed after using the suite's existing 120-second bound.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS across 62 sources and 37 versioned contracts.
- `npm run build`: PASS as part of every command above.

An early integration fixture tried to add and remove synthetic Evidence rows; the append-only trigger correctly refused deletion. The final test instead reuses an existing delivery, restores its original status, and leaves only the required immutable retry Audit Record. An early recovery run also failed safely because Windows workspace links were invalid inside Linux; the image now creates relative in-image workspace links, and the clean rerun passed.

## Data, migration, and rollback

PS-530 adds no migration. The recovery drill applies and restores the complete existing `001`-`024` chain. Code rollback redeploys the preceding signed image set. Schema rollback is prohibited; incompatible data is handled by a reviewed forward-fix. Production restore is not performed by the test script and requires a separate authorized incident procedure.

## Release boundary and risk

PS-530 is implementation-complete and locally verified, but it does not approve production release. In simple terms, the software can package and restore itself correctly in a synthetic isolated environment; it has not proved that a real institution keeps the database, backup site, signing key, and independent anchor under genuinely separate control.

PS-540 addresses measured load, saturation, and failure recovery. PS-550 addresses final security/accessibility release evidence and must verify the real institutional TLS, firewall, KMS/HSM signer, independent custodian, backup location, recovery staff procedure and enforcement of resolved OPEN-009 retention. Resolved OPEN-027/028 keep production recording, transcription and secret ballots disabled for version 1.

