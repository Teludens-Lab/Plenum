# PS-300 verification

Date: 2026-10-20. Mode: high-risk production-oriented implementation evidence in disposable local infrastructure; not release approval.

## Delivered

- The Studio provides a semantic visual form for scenario metadata; end users do not edit raw JSON. It exposes the four canonical save states: saved on this device, synchronized, validation required and published.
- `studio-crdt-v1` uses Yjs 13.6.33 over an authenticated `ws` 8.22.0 WebSocket. The server rechecks current Organization membership, Authentication Session and Designer authority for each update and before each broadcast.
- Immutable updates retain server-authoritative receipt time, author, client context, generation, byte count and digest. Duplicate update IDs return the existing result. Individual updates are limited to 256 KiB, documents to 32 MiB, socket messages to 384 KiB and each author/document to 120 accepted updates per minute.
- The server deterministically materializes the merged Draft and runs continuous source-linked validation. CRDT convergence is not treated as validity, and validation errors prevent publication.
- Publication freezes one exact state vector, materialization, validation report and update count. The freeze is immutable, the resulting Definition Revision records its source freeze, and later edits continue in the next Draft generation without changing published bytes or digests.
- Presence is not authoritative. Comments and suggestions are intentionally absent.

## Acceptance evidence

| Evidence | Result |
|---|---|
| `SYNC-01` partition/reconnect | PASS: two offline Yjs clients applied concurrent edits, then exchanged reversed and duplicate updates and converged to the same encoded bytes |
| `SYNC-02` durable authoritative merge | PASS: attributed updates persisted once, reconnect returned the merged state, and current authorization was rechecked throughout the WebSocket path |
| `AC-01` convergence versus validity | PASS: the merged Draft converged byte-for-byte while an invalid workflow still produced a source-linked error and publication was denied |
| `AC-02` fenced publication | PASS: a delayed publication froze one state vector and immutable Definition Revision; a later edit remained in the next Draft generation and did not alter the Release |
| Unauthorized, revoked, stale and oversized paths | PASS in targeted integration/unit coverage: role checks fail closed, repeated IDs deduplicate, a pre-freeze client update is assigned to the current next-Draft generation, and the 256 KiB update and 120/minute author/document limits reject excess traffic |

## Registered commands

| Reference | Command and environment | Result |
|---|---|---|
| `CMD-PLATFORM-TEST` | `npm test`; repo root; Node 24.22.0/npm 11.19.1 in an isolated dependency volume with network disabled | PASS, exit 0, 40/40 |
| `CMD-PLATFORM-INTEGRATION` | `npm run test:integration`; repo root; Node 24.22.0, clean PostgreSQL 18 database, disposable SeaweedFS 4.48 | PASS, exit 0, 15/15, 168.6 s |
| `CMD-PLATFORM-E2E` | `npm run test:e2e`; repo root; host Node 22.16.0 launcher, clean PostgreSQL 18 database, Playwright 1.64.1 Chromium | PASS, exit 0, 10 tests passed in 2.9 min; one pre-existing real-SFU test intentionally skipped because `MEDIA_TEST_URL` was absent; the PS-300 test passed |

Additional checks: `npm run typecheck` PASS; Node 24 `npm run lint` PASS for 40 sources and 22 contracts; `npm run build` PASS; TLS-verified `npm audit --omit=dev --json` PASS with zero advisories. The PS-300 browser journey ran axe with no violations and checked keyboard-operable forms, announced save/publication states, linked validation issues and 200% text without horizontal overflow. The browser launcher remains Node 22 because the installed Chromium toolchain is Windows-hosted; application, unit and database checks were repeated on required Node 24.

## Architecture, migration and recovery

The topology remains one modular monolith and PostgreSQL database. Studio collaboration is a separate authenticated WebSocket boundary because concurrent Draft editing requires bidirectional synchronization; Runtime state continues to use the existing HTTPS Command and authorized delta protocols. No presence service, queue, cache or additional database was introduced.

Migration `015_collaboration_runtime` is additive. It adds CRDT generation/state-vector/materialization metadata, an update rate index, immutable tenant-scoped publication freezes and Definition Revision freeze provenance, while backfilling materializations from existing Drafts. Migrations 001 through 015 were rehearsed on clean PostgreSQL 18 databases. Old application versions can continue reading the existing Draft table. After first use, rollback means stopping new Studio collaboration connections and publication, preserving all update/freeze/revision rows, and forward-fixing the schema; published provenance must not be dropped or rewritten.

## Changed files

- Studio client: `apps/studio/package.json`, `apps/studio/tsconfig.json`, `apps/studio/index.html`, `apps/studio/src/App.tsx`, `apps/studio/src/main.tsx`, `apps/studio/src/styles.css`, `apps/studio/src/collaboration/client.ts`, `apps/studio/vite.config.ts`.
- Collaboration server/data: `apps/server/migrations/015_collaboration_runtime.sql`, `apps/server/src/studio/collaboration/service.ts`, `apps/server/src/studio/collaboration/gateway.ts`, `apps/server/src/http/runtime-http.ts`, `apps/server/src/registry/publication.ts`, `apps/server/src/index.ts`, `apps/server/contracts/openapi.yaml`, `apps/server/package.json`, `apps/server/tsconfig.json`.
- Validation/contracts: `packages/validation-engine/package.json`, `packages/validation-engine/tsconfig.json`, `packages/validation-engine/src/index.ts`, `packages/validation-engine/test/validation.test.mjs`, `packages/event-contracts/src/index.ts`.
- Build/test wiring: `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.typecheck.json`, `scripts/contract-lint.mjs`, `apps/server/test/identity.integration.test.mjs`, `tests/e2e/fixture.mjs`, `tests/e2e/global-setup.mjs`, `tests/e2e/runtime-server.mjs`, `tests/e2e/runtime.spec.mjs`.
- Browser evidence refreshed by the full suite: `output/playwright/ps-150/operator-accepted.png`.
- Continuity: `docs/promptbook/DATA_MIGRATION_REGISTER.md`, `docs/promptbook/TECHNOLOGY_DECISION_MATRIX.md`, `docs/promptbook/COMMAND_REGISTRY.md`, `docs/promptbook/PROJECT_STATE.md`, `docs/ps-300-verification.md`.

## Release limits

- ADR-002 and ADR-010 were Approved by Product Owner direction on 2026-10-20. Their named Technical Lead and Security Owner sign-offs remain required.
- At verification time, OPEN-013 remained unresolved and the local slice permitted the current Publisher to publish with `requireDistinctApprover: false`. OPEN-013 was subsequently resolved by user direction on 2026-11-01. The existing slice still does not prove the new production two-person integrity rule; enforcement and regression evidence are assigned to PS-760.
- At PS-300 completion, offline changes survived an in-page network partition only in memory; reloading or closing an offline tab lost its unsynchronized local queue. PS-500 later added a persistent encrypted Offline Outbox, and OPEN-014 was resolved by user direction on 2026-10-23; production managed-device and high-security key controls still require accreditation evidence.
- Formal Security Owner/Operations Owner approval, collaboration/publication load, production recovery, deployment and manual assistive-technology review remain pending.

## Next eligible task

PS-310 — Build the visual Core Design editor slice.
