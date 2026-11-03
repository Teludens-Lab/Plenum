# AGENTS.md — Universal Software Engineering Standard

**Version:** 1.1  
**Scope:** Any software repository (web, mobile, desktop, API, data system, simulation, SaaS, automation, or service).  
**Purpose:** Direct coding agents to build understandable, secure, testable, operationally reliable software that can grow without premature complexity.

> **Prime directive:** Deliver the smallest coherent solution that satisfies the requirements and nonfunctional constraints. Optimize for **correctness, clarity, changeability, observability, and safe operation** before architectural sophistication. Complexity must earn its place.

This document is a standing engineering contract, **not** an instruction to generate a large architecture, an infrastructure platform, or every document mentioned below. Apply each provision according to risk and scope. A prototype is not a production system; a production system must not hide prototype-level risks.

---

## 0. Instruction hierarchy and project configuration

1. Follow applicable law, security and privacy requirements, and direct user instructions.
2. Follow the repository's approved product/domain specifications, architectural decisions, existing conventions, supported runtimes, and deployment policies.
3. Apply this standard wherever compatible. Flag genuine conflicts instead of silently bypassing requirements.
4. Follow `rules/QA_STANDARDS.md` if present for risk-based verification, quality evidence, regression strategy, defect severity and release gates. For user-facing interfaces, also follow `rules/UNIVERSAL_DESIGN_STANDARDS.md` if present for UX, visual and interaction quality. These standards complement one another; resolve conflicts against approved product requirements and documented architectural decisions.
5. When details are missing, inspect the repo and make a conservative, reversible assumption. Ask only if the choice is consequential, expensive, or irreversibly changes product behavior.

**Project-specific engineering facts** should be recorded in `ENGINEERING_PROFILE.md` or an existing equivalent (README/architecture/ADRs), not invented by this universal standard:

| Fact | Record |
|---|---|
| Product and users | Core use cases, critical workflows, data sensitivity |
| Runtime | Languages, frameworks, pinned toolchain, package manager |
| Topology | Deployable units, boundaries, request/event paths, trust boundaries |
| Data | Stores, ownership, schemas, tenancy, retention, backup/RPO/RTO if applicable |
| Operations | Environments, CI/CD, hosting, on-call/owner, rollback method |
| Quality targets | Supported platforms, accessibility, performance, SLOs if warranted |
| Security | Authn/authz, secrets, threat considerations, compliance constraints |
| Scale assumptions | Current volume, plausible growth, measured bottlenecks, budgets |

A small repo can hold all of this in its README. **Do not create documentation files solely to meet a filename quota.**

---

## 1. Modes of work and proportionality

Classify the work before implementation:

| Mode | Goal | Expected rigor |
|---|---|---|
| Spike / experiment | Answer one technical question | Fast, disposable; clearly labeled; never quietly shipped |
| Prototype / MVP | Validate value and core behavior | Simple boundaries, basic tests, straightforward deploy and security |
| Production | Support real users and persistent data | Reliable error handling, access controls, migrations, observability, tested delivery/rollback |
| High-criticality | Handle financial, regulated, safety-critical, or large-scale dependencies | Explicit threat/risk analysis, stronger evidence, formal approval and recovery controls |

The user or project owner determines readiness. **Never describe unverified code as production-ready.** If mode is unspecified, infer from repository and task, disclose the assumption, and avoid irreversible changes.

### Anti-overengineering rules (mandatory)

- **Modular monolith by default** when starting a conventional application. Prefer one deployable application with clear internal modules over microservices, unless independent scaling, isolation, organizational ownership, or reliability constraints justify separation.
- **One source of truth for each fact.** No competing domain models, duplicate API clients, scattered constants, parallel state stores, or second persistence paths.
- **Reuse existing infrastructure and libraries** before adding another dependency. Check maintenance, licensing, compatibility, security, and operational cost.
- **No abstraction before demonstrated need.** Extract shared components/utilities when repetition expresses the same concept, not merely similar syntax. Prefer a little duplication to the wrong abstraction.
- **No speculative platforms:** do not introduce Kubernetes, event buses, CQRS, event sourcing, service meshes, workflow engines, multiple databases, plugin frameworks, distributed caches, or elaborate generic repositories without recorded, concrete requirements.
- **Avoid premature optimization**; establish a baseline and investigate measured bottlenecks. Still prevent obvious unbounded queries, N+1 fetches, and explosive algorithms.
- **Do not build for hypothetical millions of users.** Design reversible seams that allow scaling later, with realistic capacity assumptions today.
- **Avoid configuration explosion.** Use the minimum necessary environment variables, modes, feature flags, and generic extension points. Assign an owner and removal condition to temporary flags.
- **A new layer, service, job, dependency, queue, or database requires a justification**: what actual requirement demands it; simpler alternative considered; operational cost; deletion/migration path.
- A feature is complete when the behavior works, tests and checks pass, and its operational obligations are met—not when more abstractions have been added.

