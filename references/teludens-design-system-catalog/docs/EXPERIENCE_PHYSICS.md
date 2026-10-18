# TELUDENS EXPERIENCE PHYSICS

**Version 1.0 · Interaction behavior contract**

> Teludens software should feel immediate, quiet, continuous, tactile, spatially stable, and precise. Motion and feedback are not decoration; they are the physics by which the user understands system response.

---

## 1. Desired feel

### Must feel

- immediate
- stable
- responsive
- coherent
- interruptible
- reversible when the action is reversible
- calm under load
- predictable without feeling mechanical
- tactile without gimmickry

### Must not feel

- floaty
- bouncy
- sluggish
- queued
- ornamental
- game-like without domain reason
- abruptly teleporting
- visually restless
- over-sprung

---

## 2. Latency model

Perceived responsiveness begins before network completion.

### 2.1 Input acknowledgment

Every user input should receive perceptible acknowledgment within the next rendered frame when feasible.

Examples:

- button press state changes immediately
- selected row highlights immediately
- drag target responds immediately
- command invocation closes or transitions immediately if the action has begun

Do not wait for server confirmation before indicating that input was received.

### 2.2 Async state ladder

Every asynchronous operation uses explicit states where applicable:

1. **received** — input acknowledged
2. **started** — operation began
3. **pending** — waiting on completion
4. **completed** — confirmed success
5. **failed** — confirmed failure with recovery
6. **cancelled/interrupted** — operation stopped without implying failure

Optimistic success is prohibited where an irreversible or high-consequence result has not been confirmed.

---

## 3. Motion calibration

| Semantic event | Duration | Recommended curve behavior |
|---|---:|---|
| Press | 70–90 ms | fast ease-out |
| Hover/focus | 90–120 ms | linear-to-soft ease-out |
| Selection | 110–150 ms | fast ease-out |
| Tooltip | 130–170 ms | restrained opacity/scale if needed |
| Menu/popover | 150–190 ms | anchored ease-out |
| Context overlay | 170–220 ms | short ease-out |
| Inspector/panel | 180–240 ms | coordinated resize + fade |
| View relation | 220–280 ms | spatial continuity or restrained crossfade |
| Major causal transition | 260–400 ms | only when the transformation itself communicates meaning |

Routine UI must not use 1.0–1.5 second entrance animations.

---

## 4. Motion laws

### Law 1 — Causality

Movement must have a reason.

Allowed reasons:

- reveal structure
- preserve orientation
- show ownership transfer
- connect cause and consequence
- show hierarchy change
- acknowledge interaction
- communicate state transition

Decorative movement alone is insufficient.

### Law 2 — Continuity

If an object conceptually remains the same object, preserve its visual identity during transition.

Example:

A proposal selected from a list and opened in the inspector should appear to become the inspector context, not disappear and be replaced by an unrelated panel state.

### Law 3 — Interruption

All nontrivial reversible animations must tolerate new input before completion.

Do not queue multiple panel animations after rapid selection changes.

The newest valid state wins.

### Law 4 — Reversal

If the user reverses an action mid-transition, reverse from the current visual state rather than restarting from frame zero.

Example:

A popover that is 60% open should close from 60%, not snap open then animate shut.

### Law 5 — Conservation of context

Opening details must preserve list selection, scroll location, filters, zoom, and other relevant safe context.

### Law 6 — Stable endpoints

Animation is complete only when layout, focus, accessibility state, and data state agree.

A visually completed transition with stale focus or an outdated selected record is a failed transition.

---

## 5. Hover, press, and selection

### Hover

Default hover effects:

- subtle material tone change
- boundary emphasis
- icon/text contrast change
- cursor change where applicable

Default prohibited hover effects:

- lift
- translate X/Y
- scale-up
- floating shadow
- glow

Exceptions require an interaction metaphor such as draggable spatial objects.

### Press

Press feedback may use:

- slight tonal compression
- 1–2% visual scale reduction for compact tactile controls when tested and not layout-affecting
- inset/border emphasis
- icon/label contrast change

