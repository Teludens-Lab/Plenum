# Remaining implementation and acceptance promptbook

Updated: 2026-11-08. Governing approval: [Decision Register v1.0.16](../corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md), especially §§3, 5.7 and 7.1–7.5.

This is the execution guide for PS-815, PS-820, PS-830, PS-840, PS-842, PS-845 and PS-850. The requested “PS-40” is interpreted as the existing PS-840. PS-842 (added 2026-11-09) is a new task for the distinct role-by-role interface consistency outcome. PS-845 is a new task for the distinct authority-transfer outcome. `tasks.json` remains the single task source; linked prompts and dependency/requirements tables are generated from it. This guide does not approve a release or assert implementation completion.

Execution evidence, 2026-11-09: [PS-840 handoff](../acceptance/PS-840-UAT.md) records nine corrected gaps, blank-authored policy/crisis UI 2/2, product 37/37 and visual 4/4 with 25 captures. The Product Owner authorized the two live-golden signed-checkpoint checks to remain pending as a PS-830 prerequisite exception for PS-840 execution; both still block PS-850 and neither is PASS. The owner also instructed that new human reviews remain pending. This evidence link does not change task ownership, acceptance conditions or the final release gate.

## Outcome and ownership

The outcome is a platform on which a Designer can create and customize simulations through Studio, publish under the approved policy, run them with appropriate participants and adjudicators, and recover and export trustworthy evidence. Original Fractured Order, the Energy variation and two contrasting simulations must work without simulation-specific Runtime changes.

| Task and canonical prompt | Owns | Starting evidence | Completion boundary |
|---|---|---|---|
| [PS-815](prompts/P10/PS-815-prove-platform-control-plane-identity-workforce-production-acceptance.md) | Real identity-provider, workforce, invitation, recovery and human desktop acceptance | Internal PASS recorded 2026-11-07; external/provider/mail/human gates remain NOT RUN | Exact-candidate subsystem evidence and named approvals; no implied platform GO |
| [PS-820](prompts/P10/PS-820-verify-clean-install-upgrade-recovery-and-accessibility.md) | Install, upgrade, backup/restore, managed-device and institutional desktop accessibility | Automated PASS recorded 2026-11-07; human/institutional gates incomplete | Supported profiles and qualified human evidence; rerun affected checks after subsequent schema/deployment changes |
| [PS-830](prompts/P11/PS-830-prove-blank-install-fractured-order-golden-journey.md) | Approved authoring/runtime changes and original/Energy golden journeys | Partial local customization work exists; full journey and approved capability set are unproven | Checkpoints A–H complete, compatible contracts, supported UI-only author-to-archive proof and product acceptance |
| [PS-840](prompts/P11/PS-840-close-cross-simulation-uat-and-all-gap-rows.md) | Independent cross-simulation UAT and product completeness | PLANNED | Policy-negotiation and crisis-response journeys; all applicable product-owned rows accepted; operational/external rows remain truthful |
| [PS-842](prompts/P11/PS-842-reconcile-role-interface-consistency.md) | Role-by-role interface navigation, vocabulary, technical-detail exposure and layout consistency | PLANNED; 2026-11-09 local synthetic baseline at `output/playwright/ps-842/baseline-2026-11-09/` | Every IC-01–IC-40 row PASS, owner-approved N/A or BLOCKED on a recorded owner decision; new Release versions; regression command; affected PS-830/PS-840 reruns |
| [PS-845](prompts/P11/PS-845-implement-and-rehearse-controlled-authority-transfer.md) | Controlled authority transfer and timed operational proof | PLANNED; authority checks exist but full transfer is unproven | Transfer implementation, negative cases, measured rehearsals and named Operations/Technical review |
| [PS-850](prompts/P11/PS-850-assemble-and-approve-production-release.md) | Final candidate convergence, complete release evidence and owner decision | PLANNED / no production GO | All applicable automated, external, institutional and human gates accepted against the final candidate; explicit owner GO or NO-GO |

## Sequence and entry rules

