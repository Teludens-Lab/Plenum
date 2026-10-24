# Release gates

`MILESTONE_GATES.md` controls phase exits. This file is the final go/no-go checklist assembled by PS-550. A blank, FAIL, BLOCKED, or NOT RUN required item is a no-go unless an authorized owner records a risk acceptance permitted by governing policy.

| Gate | Required evidence | Owner/status |
|---|---|---|
| Product scope | Roadmap section 12 MVP items demonstrated; exclusions preserved | OPEN-001 owner / Pending |
| Decision authority | Required DEC confirmations, ADR approvals, and OPEN resolutions linked | Product/architecture / Pending |
| Contract-first | Requirements, entities, contracts, transitions, auth, errors, analytics and tests approved | Cross-functional / Pending |
| Functional | AC-01..13 plus applicable SYNC/VOTE/VOICE/EXT/DB suites PASS | Engineering/QA / Pending |
| Parity | AC-09 against official commit `ae5d5065bc04a53631815b1b1715a54e21e3ef5b`; approved waivers only | Product/QA / Pending execution |
| Authorization/privacy | Tenant and Session denial, projection omission, consent, secret-ballot privacy | Security/privacy / Pending |
| Plugin trust | Signature/provenance/permissions/isolation/approval/air-gap evidence | Security / Blocked by OPEN-029 |
| Data/migration | PostgreSQL 18, expand/backfill/switch/contract, compatibility, forward-fix | Data owner / Pending |
| Recovery | Backup creation, isolated restore, integrity verification, measured RPO/RTO | Operations / Pending |
| Accessibility | Keyboard, focus, semantics, contrast, zoom/reflow, errors, reduced motion | QA/accessibility / Pending |
| Performance | Named hardware/load, workload, percentile/error/saturation evidence against approved target | Targets approved; PS-545 must remediate the PS-540 command/Floor failures and complete three clean acceptance runs |
| Deployment | Hosted, managed LAN, fully disconnected; clean install/upgrade/rollback where supported | Operations / Pending |
| Air gap | Network-deny run with complete dependency and asset bundle | Operations/security / Pending |
| Observability | Scrubbed structured logs, metrics, correlation and actionable failure diagnosis | Operations / Pending |
| Operational readiness | REQ-069 checklist completed for planned Session | Session operator / Pending |
| Supply chain | Lockfiles, licenses, vulnerability/secret scans, provenance and release manifest | Release/security / Pending |
| Evidence package | Roadmap section 13 categories, responsible owners, immutable artifact references | QA / Pending |
| Defects | No required-gate failure or unresolved severity-1 defect; lower risk disposition recorded | QA/product / Pending |
| Rollback/recovery | Previous-version redeploy, feature disablement, data forward-fix/restore rehearsed | Operations/data / Pending |
| Final approval | Objective packet signed by authorized owner | OPEN-001 / Pending |

## Decision rule

PS-550 may report engineering gates complete but cannot self-approve release. Recording/transcription requires OPEN-027 resolution, secret ballots require OPEN-028 resolution, and production Plugins require OPEN-029 resolution. These capabilities may be implemented and tested in controlled environments while their production gates remain closed.
