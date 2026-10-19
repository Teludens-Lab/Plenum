# PS-230 isolated Plugin effects verification

Date: 2026-10-19. Result: **IMPLEMENTATION PASS; FORMAL SECURITY OWNER REVIEW AND RELEASE APPROVAL PENDING**.

## Delivered

- `@plenum/extension-host` executes a digest-pinned local Plugin in a rootless, read-only, capability-free, no-new-privileges container with no network namespace and bounded CPU, memory, processes, time, temporary storage, and output.
- Composition Runs freeze only allowlisted state inputs plus the deterministic seed. Model Runs retain Plugin, configuration, input, output, environment, Release, attempt, duration, status, and failure provenance.
- Valid Plugin output can only stage Effect Proposals. It cannot access application stores or mutate authoritative state.
- Approval, rejection, and return use the ordinary Command kernel. Approval is bound to the proposal hash, target version, active Release, Authority epoch, reviewer Session Role, and immutable decision reason.
- One accepted approval applies one state transition, one immutable Approval Decision, one effect receipt, one Command Receipt, one Evidence Event, and one outbox record in the same transaction. Retries replay the original receipt; competing or stale decisions do not reapply the effect.
- The Runtime review UI is keyboard-operable, uses semantic controls and live notices, exposes the proposal provenance needed for review, and refuses to queue Approval Decisions while offline.
- Migration `012_extension_runs_approvals.sql`, OpenAPI, shared contracts, the migration/compatibility/security registers, and the operator provenance export cover successful and failed runs. Provenance remains queryable after Plugin revocation.

## Acceptance evidence

| Criterion | Evidence | Result |
|---|---|---|
| EXT-06 / EXT-07 | Frozen snapshots include only mapped state; malformed and timed-out runs record their failure with zero proposals. | PASS |
| EXT-08 / EXT-09 | State is unchanged while a proposal is in review; one valid approval applies through the Command kernel. | PASS |
| EXT-10 | A proposal whose target state version changed returns `STALE_PROPOSAL` and leaves state unchanged. | PASS |
| EXT-11 | The browser refuses offline Approval Decisions instead of creating a local-pending Command. | PASS |
| EXT-17 | Reviewer Session Role filtering denies an otherwise authenticated Participant. | PASS |
| EXT-18 | Concurrent approvals produce one accepted transition; retrying its Command ID replays the receipt. | PASS |
| EXT-20 | Existing designer-authored Stage and artifact automation remains on the normal Command path; the effect gate is scoped only to Plugin Effect Proposals. | PASS |

## Verification

Authoritative compile and automated checks ran in the cached `node:24.22.0-alpine` image. Database integration used a new disposable PostgreSQL 18.6 database. The air-gap workload executed the synthetic Plugin inside its own pinned Node 24.22.0 container.

| Check | Result |
|---|---|
| Lockfile install (`npm ci --ignore-scripts`) | PASS; 99 packages audited, 0 vulnerabilities |
| `CMD-PLATFORM-TYPECHECK` | PASS on Node 24.22.0 |
| `CMD-PLATFORM-BUILD` | PASS on Node 24.22.0 |
| `CMD-PLATFORM-LINT` | PASS; 28 sources, 17 versioned contracts |
| `CMD-PLATFORM-TEST` | PASS, 36/36 on Node 24.22.0 |
| `CMD-PLATFORM-DB` | PASS, 10/10 on Node 24.22.0 / PostgreSQL 18.6 |
| `CMD-PLATFORM-INTEGRATION` | PASS, 11/11 on Node 24.22.0 / PostgreSQL 18.6 / SeaweedFS 4.48 |
| `CMD-AIRGAP` | PASS, 6/6; includes actual rootless/read-only/no-egress Plugin execution |
| `CMD-PLATFORM-E2E` | PASS, 8/8 on the local Node 22.16.0 launcher / Chromium; the PS-230 offline and approval path passed |
| Focused PS-230 axe browser check | PASS, zero violations |
| Aggregate `CMD-PLATFORM-A11Y` | FAIL, 2/3; the new PS-230 check passed, while a pre-existing PS-210 test depended on state created by the non-a11y suite |

The direct Windows Node 22 typecheck was also blocked by the managed filesystem while resolving the parent user-profile path. It is not authoritative because the repository requires Node 24; the same checkout passed the supported Node 24 typecheck above.

## Migration and recovery

- Forward: apply migration 012 after 011 before enabling composition starts or Effect Proposal endpoints.
- Disable/forward-fix: stop new composition starts and reviews, then redeploy the prior application. Older code ignores the additive tables.
- Never delete or rewrite Composition Runs, Model Runs, proposals, decisions, receipts, or linked evidence during rollback. Pending proposals remain non-authoritative and may be returned or marked stale after service recovery.
- Full packaged deployment recovery, backup/restore, and extension load testing remain PS-530/PS-540 responsibilities.

## Residual risk

- Formal Security Owner review of the isolation profile is still required before release approval.
- Python/native targets, auto-approval, external-required execution, catalog/composition authoring UI, and production key/recovery procedures were deliberately not added.
- The aggregate accessibility command has a pre-existing test-isolation defect even though the new PS-230 flow and full browser suite pass.