### Complexity test

Before adding architectural complexity, answer: **(1)** What failure or requirement does it solve? **(2)** Why is the simpler approach insufficient? **(3)** What ongoing burden does it add? **(4)** How will we verify its benefit? If any answer is absent, choose the simpler approach.

---

## 2. Agent execution protocol

**For each task:**

1. **Inspect:** Read entry points, build scripts, dependency manifests, architecture/readme, tests, lint rules, recent patterns, and relevant files. Map the existing code path before editing it.
2. **Define:** State the behavior to change, acceptance criteria, constraints, and non-goals. Identify critical unknowns; do not fabricate domain decisions.
3. **Scope:** Make the smallest end-to-end change. Do not perform unrelated redesigns, dependency upgrades, renaming sweeps, or wholesale rewrites.
4. **Design:** Identify affected module boundaries, data contracts, failure modes, auth checks, migrations, and verification. For consequential changes, record a short plan and alternatives.
5. **Implement:** Follow existing style, create clear interfaces, keep domain logic independently testable, and remove abandoned branches and dead code.
6. **Validate:** Apply `rules/QA_STANDARDS.md` where present: map acceptance criteria to evidence; run relevant type checks, format/lint, tests, build, security and targeted UI/API verification; include negative and boundary cases. Classify results PASS / FAIL / NOT RUN rather than assuming success.
7. **Report:** Summarize changed files, behavior, tests actually run/results, deployment or data implications, known limitations, and any unresolved risks. Do not claim tests were run unless they were.

When test infrastructure is missing, add only the minimum test harness required by the change. When an operation is blocked, report the precise blocker and the verification not performed. Respect existing user changes; never overwrite unknown work. Never commit or deploy unless requested or authorized by repo workflow.

### Stop-and-review triggers

Pause for explicit confirmation or an established approval gate before: destructive production operations; dropping or rewriting persistent data; changing authentication or tenancy models; moving trust boundaries; adding paid services; publishing or exposing sensitive information; irreversible migrations; major rewrites; changes to external API guarantees. A plan can be produced without executing the risky step.

---

## 3. Architecture: coherent modules, boundaries, topology

**Favor high cohesion within modules and low coupling between them.** Partition by business capability or meaningful feature; avoid an entire codebase organized only into generic `controllers/`, `services/`, `utils/`, and `models/` directories where features are scattered. Shared technical infrastructure can remain cross-cutting.

A typical modular layout (illustrative, never compulsory):

```text
src/
  app/               # Composition root: startup, routing, dependency wiring
  modules/
    capability-a/
      domain/         # Rules, types, invariants (where complexity justifies it)
      application/    # Use cases / orchestration
      adapters/       # Storage, transport, external integrations
      interface/      # UI or transport handlers (as applicable)
    capability-b/
  shared/             # Truly shared primitives, not a dumping ground
```

Small modules may simply use `feature.ts`, `feature.test.ts`, and a handler; **do not create empty folders/layers**. Use established architecture where present rather than reorganizing just to fit the example.

### Dependency direction

- Domain rules and invariants should not depend on web frameworks, UI widgets, storage engines, or vendor SDKs where practicable.
- Application operations coordinate domain rules and external ports; transport handlers translate I/O, auth context, validation, and errors.
- Infrastructure adapters implement contracts and should not become the authority for business semantics.
- A module exports an explicit public interface. Other modules cannot import its private internals or directly mutate its data.
- Shared infrastructure cannot import arbitrary feature modules. Avoid cyclic imports; enforce boundaries with available lint/build tools when warranted.
- Cross-feature collaboration goes through public application functions/contracts. Introduce events only when temporal decoupling or genuine fan-out justifies them.
- Use a **composition root** for dependency wiring and startup. No hidden service-locator maze or global mutable singletons.

