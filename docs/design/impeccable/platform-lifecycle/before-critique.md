Method: dual-agent (A: lifecycle_design_review · B: lifecycle_detector_audit)

# Platform lifecycle baseline critique

Target: `apps/runtime-web/src/App.tsx` and the lifecycle routes rooted at `/`.

## Design health score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Connection, loading, lifecycle state and readiness are visible; some feedback is portal-global rather than item-local. |
| 2 | Match system / real world | 3 | Strong Plenum language is weakened by raw digests and role keys in the primary scan path. |
| 3 | User control and freedom | 2 | Cancel/retry exist; filter reset, undo and reliable focus return are inconsistent. |
| 4 | Consistency and standards | 2 | Components are visually consistent, but landing page, portal, catalog and detail patterns are mixed. |
| 5 | Error prevention | 2 | Idempotency and confirmations help; destination hierarchy does not reflect readiness gates. |
| 6 | Recognition rather than recall | 2 | Labels are visible, but users must remember where lifecycle areas sit down the page. |
| 7 | Flexibility and efficiency | 1 | Separate searches exist without lifecycle-wide search, recent objects, shortcuts or expert navigation. |
| 8 | Aesthetic and minimalist design | 1 | The marketing hero, card mosaic and expanded technical detail obscure the work. |
| 9 | Error recognition and recovery | 3 | Errors are specific, entries are preserved and stale changes recover safely. |
| 10 | Help and documentation | 1 | Explanatory prose exists without task-focused contextual help or shortcut discovery. |
| **Total** |  | **20/40** | **Acceptable; significant improvement required.** |

## Design specificity verdict

**Semantically specific, structurally interchangeable.** The official wordmark, Mineral Sage palette, immutable Release language, readiness counts and Organization context are unmistakably Plenum. The information architecture is a generic enterprise dashboard: a marketing-scale hero followed by a three-column shell and a long stack of rounded cards.

The deterministic source scan returned exit code `0` and `[]`: zero findings in `apps/runtime-web/src/App.tsx`. That is useful implementation evidence, not proof of rendered quality. Browser inspection found the prohibited marketing headline and vague `Try again` action that the source rules did not flag. No user-visible overlay was injected; the browser fallback was Playwright MCP in an isolated automation context.

## Overall impression

The surface is trustworthy, legible and unusually explicit about authority. It behaves like several portals concatenated beneath a landing page rather than one bounded workstation. Project → Release → Session → operation is shown as unrelated sections instead of a selectable Teludens Path with stable context, catalog state and contextual detail.

## Cognitive load

Six of eight checks fail: single focus, chunking, hierarchy, one-thing-at-a-time, minimal choices and progressive disclosure. Grouping passes; working-memory support passes locally but degrades across the page. Decision points expose more than four peers in primary navigation, Session destinations and the root work stream.

## Emotional journey

The first viewport feels confident and institutional, but confidence decays into uncertainty: “Choose a workspace” leads to every workspace in one scroll. High-consequence facts such as immutability and readiness are present, but not converted into one clearly safe next action. The page ends in more destinations rather than a durable outcome or next-step summary.

## What works

1. Authority, Organization, role, connection, immutable state and readiness are expressed in text rather than color alone.
2. Loading, unauthorized, offline, stale and error behavior is unusually thoughtful and preserves user work.
3. The official branding, production Mineral Sage/graphite materials, visible focus and native controls form a calm institutional base.

## Priority issues

### P1 — Replace the unbounded card stream with a lifecycle workspace

The signed-in desktop capture is approximately 5,297px tall and the constrained/200% state reaches approximately 11,602px. Use a stable application frame, labeled navigation/drawer, persistent human-readable context header, one scroll-owning catalog/work region and contextual inspector/sheet. Represent Projects, Releases and Sessions as continuous catalogs rather than nested cards. Suggested command: `layout`.

### P1 — Establish a role- and journey-specific primary action

Participant, Designer, Publisher and Operator enter the same mixed-purpose stream while the marketing headline has more weight than Open Draft, Create Session or Complete readiness. Resolve the landing state from role and resumable work, keep a neutral role/workspace switcher and expose one primary next action. Suggested command: `distill`.

### P1 — Make readiness and lifecycle gates control destination hierarchy

A configured Session with zero completed readiness checks presents Staffing, Runtime, Reports, Replay and Archive with equal affordance. Promote the valid next action, explain unavailable prerequisites adjacent to later destinations and reveal evidence/archive actions only when lifecycle state makes them relevant. Suggested command: `harden`.

### P1 — Transform constrained and 200% layouts instead of stacking cards

At 390px/200%, names fragment, context moves thousands of pixels away and all sections remain expanded. Use a labeled drawer, persistent context, one visible work region, inspector sheets and compact catalog rows with disclosure. Suggested command: `adapt`.

### P2 — Add professional-tool efficiency and contextual guidance

Experts traverse long catalogs and separate Apply buttons; first-time/cross-role users get prose without task-focused help. Add lifecycle search/command affordance, recent objects, explicit search actions and secondary copyable provenance. Suggested command: `clarify`.

## Persona red flags

- **Alex, power user:** no lifecycle-wide search, recent-object navigation, shortcut registry or efficient Project/Release/Session switching; repeated full-detail cards reduce scan speed.
- **Sam, keyboard/low-vision user:** 200% reflow remains technically valid but operationally unusable; opening inline Session creation and dismissing archive confirmation lack an explicit focus-placement/return contract.
- **Morgan, trained Plenum operator/designer:** Active Role Context is relegated to the Account card, lifecycle progression is fragmented, and configured Sessions expose later destinations before readiness is complete.

## Minor observations

- `Theme: light` names state instead of the action.
- Repeated `Apply` labels do not name their object.
- The fluid marketing headline conflicts with Operate-mode typography.
- `immutable` uses success-like color rather than neutral frozen-state treatment.
- Package digests should be secondary, copyable provenance rather than dominant row content.

## Questions to consider

1. Should the first implementation optimize the stable shell and lifecycle catalog, or the role-specific landing action first?
2. Should incomplete Session destinations be visibly disabled with reasons, or omitted until their lifecycle state makes them relevant?
3. Should lifecycle-wide search enter the first slice, or follow after the workspace structure is stable?

## Run notes

- Target slug: `apps-runtime-web-src-app-tsx`.
- Ignore list: `.impeccable/critique/ignore.md` absent.
- Independence: Assessment A and B ran in separate agents and did not read each other’s output.
- CLI detector: PASS, zero findings; no false positives.
- Browser: B used a fresh isolated Playwright MCP context at 1440×900 and 390×844; A used current PS-700/PS-720 screenshots after its CLI browser launcher failed with Windows access denial.
- Overlay: not injected; no user-visible overlay claimed.
- Live server: existing repository harness used; Impeccable live server not started.
- Temporary files: B cleaned temporary snapshot/log files and retained the requested screenshots.

