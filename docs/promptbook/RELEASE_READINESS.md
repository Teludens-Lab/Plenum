# Release readiness

This is a maturity view, not a release declaration. Current status is derived from the corpus, committed implementation, task-specific verification records, and `PROJECT_STATE.md` as of 2026-10-20.

## Maturity matrix

| Capability | Design specified | Implementation started | Tested locally | Integrated | Security reviewed | Performance verified | Deployment verified | Release approved |
|---|---|---|---|---|---|---|---|---|
| Product and contracts | Yes; Proposed documents are Product Owner Approved | N/A | Promptbook validation PASS | N/A | Partial | No | No | No |
| Reference authority slice | Yes | Yes | PS-001 PASS on Node 24/PostgreSQL 18 | Reference evidence only | Partial controls exercised | No | Disposable only | No |
| Platform kernel / S1 | Yes | Yes | Unit, integration, browser and accessibility evidence PASS | Yes | Negative controls PASS; formal review pending | Limited measurements only | Disposable only | No |
| Fractured Order from Release | Yes | Yes | PS-200/210 checks PASS | Yes | Formal review pending | One focused information-flow measurement | Disposable only | No; AC-09 incomplete |
| Studio collaboration / S3 | Yes | PS-300 complete; PS-310–350 pending | PS-300 unit 40/40, integration 15/15, browser 10 PASS/1 intentional media skip | Collaboration, validation, freeze and publication integrated | Boundary tests PASS; formal review pending | Two-Designer convergence only | Disposable only | No |
| Extension Framework | Yes | PS-220/230 complete; authoring UI pending PS-330 | Unit, integration, browser and air-gap evidence PASS | Registry, isolation and approval integrated | Formal Security Owner review pending | Load not measured | Isolated no-egress host only | No |
| Voting and Certification | Yes | PS-240 complete; Studio editor pending PS-320 | VOTE-01–10 PASS | Yes | Secret production profile blocked by OPEN-028 | Contention/load not measured | Disposable only | No |
| Voice Channels | Yes | PS-250 complete; consent editor pending PS-320 | VOICE-01–07/11 PASS, including loopback media | Yes | Recording/transcription disabled pending OPEN-027 | Media capacity not measured | Institutional LAN/TLS/TURN/recovery pending | No |
| Offline Participants / S2 | Yes | Reconnect exists; persistent outbox pending PS-500 | Bounded reconnect replay tested | Partial | Device policy OPEN-014/015 pending | Reconnect load pending | No | No |
| Evidence/reporting / S5 | Yes | Transactional evidence exists; signing/reports pending PS-510/520 | Command/evidence atomicity tested | Partial | Custody/retention decisions pending | No | No recovery proof | No |
| Deployment profiles / S6 | Approved architecture; specialist sign-offs pending | Plugin air-gap harness and media profile only | No-public-egress Plugin/media fixtures PASS | Partial | Formal review pending | No | Full package and restore pending PS-530 | No |
| Load/reliability / S7 | OPEN-019 recommendation Product Owner Approved; specialist sign-offs pending | One focused information-flow test | 500-recipient broadcast/Inject measurement only | Partial | N/A | Full application/voting/Plugin/voice profiles pending PS-540 | No | No |

## Current objective evidence

- PS-001 through PS-300 have task-specific verification records for the implementation completed to date; `PROJECT_STATE.md` is the concise status index.
- Latest PS-300 baseline: Node 24 lint/typecheck/build, unit 40/40 and PostgreSQL 18 integration 15/15 PASS; browser 10 PASS with one intentional real-SFU skip when `MEDIA_TEST_URL` was absent.
- Earlier PS-250 evidence includes a passing two-browser loopback LiveKit audio path; it is not institutional LAN/TURN/firewall proof.
- `CMD-PARITY` currently reports 9 PASS, 0 BLOCKED and 8 OUT_OF_SCOPE; AC-09 remains incomplete until later phases deliver those targets.
- Full persistent-offline, signed-evidence, reporting, backup/restore, deployment, load, manual assistive-technology and final security evidence remains pending in P05.

## Release blockers

- OPEN-001 approver roles; OPEN-002 was resolved by Product Owner approval on 2026-10-20, while named specialist sign-offs remain.
- Fractured Order classification and AC-09 parity evidence against the official pinned snapshot; OPEN-003 source identity is resolved.
- Decision Register section 3 Assumed decisions that affect release behavior.
- OPEN-027 recording/transcription consent and OPEN-028 secret-ballot custody. OPEN-029 is resolved for the implementation baseline, but production key, revocation, recovery and operating procedures still need evidence.
- Missing complete evidence across Roadmap section 13 categories and REQ-069 operational readiness.
- No performance evidence against named hardware/loads and unresolved OPEN-019 targets.

## Honest claim boundary

The application is implemented through PS-300, but P03 is not complete and P04–P06 remain future work. A task may be PASS without its phase or release being approved. `RELEASE_GAP_PROMPTBOOK.md` details the remaining assurance work. Only PS-550 assembles the go/no-go package, and authorized owners must still approve release.
