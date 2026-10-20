# PS-310 visual Core Design editor verification

Date: 2026-10-20.

## Outcome

PS-310 is implementation-complete for the bounded first-proof editor slice. A Designer can edit the canonical Core Design and Scenario through visual controls, use server-filtered Role/Stage preview, follow validation findings back to their controls, and publish only a valid synchronized Draft. No migration or new external dependency was added.

The editor writes the existing Yjs collaborative Draft and canonical `@plenum/simulation-schema` types. The preview endpoint reuses the Runtime Interface Profile resolver and applies Information Policy on the server. The UI does not expose raw JSON or arbitrary pixel placement.

## Editor coverage

| Workspace | First-proof coverage | Boundary |
|---|---|---|
| Overview and Scenario | Name, description, tags, delivery modes, and Scenario content | Template copies exclude Scenario content unless explicitly requested (`INV-007`) |
| Methodology | Canon concept switches; disabled authored content is retained | Dependency contradictions block Publication; `OPEN-004` remains labeled |
| Teams | Add, edit, enable, reorder, and remove | Stable UUID values are retained during reorder |
| Session Roles | Capabilities, eligible Teams, Control designation, and enabled state | Organization Roles remain outside Release Session Roles |
| Seats | Role/Team binding, occupancy, required state, and join mode | Ambiguous roster import/review is deferred to PS-340 |
| Stages and Stage Groups | Sequential and nested-sequential authoring, duration, reorder, and guarded removal | Branching structures are preserved but structural editing is unavailable under `OPEN-005` |
| Forms and Artifact Types | Basic sections/fields, ownership, workflow, policy, creators, decision/export flags | Advanced Form constructs remain unavailable under `OPEN-010` |
| Workflows | Guarded review template plus plain-language state/transition display | Advanced branches, loops, and timers remain unavailable under `OPEN-006` |
| Information Policy | Deny-by-default policies and explicit grants | Leakage is a blocking validation defect |
| Interfaces | Curated modules and responsive layout templates | No arbitrary pixel placement |
| Research | Research Questions and decision traceability | Missing traceability for decision-bearing Artifact Types blocks Publication |
| Access | Join methods, guest/reassignment controls, and exposure acknowledgement | Roster review is not silently approximated |
| Role/Stage preview | Session Role, Stage, optional Team, resolved modules/layout, and authorized Scenario content | Server authorization, tenant isolation, revocation, and policy omission apply before response |

## Contracts and validation

- `core-design-editor-v1` identifies the visual editor surface.
- `role-preview-v1` is owned by `@plenum/event-contracts` and exposed in OpenAPI.
- `PS-310-T01` covers 16 `REQ-011` blocking defect fixtures, including reference, Stage, workflow, interface, Information Policy, effect, report, permission, methodology, and traceability failures.
- `PS-310-T02` proves that template copies receive new Project and Scenario identities and omit Scenario content by default.
- The negative authorization proof revokes Designer membership and confirms Role Preview fails closed.

No new cross-document contradiction was found, so no candidate was added to `CONFLICT_REGISTER.md`. The named, unratified dependencies remain `DEC-31`, `DEC-32`, `DEC-33`, `OPEN-004`, `OPEN-005`, `OPEN-006`, `OPEN-010`, `OPEN-018`, and `OPEN-022`.

## Verification

Commands ran from the repository root. Non-browser gates used cached `node:24.22.0-alpine`, npm 11.19.1, a clean lockfile-installed dependency volume, and no network during execution. Database tests used a clean disposable PostgreSQL 18 database. Browser commands used the host Node 22.16.0 launcher and local Playwright Chromium, matching the existing command-registry qualification for browser evidence.

| Registry ID / command | Result | Evidence |
|---|---|---|
| `CMD-PLATFORM-LINT` / `npm run lint` | PASS, exit 0, 5.9 s | 42 sources, 23 versioned contracts, canonical naming, acyclic workspaces |
| `CMD-PLATFORM-TYPECHECK` / `npm run typecheck` | PASS, exit 0, 5.9 s | No TypeScript diagnostics |
| `CMD-PLATFORM-TEST` / `npm test` | PASS, exit 0, 8.2 s | 58/58; `PS-310-T01` 16/16 and `PS-310-T02` pass |
| `CMD-PLATFORM-BUILD` / `npm run build` | PASS, exit 0, 6.0 s | Server/package output plus Runtime and Studio production bundles |
| `CMD-PLATFORM-DB` / `npm run test:db` | PASS, exit 0, 76.1 s | 14/14 on Node 24.22.0/PostgreSQL 18, including Role Preview and revoked access |
| `CMD-PLATFORM-E2E` / `npm run test:e2e` | PASS, exit 0, 2.6 min | 11 passed; 1 live-SFU test intentionally skipped because `MEDIA_TEST_URL` was absent; visual authoring, offline convergence, preview, publication, stable Stage IDs, axe, and 200% reflow passed |
| `CMD-PLATFORM-A11Y` / `npm run test:a11y` | PASS, exit 0, 2.6 min | 5 passed; the same live-SFU proof intentionally skipped; Studio axe and 200% reflow passed |

Browser output is under `output/playwright/ps-150/`. The production build retains the existing Runtime chunk-size warning for a 532.95 kB minified chunk; this slice did not add to that Runtime bundle.

## Release and rollback

There is no schema migration. Rollback can remove the visual editor route composition and Role Preview endpoint while preserving all collaborative Draft data. Forward-fix remains preferable for already-authored optional methodology/research fields because the canonical Draft retains them.

This task is not release approval. Advanced Stage, workflow, and Form behavior remains gated, and named specialist sign-offs for the dependencies above are still required.
