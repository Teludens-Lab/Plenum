# PS-820 verification index

Recorded: 2026-11-07\
Candidate: `43284c3e7ba39f0431d7a4398c19c50ad7dc8b45` plus the listed working-tree changes\
Environment: Windows, Node `v24.22.1`, npm `11.19.1`, Docker, PostgreSQL `18.6-alpine`, SeaweedFS `4.48`, Playwright `1.64.1` Chromium\
Decision: **AUTOMATED PASS / HUMAN DESKTOP ACCEPTANCE NOT RUN**

PS-820 proceeded under the Product Owner's explicit prerequisite exception after PS-815 internal acceptance passed. Deferred PS-810/PS-815 provider evidence was not counted as PS-820 evidence and is not a failure of this install/recovery phase.

## Acceptance evidence

| Gate | Result | Evidence |
|---|---|---|
| Node preflight | PASS | Node `v24.22.1`; npm `11.19.1` |
| TypeScript | PASS | `npm run typecheck` |
| Build | PASS | Candidate Runtime and Studio production builds |
| Unit and contract regression | PASS | `npm test`; 130/130 |
| Contract lint | PASS | `npm run lint`; 90 sources and 44 versioned contracts |
| Clean install and upgrade | PASS | `npm run test:clean-install`; 77.4s; prior image migration 038, forward-fix 039/040, representative data preserved, prior-image compatibility retained, current shell reached on all three profiles; `test-results/clean-install/ps-820-clean-install.json` |
| Deployment smoke | PASS | `npm run test:deployment`; 6/6; `test-results/deployment/ps-530-smoke.json` |
| Air-gapped operation | PASS | `npm run test:airgap`; 9/9; no-egress/rootless/read-only controls and local Plugin execution; `test-results/airgap/ps-220-airgap.json` |
| Backup and restore | PASS | `npm run test:backup-restore`; RPO 1s, RTO 6s, one object restored, one Evidence chain verified; `test-results/recovery/ps-530-restore.json` |
| Independent Evidence verification | PASS | `npm run verify:evidence`; 6/6 including tamper, omission, reordering, rotation and separate-custodian evidence |
| Desktop automated accessibility | PASS | `npm run test:a11y`; 11/11 in 8.0m; keyboard/Axe journeys plus managed-device `ACCESS_REVOKED` cache clearing |
| Structural completeness audit | PASS | `npm run audit:product-completeness`; 228 obligations and deliberate omission check |
| Promptbook validation | PASS | `npm run validate:promptbook`; 49 tasks, REQ 94/94, INV 28/28, no dependency cycles |
| Patch whitespace | PASS | `git diff --check` |
| Qualified Windows/macOS keyboard and screen-reader review | **NOT RUN** | Complete `docs/design/user-test/PS-820-script.md`; mobile/touch is N/A |
| Named tester, witness and approving owner | **NOT RUN** | Required for PS-820 change-level acceptance |

The first backup/restore invocation failed before the test because the disposable SeaweedFS container had an invalid bind option. The corrected repository-aligned `-ip=storage` launch became healthy and the complete recovery command passed. The failed infrastructure invocation is not acceptance evidence.

## Decision and next action

All executable automated PS-820 gates pass. PS-820 is not yet change-level accepted because the qualified human desktop accessibility record and named approval are `NOT RUN`. No production system, identity, provider, credential or data was used. All PS-820-created disposable containers were removed.
