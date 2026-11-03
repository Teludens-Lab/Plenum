---
target: Plenum platform lifecycle
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:C:\\Users\\ssnguna\\Local Sites\\Plenum\\apps\\runtime-web\\src\\App.tsx"
target_fingerprint: "sha256:1f35f19f306c707dbe85929ae8ebd2f02750ef6d1323f7d126ddc068485e4d75"
target_path: "C:\\Users\\ssnguna\\Local Sites\\Plenum\\apps\\runtime-web\\src\\App.tsx"
timestamp: 2026-11-03T00-48-05Z
slug: apps-runtime-web-src-app-tsx
---
# Platform lifecycle baseline critique

## Design health score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Status is visible; some feedback is portal-global rather than item-local. |
| 2 | Match system / real world | 3 | Strong Plenum language is weakened by raw technical provenance. |
| 3 | User control and freedom | 2 | Cancel/retry exist; reset, undo and focus return are inconsistent. |
| 4 | Consistency and standards | 2 | Landing, portal, catalog and detail patterns are mixed. |
| 5 | Error prevention | 2 | Readiness gates do not control destination hierarchy. |
| 6 | Recognition rather than recall | 2 | Users must remember where lifecycle areas sit down the page. |
| 7 | Flexibility and efficiency | 1 | No lifecycle-wide search, recent objects or shortcuts. |
| 8 | Aesthetic and minimalist design | 1 | Hero, card mosaic and technical detail obscure the task. |
| 9 | Error recognition and recovery | 3 | Errors are specific and stale changes recover safely. |
| 10 | Help and documentation | 1 | No task-focused contextual help or shortcut discovery. |
| **Total** |  | **20/40** | **Acceptable; significant improvement required.** |

## Design specificity verdict

Semantically specific, structurally interchangeable. Plenum terminology, official branding and state language are strong, while the marketing-scale hero, three-column dashboard and long card stream could serve any enterprise SaaS product. The deterministic scan returned zero findings; browser evidence still found prohibited marketing hierarchy and vague retry copy.

## Overall impression

The surface is trustworthy and explicit about authority, but behaves like several portals concatenated beneath a landing page instead of one bounded lifecycle workstation.

## Cognitive load and emotional journey

Six of eight cognitive-load checks fail: single focus, chunking, hierarchy, one-thing-at-a-time, minimal choices and progressive disclosure. The institutional confidence of the first viewport decays into uncertainty because every workspace appears in one scroll and no role-specific next action becomes dominant.

## What works

1. Authority, Organization, role, connection, immutable state and readiness are expressed in text.
2. Loading, unauthorized, offline, stale and error paths preserve user work and offer recovery.
3. Official branding, semantic materials, visible focus and native controls form a calm base.

## Priority issues

1. **P1:** Replace the 5,000–11,000px card stream with a stable shell, one scroll-owning catalog/work region and contextual inspector/sheet. Suggested command: `layout`.
2. **P1:** Establish a role- and journey-specific primary action instead of giving the marketing headline the greatest weight. Suggested command: `distill`.
3. **P1:** Make readiness and lifecycle gates control destination hierarchy and explain unavailable actions. Suggested command: `harden`.
4. **P1:** Transform constrained/200% layouts with drawer/sheet behavior rather than stacking every section. Suggested command: `adapt`.
5. **P2:** Add lifecycle-wide search/recent-object efficiency and move technical provenance behind disclosure. Suggested command: `clarify`.

## Persona red flags

- **Alex:** no lifecycle-wide search, recent-object navigation, shortcut registry or efficient object switching.
- **Sam:** 200% reflow is technically valid but operationally unusable; dynamic focus placement/return is incomplete.
- **Morgan:** Active Role Context is not persistent, lifecycle progression is fragmented and later Session destinations appear before readiness.

## Minor observations

`Theme: light` names state instead of action; `Apply` is vague; the fluid marketing headline conflicts with Operate mode; immutable state uses success-like color; package digests dominate the scan path.

## Questions to consider

1. Stable shell/catalog first, or role-specific landing action first?
2. Disabled-with-reason or omitted destinations before lifecycle readiness?
3. Lifecycle-wide search in the first slice or after workspace structure stabilizes?
