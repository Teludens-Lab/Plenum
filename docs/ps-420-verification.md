# PS-420 verification

Date: 2026-10-22. Status: **implementation complete; change-level GO**. The final integration and aggregate browser suites passed on fresh disposable infrastructure after Docker/PostgreSQL recovery.

## Delivered behavior

- A deterministic semantic diff classifies Release changes as safe prospective, compatibility-dependent or consequential and produces a canonical `compatibility-report-v1` digest.
- Authorized Organization and Session Operators can preview affected work, explicitly approve the exact report, and activate through the ordinary Command kernel. Activation, Command Receipt, Evidence Event, outbox record, audit record and immutable review link commit atomically.
- Existing Artifacts, open Polls, Workflow Instances and in-flight Model Compositions retain their Governing Release. New work uses the newly activated Release, and ordered activation history reconstructs live state from the initial Release.
- Idempotent replay returns the original activation outcome. A stale Session-aggregate Command receives an explicit reconciliation outcome instead of silently adopting the new Release; Artifact Commands continue under the Artifact's pinned Release.
- The Studio Live Changes panel presents the classification, blocked reasons, affected counts and approval control with keyboard-operable, labeled status/error feedback.
- Security/access topology changes and schema/compiler mismatches remain blocked. Subsequent user approval resolved OPEN-008/012 by making `keep_existing`, new-Session-only disruptive topology and fail-closed cross-version handling the governing rules.

## Acceptance evidence

| ID | Result | Evidence |
|---|---|---|
| `AC-07` | PASS | Impact review is required and bound by digest before activation; existing and new instances retain the expected distinct Governing Releases. |
| `AC-11` | PASS | Stable Command replay is idempotent and stale queued Session Commands return reconciliation. |
| `SYNC-09` | PASS | Browser and integration tests activate a reviewed Release without editing an open Poll or in-flight work. |
| `EXT-15` | PASS | In-flight Model Compositions remain pinned while new work follows the activated Release. |

## Verification

Environment: Node 24; PostgreSQL 18.6; SeaweedFS 4.48; Playwright 1.64.1 Chromium 156.

| Gate | Result | Evidence |
|---|---|---|
| `CMD-PLATFORM-TEST` / `npm test -- --run` | PASS, 89/89 | Classifier boundaries, contracts and existing platform regressions pass. |
| `CMD-PLATFORM-INTEGRATION` / `npm run test:integration` | PASS, 21/21 | Fresh database verifies authorization, immutable review, atomic activation/evidence, replay, pinning, reconstruction and delayed-Command reconciliation. |
| aggregate `CMD-PLATFORM-E2E` / `npm run test:e2e` | PASS, 20 passed / 1 conditional media skip | Studio preview/approval/activation, axe scan, history and pinned live work pass. Screenshot: `output/playwright/ps-150/ps-420-live-release-activation.png`. |
| focused PS-420 browser run | PASS, 1/1 | The new Live Changes journey passed independently before the aggregate rerun. |
| `npm run build` | PASS | Server/shared TypeScript and both web applications compile; the existing Vite chunk-size warning remains. |
| `npm run lint` | PASS | Node 24 build plus contract lint passed across 57 sources and 30 versioned contracts. |
| `npm run typecheck` | PASS | Strict source type check passes. |
| `CMD-PROMPTBOOK-VALIDATE` / `npm run validate:promptbook` | PASS | Node 24 validation passed for 31 tasks, REQ 94/94, INV 28/28 and no dependency cycles. |
| migration 001-021 | PASS | `021_live_release_activation.sql` applies after PS-410 migration 020 on fresh PostgreSQL 18.6 databases. |

## Migration and recovery

Migration `021_live_release_activation.sql` is additive. It creates immutable tenant-scoped compatibility-review records and adds nullable review provenance to Release Activations so legacy activation rows remain valid. It performs no backfill, row rewrite or destructive contraction.

Deploy migration 021 before enabling reviewed activation. Older code ignores the new review relation and nullable columns. Rollback means stopping new activation, rolling application code back and retaining all reviews and activations; recovery uses a forward-fix Release rather than rewriting history. The approved OPEN-008/012 policy keeps in-place security-topology migration and unsupported cross-schema/compiler activation unavailable.

## Remaining release work

- Formal security and manual accessibility review remain pending; the browser flow includes automated axe coverage.
- Production migration rehearsal, backup/restore validation and authorized deployment remain later release-gate work.
- No production environment or production data was changed.
- The two synthetic PS-420 databases and temporary SeaweedFS container were removed after verification; those disposable fixtures are not recoverable and are not required for operation.
