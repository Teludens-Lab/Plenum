# Participant Runtime view-family brief

## Purpose and journeys

Own invitation entry, Seat selection, configured role surfaces, module work, role switching and offline reconciliation. Prioritize `J-PAR-01`, `J-PAR-02` and `J-PAR-03`.

## Orientation contract

The shell names Session, configured Session Role/Seat, Active Role Context, Stage and connection/sync state. Release-configured labels, terminology, branding and module navigation are authoritative. Platform branding and shell remain Plenum. Participants never see modules, navigation or information outside their projection.

## Layout and scroll ownership

Use a restrained Runtime frame with configured module navigation, current task/work region and optional context rail. Module content scrolls independently of persistent role/connection context. Narrow screens use bottom or drawer navigation only when labels remain visible and reading order stays stable.

## Forms, dialogs and messages

Artifact forms, communications, Injects, Polls and Voice use shared semantic controls and explicit submission/delivery state. Switching role states what context changes. Offline messages distinguish available local work from unavailable authoritative operations. Rejection/conflict recovery preserves editable content and explains the server decision.

The exhaustive family classification is the Participant Runtime row of `../forms-dialogs-messages.md`.

## Components and gaps

Reuse `RuntimeFrame`, configured navigation, Active Role Context, module header, `Field`, `Form`, communication thread, Inject notice, Poll, Voice/Floor, `StatusBadge`, `InlineNotice`, reconnect status and empty state primitives. Gaps: one normalized module-state wrapper and consistent local-pending/server-confirmed indicator across modules.

## Keyboard and focus

Skip links target module navigation and main work. Module navigation is a semantic list; unread/arrival status is announced without stealing focus. Poll and Voice controls expose names, state and non-audio alternatives. Role switching returns focus to the new context heading. Escape never discards unsent work without confirmation.

## State, viewport and evidence

All Runtime states apply, especially local pending, ordered reconnect, duplicate receipt, stale rejection, unauthorized projection and revoked role. Verify each configured module plus a minimal Release, long configured labels, dark/light, reduced motion, forced colors, touch, 200%/320px reflow. Planned evidence key: `participant-runtime`; no PS-800 PASS evidence exists yet.

Tier behavior: 1920/1440 show configured navigation, module and context rail; 1280x720/600 prioritize module and compact the rail; 1024x768 moves context to a sheet; 768x1024 and 390x844 use labeled drawer/bottom navigation without icon-only destinations. At 200%/320px, module controls stack in reading order and status remains before actions.

