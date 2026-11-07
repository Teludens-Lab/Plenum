# Plenum

<!-- impeccable:product-schema 1 -->

Updated: 2026-11-03 for the PS-800 composed-capability follow-up.

## Platform

web

## Users

- **Admin** governs Organization membership, deployment posture, Plugins, and data policy.
- **Designer** visually authors Core Design and Scenario content without code or raw JSON.
- **Reviewer** inspects exact frozen revisions and governed live changes.
- **Publisher** publishes immutable Releases and Templates and manages Packages.
- **Operator** staffs, readies, runs, recovers, reports, and archives Sessions.
- **Research Analyst** produces purpose- and consent-filtered research outputs.
- **Participants**, including configured Session Roles such as Scribe and subject-matter contributors where a Release defines them, enter through Session policy and see only the modules, terminology, and navigation that Release permits.

They work in long, consequential simulation-design and delivery sessions where losing orientation, acting in the wrong mode, or mistaking pending work for confirmed state is costly.

## Product Purpose

Plenum is a professional, role-governed platform for visually designing, publishing, operating, researching, and archiving facilitated simulations. It makes a complex governed lifecycle manageable without requiring users to work through source code, raw JSON, or internal identifiers.

Success means users can identify their context, understand what matters, take the valid next action, and recover safely across Project, Release, Session, evidence, reporting, replay, and archive work.

## Positioning

Plenum composes visual authoring, immutable publication, live Session authority, evidence, and retention into one governed lifecycle. Simulation content can configure the work, but cannot replace the platform shell, authorization model, canonical terminology, or provenance trail.

## Operating Context

The lifecycle is Organization and Project setup → visual authoring → validation, rehearsal, and review → immutable publication → Session staffing and delivery → evidence, reporting, and replay → retention and archive.

Users move among seven UI families: Platform lifecycle, Studio authoring, Participant Runtime, Operator control, Organization administration, reporting and research, and replay and archive. The server is authoritative for identity, authorization, business decisions, and persisted state; client caches and previews are projections.

The working mode is **Operate**. Plenum is a desktop-browser platform. Supported desktop workspaces must sustain keyboard and pointer use, browser zoom, reduced motion, forced colors, and desktop assistive technology without changing task order or hiding consequential state. Mobile and touch-device layouts are not production acceptance targets.

## Capabilities and Constraints

- `REQ-009`: every Core Design and Scenario editor is visual; no code/raw JSON editing.
- `REQ-063`: participant interfaces are curated modules/layouts with configurable labels, navigation, terminology, and branding—not arbitrary pixels.
- `REQ-064`: WCAG 2.2 AA.
- `REQ-071`: every contract/interface label maps to the Glossary or a terminology profile.
- `INV-019`: one owning subsystem per authoritative truth; clients and caches are projections.
- One primary action belongs to each decision context; unavailable consequential actions explain their prerequisites.
- Loading, empty, error, pending, stale, conflict, offline, revoked, disabled, and success are product behavior, not incidental fallbacks.
- PS-800 may change presentation and interaction, but not domain meaning, authorization, tenancy, persistence ownership, or external contracts.
- Node.js 24 or newer is the supported toolchain.

## Brand Commitments

The official Plenum name and wordmarks remain the platform identity. Teludens v1.3 Graphite/Mineral Sage is the binding production design language. The voice is calm, concise, canonical, and specific about what happened, what it means, and what can happen next.

The governing experience direction is **composed capability**: Apple OS fluidity and conscientiousness adapted to a professional Plenum workstation, Cursor-like workspace focus, and approachable ChatGPT-like interaction. These are quality references, not permission to copy another product’s chrome or navigation.

## Evidence on Hand

- Product and requirement corpus under `docs/corpus/`.
- Binding Teludens catalog under `references/teludens-design-system-catalog/`.
- Production token implementation at `packages/design-system/src/tokens.css` and `packages/design-system/conformance.json`.
- Route, journey, state, motion, form/message, and view-family records under `docs/design/`.
- Automated PS-700 through PS-790 evidence and current PS-800 family evidence under `output/playwright/` and `docs/design/impeccable/`.
- No observed human PS-800 usability result may be fabricated; the human gate remains separate.

## Product Principles

1. **Fluidity and conscientiousness:** preserve orientation, focus, selection, work, and recovery through every state change.
2. **Dependable operation:** accessibility, responsiveness, performance, and realistic operational states are part of the capability.
3. **Contained minimalism:** one dominant work area, purposeful supporting regions, restrained surfaces, and progressive disclosure.
4. **Editorial clarity:** typography, proportion, alignment, and spacing establish subject, reading order, emphasis, and annotation before explanatory prose.
5. **Integrated value:** evidence, guidance, consequences, and visible progress appear inside the task where they change a decision.

## Accessibility & Inclusion

WCAG 2.2 AA is required on supported desktop browsers. The acceptance floor is a 1024 × 768 desktop window, including its equivalent 200% browser-zoom viewport, with keyboard and pointer operation, reduced motion, forced colors, desktop screen-reader semantics, visible focus, and non-color state communication. Mobile, iOS, Android, and touch-device acceptance are not applicable. Human/device/assistive-technology evidence remains distinct from automated evidence.
