# Release readiness

This is a maturity view, not a release declaration. Current status is derived from the corpus, committed implementation, task-specific verification records, and `PROJECT_STATE.md` as of 2026-10-24.

## Maturity matrix

| Capability | Design specified | Implementation started | Tested locally | Integrated | Security reviewed | Performance verified | Deployment verified | Release approved |
|---|---|---|---|---|---|---|---|---|
| Product and contracts | Yes; Proposed documents are Product Owner Approved | N/A | Promptbook validation PASS | N/A | Partial | No | No | No |
| Reference authority slice | Yes | Yes | PS-001 PASS on Node 24/PostgreSQL 18 | Reference evidence only | Partial controls exercised | No | Disposable only | No |
| Platform kernel / S1 | Yes | Yes | Unit, integration, browser and accessibility evidence PASS | Yes | Negative controls PASS; formal review pending | Limited measurements only | Disposable only | No |
| Fractured Order from Release | Yes | Yes | PS-200/210 checks and PS-350 AC-09 parity PASS | Yes | Formal review pending | One focused information-flow measurement | Disposable only | Phase 3 GO; later release gates pending |
| Studio collaboration / S3 | Yes | PS-300/310/320/330/340 implemented; PS-350 implemented-capability proof complete | PS-350 Node 24.22.0 rerun: unit 77/77, DB 17/17, browser 17 PASS/1 conditional media skip; dedicated real-media 1/1 and parity 17/17 PASS | Collaboration, visual authoring, Publication, Session creation, DEC-42 revision/adjudication, Orientation gating, note isolation/autosave, Control/reconnect, offline Scenario assets, evidence, canonical export reconciliation, admin lifecycle, complete export/archive, PLI, intercom/recorder, and loopback SFU audio are integrated | Boundary, retry, contention, hidden-Artifact probing, rejection, retained logical deletion, project export scope, and consent tests PASS; formal review pending | Two-Designer convergence and loopback SFU audio pass; load remains unmeasured | Disposable only | Phase 3 GO; not production approval |
| Extension Framework | Yes | PS-220/230 complete; authoring UI pending PS-330 | Unit, integration, browser, air-gap and PS-540 isolated load evidence PASS | Registry, isolation and approval integrated | Formal Security Owner review pending | 24 valid runs plus invalid-output/timeout containment measured once; required repetitions remain | Isolated no-egress host only | No |
| Voting and Certification | Yes | PS-240 Runtime and PS-320 Studio editor complete | VOTE-01–10/15 and PS-540 5,000-Ballot integrity PASS | Yes | Secret production profile blocked by OPEN-028 | One local run meets approved targets: receipt p99 586.47 ms and Certification p99 52.61 ms; repetitions remain | Disposable only | No |
| Voice Channels | Yes | PS-250 media/Floor and PS-320 Studio editor/consent proof complete | VOICE-01–07/09/11/13/14 PASS; PS-540 real loopback media/failure run completed | Yes | Production recording/transcription blocked by OPEN-027 | Floor p95 12.61 s misses the approved target; local 1-publisher/49-subscriber packet loss 0%; LAN/TURN/join/speech-start unverified | Institutional LAN/TLS/TURN/recovery pending | No |
| Offline Participants / S2 | Yes | PS-500 durable outbox and reconciliation implemented | Unit, real-database and browser restart/reconnect evidence PASS | Encrypted minimized browser cache, fixed allowlist and receipt-first reconnect integrated | OPEN-014/015 policy approved; eight-hour authority, 30-day retention, managed-device restriction and high-security key enforcement/accreditation pending | Reconnect load pending | Disposable browser/PostgreSQL only | No |
| Evidence/reporting / S5 | Yes | PS-510 signed Checkpoints and PS-520 reporting/replay/archive are implemented | Evidence verifier 6/6, report reconciliation 3/3, logical reimport and signed restore PASS | Signed range chain, redacted export, independent anchor verification and traceable reports integrated | Local negative controls PASS; production KMS/HSM and custodian review pending | No | Encrypted database/object restore preserved and reverified signed Evidence locally | No |
| Deployment profiles / S6 | Approved architecture; specialist sign-offs pending | PS-530 one-image profiles, offline bundle, local dependencies and recovery tooling implemented | Deployment smoke 4/4; zero-public-egress Session completion and synthetic restore evidence PASS | Yes at local reference-profile level | Formal review and institution trust acceptance pending | PS-540 local characterization complete; production-shaped repetitions still pending | Disposable restore met 2-second RPO and 9-second RTO; production exercise pending | No |
| Load/reliability / S7 | OPEN-019 targets fully approved and decision resolved | PS-540 harness implemented | One local 10 x 500 application/voting/Plugin/voice characterization run with zero integrity loss | Integrated load paths exercised | N/A | Reconnect, fan-out, voting, recovery and local media pass; command and Floor latency fail approved targets; soak/repetitions/institutional media pending | Disposable/local only | No |

