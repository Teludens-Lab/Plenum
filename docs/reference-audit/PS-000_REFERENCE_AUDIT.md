# PS-000 — Fractured Order reference audit

Status: **implementation complete; approval blocked on Methodology Lead review**

Risk: **HIGH**

Requirements: `REQ-024`, `REQ-071`, `INV-022`

Acceptance evidence: `AC-09` planning only; parity execution remains `NOT RUN` until PS-200.

## Pinned source record

| Field | Value |
|---|---|
| Product Owner-approved commit | `ae5d5065bc04a53631815b1b1715a54e21e3ef5b` |
| Git tree | `771510b6180bd4826dc5688789d131f2109eeb62` |
| Archive SHA-256 / Release digest key | `E9B0E4E2797087F7CC04B0EA4A3DB8E04A12287AC4224ED5C5FAD95995146060` |
| Tracked files | 1,111 |
| Snapshot authority | `references/fractured-order.snapshot.json` |
| Owner confirmation | Product Owner, 2026-10-17; Decision Register `OPEN-003` resolved |

The exported reference tree was independently re-indexed on 2026-10-18 with `core.autocrlf=false`; the calculated tree was `771510b6180bd4826dc5688789d131f2109eeb62`, exactly matching the snapshot. The reference directory was not changed. The pin is immutable and parity evidence is keyed by both commit and archive digest.

Authority: Decision Register and Glossary, then PRD, Canon, architecture/contracts, capability specifications, Proposed Data Model/Sync, and finally the observed reference. `OPEN-026` is resolved; `OPEN-001` and `DEC-22` remain labeled, so this audit does not treat the full draft methodology as ratified.

## Classification method and completeness boundary

Canon §12 supplies the only allowed categories: `METHODOLOGY-CORE`, `FO-CONFIGURATION`, `PLATFORM-SERVICE`, `PLUGIN`, `SCENARIO-CONTENT`, `PARITY-UI`, and `LEGACY-DEFECT`.

The completeness boundary is objective and fail-closed:

- `references/fractured-order/tests/contracts/roleCapabilityMatrix.js`: 30 capability IDs assigned to 19 shipped role profiles.
- `references/fractured-order/tests/contracts/operationalFeatureManifest.js`: 15 non-PLI operational capability IDs.
- Four PLI exclusions in that operational manifest are covered by the role matrix and `PARITY-PLI-01`; they are excluded only from the non-PLI rehearsal gate.
- Additional observed rows cover methodology traceability, Scenario assets, and two legacy defects not represented as shipped capability IDs.
- `definitions/fractured-order/reference-inventory.json` is the machine-readable authority for every classification, source-manifest key, review state and parity target.
- `tests/parity/validate-reference-inventory.mjs` fails if a source capability is added or removed without a classification, if a named evidence file/anchor disappears, or if a parity target is missing.

## Capability matrix

The source location for each row is the named manifest plus the capability key. Each manifest entry contains the exact implementation/test files and test-name anchors.

### Role capability manifest

