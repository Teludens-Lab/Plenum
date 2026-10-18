# QA_STANDARDS.md — Universal Software Quality Assurance Standard

**Version:** 1.0  
**Scope:** Any software project: web, API, mobile, desktop, simulation, data pipeline, SaaS, automation, or service.  
**Purpose:** Make software quality demonstrable through risk-based evidence without imposing enterprise bureaucracy or testing everything repeatedly.

> **Prime directive:** Quality is the demonstrated ability of the system to meet requirements, preserve important invariants, operate safely under realistic conditions, and recover predictably when things fail. A passing test suite is necessary but not sufficient evidence of quality.

This standard complements `AGENTS.md` (architecture, engineering, delivery) and `UNIVERSAL_DESIGN_STANDARDS.md` (UX, visual, accessibility and motion). Read the project's actual requirements and architecture first. These standards do not prescribe any particular language, test framework, issue tracker, CI vendor, or deployment architecture.

---

## 0. Governance, authority and proportionality

1. Product/domain specifications define **what must be correct**. `AGENTS.md` defines how the system is implemented and delivered. This file defines **how correctness and release readiness are verified**. UI design standards add UI acceptance expectations.
2. Verification must be repeatable, risk-based, and independently understandable from its evidence. A coding agent may author both code and tests but cannot use test authorship as evidence of independent product approval.
3. Select QA rigor according to project maturity, impact, data sensitivity, user population, deployment blast radius, and reversibility. Never create a testing department's worth of process for a single-user prototype.
4. Do not add tools, environments, test layers, or test documents without a concrete coverage gap. Reuse existing harnesses and commands.
5. Prefer testing public behavior and contracts; avoid tests tightly coupled to private implementation details or incidental markup.
6. No invented pass rates, performance numbers, test runs, test coverage, or production-readiness claims.

### QA profiles

| Profile | Minimum assurance | Typical evidence |
|---|---|---|
| Spike | Demonstrate experiment's claim; state limits | Reproduction command, output, assumptions |
| Prototype / MVP | Core journey + primary failure paths + build sanity | Targeted automated tests, manual smoke, known limitations |
| Production | Critical-path automation, integration/data/security checks, deploy/recovery checks | CI runs, acceptance evidence, release checklist |
| High-criticality | Formal risk controls, independent review/approvals, stronger recovery/security assurance | Traceability, signed exceptions, rehearsals, auditable evidence |

Profiles are not substitutes for the product-specific threat and risk assessment. A small application processing sensitive data can need stronger controls than a large public read-only site.

---

## 1. Quality planning and acceptance contracts

For each meaningful feature or defect fix, define the smallest useful acceptance contract **before implementing**:

- **Behavior:** Who does what, under which preconditions, and what observable outcome follows.
- **Boundary conditions:** Invalid/missing input, duplicates, limits, authorization denial, contention, interruption, partial dependencies.
- **State transitions:** Normal, loading, empty, error, retry, cancel, offline or stale where relevant.
- **Cross-layer impact:** API, domain, database, background jobs, integration, UI, infrastructure and contracts touched.
- **Evidence:** Which test/check will prove each critical expectation and where evidence will be available.
- **Release risk:** What might harm users, data, privacy, security, operational continuity, cost, or accessibility.

Use concise acceptance scenarios (Given / When / Then or equivalent), not a lengthy test plan for every trivial change. Requirements must be testable; ambiguous behavior is clarified or captured as an explicit assumption.

### Criticality classification

Use **High / Medium / Low** to prioritize testing. High includes, as relevant: authorization, financial operations, persistent writes, tenancy, data deletion, irreversible commands, public exposure, important state machines, and deployment/migration boundaries. High-risk paths require both positive and negative evidence and direct verification at the relevant trust boundary. Medium-risk paths receive targeted coverage. Low-risk cosmetic changes receive focused visual and regression checks.

---

## 2. Traceability without paperwork

Maintain a lightweight mapping from **requirement → implementation boundary → validation evidence** for critical and cross-cutting behaviors. It may live in issue acceptance criteria, test names, pull request descriptions, or a small `QUALITY_PLAN.md`; do not duplicate it in a second system.

A feature is not accepted merely because a developer says it works. The evidence must test the claimed behavior, not a mocked approximation of it. Human product sign-off remains human when required.

---

## 3. Test portfolio: smallest effective mix

