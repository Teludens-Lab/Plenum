# Plenum build-audit remediation promptbook

Updated: 2026-11-10. Source: [Current build audit — 2026-11-10](../release-evidence/2026-11-10-build-audit.md), audited candidate `4eff8d513aaa87be6d7748149093ab7362c33a4e`.

This single execution guide addresses all ten audit findings and the declared functionality, acceptance, documentation and measurement gaps. It uses the sixteen sections in [PROMPT_TEMPLATE.md](PROMPT_TEMPLATE.md). `BA-*` identifiers are local work-package and evidence references, not new product requirements or canonical PS tasks. [tasks.json](tasks.json) remains the task authority; generated PS prompts are not edited by this book. The audit is historical evidence, not proof that the current worktree still has every defect.

**Starting status: planning only; no remediation or new verification is claimed.** Treat execution as pre-production remediation with production-grade verification at the affected boundaries. Reproduce each issue against the current candidate before changing it. An already-fixed issue needs current regression evidence, not a duplicate implementation.

## How to execute this book

Use the common execution contract below together with one complete BA prompt. Work in the listed order unless the stated dependency and shared-file inventory justify a different order. Complete independent safe work when an external prerequisite is unavailable; keep dependent acceptance BLOCKED or NOT RUN. Do not infer authorization to deploy, purchase services, change custody policy, or accept release risk from this document.