2026-11-09 PS-840 execution exception: the Product Owner explicitly authorized deferring the two live golden Session signed Evidence checkpoint checks at PS-830 entry and proceeding with all other PS-840 implementation and validation. The checks remain pending and block final PS-850 release approval; no PASS or release waiver is inferred. Product and desktop AT owner acceptance is recorded in `docs/acceptance/PS-830-human-acceptance.md`. See `PROJECT_STATE.md` and the PS-840 execution evidence for continuity.

The recorded chain is `PS-810 → PS-815 → PS-820 → PS-830 → PS-840 → PS-845 → PS-850`, with `PS-840 → PS-842 → PS-850` alongside it. PS-842 and PS-845 are independent of each other. PS-850 additionally depends directly on PS-815, PS-820, PS-830, PS-840 and PS-842 so their unresolved gates cannot disappear behind a later task.

The 2026-11-07 owner exception allowing PS-820 to proceed with PS-815 external/human evidence outstanding is preserved in PROJECT_STATE.md. It does not waive those gates or automatically authorize exceptions for subsequent acceptance. Each task distinguishes safe independent inspection, design and fixture preparation from dependent execution, completed task acceptance and production release. Failed prerequisites block dependent work; inaccessible providers or reviewers remain NOT RUN. Record the exact prerequisite evidence and any already authorized exception before execution. No remaining task is marked unconditionally ready by this promptbook change.

PS-810 CI/security/observability evidence remains a final dependency. Missing external access is a specific evidence blocker, not a reason to declare a completed feature broken or to fabricate a substitute. Complete independent authorized work while the blocker is recorded.

## Approval-to-implementation mapping

The Register owns decision text. This table assigns work and verification only.

| Decision | Implementation owner | Independent proof / final gate |
|---|---|---|
| OPEN-004 | PS-830 B: stable concept registry, protected foundations, actual-reference dependency validation, preserved inactive drafts and executable-release behavior | PS-840 contrasting designs; PS-850 final gate |
| OPEN-010 | PS-830 C–E: bounded fields, expressions, formatted text, files, import/export and compatibility | PS-840 UAT; PS-820 affected upgrade/restore reruns; PS-850 full capability evidence |
| DEC-63 and DEC-64 | PS-830 F: single Action, multi-record adjudication and configurable per-recipient Inject completion | PS-840 contrasting workflows; PS-850 regression |
| OPEN-016 | PS-845: operator transfer, fencing, continuity, reconciliation and measured recovery | Named Operations/Technical review; PS-850 |
| OPEN-023 | Documentation process only; reconcile recovered source material if it appears | PS-850 verifies no stale “missing decision” blocker; no new runtime feature |
| DEC-21–27, DEC-30–40 and DEC-51, including DEC-62–64 replacements | Every affected task uses confirmed governance, vocabulary and lifecycle boundaries; PS-830 checks visible terminology/publication behavior | PS-840 consistency and product review; no blanket rewrite of already conforming code |

## PS-830 checkpoints

Work in bounded, reviewable changes. Finish a checkpoint's targeted verification before expanding scope. Commit only when authorized; a checkpoint is not full task PASS.

Execution evidence: [PS-830 checkpoints](../acceptance/PS-830-checkpoints.md) records owner acceptance of the overlapping baseline and PS-820, focused A–H evidence, the clean blank-install golden command and the isolated UI restore. Converged platform gates and named human acceptance are tracked there without changing task ownership or approval boundaries.

| Checkpoint | Deliver | Evidence required |
|---|---|---|
| A — Baseline | Inventory local changes, current runtime behavior, original reference, partial Energy proof and installation identity | Reproduction notes and supported clean-install prerequisite; no overwriting user work |
| B — Concepts | Shared stable-key definitions, required/optional controls and reference-based publication checks | Mandatory controls resist disabling; inactive content survives; enabled references to disabled concepts fail at the server with actionable locations |
| C — Fields and bounds | Approved basic fields/selectors/units, repeating structures, conditions and limits across Studio/server/Runtime/export | Valid, boundary, one-over, unauthorized and historical-version cases for every supported type; explicit byte convention and bounded submission size |
| D — Calculations and text | Restricted deterministic expressions and safe formatting | Server recomputation, version preservation, cycles/errors, unsafe text and hidden-data denial |
| E — Files and interchange | Reuse storage/scanning; permission-scoped attachments; versioned JSON; CSV mapping and linked repeating tables | Scan unavailable/infected/clean states, aggregate limits, access/retention, interrupted operations and lossless authorized export |
| F — Record and Inject semantics | Single-Action records, multi-record adjudication and configured recipient completion | Informational, acknowledgement-only and response-required Injects; independent recipients; duplicate/stale/revoked cases |
| G — Energy customization | Energy sector, second Facilitator in the intended team role, required contingency field and rubric adjudication | All four edits through Studio; configure Orientation/readiness through product UI; publish under applicable approval policy and run the result |
| H — Golden acceptance | Original reference and customized design through complete lifecycle | Role-by-role submission/adjudication/effects, report/replay/archive and independently verified evidence; no simulation-domain SQL, private service calls or raw JSON authoring |

