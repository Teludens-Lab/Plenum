# PS-500 verification

Date: 2026-10-23. Status: **implementation complete; change-level GO; OPEN-014/015 policy resolved; production enforcement and device accreditation still required**.

## Delivered behavior

- `sync-bootstrap-v1` derives the registered device, Participant, Seat Assignments, Active Role Context, control-role status, Authority deployment/epoch, access revision, active Governing Release, credential expiry, policy/projection versions and offline allowlist from trusted server state.
- `offline-outbox-v1` durably records permitted Commands before the UI reports saved-on-device. It preserves Command IDs, aggregate IDs, expected versions, Governing Release, role context and payload values across page closure.
- The React Runtime stores a minimized projection and outbox as AES-256-GCM ciphertext in IndexedDB with a non-extractable device key. Contract, Session, device, Participant and role scope are checked; corruption clears the protected cache.
- Reconnect processes create/edit/submit dependencies in order, looks up each original Command Receipt before retry, submits an unchanged envelope only when no receipt exists, removes accepted entries, and retains rejected or `needs_reconciliation` payloads for editing.
- Local `local_pending` status is distinct from canonical server outcomes. Expired credentials remove the cached Session view, retain encrypted drafts, and block queueing/submission until re-authentication.
- The fixed baseline allows `artifact.create`, `artifact.edit`, `artifact.submit`, and `ballot.cast` for non-control roles. Control, adjudication, Stage, Session, Release Activation, voice, Floor, composition and Approval operations remain live-only.

The security boundary, residual stolen-device risk, recovery behavior, and authoritative allowlist pointer are in `docs/ps-500-offline-threat-model.md`.

## Acceptance evidence

| Acceptance / evidence ID | Result | Evidence |
|---|---|---|
| `AC-11`, `SYNC-04`, `SYNC-05` | PASS | Chromium queues an Artifact offline, labels it local pending/not submitted, verifies raw IndexedDB does not contain the draft or operation type, closes the page, reconnects, recovers/submits the original Command once, and reloads the authoritative Artifact. |
| `SYNC-08`, `SYNC-09` | PASS | Unit tests preserve unchanged IDs/versions, dependency order and canonical `INCOMPATIBLE_RELEASE` reconciliation; existing activation browser/integration coverage remains green. |
| `SYNC-10` | PASS | The offline projection removes Messages, Injects, voice data, ineligible/closed Ballots, management, tally and certification content; wrong-role cryptographic scope fails. |
| `SYNC-11` | PASS | Revoked authentication rejects bootstrap; security outcomes clear controllable cache. Existing duplicate/reordered delta convergence remains green. |
| `SYNC-14` | PASS | Server bootstrap returns trusted authority/access/expiry metadata and records device offline metadata; device time remains observational. |
| `SYNC-16` | PASS | A Ballot queued while offline and received after Poll closure is canonically rejected as `DEADLINE_EXPIRED`; its local payload remains editable. |
| `SYNC-17` | PASS | Fixed-policy tests exclude control, Stage, Session, voice, Floor, composition and Approval operations. Chromium verifies an offline Effect Approval creates no Offline Outbox and is not replayed. |
| Duplicate reconnect commits once | PASS | Browser proof queries one matching Artifact row after reconnect/reload; command-kernel replay tests return one evidence sequence and the original receipt. |
| Unauthorized / revoked role | PASS | Real PostgreSQL test rejects bootstrap after authentication revocation; control-role bootstrap returns an empty allowlist; changed role scope cannot reuse the prior outbox. |
| Stolen-device / other-role leakage | PASS within browser-storage boundary | Raw-storage, minimized-projection, scope-mismatch and corruption tests pass. Resolved OPEN-014/015 restricts production offline use to managed single-user devices and disables high-security browser offline use without TPM/OS-keystore protection; those deployment controls are not yet evidenced. |

## Verification

Environment: repository root; Node 24.19.0; npm 11.19.1; PostgreSQL 18.6 in the existing local disposable container; Playwright 1.64.1 Chromium; synthetic fixtures only.

