# PS-800 route inventory

Status: Checkpoint A inventory complete; route implementation and visual evidence are pending.

## Route model

The route families below are the canonical audit units. Parameter examples use `:id` for readability; the UI must expose domain labels and short references rather than requiring UUID entry. `/auth/login` belongs to the configured identity provider. Local E2E supplies a synthetic persona chooser but that is not a production product route.

| View family | Route or entry | Primary roles | Primary object / mode | Current risk observed | PS-800 target |
|---|---|---|---|---|---|
| Platform lifecycle | `/` | all signed-in Organization roles | Organization, Project, Template, Release and Session catalogs | Very long mixed-purpose surface; lifecycle actions compete for attention | Bounded workspace with stable context, catalogs and guided create/open flows |
| Platform lifecycle | `/releases/:id` | Designer, Reviewer, Publisher, Operator | immutable Release detail | Provenance and action hierarchy are dense | Scannable immutable-state header, semantic provenance and role-appropriate actions |
| Platform lifecycle | `/sessions/:id` | Operator, Participant | Session entry/readiness | Entry and operational affordances can overlap | Clear readiness/entry boundary with role-aware next action |
| Studio authoring | `/studio/` | Designer | no Project selected | First-use and resume behavior need a designed state | Guided Project selection/create/resume surface |
| Studio authoring | `/studio/projects/:id` | Designer, Reviewer, Publisher | collaborative Draft; 27 section anchors | One giant long-scroll canvas; navigation and work-region ownership are weak | Persistent shell, section workspace, contextual inspector, validation and preview |
| Participant Runtime | `/sessions/:id/runtime` | Participant; configured Session Roles | Active Role Context and configured modules | Configured role surfaces share a long route; offline/local state must stay legible | Release-curated module navigation, strong active-role/state contract |
| Participant Runtime | `/?sessionId=:id` | Participant | legacy Session deep link | Duplicate entry path | Preserve compatibility only; resolve into the canonical Session/Runtime route |
| Operator control | `/admin/sessions/:id` | Operator | staffing, readiness and live control floor | Long card/KPI layout; internal identifiers appear in workflows | Continuous command surface with consequence-aware controls and semantic selectors |
| Operator control | `/admin/sessions/:id/reports` | Operator | Session report delivery | Shares admin prefix but is operational evidence | Report workspace with generation/delivery/retry states |
| Reporting/research | `/research/reports` | Research Analyst | governed research reports/exports | Event keys, evidence IDs, filenames and digests dominate | Question/purpose/consent-first workflow; technical provenance progressively disclosed |
| Replay/archive | `/admin/sessions/:id/replay` | Operator, Reviewer | captured/reconstructed replay | Raw difference codes/digests dominate | Timeline, divergence explanation and immutable evidence drill-down |
| Replay/archive | `/admin/sessions/:id/archive` | Operator, Admin | retention, hold, correction and archive | Consequence-heavy operations need hierarchy | Policy summary, reversible preparation and explicit irreversible confirmation |
| Organization administration | `/admin/members` | Admin | members and Organization roles | Dense transactional management | Semantic roster, role replacement and final-Admin/stale recovery |
| Organization administration | `/admin/plugins` | Admin, Publisher | Plugin governance/lifecycle | Technical trust/provenance details compete with decisions | Governed catalog with compatibility/status first and evidence on demand |
| Organization administration | `/admin/deployment` | Admin | deployment posture | Operational data can read like raw diagnostics | Posture, required action and bounded diagnostics |
| Organization administration | `/admin/data-policy` | Admin | retention/hold/export policy | UUID and JSON-shaped inputs are exposed | Typed policy controls, semantic scope selection and consequence preview |
| Organization administration | other `/admin/*` | Operator/Admin as authorized | fallback operational view | Prefix fallback can hide an unknown route | Explicit not-found/unauthorized behavior; no silent fallback |

## Studio section inventory

The Studio route must retain all existing capabilities while replacing the single-scroll presentation. The 27 canonical sections are: Overview, Methodology, Teams, Roles, Seats, Activities, Stages, Forms, Workflows, Policies, Communications, Injects, Content Library, Advanced Logic, Adjudication, Polls, Voice, Plugins, Compositions, Interfaces, Research, Measurements & Reports, Access, Preview, Test & Validate, Review & Publish, and Live Changes.

## Global shell requirements

- Product wordmark and Organization context remain stable.
- Project/Release/Session context uses domain labels; identifiers are secondary copyable metadata.
- Active Role Context is always visible where a person can hold multiple contexts.
- Primary navigation, work region and contextual inspector each own their scroll; the browser body must not become a 30,000+ pixel workspace.
- Unknown routes render a specific not-found state. Authorization denial and revoked access are distinct from not-found.
- Back, refresh and deep links preserve the authoritative object and section when authorized.

## Audit evidence plan

Each row will be checked in light/dark themes at the canonical viewport matrix in `state-inventory.md`, with automated axe, keyboard smoke, 200%/320 CSS px reflow, reduced motion and forced-colors checks. Screenshots are planned under `tests/visual/ps-800/<view-family>/`; no PS-800 route screenshot is claimed at Checkpoint A.

