# Plenum — Extension Framework and Model Composition

## Document control

| Field | Value |
|---|---|
| Document ID | EXT |
| Number | 10 |
| Version | 1.1.0 |
| Date | 2026-10-17 |
| Status | Product decisions Confirmed (DEC-52 to DEC-60); technical contracts Approved by Product Owner direction on 2026-10-20 (ADR-018). First-release scope (DEC-58). |
| Owner | Technical Lead |
| Approvers | Product Owner; Technical Lead; Security Owner (role placeholders — OPEN-001) |
| Reads from | 01 PRD; 02 Platform; 03 Schema; 04 Studio; 05 Runtime; 06 Data and Security; 09 Contracts; Data Model v1.1; Sync v1.1; Decision Register; Glossary |
| Read by | Plugin developers; Studio and Runtime implementation; security review; tests |
| Authority | Plugins and Platform Adapters: categories, manifest, registry lifecycle, execution, composition, human approval, persistence, contracts, isolation, provenance and acceptance tests. |
| Supersedes | Owner-supplied `PLENUM_EXTENSION_FRAMEWORK_AND_MODEL_COMPOSITION_ARCHITECTURE_v1.0.md` (EXT-ARCH-001); 02 Platform v1.3 §18 plugin interface. Kept in `archive/` |

---

## 1. Purpose and boundaries

The Extension Framework lets authorized external developers build executable models that designers discover, configure, connect, test and bind to Simulation Releases without writing code. It extends the Studio → Release → Runtime model while keeping SSG methodology, single Session Authority (ADR-001), information asymmetry (DEC-10) and evidence provenance (ADR-003) intact.

Product decisions:

| Decision | Rule |
|---|---|
| DEC-52 | Developers are limited to SSG, approved research partners and institutional customers. No public marketplace or anonymous submission. |
| DEC-53 | Designers do not write plugin code in Studio. They configure and compose approved Plugins. |
| DEC-54 | Every consequential effect a Plugin or Model Composition proposes on authoritative Session state requires explicit approval by an authorized person. Computing, precomputing and staging proposals need no approval. Designer-authored rules, scheduled Injects and automatic Stage transitions are outside this rule and run as configured. |
| DEC-55 | Sequential and parallel compositions are supported; bounded feedback loops are deferred; arbitrary cycles are never allowed. |
| DEC-56 | Approved Plugins install in self-hosted and air-gapped deployments without an external cloud. External-service Plugins are labeled and cannot be deployed air-gapped without a verified local replacement. |
| DEC-57 | Plugins may propose simulated-actor choices and message drafts during a Session; they take effect only after approval. AI-assisted authoring stays deferred. |
| DEC-58 | The whole framework is first-release scope. |

Non-goals: a public marketplace; a code editor or model-training environment in Studio; Plugin access to the database, raw Evidence Event journal, global filesystem, arbitrary secrets or policy-engine internals; Plugins replacing core identity, tenancy, authorization, workflow, human decision authority, evidence, Release activation or methodology validation; unrestricted agents that execute tools or change state; a second authority during disconnection.

## 2. Terms and ownership

Definitions are in the Glossary §4 and §5.

| Term | Owner |
|---|---|
| Plugin, Plugin Artifact | Developer; registry and object store |
| Plugin Installation | Organization administration |
| Plugin Configuration, Plugin Binding, Model Composition | Studio and Release compiler |
| Extension Host | Platform (ADR-018) |
| Model Run, Composition Run | Extension Host |
| Effect Proposal | Plugin output, staged by the Runtime |
| Approval Decision, committed effect | Session Authority |
| Platform Adapter (Voting Method, Media Provider) | Core capability owner (DEC-59) |

## 3. Categories and capabilities

A category is discovery metadata, never a permission (DEC-60). Categories may overlap; capabilities are permissioned separately.

