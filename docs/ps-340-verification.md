# PS-340 verification

Date: 2026-10-21. Status: implementation evidence, not release approval.

## Outcome

Migration `017_session_access.sql` adds tenant-scoped Session access configuration, Session Operators, Release-materialized Seats, hashed and expiring Invitations, join and roster-review queues, Guest and read-only Display Principals, and version-bound readiness checks. `session-onboarding-v1` mutations and the `readiness-v1` projection use the existing Command kernel so the state change, receipt, Evidence Event, and transactional outbox remain atomic.

The Runtime operator console now exposes verified Invitations, waiting-room admit/reject, explicit Participant assignment and reassignment, ambiguous roster rows, Seat occupancy, and the readiness/open gate. Session codes do not bypass authentication or admission. Self-service Seat claims require an admitted join request; all post-configuration administrative actions require an active Session Operator assignment.

## Environment

- Host launcher: Node.js 22.16.0 and npm 10.9.2. This is below the repository's Node 24 floor, so the browser and command results are implementation evidence but not supported-stack release approval.
- PostgreSQL 18.6 in a disposable local container, with a separate empty database for each integration, E2E, and accessibility run.
- SeaweedFS 4.48 disposable S3-compatible service for the aggregate integration gate.
- Playwright 1.64.1 with local Chromium 156.

## Required validation evidence

| Reference | Command | Result | Evidence |
|---|---|---|---|
| `CMD-PLATFORM-TEST` | `npm test` | **PASS**, exit 0, 72/72 | Shared contracts, compiler, policy, sync, Runtime and Studio unit regressions; about 28 seconds including build |
| `CMD-PLATFORM-INTEGRATION` | `npm run test:integration` | **PASS**, exit 0, 16/16 | `AC-03`, `PS-340-T01`, and `PS-340-T02`; real Pg18 RLS, Invitation hashing/expiry and replay, admission, Session Operator denial, exclusive-Seat race, atomic reassignment, Guest expiry/revocation, stale readiness/open denial, plus real S3; about 30 seconds |
| `CMD-PLATFORM-E2E` | `npm run test:e2e` | **PASS**, exit 0, 13 passed / 1 intentional live-SFU skip | Unauthenticated code-only join denied; Participant readiness denied; staffing/readiness console rendered; operator axe scan passed; screenshots under `output/playwright/ps-150/`; 3.8 minutes |
| `CMD-PLATFORM-A11Y` | `npm run test:a11y` | **PASS**, exit 0, 7 passed / 1 intentional live-SFU skip | Keyboard, semantic form, axe, responsive and 200% text regressions; 3.4 minutes |

Supporting checks: `npm run typecheck` passed with exit 0; `npm run lint` passed across 48 sources and 26 versioned contracts; `git diff --check` passed. The aggregate E2E gate initially exposed an existing Stage-reorder assertion that checked its peer before the authoritative collaboration acknowledgement. The test now waits for the sender's `saved_on_device` to `synchronized` transition and then applies a bounded peer-convergence wait; the full clean rerun passed.

## Acceptance evidence

- Code without an authenticated Principal returns `401`; a code or Invitation creates only a pending join request and never a Seat Assignment.
- Invalid or incomplete roster rows remain visible in `review` with explicit reasons.
- Two admitted claimants racing for one exclusive Seat produce exactly one accepted assignment.
- Cross-Team reassignment closes and opens assignments in one transaction, increments access and assignment versions, revokes prior projection grants, and records the prior-exposure acknowledgement.
- A Session cannot become `ready` or `open` while a current blocking check, required Seat minimum, Session Operator assignment, governing Release, or assignment version is incomplete/stale.
- Guest access expires server-side and revocation fails closed; Display credentials are read-only, policy-bounded, hashed at rest, and expire after 15 minutes.
- Administrative readiness/staffing data is omitted server-side for Participants.

## Migration, recovery, and limits

Migration 017 is additive except for making `sync.command_receipts.actor_participant_id` nullable so pre-admission and Session Operator Commands can retain Principal attribution without inventing a Participant Seat. The partial unique index for active exclusive Seats scans existing assignments and must be rehearsed against populated data before deployment. Old application code ignores the new tables and columns.

After live use, stop new joining/open transitions and forward-fix; do not drop access, assignment, Audit, Evidence, Invitation, Guest, or Display history. Database restore remains the recovery mechanism for committed state. Invitation and Display plaintext credentials are returned once and are not recoverable from their stored hashes.

Studio save-state semantics and Participant Runtime `local_pending` behavior are unchanged. Operator staffing/open mutations require the live Session Authority and are not queued offline.

`ADR-012`, `OPEN-007`, and `OPEN-025` remain explicitly unratified or unresolved. Identity federation variations under `OPEN-007` still block release approval. Formal security review, supported Node 24 browser repetition, load/capacity, production deployment, backup/restore, and manual assistive-technology review were not performed by PS-340.
