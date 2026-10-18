# Plenum Extension Framework and Model Composition Architecture v1.0

**Document ID:** EXT-ARCH-001  
**Version:** 1.0.0  
**Date:** 2026-10-17  
**Status:** Approved product decisions / proposed technical implementation contracts; implementation not verified  
**Owner:** Plenum product owner  
**Governance:** Enterprise PRD and approved Plenum architecture ADRs remain upstream; this specification elaborates but does not override them.

## 1. Purpose and boundaries

Plenum's Extension Framework lets **authorized external developers** create specialized executable models and adapters that simulation designers can **discover, configure, connect, test, and bind** to Simulation Releases without writing code. It adds extensibility to the common Studio → immutable Release → Runtime execution model and must preserve SSG methodology, single-session authority, protected information asymmetry, and evidence provenance.

### Confirmed product decisions

- Plugin developers are limited to **SSG developers, approved research partners, and institutional customers**. No public anonymous submission or open marketplace.
- Simulation designers **do not author plugin implementation code inside Studio**. They configure and compose externally developed, approved plugins.
- **Every consequential model effect on authoritative simulation state requires explicit approval by an authorized human.** Automatic computation, precomputation, and staging of proposals are permissible; automated final application of consequential effects is not.
- Model composition is supported with explicit inputs, outputs, dependencies, and approval boundaries; sequential and parallel compositions are baseline patterns, with bounded-cycle feedback as a later supported pattern.
- Approved plugins should be installable for **institutional self-hosted and air-gapped Plenum deployments without reliance on an external cloud**. External-service plugins are optional, explicitly labeled by connectivity and data-egress requirements; their failure must not create false success or unapproved state transitions.

### Non-goals

- Public developer marketplace; unrestricted code editor or model training environment in Studio.
- Plugin access to the primary transactional database, raw event journal, global filesystem, arbitrary secrets, or policy-engine internals.
- Allowing extensions to substitute for Plenum's core identity, tenancy, authorization, workflow engine, human decision authority, audit/evidence, release activation, or methodology validator.
- An unrestricted agent allowed to arbitrarily execute tools or mutate session state.
- A second authoritative Runtime during a disconnection.

## 2. Terminology and architecture ownership

| Term | Normative meaning | Owner |
|---|---|---|
| Plugin | Developer-produced package or service connector implementing a signed, versioned capability contract | Extension registry / developer |
| Plugin Artifact | Immutable content-addressed distributable and dependency bundle | Registry / artifact store |
| Plugin Installation | Institutionally authorized, verified copy bound to organization/deployment | Tenant administration |
| Plugin Configuration | Designer-set parameters, mappings and declared triggers; nonsecret material in Release, secret references held in installation | Studio and deployment |
| Plugin Binding | Reference from a simulation definition to an approved installation/version and configuration | Studio/Release compiler |
| Model Composition | Typed directed graph of plugin invocations, adapters, staging and approval gates | Studio/Release compiler |
| Extension Host | Constrained execution supervisor with quotas, data controls and instrumentation | Plenum platform |
| Model Run | An invocation using a fixed plugin digest, input snapshot, configuration, and runtime context | Extension Host |
| Proposed Effect | Typed requested change to canonical simulation state, never an actual change | Plugin output |
| Approval Decision | Human accept/reject/return of a proposed effect set, with permission and provenance | Authoritative Runtime |
| Committed Effect | State mutation applied atomically through normal Runtime commands after approval | Authoritative Runtime |

**Canonical vocabulary:** Adopt the governing enterprise PRD's `Simulation Project`, `Simulation Release`, `Session`, and `Evidence` terms. Historical use of `simulation version`, `scenario version`, `run`, and `package` requires a documented mapping rather than silent renaming of persisted contracts.

## 3. Plugin categories and capability model

**Category is discovery metadata, not a permission grant.** Categories may overlap; capabilities are independently permissioned.

