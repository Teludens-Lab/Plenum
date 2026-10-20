# Conflict register

Working log only. It is not decision authority. Consequential contradictions are submitted to the Decision Register as unassigned candidate OPEN text.

## Current normative conflicts

None discovered during generation. The current corpus consistently distinguishes Confirmed product direction, Assumed governance/vocabulary, Product Owner-approved technical design with any named specialist sign-offs still pending, and observed spike behavior.

## Observed gaps that are not normative conflicts

| Observation | Proposed handling | Owner | Tasks | Blocking | Candidate OPEN text |
|---|---|---|---|---|---|
| The repository is unborn and has no Git `HEAD`; the v0.2.0 tree is untracked. | Preserve exact paths and versions; establish version control before implementation commits. | Technical Lead | PS-001, PS-100 | Blocks commit-SHA provenance, not local inspection | "Approve the initial repository provenance and baseline commit for the rebuilt corpus and v0.2.0 slice." |
| Current host Node is 22.16.0 while the slice requires Node >=24 and ADR-008 proposes a 24 floor. | PS-001 fails preflight until a supported runtime is selected. | Technical Lead | PS-001 | Blocks supported-stack verification | Not a product OPEN item; execute the existing toolchain requirement. |
| Docker client exists but the daemon is unavailable, so PostgreSQL 18 was not run. | PS-001 uses a disposable Pg 18 environment when available. | Operations Owner | PS-001 | Blocks Pg 18 evidence | Not a decision conflict; environment availability. |
| The reference implements Strategic Orientation content, its pre-Move 1 gate, related White Cell controls and decision-trace export semantics, but the corpus did not establish whether those details were general SSG methodology or Fractured Order configuration. | **Resolved 2026-10-19 under OPEN-026:** Plenum exposes the reusable Orientation/coverage-gate, Control and decision-trace mechanics as configurable platform options. Each Release owns the exact forms, roles, labels, timing, ordering, required combinations and gate rules; Fractured Order details are not hard-coded into the platform. | Methodology Lead | PS-000, PS-200, PS-210 | No longer blocks classification; unexecuted parity remains assigned to later phases | Closed by `OPEN-026`. |

If a future task finds a contradiction, add: source citations, proposed resolution, owner, affected task IDs, blocking status, and candidate OPEN wording. Do not assign a new OPEN number locally.