| Family | Category | Examples | Typical outputs |
|---|---|---|---|
| model | Adjudication | PLI, action resolution, negotiation and conflict models | Decision proposal, confidence, Effect Proposals |
| model | World and simulation | Economy, political stability, epidemiology, supply chains | Forecasts, proposed State Value changes |
| model | Agents and actor behavior | Simulated institutions, markets, non-player counterparts | Proposed actor choices and message drafts (DEC-57) |
| communication | Information and communication | Media cycles, intelligence reporting | Draft Injects, simulated reports |
| evidence | Evidence and observation | Coding rubrics, structured observation, data ingestion | Attributed observations |
| analysis | Research and analysis | After-action, comparison, network and decision-path analysis | Derived reports and measures |
| analysis | Experimentation and evaluation | Treatment assignment, scoring, sensitivity testing | Experiment metadata, proposed assignments |
| analysis | Visualization and spatial | GIS, trade flows, network views | Read-only projections |
| evidence | Integration and data | LMS, external engines, datasets | Connector reads, proposed imports and exports |

Capabilities a Plugin may declare: `compute`, `propose_effect`, `propose_inject`, `analyze`, `render_derived`, `read_approved_external`, `export_approved`. A declaration confers nothing by itself; the Runtime decides what each Model Run may do.

**Platform Adapters** (DEC-59) are outside this table. Voting Method Adapters (11 §8) and Media Provider Adapters (12 §2) are packaged, signed, installed and pinned through the same registry, but they extend a core capability and never hold authority.

## 4. Topology

```text
Developer SDK / CI -> signed Plugin Artifact -> registry verification -> Plugin Installation
Studio composition builder -> Release compiler -> Release (plugin lockfile + composition graph)
Session Authority -> input projection -> execution gateway -> Extension Host (isolated)
   -> validated result -> Effect Proposals staged -> human approval -> Command
   -> state change + Evidence Event + receipt + outbox
```

Plenum owns all ingress and egress, configuration verification, execution authorization and state changes. The Extension Host is an isolation boundary, not a microservice per Plugin. Isolation follows ADR-018: hardened rootless containers by default, WASM/WASI as an additional target for deterministic models; external-service connectors go through a controlled egress gateway. Approved sandbox targets for Python and native scientific libraries: OPEN-022.

## 5. Manifest and SDK

Each Plugin provides: canonical ID, semantic version, immutable digest, publisher identity, categories, capabilities, execution mode, connectivity, reproducibility declaration, interface version, input and output JSON Schemas, resource limits, compatible Release and host API ranges, maximum data classification, requested permissions, dependencies, provenance, license and signature. Production approval requires a signed supply-chain attestation and SBOM per organization policy (OPEN-029).

```json
{
  "manifestVersion": "1.0",
  "pluginId": "org.ssg.models.political-stability",
  "version": "1.0.0",
  "digest": "sha256:<64-hex-digest>",
  "publisher": { "id": "ssg", "signatureKeyId": "publisher-key-2026-01" },
  "categories": ["world_and_simulation"],
  "capabilities": ["compute", "propose_effect"],
  "execution": { "mode": "container", "entrypoint": "model-runner" },
  "connectivity": "offline_capable",
  "contracts": { "inputSchema": "schemas/input.json", "outputSchema": "schemas/output.json" },
  "compatibility": { "hostApi": ">=1.0 <2.0", "releaseSchema": ">=1.3 <2.0" },
  "limits": { "timeoutSeconds": 30, "memoryMiB": 512, "cpuMillis": 20000 },
  "requestedPermissions": ["state_values.read:mapped", "effects.propose"],
  "dataClassificationMaximum": "internal",
  "reproducibility": { "deterministic": true, "seedInput": "seed" },
  "dependencies": [],
  "license": "institutionally-approved"
}
```

The signature covers a canonical digest of the manifest and every referenced artifact and dependency digest. Versions and tags alone are never enough. The registry rejects a second digest for the same `(pluginId, version)`.

The SDK supplies schema validators, a fixture runner, a contract-test harness, permission checks, host API stubs, and packaging and signing tools.

## 6. Registry lifecycle

```text
submitted -> scanned -> contract_validated -> security_reviewed -> approved -> published
   -> installed (per Deployment and Organization) -> enabled -> bound to a Release -> run
```