| Category | Examples | Characteristic outputs |
|---|---|---|
| Adjudication | PLI, strategic action resolution, negotiation and conflict models | Decision proposal, confidence/uncertainty, effect candidates |
| World and Simulation | Economy, political stability, epidemiology, supply chains, conflict dynamics | Forecasts, proposed state-variable changes |
| Agents and Actor Behavior | Simulated institutions, markets, nonplayer counterparts | Proposed actor choices and communication drafts |
| Information and Communication | Media cycles, message routing, intelligence reporting | Draft injects, simulated reports, approved communications |
| Evidence and Observation | Coding rubrics, structured observations, data ingestion | Attributed observations and evidence proposals |
| Research and Analysis | After-action, comparison, networks, decision-path analysis | Derived analytical reports, measures and citations |
| Experimentation and Evaluation | Treatment assignment, scoring, sensitivity testing | Experiment metadata, proposed assignments, results |
| Visualization and Spatial | GIS, trade flows, maps, interaction/network views | Read-only projections, validated derived layers |
| Integration and Data | LMS, external engines, federation, datasets | Connector reads, proposed imports/exports |

**Initial broad families:** `model`, `evidence`, `analysis`, `communication`; the detailed categories above are subtypes/tags, not a competing ontology. A plugin may advertise multiple capability kinds: `compute`, `propose_effect`, `propose_inject`, `analyze`, `render_derived`, `read_approved_external`, or `export_approved`. A capability declaration does not itself confer operational permission.

## 4. Logical topology

```text
[Developer SDK / CI] -> [Signed Plugin Artifact] -> [Organization Registry / Verification]
                                                       |
[Studio Model Composition Builder] -> [Release Compiler] -> [Immutable Release: plugin lockfile + graph]
                                                       |
                                              [Session Runtime / Authority]
                                                       |
                         [Input Projection Service] -> [Extension Execution Gateway]
                                                       |         |
                                                       |   [Isolated Extension Host]
                                                       |         |
                                                       <- [Validated Run Result]
                                                               |
                                                  [Proposed Effects Staging]
                                                               |
                                                [Human Approval Workflow]
                                                               |
                                          [Runtime Command / Transaction Gate]
                                                               |
                                        [State + Evidence + Receipt + Outbox]
```

Plenum owns all external ingress/egress, configuration verification, execution authorization and state mutations. The Host is a separable isolation boundary, not initially a separate microservice per plugin. Execution may be in an isolated process/container or supported sandbox; the security profile determines acceptable isolation strength. **WASM/WASI is a candidate execution target**, not a required standard for all models; Python/native scientific libraries may require hardened containers. External-service connectors run through a tightly controlled egress gateway.

## 5. Developer SDK and immutable manifest contract

Each plugin MUST provide: canonical ID, semantic version, immutable digest, publisher identity, categories, capabilities, execution mode, deterministic/reproducibility declaration, interface version, input and output JSON Schemas, resource budgets, compatible Release/Runtime schema ranges, data classifications, permissions, dependencies, provenance, license and artifact signature. A signed supply-chain attestation/SBOM is required by organizational policy for production approval.

### Example manifest (illustrative, not a final JSON Schema)

```json
{
  "manifestVersion": "1.0",
  "pluginId": "org.ssg.models.political-stability",
  "version": "1.0.0",
  "digest": "sha256:<64-hex-character-content-digest>",
  "publisher": {"id": "ssg", "signatureKeyId": "publisher-key-2026-01"},
  "categories": ["simulation", "world-model"],
  "capabilities": ["compute", "propose_effect"],
  "execution": {"mode": "container", "entrypoint": "model-runner", "requiresNetwork": false},
  "contracts": {"inputSchema": "schemas/input.json", "outputSchema": "schemas/output.json"},
  "compatibility": {"hostApi": ">=1.0 <2.0", "releaseSchema": ">=1.0 <2.0"},
  "limits": {"timeoutSeconds": 30, "memoryMiB": 512, "cpuMillis": 20000},
  "requestedPermissions": ["session.variables.read:approved", "effects.propose"],
  "dataClassificationMaximum": "internal",
  "reproducibility": {"deterministic": true, "seedInput": "seed"},
  "dependencies": [],
  "license": "institutionally-approved"
}
```

Manifest signature MUST cover a canonical digest of the manifest and referenced artifact/dependency digests. Lock both the manifest and executable payload by digest; tags/version strings alone are insufficient. Registries MUST reject duplicate `(pluginId, version)` with different digests unless governed revocation/republication procedures provide a new identifier/version.

