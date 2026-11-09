# Plenum route inventory

PS-842 reconciles the routes and visible names below. Candidate verification and remaining human evidence are recorded in [the interface consistency ledger](../acceptance/PS-842-interface-consistency.md); this inventory is not an acceptance result.

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
| Organization administration | `/admin/identity` | Admin | Identity provider | Provider configuration and delivery diagnostics | Named provider configuration with technical evidence disclosed on demand |
| Organization administration | `/admin/plugins` | Admin, Publisher | Plugin governance/lifecycle | Technical trust/provenance details compete with decisions | Governed catalog with compatibility/status first and evidence on demand |
| Organization administration | `/admin/deployment` | Admin | deployment posture | Operational data can read like raw diagnostics | Posture, required action and bounded diagnostics |
| Organization administration | `/admin/data-policy` | Admin | retention/hold/export policy | UUID and JSON-shaped inputs are exposed | Typed policy controls, semantic scope selection and consequence preview |
| Unknown route | other `/admin/*` and unmatched paths | all | Page not found | Must remain distinct from denied access and offline | Explicit not-found state and visible return action |
| Platform control plane | `/platform/organizations` | Platform Administrator | Organizations | Platform authority is distinct from Organization membership | One secondary navigation and readiness-aware list |
| Platform control plane | `/platform/organizations/:id` | Platform Administrator | named Organization | Provisioning and lifecycle consequences | One object heading and progressively disclosed technical evidence |
| Platform control plane | `/platform/administrators` | Platform Administrator | Platform administrators | Privilege changes | Named workforce and explicit consequence controls |
| Invitations | `/organization/invitations/:token` | invited Organization member | workforce invitation | Expired or invalid token | Clear acceptance or recovery state |
| Invitations | `/platform/invitations/:token` | invited first Admin | Organization onboarding | Bootstrap authority | Invitation-scoped acceptance only |
| Invitations | `/platform/administrator-invitations/:token` | invited Platform Administrator | platform invitation | Platform authority | Invitation-scoped acceptance only |
| Project demo | `/projects/:id/demo` | authorized Project roles | synthetic demonstration | Confusion with a live Session | Explicit demo state and visible Project return |

## Studio section inventory

Menu labels and section headings share `SECTIONS` in `apps/studio/src/core-design/Editor.tsx`. Sentence case preserves capitalized domain names. The 27 sections, in order, are: Overview & Scenario, Methodology, Teams, Session Roles, Seats, Activities, Stages, Forms & Artifacts, Workflows, Information Policy, Communications, Injects, Content Library, Advanced logic & world state, Adjudication Models, Polls, Voice Channels, Plugin catalog & bindings, Model Compositions, Interfaces, Research, Measurements & reports, Access & readiness, Role walkthrough, Test & validate, Review & publish, and Live Changes.

The six groups are Set the foundation; Define people and work; Design information flow; Model decisions and systems; Shape the experience; Verify and release.

## Global shell requirements

- Product wordmark and Organization context remain stable.
- Project/Release/Session context uses domain labels; identifiers are secondary copyable metadata.
- Active Role Context is always visible where a person can hold multiple contexts.
- Primary navigation, work region and contextual inspector each own their scroll; the browser body must not become a 30,000+ pixel workspace.
- Unknown routes render a specific not-found state. Authorization denial and revoked access are distinct from not-found.
- Back, refresh and deep links preserve the authoritative object and section when authorized.

## Audit evidence plan

PS-842 checks 1440x900, the supported 1024x768 desktop minimum and its 200% equivalent (512x384 CSS pixels), in explicit light/dark themes. Keyboard, reduced motion, forced colors and named desktop assistive technology remain separate evidence dimensions. Mobile/touch acceptance remains N/A under the approved scope. Current captures and machine results live under `output/playwright/ps-842/`; human results must identify the reviewer and exact candidate.


Legacy Session links at `/?sessionId=`, `/app/dashboard?sessionId=` and `/admin/dashboard?sessionId=` redirect to the canonical participant or Operator Session route, retaining the remaining query and fragment. Unknown dashboard suffixes remain not-found.