## Current objective evidence

- PS-001 through PS-320 have task-specific verification records for the implementation completed to date; `PROJECT_STATE.md` is the concise status index.
- Latest PS-320 baseline: lint/typecheck/build, unit 64/64 and PostgreSQL 18 DB 14/14 PASS; browser 12 PASS with one intentional real-SFU skip when `MEDIA_TEST_URL` was absent.
- Earlier PS-250 evidence includes a passing two-browser loopback LiveKit audio path; it is not institutional LAN/TURN/firewall proof.
- `CMD-PARITY` reports 17 PASS, 0 BLOCKED and 0 OUT_OF_SCOPE; AC-09 passes with admin lifecycle, complete export/archive, PLI, and intercom/recorder parity implemented and evidenced without waivers.
- PS-350 follow-up evidence on baseline commit `e09c69b9aa412d157fdc4a5e5da59a5826d52dda` plus the current working tree passed on Node 24.22.0/npm 11.19.1: unit 77/77, type/lint, DB 17/17, browser E2E 17 PASS/1 conditional media skip, and the dedicated real-LiveKit two-browser media command 1/1. AC-01 through AC-06, AC-08 through AC-10, AC-12, and AC-13 pass; AC-07/AC-11 and accessibility remain deferred to their later gates. `docs/acceptance/PS-350-first-proof.md` records the matrix and Phase 3 GO decision.
- Signed-evidence, reporting, logical reimport, three-profile packaging, no-egress checks and an encrypted synthetic database/object restore pass through PS-530. PS-540 adds one named local 10 x 500 characterization with zero lost/duplicate accepted effects, but command and voice-floor latency miss the approved targets. PS-545 now owns optimization and clean reruns. Production KMS/HSM and independent-custodian deployment, institution-owned TLS/firewall/backup acceptance, approved/repeated load, manual assistive-technology and final security evidence remain pending.

## Release blockers

- OPEN-001 approver roles; OPEN-002 was resolved by Product Owner approval on 2026-10-20. OPEN-019 target ownership is resolved by the combined Owner/Technical Lead/Operations Owner approval on 2026-10-24.
- Fractured Order classification and AC-09 parity evidence against the official pinned snapshot; OPEN-003 source identity is resolved.
- Decision Register section 3 Assumed decisions that affect release behavior.
- OPEN-027 recording/transcription consent and OPEN-028 secret-ballot custody. OPEN-029 is resolved for the implementation baseline, but production key, revocation, recovery and operating procedures still need evidence.
- Resolved OPEN-014/015/017 policy has local PS-500/510/530 implementation and restore evidence but has not yet passed production device accreditation or institutional signer/custodian/backup-site verification.
- Missing complete evidence across Roadmap section 13 categories and REQ-069 operational readiness.
- PS-540 performance evidence exists on named local hardware, but command and voice-floor measurements fail the now-approved targets; PS-545 must correct those bottlenecks and produce the required soak, three clean repetitions and institutional LAN/TURN evidence before PS-550.
- AC-07 and AC-11 are explicitly deferred from PS-350 to PS-420/PS-500 and remain mandatory at the PS-550 release gate. Canonical structured export reconciliation and competing-adjudication proof now pass in PS-350.

## Honest claim boundary

The application and PS-540 measurement harness are implemented, but OPEN-019 approval does not turn failed measurements into a pass. PS-545 is next: it must remove the measured command and radio-floor bottlenecks and pass three clean production-shaped runs. PS-550 remains blocked until that evidence passes, then performs final release assurance.