The SDK supplies schema validators, fixture runner, contract-test harness, permission declaration checks, host API stubs, and packaging/signature tooling. Research partners can submit via a controlled intake and SSG/institutional publisher review; installations are separately approved by each organization or authorized deployment owner.

## 6. Registry and governance lifecycle

```text
Submitted -> Scanned -> Contract-validated -> Security reviewed -> Approved
                                                               |
                                                         Published artifact
                                                               |
                                                    Installed in deployment
                                                               |
                                                    Enabled for organization
                                                               |
                                               Bound to Simulation Release
                                                               |
                                                         Run / Audit
```

Additional lifecycle states: `rejected`, `suspended`, `revoked`, `deprecated`, `quarantined`, `uninstalled` (subject to historical retention). Approval of publisher and artifact is separate from organizational installation, per-simulation enablement, and per-run execution authorization. Revocation stops new executions (according to approved emergency policy) without deleting historical plugin digests, inputs/outputs, signed approvals, or evidence records.

For an air-gapped deployment, import an **offline installation bundle** containing immutable plugin payload, manifest, signed publisher attestation, dependency closure, compatibility matrix, schemas, vulnerability/license attestations available at bundle time, and trusted-key information. Trust must be established using a separately provisioned institution-approved trust root; an untrusted bundle cannot define its own trust root. Offline updates/revocation lists require explicit import procedures. Availability of patches cannot be silently assumed. Controlled media transfer, malware scanning and classified-system accreditation are institutional requirements, not capabilities proved here.

## 7. Execution modes and connectivity contracts

| Mode | Internet needed? | Air-gap suitability | Failure policy |
|---|---|---|---|
| Bundled deterministic WASM | No | Candidate if approved by local security profile | Fail isolated; no authoritative effect |
| Bundled container/native scientific model | No | Candidate with installed dependencies | Fail isolated; no authoritative effect |
| LAN-local model service | No public Internet; trusted LAN required | Yes if packaged and provisioned | Timeout/unavailable -> explicit failure |
| External HTTPS service | Yes unless separately mirrored | **Not air-gap compatible** without a local replacement | Skip/degrade only when simulation definition expressly permits; never manufacture output |

Plugins declare `connectivity: offline-capable | lan-required | external-required`, explicit hosts, protocols, secret references, data-egress classifications and fallback behavior. The Release compiler rejects air-gapped deployment profiles with an enabled external-required plugin unless a separately verified compatible local implementation is bound. **Fail-safe** means no implicit successful result, no silent substitution, no unauthorized disclosure, and no state mutation on missing/invalid output. A configured optional plugin can produce a visible `unavailable` result; critical workflows enter a supervised pending/paused pathway, not an invented adjudication.

## 8. Runtime input/output contracts

### Execution request (illustrative)

```json
{
  "invocationId": "uuid",
  "sessionId": "uuid",
  "compositionRunId": "uuid",
  "nodeId": "economic-model",
  "pluginDigest": "sha256:<digest>",
  "releaseId": "uuid",
  "configurationDigest": "sha256:<digest>",
  "inputSnapshotId": "uuid",
  "inputSchemaVersion": "1",
  "inputs": {"sanctionsIntensity": 0.5},
  "seed": 42,
  "deadlineAt": "2026-10-17T23:00:00Z",
  "correlationId": "uuid"
}
```

Inputs MUST be authorization-filtered and bounded. `inputSnapshotId` represents a versioned approved snapshot; the Plugin Host cannot query arbitrary state beyond approved adapters. Do not place protected raw payloads into ordinary telemetry/logs. Caller permissions are derived by Runtime, never granted by a plugin manifest alone.

### Result envelope (illustrative)

```json
{
  "invocationId": "uuid",
  "status": "completed",
  "pluginDigest": "sha256:<digest>",
  "outputSchemaVersion": "1",
  "outputs": {"economicOutputDelta": -0.04},
  "proposedEffects": [
    {"effectId": "uuid", "target": "session.variable:economic_output", "operation": "adjust", "value": -0.04}
  ],
  "provenance": {"inputSnapshotId": "uuid", "seed": 42, "environmentDigest": "sha256:<digest>"}
}
```

