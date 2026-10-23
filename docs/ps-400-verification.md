# PS-400 verification

Date: 2026-10-22. Status: **bounded PS-400 implementation complete and approved by the user acting as Methodology Lead and Technical Lead**. This is change-level approval, not production deployment approval.

## Delivered behavior

- `gate-expression-v1` provides typed declarative Gates bounded to depth 8, 64 total nodes, and 32 children per group. Unknown or policy-hidden Facts fail closed and explanations do not expose values.
- Stages support acyclic sequential/nested flow, priority-ordered conditional transitions, and bounded parallel forks with explicit `all` or `first` joins. Parallel paths are finite and automatic; loops, continuously timed structures, nested forks, and participant work inside a branch are rejected.
- Workflow transitions support typed Gates and deterministic priority/fallback selection. States retain assignment, due-time, quorum, and bounded automation metadata; human adjudication execution remains PS-410.
- State Values, counted Capabilities, and Resources have Release definitions and Scenario initial values. Capability consumption/renewal and Resource replenishment are atomic and bounded.
- Immediate effects run in their source transaction. Delayed effects are one-shot, Release-pinned, limited to seven days, cancellable before due, and atomically claimed when applied.
- Every applied effect records append-only before/after/source/actor/reason/version/server-time evidence. Published Release snapshots remain immutable.
- Studio provides semantic authoring controls for the supported structures without exposing authored code or raw expressions.
- `definitions/crisis-response/ps-400-rehearsal.json` supplies a fixed-clock/fixed-seed rehearsal fixture with repeatable explanations and effect traces.

Client mutation-state handling remains the existing collaborative Studio contract (`saved_on_device`, synchronized, validation required, published). PS-400 adds no second client persistence state.

## Supported-expression matrix

| Construct | Validation | Runtime/rehearsal | Status |
|---|---|---|---|
| nested `all`, `any`, `none` Gates and typed comparison operators | Size and Fact/value types checked | Deterministic; no authored code | Implemented |
| Session/Stage, actor, Artifact, State Value, Capability, Resource, Inject and server-time Facts | Unknown Facts rejected | Missing/hidden Facts fail closed | Implemented where the Command supplies the Fact |
| sequential, nested and priority-conditional Stages | References, priorities and cycles checked | Entry/exit Gates and effects execute | Implemented |
| bounded parallel Stage fork with explicit `all` or `first` join | Unsafe/unbounded branch content rejected | Deterministic fork/join; losing `first` branches cancel | Implemented |
| gated Inject release | Typed Gate required | Claim-once; effects atomic | Implemented |
| conditional workflow transitions | Unique priorities; at most one lowest fallback; path to terminal required | Highest eligible transition wins | Implemented |
| assignment, due-time and approval quorum metadata | Shape and eligible roles checked | Stored for later human review execution | Implemented metadata; execution belongs to PS-410 |
| counted Capability consumption/renewal and Resource replenishment | Nonnegative bounded quantities | Atomic Stage-entry transactions | Implemented |
| delayed State Effects | Integer delay `0..604800` | One-shot, Release-pinned, pre-due cancellation | Implemented |
| loops and continuous timing | Rejected/not modeled | Not executed | Prohibited by PS-400 |

`OPEN-005` and the PS-400 baseline of `OPEN-006` are resolved. The delayed-effect, snapshot and Capability parts of `OPEN-018` were resolved here; its remaining adjudication, information-delivery and objective-modeling questions were resolved with PS-410 on 2026-10-22. `OPEN-022` remains at its resolved baseline.

## Evidence

Environment: Node 24.22.1/npm 11.19.1 in Docker; TypeScript 5.9.3; PostgreSQL 18.6 Alpine; SeaweedFS 4.48; Playwright 1.64.1 Chromium 156.

| Gate | Result | Evidence |
|---|---|---|
| `npm run setup:e2e` | PASS | Existing Node 24 Debian runner verified Chromium plus all required Linux libraries. |
| `npm run typecheck` | PASS | Strict source type check after runtime/editor integration. |
| `CMD-PLATFORM-TEST` / `npm test` | PASS, 85/85 | Gate failures, conditional selection, parallel `all`/`first`, unsafe branch rejection, unknown Facts and deterministic rehearsal are covered. |
| `CMD-PLATFORM-INTEGRATION` / `npm run test:integration` | PASS, 19/19 | Fresh Pg18/S3-compatible services cover RLS, atomic counted consumption, one-shot delayed application and pre-due cancellation. |
| `npm run build` | PASS | Server/shared TypeScript and both web applications compiled; only the existing Vite chunk-size warning remains. |
| focused PS-400 Playwright/axe flow | PASS, 1/1 | Studio authored bounded branches, counted renewal and delayed effects; screenshot: `output/playwright/ps-150/ps-400-advanced-logic.png`. |
| aggregate `CMD-PLATFORM-E2E` | PASS, 18 passed / 1 conditional media skip | Clean Pg18 run completed every aggregate Runtime and Studio test in 8.5 minutes. The separate media test remains intentionally excluded unless `MEDIA_TEST_URL` is set. |
| `CMD-PLATFORM-MEDIA` | PASS, 1/1 | Rerun against pinned loopback LiveKit 1.13.10 with two authenticated Chromium Participants and synthetic microphone audio. |
| `CMD-PS210-INFORMATION-LOAD` | MEASURED, integrity PASS | 500/500 broadcast and Inject recipients/deliveries; 815.37 ms broadcast and 1,341.10 ms Stage-entry Inject on the recorded disposable environment. OPEN-019 still lacks approved acceptance budgets. |
| migration 001-019 rehearsal | PASS | Full chain applied to a fresh PostgreSQL 18.6 database; all four PS-400 tables, four RLS-enabled relations and the append-only trigger were present. |
| logical backup/restore rehearsal | PASS | Synthetic 500-Participant database restored into a separate database with matching key counts; PS-400 tables, RLS and append-only trigger survived. |
| `CMD-PROMPTBOOK-VALIDATE` | PASS | Node 24 validation after source/output alignment: 31 tasks, REQ 94/94, INV 28/28, no dependency cycles or warnings. |

`npm run setup:e2e` now installs the pinned Chromium executable and required Linux libraries on a fresh runner. Runtime refreshes ignore stale overlapping responses, Studio reconnect is restart-safe, and browser tests wait for authoritative synchronization before dependent actions.

## Migration and recovery

Migration `019_world_state_automation.sql` is additive because migration 018 was already occupied. It adds counted Capability state plus one-shot scheduled-effect storage, append-only State Transactions, idempotency and tenant RLS. Deploy it before code that reads the new data. Existing Sessions initialize Release-owned world state idempotently on the first relevant Command.

Rollback means rolling back the application while preserving the new tables and evidence. Do not drop State Transaction or scheduled-effect history; disable affected definition publication and forward-fix defects.

## Remaining release work

- PS-400 itself is implemented and approved for inclusion in a release.
- Aggregate browser, real-media, 500-Participant load integrity, PostgreSQL 18 migration and logical backup/restore rehearsals now have current evidence.
- OPEN-019 still needs approved latency/hardware budgets before the measured load result can become a capacity acceptance result.
- Formal security/accessibility review and an authorized production deployment decision remain release gates; no production system or production data was changed by this rehearsal.