Do not mistake a dropdown option for delivered field support. Do not mistake the Energy example for full OPEN-010 coverage. Do not equate successful rubric execution with scientific validation of an adjudication method: record assumptions, fixtures, expected results and limitations separately.

Use documented infrastructure and identity bootstrap for the blank install. Thereafter the golden journey creates simulation domain state through ordinary authorized product interfaces. Scripts may orchestrate browser testing and inspect evidence; they may not secretly construct the design or bypass publication and readiness.

## PS-842 checkpoints

Execution entry, 2026-11-09: the Product Owner authorized PS-842 to proceed with existing deferred evidence still pending and delegated Checkpoint A choices. See the [decision and evidence ledger](../acceptance/PS-842-interface-consistency.md). No acceptance boundary or task source is changed.

The canonical prompt holds the full IC-01–IC-40 finding catalog. This summary assigns order only.

1. **A — Baseline, ledger and decision intake:** reproduce the 2026-11-09 baseline at the supported desktop scope and create `docs/acceptance/PS-842-interface-consistency.md`. Record the owner's actual decisions on participant vocabulary, administration navigation, multi-role chip, White Cell Operator controls, theme default, timer unit and first-run imagery. Unresolved decisions keep their rows BLOCKED.
2. **B — Navigation and routing:** one Administration menu, reachable workspaces for every persona, not-found distinct from unauthorized/offline, canonical Session route, accurate role chip and one page-header pattern.
3. **C — One owner per control:** one Stage timer control, distinct adjudication names, single status and date formatters, decided White Cell pattern.
4. **D — Labels and vocabulary:** menu label equals page title in Studio and every participant role; shared concepts keep one name, icon and order; correct generated text.
5. **E — No technical detail as labels:** remove identifiers, enum keys and internal codes from primary surfaces; replace free-text ID entry with server-validated selections.
6. **F — Layout:** Teludens structure, badge semantics, bounded long work, single scroll owner, no overflow at 1024 × 768 and 200% zoom, labelled runtime header controls.
7. **G — Release configuration and docs:** new Release versions for corrected interface configuration; route inventory, participant record and view-family briefs, plus new briefs for the Platform control plane, invitations and landing.
8. **H — Regression and acceptance:** create and verify `CMD-INTERFACE-CONSISTENCY`, re-verify `CMD-PARTICIPANT-INTERFACES`, rerun affected PS-830/PS-840 evidence and complete the human role-by-role walkthrough.

PS-842 changes code and Release configuration after PS-840 product UAT. Its changes invalidate the affected PS-830 golden-journey and PS-840 UAT results, which must be rerun on the changed candidate.

## PS-845 checkpoints

1. **Contract and operator path:** inventory all writers, reuse authority ownership, establish permissions, refusal conditions, audit and interrupted-operation recovery. Inspect schemas before allocating migration IDs.
2. **Transfer implementation:** suspend/drain, prove fencing, verify continuity, atomically advance ownership/epoch, then reconnect and reconcile. Shared-database and database-replacement cases have different fencing evidence.
3. **Negative proof:** concurrent/stale/background writers, repeated operations, crashes between phases, missing isolation and missing continuity must not produce competing writers or duplicate effects.
4. **Measured rehearsals:** demonstrate the conditions and objectives in resolved OPEN-016, including operator response, on isolated infrastructure. Keep OPEN-017 database/site recovery evidence separate. Safety refusals cannot substitute for positive timing evidence.

