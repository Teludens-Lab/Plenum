# PLENUM CANONICAL REFERENCE SLICE

**Version 1.0 · Design and implementation baseline**

> This slice is the canonical Teludens implementation fixture for Plenum. No broad visual redesign should be propagated across the product until this slice is implemented, tested, and approved.

---

## 1. Scope

The reference slice contains:

1. application shell
2. global + local navigation
3. scenario/session context bar
4. simulation state rail
5. primary workspace
6. contextual inspector
7. modal/dialog
8. command palette
9. proposal flow from Industry submission through Facilitator and White Cell handling
10. loading, empty, error, pending, stale/conflict, and success states for the above

---

## 2. Canonical desktop composition

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ PLENUM    ARES PASSAGE / LIVE     MOVE 02 · ACTION     14:32      Blue    │
├───────┬───────────────────────────────────────────────┬────────────────────┤
│       │ ORIENT ━━━ ACTION ─── ADJUDICATE ─── RESOLVE │                    │
│ NAV   ├───────────────────────────────────────────────┤ INSPECTOR          │
│       │                                               │                    │
│       │                 WORKSPACE                     │                    │
│       │                                               │                    │
│       │                                               │                    │
├───────┴───────────────────────────────────────────────┴────────────────────┤
│ Activity / system / sync state                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Shell

### Required information

- Plenum identity
- scenario
- session/live status
- current move
- current phase
- remaining time where applicable
- user's current role/team
- connectivity/sync state when meaningful

### Behavior

- shell remains stable during navigation inside the active simulation
- context bar updates without page-level re-entry animations
- live state uses semantic status and text, not color alone

---

## 4. Navigation

Navigation hierarchy:

- simulation overview
- teams/actors
- proposals/actions
- RFIs/observations
- timeline/activity
- analysis / after-action where permitted
- administration/settings where role permits

Rules:

- one canonical label per concept
- selection persists through inspector interaction
- high-frequency destinations receive keyboard commands
- role-restricted destinations are absent or explicitly locked, not deceptively inert

---

## 5. Simulation state rail

Canonical phases for the slice:

`ORIENT → ACTION → ADJUDICATE → RESOLVE`

State rail shows:

- completed phases
- current phase
- future phases
- blocked/waiting conditions
- phase time when relevant

Electric Vermilion may mark the current position; it does not color the entire rail.

---

## 6. Primary workspace

Reference workspace: **Proposal Queue / Decision Workspace**.

Primary layout:

- queue/list/table on the left/main plane
- selected proposal content in context or inspector
- filters/search in a restrained toolbar
- no card grid

Required proposal metadata:

- proposal ID
- originating team/industry
- move
- submitted time
- current owner
- current state
- title/summary
- unresolved dependencies or flags

---

## 7. Inspector

The inspector is contextual and persistent.

For a selected proposal:

- title / ID
- state
- originating actor/team
- current owner
- submitted timestamp
- objective / intended effect
- proposed action
- dependencies
- supporting evidence / attachments where applicable
- history
- comments/notes where permitted
- available actions by role

Context changes inside the inspector without closing/reopening it.

---

## 8. Proposal flow

Canonical object identity:

**One proposal record persists through all stages.**

Flow:

1. Industry cell creates proposal
2. Industry submits
3. Facilitator receives/reviews
4. Facilitator forwards to White Cell OR returns for revision
5. White Cell accepts for adjudication, requests clarification, or returns
6. outcome/adjudication attaches to the same record

The interface must not create duplicate proposal objects for each stage.

### Visual state sequence

- Draft
- Ready
- Submitted
- Facilitator Review
- Returned for Revision
- White Cell Review
- Clarification Required
- Accepted for Adjudication
- Resolved

Not all states require unique colors. Use label + icon/shape + material hierarchy.

---

## 9. Industry proposal creation

The proposal modal/sheet must support the approved Turn Sheet relationship:

- the completed Industry Turn Sheet is the proposal record
- first proposal in a move captures the full required environment/supply-chain context
- additional proposals in the same industry/move may reuse already-captured move context where product rules permit

Design priorities:

- sequential clarity without wizard fatigue
- visible save state
- validation close to fields
- summary before consequential submission
- no duplicate entry of already-known simulation data

---

## 10. Facilitator review

Facilitator view prioritizes:

- rapid comprehension
- completeness
- affected actors
- decision demand
- missing/ambiguous information
- forward/return actions

Primary actions:

- Forward to White Cell
- Return for revision

Return requires a reason.

---

## 11. White Cell review

White Cell view prioritizes:

- proposal content
- dependencies
- current simulation state
- related actions/proposals
- adjudication context
- evidence/provenance

Possible actions:

- Accept for adjudication
- Request clarification
- Return

Consequential actions use confirmation proportional to risk.

---

## 12. Modal / dialog

Reference dialog: **Forward proposal to White Cell**.

Contents:

- concise proposal identity
- current → next owner/state
- optional note
- explicit primary action
- cancel

The dialog does not restate the entire proposal.

---

## 13. Command palette

Shortcut:

- `⌘K` macOS
- `Ctrl+K` Windows/Linux

Initial commands:

- Go to current move
- Find proposal
- Find actor/team
- Open proposal queue
- Show unresolved RFIs
- Show activity log
- Create proposal (role permitted)
- Switch view
- Open keyboard shortcuts

Command results support keyboard-only completion.

---

## 14. Density validation

The slice must be demonstrated in:

- Focus — proposal review / consequential decision
- Standard — default
- Operations — live facilitation queue

Switching density does not alter proposal semantics or state.

---

## 15. Motion validation

The slice must demonstrate:

- selection → inspector context
- inspector open/close
- proposal submission
- ownership transfer
- command palette open/close
- modal open/close
- state rail phase change

No routine transition exceeds 300 ms except a justified major causal transformation.

All reversible transitions are interruptible.

---

## 16. Accessibility validation

Test:

- keyboard-only navigation
- visible focus
- screen-reader names/roles/states
- 200% zoom/reflow as applicable
- reduced motion
- increased contrast / forced-colors where applicable
- no color-only state distinctions
- command palette and modal focus containment/return

---

## 17. Performance validation

Measure:

- selection latency
- inspector update latency
- command palette open latency
- modal open latency
- proposal submission feedback latency
- large queue scroll/render behavior
- state change under delayed network response

No claim of smoothness without measurements on declared reference hardware.

---

## 18. Acceptance gate

The slice becomes canonical only after:

- visual QA passes
- all major states are represented
- density modes are coherent
- keyboard flow passes
- reduced-motion behavior passes
- proposal object identity remains stable through handoff
- no duplicated data-entry step remains without explicit domain reason
- no generic hover lift/scale or persistent decorative motion exists
- shared components are promoted into the Teludens Figma library

Once accepted, new Plenum screens must compose approved patterns before introducing new variants.