| Capability | Canon classification | Parity target | Review |
|---|---|---|---|
| `entry.public` | PLATFORM-SERVICE | `PARITY-ENTRY-01` | Classified |
| `entry.game_master` | PLATFORM-SERVICE | `PARITY-ENTRY-01` | Classified |
| `entry.white_cell_lead` | PLATFORM-SERVICE | `PARITY-ENTRY-01` | Classified |
| `entry.sme` | PLUGIN | `PARITY-PLI-01` | Classified |
| `scribe.orientation` | FO-CONFIGURATION | `PARITY-ORIENTATION-01` | Classified |
| `scribe.blue_action` | FO-CONFIGURATION | `PARITY-ARTIFACT-01` | Classified |
| `scribe.red_action` | FO-CONFIGURATION | `PARITY-ARTIFACT-01` | Classified |
| `scribe.green_proposal` | FO-CONFIGURATION | `PARITY-ARTIFACT-01` | Classified |
| `scribe.industry_proposal` | FO-CONFIGURATION | `PARITY-ARTIFACT-01` | Classified |
| `scribe.shared_surfaces` | PLATFORM-SERVICE | `PARITY-COMMS-01` | Classified |
| `facilitator.workspaces` | PARITY-UI | `PARITY-UI-01` | Classified |
| `facilitator.finalization` | FO-CONFIGURATION | `PARITY-ARTIFACT-01` | Classified |
| `facilitator.rfi_communications` | PLATFORM-SERVICE | `PARITY-RFI-01` | Classified |
| `facilitator.proposal_threads` | PLATFORM-SERVICE | `PARITY-PROPOSAL-01` | Classified |
| `facilitator.alerts` | PLATFORM-SERVICE | `PARITY-COMMS-01` | Classified |
| `notetaker.notes` | PLATFORM-SERVICE | `PARITY-NOTES-01` | Classified |
| `notetaker.capture_review` | PLATFORM-SERVICE | `PARITY-NOTES-01` | Classified |
| `game_master.session_admin` | PLATFORM-SERVICE | `PARITY-ADMIN-01` | Classified |
| `game_master.participants` | PLATFORM-SERVICE | `PARITY-ADMIN-01` | Classified |
| `game_master.exports_plugins` | PLATFORM-SERVICE | `PARITY-EXPORT-01` | Classified; Plugin behavior is separately classified |
| `white_cell.controls` | PLATFORM-SERVICE | `PARITY-CONTROL-01` | Classified; Release selects/configures operations |
| `white_cell.review` | FO-CONFIGURATION | `PARITY-REVIEW-01` | Classified |
| `white_cell.rfi_communications` | PLATFORM-SERVICE | `PARITY-RFI-01` | Classified |
| `white_cell.admin_exports` | PLATFORM-SERVICE | `PARITY-ADMIN-01` | Classified |
| `white_cell.pli_readonly` | PLUGIN | `PARITY-PLI-01` | Classified |
| `sme.macro` | PLUGIN | `PARITY-PLI-01` | Classified |
| `sme.ni_escalation` | PLUGIN | `PARITY-PLI-01` | Classified |
| `sme.diplomacy_information` | PLUGIN | `PARITY-PLI-01` | Classified |
| `sme.tsj` | PLUGIN | `PARITY-PLI-01` | Classified |
| `sme.verba` | PLUGIN | `PARITY-PLI-01` | Classified |

### Operational feature manifest

| Capability | Canon classification | Parity target | Review |
|---|---|---|---|
| `identity.session_topology` | PLATFORM-SERVICE | `PARITY-ENTRY-01` | Classified |
| `team.strategic_orientation` | FO-CONFIGURATION | `PARITY-ORIENTATION-01` | Classified |
| `team.artifact_authoring` | FO-CONFIGURATION | `PARITY-ARTIFACT-01` | Classified |
| `facilitator.presentation_decks` | PARITY-UI | `PARITY-UI-01` | Classified; deck payloads are Scenario content |
| `white_cell.artifact_review` | PLATFORM-SERVICE | `PARITY-REVIEW-01` | Classified |
| `proposals.recipient_threads` | PLATFORM-SERVICE | `PARITY-PROPOSAL-01` | Classified |
| `rfi.lifecycle` | PLATFORM-SERVICE | `PARITY-RFI-01` | Classified |
| `communications.notifications_realtime` | PLATFORM-SERVICE | `PARITY-COMMS-01` | Classified |
| `notetaker.operational_record` | PLATFORM-SERVICE | `PARITY-NOTES-01` | Classified |
| `white_cell.game_controls` | PLATFORM-SERVICE | `PARITY-CONTROL-01` | Classified; Release selects/configures operations |
| `plugins.intercom_recorder` | PLUGIN | `PARITY-PLUGIN-01` | Classified |
| `operator.participant_session_admin` | PLATFORM-SERVICE | `PARITY-ADMIN-01` | Classified |
| `exports.evidence_bundle` | PLATFORM-SERVICE | `PARITY-EXPORT-01` | Classified |
| `resilience.scale_degraded_sync` | PLATFORM-SERVICE | `PARITY-SYNC-01` | Classified |
| `quality.accessibility_mobile_ui` | PARITY-UI | `PARITY-UI-01` | Classified |

### Additional extracted items

| Item | Source | Classification | Parity target | Review |
|---|---|---|---|---|
| Decision-record trace across exports | `src/features/export/researchExport.js` | METHODOLOGY-CORE | `PARITY-EXPORT-01` | Classified; Release selects/configures use |
| Briefs, decks, images, audio and video | `Plenum Briefing/`, `decks/` | SCENARIO-CONTENT | `PARITY-SCENARIO-01` | Classified |
| Route/semantic inversion | `src/core/teamContext.js` | LEGACY-DEFECT | `PARITY-LEGACY-01` | Do not reproduce |
| Noncanonical upper-snake event names | `src/core/enums.js` and role controllers | LEGACY-DEFECT | `PARITY-LEGACY-01` | Do not reproduce |