| Level | Proves | When required |
|---|---|---|
| Static checks | Syntax, typing, lint, formatting, forbidden dependencies, secret/dependency issues | Every applicable change |
| Unit / property tests | Pure rules, invariants, edge conditions, algorithmic correctness | Nontrivial logic |
| Component tests | UI state and accessibility semantics | Stateful UI components |
| Integration tests | Real persistence, transactions, authorization, serialization, adapters, queues | Changed boundary or integration |
| Contract tests | Compatibility between separately deployed/owned consumers and providers | Independently versioned interfaces |
| End-to-end tests | Real critical journey across layers | A small set of priority journeys |
| Exploratory testing | Unanticipated behaviors, confusing flows, integration seams | Before material UI/workflow releases |
| Nonfunctional tests | Security, accessibility, performance, reliability, recovery, compatibility | Risk-dependent |

Do not duplicate a hundred unit test cases as browser tests. Keep E2E suites lean and deterministic; move granular logic checks lower in the pyramid. Mocks are useful for isolation but must not erase the external behavior the test purports to validate. Prefer at least one test against a real database or equivalent for critical persistence paths.

### Required scenario dimensions (where applicable)

- Success, invalid input, missing data, permission denied and expired identity.
- Boundaries: zero, one, maximum, overflow, oversized payloads, long names, unusual characters, locale/timezone, and relevant numeric precision.
- Repeated actions: duplicate submissions, idempotency, retries, refresh/reload and session resumption.
- Concurrent actions: contention, double-writes, stale versions, race conditions and transaction rollback.
- Distributed dependencies: timeout, partial failure, stale response, retry exhaustion, unexpected schema and service outage.
- Lifecycle: create, update, delete, archive, restore, migration and backward compatibility as relevant.

Use parameterized tests, factories, seeded randomness, controllable clocks and isolated fixtures to reduce duplication and flakiness. Never depend on production credentials or data.

---

## 4. Frontend, visual, motion and accessibility QA

When a user-facing interface changes, test the **rendered product** and the workflow, not just DOM assertions.

- Verify supported widths **and heights**, zoom, content density, long labels, variable values, empty lists, scroll containment, and responsive reflow.
- Check that controls do not overlap, clip, unexpectedly overflow, or collapse below usable sizes; test dialogs, dropdowns, sidebars, inspectors, tables and forms.
- Capture representative screenshots for material layout changes and compare them with approved baselines; intentional baseline updates must be reviewed rather than automatically accepted.
- Check keyboard traversal, focus visibility/return, semantic labels, screen-reader-relevant announcements, contrast, touch targets where applicable and 200% text scaling in alignment with design standards.
- Test `prefers-reduced-motion`; motion must be interruptible, preserve spatial continuity, avoid hiding information, and not trigger avoidable input lag or layout instability.
- Verify loading, empty, validation error, network error, save in progress, retry, success and partial-data states as relevant.
- Test critical user journeys in real rendered pages, with real API or explicit test-environment equivalents where possible.

For map, canvas, WebGL, editors, drag-and-drop, and other specialist widgets, provide keyboard or accessible alternatives where product requirements require them, and test rendering, hit testing, resizing and interaction state separately.

**Visual quality and UX quality are not identical:** screenshot matching is not a substitute for task completion and usability checks. Refer to `UNIVERSAL_DESIGN_STANDARDS.md` for visual and behavioral acceptance requirements.

---

## 5. Backend, data and integration QA

- Validate API inputs/outputs and errors against authoritative contracts; verify authentication **and** resource-level authorization at the trusted boundary.
- Check HTTP/status semantics or transport-equivalent contracts, pagination limits, filtering, sorting, idempotency and partial failures.
- Validate real database operations, constraints, atomicity, referential integrity, concurrent updates, isolation and appropriate query bounds.
- Exercise migrations against a representative prior schema/data snapshot; verify expand/migrate/contract ordering and read/write compatibility where rolling deployments matter.
- Test data separation across tenants and roles; explicitly attempt cross-tenant reads and writes where applicable.
- Verify background tasks: retries, duplicate delivery, dead-letter or failure handling, scheduling, cancellation and observability only where these mechanisms exist.
- Test third-party boundaries with stable fakes plus targeted real/sandbox contract checks where feasible; define behavior when the dependency changes or disappears.
- Treat schema rollback separately from application rollback; protect against irreversible data loss.

---

