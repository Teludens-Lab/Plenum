# PS-700 - Ship the Teludens design foundation, testable entry shell, and completeness ledger

## ID / title / goal / user outcome / risk

- ID: `PS-700`
- Title: Ship the Teludens design foundation, testable entry shell, and completeness ledger
- Goal: Establish the catalog-governed Teludens UI foundation and a public product entry that makes every remaining platform obligation visible and immediately testable.
- User outcome: A user opens Plenum at the root URL, recognizes the official platform brand, signs in, navigates a functional Teludens shell, and follows a five-minute smoke test without knowing internal identifiers.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-009`, `REQ-046`, `REQ-064`, `REQ-069`, `REQ-071`, `INV-001`, `INV-002`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-009`, `REQ-046`, `REQ-064`, `REQ-069`, `REQ-071`, `INV-001`, `INV-002`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — PRD section 6
- `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md` — 07 Roadmap section 12
- `references/teludens-design-system-catalog/docs/TELUDENS_DESIGN_LANGUAGE.md` — Teludens Design Language sections 0 through 13
- `references/teludens-design-system-catalog/docs/SPATIAL_GRAMMAR.md` — Teludens Spatial Grammar sections 1 through 14
- `references/teludens-design-system-catalog/docs/EXPERIENCE_PHYSICS.md` — Teludens Experience Physics sections 1 through 15
- `references/teludens-design-system-catalog/docs/PLENUM_REFERENCE_SLICE.md` — Teludens Reference Slice sections 1 through 20

Observed source evidence:

- apps/studio/src/App.tsx
- apps/runtime-web/src/App.tsx
- apps/server/src/http/runtime-http.ts
- references/teludens-design-system-catalog/README.md
- references/teludens-design-system-catalog/docs/TELUDENS_DESIGN_LANGUAGE.md
- references/teludens-design-system-catalog/docs/SPATIAL_GRAMMAR.md
- references/teludens-design-system-catalog/docs/EXPERIENCE_PHYSICS.md
- references/teludens-design-system-catalog/docs/PLENUM_REFERENCE_SLICE.md
- references/teludens-design-system-catalog/docs/TELUDENS_TOKENS.json
- references/teludens-design-system-catalog/assets/logos/Plenum. Wordmark Dark.png
- references/teludens-design-system-catalog/assets/logos/Plenum. Wordmark Light.png

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: none.

## Prerequisites

Task prerequisites: `PS-550`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Every Teludens catalog specification, token source, responsive rule, component specimen and logo asset
- Current direct Project and Session URL parsing
- OIDC login/callback and authentication failure behavior
- All PRD requirements, Studio sections 3-27, Runtime sections 2-23 and existing parity targets
- Existing E2E fixture seeding and screenshot evidence

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Canonical Teludens token import, theme mapping, Focus/Standard/Operations density, shared primitives and interaction-state contracts
- Official Plenum dark/light catalog wordmarks with responsive sizing, accessible naming and theme-safe use
- Authenticated landing shell, global navigation, sign-in/out and account context
- Loading, empty, error, unauthorized and offline entry states
- Machine-readable completeness ledger covering requirements, personas, screens, APIs, states, viewports and operational gates
- A product-smoke Playwright command using public UI entrypoints

Expected paths are discovery targets, not permission to invent absent structure:

- packages/design-system/ or the established shared UI package
- apps/platform-web/public/branding/ or the established asset pipeline
- apps/platform-web/ or the established shared-shell location
- apps/server/src/http/
- tests/e2e/product/
- docs/promptbook/PRODUCT_COMPLETENESS_MATRIX.md
- package.json

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Copy or pipeline the two catalog wordmarks without redraw, recolor, distortion or simulation-specific substitution; use the dark mark on light materials and the light mark on dark materials
- Reconcile the rendered v1.3 Graphite/Mineral Sage decision mapping with the specification's Electric Vermilion decision tokens in one reviewed, versioned semantic map before broad propagation; record the chosen mapping and never mix the two accidentally
- Create semantic token and component foundations from the catalog before building the entry shell; prohibit reusable raw color, spacing, radius and motion values
- Implement the catalog shell, continuous surfaces, Node/Branch/Path/Gate/State grammar, explicit scroll ownership and reduced-motion behavior
- Add a route-aware accessible shell that does not require a known UUID
- Expose current identity, Organization context, navigation destinations and actionable empty states
- Create a completeness-ledger validator that rejects missing ownership or evidence rows
- Add a short user smoke script and capture desktop, narrow-width and 200-percent-text evidence

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Reuse the existing trusted OIDC, Organization Role, Session Role, Seat and RLS boundaries
- Return only server-authorized data and test cross-Organization, cross-Session and revoked access
- Use synthetic test identities and never expose secrets or protected content in screenshots or logs

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Preserve idempotent Commands, immutable Releases and Governing Release pins
- Make persistent mutations transactional and version-aware
- Test duplicate, stale, interrupted and concurrent user actions

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not implement later Project, Studio or Session workflows in this task
- Do not weaken authentication for local convenience
- Do not mark historical fixture coverage as user acceptance

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then every rendered entry-shell value comes from the Teludens semantic system and every reusable primitive has documented states, density and accessibility behavior
- Given the documented preconditions, when the task behavior is exercised, then the catalog Plenum wordmark is the only platform logo in light and dark themes and remains legible without distortion at supported sizes
- Given the documented preconditions, when the task behavior is exercised, then the catalog palette discrepancy has one documented production mapping, visual evidence in both themes and no conflicting raw decision-signal values
- Given the documented preconditions, when the task behavior is exercised, then opening the root URL presents a useful authenticated or sign-in state without a Project or Session ID
- Given the documented preconditions, when the task behavior is exercised, then keyboard and screen-reader users can navigate the shell and recover from authentication failure
- Given the documented preconditions, when the task behavior is exercised, then the completeness ledger contains every PRD requirement, Studio/Runtime section, persona journey, UI state and release control with one owner and evidence target
- Given the documented preconditions, when the task behavior is exercised, then a user can complete the smoke script from a clean browser profile

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Versioned Teludens design-system foundation and conformance contract
- Official Plenum dark/light branding integration
- Testable landing shell
- Product completeness matrix and validator
- Product E2E harness
- Five-minute user smoke script

## Tests

Required test/evidence IDs: `PS-700-T01`, `PS-700-T02`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-LINT`, `CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PRODUCT-E2E`, `CMD-GAP-AUDIT`, `CMD-PLATFORM-A11Y`, `CMD-TELUDENS-AUDIT`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Existing Studio and Runtime deep links remain valid
- No tenant or Session data is disclosed in navigation
- The new ledger fails on an omitted obligation
- Teludens semantic tokens, spatial grammar, experience physics and canonical Plenum reference slice remain conformant
- Only the catalog Plenum dark/light wordmarks are used as platform branding; simulation content cannot replace platform identity

The approval gate is: Change-level acceptance requires passing automated evidence and a completed user-test script; production approval remains separate.. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update PRODUCT_COMPLETENESS_MATRIX.md and PROJECT_STATE.md
- Record exact user-test evidence and unresolved defects
- Update authoritative contracts and compatibility/migration registers when changed

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-700-ship-testable-entry-shell-and-completeness-ledger`
- Proposed subject: `feat(shell): establish Teludens entry and gap ledger`
- Expected migrations: none
- Expected API/contract IDs: `product-shell-v1`, `product-completeness-ledger-v1`, `teludens-design-system-v1`, `plenum-brand-assets-v1`

Proposed body:

```text
Why:
- Replace UUID-only entry with an immediately testable authenticated product shell and establish a fail-closed ledger for every remaining product and UI obligation.
What:
- A user can open Plenum, sign in, understand where they are, reach a useful home screen, and follow a written smoke script without database seeding knowledge.
Verification:
- Run the listed automated gates and the task user-test script.
Compatibility / migrations:
- Preserve existing Releases and Sessions; use the named additive migration when required.
Risks / follow-up:
- Any unverified or inaccessible workflow remains a blocker.
Refs: PS-700, REQ-009, REQ-046, REQ-064
```

Proposed PR description:

Summary: A user can open Plenum, sign in, understand where they are, reach a useful home screen, and follow a written smoke script without database seeding knowledge. Risks: high workflow and authorization regressions. Migration: none. Evidence: automated checks, screenshots, and the task user-test script. Rollback: revert the bounded UI/API slice and forward-fix any additive schema change.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: The governing product specification changes; User testing finds a missing or unusable workflow; A dependency or release gate changes.
