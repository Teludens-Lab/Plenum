# Cross-document consistency and semantic reconciliation matrix — v1.2

**Assessment type:** Targeted semantic review of five recovered Library v1.1 specification files. No source-code/runtime verification. Other authoritative corpus documents were not recovered as editable source for this package; marked **NOT REVIEWED**.

| Contract / risk | Source v1.1 baseline | v1.2 alignment | Consistency disposition | Follow-up |
|---|---|---|---|---|
| Definition vs immutable Release | Platform §§6,9; Data §§2–4 | Retain immutable published releases, mutable Studio drafts | ALIGNED WITH AMENDMENT | Canonical Schema ratification |
| One session writer vs disconnected devices | Runtime §§2,5,6,15 | One authority/epoch; device outbox provisional | NEW CONTRACT | API/authority ADR |
| Simultaneous Studio edits | Studio §18 | CRDT drafts, semantic validation, frozen publish | EXTENDED | Studio data contracts |
| Offline submit vs final adjudication | Runtime §§6,11,15 | Local drafts/commands accepted only by authority | CLARIFIED | Failure/role tests |
| Version activation | Platform §9, Studio §17, Runtime §§2,7 | Existing workflow pinning by default, reviewed migrations | REQUIRES OWNER APPROVAL | Canonical Schema and PRD |
| Information asymmetry and offline cache | Platform §8; Data §§7,8 | Participant-scoped encrypted projections | EXTENDED; SECURITY REVIEW | Projection contract |
| Evidence audit vs tamper evidence | Data §§9,15,19; Runtime §§16,17 | Signed checkpoints and separately controlled anchors | NEW GUARANTEE | Custody/crypto review |
| Object storage/package portability | Platform §§3,6 | Retained; offline package validation and deployment | ALIGNED WITH EXTENSION | Imports & signing |
| Tenant RLS vs simulation policy | Data §§5,7 | RLS defense-in-depth; application information policy | CLARIFIED | Security negative tests |
| No microservice mandate | Platform §4 lists apps/packages | Distinguish code topology from deployable topology | AMBIGUITY RESOLVED CONCEPTUALLY | ADR + implementation |
| Phase/role-specific behaviors | Fractured Order extraction | No runtime-specific source branches | RETAINED | Executable parity tests |
| Scaling 500×10 | Not performance verified | Added planning load envelope only | TEST REQUIRED | Synthetic load tests |
| PRD and method canon | Named upstream by all five documents | No edits; upstream conformance pending | NOT REVIEWED | Recover canonical copies |
| Canonical Simulation Schema | Named downstream/upstream | No edits; schema constraints pending | NOT REVIEWED | Required before detailed logical data model |
| API and Event Contracts | Platform and Runtime references | No edits; envelope/retry contracts pending | NOT REVIEWED | Required before synchronization protocol |
| Architecture Control Pack | Prompt Book v1.4 references CTL-001..014 | This register is alignment input, not a replacement | PARTIAL | Merge into canonical CTL/ADR files |

## Cross-document checks performed

- Five recovered source documents each preserved unchanged substantive v1.1 body except the metadata version marker, with isolated v1.2 amendments.
- Consistent terms in new amendments: `DefinitionRevision`, `SimulationRelease`, `Session`, `authority_epoch`, `command ID`, `command receipt`, `offline outbox`, `evidence checkpoint`.
- Explicit separation: CRDT authoring vs authoritative Runtime command execution; cloud independence of air-gapped deployments; evidence integrity vs ordinary audit records.
- Not verified: original PRD conformance; full architecture corpus semantic compatibility; database migrations; executed Fractured Order parity.
