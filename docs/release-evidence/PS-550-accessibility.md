# PS-550 accessibility assurance report

Date: 2026-10-26  
Target: WCAG 2.2 AA (`REQ-064`) for the tested Studio and Runtime reference flows.

## Evidence matrix

| Check | Result | Evidence / limitation |
|---|---|---|
| Automated axe checks | PASS | `npm run test:a11y`: 11/11 tagged browser scenarios passed on a fresh database. |
| Keyboard operation | PASS | Artifact, Poll, Voice, proposal, Studio composition, adjudication, advanced logic and live activation flows complete through semantic controls. |
| Screen-reader semantics | PASS | Automated accessible-name, role, landmark, label and live-region checks pass for the tested reference screens. |
| Focus management | PASS | Tested reconnect, error and workflow transitions retain or move focus to operable controls without keyboard traps. |
| Contrast and non-color state | PASS | Axe found no contrast violations on tested rendered states; text labels accompany status styling. |
| Zoom and reflow | PASS | Reference Runtime layouts pass 390-pixel and 200-percent text/reflow checks without loss of required operation. |
| Accessible form errors | PASS | Invalid and incomplete forms expose associated, textual correction guidance. |
| Reduced motion | PASS | Tagged Poll and Voice flows run with reduced-motion preferences and retain all status information. |
| Adjustable timing | PASS | Operator timer controls and extension behavior are keyboard-operable in covered Runtime flows. |
| Poll accessibility (`VOTE-15`) | PASS | Ballot states and certification are keyboard operable, named and perceivable in the tagged browser flow. |
| Voice controls (`VOICE-11`, `REQ-085`) | PASS | Join, microphone and push-to-talk controls have visible/textual states and non-audio instructions in existing dedicated and aggregate evidence. |
| Transcription consent UI (`VOICE-13`) | PASS | Consent and withdrawal are operable and announce the resulting stopped state. |
| Manual NVDA/JAWS/VoiceOver review | NOT RUN | No qualified assistive-technology operator result was provided. Automated semantics are not a substitute. |
| Caption quality and production transcript policy | N/A for version 1 | OPEN-027 is resolved by disabling production recording and transcription; no caption/transcript service is in the approved version 1 scope. |

## Defect correction

The initial accessibility subset failed because its proposal-negotiation scenario depended on orientation artifacts created by an earlier non-accessibility test. The scenario now seeds only its unrelated stage precondition directly; proposal behavior and accessibility assertions still run through the application. The fresh rerun passed all 11 scenarios in 8.8 minutes.

## Accessibility decision

Automated reference-screen evidence is **PASS**. Full WCAG 2.2 AA release acceptance remains **NOT RUN** until a qualified manual screen-reader review and the applicable caption/transcript review are recorded.

