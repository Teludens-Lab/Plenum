# PS-800 UI state inventory

Status: **PASS for PS-800 change-level acceptance.** `PS-800-T01/T03/T04` provide automated normal, no-results, recoverable-error, partial-failure, success, disabled/prerequisite, responsive, axe and cross-family evidence. `npm run test:visual` fail-closes on 25 required captures spanning all seven view families and the accepted risk-based viewport/state set. Product Owner human, device, browser, assistive-technology and performance acceptance was recorded on 2026-11-05.

## Canonical states

| State | Required behavior | Announcement / focus | Evidence key |
|---|---|---|---|
| initial loading | Preserve shell and expected region geometry; show a delayed indicator or skeleton under the Teludens loading ladder | Announce loading only when perceptible; do not move focus | `loading-initial` |
| refreshing | Retain safe stale content, mark refresh and avoid layout replacement | Polite status; focus stays put | `loading-refresh` |
| first-use empty | Explain purpose and one authorized next action | Heading receives navigation, not forced focus | `empty-first-use` |
| no results | Preserve query/filter context and offer reset | Result count/status announced | `empty-no-results` |
| recoverable error | Explain failed scope and safe retry/alternative | Focus error summary only after submitted action | `error-recoverable` |
| nonrecoverable error | Preserve correlation/support detail without raw internals; offer safe exit | Alert and deterministic focus target | `error-terminal` |
| offline | Mark unavailable server actions and protected local capability | Persistent status; no repeated alert storm | `offline` |
| reconnecting | Show retry progress without pretending success | Polite status | `reconnecting` |
| local pending | Distinguish local accepted work from server-confirmed work | Status attached to the affected item | `pending-local` |
| stale | Explain that authoritative state changed and offer refresh/rebase | Alert for consequential conflict | `stale` |
| conflict | Compare safe choices; never silently overwrite | Dialog or inline conflict region with explicit focus | `conflict` |
| disabled | Explain unmet prerequisite close to the control | Programmatic description; not color alone | `disabled` |
| unauthorized | State that the active role cannot perform the action | Focus page/message heading | `unauthorized` |
| revoked | Stop protected updates, clear restricted projections and provide safe exit | Assertive once; focus revocation heading | `revoked` |
| partial failure | Identify completed and failed subsets plus recovery | Summary then item-level status | `partial-failure` |
| success | Persist the resulting state and next action; toast is supplemental | Polite status when needed | `success` |
| long/localized content | Wrap/truncate only with access to full value; preserve controls | DOM/reading order remains logical | `long-content` |

The Teludens `EXPERIENCE_PHYSICS.md` timing ladder governs loading. Its thresholds take precedence over generic prompt defaults. Production tokens must expose any timing used by reusable components; literals are not permitted.

## Applicability matrix

Legend: R = required, C = conditional on the capability, N/A = excluded with reason. R/C marks applicability. Automated capture is risk-based rather than a Cartesian screenshot of every equivalent shared state; shared behavior is asserted once and representative rendering is captured in each family.

| State | Lifecycle | Studio | Runtime | Operator | Admin | Reports | Replay/archive |
|---|---:|---:|---:|---:|---:|---:|---:|
| initial loading / refreshing | R | R | R | R | R | R | R |
| first-use empty | R | R | C | C | C | R | C |
| no results | R | R | C | R | R | R | C |
| recoverable / terminal error | R | R | R | R | R | R | R |
| offline / reconnecting | R | R | R | R | R | R | R |
| local pending | C | R | R | C | C | C | N/A: replay is read-only |
| stale / conflict | R | R | R | R | R | C | C |
| disabled | R | R | R | R | R | R | R |
| unauthorized / revoked | R | R | R | R | R | R | R |
| partial failure | C | R | R | R | R | R | R |
| success | R | R | R | R | R | R | R |
| long/localized content | R | R | R | R | R | R | R |

## Viewport and input matrix

Every route/state pair is sampled at the smallest set that exposes its risk, with full family coverage across:

- `1920x1080`, `1440x900`, `1280x720`, `1280x600`, `1024x768`, `768x1024`, `390x844`;
- 200% browser zoom and 320 CSS px reflow;
- light, dark, reduced-motion and forced-colors modes;
- keyboard-only; pointer and touch where controls support direct manipulation;
- long labels, validation text, large result sets and representative empty data.

Teludens does not declare this verification matrix. The Product Owner accepted the PS-800 risk-based matrix and manual coverage on 2026-11-05; later release tasks retain their own production gates.

## Evidence contract

Implemented artifacts:

- screenshots: 25 required captures under `output/playwright/ps-800/after/<view-family>/`, verified by `scripts/verify-ps800-visual.mjs`;
- behavioral checks: focused PS-800 product E2E scenarios under the existing product test harness;
- accessibility: axe plus keyboard/focus/reflow/reduced-motion/forced-colors records;
- human walkthroughs: journey walkthroughs plus Product Owner acceptance recorded in `docs/design/user-test/PS-800-script.md`.

An N/A entry requires an approved product decision and a non-exposed affordance. The PS-800 PASS does not replace the independent PS-820 production accessibility and recovery gates.

## Family x state x evidence paths

The capture set uses the Evidence keys where a state is visually distinct. Shared state machinery is behaviorally asserted once, then rendered representatives are captured across every family; N/A remains a reason in the applicability matrix.

| View family | States | Planned screenshot path | Planned behavioral evidence |
|---|---|---|---|
| Platform lifecycle | normal, catalog depth, no-results, recoverable/partial failure, recovered success, prerequisite/disabled and constrained modes | `output/playwright/ps-800/after/platform-lifecycle/` | `PS-800-T01/T02/T03` |
| Studio authoring | normal plus live QA demo desktop and constrained reflow | `output/playwright/ps-800/after/view-families/` and `after/studio-authoring/` | `PS-800-T04` and Project QA demo scenario |
| Participant Runtime | normal and 320px/200% | `output/playwright/ps-800/after/view-families/` | `PS-800-T04` |
| Operator control | normal with valid next-action context | `output/playwright/ps-800/after/view-families/` | `PS-800-T04` |
| Organization administration | normal workforce-access route | `output/playwright/ps-800/after/view-families/` | `PS-800-T04` |
| Reporting/research | normal consent-filtered route | `output/playwright/ps-800/after/view-families/` | `PS-800-T04` |
| Replay/archive | normal read-only replay route | `output/playwright/ps-800/after/view-families/` | `PS-800-T04` |

