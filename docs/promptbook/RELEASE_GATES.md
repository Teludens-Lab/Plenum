# Release gates

`MILESTONE_GATES.md` controls phase exits. This file is the final go/no-go checklist assembled by PS-550. A blank, PARTIAL, FAIL, BLOCKED, or NOT RUN required item is a no-go unless an authorized owner records a risk acceptance permitted by governing policy.

| Gate | Required evidence | Owner/status |
|---|---|---|
| Product scope | Roadmap section 12 MVP items demonstrated; exclusions preserved | PASS: Sethu Nguna named to the five governing owner roles under resolved OPEN-001 |
| Decision authority | Required DEC confirmations, ADR approvals, and OPEN resolutions linked | PASS for version 1 policy scope: OPEN-001/009/024/027/028 and the OPEN-029 baseline are resolved; implementation evidence remains separately gated |
| Contract-first | Requirements, entities, contracts, transitions, auth, errors, analytics and tests approved | PARTIAL: executable contracts pass; cross-functional production approval NOT RUN |
| Functional | AC-01..13 plus applicable SYNC/VOTE/VOICE/EXT/DB suites PASS | PASS: engineering suites, including deferred AC-07/AC-11, are green |
| Parity | AC-09 against official commit `ae5d5065bc04a53631815b1b1715a54e21e3ef5b`; approved waivers only | PASS: 17/17, no waiver |
| Authorization/privacy | Tenant and Session denial, projection omission, consent, secret-ballot privacy | PASS locally; production privacy-owner approval NOT RUN |
| Plugin trust | Signature/provenance/permissions/isolation/approval/air-gap evidence | PASS for implementation baseline; production key/revocation/recovery procedures NOT RUN |
| Data/migration | PostgreSQL 18, expand/backfill/switch/contract, compatibility, forward-fix | PASS on fresh disposable databases; production upgrade/rollback NOT RUN |
| Recovery | Backup creation, isolated restore, integrity verification, measured RPO/RTO | PASS locally: 3-second RPO, 12-second RTO; institution-owned drill NOT RUN |
| Accessibility | Keyboard, focus, semantics, contrast, zoom/reflow, errors, reduced motion | PASS automated 11/11; manual assistive-technology and captions review NOT RUN |
| Performance | Named hardware/load, workload, percentile/error/saturation evidence against approved target | PASS for PS-545 approved named equivalent; production-institution acceptance external |
| Deployment | Hosted, managed LAN, fully disconnected; clean install/upgrade/rollback where supported | PARTIAL: three reference profiles pass; institutional clean install/upgrade/rollback NOT RUN |
| Air gap | Network-deny run with complete dependency and asset bundle | PASS locally; institution acceptance NOT RUN |
| Observability | Scrubbed structured logs, metrics, correlation and actionable failure diagnosis | PARTIAL: evidence/audit correlation tested; production monitoring and alert response NOT RUN |
| Operational readiness | REQ-069 checklist completed for planned Session | NOT RUN: requires a named Session and operator |
| Supply chain | Lockfiles, licenses, vulnerability/secret scans, provenance and release manifest | PARTIAL: dependency and high-confidence secret scans pass; formal SAST/license/provenance approval NOT RUN |
| Evidence package | Roadmap section 13 categories, responsible owners, immutable artifact references | PASS for PS-550 engineering index; owner signatures absent |
| Defects | No required-gate failure or unresolved severity-1 defect; lower risk disposition recorded | PASS locally: deployment-wide rate limiting and retention enforcement now have fresh-database evidence; external NOT RUN gates still prevent release |
| Rollback/recovery | Previous-version redeploy, feature disablement, data forward-fix/restore rehearsed | PARTIAL: local restore/forward-fix pass; production redeploy exercise NOT RUN |
| Final approval | Objective packet signed by authorized owner | NOT RUN: naming the owner and approving policy scope is not final release approval; recommendation NO-GO |

## Decision rule

PS-550 engineering verification is complete but does not self-approve release. OPEN-027/028 are resolved for version 1 by keeping production recording, transcription and secret ballots disabled. OPEN-029 is resolved for the implementation baseline, while production Plugin key custody, revocation, recovery and operating procedures still require evidence. See `docs/release-evidence/PS-550-index.md` for the NO-GO recommendation.