The Host validates output schemas, allowed effect types, size limits, matching invocation/version and provenance before staging results. Model confidence, uncertainty, constraints, units, and explanatory rationale should be preserved when available. `completed` means **computation completed**, not **effects approved or applied**.

## 9. Model Composition graph specification

A composition is a typed directed graph with nodes `model`, `transform` (allowlisted pure declarative transformations), `fan_out`, `join`, `approval_gate`, and `output`. Each edge explicitly maps output port to input port, including type, units, sensitivity classification, required/optional semantics and version. No arbitrary script nodes in Studio.

- **Sequential:** downstream node waits for a validated upstream output; if the connection represents a *consequential state effect*, downstream authoritative state reads require approved+committed state.
- **Parallel:** independent nodes execute against the same pinned authorized state snapshot; a join identifies partial results and deterministic merge rules. Combined effect sets require human review before commit.
- **Feedback:** may be supported in future only through explicit bounded iteration nodes with maximum cycles, convergence/termination criteria and human approval between consequential state commits. **No arbitrary directed cycle in v1.0.**
- **Dependencies:** references to plugin versions/digests, declared adapters and required data contracts form a pinned lockfile compiled with the Simulation Release. No implicit network package fetch at runtime.
- **Type-checking:** graph compiler enforces port type/unit compatibility, missing inputs, classification flow, illegal fan-in, unreachable nodes, duplicate effect targets, missing human gates, cycles, budget limits and dependency closure.
- **Scheduling:** composition runs have bounded retries and immutable node-attempt records. Execution may be concurrent where independent; result ordering must be deterministic where ordering matters to approval packages.

### Minimal declarative graph example

```json
{
  "compositionId": "sanctions-to-stability",
  "version": "1",
  "nodes": [
    {"id": "economy", "kind": "model", "binding": "economy-model-v1"},
    {"id": "politics", "kind": "model", "binding": "stability-model-v1"},
    {"id": "review", "kind": "approval_gate", "policy": "white-cell-required"}
  ],
  "edges": [
    {"from": "economy.outputs.gdpDelta", "to": "politics.inputs.gdpDelta"},
    {"from": "politics.proposedEffects", "to": "review.proposals"}
  ]
}
```

Intermediary numerical predictions may be passed to downstream models without adjudication **only when they remain explicitly provisional computational outputs**. A plugin must not read a provisional prediction as if it were accepted authoritative world state.

## 10. Human approval and authoritative effects

Mandatory sequence:

```text
execution requested -> validated model result -> staged proposal -> authorized human review
  -> (approve | reject | return for revision)
  -> upon approval: recheck authority/permissions/release/state versions -> transactional Runtime command
  -> state change + event evidence + command receipt + notification outbox
```

- No `apply_effect` capability is exposed directly to plugins. Only `effects.propose` and read-only/approved adapters.
- A model invocation, graph join or automated rule MUST NOT bypass human approval for consequential outcomes, even when a designer marks the plugin trusted.
- An authorized human may approve an explicitly enumerated **batch** of effects in one action, provided scope and conflicts are visible; subsequent generated effects require a new human approval.
- Approval must bind the specific proposal hash, model run IDs/digests, input snapshot, effect set, reviewer, reason, time, session release, authority epoch and expected state version.
- If the state, release, authority or reviewer authorization becomes stale, application fails with a structured conflict and requires re-evaluation/reapproval as appropriate; a past approval cannot be replayed against changed effects.
- Nonconsequential read-only forecasts and analytical outputs can complete without approval; research exports and messages still undergo separate information-policy and institutional governance checks.
- A disconnected device cannot issue an authoritative approval unless connected to the session's authoritative local/cloud Runtime. No split-brain approvals.

## 11. Persistence contract (proposed logical tables)

Use PostgreSQL for registry metadata, configuration references, run status, approval and effect receipts; object storage for immutable large artifacts. Exact SQL schema/migration IDs MUST be reconciled with the approved PostgreSQL Logical Data Model v1.0 before implementation.