Avoid exaggerated spring or bounce.

### Selection

Selection should change:

- material or boundary
- semantic indicator
- optional signal marker

Selection should not make the selected object jump in layout.

---

## 6. Panels and inspectors

### Opening

A docked inspector should:

1. establish its boundary
2. coordinate workspace resize/reflow
3. reveal content
4. establish focus only when appropriate

These behaviors occur as one choreography, not independent animations.

### Context change

Changing selected object should normally keep the inspector in place and transition its contents, not repeatedly close and reopen the panel.

### Resizing

Panel resize must:

- follow pointer directly
- avoid delayed easing during active drag
- snap only to documented thresholds
- preserve user-set size where product requirements permit

---

## 7. Direct manipulation

### Dragging

During drag:

- dragged object follows input 1:1 unless a constrained domain rule applies
- valid targets reveal availability immediately
- invalid targets do not attract magnetically
- drop preview communicates resulting position/state

### Drop

On successful drop:

- settle quickly
- show resulting relationship
- preserve undo when feasible

On rejected drop:

- return to origin without theatrical bounce
- explain why if the reason is not obvious

---

## 8. Proposal-flow physics

For Plenum, proposal handoff is a canonical causal transition.

Conceptual chain:

`Industry Proposal → Facilitator Review → White Cell → Adjudication / Return`

Behavior:

- proposal object retains one identity across stages
- ownership/status changes are explicit
- the state rail and activity history update coherently
- transfer may use a short path/state transition, not a decorative flight animation
- a rejected/returned proposal visually traces back to the responsible stage without creating a duplicate object

---

## 9. Loading and skeletons

### Fast operations

Do not show a spinner for operations that resolve almost immediately; prefer direct transition or subtle pending state.

### Medium operations

Use local pending feedback that preserves geometry.

### Long operations

Show:

- progress if measurable
- task identity
- cancellation if supported
- what remains usable while the operation proceeds

Skeletons must match final geometry closely enough to avoid visible reflow.

---

## 10. Scroll physics

- preserve natural platform scrolling behavior
- avoid hijacking wheel/touchpad movement for decorative effects
- nested scrolling requires explicit ownership
- opening overlays must not unexpectedly move underlying content
- returning from detail should restore expected scroll position
- programmatic scroll must be short and purposeful

---

## 11. Focus physics

Keyboard focus follows logical task continuity.

- opening a modal moves focus into it
- closing returns focus to the invoking control when valid
- inspector updates do not steal focus merely because selection changed
- command palette places focus in command search
- errors move or announce focus only when needed for recovery

Visible focus is never removed for aesthetic reasons.

---

## 12. Reduced motion

Reduced-motion mode:

- removes large spatial travel
- removes decorative parallax and scaling
- replaces major movement with opacity/material/state change where sufficient
- preserves immediate feedback and semantic state meaning

Reduced motion does not mean no feedback.

---

## 13. Performance contract

Measure on declared reference hardware.

Targets should be project-specific, but Teludens products should generally aim for:

- no input-blocking animation code
- no `transition: all`
- compositor-friendly animation where appropriate
- no expensive blur attached to large continuously moving surfaces
- no stale animation completion overwriting newer state
- no intentional delay added merely to make motion visible

Motion duration must yield to responsiveness.

---

## 14. Anti-patterns

Prohibited by default:

- infinite floating illustrations
- staggered entrance of every page element
- bounce on routine navigation
- card lift on hover
- scale-up on hover
- long easing tails after the user has completed an action
- queued selection animations
- spinner replacing an object whose identity should persist
- animation masking server latency
- focus changing before the spatial transition establishes context

---

## 15. QA tests

For each major transition:

1. trigger normally
2. trigger repeatedly and quickly
3. reverse mid-animation
4. change selection mid-animation
5. resize during or immediately after transition
6. activate reduced motion
7. navigate by keyboard only
8. force delayed async completion
9. force failure after optimistic start
10. verify final visual state, focus state, accessible announcement, and data state agree

A transition is approved only when its final state is deterministic under interruption.