## Route and interface map

| Route(s) | Observed surface | Classification / migration target |
|---|---|---|
| `index.html` | Public join, team/role selection, Game Master/White Cell/SME access | PLATFORM-SERVICE entry shell; selections become Release data |
| `master.html` | Game Master session/participant/export/plugin console | PLATFORM-SERVICE |
| `whitecell.html` | White Cell Lead controls, review, communications, administration, exports and PLI read-only panels | Generic operator modules plus FO-CONFIGURATION controls |
| `sme.html` | Five PLI/SME queues | PLUGIN |
| `plenary.html` | Venue projection of finalized PLI output | PLUGIN output in a display Interface Profile |
| `teams/{blue,red,green,industry}/facilitator.html` | User-facing Scribe workspace despite legacy path name | FO-CONFIGURATION on generic modules; legacy path inversion retained only as compatibility |
| `teams/{blue,red,green,industry}/scribe.html` | User-facing Facilitator support workspace despite legacy path name | PARITY-UI/FO-CONFIGURATION; legacy path inversion retained only as compatibility |
| `teams/{blue,red,green,industry}/notetaker.html` | Seat-scoped Notetaker workspace | PLATFORM-SERVICE modules configured by Release |

There are 17 executable top-level/team HTML routes in the pinned tree. `viewer` and `whitecell_support` are compatibility states without shipped entry paths and are not promoted into platform logic.

## Stores and services map

| Boundary | Observed files | Classification / target |
|---|---|---|
| Client stores | `actions.js`, `communications.js`, `gameState.js`, `participants.js`, `requests.js`, `session.js`, `timeline.js` | PLATFORM-SERVICE state projections; do not duplicate these decisions in new clients |
| Persistence | `services/database.js`, `supabase.js`, `supabaseMock.js` | PLATFORM-SERVICE adapter boundary; Supabase mock is test-only |
| Realtime/sync | `realtime.js`, `sync.js`, `heartbeat.js` | PLATFORM-SERVICE; replace retry/reconciliation with canonical Projection Cursor and Command Receipt behavior |
| Seat/session bootstrap | `seatBootstrap.js`, `sessionCreation.js` | PLATFORM-SERVICE; trusted server context must supply Organization, Principal, Session, Seat Assignment and Active Role Context |
| Timers | `timer.js` | PLATFORM-SERVICE; server time is authoritative |
| Regional diagnostics | `regionalDiagnostics.js` | FO-CONFIGURATION compatibility support; do not place named Green logic in platform core |

## Data map

`data/COMPLETE_SCHEMA.sql` defines the observed base tables: `sessions`, `participants`, `session_participants`, `game_state`, `actions`, `action_logs`, `action_relationships`, `artifact_workflow_reviews`, `communications`, `requests`, `rfi_action_links`, `timeline`, `notetaker_data`, `participant_activity`, `game_state_transitions`, `move_completions`, `reports`, and `data_completeness_checks`.

Additive migrations introduce these material families:

| Family | Tables / source | Classification |
|---|---|---|
| Operator/session security | `operator_grants`, `live_demo_runtime_config`; `2026-04-08_live_demo_rls_hardening.sql`, `2026-06-02_operator_code_runtime_config_table.sql` | PLATFORM-SERVICE |
| Research evidence | `research_audit_event_log`, participant/note/revision/content/transition/edge/quality/metric/identity/codebook tables; `2026-06-04_research_export_capture.sql` | PLATFORM-SERVICE with METHODOLOGY-CORE semantics pending review |
| PLI/SME | `pli_adjudications`, `sme_handoffs`, `sme_pli_packets`; July/August 2026 migrations | PLUGIN |
| Green topology | `green_roster_approvals`, `session_topology_locks`, `scoped_notetaker_data`; `2026-09-18_green_regional_storage.sql` | FO-CONFIGURATION |
| Administrative evidence | `gc08_session_creations`, `gc08_unified_seat_removals`; September 2026 migrations | PLATFORM-SERVICE |
| Training tables | `training_attempts`, `training_progress_events`; added then explicitly decommissioned by `2026-08-26_decommission_ssg_training.sql` | LEGACY-DEFECT / retired; do not reproduce |

The observed schema is evidence, not the authoritative future contract. PS-200 must map it to canonical entities rather than preserve table names or client-supplied role/tenant claims.

