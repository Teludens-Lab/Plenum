# Conflict register

Working log only. It is not decision authority. Consequential contradictions are submitted to the Decision Register as unassigned candidate OPEN text.

## Current normative conflicts

None discovered during generation. As of 2026-11-08, the former assumptions are confirmed or superseded by approved amendments; the Decision Register separates policy resolution from implementation and specialist/release evidence. Older observations below remain dated history, not current blockers.

## Observed gaps that are not normative conflicts

| Observation | Proposed handling | Owner | Tasks | Blocking | Candidate OPEN text |
|---|---|---|---|---|---|
| The repository is unborn and has no Git `HEAD`; the v0.2.0 tree is untracked. | Preserve exact paths and versions; establish version control before implementation commits. | Technical Lead | PS-001, PS-100 | Blocks commit-SHA provenance, not local inspection | "Approve the initial repository provenance and baseline commit for the rebuilt corpus and v0.2.0 slice." |
| Current host Node is 22.16.0 while the slice requires Node >=24 and ADR-008 proposes a 24 floor. | PS-001 fails preflight until a supported runtime is selected. | Technical Lead | PS-001 | Blocks supported-stack verification | Not a product OPEN item; execute the existing toolchain requirement. |
| Docker client exists but the daemon is unavailable, so PostgreSQL 18 was not run. | PS-001 uses a disposable Pg 18 environment when available. | Operations Owner | PS-001 | Blocks Pg 18 evidence | Not a decision conflict; environment availability. |
| The reference implements Strategic Orientation content, its pre-Move 1 gate, related White Cell controls and decision-trace export semantics, but the corpus did not establish whether those details were general SSG methodology or Fractured Order configuration. | **Resolved 2026-10-19 under OPEN-026:** Plenum exposes the reusable Orientation/coverage-gate, Control and decision-trace mechanics as configurable platform options. Each Release owns the exact forms, roles, labels, timing, ordering, required combinations and gate rules; Fractured Order details are not hard-coded into the platform. | Methodology Lead | PS-000, PS-200, PS-210 | No longer blocks classification; unexecuted parity remains assigned to later phases | Closed by `OPEN-026`. |
| PS-350 originally required AC-07 and AC-11 even though their behavior belongs to PS-420/PS-500 downstream of PS-350. | **Resolved 2026-10-21 by owner direction:** PS-350 proves only its active implemented-capability set. AC-07 and AC-11 are deferred to PS-420/PS-500 and remain mandatory at PS-550 before release approval; neither may be inferred from seeded rows or prose. | Product Owner; Technical Lead | PS-350, PS-420, PS-500, PS-550 | No longer blocks PS-350 task ordering; still blocks release until AC-07/AC-11 pass | Closed; no OPEN number required. |
| Teludens defines responsive transformation principles but not the complete PS-800 route/state evidence matrix of seven named viewport sizes, 200%/320 CSS px reflow, themes, forced colors, reduced motion and input modes. | Use the explicit PS-800 matrix conservatively for implementation/evidence while retaining Teludens spatial grammar; request owner ratification before change-level acceptance. | Product Owner; Technical Lead | PS-800 | Does not block Checkpoint A; blocks treating the matrix as ratified product authority | "Approve the PS-800 viewport, zoom, color-mode and input matrix as the supported UI conformance evidence baseline." |
| PS-800 requires a roughly one-second remote-update emphasis, but the Teludens catalog and production token layer do not define a semantic remote-update duration/token. | Keep the behavior as an identified motion-token gap; do not add a local literal. Propose a conservative semantic token during implementation and request owner ratification. | Product Owner; Technical Lead | PS-800 | Does not block Checkpoint A; blocks MOT-010 implementation | "Approve the semantic remote-update emphasis token and duration used to identify changed content without moving focused, hovered or selected content." |

If a future task finds a contradiction, add: source citations, proposed resolution, owner, affected task IDs, blocking status, and candidate OPEN wording. Do not assign a new OPEN number locally.

## 2026-11-08 sequence reconciliation

The former PS-840 requirement that every ledger row already pass would require future PS-845 operational evidence and unresolved PS-815/820 external/human gates. The task now accepts product-owned rows only; PS-850 retains the mandatory whole-ledger gate with direct dependencies on all remaining tasks. No requirement or final gate is waived. PS-845 is added for the distinct OPEN-016 implementation outcome; “PS-40” in the request is interpreted as PS-840.
