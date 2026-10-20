# Release readiness

This is a maturity view, not a release declaration. Current status is derived from the corpus status tables, the v0.2.0 slice record, and promptbook-generation checks on 2026-10-17.

## Maturity matrix

| Capability | Design specified | Implementation started | Tested locally | Integrated | Security reviewed | Performance verified | Deployment verified | Release approved |
|---|---|---|---|---|---|---|---|---|
| Product and contracts | Yes | N/A | N/A | N/A | Partial | No | No | No |
| Reference authority slice | Yes | Yes, spike | Partial: unit/syntax now; historical HTTP/DB | No | No | No | No | No |
| Platform kernel / S1 | Yes | Slice only | Partial | No | No | No | No | No |
| Fractured Order from Release | Yes | Partial reference | Partial reference | No | No | No | No | No |
| Studio collaboration / S3 | Yes | No evidence | No | No | No | No | No | No |
| Extension Framework | Yes | No evidence | No | No | No | No | No | No |
| Voting and Certification | Yes | No evidence | No | No | No | No | No | No |
| Voice Channels | Yes | No evidence | No | No | No | No | No | No |
| Offline Participants / S2 | Yes | No evidence | No | No | No | No | No | No |
| Evidence/reporting / S5 | Yes | Partial slice | Partial reference | No | No | No | No | No |
| Deployment profiles / S6 | Approved architecture; specialist sign-offs pending | Slice container config | No current daemon | No | No | No | No | No |
| Load/reliability / S7 | Targets partly open | No evidence | No | No | No | No | No | No |

## Current objective evidence

- PASS: slice `npm test`, 12/12, rerun during generation on Node 22.16.0.
- PASS: JavaScript syntax checks for slice source/test scripts on Node 22.16.0.
- Historical PASS from the slice record: 31 HTTP smoke, 7 database checks, and PostgreSQL 16 migration on 2026-10-17.
- NOT RUN now: PostgreSQL checks because the Docker daemon was unavailable.
- NOT RUN: Node 24 floor, PostgreSQL 18, browser, accessibility, offline, load, air-gap, security review, backup/restore, and supported deployment verification.
- Constraint: Node 22 is below the declared Node 24 minimum, so current PASS results do not satisfy PS-001.

## Release blockers

- OPEN-001 approver roles; OPEN-002 was resolved by Product Owner approval on 2026-10-20, while named specialist sign-offs remain.
- Fractured Order classification and AC-09 parity evidence against the official pinned snapshot; OPEN-003 source identity is resolved.
- Decision Register section 3 Assumed decisions that affect release behavior.
- OPEN-027 recording/transcription consent, OPEN-028 secret-ballot custody, and OPEN-029 Plugin trust.
- Missing complete evidence across Roadmap section 13 categories and REQ-069 operational readiness.
- No performance evidence against named hardware/loads and unresolved OPEN-019 targets.

## Honest claim boundary

The promptbook is generated and may be structurally valid even though the application is not built. A task may be PASS without its phase or release being approved. Only PS-550 assembles the go/no-go package; an authorized owner must still approve release.
