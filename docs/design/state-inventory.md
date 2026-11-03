# PS-800 UI state inventory

Status: Checkpoint A contract complete. Every evidence cell below is **PLANNED**, not PASS.

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

Legend: R = required, C = conditional on the capability, N/A = excluded with reason. All R/C evidence is pending.

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

Teludens does not currently declare this full verification matrix. The PS-800 defaults are logged as candidate OPEN text in `docs/promptbook/CONFLICT_REGISTER.md` pending Product/Design ratification.

## Evidence contract

Planned artifacts:

- screenshots: `tests/visual/ps-800/<view-family>/<route>-<state>-<viewport>.png`;
- behavioral checks: focused PS-800 product E2E scenarios under the existing product test harness;
- accessibility: axe plus keyboard/focus/reflow/reduced-motion/forced-colors records;
- human walkthroughs: `docs/design/walkthroughs/<journey-id>.md`.

An N/A entry requires an approved product decision and a non-exposed affordance. Missing evidence is NOT RUN, never PASS.

## Family x state x evidence paths

The `<state>` segment uses the Evidence key in the canonical-state table. Every R state and each exercised C state receives a file; N/A remains a reason in the applicability matrix.

| View family | States | Planned screenshot path | Planned behavioral evidence |
|---|---|---|---|
| Platform lifecycle | all R/C Lifecycle cells | `tests/visual/ps-800/platform-lifecycle/<route>-<state>-<viewport>.png` | focused PS-800 lifecycle E2E scenario |
| Studio authoring | all R/C Studio cells plus `saved-device`, `synchronized`, `validation-required`, `published` | `tests/visual/ps-800/studio-authoring/<section>-<state>-<viewport>.png` | focused PS-800 Studio E2E scenario |
| Participant Runtime | all R/C Runtime cells plus canonical server outcomes | `tests/visual/ps-800/participant-runtime/<module>-<state>-<viewport>.png` | focused PS-800 Runtime/offline E2E scenario |
| Operator control | all R/C Operator cells | `tests/visual/ps-800/operator-control/<surface>-<state>-<viewport>.png` | focused PS-800 Operator E2E scenario |
| Organization administration | all R/C Admin cells | `tests/visual/ps-800/organization-administration/<area>-<state>-<viewport>.png` | focused PS-800 Admin E2E scenario |
| Reporting/research | all R/C Reports cells | `tests/visual/ps-800/reporting-research/<surface>-<state>-<viewport>.png` | focused PS-800 report/research E2E scenario |
| Replay/archive | all R/C Replay/archive cells except reasoned N/A | `tests/visual/ps-800/replay-archive/<surface>-<state>-<viewport>.png` | focused PS-800 replay/archive E2E scenario |

