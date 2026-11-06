# PS-810 verification index

Recorded: 2026-11-06  
Candidate: uncommitted working tree  
Decision: **ACCEPTANCE PENDING / PRODUCTION NO-GO**

PS-810's bounded implementation is present, but this record does not promote uncommitted or partially verified work. GitHub-hosted, staging, and authorized human gates remain mandatory.

## Local automated evidence

| Gate | Result | Evidence |
|---|---|---|
| TypeScript | PASS | `npm run typecheck` |
| Build and unit/contract suite | PASS | `npm test`: 129/129 |
| Contract lint | PASS | `npm run lint`: 90 sources, 44 versioned contracts |
| Security | PASS | `npm run test:security`: 3/3; secret history/configuration checks and dependency audit |
| AWS deployment package | PASS | `npm run test:aws-plan`: 17/17 |
| Native AWS Terraform | PASS | `terraform init`, `fmt -check`, `validate`, `test`: 1/1 |
| Rendered AWS Compose | PASS | Actual ignored staging variables rendered in memory; `docker compose config --quiet` passed without shell-variable interpolation warnings |
| Observability contracts | PASS | `npm run validate:observability`: seven alerts and four panels |
| Promptbook | PASS | `npm run validate:promptbook`: 49 tasks, REQ 94/94, INV 28/28 |
| Migrations 039/040 and database identity integration | PASS | 34/34 identity integration tests on disposable PostgreSQL 18.6; read-only view and mutation denial verified |
| Deployment smoke | PASS | `npm run test:deployment`: 6/6 across cloud, institutional, and air-gapped profiles |
| Patch whitespace | PASS | `git diff --check` |

## Required evidence not yet run

| Gate | Result | Reason / next evidence |
|---|---|---|
| OCI plan, supply chain, product completeness, product browser, accessibility, disconnected bundle | NOT RUN | These aggregate gates passed before this change but have not been rerun against the current uncommitted candidate. They remain required in CI. |
| GitHub CI, CodeQL, dependency review | NOT RUN | The previous code commit was reported green, but the final PS-810 candidate must retain its exact CI and security run URLs; dependency review also requires pull-request evidence and does not run on a direct push. |
| Staging DAST | NOT RUN | Requires authorized manual dispatch against the allowlisted staging origin. |
| Release artifact attestation | NOT RUN | Requires the exact candidate commit and GitHub-hosted provenance workflow. |
| Staging collector and alert delivery | NOT RUN | The independent `operations-agent` now collects private readiness/metrics, retains 90-day bounded samples and sends through a scoped Postmark receiver; the new image, operations parameter and real delivery still require authorized staging execution. |
| Operational security-evidence reader | NOT RUN | Migration 040 and the bootstrap define `plenum_operations` with SELECT only on the scrubbed evidence view; the live staging login and human query still require deployment evidence. |
| Secret rotation and rollback | NOT RUN | Requires an authorized staging rehearsal using the runbook. |
| Malware outage, clean recovery, and EICAR quarantine | NOT RUN | The shared AWS runtime now health-gates the digest-pinned scanner and wires `CONTENT_SCANNER_*`; the live host must receive the updated rendered Compose file before the controlled test. |
| Human operator acceptance | NOT RUN | Complete `docs/design/user-test/PS-810-script.md` and record tester/owner. |

The source implementation now makes AWS staging testable. The next gate is to publish the candidate image, create the scoped operations parameter, update the existing host in place, and execute the controlled scanner, reader and alert checks. Do not mark those rows `PASS` from checked-in contracts alone.

## Decision rule

Do not mark PS-810 change-level accepted until every required row above is `PASS`, high-severity findings are closed, evidence is bound to the exact commit, and the authorized tester and approving owner are recorded. Production approval remains a later independent decision.