The task creates the proposed `CMD-AUTHORITY-TRANSFER` command before invoking it. No automatic failover, new paid infrastructure or destructive production exercise is authorized by this promptbook.

## Candidate and evidence continuity

Use one release evidence index with task-owned sections. Every result identifies source commit (or an explicitly local dirty snapshot), image digest, lockfile, migration/schema, configuration, Release/Package identity, environment, tool versions, command, duration and output. Record applicable human reviewers and their actual decisions.

Historical PS-815/820 PASS results remain attached to their original artifacts. Once PS-830, PS-842 or PS-845 changes code, schemas, Release configuration or deployment configuration, assess impact and rerun affected gates. Do not copy historical PASS or signatures onto the new candidate. Assemble final evidence only after implementation converges; post-UAT corrections invalidate affected results and require re-review. This prevents “frozen” acceptance of an artifact that later feature work changes.

PS-840 closes product-owned rows; it does not require future PS-845 results to exist or pretend the entire ledger already passes. Run the structural audit there and record external/operational gaps explicitly. PS-850 runs the unscoped `npm run audit:product-completeness -- --release`; every required row must then pass. Authorized N/A exclusions remain explicit; no new exclusion or waiver is inferred from unavailable evidence.

Results use PASS / FAIL / BLOCKED / NOT RUN, with the existing ledger vocabulary retained for implementation/automated/human milestones. Prior desktop-only scope remains: supported Windows/macOS browsers, minimum 1024 × 768, equivalent 200% zoom, keyboard/pointer, forced colors, reduced motion and named desktop assistive technology. Mobile/touch is N/A under the recorded owner direction. Browser automation is not a substitute for qualified human review.

## Commands, migrations and resources

- Reuse commands registered as Verified. Proposed `CMD-GOLDEN-JOURNEY` is implemented by PS-830; proposed `CMD-INTERFACE-CONSISTENCY` by PS-842, which also re-verifies the existing `CMD-PARTICIPANT-INTERFACES` script; proposed `CMD-AUTHORITY-TRANSFER` by PS-845. Proposed commands are not claimed to exist or pass yet.
- Version changes at the existing schema/contract owner. Preserve immutable Releases, submitted form/formula versions, receipts and evidence. Rehearse representative upgrades and code rollback/forward-fix with PS-820; do not assume schema rollback is safe.
- Allocate migration numbers only after inspecting current migrations. This book reserves no speculative migration or production contract identifier.
- Check disk capacity before creating test infrastructure. Track exact task-owned containers/databases/volumes, reuse safe fixtures and clean up only resources within existing authorization. Preserve the current demo and unrelated projects; never use broad pruning as task cleanup.
- Missing tenants, mailboxes, qualified reviewers, custody or approved rehearsal environments are explicit prerequisites. Prepare concrete tests/evidence requests; do not silently switch to mocks and call the gate passed.

## Handoff and next action

PS-842 execution evidence and delegated Checkpoint A decisions are recorded in [the interface consistency ledger](../acceptance/PS-842-interface-consistency.md), with the prepared [Chrome and screen reader walkthrough](../design/user-test/PS-842-script.md). The owner authorized implementation while PS-830 signed-checkpoint and PS-840 human evidence remain pending; this does not change task acceptance or production approval boundaries.

For each checkpoint/task, record delivered behavior, changed paths, candidate identity, each test result and evidence link, remaining defects/gates, migration/compatibility implications and the next safe action. Use TASK_HANDOFF_TEMPLATE.md and PROJECT_STATE.md. Full task acceptance and final production GO are separate.

Start by reconciling the PS-815 and PS-820 handoffs and the PS-810 environment gaps, then perform PS-830 baseline inspection against the current worktree. This guide creates the work sequence; it does not execute, commit, deploy or accept those tasks.

Execution evidence: PS-830 focused A–H, the full 2/2 blank-install golden run, isolated two-Session restore, and converged local command ledger are recorded in [PS-830-checkpoints.md](../acceptance/PS-830-checkpoints.md), with a prepared [human acceptance script](../acceptance/PS-830-human-acceptance.md). Exact command records and source/Release identity are under `test-results/golden-journey`. Named human/desktop AT and independently signed live-golden Evidence checkpoint acceptance remain outstanding; task ownership and approval boundaries are unchanged.
