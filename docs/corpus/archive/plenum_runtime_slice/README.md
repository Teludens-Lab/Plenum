# Plenum — PostgreSQL Studio → Package → Runtime reference slice

**Status: executable reference implementation, not production ready.** Based on `POSTGRESQL_LOGICAL_DATA_MODEL_v1.0.md`, `SYNCHRONIZATION_PROTOCOL_v1.0.md` and the approved Studio/Runtime architecture decisions. Does not implement the full Fractured Order product or offline sync/CRDT implementation. These remain architectural integration milestones.

## Prerequisites

- Node.js 22+, PostgreSQL 16 (or compatible), npm access to install the `pg` dependency; Docker Compose optional.
- The API deliberately refuses to run unless `PLENUM_LOCAL_DEMO=1` and binds only to `127.0.0.1`. **Demo identity headers are insecure and must be replaced with real authentication and session-bound authorization before any deployment.**

## Start

```bash
cd plenum_runtime_slice
npm install
docker compose up -d postgres
export DATABASE_URL=postgres://plenum_owner:local-only@127.0.0.1:5432/plenum
npm run migrate
npm run seed
export PLENUM_LOCAL_DEMO=1
npm start
# Open http://127.0.0.1:3000 and enter the organization and role user IDs printed by seed.
```

Follow the browser form steps to author the reference definition, publish an immutable revision and release, instantiate the session, assign Scribe, Facilitator and White Cell, then run `artifact.create`, `artifact.submit`, `artifact.forward` and `artifact.accept`. Switch the acting user UUID for each step, and register one device per actor. Keep the artifact UUID and increase the expected version after accepted actions.

### Database integration smoke

Run the server and set `DEMO_ORG_ID`, `DEMO_DESIGNER`, `DEMO_PUBLISHER`, `DEMO_OPERATOR`, `DEMO_SCRIBE`, `DEMO_FACILITATOR`, and `DEMO_WHITE_CELL` from `npm run seed` output, then run `npm run smoke`. This test attempts real writes, idempotent replay, evidence sequencing and the cross-role journey against PostgreSQL.

## Contents

- `migrations/001_core.sql`: six logical schemas, definitions, releases, session authority, runtime artifacts, command receipts and evidence.
- `migrations/002_integrity.sql`: memberships, registered devices, participants, composite ownership links and checkpoint metadata.
- `migrations/004_collaboration.sql`: draft CRDT update persistence *schema only*.
- `migrations/005_tenant_rls.sql`: tenant-scoped RLS for tables with organization identifiers. Application query context uses a transaction-local setting.
- `src/domain.mjs`: first-slice methodology validation and workflow transition rules.
- `src/server.mjs`: server-authoritative REST reference, atomic state + evidence + receipt + outbox, and a basic role-limited projection.
- `contracts/openapi.yaml`: machine-readable OpenAPI 3.1 description of the implemented API surface.
- `public/index.html`: local-only no-code reference workstation.
- `test/domain.test.mjs`: deterministic domain unit tests.
- `test/smoke.mjs`: optional PostgreSQL-backed end-to-end acceptance smoke.

## Explicit limits and unimplemented contracts

- Collaboration: CRDT storage schema exists, but **no Yjs merge server, multiuser presence, snapshot fencing or offline Studio collaboration yet**. The editor implements optimistic versions only.
- Offline Runtime: command receipts and idempotent retry exist; **there is no durable browser outbox, delta cursor endpoint, LAN disconnected test or client encryption** yet.
- Authority: epoch is stored and locked, but **no authenticated deployment binding or cross-deployment transfer/fencing protocol** is implemented.
- Evidence: ordered records and checkpoint schema exist, but **no signed checkpoint producer, external anchors, verification export or append-only enforcement** yet.
- Artifact policy: the starter implements an illustrative role/status projection, not generic evaluated SSG information policies or per-field projection.
- Publication: immutable revisions/releases exist in PostgreSQL; `embedded://` package pointer is a stub, not a portable downloadable simulation package compiler.
- Security: local demo header identity has **no authentication**; DB owner account is used for convenience and should not be the deployed application role. RLS alone does not guarantee security with owner or BYPASSRLS roles; test with dedicated nonowner app role and cross-tenant negative tests before production.
- Migration tooling is forward-only and minimal: rehearsal, locking, backups, rollback/forward-fix and migration integration tests have not run.
- No PostgreSQL server, Docker, or npm registry was available in the authoring environment, so only syntax checks and domain tests were executed. The PostgreSQL end-to-end smoke was **NOT RUN**.

## Verification record

| Check | Result |
|---|---|
| `node --check src/server.mjs` | PASS |
| `node --check test/smoke.mjs` | PASS |
| `npm test` | PASS (7 tests) |
| `npm install` | BLOCKED (`EAI_AGAIN`, npm registry unavailable) |
| `npm run migrate` | NOT RUN (PostgreSQL unavailable) |
| `npm run smoke` | NOT RUN (PostgreSQL unavailable) |
| Browser / authorization / air-gap / recovery / performance | NOT RUN |

**Next highest-risk development slice:** provision a real database and test migrations, harden identity/roles, then implement offline command outbox and cryptographic verification before calling these capabilities production-ready.