| Gate | Result | Evidence |
|---|---|---|
| `CMD-PLATFORM-TEST` / `npm test` | **PASS**, exit 0, 94/94, about 10 s | All platform unit/contract regressions, including five focused offline tests. |
| `CMD-OFFLINE` / `npm run test:offline` | **PASS**, exit 0, 7/7, about 5 s | `tests/sync/offline/offline-outbox.test.mjs` and sync-client regressions; build included. |
| `CMD-PLATFORM-E2E` / `npm run test:e2e` | **PASS**, exit 0, 21 passed / 1 conditional live-media skip, 8.8 min | Fresh `plenum_ps500_validation` database; artifacts under `output/playwright/ps-150/`. The managed PowerShell runner retained the disposable web-server child after workers completed; stopping that child completed normal Playwright reporting without changing test outcomes. |
| Focused encrypted-storage restart browser check | **PASS**, exit 0, 1/1, 1.5 min | Current build on a fresh disposable database after the final multi-tab key-initialization hardening; the Offline Outbox survived page closure and reconciled one canonical commit. |
| `CMD-PLATFORM-DB` / `npm run test:db` | **PASS**, exit 0, 21/21, 28.4 s test duration | Fresh PostgreSQL database verifies migration 022, trusted bootstrap/control role, revocation and existing atomic boundaries. |
| `npm run lint` | **PASS**, exit 0, about 6 s | Build plus contract lint: 58 sources, 32 versioned contracts, canonical naming and acyclic workspaces. |
| `npm run typecheck` | **PASS**, exit 0, about 9 s | Strict TypeScript check. |
| `npm run build` | **PASS**, exit 0, about 6 s | Server/shared packages and both Vite web applications; the existing >500 kB chunk warning remains non-blocking. |
| `CMD-PROMPTBOOK-VALIDATE` / `npm run validate:promptbook` | **PASS**, exit 0, about 2 s | 31 tasks, REQ 94/94, INV 28/28 and no dependency cycles. |

## Migration and recovery

`apps/server/migrations/022_offline_devices.sql` is an additive expand migration. It adds nullable offline policy/version and bootstrap timestamps to registered devices, plus a coherence check. It performs no backfill, persistent-data rewrite or destructive contraction; older code ignores the columns.

Deploy migration 022 before enabling durable offline participation. Rollback means disabling queueing and rolling application code back while retaining device history and encrypted local drafts for re-authentication or an approved export path. Once browser-store schema 1 is in use, changes must read/migrate it or provide draft export; clearing it without an approved recovery path would lose unsynchronized work. Recovery never rewrites Command Receipts or Evidence Events.

## Files changed

- Contracts and sync policy: `packages/event-contracts/src/index.ts`, `packages/sync-client/src/index.ts`, `scripts/contract-lint.mjs`, `tests/platform/contracts.test.mjs`.
- Runtime client: `apps/runtime-web/src/App.tsx`, `apps/runtime-web/src/offline/storage.ts`, `apps/runtime-web/src/styles.css`.
- Server and data: `apps/server/src/http/runtime-http.ts`, `apps/server/src/sync/runtime-sync.ts`, `apps/server/src/voting/polls.ts`, `apps/server/migrations/022_offline_devices.sql`.
- Tests and fixtures: `tests/sync/offline/offline-outbox.test.mjs`, `apps/server/test/identity.integration.test.mjs`, `tests/e2e/global-setup.mjs`, `tests/e2e/runtime.spec.mjs`, `package.json`.
- Continuity: `docs/ps-500-offline-threat-model.md`, this record, and the promptbook command, migration, state, readiness and security/recovery registers.

## Remaining release work

- `ADR-001` and `ADR-010` retain their registered status. OPEN-014 and OPEN-015 were resolved by user direction on 2026-10-23. A follow-up must enforce and test the eight-hour absolute authority, 30-day draft retention, managed-device restriction and high-security TPM/OS-keystore rule before production release.
- Browser IndexedDB plus a same-origin non-extractable key is not a high-assurance device keystore and does not provide remote wipe.
- Reconnect load/capacity, institutional device management, production deployment and formal security review were not performed.
- No production environment, credential, tenant or production data was changed. The disposable `plenum_ps500_validation` database was removed after verification; it is not recoverable and is not required for operation.

Next eligible task: **PS-510**.