Exits: `rejected`, `suspended`, `revoked`, `deprecated`, `quarantined`, `uninstalled` (Glossary §7.10). Publisher approval, artifact approval, Organization installation, per-Release binding and per-run authorization are separate steps. Revocation stops new runs under the emergency policy and never deletes historical digests, inputs, outputs, approvals or Evidence Events.

**Offline installation bundles** for air-gapped Deployments carry the payload, manifest, publisher attestation, dependency closure, compatibility matrix, schemas, the vulnerability and license attestations available at bundle time, and trusted-key information. Trust comes from an institution-provisioned trust root; a bundle can never define its own. Updates and revocation lists are imported explicitly. Media transfer, malware scanning and accreditation are institutional procedures (OPEN-029, OPEN-014).

## 7. Execution modes

| Mode | Connectivity value | Air-gapped | Failure behavior |
|---|---|---|---|
| Bundled deterministic WASM | `offline_capable` | Yes, if the security profile approves | Fails in isolation; no effect |
| Bundled container or native model | `offline_capable` | Yes, with dependencies installed | Fails in isolation; no effect |
| LAN-local model service | `lan_required` | Yes, if packaged and provisioned | Timeout or unavailable is an explicit failure |
| External HTTPS service | `external_required` | No, unless a verified local replacement is bound | Skip or degrade only if the definition allows; never an invented output |

The Release compiler rejects an air-gapped deployment profile with an enabled `external_required` Plugin (`CAPABILITY_UNAVAILABLE`). Fail-safe means no implied success, no silent substitution, no unauthorized disclosure and no state change on missing or invalid output. An optional Plugin can show `unavailable`; a critical workflow pauses in a supervised pending state.

## 8. Input and output contracts

Execution request:

```json
{
  "invocationId": "uuid",
  "sessionId": "uuid",
  "compositionRunId": "uuid",
  "nodeId": "economic-model",
  "pluginDigest": "sha256:<digest>",
  "governingReleaseId": "uuid",
  "configurationDigest": "sha256:<digest>",
  "inputSnapshotId": "uuid",
  "inputSchemaVersion": "1",
  "inputs": { "sanctionsIntensity": 0.5 },
  "seed": 42,
  "deadlineAt": "2026-10-17T23:00:00Z",
  "correlationId": "uuid"
}
```

Inputs are filtered by Information Policy and classification and bounded in size (REQ-050). The host cannot query state beyond the approved snapshot. Protected payloads never enter ordinary logs. Permissions come from the Runtime, never from the manifest alone.

Result:

```json
{
  "invocationId": "uuid",
  "status": "completed",
  "pluginDigest": "sha256:<digest>",
  "outputSchemaVersion": "1",
  "outputs": { "economicOutputDelta": -0.04 },
  "effectProposals": [
    { "effectId": "uuid", "target": "state_value:economic_output", "operation": "adjust", "value": -0.04 }
  ],
  "provenance": { "inputSnapshotId": "uuid", "seed": 42, "environmentDigest": "sha256:<digest>" }
}
```

The host validates the output schema, allowed effect types, size limits, invocation and version match, and provenance before staging. Confidence, uncertainty, units and rationale are kept when present. `completed` means the computation finished, not that any effect was approved or applied.

## 9. Model Composition

A Model Composition is a typed directed graph compiled into the Release (03 Schema §14.2). Node kinds: `model`, `transform` (allowlisted pure transformations), `fan_out`, `join`, `approval_gate`, `output`. Each edge maps an output port to an input port with type, units, classification, required or optional, and version. There are no script nodes.

- **Sequential:** a downstream node waits for a validated upstream output. Where the edge carries a consequential state effect, downstream reads use approved and committed state only.
- **Parallel:** independent nodes run against the same pinned snapshot; a join names partial results and deterministic merge rules. Combined Effect Proposals are reviewed together before commit.
- **Feedback:** deferred (DEC-55). No cycles in the first release.
- **Dependencies:** Plugin digests, adapters and data contracts form a lockfile compiled into the Release. Nothing is fetched at run time.
- **Compiler checks:** port type and unit compatibility, missing inputs, classification flow, illegal fan-in, unreachable nodes, duplicate effect targets, missing approval gates, cycles, budgets and dependency closure.
- **Scheduling:** bounded retries; immutable node-attempt records; deterministic ordering where it affects the approval package.

