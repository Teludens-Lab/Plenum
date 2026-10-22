# Release readiness

This is a maturity view, not a release declaration. Current status is derived from the corpus, committed implementation, task-specific verification records, and `PROJECT_STATE.md` as of 2026-10-21.

## Maturity matrix

| Capability | Design specified | Implementation started | Tested locally | Integrated | Security reviewed | Performance verified | Deployment verified | Release approved |
|---|---|---|---|---|---|---|---|---|
| Product and contracts | Yes; Proposed documents are Product Owner Approved | N/A | Promptbook validation PASS | N/A | Partial | No | No | No |
| Reference authority slice | Yes | Yes | PS-001 PASS on Node 24/PostgreSQL 18 | Reference evidence only | Partial controls exercised | No | Disposable only | No |
| Platform kernel / S1 | Yes | Yes | Unit, integration, browser and accessibility evidence PASS | Yes | Negative controls PASS; formal review pending | Limited measurements only | Disposable only | No |
| Fractured Order from Release | Yes | Yes | PS-200/210 checks and PS-350 AC-09 parity PASS | Yes | Formal review pending | One focused information-flow measurement | Disposable only | Phase 3 GO; later release gates pending |
| Studio collaboration / S3 | Yes | PS-300/310/320/330/340 implemented; PS-350 implemented-capability proof complete | PS-350 Node 24.22.0 rerun: unit 77/77, DB 17/17, browser 17 PASS/1 conditional media skip; dedicated real-media 1/1 and parity 17/17 PASS | Collaboration, visual authoring, Publication, Session creation, DEC-42 revision/adjudication, Orientation gating, note isolation/autosave, Control/reconnect, offline Scenario assets, evidence, canonical export reconciliation, admin lifecycle, complete export/archive, PLI, intercom/recorder, and loopback SFU audio are integrated | Boundary, retry, contention, hidden-Artifact probing, rejection, retained logical deletion, project export scope, and consent tests PASS; formal review pending | Two-Designer convergence and loopback SFU audio pass; load remains unmeasured | Disposable only | Phase 3 GO; not production approval |
| Extension Framework | Yes | PS-220/230 complete; authoring UI pending PS-330 | Unit, integration, browser and air-gap evidence PASS | Registry, isolation and approval integrated | Formal Security Owner review pending | Load not measured | Isolated no-egress host only | No |
| Voting and Certification | Yes | PS-240 Runtime and PS-320 Studio editor complete | VOTE-01–10/15 PASS | Yes | Secret production profile blocked by OPEN-028 | Contention/load not measured | Disposable only | No |
| Voice Channels | Yes | PS-250 media/Floor and PS-320 editor/consent proof complete | VOICE-01–07/09/11/13/14 PASS; earlier loopback media PASS | Yes | Production recording/transcription blocked by OPEN-027 | Media capacity not measured | Institutional LAN/TLS/TURN/recovery pending | No |
| Offline Participants / S2 | Yes | Reconnect exists; persistent outbox pending PS-500 | Bounded reconnect replay tested | Partial | Device policy OPEN-014/015 pending | Reconnect load pending | No | No |
| Evidence/reporting / S5 | Yes | Transactional evidence exists; signing/reports pending PS-510/520 | Command/evidence atomicity tested | Partial | Custody/retention decisions pending | No | No recovery proof | No |
| Deployment profiles / S6 | Approved architecture; specialist sign-offs pending | Plugin air-gap harness and media profile only | No-public-egress Plugin/media fixtures PASS | Partial | Formal review pending | No | Full package and restore pending PS-530 | No |
| Load/reliability / S7 | OPEN-019 recommendation Product Owner Approved; specialist sign-offs pending | One focused information-flow test | 500-recipient broadcast/Inject measurement only | Partial | N/A | Full application/voting/Plugin/voice profiles pending PS-540 | No | No |

## Current objective evidence

- PS-001 through PS-320 have task-specific verification records for the implementation completed to date; `PROJECT_STATE.md` is the concise status index.
- Latest PS-320 baseline: lint/typecheck/build, unit 64/64 and PostgreSQL 18 DB 14/14 PASS; browser 12 PASS with one intentional real-SFU skip when `MEDIA_TEST_URL` was absent.
- Earlier PS-250 evidence includes a passing two-browser loopback LiveKit audio path; it is not institutional LAN/TURN/firewall proof.
- `CMD-PARITY` reports 17 PASS, 0 BLOCKED and 0 OUT_OF_SCOPE; AC-09 passes with admin lifecycle, complete export/archive, PLI, and intercom/recorder parity implemented and evidenced without waivers.
- PS-350 follow-up evidence on baseline commit `e09c69b9aa412d157fdc4a5e5da59a5826d52dda` plus the current working tree passed on Node 24.22.0/npm 11.19.1: unit 77/77, type/lint, DB 17/17, browser E2E 17 PASS/1 conditional media skip, and the dedicated real-LiveKit two-browser media command 1/1. AC-01 through AC-06, AC-08 through AC-10, AC-12, and AC-13 pass; AC-07/AC-11 and accessibility remain deferred to their later gates. `docs/acceptance/PS-350-first-proof.md` records the matrix and Phase 3 GO decision.
- Full persistent-offline, signed-evidence, reporting, backup/restore, deployment, load, manual assistive-technology and final security evidence remains pending in P05.

## Release blockers

- OPEN-001 approver roles; OPEN-002 was resolved by Product Owner approval on 2026-10-20, while named specialist sign-offs remain.
- Fractured Order classification and AC-09 parity evidence against the official pinned snapshot; OPEN-003 source identity is resolved.
- Decision Register section 3 Assumed decisions that affect release behavior.
- OPEN-027 recording/transcription consent and OPEN-028 secret-ballot custody. OPEN-029 is resolved for the implementation baseline, but production key, revocation, recovery and operating procedures still need evidence.
- Missing complete evidence across Roadmap section 13 categories and REQ-069 operational readiness.
- No performance evidence against named hardware/loads and unresolved OPEN-019 targets.
- AC-07 and AC-11 are explicitly deferred from PS-350 to PS-420/PS-500 and remain mandatory at the PS-550 release gate. Canonical structured export reconciliation and competing-adjudication proof now pass in PS-350.

## Honest claim boundary

The application is implemented through PS-350, AC-09 passes, and PS-350/P03 is GO; PS-400/P04 is eligible to start while the rest of P04–P06 remains future work. Accessibility acceptance is deliberately deferred to the final PS-550 gate. A task may be PASS without the final release being approved. `RELEASE_GAP_PROMPTBOOK.md` details the remaining assurance work. Only PS-550 assembles the production go/no-go package, and authorized owners must still approve release.