| Logical table | Essential fields / constraints |
|---|---|
| `extension.publishers` | publisher ID, trust classification, contact, status, allowed signing keys |
| `extension.plugin_artifacts` | plugin ID, version, digest UNIQUE, manifest digest, artifact URI, lifecycle, signature verification |
| `extension.installations` | organization/deployment ID, artifact digest, approved-by, install status, configured permissions |
| `extension.plugin_bindings` | simulation/revision ID, installation+digest, configuration digest, secrets references, status |
| `extension.compositions` | design revision ID, graph definition, graph digest, validation status |
| `extension.composition_runs` | session/release ID, graph digest, trigger, state snapshot, status, correlation ID |
| `extension.node_runs` | composition run, node ID, attempt, artifact digest, input/output digests, duration, status, failure code |
| `extension.effect_proposals` | proposal ID, node/model provenance, target aggregate, effect payload/digest, lifecycle |
| `extension.approval_decisions` | proposal hash, reviewer, decision, authority epoch, expected version, reason, approved scope |
| `extension.effect_receipts` | approved proposal ID, Runtime command ID UNIQUE, applied version/evidence event ID |

All organization-owned metadata is tenant scoped and cross-tenant reads/writes are denied. `plugin_artifacts` may be shared catalog metadata; installation/bindings/runs/evidence are tenant controlled. Treat in-flight model runs, proposals and decisions as append-only historical provenance as appropriate; do not destroy records when a plugin is removed.

## 12. API and event surfaces (contracts to formalize in OpenAPI/AsyncAPI)

- `POST /v1/plugins/submissions`: submit digest and attestation for review (restricted publisher identity).
- `POST /v1/plugins/{artifactId}/approve`: governance approval (separation of duties).
- `POST /v1/organizations/{orgId}/plugin-installations`: install verified digest with permitted capabilities.
- `GET /v1/organizations/{orgId}/plugin-catalog`: authorized discoverable versions.
- `POST /v1/simulations/{id}/compositions/validate`: graph semantic/dependency/policy validation.
- `POST /v1/sessions/{sessionId}/composition-runs`: authorized run against immutable release binding.
- `GET /v1/sessions/{sessionId}/composition-runs/{runId}`: status and authorized proposed outputs.
- `POST /v1/sessions/{sessionId}/proposals/{id}/decisions`: reviewer approves/rejects/returns with expected version and idempotency key.

Core event types: `plugin.artifact.approved`, `plugin.installed`, `plugin.revoked`, `composition.run.started`, `composition.node.completed`, `composition.node.failed`, `model.effect.proposed`, `model.effect.approved`, `model.effect.rejected`, `model.effect.applied`, `plugin.dependency.unavailable`. These are semantic proposals; names and schemas require alignment with canonical event contract. Use request/correlation IDs, deduplication, pagination, resource-level authorization and typed error codes such as `PLUGIN_UNAVAILABLE`, `CONTRACT_INVALID`, `PLUGIN_NOT_APPROVED`, `DEPENDENCY_MISSING`, `CAPABILITY_DENIED`, `STALE_PROPOSAL`, `AUTHORITY_UNAVAILABLE`, `AIRGAP_INCOMPATIBLE`, and `APPROVAL_REQUIRED`.

## 13. Isolation, privacy and operational security

- Least privilege; separate technical identities per installation/invocation where feasible; deny ambient cloud credentials.
- Filesystem: read-only base, ephemeral scratch, no direct access to other sessions; memory/CPU/time/output caps; kill on exhaustion.
- Network egress default deny; allowlisted endpoints only for approved external-service connectors. Air-gapped profile: no public egress.
- Input projections filtered by classification and session information-policy engine; output scanned and validated; no log-based exfiltration.
- Avoid direct SQL, raw object-store access, arbitrary subprocess/tool execution unless specifically included in reviewed isolation profile.
- Secrets injected from local/institutional secret store by opaque references, never embedded in Simulation Packages or exports.
- Strong reproducibility metadata: exact artifact/container digest, dependency closure, model version, seed/randomness declaration, input snapshot digest, runtime version, time and reviewer. Non-deterministic outcomes must be labeled and retained, not falsely replayed as identical.
- Signing, vulnerability review, emergency revocation and rollback procedures required; exact accreditation and cryptographic policy depend on institutional profile.

## 14. Evidence and research provenance