| Order / prompt | Audit coverage | Existing ownership to consult | Execution dependency / exit evidence |
|---|---|---|---|
| [BA-01](#ba-01--bind-login-to-the-initiating-browser-and-constrain-redirects) | Findings 1 and 9: login binding and redirect | PS-110, PS-815, PS-810 | Current identity contract; two-browser denial and safe return paths |
| [BA-02](#ba-02--isolate-anonymous-and-authenticated-command-limits) | Finding 2: shared command allowance | PS-120, PS-810 | Current limiter contract; anonymous exhaustion cannot deny another participant |
| [BA-03](#ba-03--enforce-browser-origin-and-csrf-boundaries) | Finding 10: Studio Origin and HTTP mutation boundary | PS-300, PS-810, PS-815 | Coordinate BA-01 cookie changes; approved/rejected origins through real boundaries |
| [BA-04](#ba-04--revoke-expired-and-released-radio-floor-permissions) | Finding 3: provider transmit revocation | PS-250, PS-780 | Approved media environment for provider proof; durable revocation and safe succession |
| [BA-05](#ba-05--run-scheduled-work-for-every-eligible-organization) | Finding 5: bootstrap-only background work | PS-210, PS-520, PS-810 | Approved deployment authority; second-Organization automatic scheduling and retention |
| [BA-06](#ba-06--connect-runtime-publication-and-idle-client-synchronization) | Finding 4: disconnected Runtime synchronization | PS-140, PS-780 | BA-05 tenant discovery; automatic publish and two idle connected clients |
| [BA-07](#ba-07--enforce-automatic-form-attachment-expiry) | Finding 6: attachment retention | PS-830, PS-520 | BA-05 and existing legal-hold policy; read denial and automatic journaled deletion |
| [BA-08](#ba-08--connect-governed-plugin-model-runs) | Finding 7: production Model Runs | PS-220, PS-230, PS-330, PS-790 | Approved executor boundary and immutable artifacts; real run, approval and effect |
| [BA-09](#ba-09--make-replay-behavior-and-availability-truthful) | Finding 8: unavailable Replay and identity fixture | PS-520, PS-790 | Pinned history; real reconstruction or explicit unavailable state with open capability gap |
| [BA-10](#ba-10--schedule-independently-verifiable-evidence-checkpoints) | Declared signed-evidence gap | PS-510, PS-830, PS-850 | BA-05 and approved signer/anchor custody; both live golden Sessions verified |
| [BA-11](#ba-11--prove-the-production-composition-root) | Why green tests missed the gaps | PS-810, PS-815, PS-820, PS-830, PS-840 | BA-01–10 affected behavior ready; production-entrypoint regression evidence |
| [BA-12](#ba-12--measure-current-performance-and-recovery) | Declared performance gap and audit measurement limits | PS-540, PS-545, PS-820, PS-845 | BA-11 stable candidate; measured frontend, load, soak and affected recovery evidence |
| [BA-13](#ba-13--reconcile-the-overview-and-evidence-records) | Stale README; preserved prior acceptance | PS-830, PS-840, PS-842 | Can prepare early; finalize from BA-01–12 actual evidence |
| [BA-14](#ba-14--assemble-the-exact-candidate-release-decision) | Open release ledger, external gates and final approval | PS-810, PS-815, PS-820, PS-830, PS-840, PS-842, PS-845, PS-850 | All applicable evidence and named decisions; explicit GO or NO-GO |

BA-04 may prepare its tenant-scoped reconciler before BA-05; BA-05 must integrate it into shared deployment coverage before BA-11. Most wiring prompts touch `deploy/compose/profile-service.mjs`; finish and reconcile those changes serially. No new generic job framework is implied.

## Common execution contract

This contract applies to every prompt and is part of its instructions.

- Read `AGENTS.md`, `rules/QA_STANDARDS.md`, `docs/promptbook/PROJECT_STATE.md`, the audit, the relevant PS task in `tasks.json`, and its current generated prompt. For UI work also read `rules/UNIVERSAL_DESIGN_STANDARDS.md` and the applicable Teludens references and design briefs.
- Start from section 16 of `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md`. Read cited requirement rows in `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md`; use `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` for decision status and `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` for terminology. Read the smallest relevant architecture, schema and contract sections. Existing PS tasks supply additional source anchors; this book does not override them.
- Run `git status --short`, inspect overlapping changes, and record source identity and dirty-worktree scope. Preserve unrelated work. Read callers, tests, fixtures, configuration, exports and migrations before editing. Paths below are observed discovery targets, not permission to invent an absent API or file.
- Run every Node/npm command with Node 24 or newer. Record `node --version`; an older runtime is diagnostic only. Use the root lockfile and existing libraries. Do not add infrastructure, dependencies or abstractions without a demonstrated need.
- Resolve validation IDs in [COMMAND_REGISTRY.md](COMMAND_REGISTRY.md). Execute Verified commands only, or implement and verify an explicitly owned Proposed command first. Existing command PASS records are historical. New regression cases must be reached by an actual script/CI command; register a new command only if an existing harness cannot serve the purpose.
- Derive Principal, Organization, Session, Seat Assignment, Active Role Context and Authority Epoch from trusted server context. Preserve RLS and Session authorization separately; omit unauthorized data server-side. Use synthetic identities and no secrets or private payloads in artifacts.
- Preserve canonical UUIDs, camelCase JSON, snake_case SQL, server-authoritative UTC time, DEC-38 command/event names and the error envelope in `docs/corpus/02_Updated_Architecture/09_API_EVENT_WORKFLOW_CONTRACTS_v1.3.md`. Keep Session state changes, Command Receipts, Evidence Events and transactional outbox writes atomic. External effects need explicit recovery; do not hold a database transaction across an unbounded provider request.
- Pin Governing Release, schema, contract, Plugin and adapter versions. Preserve idempotent receipt replay. Inspect existing migration numbers before assigning any; use compatible additive changes and document rollback or forward-fix. Do not rewrite historical Releases, evidence or submissions.
- Check disk capacity before disposable infrastructure. Record exact task-owned database/container/volume identifiers; preserve demos and unrelated services. No broad pruning, production fault injection, destructive restore, paid service creation, production secret changes, `git add .`, force push or destructive reset.
- Test the boundary claimed: a synthetic OIDC provider proves local login handling, not Entra/Okta interoperability; a fake media adapter does not prove provider revocation; an echo Replay adapter does not prove reconstruction. Use controlled clocks, bounded eventual assertions and explicit failure injection instead of arbitrary sleeps.
- For changed UI, inspect supported desktop layouts at 1024 × 768 and 200% zoom, keyboard/focus behavior, status/error/retry states, forced colors and reduced motion as applicable. Mobile/touch retains approved N/A. Automated accessibility checks do not replace a required human review.
- Preserve the PS-830 owner-reported product and desktop AT acceptance in `docs/acceptance/PS-830-human-acceptance.md`. It is not NOT RUN, and it does not automatically cover new controls or a new candidate. Preserve the PS-840 signed-checkpoint execution exception and PS-842 decisions; neither grants PS-850 approval.
- Record each check as PASS / FAIL / BLOCKED / NOT RUN, with command, cwd, environment, runtime, duration, exit code and evidence path. Record code completion, automated evidence, external proof, human acceptance and final release decision separately.
- Reuse `docs/promptbook/TASK_HANDOFF_TEMPLATE.md`, `PROJECT_STATE.md`, `PRODUCT_COMPLETENESS_MATRIX.md` and `product-completeness-ledger.json`; do not create a competing acceptance ledger. Add audit references and evidence to existing records. Keep the original audit unchanged as historical evidence.
- The Commit section proposes work only. Do not commit or deploy without existing authorization. A later PR must include Summary, Risks, Migration, Evidence and Rollback, list exact files, and give a body covering why, what, verification, compatibility and follow-up. Never claim a failed or unrun gate passed.

## BA-01 — Bind login to the initiating browser and constrain redirects

### ID / title / goal / user outcome / risk

`BA-01`; findings 1 (S1) and 9 (S2); **HIGH** risk. Make OIDC completion specific to its initiating browser and keep the post-login destination on the configured public origin. A user cannot unknowingly complete another browser's login or be redirected externally. Planning status: prerequisites unverified; not unconditional execution readiness.

### Requirements and invariants

Existing owners PS-110/PS-815/PS-810; `REQ-045`, `REQ-051`, `REQ-052`, `INV-001`, `INV-002`. Read identity/security sections of `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` and the current OIDC contract. Preserve state, nonce, PKCE and existing authentication/tenancy models.

### Prerequisites

Apply the common contract. Identify public-origin, TLS/proxy and cookie configuration in each supported profile; reproduce the unbound callback and backslash redirect with synthetic identities. Coordinate with BA-03, which uses the same browser boundary.

### Inspect before editing

Read `apps/server/src/identity/login.ts`, `deploy/compose/profile-service.mjs`, identity unit/integration tests and all callers of `beginOidcLogin` and `completeOidcLogin`. Inspect state consumption, callback error paths and cookie deletion.

### Allowed scope and files

Login transaction handling, return-path validation, HTTP cookie plumbing, affected configuration/contracts and identity/browser regression cases. Keep the existing OIDC client and Session model.

### Implementation

1. Bind each short-lived login transaction to an unpredictable browser credential, using a suitably scoped secure, HttpOnly cookie and server-side binding. Inspect the supported callback flow before selecting SameSite behavior.
2. Verify the binding before consuming login state or exchanging the authorization code. Make valid consumption single-use; clear transaction state/cookies on the appropriate success/expiry paths. Define concurrent-tab behavior without accepting a different browser's transaction.
3. Reject backslashes and control characters in return destinations, normalize against the configured public origin and compare origins. Persist only the validated path, query and fragment. Retain the established safe fallback/error contract.

### Authorization/privacy

Do not expose transaction credentials, codes, verifier values or cookies in logs. A missing, mismatched or expired browser credential must not mint a Session or overwrite an existing Session cookie.

### Concurrency/idempotency/versions

Test repeated and concurrent callbacks: at most one can consume a valid transaction. A mismatched browser must not consume the rightful browser's still-valid state. Preserve the authorized redirect across normal completion.

### Non-goals and explicitly prohibited side effects

No identity-provider replacement, auth-model migration, account-linking changes or generic cookie-policy rewrite. Do not remove PKCE, nonce or state checks to simplify the flow.

### Acceptance

- `BA-01-T01`: browser A starts login; browser B presents A's unused code/state without A's credential; B is denied before provider exchange/state consumption and A can still complete.
- `BA-01-T02`: normal A completion succeeds; expired, missing, mismatched, duplicate and concurrent transactions do not issue extra Sessions.
- `BA-01-T03`: valid local paths/query/fragments survive; `/\\outside.example/audit`, protocol-relative URLs, control-character and URL-normalization variants cannot produce an external `Location`.

### Tests

Use table-driven redirect tests, real transaction-store integration and two isolated browser contexts through the production HTTP callback. Retain provider-failure and cookie-attribute assertions; distinguish synthetic-provider evidence from real interoperability.

### Validation commands

`CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PRODUCT-E2E`, `CMD-SECURITY`; affected real-provider evidence belongs to `CMD-IDENTITY-PROVIDER-STAGING` when its environment is available.

### Regression and quality gates

Normal sign-in/out, deep links and callback failures still work. No valid-browser cross-account confusion or external redirect. Unavailable provider access blocks provider acceptance only; local regression work continues.

### Docs and continuity

Record findings 1/9 reproduction and closure evidence under existing identity/security acceptance. Update cookie/configuration documentation if its contract changes; identify affected PS-815 reruns.

### Commit

Proposed branch `fix/build-audit-login`; subject `fix(identity): bind login transactions to the browser`. Expected files: identity login, production HTTP plumbing and tests. No migration assumed; inspect storage first. PR evidence must separate redirect, browser-binding and provider claims.

### Handoff

Return T01–T03 results, changed paths, cookie/configuration compatibility, exact candidate and remaining provider gates. Next: BA-02, with BA-03 coordinated against this cookie contract.

## BA-02 — Isolate anonymous and authenticated command limits

### ID / title / goal / user outcome / risk

`BA-02`; finding 2 (S1); **HIGH** risk. Stop rejected anonymous traffic from spending another participant's Command allowance while retaining bounded abuse protection.

### Requirements and invariants

PS-120/PS-810; `REQ-051`, `REQ-067`, `INV-001`, `INV-017`. Read approved capacity and security rules in the PRD and `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md`. Authentication failure is not authorized Session activity.

### Prerequisites

Apply the common contract. Reproduce the anonymous/shared-bucket exhaustion against a disposable database. Establish the supported participant workload before choosing aggregate Session capacity.

### Inspect before editing

Read `apps/server/src/security/rate-limit.ts`, limiter callers in `deploy/compose/profile-service.mjs`, trusted proxy/address handling, identity context and `apps/server/test/operational-security.unit.test.mjs` plus database coverage.

### Allowed scope and files

Existing rate-limit classification, request ordering, bounded keys/configuration and focused security/integration tests. Retain the database limiter and established error envelope.

### Implementation

Apply a bounded unauthenticated/address limit before expensive authentication. Spend participant/principal Command quota only after trusted authentication and applicable Session access checks. Keep any aggregate Session protection distinct and size it from supported workload. Bound key retention and use trusted address extraction; client-supplied identity or forwarded headers must not select a privileged bucket.

### Authorization/privacy

Preserve cross-Organization/Session denial. Do not disclose Session existence or participant identities in limiter responses or metrics. Anonymous failures cannot debit the authenticated Session allowance.

### Concurrency/idempotency/versions

Use atomic quota updates under contention and deterministic time-window tests. Verify the existing behavior for Command retries and receipts; no duplicate domain side effects may result from throttling/retry changes.

### Non-goals and explicitly prohibited side effects

No distributed cache, blanket limiter removal, arbitrary unlimited Session budget or new identity scheme. Do not simply increase 120 and leave the shared anonymous bucket intact.

### Acceptance

- `BA-02-T01`: exhausting anonymous traffic for a known Session leaves authenticated participants able to submit valid Commands.
- `BA-02-T02`: one principal's exhaustion does not spend another's quota; anonymous and authenticated floods remain bounded.
- `BA-02-T03`: concurrent boundary requests, spoofed identity/address input and window rollover enforce the documented limits; the supported participant workload passes the separate aggregate policy.

### Tests

Use limiter classification tests plus real HTTP/database concurrency checks; exercise invalid credentials and unauthorized authenticated callers as well as no credentials. Use controlled time instead of waiting for a window.

### Validation commands

`CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-DB`, `CMD-SECURITY`; BA-12 rechecks `CMD-LOAD-APP` and `CMD-LOAD-VOTING` on the converged candidate.

### Regression and quality gates

Valid voting/submission Commands remain available under hostile rejected traffic. Security fixes cannot remove resource bounds or weaken authorization. Record measured capacity separately from arithmetic sizing.

### Docs and continuity

Document bucket ownership, window/retention behavior, trusted proxy assumptions and finding 2 evidence in existing security/runbook records.

### Commit

Proposed branch `fix/build-audit-command-limits`; subject `fix(security): isolate participant command quotas`. Expected files: limiter, production request ordering and tests; inspect schema compatibility before any migration.

### Handoff

Return T01–T03 evidence, configured limits and workload rationale, known deployment assumptions and affected load gates. Next: BA-03.

## BA-03 — Enforce browser Origin and CSRF boundaries

### ID / title / goal / user outcome / risk

`BA-03`; finding 10 (S2, conditional exposure); **HIGH** risk boundary. Prevent unapproved browser origins from reading/editing Studio Drafts or mutating cookie-authenticated HTTP resources.

### Requirements and invariants

PS-300/PS-810/PS-815; `REQ-043`, `REQ-051`, `REQ-052`, `INV-001`, `INV-002`. Read browser trust and API contracts in `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` and document 09. Origin validation complements per-operation authorization.

### Prerequisites

Apply the common contract and reconcile BA-01. Inventory exact configured public origins and explicitly supported non-browser clients before choosing missing-Origin handling.

### Inspect before editing

Read `apps/server/src/studio/collaboration/gateway.ts`, its construction/callers, `apps/server/src/http/runtime-http.ts`, shared JSON/body readers and `deploy/compose/profile-service.mjs`. Inventory cookie-authenticated mutation routes, CORS handling and protocol-specific exceptions.

### Allowed scope and files

WebSocket pre-upgrade checks, common HTTP mutation protection/content-type enforcement and focused security tests. Extend the existing boundary rather than scattering route-specific copies.

### Implementation

Validate exact approved Origin before WebSocket upgrade, initial Draft disclosure or edits. Reject sibling, malformed and null origins unless an existing explicit contract justifies a narrower exception. Define absent-Origin behavior for supported non-browser flows. Audit cookie-authenticated HTTP mutations and implement the existing contract's CSRF protection, with strict accepted media types; accepting `text/plain` must not bypass JSON mutation controls. Preserve legitimate OIDC callbacks and protocol-specific endpoints with explicit validation.

### Authorization/privacy

Keep handshake authentication, project access and per-update revocation checks. Do not use wildcard/suffix hostname matching or trust a caller-provided Host as the allowlist. Rejection must expose no Draft bytes.

### Concurrency/idempotency/versions

Retain collaborative versioning, reconnect behavior and duplicate-update handling. Origin checks must occur before any state mutation and must not substitute for rechecking authorization after revocation.

### Non-goals and explicitly prohibited side effects

No claim that SameSite=Lax permits all unrelated-site attacks. No blanket CORS wildcard, disabling cookie protection or breaking documented machine clients without reviewing their contract.

### Acceptance

- `BA-03-T01`: approved authenticated origin syncs; unapproved same-site sibling origin with an otherwise valid cookie is rejected before upgrade/data disclosure.
- `BA-03-T02`: missing/null/malformed origins and unauthenticated/revoked clients follow explicit deny/allowed-client policy.
- `BA-03-T03`: hostile-origin and `text/plain` cookie-authenticated HTTP mutations cannot change state; legitimate same-origin requests and supported callback/client flows work.

### Tests

Exercise the real gateway and HTTP handler with synthetic sessions, plus browser origin/cookie behavior where feasible. Record whether browser cookie delivery itself was tested; a header harness proves the gate, not a browser exploit.

### Validation commands

`CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-SECURITY`, `CMD-PRODUCT-E2E`.

### Regression and quality gates

Two-Designer collaboration, reconnect and login still work. Server-side filtering remains intact. Inventory all relevant HTTP mutations so closing WebSocket exposure does not leave the analogous boundary unreviewed.

### Docs and continuity

Record exact origin configuration, supported exceptions, negative cases and finding 10's conditional exposure accurately in existing security documentation.

### Commit

Proposed branch `fix/build-audit-browser-origins`; subject `fix(security): validate browser mutation origins`. Expected files: gateway, HTTP boundary/configuration and tests; no schema migration expected.

### Handoff

Return T01–T03, route inventory, compatibility exceptions and browser-versus-harness evidence. Next: BA-04.

## BA-04 — Revoke expired and released radio-floor permissions

### ID / title / goal / user outcome / risk

`BA-04`; finding 3 (S1); **HIGH** risk. Make provider transmit permission follow Floor Lease expiry/release even when a client ignores local mute or the provider initially fails.

### Requirements and invariants

PS-250/PS-780; `REQ-079`, `REQ-080`, `REQ-081`, `REQ-082`, `INV-026`, `INV-027`, `INV-028`. Read `docs/corpus/02_Updated_Architecture/12_VOICE_AND_RADIO_v1.1.md` and the current media adapter contract.

### Prerequisites

Apply the common contract. Reproduce expiry and swallowed disable failure with the existing adapter harness; identify an approved disposable LiveKit environment for actual permission proof. Coordinate deployment-wide coverage with BA-05.

### Inspect before editing

Read `apps/server/src/comms/voice.ts`, `packages/media-adapter/src/index.ts`, provider enable/disable callers, Floor persistence, authority fencing and production worker lifecycle in `deploy/compose/profile-service.mjs`.

### Allowed scope and files

Floor reconciliation, provider effect recovery, production startup/shutdown, related persistence only if required, and media tests/runbooks.

### Implementation

Retain expired/released holders until disable work is accounted for. Add bounded production expiry reconciliation through existing scheduling patterns. Persist failed disables for retry and make failures visible. Confirm the previous holder is disabled before enabling a successor; provider uncertainty must prevent a false exclusive-transmit claim. Reconcile restart and in-flight enable/disable races without holding long database transactions over provider calls.

### Authorization/privacy

Use the trusted Organization/Session/Voice Channel and authority context. Workers cannot grant themselves broader participant rights. Keep media credentials and audio content out of logs.

### Concurrency/idempotency/versions

Test renewal versus expiry, release versus successor grant, duplicate disables, provider timeout after possible success, process restart and stale Authority Epoch. A delayed old disable must not mute a newer valid lease for the same participant without version checks.

### Non-goals and explicitly prohibited side effects

No new media provider, token-expiry-only fix or reliance on cooperative local muting. No real-user audio capture or production media fault injection.

### Acceptance

- `BA-04-T01`: a connected client stops renewing and ignores local mute; the provider revokes publish permission after expiry without another floor request.
- `BA-04-T02`: failed release/expiry disable remains recoverable across restart and eventually reconciles; it is not silently recorded as success.
- `BA-04-T03`: a successor cannot publish while prior revocation is unconfirmed; concurrent renewal/release/retry preserves the valid lease and exclusivity.

### Tests

Use controlled-clock state tests and database/provider failure injection, then a real provider/browser test with synthetic audio. Assert provider enforcement, not only database status or UI mute.

### Validation commands

`CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PLATFORM-MEDIA`, `CMD-LOAD-VOICE`; unavailable provider proof remains NOT RUN.

### Regression and quality gates

Explicit release, expiry, revocation, reconnect and provider recovery preserve exclusivity. Bound retries and expose unresolved revocations. BA-05/BA-11 must prove the reconciler actually runs for additional Organizations.

### Docs and continuity

Update existing media operations guidance with reconciliation, failure visibility and recovery steps; link finding 3 evidence and any migration/forward-fix implications.

### Commit

Proposed branch `fix/build-audit-floor-revocation`; subject `fix(voice): reconcile provider floor revocations`. Expected files: voice, adapter, composition root and tests; allocate an additive migration only if durable existing effect state is insufficient.

### Handoff

Return T01–T03, provider version/environment, retry bounds, persistence implications and worker integration needed by BA-05. Next: BA-05.

## BA-05 — Run scheduled work for every eligible Organization

### ID / title / goal / user outcome / risk

`BA-05`; finding 5 (S1); **HIGH** risk. Additional Organizations receive scheduled Injects and retention enforcement under explicit deployment authority.

### Requirements and invariants

PS-210/PS-520/PS-810; `REQ-030`, `REQ-047`, `REQ-050`, `REQ-052`, `INV-001`, `INV-002`. Read scheduling and retention sections of `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` and the approved platform topology.

### Prerequisites

Apply the common contract. Inspect existing authorized tenant enumeration and service-actor rules; do not assume `oidc.organizationId` defines deployment ownership. Prepare two disposable Organizations, including one provisioned after startup.

### Inspect before editing

Read `deploy/compose/profile-service.mjs`, `apps/server/src/runtime/inject-scheduler.ts`, export-retention callers, Organization provisioning, worker SQL/RLS and shutdown behavior. Inventory other timers, including BA-04, BA-06, BA-07 and BA-10 integration points.

### Allowed scope and files

Composition-root discovery/lifecycle, existing tenant-scoped workers, authorized retention actor selection, bounded processing and focused tests. Keep work owned by its existing feature module.

### Implementation

Enumerate eligible Organizations under established deployment authority in bounded batches. Invoke existing tenant-scoped jobs with an explicitly authorized actor/context for each tenant. Discover newly provisioned Organizations without restart where the product requires it. Prevent one tenant failure from starving others, bound overlapping ticks/retries, and stop cleanly. Reuse this narrow enumeration for subsequent outbox, attachment and checkpoint wiring; do not introduce a general job platform.

### Authorization/privacy

Keep tenant-filtered SQL/RLS inside each job. Never reuse the bootstrap Organization's principal to impersonate another tenant or grant global bypass merely to enumerate work. A genuine service-authority model change requires the established review gate.

### Concurrency/idempotency/versions

Preserve scheduler claims and exactly-once domain delivery under duplicate ticks/processes. Handle Organization disablement, revoked service authority, process shutdown and restart without losing work or acting under a stale Authority Epoch.

### Non-goals and explicitly prohibited side effects

No deployment-per-tenant workaround, wildcard admin, service-per-job topology or broad authorization rewrite. No deletion of real report data during testing.

### Acceptance

- `BA-05-T01`: a second Organization's due Inject fires automatically through production startup without manually invoking its worker.
- `BA-05-T02`: eligible expired report bytes for both Organizations are processed under their own authorized contexts; a legal/authority denial leaves protected data intact.
- `BA-05-T03`: post-startup provisioning, one-tenant failure, overlapping ticks, restart and shutdown preserve isolation and bounded progress.

### Tests

Use production-entrypoint integration with a real disposable database, controlled deadlines and bounded eventual assertions. Include unauthorized/ineligible Organizations and duplicate scheduling attempts.

### Validation commands

`CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-DEPLOYMENT-SMOKE`, `CMD-OBSERVABILITY-CONTRACT`.

### Regression and quality gates

Bootstrap-tenant behavior remains valid, tenant failures are visible and discovery is bounded. A healthy process must not conceal an essential stalled job; follow existing readiness/degradation semantics.

### Docs and continuity

Document eligibility, actor ownership, cadence, overlap/retry bounds and failure response in existing operations records. Link finding 5 evidence; identify integrations still awaiting BA-06/07/10.

### Commit

Proposed branch `fix/build-audit-tenant-jobs`; subject `fix(server): schedule work across eligible organizations`. Expected files: composition root, existing job ownership/context and tests; no new service or datastore.

### Handoff

Return T01–T03, authority evidence, job inventory and boundedness/shutdown proof. Next: BA-06.

## BA-06 — Connect Runtime publication and idle-client synchronization

### ID / title / goal / user outcome / risk

`BA-06`; finding 4 (S1); **HIGH** risk. Connected participants see authorized changes from other actors without Refresh, while pending outbox rows are processed automatically.

### Requirements and invariants

PS-140/PS-780; `REQ-003`, `REQ-043`, `REQ-044`, `REQ-047`, `INV-002`, `INV-018`. Read `docs/corpus/Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1/SYNCHRONIZATION_PROTOCOL_v1.1.md`, especially cursor/outcome and reconnect semantics.

### Prerequisites

Apply the common contract. BA-05 supplies eligible tenant discovery. Reproduce both missing links separately: pending rows lack a production publisher, and the participant UI lacks automatic subscription/refresh.

### Inspect before editing

Read `apps/server/src/runtime/commands/processor.ts`, `apps/server/src/sync/runtime-sync.ts`, `apps/runtime-web/src/App.tsx`, `packages/sync-client/`, production HTTP stream wiring and tests that manually publish or refresh.

### Allowed scope and files

Production publisher startup/shutdown, existing authorized sync-client consumption, affected projection refresh and regression tests. Reuse SSE/polling and cursor contracts already present.

### Implementation

Start bounded `publishPendingRuntimeDeltas` processing for eligible Organizations/Sessions using BA-05. Connect Runtime to the existing authorized synchronization contract and refresh only affected authoritative projections. Preserve event order/deduplication, reconnect cursor recovery and role changes. Clean up subscriptions/timers on logout, unmount and Session changes; prevent stale responses from repopulating a previous scope.

### Authorization/privacy

Filter each delivered delta/projection server-side for current access. Test hidden content, cross-Session/Organization scope, reassignment and revocation while connected; a general broadcast followed by UI hiding is prohibited.

### Concurrency/idempotency/versions

Handle duplicate/out-of-order delivery, publisher restart, expired cursors and concurrent own/remote actions. Preserve Runtime `local_pending` versus canonical outcomes and keep one source of authoritative state.

### Non-goals and explicitly prohibited side effects

No new synchronization protocol, state store, event bus or unbounded full-page polling. Explicit Refresh in a test cannot substitute for automatic delivery acceptance.

### Acceptance

- `BA-06-T01`: through the production entrypoint, an Operator changes Stage/releases an Inject and two idle connected clients receive their authorized views without manual Refresh/reload.
- `BA-06-T02`: pending rows are published automatically for both Organizations; restart, duplicate delivery and reconnect converge without duplicate effects.
- `BA-06-T03`: revoked/changed-role clients lose protected data promptly, and disconnected/stale responses cannot restore unauthorized state.

### Tests

Use sync-client unit cases, database outbox integration and a focused multi-context browser flow. Include hidden recipients and existing offline-outbox regressions. Inspect rendered loading/reconnecting states and listener cleanup.

### Validation commands

`CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-OFFLINE`, `CMD-PRODUCT-E2E`, `CMD-PLATFORM-A11Y`.

### Regression and quality gates

No manual publisher calls or refreshes in the acceptance path. Existing authorized snapshots, command receipts, offline reconciliation and Stage clocks retain their semantics. Show bounded backlog recovery and lifecycle cleanup.

### Docs and continuity

Record finding 4's server and client fixes separately, actual delivery evidence and failure/reconnect behavior. Update existing sync/runbook documentation and affected PS-830/840 rerun scope.

### Commit

Proposed branch `fix/build-audit-live-sync`; subject `fix(runtime): connect automatic authorized synchronization`. Expected files: composition root, existing sync modules, Runtime and tests; no protocol replacement.

### Handoff

Return T01–T03, two-client evidence, publisher bounds, authorization/reconnect results and UI review limits. Next: BA-07.

## BA-07 — Enforce automatic Form attachment expiry

### ID / title / goal / user outcome / risk

`BA-07`; finding 6 (S1); **HIGH** risk. Applicable file-retention policies automatically control availability and journaled deletion without an administrator pressing an enforcement control.

### Requirements and invariants

PS-830/PS-520; `REQ-054`, `REQ-060`, `REQ-063`, `REQ-070`, `INV-016`. Read existing retention/legal-hold decisions in `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` and the approved OPEN-010 implementation scope; do not invent a new retention period or hold policy.

### Prerequisites

Apply the common contract and BA-05 tenant scheduling. Confirm canonical expired-file availability and legal-hold semantics. If genuinely ambiguous, prepare implementation/tests for known behavior and record the specific policy decision needed.

### Inspect before editing

Read `apps/server/src/reporting/form-retention.ts`, `apps/server/src/runtime/form-attachments.ts`, `enforceFormAttachmentRetention` callers, object-store deletion journal, list/download authorization and existing recovery tests.

### Allowed scope and files

Existing cleanup scheduling, attachment read policy, journal recovery and tests. Inspect indirect export/download paths and any issued download URLs so expiry is consistent at the actual byte-access boundary.

### Implementation

Schedule the existing journaled cleanup for every eligible Organization with bounded batches and authorized retention actors. Enforce the approved expiry policy on list/download access even when cleanup is delayed. Preserve legal holds and distinguish retained bytes from permitted access. Retry interrupted object deletion through the existing journal and expose unresolved failures.

### Authorization/privacy

Keep tenant/Session/form authorization, scan-state checks and hold controls. Use synthetic files only. Expiry must not leak attachment metadata or bypass access restrictions through an alternate download/export route.

### Concurrency/idempotency/versions

Use server time and test exact expiry boundaries, hold/release races, repeated cleanup, storage failures and restart between object and database steps. Preserve required metadata/evidence and historical Form versions.

### Non-goals and explicitly prohibited side effects

No bulk production purge, policy shortening, manual cleanup as the sole acceptance trigger, deletion of held bytes or second retention engine.

### Acceptance

- `BA-07-T01`: expired non-held attachments become unavailable under the approved read policy before cleanup, while authorized unexpired clean files remain accessible.
- `BA-07-T02`: production scheduling automatically deletes eligible bytes in a second Organization without direct test calls to cleanup.
- `BA-07-T03`: legal holds, exact expiry, deletion failure and restart preserve policy and recover journaled work without cross-tenant effects.

### Tests

Use controlled-clock policy tests plus real database/S3-compatible integration through production startup. Assert bytes and journal state separately; include delayed-worker and preissued-download access cases where applicable.

### Validation commands

`CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PLATFORM-S3`, `CMD-PRODUCT-E2E`, `CMD-REPORT-RECONCILE`.

### Regression and quality gates

Manual Admin enforcement remains authorized and idempotent. Scheduled and read-time behavior use the same policy; legal-hold preservation and recovery evidence are mandatory before claiming closure.

### Docs and continuity

Record finding 6 evidence, availability versus deletion timing, hold behavior and recovery instructions in existing retention/privacy acceptance and operations records.

### Commit

Proposed branch `fix/build-audit-attachment-expiry`; subject `fix(retention): enforce automatic attachment expiry`. Expected files: retention, attachment reads, composition root and tests; reuse the journal and inspect migration need.

### Handoff

Return T01–T03, policy authority, byte-deletion proof, hold/recovery results and any unresolved policy decision. Next: BA-08.

## BA-08 — Connect governed Plugin Model Runs

### ID / title / goal / user outcome / risk

`BA-08`; finding 7 (S1 functionality gap); **HIGH** risk. Approved, Release-pinned Model Runs execute through the production handler and produce governed proposals whose effects require authorized approval.

### Requirements and invariants

PS-220/PS-230/PS-330/PS-790; `REQ-036`, `REQ-038`, `REQ-088`, `REQ-091`, `REQ-092`, `REQ-093`, `INV-008`, `INV-020`, `INV-026`, `INV-028`. Read `docs/corpus/02_Updated_Architecture/10_EXTENSION_FRAMEWORK_v1.1.md` and current trust/capability decisions.

### Prerequisites

Apply the common contract. Verify the explicitly supported isolated execution boundary, artifact store and approved trust policy. A missing custody/environment decision blocks dependent activation, not safe wiring and fixture preparation.

### Inspect before editing

Read `deploy/compose/profile-service.mjs`, `apps/server/src/runtime/artifact-workflow.ts`, `apps/server/src/extensions/runtime.ts`, `packages/extension-host/`, Plugin SDK/registry and isolated-executor tests. Inventory all `extensionRuntime` and plan-registry consumers.

### Allowed scope and files

Production composition of existing plan registry, immutable artifact loader, isolated executor, capability availability and end-to-end tests. Reuse governance, Effect Proposals and Command processing.

### Implementation

Resolve approved plans and artifacts from the Governing Release and verified immutable digests. Supply the existing `extensionRuntime` through the supported deployment boundary. Preserve resource/network/time limits, validated output and human effect approval. Reconcile interruption/restart without duplicate effects. If the supported boundary is unavailable, expose an explicit unavailable reason in server capability state and UI; retain the Model Run gap as open.

### Authorization/privacy

Require existing Plugin trust, installation, Session and operation permissions; minimize inputs to authorized data. Deny unapproved/revoked artifacts and arbitrary artifact paths. Never expose an unrestricted container socket to the application.

### Concurrency/idempotency/versions

Pin plan/Plugin/adapter/artifact versions and deterministic inputs. Test repeated starts, concurrent approval, timeout after output and restart before/after effect commitment; one approved effect has one authoritative application.

### Non-goals and explicitly prohibited side effects

No new Plugin framework, expanded catalog, direct host execution, bypassed approval or infrastructure purchase. An explicit unavailable UI is containment, not completion of required Model Runs.

### Acceptance

- `BA-08-T01`: an actual supported-profile Model Run travels through production request handling, isolated execution, proposal review, approval and observable effect.
- `BA-08-T02`: revoked/unapproved digest, invalid output, prohibited capability, timeout and unauthorized approval cannot mutate Session state.
- `BA-08-T03`: interruption/retry/restart produces no duplicate effect; missing executor configuration yields accurate unavailable behavior and an open acceptance gate.

### Tests

Retain isolated executor tests and add a production-entrypoint workflow using synthetic deterministic artifacts. Exercise the real isolation boundary, not an in-process replacement presented as deployed proof.

### Validation commands

`CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-AIRGAP`, `CMD-PRODUCT-E2E`, `CMD-SECURITY`, `CMD-LOAD-EXTENSIONS`.

### Regression and quality gates

Governance, installation, authoring and runtime availability agree. Proposals never auto-apply, immutable pins survive restart, and isolation denial remains effective in every supported activated profile.

### Docs and continuity

Document supported executor wiring, artifact custody, unavailable behavior and recovery in existing deployment/Plugin records; update PS-830/840 impact evidence and finding 7 status truthfully.

### Commit

Proposed branch `fix/build-audit-model-runs`; subject `fix(extensions): wire governed production model runs`. Expected files: composition root, existing extension adapters, capability UI if needed and tests. No new trust boundary without established approval.

### Handoff

Return T01–T03, exact artifact/profile identity, isolation proof and any remaining capability gate. Next: BA-09.

## BA-09 — Make Replay behavior and availability truthful

### ID / title / goal / user outcome / risk

`BA-09`; finding 8 (S2); **HIGH** integrity risk. Provide genuine deterministic reconstruction when available, and prevent a visible Replay action from promising unsupported production behavior.

### Requirements and invariants

PS-520/PS-790; `REQ-034`, `REQ-042`, `REQ-059`, `REQ-060`, `INV-013`, `INV-015`, `INV-016`. Read Replay/reporting requirements in `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` and the existing Replay contract.

### Prerequisites

Apply the common contract. Inventory reconstructable pinned inputs and deterministic transition implementations. Establish which deployment profiles can support Replay; product-required Replay remains a release obligation even if unavailable UI is made truthful.

### Inspect before editing

Read `apps/server/src/replay/`, `apps/server/src/http/runtime-http.ts`, `apps/runtime-web/src/App.tsx`, `deploy/compose/profile-service.mjs`, `tests/e2e/runtime-server.mjs` and `tests/reporting/report-reconciliation.test.mjs`.

### Allowed scope and files

Existing replay adapter, production wiring, capability presentation and genuine reconstruction tests. Reuse versioned state transitions and report comparison logic.

### Implementation

Implement and connect reconstruction from pinned starting state, historical Commands/events and deterministic external results under the approved contract. Independently derive output before comparison. If required inputs/implementation are unavailable, return the existing capability-unavailable response and display an explanatory unavailable state instead of a runnable action. Label plumbing fixtures honestly and remove identity-return fixtures from acceptance claims.

### Authorization/privacy

Require authorized access to historical inputs/results and omit protected data. Replay is observational: it must not resend mail, publish media, execute live external effects or write new decisions into the original Session.

### Concurrency/idempotency/versions

Pin Release/schema/Plugin/input versions, ordering, seeds and time semantics. Repeated runs yield the same result; missing versions, gaps or incompatible inputs must fail explicitly rather than infer current state.

### Non-goals and explicitly prohibited side effects

No `replay(input) { return input; }` as reconstruction proof, rewritten history or new event-sourcing platform. Hiding a control does not satisfy the required replay capability.

### Acceptance

- `BA-09-T01`: supported Replay independently reconstructs a known history and the comparator detects an intentional divergence from the recorded result.
- `BA-09-T02`: missing/corrupt/pin-mismatched history and unauthorized access fail explicitly without external effects or historical mutation.
- `BA-09-T03`: a profile without a valid adapter shows an accurate unavailable state and endpoint denial; capability acceptance remains open until T01/T02 pass.

### Tests

Use deterministic reconstruction fixtures with independently specified expected results, real endpoint wiring and one Operator browser flow. Keep any echo adapter only as a clearly scoped plumbing test.

### Validation commands

`CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-REPORT-RECONCILE`, `CMD-PRODUCT-E2E`, `CMD-PLATFORM-A11Y`.

### Regression and quality gates

Reporting/archive outputs remain compatible. Distinguish truthful capability containment from delivered Replay, and never accept a required Replay ledger row on UI gating alone.

### Docs and continuity

Record input/version support, read-only guarantees, fixture limitations and finding 8's actual status in existing reporting/Replay and product-completeness records.

### Commit

Proposed branch `fix/build-audit-replay`; subject `fix(replay): align production capability and reconstruction`. Expected files: existing Replay adapter/wiring, Operator availability and tests; document any contract compatibility change before implementation.

### Handoff

Return T01–T03 with implemented versus unavailable profiles and remaining product obligations. Next: BA-10.

## BA-10 — Schedule independently verifiable Evidence checkpoints

### ID / title / goal / user outcome / risk

`BA-10`; declared signed-evidence gap; **HIGH** integrity/custody risk. Production creates due signed checkpoints with independent anchors, and both live golden Sessions can be verified outside the application.

### Requirements and invariants

PS-510/PS-830/PS-850; `REQ-006`, `REQ-053`, `REQ-066`, `INV-015`. Read signing/custody/anchoring requirements in `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` and current Decision Register policy. Append-only rows alone do not satisfy REQ-006.

### Prerequisites

Apply the common contract and BA-05. Verify approved signing custody, trusted public-key distribution and independent anchor location/ownership. Missing external custody is a specific activation/evidence blocker; do not silently replace it with application-owned keys and call it independent.

### Inspect before editing

Read `apps/server/src/evidence/checkpoints.ts`, `createDueEvidenceCheckpoint` callers, `scripts/verify-evidence.mjs`, `tests/evidence/evidence-verification.test.mjs`, recovery fixtures and `docs/acceptance/PS-830-checkpoints.md`.

### Allowed scope and files

Existing signer/anchor adapters, production scheduling, authorized existing-Session checkpoint path, recovery tests and custody/runbook evidence. Preserve the existing verification export format unless a compatible extension is needed.

### Implementation

Connect the approved signer and independent anchor adapter, schedule due checkpoints for eligible Organizations/Sessions and provide the supported path needed for existing golden Sessions. Bound retries and record pending/failed signing or anchoring accurately. Export verification material through authorized operations and independently verify chain, signature and external anchor using trusted public keys.

### Authorization/privacy

Keep private keys and signing privileges out of client/runtime artifacts and logs. Separate application writes from independent anchor custody under the approved policy; no new key issuance or rotation without existing authorization.

### Concurrency/idempotency/versions

Prevent duplicate/conflicting checkpoints across concurrent ticks, restart, signer timeout and anchor failure after signing. Preserve chain ordering, key/version identity and original evidence. A signed but unanchored checkpoint is not fully accepted.

### Non-goals and explicitly prohibited side effects

No replacement cryptography, production key creation, rewritten evidence, fabricated anchor or lifted PS-840 exception. Local deterministic signers prove implementation only.

### Acceptance

- `BA-10-T01`: production startup automatically creates due checkpoints, with valid signatures and independent anchors for eligible tenants.
- `BA-10-T02`: signer/anchor outage, interrupted retry, concurrent tick and restored evidence preserve continuity and report incomplete states honestly.
- `BA-10-T03`: checkpoints from both original and Energy live golden Sessions pass independent verification against approved trusted keys/anchors; tamper, omission and reordering are rejected.

### Tests

Retain offline verification negatives, add real production-scheduler/database cases, then perform approved custody/anchor proof and both golden-Session exports. Fixture checkpoints alone cannot satisfy T03.

### Validation commands

`CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-EVIDENCE-VERIFY`, affected `CMD-GOLDEN-JOURNEY` and `CMD-BACKUP-RESTORE`.

### Regression and quality gates

Independent tamper detection, chain continuity and approved custody must all be evidenced. The PS-840 execution exception permits continuation only; missing T03 still blocks PS-850.

### Docs and continuity

Update existing PS-510/PS-830 evidence and custody operations records with actual candidate, keys' public identifiers, anchor proof and remaining gates. Preserve prior human acceptance independently.

### Commit

Proposed branch `fix/build-audit-evidence-wiring`; subject `fix(evidence): wire scheduled signed checkpoints`. Expected files: existing adapters, composition root, tests/runbooks; no custody-policy change or private key files.

### Handoff

Return T01–T03, signer/anchor environment identity, independent verifier results and any custody blocker. Next: BA-11.

## BA-11 — Prove the production composition root

### ID / title / goal / user outcome / risk

`BA-11`; audit test-coverage explanation and production-wiring gaps; **HIGH** risk. Establish a small acceptance suite that fails when production construction omits required capabilities, even if isolated module tests pass.

### Requirements and invariants

Use the requirement IDs and existing PS owners of BA-01–10, plus PS-810/PS-820/PS-830/PS-840. Read `docs/corpus/02_Updated_Architecture/02_PLATFORM_ARCHITECTURE_v1.3.md` for actual deployment topology and document 09 for public boundaries. Do not introduce replacement requirement IDs.

### Prerequisites

Apply the common contract. BA-01–10 local behavior must be integrated for their positive cases; unresolved external/capability gates remain explicit. Inventory which existing tests substitute authentication, publication, Replay or provider behavior.

### Inspect before editing

Read `deploy/compose/profile-service.mjs`, supported deployment profiles, `tests/e2e/runtime-server.mjs`, product Playwright configuration, `scripts/test-deployment.mjs`, `package.json` and CI entrypoints. Trace startup, readiness and graceful shutdown.

### Allowed scope and files

Extend the nearest deployment/browser harness with a focused production-entrypoint suite, using disposable services and synthetic data. Keep useful module/unit tests. Add a script only if no existing harness can run the boundary faithfully.

### Implementation

Boot the actual profile service/configuration rather than the browser fixture's handler composition. Provision two Organizations through supported setup and public product operations. Exercise browser-bound login, isolation, automatic jobs, outbox delivery to idle clients, attachment expiry and configured extension/Replay/evidence capabilities. Inject bounded provider failures/restart and assert recovery. Identify synthetic external services explicitly while keeping real application construction. Wire cases into a repeatable command/CI path.

### Authorization/privacy

No test-only bypass in production authentication or authorization. Real login handling may use a synthetic OIDC server; tests must not supply a privileged Principal directly and claim to have exercised browser login.

### Concurrency/idempotency/versions

Use isolated tenants/resources, pinned service versions and bounded eventual assertions. Test two clients, overlapping ticks and restart with pending work; assert receipts, provider state and bytes, not only HTTP success.

### Non-goals and explicitly prohibited side effects

No duplicate exhaustive E2E suite, architectural rewrite, manually called publisher/cleanup as acceptance, identity Replay fixture, broad sleeps or real-provider claims from mocks.

### Acceptance

- `BA-11-T01`: the suite launches the production composition root and proves the second-Organization, two-idle-client and automatic-work scenarios without private service invocation substituting for the trigger.
- `BA-11-T02`: omitting required wiring or injecting provider failure yields the expected test failure/degraded behavior; recovery preserves data and authorization.
- `BA-11-T03`: existing build/type/unit/integration/browser/security checks pass on the same candidate, and capability/external evidence not covered by this suite remains explicitly open.

### Tests

Map every audit reproduction to a regression test and actual command. Include login/Origin/rate-limit negatives and at least one startup/shutdown/restart case for background work. Validate that the new tests would detect the original omissions using controlled wiring-disable checks in the harness.

### Validation commands

`CMD-PLATFORM-BUILD`, `CMD-PLATFORM-LINT`, `CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-DEPLOYMENT-SMOKE`, `CMD-PRODUCT-E2E`, `CMD-SECURITY`, `CMD-OBSERVABILITY-CONTRACT`. Register and verify a new production-entrypoint command only if created here.

### Regression and quality gates

Record source/image/lockfile/schema/configuration identity. Keep tests that directly exercise the kernel, but distinguish them from production wiring. CI/Linux and live alert delivery are separate evidence obligations, not implied by local Windows PASS.

### Docs and continuity

Update existing test/command registry and PS acceptance evidence with the new harness scope, reproducible setup and audit-to-test mapping. Do not copy the audit's 159/159 or 37/37 historical counts as fresh results.

### Commit

Proposed branch `test/build-audit-production-entrypoint`; subject `test(server): cover production composition boundaries`. Expected files: existing deployment/browser harness, tests, scripts/CI only as needed and command documentation; no product behavior bypasses.

### Handoff

Return T01–T03, command/evidence inventory, production-versus-fixture boundary map and remaining external gates. Next: BA-12.

## BA-12 — Measure current performance and recovery

### ID / title / goal / user outcome / risk

`BA-12`; declared performance gap and unmeasured audit scope; **MEDIUM**, with **HIGH** integrity risk during recovery tests. Determine whether the corrected candidate meets approved experience/capacity targets before optimizing.

### Requirements and invariants

PS-540/PS-545/PS-820/PS-845; `REQ-002`, `REQ-032`, `REQ-067`, `REQ-068`, `REQ-069`, `INV-017`, `INV-019`. Read approved workload/recovery objectives in `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md` and current OPEN-016/OPEN-017 decisions.

### Prerequisites

Apply the common contract and BA-11. Identify the candidate, named approved test environment, supported workload, network/device profile and thresholds. Missing representative infrastructure limits the claim; it does not erase earlier valid performance evidence.

### Inspect before editing

Read `scripts/run-load-profile.mjs`, `tests/load/`, existing PS-545 results, build chunk output, frontend entrypoints and `docs/operations/PS-820-INSTALL-UPGRADE-RECOVERY.md`. Check which workloads actually traverse production HTTP and providers.

### Allowed scope and files

Measurement and evidence first; narrow optimizations only for demonstrated bottlenecks. Reuse load/recovery tooling and approved profiles; do not add a benchmark platform.

### Implementation

Measure cold/warm Runtime and Studio startup, network bytes, key interaction latency, synchronization delay/backlog and new worker/provider overhead on representative fixtures. Run approved app/voting/voice/extension and soak profiles, recording workload, hardware, percentiles and integrity. Inspect bundle composition only if user-visible results miss approved budgets. Rehearse affected install/backup/restore paths; controlled authority transfer remains PS-845's separately governed work. Rerun affected tests after any optimization.

### Authorization/privacy

Use synthetic, disposable targets and explicit resource ownership. No production load, fault injection, destructive restore or paid capacity. Include tenant fairness and unauthorized-load resistance without exposing real data.

### Concurrency/idempotency/versions

Record exact source/profile/schema/service versions and resource settings for every run. Count accepted Commands, receipts, evidence and effects through reconnect/restart; latency PASS cannot excuse integrity loss or dual transmitters.

### Non-goals and explicitly prohibited side effects

No arbitrary new performance thresholds, speculative code splitting or treating approximately 632/607 kB build warnings as proven user-facing failures. No reuse of stale results as exact-candidate evidence without impact assessment.

### Acceptance

- `BA-12-T01`: current frontend/startup/interaction and sync measurements have reproducible fixtures, candidate/environment identity and comparison against applicable approved targets.
- `BA-12-T02`: required workload/soak/recovery profiles report latency, fairness, bounded resources and exact integrity; unavailable runs remain NOT RUN/BLOCKED.
- `BA-12-T03`: each necessary optimization has before/after evidence and targeted regression checks; unmet targets remain explicit defects or approved decisions, never a silent waiver.

### Tests

Use existing measurement/recovery harnesses, approved repetition counts and long-running schedules. Verify actual production-path coverage and report any direct-service benchmark limits. Preserve historical results as historical evidence.

### Validation commands

`CMD-PLATFORM-BUILD`, `CMD-LOAD-APP`, `CMD-LOAD-SOAK`, `CMD-LOAD-VOTING`, `CMD-LOAD-VOICE`, `CMD-LOAD-EXTENSIONS`, affected `CMD-CLEAN-INSTALL` and `CMD-BACKUP-RESTORE`. `CMD-AUTHORITY-TRANSFER` may run only after PS-845 creates and verifies it; its registry entry alone is insufficient.

### Regression and quality gates

No claim of production-load, soak or recovery approval from bundle sizes or a local smoke run. Preserve approved timing and fencing objectives; missing named operations evidence remains a release gate.

### Docs and continuity

Record current measurements and environment limitations in existing performance/recovery evidence. Cross-reference affected PS-545/820/845 obligations and any candidate change requiring reruns.

### Commit

Proposed branch `test/build-audit-performance`; subject `test(performance): measure the corrected production candidate`. Expected files: evidence and minimal harness fixes; if optimization is justified, give it a separate focused diff and compatibility report.

### Handoff

Return T01–T03, measured versus unmeasured claims, threshold sources, failed budgets and recovery dependencies. Next: BA-13.

## BA-13 — Reconcile the overview and evidence records

### ID / title / goal / user outcome / risk

`BA-13`; stale overview and acceptance-continuity gaps; **LOW** change risk, material reporting risk. Make the README and canonical records accurately distinguish implemented capability, verified behavior and outstanding release gates.

### Requirements and invariants

Use PS-830/PS-840/PS-842/PS-850 ownership and the existing product corpus, especially `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md`. Documentation cannot resolve a product decision, promote AUTOMATED_PASS to accepted PASS or revoke prior human acceptance.

### Prerequisites

Apply the common contract. Prepare the inventory early; finalize status from actual BA-01–12 handoffs. Read the latest acceptance records directly where older guide text conflicts with later evidence.

### Inspect before editing

Read `README.md`, `docs/promptbook/PROJECT_STATE.md`, `PRODUCT_COMPLETENESS_MATRIX.md`, `product-completeness-ledger.json`, `APPROVAL_IMPLEMENTATION_PROMPTBOOK.md`, `docs/acceptance/PS-830-human-acceptance.md`, `PS-840-UAT.md` and `PS-842-interface-consistency.md`.

### Allowed scope and files

Correct the existing overview and affected canonical evidence links/status summaries. Update generated task artifacts only through `tasks.json` and the renderer if task metadata genuinely changes; do not create another status document.

### Implementation

Replace the stale claim that the visual Studio suite beginning at PS-310 is future work with a concise evidence-backed overview. Distinguish available, unavailable, locally verified and externally unproven capabilities. Reconcile each audit item to its implementation/evidence or explicit remaining blocker. Preserve PS-830 owner product/desktop AT PASS with its recorded limits, PS-840 signed-checkpoint exception, PS-842 decisions and PS-845/850 gates.

### Authorization/privacy

Link sanitized evidence; do not copy private identities, credentials, sensitive screenshots or raw protected exports into documentation. Never invent a named approval or signature.

### Concurrency/idempotency/versions

Bind evidence to its source/candidate date and preserve history. Reconcile concurrent documentation changes without overwriting newer decisions. A new candidate needs impact analysis, not copied PASS labels.

### Non-goals and explicitly prohibited side effects

No second completeness ledger, mass documentation rewrite, altered original audit, new acceptance claim or blanket replacement of historical NOT RUN rows without their later record context.

### Acceptance

- `BA-13-T01`: README describes observed current implementation and links canonical evidence; it no longer calls delivered visual Studio work future work.
- `BA-13-T02`: all ten findings and declared gaps map to current evidence or explicit open status without contradicting preserved human acceptance.
- `BA-13-T03`: links/commands resolve and structural ledger/promptbook checks pass; no release acceptance is inferred from those checks.

### Tests

Review every changed claim against its cited evidence, check local links and command references, and inspect the focused diff. Application tests are unnecessary for prose-only changes; do not report them as run.

### Validation commands

`CMD-GAP-AUDIT` in structural mode and `CMD-PROMPTBOOK-VALIDATE`. If task metadata changes, regenerate before validation according to `PROMPTBOOK_CHANGE_CONTROL.md`. Check this supplemental book separately: the canonical validator does not validate BA sections.

### Regression and quality gates

Prior accepted human work remains accepted within its recorded scope; changed controls/candidates are assessed separately. No invented evidence counts, readiness labels or claim that all 240 audit-time obligations were product defects.

### Docs and continuity

Update only existing authorities and evidence pointers; retain this book as execution guidance. Explicitly identify where functionality is contained but still unimplemented or externally unverified.

### Commit

Proposed branch `docs/build-audit-status`; subject `docs: reconcile build audit and implementation status`. Expected files: README and affected existing acceptance/continuity records; no application, migration or deployment change.

### Handoff

Return T01–T03, changed claim-to-evidence links and remaining disagreements/gates. Next: BA-14.

## BA-14 — Assemble the exact-candidate release decision

### ID / title / goal / user outcome / risk

`BA-14`; open release approval and audit limits; **HIGH** release risk. Present the existing PS-850 owner with a complete, truthful decision package for one identified candidate; absent mandatory evidence yields NO-GO, not inferred approval.

### Requirements and invariants

PS-850 plus its PS-815/820/830/840/842/845 prerequisites and PS-810 obligations; `REQ-005`, `REQ-051`, `REQ-064`, `REQ-066`, `REQ-067`, `REQ-069`, `REQ-070`, `INV-015`, `INV-019`, `INV-028`. Read `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md`, Decision Register and existing release gates.

### Prerequisites

Apply the common contract. BA-01–13 supply implementation/evidence inputs, not automatic release acceptance. Reconcile canonical PS prerequisite status and already authorized exceptions. Prepare the decision package even when a gate is blocked; do not execute unauthorized dependent operations.

### Inspect before editing

Read the canonical PS-850 prompt, `docs/promptbook/RELEASE_GATES.md`, `RELEASE_READINESS.md`, `product-completeness-ledger.json`, `scripts/audit-product-completeness.mjs`, current PS acceptance records and actual CI/deployment evidence.

### Allowed scope and files

Existing release evidence index, completeness ledger, acceptance handoffs and exact-candidate verification. Missing product fixes return to their owning BA/PS task; do not bury new implementation in approval assembly.

### Implementation

1. Identify source/worktree, image, lockfile, schema, configuration, Governing Releases, Plugin/adapter digests and environment. Assess changed-candidate impact and rerun affected gates.
2. Reconcile every mandatory ledger row and all ten findings. Keep PLANNED, AUTOMATED_PASS and NOT_RUN distinct from accepted PASS/N/A. N/A requires the existing authorized basis.
3. Account explicitly for real Entra/Okta/SAML/SCIM/mail interoperability; LiveKit and institutional media; independent signing/anchoring; install/upgrade/backup/restore; load/soak; Linux CI; live observability delivery; PS-840 UAT; PS-842 consistency; PS-845 authority transfer; and applicable new human/desktop AT review. Preserve prior accepted reviews and their candidate limits.
4. Run structural and release-mode audits, assemble attributable owner decisions and issue a clear GO/NO-GO recommendation. Only the authorized PS-850 owner can grant final GO; this task does not deploy.

### Authorization/privacy

Use approved nonproduction/provider environments and sanitized evidence. No forged signatures, agent risk acceptance, custody changes, live fault injection or external publication without authorization.

### Concurrency/idempotency/versions

Freeze evidence identity for review; subsequent source/configuration changes require impact assessment and affected reruns. Do not reuse a passed candidate label for a different artifact or downgrade blockers to make a script green.

### Non-goals and explicitly prohibited side effects

No deployment, release tagging/commit without authorization, weakened release validator, fabricated provider proof or inference that a structural audit proves readiness. Unavailable Model Runs/Replay or signed checkpoints remain mandatory capability gaps where required by the product.

### Acceptance

- `BA-14-T01`: every audit finding, declared gap and applicable ledger obligation has an owner, actual status, candidate-bound evidence and remaining action.
- `BA-14-T02`: required automated, external, recovery, human and authority-transfer evidence is accepted against the candidate; any missing gate produces explicit NO-GO/BLOCKED and a concrete evidence request.
- `BA-14-T03`: release-mode audit passes only with legitimate accepted PASS/N/A records, and the named owner records the final decision. A complete NO-GO package completes the reporting work, not release approval.

### Tests

Use the existing gate/ledger validators and risk-based final regression. Review evidence provenance, dates, candidate identity and approver authority. Distinguish restored-data integrity, live authority transfer and independently anchored evidence; none substitutes for another.

### Validation commands

Resolve PS-850's current Verified command set: `CMD-PLATFORM-LINT`, `CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-GOLDEN-JOURNEY`, `CMD-GAP-AUDIT`, `CMD-SECURITY`, `CMD-CLEAN-INSTALL`, `CMD-BACKUP-RESTORE`, `CMD-IDENTITY-PROVIDER-STAGING`, `CMD-WORKFORCE-MIGRATION`, `CMD-PRODUCT-E2E`, `CMD-PLATFORM-A11Y`, `CMD-EVIDENCE-VERIFY`, plus applicable BA-12 measurements. `CMD-AUTHORITY-TRANSFER` remains dependent on PS-845 implementation/verification. Run `npm run audit:product-completeness -- --release` for the final fail-closed ledger check.

### Regression and quality gates

Do not stop at green unit/browser suites or structural coverage. Every remaining S1/security/data-integrity issue and required external/human gate follows existing release policy. No new waiver is granted by this book or by the historical PS-840 execution exception.

### Docs and continuity

Update the existing release index, completeness records and PROJECT_STATE with the actual decision, attributable approvals, exact candidate, open blockers and next safe action. Preserve the original audit and historical acceptance evidence.

### Commit

Proposed branch `docs/build-audit-release-evidence`; subject `docs(release): reconcile exact-candidate audit evidence`. Expected files: existing release/acceptance records only. Proposal is not authorization to commit, publish or deploy.

### Handoff

Return T01–T03; exact candidate; command/evidence results; unresolved findings and external/human gates; recorded owner GO or NO-GO; and the next eligible action. State clearly whether remediation, evidence collection and production approval are each complete or still open.
