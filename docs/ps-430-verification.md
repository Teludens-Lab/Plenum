# PS-430 verification — two-simulation generalization gate

Date: 2026-10-23  
Mode: high-risk platform validation; synthetic local evidence only

## Outcome

Two materially different authored Releases run through the existing platform engines without Runtime code changes:

- `policy-negotiation` is communication-heavy: public statements, a restricted negotiation route, a proposal workflow with counterproposal/resubmission, and public-versus-draft projection.
- `crisis-response` is state-heavy: four Stages, typed state variables, resource allocation, counted capability, Stage effects, and a conditional Inject.

Both fixtures use synthetic institutions, Participants and content. Each Release pins schema `1.3.1`, compiler `0.1.0`, a fixed Session seed and fixed UTC time. Plugin, model, media, and external-network adapters are explicitly excluded from the deterministic evidence.

## Acceptance evidence

| Criterion | Result | Evidence |
|---|---|---|
| Both simulations complete on one Runtime build | PASS | Policy negotiation reaches `agreement` / workflow `agreed`; crisis response reaches `stabilized` / workflow `approved` |
| Runtime source is unchanged | PASS | SHA-256 before policy, after policy, and after crisis: `cf3705a4482dd582782f436505be46b023193cee66f654884f5bf7367bc9fe43` across 46 source files |
| Differences are Release configuration | PASS | Policy package digest `53fcded01a7aaefd6c6b1154ea1d95ffb85f4503275e362bfefdf525934bebe6`; crisis package digest `00dfdd1f4a2b56f2f49f5f6890e0e0d1849ef2e00f7953a0c19e31c4eb346d72` |
| Deterministic replay | PASS | Policy trace `179ebbfef3bfc410c255bf65c69f8d51fe0df7a8e45a8300c21b554909f395c7`; crisis trace `3ab4cfdf8fcae683041b4543a27be9991828b59d8bc49347b0166fdd2626ea93`; repeat runs match |
| Authorization and privacy negatives | PASS | Deliberate policy leakage is rejected; unauthorized workflow transitions are denied; cross-tenant projections return `TARGET_NOT_FOUND`; protected fields are omitted |
| Missing semantics | PASS | No new schema or engine gap was found or guessed. `OPEN-004` remains unratified |

Machine-readable evidence is generated at `test-results/generalization/ps-430-evidence.json` and validated against `tests/e2e/generalization/validation-simulation-v1.schema.json`.

## Verification

- `CMD-GENERALIZATION` — `npm run test:generalization`: PASS 1/1 on Node 24.22.1.
- `CMD-PLATFORM-E2E` — `npm run test:e2e -- --reporter=dot`: PASS 20, SKIP 1 conditional live-media case, FAIL 0 on Node 24.22.1/PostgreSQL 18/Chromium.
- `npm test`: PASS 89/89 on Node 24.22.1.
- `npm run typecheck`: PASS on Node 24.22.1.
- `npm run lint`: PASS; 57 sources, 30 versioned contracts, canonical naming and acyclic workspaces.
- `CMD-PROMPTBOOK-VALIDATE` — `npm run validate:promptbook`: PASS after promptbook render; 31 tasks, REQ 94/94, INV 28/28, no dependency cycles or warnings.

## Change and operational impact

- Runtime source changes: none.
- Architecture/topology changes: none.
- Dependencies, migrations and persisted production data: none.
- Rollback: remove the two fixture directories, the generalization test/schema, its package script, and this evidence record. Generated test evidence and disposable databases are not authoritative state.
- Release qualification: change-level GO only. This synthetic gate does not establish methodology efficacy, load capacity, production security review, deployment readiness, or release approval.