## Realtime and event map

`src/services/realtime.js` subscribes per Session to all PostgreSQL changes for six tables: `game_state`, `actions`, `requests`, `timeline`, `session_participants`, and `communications`. It emits local lifecycle notifications `subscribed`, `reconnected`, `error`, `reconnecting`, `reconnect_failed`, and `closed`, with bounded exponential reconnect attempts.

Observed timeline families include action create/submit/adjudicate, RFI create/answer, phase/move changes, observations and communications. Role controllers add Strategic Orientation handoff, artifact completion/return, proposal forwarding/response/review, RFI clarification, guidance and action-notification variants. These upper-snake or underscore names are observed compatibility evidence only. Canonical platform events must use past-tense lower dot-case names from the authoritative event catalog; this audit does not invent replacements.

## Hard-coding register

The authoritative 15-row register is `definitions/fractured-order/reference-inventory.json`. It covers named Teams, role/SME labels, static routes, the Scribe/Facilitator inversion, phases/moves, team-specific forms, economic catalogs, Green regional topology, PLI/SME behavior, Intercom/recorder, decks/media, static workspace composition, legacy event names, and non-enterable compatibility roles. Each row names its source and migration target.

The important extraction boundary is:

- Release data: Teams, Session Roles, Seats, Stages, Forms, Artifact Types, Workflows, Gates, catalogs, Green topology and labels.
- Platform services: identity/access, generic workflows, messaging/RFI, timers, projections/reconciliation, administration and exports.
- Plugins: PLI/SME, Intercom and recorder behavior.
- Scenario: briefs, decks and media.
- Interface Profiles: familiar workspace composition, not fixed page routes.
- Rejected legacy: route-semantic inversion as a new identifier scheme, named-role branches in core, retired training tables, and noncanonical new event names.

## Coverage map and gaps

Observed automated assets at the pin: 106 `src/**/*.test.js` files, 42 `tests/unit/*.test.js` files, 15 Playwright `tests/e2e/*.e2e.js` files, one script test, and 11 PLI tests. The capability manifests require named focused evidence and, for all non-PLI operational capabilities, named browser evidence. Historical test presence is not a current PASS.

| Area | Existing source evidence | PS-200 target | Current status |
|---|---|---|---|
| All 19 shipped role profiles | Role matrix plus role-matrix/playthrough E2E | `PARITY-ENTRY-01` and capability-specific targets | NOT RUN |
| Core non-PLI rehearsal | Operational manifest and five component E2E specs | All non-PLI parity targets | NOT RUN |
| Authorization | Join, role, policy and PLI negative tests | Cross-role and cross-tenant denial under real application role | NOT RUN |
| Disconnect/stale/duplicate | Realtime and stale-write tests/E2E | `PARITY-SYNC-01` | NOT RUN |
| Partial atomic failure | No canonical Command Receipt/Evidence Event/outbox boundary in the legacy app | `PARITY-SYNC-01`; new platform requirement, not legacy parity | NOT RUN |
| PLI | Focused role/database/feature tests; excluded from non-PLI E2E gate | `PARITY-PLI-01` | NOT RUN |
| Reports | Research-export unit and E2E reconciliation anchors | `PARITY-EXPORT-01` | NOT RUN |
| Accessibility/UI | Source/unit/E2E assertions | `PARITY-UI-01` including keyboard, zoom and reduced motion | NOT RUN |

## Resolved classification boundary

`OPEN-026` resolves the previously ambiguous rows. Generic Orientation/coverage gates, bounded Control operations and decision-trace capabilities are reusable platform options available to every simulation. Each Release chooses whether to use them and owns the exact roles, forms, labels, timing, ordering, required combinations and gate rules. Fractured Order's observed Orientation content and exact control setup remain `FO-CONFIGURATION`; reusable control execution is `PLATFORM-SERVICE`; decision-trace meaning remains `METHODOLOGY-CORE`. `DEC-22` remains Assumed and `OPEN-001` still blocks formal corpus ratification.

## Recovery and change implications

This task changes documentation, definitions and validation only. It performs no Session mutation, schema migration, external write, or product-code change. Rollback is deletion of the PS-000 audit artifacts plus reversal of the promptbook continuity edits. If the Product Owner supersedes the commit, the source rewrites history, or the Methodology Lead changes a classification, regenerate the inventory against a newly verified immutable snapshot and rerun the validator before PS-200.
