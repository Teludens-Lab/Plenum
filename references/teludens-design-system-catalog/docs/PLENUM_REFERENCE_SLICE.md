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
9. role-specific Runtime surfaces for Scribe, Facilitator, Notetaker, White Cell, and SME
10. proposal/action flow from Scribe authoring through Facilitator submission, White Cell completeness review, SME assessment, and White Cell ruling
11. public landing page and institutional login
12. organization administration interface
13. loading, empty, error, pending, stale/conflict, and success states for the above

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

## 8. Role-surface model and proposal flow

The canonical slice must preserve role authority rather than collapsing a team, its Scribe, its Facilitator, White Cell, and SME reviewers into one generic "user" surface.

Canonical object identity:

**One Action or Proposal record persists through authoring, review, assessment, ruling, and resolution. Ownership and authority change; object identity does not.**

Canonical flow:

1. **Scribe authors** the official team artifact in the role-appropriate Orientation / Action / Proposal surface.
2. **Scribe forwards to the Facilitator.** This is a governed handoff, not final submission to White Cell.
3. **Facilitator projects, challenges, checks, owns RFIs/messages, and submits** the finalized artifact to White Cell. The Facilitator may return it to the Scribe for correction before submission.
4. **White Cell performs completeness review**, handles returns and clarifications, and determines when an artifact is ready for analytic adjudication.
5. **SME lanes assess the already-submitted artifact** in their assigned analytic domains and return recommendations to White Cell. SME output is advisory and cannot mutate the team artifact or publish a ruling.
6. **White Cell integrates the assessments and publishes the ruling.**
7. outcome/adjudication attaches to the same record and the evidence/timeline chain remains intact.

### 8.1 Scribe surface

The Scribe surface must expose the role's actual work rather than a generic team dashboard:

- Orientation and Action / Proposal authoring;
- Industry Turn Sheet / Proposal where applicable;
- move-level environment and supply-chain context;
- draft/save state and field-level validation;
- read-only RFI history, updates, timeline and other context permitted by the Release;
- explicit **Forward to Facilitator** handoff;
- no direct final submission to White Cell;
- no ability to author or answer Facilitator-owned RFIs.

The Scribe should be able to answer: **What am I authoring, what state is it in, and who receives it next?**

### 8.2 Facilitator surface

The Facilitator surface must prioritize:

- the Scribe-authored team artifact;
- Team Action / Proposal Review;
- readback and completeness checks;
- challenge and correction loop;
- RFI ownership and direct communications where permitted;
- proposal-thread response;
- final submission to White Cell.

The Facilitator is the role boundary between team authoring and White Cell submission.

### 8.3 Notetaker surface

Notetakers are evidence actors, not alternate Scribes. Their surface must support capture of:

- reasoning;
- quotes;
- dynamics;
- relationships;
- key moments and observations;
- read-only contextual access to the relevant team artifact and timeline.

Notetaker observations do not mutate the authoritative Action or Proposal record.

### 8.4 White Cell surface

White Cell owns the gate between submitted team artifacts, analytic assessment, and authoritative ruling. Its surface must support:

- completeness review;
- returns and resubmission tracking;
- RFI answer / clarification context;
- proposal routing;
- SME-lane routing and status;
- integration of SME recommendations;
- final ruling / publication;
- move/phase progression where the Session Role permits.

### 8.5 SME surface

The canonical first reference state contains three SME assessment lanes:

- **Macro** — economic / macro-level effects;
- **National Interests & Escalation** — actor interests, escalation dynamics, coalition or strategic risk;
- **Diplomacy & Information** — diplomatic yield, signaling and information-environment effects.

Each SME surface must:

- open the already-submitted artifact read-only;
- expose lane-specific assessment fields;
- preserve source/action identity and provenance;
- allow a recommended outcome bias where the methodology calls for it;
- clearly label the recommendation as advisory;
- provide **Send to White Cell** rather than a ruling/publish action.

**SME review does not replace White Cell authority.**

### Visual state sequence

- Draft / Scribe authoring
- Forwarded to Facilitator
- Facilitator Review
- Returned for Revision
- Submitted to White Cell
- White Cell Completeness Review
- SME Assessment Pending / In Review / Complete
- White Cell Ruling
- Resolved

Not all states require unique colors. Use label + icon/shape + material hierarchy.

---

## 9. Industry proposal creation

The **Industry Scribe** proposal modal/sheet must support the approved Turn Sheet relationship:

- the completed Industry Turn Sheet authored by the Scribe is the proposal record
- first proposal in a move captures the full required environment/supply-chain context
- additional proposals in the same industry/move may reuse already-captured move context where product rules permit

Design priorities:

- sequential clarity without wizard fatigue
- visible save state
- validation close to fields
- summary before the Scribe → Facilitator handoff and before Facilitator submission
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

- Submit / Forward to White Cell
- Return to Scribe for revision
- Create / own RFI where permitted

The Facilitator, not the Scribe, owns final team submission to White Cell.

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
- Switch role surface
- Open Scribe workspace
- Open SME assessment queue
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

## 14. Entry and administration reference variants

The canonical slice includes three additional system surfaces outside the active simulation workspace. They use the same Teludens tokens, spatial grammar, interaction physics, accessibility contract, and signal-scarcity rules.

### 14.1 Public landing page

Reference state: **public product entry**.

The landing page must communicate Plenum as simulation-engineering infrastructure without imitating the dense Runtime workspace. It should show:

