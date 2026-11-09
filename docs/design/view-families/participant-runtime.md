# Participant Runtime view-family brief

## Purpose and journeys

Own invitation entry, Seat selection, configured role surfaces, module work, role switching and offline reconciliation. Prioritize `J-PAR-01`, `J-PAR-02` and `J-PAR-03`.

## Orientation contract

The entry product names the simulation, developer, Session, Release, authenticated identity and access state before Seat selection. The Runtime shell names Session, configured Session Role/Seat, Active Role Context, Stage and connection/sync state. Release-configured labels, terminology, branding, region order and module navigation are authoritative. Participants never see modules, navigation, resources or information outside their projection.

## Layout and scroll ownership

Use a restrained Runtime frame with configured module navigation and Release-authored work regions. `main_sidebar`, `workspace` and `dashboard` templates preserve their region/module order without alphabetic normalization. Narrow screens collapse navigation into a labeled disclosure before the primary region; opening it does not change task or module order.

## Forms, dialogs and messages

Artifact forms, communications, Injects, Polls and Voice use shared semantic controls and explicit submission/delivery state. Switching role states what context changes. Offline messages distinguish available local work from unavailable authoritative operations. Rejection/conflict recovery preserves editable content and explains the server decision.

The exhaustive family classification is the Participant Runtime row of `../forms-dialogs-messages.md`.

## Components and gaps

Reuse `RuntimeFrame`, configured navigation, Active Role Context, module header, `Field`, `Form`, communication thread, Inject notice, Poll, Voice/Floor, `StatusBadge`, `InlineNotice`, reconnect status and empty state primitives. Gaps: one normalized module-state wrapper and consistent local-pending/server-confirmed indicator across modules.

## Keyboard and focus

Skip links target module navigation and main work. Module navigation is a semantic list; unread/arrival status is announced without stealing focus. Poll and Voice controls expose names, state and non-audio alternatives. Role switching returns focus to the new context heading. Escape never discards unsent work without confirmation.

## State, viewport and evidence

The normal family implementation and focused cross-family evidence are closed in `../impeccable/participant-runtime/family-closeout.md`; remaining human, device and task-level state gates are explicitly NOT RUN.

All Runtime states apply, especially local pending, ordered reconnect, duplicate receipt, stale rejection, unauthorized projection and revoked role. Verify each configured module plus a minimal Release, long configured labels, dark/light, reduced motion, forced colors, touch, 200%/320px reflow. Planned evidence key: `participant-runtime`; no PS-800 PASS evidence exists yet.

Tier behavior: 1920/1440 show configured navigation and authored regions; 1280x720/600 prioritize the main region; 1024x768 compacts context into disclosure; 768x1024 and 390x844 use labeled collapsed navigation without icon-only destinations. At 200%/320px, module controls stack in reading order and status remains before actions.


## PS-842 candidate contract

Shared Communications, Proposals, Injects and RFIs names/icons/order are authored in new Release Interface Profiles. Stable Work, Communications and Session resources groups do not change access policy. One paged review pattern owns record navigation. White Cell links to the existing authorized Operator console; it does not embed another copy.

Supported acceptance: 1440x900, 1024x768 and equivalent 200% desktop zoom, explicit light/dark, keyboard, reduced motion, forced colors and named desktop AT. Mobile/touch remains N/A. Current evidence and human gates are in ../../acceptance/PS-842-interface-consistency.md; historical closeout does not establish this candidate's acceptance.
