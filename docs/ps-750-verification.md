# PS-750 verification

Date: 2026-11-01  
Implementation: **PASS**  
Automated acceptance: **PASS**  
Independent ten-minute user test: **PASS — 2026-11-01**  
Change-level acceptance: **GRANTED**  
Production approval: **NOT RUN**

## Delivered behavior

- Advanced logic visually authors typed State Values, Scenario initial values, Capabilities, Resources, activation/completion Gates, conditional transitions, degradation/Inject/adjudication Effects, and an attributable Effect source map.
- `adjudication-model-editor-v1` visually authors doctrine, rubric, constrained rules with explanations, perspectives, model inputs, approval, outputs, follow-on Injects, proposed state Effects, publication and precedent.
- Adjudication preview separates suggestion, review, approval and committed effect, and cannot create authoritative state changes.
- Plugin bindings expose profile-by-profile fail-closed compatibility and policy-filtered inputs. Model Compositions retain typed, acyclic, approval-gated construction and zero-state-change fixtures.
- Poll creation supplies explicit denominator, abstention, quorum, tie and certification semantics. Secret ballot and anonymous survey publication remain blocked by the resolved `OPEN-028` version-1 restriction.
- Voice authoring exposes target-profile capability and fail-closed reasons, four modes, permissions, radio controls and a non-audio path. Production recording and transcription remain blocked by the resolved `OPEN-027` version-1 restriction.
- No SQL migration was needed: the additive models use the existing versioned collaborative Draft JSON and immutable Release path. The planned `029_authoring_models` register entry records that decision.

## Evidence

| Gate | Result | Evidence |
|---|---|---|
| `PS-750-T01` | PASS | A complete world-state/adjudication contract validates; an unknown Fact fails with a linked `adjudicationModels` issue. |
| `PS-750-T02` | PASS | Real Chromium completes visual authoring, fail-closed Plugin/Poll/Voice checks, explanation-only adjudication preview, collaborative save and scoped Axe scan. Screenshot: `output/playwright/ps-750/advanced-authoring.png`. |
| `EXT-12` | PASS | Deterministic typed sequential composition returns provisional output with zero state changes. |
| `VOTE-15` | PASS | Missing Poll denominator/tie semantics and gated ballot modes are rejected; new Polls also require an explicit certifier. |
| `VOICE-09` | PASS | Media Provider capability is validated per target deployment profile and unsupported combinations fail closed. |

## Verification commands

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS; 69 sources and 42 versioned contracts |
| `npm test -- --run` | PASS; 107/107 |
| `npm run test:integration` | PASS; 28/28 on isolated PostgreSQL 18.6 and SeaweedFS |
| `npm run test:e2e:product -- --grep PS-750-T02` | PASS; 1/1 in Chromium with Axe |
| `npm run test:a11y` | PASS after correction: 9 unaffected tests passed; the new collapsed-Capability regression timed out; Capability cards were made immediately editable; the failed PS-400 test and the previously skipped activation test then passed 2/2 |
| `npm run test:airgap` | PASS; 9/9, including rootless/no-egress/read-only mount evidence |
| `npm run audit:product-completeness` | PASS; 228 obligations and omission check |

The first focused product-test iterations exposed unstable test targeting and a duplicate preview landmark name. Targeting was made semantic, and each adjudication preview now has a model-specific accessible landmark name. The standalone accessibility suite then exposed the collapsed new-Capability regression; the control opens immediately and its focused rerun passed.

## Human acceptance

The product owner completed all ten steps in [PS-750-user-test.md](acceptance/PS-750-user-test.md) without developer tools or authorization headers. Submitted evidence covers complete visual authoring, constrained rules, zero-state-change previews, Plugin compatibility, explicit Poll rules, Voice capability, persistence, Reviewer least privilege and offline recovery. The product owner separately confirmed the negative-test settings were restored to Poll **open** and Voice recording/transcription **off**, with synchronization complete.

PS-750 implementation, automated acceptance and independent human acceptance are PASS. `OPEN-013` was subsequently resolved by user direction on 2026-11-01; PS-760 later implemented and verified those publication controls. This evidence does not grant production approval.