### Repository and runtime topology

- Write down the actual deployables, processes, external systems, data stores, and how requests/events move through them. A brief diagram is enough; keep it accurate.
- Align code ownership and modules to domain boundaries. A repository folder is **not** automatically a microservice; service splitting requires a documented deployment and data ownership argument.
- State who owns each mutable entity, which service/module may write it, and which interfaces expose it. Avoid distributed writes with unclear ownership.
- Keep synchronous critical workflows straightforward. If work must be asynchronous, define queue semantics, idempotency, retries, failure handling, and operational ownership.
- Prefer explicit data flow to clever indirection; make dependencies visible in constructor parameters, function arguments, or composition wiring.
- Do not allow UI, request handlers, background workers, or third-party adapters to implement separate versions of the same decision rules.

### Architecture decisions

For consequential choices, create a short ADR with **context, decision, alternatives, consequences, and revisit trigger**. Document why a technology is used, not generic descriptions of its existence. Periodically delete obsolete diagrams and decisions or mark them superseded.

---

## 4. Maintainable code and contracts

- Use names from domain vocabulary; one concept should have one canonical name. Prefer descriptive functions and files over vague `helpers`, `common`, `manager`, `processor`, or `misc`.
- Functions should have a focused responsibility. Minimize surprising side effects, implicit ordering, hidden environment dependencies, and deep nesting.
- Keep state ownership explicit: local ephemeral UI state, server-authoritative domain state, persisted state, and derived state are different concerns.
- Avoid circular dependencies, god objects, mega-components, giant router files, and global utility grab bags.
- Validate inputs **at trust boundaries**; encode internal invariants with types/schema constraints and explicit domain checks. Do not redundantly revalidate already trusted values at every layer.
- Errors are typed/structured where useful and translated once at boundaries. Never swallow failures silently or expose raw internals to clients.
- Public function/API contracts should document semantics, invalid inputs, edge cases, and compatibility expectations—not narrate obvious implementation lines.
- Use linting, formatting, type checking, and automated dependency boundary rules appropriate to the language. Avoid suppressing rules without a localized explanation.
- Prefer composition and simple interfaces over inheritance hierarchies and reflection-driven magic.
- Keep dependencies current in planned, testable updates; pin versions and commit lockfiles where appropriate. Do not upgrade unrelated packages as a side effect of feature work.
- Retire obsolete routes, flags, interfaces, and deprecated code through an explicit migration path rather than accumulating permanent legacy branches.

**Code review question:** Can a competent engineer understand where the feature lives, how data enters and changes, where failures surface, and what to edit next—without reverse-engineering the entire repository?

---

## 5. Backend and API engineering

- Separate transport parsing and response formatting from use-case logic and domain rules.
- Validate request shape, type, size, and authorization context at the server boundary. A valid request format does not imply the user is allowed to perform it.
- Use stable, versioned external contracts when clients depend on them; define request/response/error schemas, pagination, sorting, and filtering semantics where relevant.
- Use correct HTTP semantics (or equivalent protocol semantics), consistent error envelopes, appropriate timeouts and cancellation, and bounded payloads.
- Enforce authorization per resource/action on the server, including tenant scoping. Never trust client-provided role, tenant, or ownership claims without verification.
- Prevent duplicate side effects for retried operations: idempotency keys or equivalent safeguards where payment, provisioning, submissions, or external writes justify them.
- Define transaction boundaries around business invariants. Avoid a network request inside a long-running database transaction if possible.
- Protect integrations with timeouts, bounded retries and exponential backoff with jitter where appropriate; retry only safe/transient failures. Use circuit breakers only when evidence and scale justify them.
- For background work, specify delivery semantics (often at-least-once), deduplication, dead-letter/failure handling if needed, replay policy, and visibility into stuck jobs.
- Make expensive operations cancellable or bounded; implement request rate limits and quotas where abuse or cost warrants them.
- Never make external API failures appear as successful business writes. Define partial-success and compensation behavior explicitly.

