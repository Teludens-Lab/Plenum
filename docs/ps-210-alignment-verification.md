# PS-210 alignment verification

Date: 2026-10-19. Result: **IMPLEMENTATION PASS ON SUPPORTED RUNTIME; RELEASE APPROVAL BLOCKED**.

## Delivered alignment

- Proposal actions name their ingress Route and, for participant rounds, the Control approval Route. The Runtime validates and persists both instead of inferring direction from Route names.
- Fractured Order Interface Profiles declare Message and Inject modules for authors, reviewers and Control, plus proposal modules for the Facilitator and Control roles that participate in that protocol. Module configuration is preserved in the Runtime projection and rendered by accessible semantic controls.
- The browser journey proves recipient isolation, recipient negotiation, Control approval, source reply, acceptance, accepted-proposal Action evidence, source closure, recipient closure and closed-thread denial.
- `scheduled` and `gate` remain schema vocabulary but fail Release compilation until an actual Release supplies approved Runtime semantics. The current `stage_entry` Inject remains executable and tested.
- Recipient and delivery persistence uses bounded set-based inserts. A focused DEC-16 per-Session fixture measured one broadcast and one Stage-entry Inject across 500 Participants with exact recipient/delivery integrity.
- `PARITY-PROPOSAL-01`, `PARITY-RFI-01` and `PARITY-COMMS-01` are `PASS`. RFI evidence covers return, same-record edit/resubmit, answer, a real stale-answer race and cross-Team denial. Communications evidence covers direct and broadcast delivery, forbidden routing, original-receipt replay, startup history, disconnect/reconnect and no duplicate recipient projection. AC-09 now reports 9 PASS, 0 BLOCKED and 8 OUT_OF_SCOPE; no later-phase target was waived.

## Verification

| Check | Result |
|---|---|
| `npm run lint` | PASS, 24 sources and 13 contracts |
| `npm run typecheck` | PASS |
| `npm test -- --run` | PASS, 29/29 |
| `npm run test:integration` on clean PostgreSQL 18 and SeaweedFS 4.48 | PASS, 9/9 including the S3 integration |
| `npm run test:e2e` on clean PostgreSQL 18/Playwright 1.64.1 Chromium | PASS, 7/7 on Node 24.21.0; includes RFI and communications parity, multi-round negotiation, two-sided closure and axe scans on Control/source/recipient modules |
| `npm run test:load:information` | MEASURED/PASS integrity: 500 broadcast recipients and deliveries in 1,867.72 ms; 500 Inject recipients and deliveries in 3,112.72 ms |
| `node tests/parity/validate-reference-inventory.mjs` | Validator PASS; AC-09 BLOCKED at 7/0/10; zero methodology review blocks |
| `docs/promptbook/scripts/validate-promptbook.mjs` | PASS, 31 tasks, REQ 94/94, INV 28/28, no cycles |
| Locked dependency install audit | PASS, 0 vulnerabilities reported |

The latest focused rerun used Node 24.21.0/npm 11.19.0 in the official Playwright 1.64.1 image with Chromium and a clean PostgreSQL 18 fixture. Lint, typecheck, unit/contract 29/29 and E2E 7/7 passed. The earlier combined integration and load run used Node 24.19.0/npm 11.17.0 with PostgreSQL 18 and SeaweedFS 4.48 on an Intel i7-12700H (20 logical CPUs); its 15.5 GiB container memory and timings remain observations, not an SLO.

## Decisions and remaining gates

- `OPEN-026` is resolved: generic Orientation/coverage gates, bounded Control operations and decision-trace capabilities are platform options for every simulation; each Release selects and configures them. Fractured Order's exact content and semantics remain Release data. The unexecuted Orientation and Control parity journeys are still owned by PS-350/400/430.
- The 500-Participant numbers are observations, not an SLO or capacity claim. `docs/open-019-acceptance-recommendation.md` proposes measurable thresholds, but `OPEN-019` still requires Technical Lead/Operations Owner approval and a 10-Session reconnect/submission/voting/extension/voice profile.
- The combined PostgreSQL/S3 suite and proposal/Inject module-specific axe coverage now pass.
- Manual assistive-technology listening remains NOT RUN. Narrator is installed, but this environment exposes no Computer Use session capable of observing its spoken output; automated axe and keyboard checks do not replace a human screen-reader review.