Intermediate numbers may pass between models without approval only while they stay labeled provisional. A Plugin never reads a provisional prediction as accepted world state.

```json
{
  "compositionId": "sanctions-to-stability",
  "version": "1",
  "nodes": [
    { "id": "economy", "kind": "model", "bindingId": "economy-model-v1" },
    { "id": "politics", "kind": "model", "bindingId": "stability-model-v1" },
    { "id": "review", "kind": "approval_gate", "approverSelector": "session_role:white_cell" }
  ],
  "edges": [
    { "from": "economy.outputs.gdpDelta", "to": "politics.inputs.gdpDelta" },
    { "from": "politics.effectProposals", "to": "review.proposals" }
  ]
}
```

## 10. Human approval

```text
run requested -> validated result -> Effect Proposals staged -> authorized review
  -> approve | reject | return
  -> on approve: recheck authority, permission, Release and state versions -> Command
  -> state change + Evidence Event + receipt + outbox
```

- Plugins have no `apply_effect` capability; only `effects.propose` and read-only or approved adapters.
- No Model Run, join or Plugin marked trusted may skip approval for a consequential effect (DEC-54). The rule does not extend to designer-authored rules, scheduled Injects or automatic Stage transitions.
- A reviewer may approve an explicitly listed batch when scope and conflicts are visible. New proposals need a new approval.
- An Approval Decision binds the proposal hash, Model Run IDs and digests, input snapshot, effect set, reviewer, reason, time, Governing Release, Authority Epoch and expected state version.
- If any of these is stale, application fails with `STALE_PROPOSAL` and needs re-evaluation. A past approval is never replayed against changed effects.
- Read-only forecasts and analysis need no approval; research exports and messages still pass Information Policy and governance checks.
- A disconnected device cannot approve. Approval Commands are never offline-queueable (Sync §4.3).

## 11. Persistence

Schema `extension` (ADR-016); large artifacts in object storage. Entity status and constraints are in Data Model v1.1 §4.9.

| Table | Essential fields |
|---|---|
| `extension.publishers` | Publisher ID, trust classification, contact, status, allowed signing keys |
| `extension.plugin_artifacts` | Plugin ID, version, unique digest, manifest digest, object key, lifecycle, signature verification; shared catalog metadata |
| `extension.plugin_installations` | Organization, Deployment, artifact digest, approved by, status, permitted capabilities, secret references |
| `extension.plugin_bindings` | Definition Revision, installation and digest, configuration digest, status |
| `extension.compositions` | Definition Revision, graph, graph digest, validation status |
| `extension.composition_runs` | Session, Governing Release, graph digest, trigger, snapshot, status, correlation ID |
| `extension.model_runs` | Composition Run, node, attempt, artifact digest, input and output digests, duration, status, failure code |
| `extension.effect_proposals` | Model Run provenance, target aggregate, payload and digest, lifecycle (Glossary §7.11) |
| `extension.approval_decisions` | Proposal hash, reviewer, decision, Authority Epoch, expected version, reason, scope |
| `extension.effect_receipts` | Approved proposal, unique Runtime Command ID, applied version, Evidence Event ID |

Everything Organization-owned is tenant-scoped (ADR-015). Runs, proposals and decisions are append-only provenance and survive Plugin removal.

## 12. Contracts

**Organization and Studio operations** (REST, Audit Records):

```text
POST /v1/plugins/submissions                               # restricted publishers (DEC-52)
POST /v1/plugins/{artifactId}/approve                      # separation of duties
POST /v1/organizations/{orgId}/plugin-installations
GET  /v1/organizations/{orgId}/plugin-catalog
POST /v1/projects/{projectId}/compositions/validate
```

