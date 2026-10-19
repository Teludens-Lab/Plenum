# Contract compatibility matrix

Compatibility policy remains unresolved by OPEN-012. The matrix defines what tasks must prove without choosing that policy silently.

| Contract | Producer | Consumers | Pin | Breaking-change rule | Persistence impact | Test owner |
|---|---|---|---|---|---|---|
| Simulation Release schema (`release-manifest-v1`) | `@plenum/simulation-schema` / Release compiler | Runtime, Studio preview, import | schema `1.3.1` + digest | New version or explicit migration | Historical Sessions keep original | PS-100, PS-130 |
| Compiler output (`package-import-v1`) | `@plenum/release-compiler` | Registry, import | compiler `0.1.0` + manifest/content/package digests | Exact-version compatibility and deterministic fixture comparison while OPEN-012 remains unresolved | Definition Revision, Release and Package manifest are immutable | PS-130 |
| HTTP API | Server | Web clients/integrations | `/v1` + schema | New API version or compatible extension | Commands/receipts retained | PS-100 onward |
| Command envelope | Client | Session Authority | v1 schema | Required-field/semantic break needs new version | Stored payload digest must remain interpretable | PS-120 |
| Runtime capability Commands (`artifact-command-v1`, `stage-command-v1`, `message-command-v1`, `inject-command-v1`) | Capability owner | Session Authority | namespace-specific operation pattern over `command-envelope-v1` | Breaking payload semantics need a new contract version; one producer per mutation | Governing Release and recorded receipt/event retain original meaning | PS-150, PS-200, PS-210 |
| Event envelope/type | Feature owner | Projections, reports, integrations | type + integer version | New type version; one producer | Evidence keeps original version | PS-120 |
| Runtime sync (`runtime-sse-v1`, `sync-deltas-v1`, `sync-snapshot-v1`) | Sync service | `@plenum/sync-client`, Runtime web | opaque UUID cursor + `policy-decision-v1` + `runtime-projection-v1` | Expiry or policy/access/version change requires authorized snapshot; never reinterpret | Server cursor and client cursor are disposable; authoritative state and outbox remain | PS-140 |
| Package | Registry | Other Deployments | `package-import-v1` + schema/compiler/digests | Exact-version rejection until OPEN-012 defines a support window | Import preserves Release and Definition Revision identity | PS-130, PS-530 |
| Plugin manifest | `@plenum/plugin-sdk` / approved Publisher | Registry, Release compiler, Extension Host | `plugin-manifest-v1` + manifest and Artifact digests | New contract version for required-field or semantic changes | Artifact, Installation, Binding and run provenance retain the original manifest digest | PS-220, PS-230 |
| Offline Plugin bundle | `@plenum/plugin-sdk` / approved Publisher | Organization registry import | `offline-plugin-bundle-v1` + complete file/dependency closure + detached Ed25519 signature | Exact contract version; reject unknown required content | Imported Artifact and Installation retain bundle and Artifact digests | PS-220, PS-530 |
| Plugin host API | Extension Host | Plugin Artifact | semver range + digest | Reject incompatible artifact | Runs keep artifact digest | PS-220 |
| Model Composition | Compiler | Extension Host | graph version + digest | Explicit graph migration | In-flight run stays pinned | PS-330 |
| Voting Method Adapter | Voting service | Adapter | algorithm version + digest | Deterministic vectors required | Tally and Certification retain method | PS-240 |
| Media Provider Adapter | Comms service | Provider | interface version + digest | Capability validation per Release/profile | Voice record keeps binding | PS-250 |
| Persisted Session | Runtime schema | Current/future app | migration chain + Release refs | Expand/backfill/switch/contract | No historical reinterpretation | PS-420, PS-530 |
| Research/report definition | Reporting engine | Exports | definition/metric version | New version, never mutate historical output | Source provenance retained | PS-520 |

Until OPEN-012 resolves, implementation may add compatible fields and explicit adapters, but cannot promise a support window or compiler determinism beyond tested versions.

## Plugin trust matrix

| Decision | Trusted source | Enforced at | Failure behavior |
|---|---|---|---|
| Publisher may submit | Approved `extension.publishers` record plus current Publisher Organization Role | Registry intake and transaction re-check | `PERMISSION_DENIED`; no Artifact row |
| Bundle identity and contents | Institution-provisioned public trust root, detached Ed25519 signature, canonical manifest and complete digest closure | Intake and every new Installation | `VALIDATION_FAILED`; no Installation |
| Revocation state | Separately imported, signed revocation document no older than 30 days | New Installation and Binding; current data also blocks new runs | `PLUGIN_NOT_APPROVED` or validation failure; history retained |
| Supply chain | SBOM, vulnerability attestation, no critical finding, active recorded exception for any high finding | SDK verifier before approval or import | Approval/import blocked |
| License | Immutable Organization acceptance record | New Installation and Binding | Installation/binding blocked |
| Deployment compatibility | Manifest host API and Release schema ranges plus declared connectivity | Installation, Binding and Release validation | `INCOMPATIBLE_RELEASE` or `CAPABILITY_UNAVAILABLE` |
| Run authority | Approved Artifact + enabled Organization Installation + enabled digest-pinned Binding + Operator role | Trusted server boundary before a new run | `PLUGIN_NOT_APPROVED`; no Plugin execution |

Trust roots and revocation documents are provisioned independently of Plugin bundles. Bundles carry only key identifiers; they cannot add or replace trust roots. Private signing keys and Plugin secret references are never stored in Releases, bundles, or this registry.
