# Requirement change impact procedure

Use this procedure when a PRD requirement/invariant, Decision Register entry, contract, or Roadmap acceptance rule changes. It is an impact-analysis record, not a parallel requirement source.

## Intake record

| Field | Required value |
|---|---|
| Change identifier | Existing REQ/INV/DEC/ADR/OPEN/contract ID and source version |
| Authority and status | Confirmed, Assumed, Approved, Proposed, or resolved OPEN |
| Old/new source anchors | Exact paths and sections; link diff if available |
| Reason and owner | Product/domain rationale and authorized owner |
| Effective boundary | Drafts only, new Releases, active Sessions, deployment profile, or all data |
| Breaking classification | Additive, behavior change, incompatible, privacy/security, or operational |

## Required impact scan

Review and record affected:

- Canonical terms, domain invariants, entities, state transitions, ownership, and error codes.
- Commands, receipts, evidence events, projections, APIs, WebSocket/SSE messages, and OpenAPI/JSON Schema.
- Database schema, RLS, migrations, indexes, backfill, retention, backup, and restore.
- Package/Release signatures, Governing Release pinning, active and archived Session replay.
- Runtime, Studio, reports, analytics definitions, exports, and accessibility states.
- Plugin SDK/manifests/permissions, voting definitions/method versions, and voice grants/consent.
- Hosted, managed-LAN, and fully disconnected profiles; air-gap dependency closure.
- Task graph, source/decision/conflict registers, traceability, commands, gates, tests, and documentation.

## Compatibility decision

Choose and justify exactly one:

1. **Additive compatible:** older readers ignore the addition safely; tests prove it.
2. **Dual-read/write transition:** use expand -> backfill -> switch -> contract with explicit version window.
3. **New Release only:** active Sessions stay pinned; new behavior requires a newly published Release.
4. **Breaking migration:** requires explicit approval, rehearsed data conversion, client/plugin coordination, recovery plan, and communication.
5. **Rejected/deferred:** no implementation; record rationale and revisit trigger.

Update `CONTRACT_COMPATIBILITY_MATRIX.md` and `DATA_MIGRATION_REGISTER.md` for choices 2-4. A reversible code deploy does not make a data migration reversible.

## Task and evidence update

- Preserve existing executed task IDs and evidence. Add or revise tasks through `PROMPTBOOK_CHANGE_CONTROL.md`.
- Update mappings in `tasks.json`; never mint a substitute requirement ID.
- Add regression evidence at the lowest effective level plus boundary/integration coverage where the contract changed.
- For active Sessions, test Governing Release pinning, stale clients, replay, and mixed-version behavior.
- For privacy/security changes, require the appropriate reviewer and negative leakage tests.
- Re-render and validate the promptbook; validation must return zero orphans, cycles, invalid states, and sample-rubric failures.

## Closure record

Record owner approval, merged implementation/task references, migration state, compatibility window, evidence artifacts, release/deployment inclusion, rollback/forward-fix status, and obsolete-path removal trigger. Do not mark the change effective merely because its prompt was generated.

## 2026-11-08 approval implementation alignment

Register v1.0.16 assigns OPEN-004/010 and DEC-63/64 implementation to PS-830, independent generalization to PS-840, OPEN-016 to PS-845, and final acceptance to PS-850. OPEN-023 creates no runtime work. Concept/form/schema/renderer/export changes invalidate affected golden, UAT, installation and human evidence; authority-path changes invalidate affected identity, runtime, recovery and operational evidence. Preserve original evidence identities and rerun affected gates after changes.