**Session Commands** (standard endpoint, 09 §3): `composition_run.start`, `composition_run.cancel`, `effect_proposal.approve`, `effect_proposal.reject`, `effect_proposal.return`.

**Queries:** `GET /v1/sessions/{sessionId}/composition-runs/{runId}` (status and authorized outputs); `GET /v1/sessions/{sessionId}/effect-proposals?status=in_review`.

**Events:** `plugin_artifact.approved`, `plugin_artifact.revoked`, `plugin_installation.installed`, `plugin_installation.unavailable`, `composition_run.started`, `composition_run.completed`, `composition_run.failed`, `model_run.started`, `model_run.completed`, `model_run.failed`, `effect_proposal.staged`, `effect_proposal.approved`, `effect_proposal.rejected`, `effect_proposal.returned`, `effect_proposal.applied`.

**Error codes** (09 §8.1):

| Specification v1.0 code | Canonical code |
|---|---|
| `PLUGIN_UNAVAILABLE` | `PLUGIN_UNAVAILABLE` |
| `CONTRACT_INVALID` | `VALIDATION_FAILED` for submissions; a `model_run.failed` with failure code `output_invalid` for results |
| `PLUGIN_NOT_APPROVED` | `PLUGIN_NOT_APPROVED` |
| `DEPENDENCY_MISSING`, `AIRGAP_INCOMPATIBLE` | `CAPABILITY_UNAVAILABLE` |
| `CAPABILITY_DENIED` | `PERMISSION_DENIED` |
| `STALE_PROPOSAL` | `STALE_PROPOSAL` |
| `AUTHORITY_UNAVAILABLE` | `AUTHORITY_UNAVAILABLE` |
| `APPROVAL_REQUIRED` | `INVALID_TRANSITION` (no Command applies an unapproved proposal) |

## 13. Isolation and security

- Least privilege; a technical identity per installation or invocation where feasible; no ambient cloud credentials.
- Read-only base, ephemeral scratch space, no access to other Sessions; memory, CPU, time and output caps; kill on exhaustion.
- Network egress denied by default; allowlisted endpoints only for approved external-service connectors; none in air-gapped profiles.
- Input filtered by classification and Information Policy; output scanned and validated; no exfiltration through logs.
- No direct SQL, object-store access, subprocesses or tools unless the reviewed isolation profile includes them.
- Secrets injected from the institutional secret store by reference; never in Releases, Packages or exports.
- Reproducibility metadata: artifact and container digests, dependency closure, model version, seed, input snapshot digest, host version, time and reviewer. Non-deterministic results are labeled and kept, never replayed as if identical (05 §21).
- Signing, vulnerability review, emergency revocation and rollback are required; key custody and algorithms: OPEN-029.

## 14. Evidence and provenance

For each consequential proposed effect the chain is: triggering Command → input snapshot → Composition Run and Model Runs → output digest → Effect Proposal → Approval Decision → Command Receipt → committed state and Evidence Event. Rejections, failures and retries are kept. Analysis Plugins produce Derived Metrics and Findings (08 Canon §10.1) and never rewrite participant evidence. Checkpoints and anchors stay with the evidence subsystem (ADR-003); the Extension Host keeps no separate audit ledger.

## 15. Release activation and offline operation

The Release pins Plugin digests, manifest and schema versions, configuration digest, composition graph digest, dependency closure and required local availability. Binding changes in a live Session follow ADR-004; in-flight Composition Runs keep their pinned graph and Plugins unless explicitly migrated and reviewed. Pending runs are cancelled, resumed or rejected by declared policy, never reinterpreted. If a Plugin is unavailable offline, the platform reports `unavailable` or pending and uses only an explicitly approved alternative. Participant devices never run adjudication Plugins as a second authority. An institutional local Runtime may run locally installed Plugins and commits only after approval on that authority.

## 16. Failure handling

