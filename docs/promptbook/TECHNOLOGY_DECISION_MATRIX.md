# Technology decision matrix

This consolidates pointers and implementation consequences. It is not a parallel decision authority.

| Concern | Current choice | Authority | Status | Pinning task | Exit implication |
|---|---|---|---|---|---|
| Frontend | React 19.3.1 + TypeScript 5.9.3 + Vite 8.3.4; retain vanilla reference slice | ADR-007 | Implemented and browser-tested; direction owner-accepted for build while source ADR remains Proposed | PS-100, PS-150 | Keep Runtime modules Release-driven; add UI dependencies only in their owning slice |
| Backend | Node 26 target, 24 floor; npm 11.19.1 workspace monorepo; TypeScript 5.9.3 | ADR-008 | Proposed; PS-100 verified on Node 24.22.0 | PS-001, PS-100 | Technical Lead must ratify; Node 26 remains untested |
| Topology | Modular monolith and Pg-backed jobs | ADR-005 | Proposed | PS-100, PS-120 | No broker/cache/service split without measurements |
| Database | PostgreSQL 18 minimum | ADR-009 | Proposed | PS-001 | Phase 1 exit needs Pg18 evidence and approval |
| Object storage | AWS SDK 3.1152.0 S3 adapter plus local-filesystem development adapter; SeaweedFS 4.48 interoperability verified | ADR-011 | S3-compatible direction owner-accepted for build; source ADR remains Proposed | PS-130, PS-530 | PS-530 selects and validates the deployment-profile product and operations; no multi-cloud layer |
| Identity | OIDC relying party implemented with `jose` 6.2.12; Keycloak remains the local-profile candidate | ADR-006, ADR-012 | Implemented local-issuer contract; Proposed product | PS-110, PS-530 | No Supabase; remote issuer/production use needs security approval |
| Runtime realtime | HTTPS Commands plus authorized SSE deltas, opaque cursor catch-up, snapshot reset and polling fallback | ADR-010 | Implemented and tested through the PS-150 HTTP/browser boundary; direction owner-accepted for build while source ADR remains Proposed | PS-140, PS-150 | WebSocket is not Runtime transport; measured reconnect load remains PS-540 |
| Studio collaboration | Authenticated WebSocket + CRDT | ADR-002, ADR-010 | Proposed | PS-300 | CRDT never merges Runtime Commands |
| CRDT library | Yjs | Platform section 23 | Candidate | PS-300 | Pin only after compatibility spike |
| Media | Self-hosted WebRTC SFU + TURN behind adapter | DEC-49, ADR-017 | Exception Confirmed; adapter Proposed | PS-250, PS-530 | LiveKit remains candidate, not dependency |
| Extension isolation | Rootless containers; WASM/WASI additional target | ADR-018 | Proposed | PS-220, PS-230 | Python/native waits for OPEN-022 |
| Packaging | One OCI image set; Compose/Podman reference | ADR-013 | Proposed | PS-530 | Kubernetes optional only |
| Persistence | Relational current state + append-only evidence | ADR-014 | Proposed | PS-120 | No full event sourcing |
| Tenant isolation | Server context + forced RLS defense in depth | ADR-015 | Implemented and tested; ADR still Proposed | PS-110 | DB-01 passes with pooled real app role on Pg18.6 |
| Router/query/state/forms | React Router, TanStack Query, Zustand, React Hook Form | Platform section 23 | Candidates | PS-150/310 | Use only when slice needs them; pin in lockfile |
| Validation | Dependency-free JSON Schema 2020-12 objects coupled to TypeScript property keys; Zod compatibility remains open | Platform section 23; OPEN-022 | Implemented kernel / Open product policy | PS-100/310 | Do not add a second schema authority |
| Interaction editors | dnd-kit, React Flow | Platform section 23 | Candidates | PS-310/330 | Prefer native/simple controls until needed |
| Unit/browser tests | Node 24 built-in test runner plus Playwright 1.64.1 and axe 4.14.0 for Runtime browser evidence | Platform section 23 | Implemented and verified; Vitest remains unneeded | PS-100/150 | Keep Node tests for lower layers and a few critical Playwright journeys |
| Build/UI candidates | Vite, Radix, Tailwind, Tiptap | Remaining v1.2 proposals | Candidates | Owning UI task | No blanket adoption |
| SQL/client storage | `pg` 8.23.1 for server transactions; Kysely and IndexedDB/Dexie remain candidates | Remaining v1.2 proposals | `pg` implemented / others Candidates | PS-110/500 | Direct parameterized SQL is the current server path; no second query layer without demonstrated need |
| Contracts | OpenAPI 3.1; JSON Schema 2020-12 + TypeScript in `@plenum/event-contracts`, `@plenum/simulation-schema`, `@plenum/release-compiler`, and `@plenum/sync-client` | Slice observed; OPEN-022 for compatibility | Kernel, Release Package and Runtime sync contracts implemented / compatibility policy Open | PS-100, PS-130, PS-140 | Preserve historical pins; breaking compatibility rules await OPEN-012 |
| Observability | Structured logging, OpenTelemetry | Remaining proposals | Candidates | PS-120/540 | Add only to diagnose critical journeys |

Every dependency or layer must answer the repository complexity test. The lockfile, not this matrix, is the exact implementation version record.
