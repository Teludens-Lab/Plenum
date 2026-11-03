# PS-800 motion inventory

Status: draft Checkpoint A inventory. No motion implementation or visual verification is claimed.

## Rules

Motion explains input, state change, spatial relationship or major causality. It never decorates an idle surface. Production components consume semantic design tokens; reusable literal durations/easings are prohibited. Reduced-motion variants remove travel and scale while preserving immediate state feedback, focus and announcements. Forced-colors mode must not depend on fading color alone.

| ID | Trigger and purpose | Planned token | Reduced-motion contract | Current status |
|---|---|---|---|---|
| MOT-001 | control press confirms accepted input | `--motion-press` | instant state/outline change | exported |
| MOT-002 | hover/focus tone clarifies interactivity | `--motion-hover` | immediate outline/tone | exported |
| MOT-003 | selection or local state emphasis | `--motion-selection` | immediate state change | exported |
| MOT-004 | contextual inspector/sheet opens or closes and preserves spatial relation | `--motion-panel` | opacity/visibility only; focus moved after availability | exported |
| MOT-005 | inspector context changes without replacing the shell | `--motion-selection` | instant content swap with heading/focus continuity | exported |
| MOT-006 | modal opens/closes around a consequential decision | catalog `motion.modal` -> production semantic token | no scale/travel; short opacity only | production token gap |
| MOT-007 | popover/command surface appears near its invoker | catalog `motion.popover` -> production semantic token | immediate appearance | production token gap |
| MOT-008 | route/work-region context changes while shell remains stable | catalog `motion.view` -> production semantic token | instant work-region swap | production token gap |
| MOT-009 | local pending becomes server confirmed | `--motion-selection` | status/icon replacement without travel | exported |
| MOT-010 | remote update briefly identifies changed content | proposed semantic remote-update token | persistent non-color marker, then immediate clear | authority gap; candidate OPEN |
| MOT-011 | Stage/phase advance explains a major causal transition | catalog `motion.majorCausal` -> production semantic token | heading/status change; no travel | production token gap |
| MOT-012 | Inject arrival identifies source and destination | catalog `motion.majorCausal` -> production semantic token | alert/status plus static highlight | production token gap |
| MOT-013 | adjudication outcome reveal connects decision to effects | catalog `motion.majorCausal` -> production semantic token | outcome and effect regions update together | production token gap |
| MOT-014 | Release publication marks immutable transition | catalog `motion.majorCausal` -> production semantic token | immediate immutable badge/status | production token gap |
| MOT-015 | skeleton indicates unresolved region geometry | catalog `loading.skeletonCycleMs` -> production semantic token | static skeleton; no shimmer | production token gap |
| MOT-016 | progress trace explains bounded multi-step work | catalog loading delay/minimum-visible tokens -> production semantic tokens | textual step/progress only | production token gap |

## Loading and interruption

Use the thresholds and interruption/reversal rules in `EXPERIENCE_PHYSICS.md`. A completed operation may not be held open merely to finish an animation. Reversal starts from the current rendered state. Focus is never animated away from the active control. Long-running work exposes cancel only when the underlying operation is genuinely cancellable.

## Verification plan

Each implemented motion will be captured in normal and reduced-motion modes, checked for input-to-feedback latency, interrupted/reversed once, and verified for focus/announcement continuity. Token gaps are implementation prerequisites, not permission to add local literals.