For each consequential plugin-proposed effect, link chain: `trigger command/evidence -> authorized input snapshot -> run + node attempts -> immutable output digest -> proposed effect -> human decision -> Runtime command receipt -> committed state/evidence event`. Preserve rejection, failure and retry history. Analytical plugins produce derived findings, never rewrite participant evidence. Signed checkpoints and independent anchors remain owned by the existing tamper-evident evidence subsystem; Extension Host does not create a separate competing audit ledger.

## 15. Release, live activation and offline behavior

Release compilation pins plugin artifact digests, validated manifest/schema versions, configuration digest, model graph digest, dependency closure and required local availability. An active session may change bindings only through the existing Safe Activation Policy and recorded activation revision; existing in-flight compositions keep their pinned graph/plugin versions unless explicitly migrated and reviewed. Pending plugin runs may be cancelled, resumed, or rejected according to declared policies; never silently reinterpreted. If a plugin is unavailable offline, the platform reports unavailable/pending and uses only an explicitly approved alternative; no fake estimates or unauthorized effects. Offline participant devices do not execute trusted adjudication plugins as a second authority. Offline **institutional local Runtime** may execute approved locally installed plugins and commit only after human approval on that authority.

## 16. Failure model and recovery

| Failure | Required behavior |
|---|---|
| Plugin timeout/crash | Record failed node attempt; retry bounded/idempotently if safe; no effects committed |
| Malformed output | Reject contract validation; quarantine artifact/run if systemic; inform reviewer |
| Partial parallel graph | Mark partial; join policy decides wait/fail/authorized partial proposal; never silently default missing values |
| Network-only plugin in air gap | Block incompatible release at publish/deploy verification; do not attempt external access |
| Revoked artifact mid-session | Deny new invocations; pending work follows emergency revocation policy; preserve prior evidence |
| Approval on stale snapshot | Return conflict; require reassessment/reapproval before commit |
| Local server interrupted after approval | Idempotent command receipt and outbox permit safe retry; no double-applied effect |
| Human reviewer unavailable | Queue explicit pending review; operator may reassign within authorization policy; never auto-approve |
| Invalid composition cycle | Reject publication with graph path diagnosis |

## 17. Minimal vertical-slice plan (not a claim of implementation)

1. Publish one local deterministic PLI-like **test fixture** adjudication plugin (not misrepresented as PLI); generate signed artifact manifest and input/output schema.
2. Add institutional registry approval and installation; show approved plugin in Studio inspector.
3. Bind one plugin to a workflow event in a Fractured Order-derived test Simulation Release; pin digest and configuration.
4. Execute model against an authorized input snapshot; stage typed proposed effect.
5. White Cell reviews and explicitly approves; Runtime commits exactly once, including evidence and receipt.
6. Add second local deterministic model, graph validation and sequential/parallel composition; demonstrate no state change prior to approval.
7. Run same release in a disconnected local institutional deployment with zero public egress; verify failure of external-required connectors without false success.

Do not add public marketplace, general authoring/agent feature, model-code editor, or distributed plugin mesh as prerequisites.

## 18. Verification and acceptance matrix

| ID | Given / When | Must demonstrate |
|---|---|---|
| EXT-01 | Unauthorized publisher submits plugin | Denied; no installable artifact |
| EXT-02 | Signed approved plugin installed | Digest/signature/compatibility validated; independently authorized institution installation |
| EXT-03 | Tampered bundle installed offline | Rejected even without Internet |
| EXT-04 | Approved local plugin runs air-gapped | No external network use; deterministic permitted output |
| EXT-05 | External-required plugin deployed air-gapped | Release validation blocks or explicitly disables optional capability |
| EXT-06 | Model proposes effect | Official session state unchanged until human approval |
| EXT-07 | Unauthorized reviewer approves | Denied at trusted boundary |
| EXT-08 | Same approval/command retried | Exactly one authoritative effect and associated evidence mutation |
| EXT-09 | Two reviewers conflict | One valid authoritative transition; second receives conflict |
| EXT-10 | Input includes hidden role data | Projection excludes unauthorized fields; negative test confirms no leak |
| EXT-11 | Plugin times out/returns malformed output | Fails visibly, no invented result/effect |
| EXT-12 | Sequential composition runs | Typed outputs routed with pinned versions; consequential state reads require committed effects |
| EXT-13 | Parallel composition partially fails | Structured partial/failure state, explicit join behavior, no silent substitute |
| EXT-14 | Graph has cycle/incompatible unit | Compiler rejects with actionable error |
| EXT-15 | Release changes with in-flight graph | Existing run pinned; new activation governed with evidence |
| EXT-16 | Plugin is revoked | New runs blocked; historical evidence remains verifiable |
| EXT-17 | Export after multiple model runs | Attribution includes model/input/config digest, reviewer, decision and effect receipts |
| EXT-18 | Disconnected client attempts approval | Cannot commit to session; pending command cannot bypass authority on reconnect |
| EXT-19 | 500 participants × 10 sessions reference workload | Load and contention measured; no capacity claim before test |