---

## 6. Data, persistence, migrations and integrity

- Choose the simplest datastore that supports access patterns, consistency, backups, and realistic scale. A relational database is a sensible default for structured transactional applications, not a universal mandate.
- Make schemas express constraints: keys, uniqueness, foreign keys, check constraints, nullability, and indexes justified by actual queries.
- Use database transactions for atomic changes; specify concurrency handling for contested resources (optimistic locking, row locks, or domain-specific strategies).
- Avoid unbounded queries, excessive joins, and N+1 access; observe query plans and indexes before optimizing.
- Schema changes should be versioned, reviewable, and tested. Prefer expand → migrate/backfill → switch → contract for live backward-compatible deployments.
- Treat migrations and backfills as operations: time, load, locking risk, failure recovery, compatibility between old/new application versions, and rollback/forward-fix strategy must be considered.
- Destructive changes to production data require explicit approval and tested recovery. A reversible code deployment does **not** imply a reversible data migration.
- Define ownership, lifecycle, retention and deletion for user and sensitive data. Back up persistent data, regularly test restoration at a cadence appropriate to its value, and document what a restore does and does not recover.
- Keep seed/test data clearly separated from production. Do not present fictional, generated, or placeholder values as real observations.
- For multi-tenancy, enforce tenant isolation in both queries and writes and test cross-tenant denial. Prefer one clear tenancy strategy over layered ad hoc filters.
- For caches and search indexes, designate the authoritative store; document invalidation, staleness, rebuild, and consistency expectations.

---

## 7. Frontend and client architecture

For user-facing projects, apply `rules/UNIVERSAL_DESIGN_STANDARDS.md` and project design briefs where available.

- Organize UI by feature and composable components; separate domain state, server data, local UI state, derived view models, and side effects.
- Use the framework's normal rendering, lifecycle, routing, state and accessibility patterns. Do not reinvent routers, forms, fetching, or global stores without strong reasons.
- Keep business authorization and canonical calculations on trusted server/domain boundaries; UI may preview them only through approved, knowledge-limited contracts.
- Handle loading, empty, error, stale, partial, offline, and retry states where relevant. Provide actionable feedback and prevent duplicate submits.
- Ensure stable keys/identity and cleanup for listeners, subscriptions, timers, and asynchronous tasks. Avoid race conditions and stale responses.
- Prefer semantic controls, predictable navigation, consistent forms, keyboard operation, and input parity; do not make visual polish a substitute for correct interaction.
- Responsive layouts must handle width **and height**, long content, localization, zoom, and dynamic data. Avoid fixed panels that spill, clip, or squeeze content.
- Use code splitting, efficient media, virtualization, and caching when measured need or evident scale warrants it; avoid premature micro-optimizations and fragile memoization.
- Centralize API access and client-side error handling enough for consistency; do not produce multiple incompatible fetch layers.
- Distinguish transient optimistic updates from confirmed server state; revert or reconcile failures reliably.
- Use existing design tokens/components and preserve a coherent motion and interaction grammar, including reduced-motion alternatives.

---

## 8. Security, privacy, supply chain

Build security into normal implementation—not as a late checklist.

- Maintain least privilege for users, services, CI jobs, and infrastructure. Authenticate identities and authorize resources/actions independently.
- Never store credentials, tokens, private keys, or sensitive production data in source control, screenshots, issue text, logs, test fixtures, or client bundles. Use approved secret storage and rotation.
- Parameterize database access and safely encode output. Address applicable injection, XSS, CSRF, SSRF, path traversal, unsafe deserialization, file upload, and dependency risks at relevant boundaries.
- Validate untrusted input at ingress and sanitize or encode at sinks; do not rely on regex-only security measures or client validation.
- Use proven authentication and cryptography libraries; no custom encryption, password hashing, or token scheme.
- Use secure transport and appropriate cookie/session policies. Enforce CORS/CSP/security headers in proportion to product architecture and threat model.
- Avoid leaking personally identifiable information or secrets through logs, analytics, error messages, tracing, or third-party providers.
- Review dependencies for known vulnerabilities and licenses, pin or lock dependencies, and prefer maintained, reputable packages. Generate SBOM/provenance evidence when required by deployment or risk.
- Segregate development/test/production environments and credentials. Production access should be limited and auditable.
- Record a lightweight threat model for features introducing sensitive data, public uploads, payments, authentication, multitenancy, privileged automation, or new trust boundaries.
- AI/agent features require explicit tool permissions, data provenance, defenses against untrusted instructions, human approval for high-impact actions, cost ceilings, and auditability where appropriate.

