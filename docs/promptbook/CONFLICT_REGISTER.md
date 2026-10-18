# Conflict register

Working log only. It is not decision authority. Consequential contradictions are submitted to the Decision Register as unassigned candidate OPEN text.

## Current normative conflicts

None discovered during generation. The current corpus consistently distinguishes Confirmed product direction, Assumed governance/vocabulary, Proposed technical design, and observed spike behavior.

## Observed gaps that are not normative conflicts

| Observation | Proposed handling | Owner | Tasks | Blocking | Candidate OPEN text |
|---|---|---|---|---|---|
| The repository is unborn and has no Git `HEAD`; the v0.2.0 tree is untracked. | Preserve exact paths and versions; establish version control before implementation commits. | Technical Lead | PS-001, PS-100 | Blocks commit-SHA provenance, not local inspection | "Approve the initial repository provenance and baseline commit for the rebuilt corpus and v0.2.0 slice." |
| Current host Node is 22.16.0 while the slice requires Node >=24 and ADR-008 proposes a 24 floor. | PS-001 fails preflight until a supported runtime is selected. | Technical Lead | PS-001 | Blocks supported-stack verification | Not a product OPEN item; execute the existing toolchain requirement. |
| Docker client exists but the daemon is unavailable, so PostgreSQL 18 was not run. | PS-001 uses a disposable Pg 18 environment when available. | Operations Owner | PS-001 | Blocks Pg 18 evidence | Not a decision conflict; environment availability. |

If a future task finds a contradiction, add: source citations, proposed resolution, owner, affected task IDs, blocking status, and candidate OPEN wording. Do not assign a new OPEN number locally.