CI targets should include schema/contract validation, fixture tests, policy-denial integration cases, version-compatibility checks, supply-chain verification and one real local PostgreSQL-backed end-to-end test. Record PASS/FAIL/NOT RUN with evidence; no tests have been run by authoring this document.

## 19. Document integration and controlled updates

This specification should be registered beneath the enterprise PRD, approved product decisions and existing `02_PLATFORM_ARCHITECTURE`, `03_CANONICAL_SIMULATION_SCHEMA`, `04_DESIGN_STUDIO_SPECIFICATION`, `05_RUNTIME_AND_ADJUDICATION`, `06_DATA_SECURITY_REPORTING`, `07_IMPLEMENTATION_ROADMAP`, `09_API_EVENT_WORKFLOW_CONTRACTS`, `POSTGRESQL_LOGICAL_DATA_MODEL_v1.0`, and `SYNCHRONIZATION_PROTOCOL_v1.0`. Companion contracts to develop next are: manifest JSON Schema, graph JSON Schema, OpenAPI endpoints/event schemas, database migrations, host adapter protocol, SDK test harness, operator runbook and signing trust policy.

### Implementation choices still needing operational specification (not reopening product approval)

- Approved sandbox target(s) for Python/scientific/native models and local container platform.
- Institution-specific publisher/key custody, signing algorithms, revocation distribution and offline update frequency.
- Classified deployment assurance/accreditation, removable-media controls and allowed export workflow.
- Runtime quotas, execution limits, resource capacity, timeout bounds, evidence retention and recovery thresholds calibrated by tests.
- Exact catalog-sharing/ownership policy between SSG and institutions; plugin licensing and support terms.

These are deployment-specific values requiring technical/security policy decisions, not conceptual blockers to the architecture.

## 20. Source alignment and provenance

- `PLENUM_STUDIO_FOUNDATIONAL_PRODUCT_DEFINITION_v0.1` DEC-03, DEC-09–13 and §§7–10: human/external model adjudication, structured artifacts, asymmetric information and bounded adapters.
- `Plenum Studio Foundational Product Definition v0.2`: controlled extension of foundational decisions.
- `02_PLATFORM_ARCHITECTURE_v1.2` §15: controlled adjudication plugin, input-output validation and no unrestricted database access.
- `05_RUNTIME_AND_ADJUDICATION_v1.2` §11.4: isolated plugin execution and run provenance; **this spec strengthens the older conditional human-approval language** to mandatory approval for consequential model effects as explicitly confirmed by the product owner.
- `03_CANONICAL_SIMULATION_SCHEMA_v1.2`: `PluginBinding` and plugin adjudication mode.
- `07_IMPLEMENTATION_ROADMAP_v1.2` phases 6 and customization/plugin sequence: SDK, registry and bounded execution.
- `09_API_EVENT_WORKFLOW_CONTRACTS_v1.2` §18: plugin and installation resources.
- `POSTGRESQL_LOGICAL_DATA_MODEL_v1.0`, `SYNCHRONIZATION_PROTOCOL_v1.0`: session authority, data/evidence transaction, offline identities and command semantics.

**Compatibility action:** Update every contract that still says "require human approval if configured" or otherwise permits automatic consequential plugin effects. This new approved product decision takes precedence at the product-requirement level; controlled PRD/architecture amendments must be recorded before implementing contradictory behavior.