---

## 9. DevOps, environments and release engineering

- **Reproducible setup:** one documented path to install, configure, test, build, and run locally, with pinned versions or a deterministic dependency resolution strategy.
- **Configuration:** environment-specific settings must be explicit, validated at startup, and fail safely if required values are missing. Do not branch on undocumented environment names throughout the code.
- **CI as a guardrail:** run formatting/linting, static types where applicable, unit/integration tests, and build checks. Add security/license/dependency scans proportional to risk and tooling availability.
- **Deployments:** use repeatable scripts or declarative infrastructure where beneficial; avoid undocumented manual production changes. Establish traceable release versions and change history.
- **Separation:** maintain appropriate boundaries between local, test/staging and production resources, data, secrets, and permissions. Do not demand a staging cluster for a low-risk single-user prototype.
- **Migrations:** coordinate database migrations with app release order; verify deployment compatibility. Know how to restore service without assuming schema rollback.
- **Rollback/recovery:** document previous-version redeployment, feature disablement, database restore or forward-fix, and incident escalation appropriate to the service.
- **Health:** distinguish process liveness from readiness to serve. Do not report healthy while essential dependencies are unavailable, unless the app explicitly supports degraded operation.
- **Infrastructure:** begin with the simplest reliable hosting topology. Use containers, orchestration, IaC, autoscaling, CDN, queues, and multi-region only when deployment or product needs support them.
- **Operational ownership:** every persistent service, queue, scheduled job, data store, and third-party integration must have a clear owner and failure response.
- **Cost:** consider monthly infrastructure baseline, per-request cost, storage growth, observability spend, egress, and vendor lock-in before architecture expansion.

### Minimum CI expectation by mode

| Mode | Minimum recommended gate |
|---|---|
| Spike | Reproducible command and observed result |
| Prototype | Lint/type check where configured, targeted tests, successful build |
| Production | Automated CI, appropriate coverage of critical paths, integration/migration tests, secure configuration, deployment and recovery validation |
| High-criticality | Above plus risk-specific assurance, approvals, audit evidence and recovery exercises |

---

## 10. Reliability, performance and observability

- Define expected behavior during timeouts, transient outages, degraded dependencies, restarts, and partial failures. Design graceful degradation where beneficial.
- Use structured logs with meaningful event names, severity, correlation/request IDs, and scrubbed sensitive data. Logs must help answer *what happened and why*.
- Add metrics and traces when they improve diagnosis; do not install an elaborate observability stack merely to check a small application.
- Record baseline latency and error rates for important user journeys; adopt explicit SLOs and alert policies when operational impact justifies them.
- Watch saturation: database connections, worker concurrency, queues, memory, CPU, disk, and external API quotas as applicable.
- Instrument critical workflows end to end; distinguish user failure, validation failure, integration failure, and infrastructure failure.
- Alerts should be actionable, indicate ownership, and correspond to user impact. Avoid alert noise and dashboards without decisions attached.
- Performance budgets should focus on real experience: critical response time, UI interaction latency, query efficiency, startup, resource usage, and cost—not arbitrary synthetic scores alone.
- Scale in stages: measure → optimize queries/data flow → right-size resources → cache where correct → isolate hotspots → split services only when warranted.
- Define recovery objectives (RPO/RTO) for valuable persistent services, matched to their impact and budget. Verify backup restoration rather than assuming it works.

---

## 11. Testing strategy and evidence

`rules/QA_STANDARDS.md` is the authoritative companion for test selection, frontend/backend/data/security QA, defect classification, traceability, regression scope, release gates, and evidence reporting. The rules below are the engineering minimum, not a substitute for its release-readiness checks.

**Test behavior and boundaries, not implementation trivia.** Use the smallest effective combination of test levels:

1. **Unit/domain tests:** invariants, validation, edge cases, error conditions, deterministic calculations.
2. **Integration tests:** database operations, migration compatibility, adapters, auth boundaries, real serialization and network contracts where practical.
3. **End-to-end tests:** a few critical user journeys across actual boundaries, including failure/recovery paths. Do not duplicate every unit test in the browser.
4. **Contract tests:** use when independently released producers/consumers or third-party integrations justify them.
5. **Nonfunctional checks:** accessibility, performance, security, load, data recovery, or concurrency, based on concrete risks.

Rules:

- Any bug fix should include a regression test at the lowest appropriate level when feasible.
- Test authorization denial, invalid inputs, boundary values, retries, duplicate submissions, concurrency conflicts, and partial failures as relevant.
- Avoid flaky tests with real-time delays, network reliance, arbitrary sleeps, and shared mutable fixtures. Use deterministic clocks, factories, seeded randomness, and isolated test data.
- Use representative data with realistic lengths, sizes, units, and relationships. Never use production secrets or personal data in tests.
- Coverage numbers can be a diagnostic, not a proxy for correctness. Prioritize critical path and invariant coverage.
- Do not mock away the very integration a test purports to prove. External services may be mocked for most tests but deserve targeted integration/contract verification.
- When UI is changed, inspect rendered states, layout overflow, responsive behavior and accessibility, not only component test success.

### Definition of Done

Distinguish change-level completion from release approval: acceptance evidence, unresolved QA blockers and human risk acceptance follow `rules/QA_STANDARDS.md`.


A change is done when: acceptance criteria are met; boundaries and naming are coherent; relevant automated checks pass; critical edge/error paths are covered; docs/contracts are current; migrations/security/operational implications are addressed; and remaining risks are honestly reported. No false claims of verification.

---

## 12. Change management and evolution

- Prefer vertical slices: one usable workflow through UI/API/domain/data rather than sprawling disconnected scaffolding.
- Keep commits/patches conceptually focused. Refactor adjacent code only when necessary for the change or to eliminate a concrete defect.
- For architectural change, use a **strangler/incremental migration** where possible: old and new paths coexist briefly with explicit ownership, parity tests, and removal plan.
- Maintain backward compatibility for clients and persisted formats when required; document intentional breaking changes and migration instructions.
- Track technical debt as a specific risk with impact, cause, and repayment trigger; not a vague wish list.
- Feature flags are transitional tools with a planned cleanup. Avoid permanent divergence of product behavior without a justified configuration need.
- Delete obsolete code, unused dependencies, dead routes, stale comments, and redundant configurations as part of the change that renders them obsolete.
- Reassess topology only when scaling, ownership, regulatory, deployment, or resilience evidence changes—not because microservices sound more enterprise.

---

## 13. Failure patterns: reject unless explicitly justified

| Smell | Corrective action |
|---|---|
| Massive all-purpose components/classes | Extract responsibility-aligned features/functions |
| Circular imports and cross-module internal imports | Establish public contracts and dependency direction |
| `utils`/`shared` full of unrelated business logic | Move logic to owning capability |
| Duplicate stores, calculations, validators, API clients | Identify one authoritative implementation |
| Handlers directly contain authorization, persistence, and rules | Introduce a focused use-case boundary |
| One abstraction per single-line operation | Inline or collapse unnecessary layers |
| Generic base classes and plugin architectures without users | Replace with direct composition |
| Multiple deployables for one inseparable feature | Consolidate to a modular monolith |
| Distributed writes without transactional strategy | Reestablish ownership or design consistency explicitly |
| Broad catches and silent defaults | Handle known failures and propagate unexpected ones |
| Unbounded retries, queries, queues, or in-memory state | Add bounds, timeouts, capacity controls and failure behavior |
| Magical initialization or runtime configuration | Explicit composition and validated configuration |
| UI hardcoded to server-private rules | Move canonical decisions to trusted application/domain boundary |
| Passing tests but broken layout or workflow | Add behavioral and visual/end-to-end checks |
| Huge scaffolds without working use cases | Build one vertical slice first |
| “Enterprise-ready” claimed without evidence | Report only controls and tests actually implemented |

---

## 14. Engineering review scorecard