| Failure | Required behavior |
|---|---|
| Plugin timeout or crash | Failed node attempt recorded; bounded, idempotent retry if safe; no effects |
| Malformed output | Rejected by contract validation; artifact or run quarantined if systemic; reviewer informed |
| Partial parallel graph | Marked partial; join policy decides wait, fail or an authorized partial proposal; no silent defaults |
| External-only Plugin in an air-gapped profile | Blocked at publication or deployment check; no external access attempted |
| Artifact revoked mid-Session | New runs denied; pending work follows the emergency policy; evidence kept |
| Approval on a stale snapshot | `STALE_PROPOSAL`; reassessment and new approval needed |
| Server interrupted after approval | Idempotent receipt and outbox allow safe retry; no double application |
| Reviewer unavailable | Explicit pending review; an operator may reassign within policy; never auto-approved |
| Cycle in a composition | Publication rejected with the cycle path |

## 17. First-release delivery

DEC-58 puts the whole framework in the first release. 07 Roadmap Phase 2 delivers the core and Phase 3 the Studio builder:

1. SDK, manifest schema, signing tools and a deterministic PLI-like test Plugin (clearly labeled as a fixture, not PLI).
2. Publisher intake, registry approval, Organization installation and the Studio plugin catalog and inspector.
3. Bind the test Plugin to a workflow event in a Fractured Order-derived Release, with pinned digest and configuration.
4. Run against an authorized snapshot and stage an Effect Proposal.
5. White Cell approves; the Runtime commits exactly once with Evidence Event and receipt.
6. A second deterministic model; composition builder; sequential and parallel runs with no state change before approval.
7. The same Release in a disconnected institutional deployment with zero public egress, including an offline installation bundle; external-required connectors fail without false success.

## 18. Acceptance tests

| ID | Given / when | Must demonstrate |
|---|---|---|
| EXT-01 | Unauthorized publisher submits | Denied; no installable artifact |
| EXT-02 | Signed approved Plugin installed | Digest, signature and compatibility checked; separate Organization approval |
| EXT-03 | Tampered bundle installed offline | Rejected without Internet |
| EXT-04 | Approved local Plugin runs air-gapped | No network use; deterministic permitted output |
| EXT-05 | External-required Plugin in an air-gapped profile | Blocked or explicitly disabled at validation |
| EXT-06 | Model proposes an effect | Session state unchanged until approval |
| EXT-07 | Unauthorized reviewer approves | Denied at the trusted boundary |
| EXT-08 | Same approval Command retried | Exactly one effect and one Evidence Event |
| EXT-09 | Two reviewers conflict | One valid transition; the other gets a conflict |
| EXT-10 | Input would include hidden role data | Excluded from the snapshot; negative test shows no leak |
| EXT-11 | Plugin times out or returns malformed output | Visible failure; no invented result or effect |
| EXT-12 | Sequential composition | Typed outputs routed with pinned versions; consequential reads use committed state |
| EXT-13 | Parallel composition partly fails | Structured partial or failure state; explicit join behavior |
| EXT-14 | Cycle or incompatible unit in a graph | Compiler rejects with an actionable error |
| EXT-15 | Release changes with a run in flight | Existing run pinned; new activation governed and recorded |
| EXT-16 | Plugin revoked | New runs blocked; historical evidence verifiable |
| EXT-17 | Export after several runs | Attribution includes model, input and configuration digests, reviewer, decision and receipts |
| EXT-18 | Disconnected client attempts approval | Cannot commit; nothing bypasses authority on reconnection |
| EXT-19 | DEC-16 workload | Load and contention measured; no capacity claim before test (OPEN-019) |
| EXT-20 | Designer-authored rule or scheduled Inject fires | Runs as configured with no approval step (DEC-54 scope) |

Status: specification only. No tests have been run.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-10-17 | Owner-supplied specification EXT-ARCH-001 (archived). |
| 1.1.0 | 2026-10-17 | Integrated into the document set: decisions recorded as DEC-52 to DEC-60; approval scope limited to Plugin and composition effects (DEC-54); actor proposals allowed with approval (DEC-57); whole framework first-release (DEC-58); Platform Adapter class (DEC-59); Session Commands through the standard endpoint; canonical event names and error codes; isolation baseline ADR-018; EXT-20 added. |
