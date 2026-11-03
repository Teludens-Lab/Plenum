# Operator control view-family brief

## Purpose and journeys

Own Session staffing/readiness and live Stage, timer, Inject, adjudication, Poll, Voice, delivery and recovery operations. Prioritize `J-OPR-01`, `J-OPR-02`, `J-OPR-03` and the completion boundary of `J-OPR-04`.

## Orientation contract

Persist Session name, lifecycle/lock state, governing Release, active Stage, server-authoritative timer, Operator scope and dependency health. Separate observation from command controls. Every command result names the target and durable outcome.

## Layout and scroll ownership

Use one continuous control floor: stable Session header, primary timeline/control region, queue/health region and contextual evidence inspector. Avoid dashboard-card mosaics and KPI decoration. Tables/queues own overflow; the page shell remains fixed. Narrow/short layouts prioritize current Stage and safety controls before secondary evidence.

## Forms, dialogs and messages

Reasoned commands collect rationale where required. Confirmations state scope and downstream effect; locked or unmet prerequisites explain why. Delivery warnings distinguish degraded dependency from authoritative Session failure. Retry is offered only for safe/idempotent operations. Internal IDs are selected via labeled rosters/roles and displayed only as copyable details.

The exhaustive family classification is the Operator control row of `../forms-dialogs-messages.md`.

## Components and gaps

Reuse command bar, Stage/timer controls, timeline, queue, data table, health/status, dialog, sheet, evidence history and inline notice primitives. Gaps: normalized command outcome strip, causal timeline event, dependency-health disclosure and responsive control-floor layout.

## Keyboard and focus

Critical controls have stable tab order and never rely on drag. Optional shortcuts require visible documentation and must not fire in editable fields. Dialog focus begins at the consequence heading or first invalid field, not the destructive button. Live arrivals announce politely unless immediate safety/authority loss requires alert.

## State, viewport and evidence

All Operator states apply, including locked, delayed delivery, partial fan-out, provider unavailable, stale command, conflicting Operator command, revoked scope and completed Session. Verify 1280x600 as a primary risk viewport as well as the full matrix. Planned evidence key: `operator-control`; no PS-800 PASS evidence exists yet.

Tier behavior: 1920/1440 show timeline/control, queues and inspector; 1280x720/600 keep current Stage/timer and safety actions visible while secondary evidence becomes a sheet; 1024x768 stacks queues below primary control; 768x1024 and 390x844 expose one operational region at a time with persistent Session/Stage/clock status. At 200%/320px, no critical action requires horizontal scroll.