- Plenum identity and Teludens relationship;
- concise product posture: design, operate, and review strategic simulations;
- a decision-topology visual derived from Node / Branch / Path / Gate / State;
- primary entry to authentication and a secondary route into a non-authoritative product preview where appropriate;
- institutional posture such as release-bound, role-aware, offline-capable, and evidence-traceable operation without making unsupported security claims;
- restrained motion and no decorative floating, card mosaic, or brand-color saturation.

### 14.2 Institutional login

Reference state: **identity and deployment context establishment**.

The login surface must:

- make the deployment / organization context visible before entry where useful;
- support organization-issued credentials and institutional SSO patterns as configured;
- distinguish received, verifying, authenticated, rejected, unavailable, and expired-session states;
- never imply that successful client authentication itself grants Session authority;
- use the Teludens loading language for authentication latency rather than an application-wide spinner;
- preserve accessible labels, password-manager/autofill semantics, keyboard operation, and visible focus;
- avoid storing, logging, or replaying credentials in prototype or production UI state.

### 14.3 Organization administration

Reference state: **organization control plane**.

Administration is visually related to Plenum but task-distinct from the live simulation Runtime. The slice must show:

- deployment health and authority posture;
- Sessions and Releases;
- organization users, roles, grants, and revocations;
- approved Extension installations and pinned versions;
- Voting Method Adapter and Media Provider posture as core-capability adapters rather than model plugins;
- security and audit/evidence review;
- governance queues requiring administrator attention;
- contextual detail in an inspector rather than repeated card grids.

Administration may manage installation, access, policy, Release, and deployment posture. It does **not** bypass Session Authority or silently apply participant, Plugin, Poll, or Voice state changes.

---

## 15. Capability reference variants

The canonical slice also includes three first-class capability variants. These variants preserve the same shell, spatial grammar, density rules, semantic tokens, and interaction physics while changing the task model.

### 15.1 Extension Framework

Reference state: **Model Composition → staged Effect Proposal → authorized human approval**.

The slice must show:

- a typed sequential or parallel composition as a graph rather than a generic plugin card grid;
- Model Run status and pinned provenance;
- the distinction between provisional model output and authoritative Session state;
- staged Effect Proposals with target, operation, input snapshot, model provenance, governing Release and expected state version;
- `approve`, `reject`, and `return` review affordances for an authorized reviewer;
- explicit text that consequential Plugin/model effects do not change authoritative state before approval;
- Platform Adapters as a separate class from model Plugins. Voting Method Adapters and Media Provider Adapters extend core capabilities and never hold Session authority.

A Plugin failure, unavailable dependency, invalid output, or stale proposal is represented as an explicit state. The interface never substitutes an invented output.

### 15.2 Live Polling and Voting

Reference state: **configured/open Poll with participant ballot projection**.

The slice must show:

- Poll lifecycle and current authoritative state;
- Poll Definition metadata that becomes frozen at `open`;
- configured poll type, secrecy mode, electorate basis, revote policy, quorum/threshold/tie rules, deadline and result-visibility policy without inventing implicit defaults;
- clear distinction among `pending on device`, `submitted`, `accepted`, `rejected`, `tallied`, and `certified result`;
- no confidential live counters or result leakage before the result visibility policy allows;
- ballot receipt/state feedback that does not expose a secret-ballot choice;
- Voting Method Adapter as an algorithm provider only: tally may be supplied by the adapter, while eligibility, casting, Poll state and Certification remain Runtime authority.

Offline ballot drafting may be represented, but authoritative acceptance is always judged at server receipt time against the current Poll state and deadline.

### 15.3 Voice and Radio

Reference state: **authorized channel projection with `radio_ptt` floor control**.

The slice must show:

- the four first-release channel modes: `radio_ptt`, `open_room`, `private_call`, and `broadcast`;
- explicit authorized listen/transmit/moderate/invite state derived by the Runtime;
- Floor holder, queue/busy state, preemption state where applicable, and clear microphone/transmit feedback;
- Media Provider health as transport status, never as Plenum authority;
- recording and transcription as off by default, with consent requirements visible where configured;
- no false transmitted/delivered state when disconnected or unavailable;
- keyboard push-to-talk, visible microphone state, optional captions under consent, and a non-audio path for essential instructions.

Floor requests are latency-sensitive, are not placed in the Offline Outbox, and are not replayed after reconnection.

---

## 16. Density validation

The slice must be demonstrated in:

- Focus — proposal review / consequential decision
- Standard — default
- Operations — live facilitation queue

Switching density does not alter proposal semantics or state.

---

## 17. Motion validation

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

## 18. Accessibility validation

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

## 19. Performance validation

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

## 20. Acceptance gate

The slice becomes canonical only after:

- visual QA passes
- all major states are represented
- density modes are coherent
- keyboard flow passes
- reduced-motion behavior passes
- proposal/action object identity remains stable through Scribe → Facilitator → White Cell → SME → White Cell handoffs
- Scribe, Facilitator, Notetaker, White Cell, and SME surfaces preserve their distinct authority and do not expose cross-role controls
- Scribe cannot bypass Facilitator submission authority; Notetaker cannot mutate the official artifact; SME cannot publish a ruling
- no duplicated data-entry step remains without explicit domain reason
- no generic hover lift/scale or persistent decorative motion exists
- shared components are promoted into the Teludens Figma library
- Landing, Login, and Admin surfaces remain visually coherent with the Runtime without inheriting inappropriate workflow density
- authentication states do not imply Session authority
- administration does not expose a bypass around Session Authority
- Extension, Poll/Vote, and Voice/Radio variants preserve their distinct authority boundaries
- confidential ballot and voice states are not exposed through convenience UI
- Plugin/model proposals remain visibly provisional until authorized approval and commit

Once accepted, new Plenum screens must compose approved patterns before introducing new variants.