## 6. Security, privacy and supply-chain QA

Choose checks according to exposure and threat model; do not claim a security audit because a scanner ran.

- Authentication, authorization, privilege escalation, session expiry/revocation, secret access and secure defaults.
- Injection, unsafe serialization, uploads, outbound URL handling, CSRF/XSS where relevant, rate/size limits and abuse paths.
- Sensitive-data exposure through logs, client bundles, URLs, errors, telemetry, backups, fixtures and screenshots.
- Dependency and license review, lockfile reproducibility, known vulnerabilities and secret scanning; triage findings by actual reachability/impact.
- Privacy requirements: consent, minimization, retention, deletion, export and auditability where required.
- Production-like configuration checks: debug modes off, least privilege, environment boundaries, transport protections, origin policy, administrative access.

Security findings that permit unauthorized data access, privilege escalation or secret exposure are blockers unless an authorized risk owner explicitly resolves the issue under established policy; agents cannot self-waive them.

---

## 7. Performance, scalability and reliability QA

Set performance targets from actual user journeys and service constraints, not universal arbitrary numbers. Record workload, hardware, fixture size, environment and percentile/statistical basis with measurements.

- **Frontend:** interaction latency, startup/loading, bundle/network cost, rendering responsiveness, memory leaks, large datasets, resize/map performance.
- **Backend:** throughput, latency distributions, error rate, query counts, N+1, bounded pagination, contention, saturation and resource cost.
- **Reliability:** timeouts, retries, retry storms, dependency outage, restart behavior, graceful degradation and recovery of incomplete operations.
- **Scalability:** test realistic present demand and plausible near-term growth; identify measured bottlenecks before new infrastructure.
- **Recovery:** test backups/restores and recovery procedure against stated RPO/RTO when data and operational impact warrant them.

Prefer a repeatable lightweight smoke benchmark to an elaborate performance lab. Load tests require a safe isolated target and approved resource budgets; never direct uncontrolled load at production.

---

## 8. Compatibility, environment and migration matrix

Record only **supported** platforms, browsers, devices, screen classes, runtimes, database versions, feature flags and deployment modes. Test representative combinations with high-risk differences; do not attempt the Cartesian product of every variable.

Environment parity must be sufficient to verify production-critical dependencies and configuration differences. Fixtures should reflect realistic volume, skew, edge cases and entity relationships. Distinguish untested from unsupported.

For data changes verify old client/new server and new client/old server compatibility if the deployment model can temporarily create these pairings.

---

## 9. Test data and environment hygiene

- Keep test data isolated, resettable, deterministic and free of real confidential information.
- Factories and fixtures use meaningful valid/invalid cases; avoid giant anonymous JSON blobs and brittle shared fixtures.
- Seed explicit randomness and fake clocks; eliminate arbitrary sleeps and dependence on ordering where possible.
- Quarantine a flaky test only with issue, owner, severity, deadline and compensating coverage. A skipped critical test is not a pass.
- Track infrastructure-caused failures separately from product defects; do not conceal either.
- Ensure preview/staging environments use appropriately restricted accounts, secrets and network access.

---

## 10. Defect triage and root-cause discipline

Capture each substantive defect with observable behavior, expected behavior, reproduction steps, environment/version, impact, evidence and owner. For production incidents add detection, timeline, recovery and prevention actions as appropriate.

| Severity | Interpretation | Default release treatment |
|---|---|---|
| S0 Critical | Widespread outage, active compromise, irreversible major data loss | Stop release; immediate incident response |
| S1 High | Critical journey unavailable, serious authorization/data-integrity defect | Block release |
| S2 Medium | Important functionality impaired, workaround possible, bounded impact | Fix or obtain explicit risk acceptance |
| S3 Low | Minor defect/cosmetic issue without meaningful workflow harm | May ship with tracked follow-up |

Severity is impact; priority is scheduling urgency. Context can override defaults through an authorized documented process, never through an agent's silent assumption.

For bug fixes: reproduce first when feasible; add a regression test at the lowest meaningful level; fix root cause; rerun affected suites; look for the same failure pattern elsewhere. Do not rewrite unrelated subsystems as a substitute for diagnosis.

---

## 11. CI validation gates and release decisions

**Every applicable change** must pass: source hygiene, formatting/lint where configured, static checks, targeted automated tests, build/packaging, and relevant acceptance evidence.

For production-impacting changes, also consider:

- Critical-path integration and smoke tests; security and authorization negative cases.
- Migration validation, deployment compatibility and rollback/recovery plan.
- UI screenshots/accessibility where UI affected; concurrency/load where risk indicates.
- Vulnerability and secrets scans; dependency/licensing checks where applicable.
- Release notes, operational telemetry readiness and ability to detect regressions.

### Release gate outcomes

- **PASS:** required checks passed, acceptance evidence exists, no unresolved blockers.
- **CONDITIONAL:** only policy-permitted nonblocking issues remain, documented with owner, mitigation and deadline; authorized human accepts risk.
- **FAIL / BLOCKED:** required check failed, evidence is missing for a critical requirement, or blocker defect remains.
- **NOT RUN:** explicitly recorded with reason; never translated into PASS.

A coding agent does not authorize a production deployment or waive a release gate on its own. A green CI run does not guarantee product acceptance or operational readiness.

### Sample CI ordering

1. Fast: format/lint, type/static checks, targeted unit tests, secrets scanning.
2. Medium: build, integration/contract tests, migration checks, component/accessibility tests.
3. Targeted slow: critical E2E flows, visual regression, performance/security checks triggered by risk or release.

Parallelize independent checks where economical. Keep PR feedback fast; schedule heavier regression suites or run on release candidates where that is sufficient.

---

## 12. Risk-based regression selection

For each change identify directly affected components and downstream consumers. Use the dependency graph and contracts, not only modified filenames. Regression selection should cover:

1. Direct changed behavior.
2. Module boundaries and callers/consumers.
3. Adjacent critical journeys sharing data/state.
4. Previously fixed failures of the same class.
5. Cross-cutting constraints: security, accessibility, migrations, latency where implicated.

Maintain a very small smoke suite of must-work experiences. Broader suites run at a cadence appropriate to risk. Do not trigger a full expensive test matrix for every copy edit unless it can impact critical behavior.

---

## 13. Definition of Ready, Done and Release Ready

**Ready to implement:** Observable acceptance criteria and non-goals are clear; critical risk and affected boundaries are identified; test approach is proportionate; dependencies or blockers are visible.

**Done (change):** Required behavior implemented; relevant automated and manual checks passed; regression coverage updated; failure states verified; docs/contracts updated; known risks disclosed; no unreviewed dangerous changes.

**Release ready (product):** Critical journeys work end to end; blocking defects resolved; data/security/accessibility and operational requirements evidenced; deploy/migrate/recover procedures appropriate to risk verified; owner approves release. Change-level Done is not product-level Release Ready.

---

## 14. Mandatory QA handoff report

Each substantial implementation report includes a brief QA appendix:

```md
## QA evidence
- Scope and risk: <what changed; high/medium/low and why>
- Acceptance criteria: <criterion → PASS/FAIL/NOT RUN + evidence>
- Static/build checks: <command and result>
- Automated tests: <command, test scope and result>
- Manual/visual/accessibility checks: <environment, result or NOT RUN>
- Data/security/performance/recovery: <relevant evidence or N/A>
- Regression risks: <affected dependencies; remaining gaps>
- Defects/waivers: <severity, owner, approved mitigation if any>
- Release gate: PASS / CONDITIONAL / FAIL / NOT RUN; <who can approve>
```

Report exact commands and outcomes. If the agent cannot execute a test because of missing environment, credentials, build tooling, external access or authorization, state the limitation and the precise handoff needed. Never hide it behind “validated.”

---

## 15. Agent checklist (use on every nontrivial change)

- [ ] Acceptance criteria describe observable behavior and negative cases.
- [ ] Tests align to risk and actual affected boundaries.
- [ ] Core business invariants and permissions are tested.
- [ ] Data, concurrency and integrations are verified where impacted.
- [ ] UI states/layouts/accessibility and motion are checked where impacted.
- [ ] Automated checks and build passed—or failures are explicitly recorded.
- [ ] A relevant regression test accompanies a bug fix where feasible.
- [ ] Deployment, migration, monitoring and recovery effects are identified.
- [ ] No release blockers are silently dismissed or waived.
- [ ] The handoff distinguishes tested, inferred, not run and not applicable.

**Short directive:** Verify what matters, at the right boundary, using the smallest reliable set of tests; treat correctness, safety, usability, performance, recovery and maintainability as evidence-backed qualities, not labels.