Review significant features with the following questions. Mark **Pass / Needs work / N/A** and include evidence for high-risk items.

| Area | Acceptance question |
|---|---|
| Scope | Is this the smallest complete solution for the actual need? |
| Architecture | Is there one understandable ownership path and consistent dependency direction? |
| Topology | Are deployables, integrations, trust boundaries, and data flow explicit? |
| Changeability | Can a future engineer locate and modify the behavior without cross-repo archaeology? |
| Backend | Are requests validated, authorized, bounded, and errors meaningful? |
| Data | Are schema, concurrency, migration, retention, and recovery handled where needed? |
| Frontend | Is behavior correct in normal, loading, error, and constrained layouts? |
| Security | Are access controls, secrets, sensitive data and trust boundaries handled? |
| Operations | Can the software be built, deployed, observed, and recovered appropriately? |
| Tests | Do tests cover invariants, critical paths, and plausible failures? |
| Quality assurance | Are acceptance criteria evidenced, regressions selected by risk, blockers triaged, and required release gates satisfied? |
| Performance | Are costs and important user journeys within realistic budgets? |
| Simplicity | Can any new dependency, layer, service or abstraction be removed? |

Any **Needs work** result must be fixed, assigned with risk accepted by an authorized owner, or clearly listed as a release blocker.

---

## 15. Agent output and handoff format

Conclude implementation tasks with a concise, evidence-based report:

```md
## Outcome
- Delivered: <user-visible behavior>
- Files/modules changed: <paths>
- Architecture/topology impact: <none or explain>

## Verification
- <command>: PASS / FAIL / NOT RUN (why)
- <user flow or manual check>: PASS / FAIL / NOT RUN
- QA gate: PASS / CONDITIONAL / FAIL / NOT RUN; <evidence, blockers, authorized approver as applicable>

## Operational impact
- Migrations/configuration/deployment: <changes or none>
- Security/performance/reliability: <relevant considerations>

## Follow-ups
- <only concrete unfinished items, risks, decisions>
```

Do not present guessed performance, security certification, scale, or readiness as fact. Be transparent about limitations and unfinished checks.

---

## 16. Short agent operating directive

For tools or subagents with small instruction windows, use this summary **with** the full standard, not instead of it:

> Inspect before changing. Preserve the approved stack, domain semantics, and user work. Build the smallest complete vertical slice. Default to a modular monolith and explicit feature boundaries. Keep one source of truth, directional dependencies, server-side authorization, safe data migration, deterministic testing, and repeatable deployment. Avoid speculative infrastructure, needless abstractions, duplicate state, hidden coupling, and giant components. Follow the project's design standards for UI and `rules/QA_STANDARDS.md` for evidence, regression and release gates. Validate real failure paths. Report exactly what changed, what ran, and what remains uncertain. Complexity must have an evidenced reason.

---

## 17. UI quality rules

All Plenum UI work must follow the Teludens authority in `references/teludens-design-system-catalog/`, the production resolution in `packages/design-system/conformance.json`, and the project contracts under `docs/design/`. Before changing a view, read its view-family brief, `docs/design/journeys.md`, `docs/design/state-inventory.md`, `docs/design/motion-inventory.md`, and `docs/design/forms-dialogs-messages.md`.

Use only semantic tokens and approved Teludens primitives. Preserve the single Plenum shell, human-readable context, one scroll owner per region, keyboard/pointer/touch parity, WCAG 2.2 AA, reduced-motion and forced-colors meaning. Do not require internal identifiers, expose raw JSON/error payloads, create unbounded workstation pages, use card grids as default navigation, add decorative motion, hide critical work behind hover/icon-only controls, or duplicate authoritative state.

For PS-800 and successor UI tasks, `docs/design/forms-dialogs-messages.md` and `docs/design/prohibited-patterns.md` own the project-specific working rules. Use the installed Impeccable skill as a subordinate review method: shape before code; baseline critique/audit/detector; close with critique/audit/detector, screenshot review, cold read and cognitive walkthrough; then compare sibling families. Teludens and approved product behavior always win and conflicts go to `docs/design/impeccable/conflicts.md` or, for authority gaps, candidate OPEN text in `docs/promptbook/CONFLICT_REGISTER.md`.
