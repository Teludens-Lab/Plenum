# Plenum reference slice v0.2

**Status:** executable spike for 07 Roadmap Phase 1, non-authoritative under DEC-27. Not production-ready.

It proves the first vertical slice end to end against a real PostgreSQL database: a Designer publishes a Release, an Operator starts and staffs a Session, and a Scribe → Facilitator → White Cell artifact workflow runs with the DEC-42 return paths — with roles, states, transitions and required fields all read from the published definition (DEC-45). Changing the definition changes the behavior; no code changes.

Languages: HTML, CSS and vanilla JavaScript (Node.js ES modules) plus SQL (ADR-007).

## What changed from v0.1

| v0.1 defect | v0.2 |
|---|---|
| `005_tenant_rls.sql` had broken quoting and failed | Fixed in `004_security.sql`; verified under a non-owner role |
| Roles and transitions hard-coded in `domain.mjs` and SQL `CHECK`s | Read from the Release definition; Organization Roles separated from Session Roles (DEC-44) |
| White Cell could not return; Facilitator could return from White Cell; Scribe could withdraw | DEC-42 paths exactly |
| Rejected commands left no receipt | Rejected and needs-reconciliation receipts plus Evidence Events (DEC-43) |
| Digest depended on JSON key order | Canonical serialization |
| Concurrent retries could return 500 | Per-session serialization; exactly one commit (tested) |
| Replay lost `evidenceSequence` and returned versions as strings | Original receipt returned with `replayed: true` |
| Authority taken from the client request | Deployment identity from server configuration; fenced or foreign authority refused (tested) |
| Sessions created already `active`; status never checked | `created` → `active` → `paused` → `completed`; Commands refused unless `active` |
| Evidence not append-only | Database privileges and triggers refuse UPDATE, DELETE and TRUNCATE, even for the owner |
| Server ran as database owner (RLS bypassed) | Requests run as `plenum_app` with least-privilege grants |
| Migration numbering gap (no 003) | 001–004, contiguous |

## Prerequisites

Node.js 24 or later; PostgreSQL 18 (Docker Compose provided; PostgreSQL 16 also works for local testing).

## Run

```bash
cd references/plenum-runtime-slice
npm install
docker compose up -d postgres
export DATABASE_URL=postgres://plenum_owner:local-only@127.0.0.1:5432/plenum
npm run migrate
npm run seed            # prints export lines for DEMO_* variables — run them
export PLENUM_LOCAL_DEMO=1
export PLENUM_DEPLOYMENT_ID=$(node -e "console.log(crypto.randomUUID())")
npm start               # http://127.0.0.1:3000
```

The workstation page walks through: create project → validate → publish (as publisher) → create session, staff roles and set it active (as operator) → register devices → send commands as each person. "Resend last command" demonstrates idempotent replay.

## Tests

| Command | What it covers | Needs |
|---|---|---|
| `npm test` | 12 domain unit tests: validation, DEC-42 transitions and forbidden paths, data-driven variant release, visibility, required fields, canonical digest, envelope, lifecycle, HTTP mapping | Nothing |
| `npm run smoke` | 31 end-to-end checks over HTTP: publication rules, cross-tenant denial, session gating, replay with reordered keys, idempotency collision, hidden-artifact refusal, stale version, every DEC-42 path and forbidden path, required fields, projections, receipt privacy, gap-free evidence including rejections | Server, migrated and seeded database, DEMO_* variables |
| `npm run dbtest` | 7 database tests: RLS read and write isolation under `plenum_app`, no-context denial, append-only enforcement for owner and app role, six concurrent retries commit once, foreign and fenced authority refused | As above plus `DATABASE_URL` as the migration owner |

## Verification record (2026-10-17)

| Check | Result |
|---|---|
| `node --check` on all source and test files | PASS |
| `npm test` | PASS (12) |
| `npm run migrate` on PostgreSQL 16 | PASS (001–004) |
| `npm run smoke` | PASS (31) |
| `npm run dbtest` | PASS (7) |
| Workstation page driven through the full journey in a scripted DOM (jsdom) | PASS |
| PostgreSQL 18 container | NOT RUN (no container runtime in the authoring environment) |
| Real browser, accessibility audit, load, offline client, air-gapped install, backup and restore | NOT RUN |

## Files

| Path | Purpose |
|---|---|
| `definitions/fractured-order-reference.json` | The reference Release definition (03 §10.1) |
| `migrations/001_core.sql` | Schemas; identity (organizations, persons, Organization Role memberships); studio; registry |
| `migrations/002_runtime_sync_evidence.sql` | Sessions, authority, activations, participants, seat assignments, artifacts, devices, receipts, evidence, checkpoint schema, outbox |
| `migrations/003_collaboration.sql` | CRDT document and update storage (schema only) |
| `migrations/004_security.sql` | `plenum_app` role, grants, append-only triggers, tenant RLS |
| `src/domain.mjs` | Definition validation, transition resolution, visibility, canonical digest, error mapping — no simulation names |
| `src/server.mjs` | HTTP API; Session Authority command processor |
| `src/db.mjs`, `src/migrate.mjs`, `src/seed.mjs` | Database access, migration runner, demo data |
| `public/index.html` | Local workstation page |
| `contracts/openapi.yaml` | OpenAPI 3.1 description of this API |
| `test/` | Unit, end-to-end and database tests |

## Limits (not implemented)

- **Identity:** demo headers, not OIDC (ADR-012). Never expose beyond loopback.
- **Studio:** JSON editing, not visual editors (REQ-009); no CRDT server, presence or collaborative freeze (ADR-002).
- **Information Policy:** the slice projection grants visibility to the creator and to Session Roles that held or were notified about the artifact. It does not evaluate Information Policies, teams or field-level rules.
- **Offline:** receipts and idempotent replay exist; no Offline Outbox, projection cursor, SSE stream or device encryption (Synchronization Protocol v1.1).
- **Authority transfer:** fencing is enforced on every write, but there is no transfer procedure (OPEN-016).
- **Evidence integrity:** append-only enforcement and sequences exist; no checkpoint signer, anchor or verification export (ADR-003).
- **Release activation:** only the initial activation; no live-change activation (ADR-004).
- **Publication:** single publisher approval; no review workflow, release notes, test-session policy or Package compiler (`embedded://` blob key).
- **Session lifecycle:** `created`, `active`, `paused`, `completed` only.
