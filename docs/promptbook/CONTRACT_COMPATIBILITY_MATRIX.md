# Contract compatibility matrix

Compatibility policy remains unresolved by OPEN-012. The matrix defines what tasks must prove without choosing that policy silently.

| Contract | Producer | Consumers | Pin | Breaking-change rule | Persistence impact | Test owner |
|---|---|---|---|---|---|---|
| Simulation Release schema | Release compiler | Runtime, Studio preview, import | `schemaVersion` + digest | New version or explicit migration | Historical Sessions keep original | PS-100, PS-130 |
| Compiler output | Release compiler | Registry, import | `compilerVersion` + digest | Deterministic fixture comparison | Definition Revision immutable | PS-130 |
| HTTP API | Server | Web clients/integrations | `/v1` + schema | New API version or compatible extension | Commands/receipts retained | PS-100 onward |
| Command envelope | Client | Session Authority | v1 schema | Required-field/semantic break needs new version | Stored payload digest must remain interpretable | PS-120 |
| Event envelope/type | Feature owner | Projections, reports, integrations | type + integer version | New type version; one producer | Evidence keeps original version | PS-120 |
| Projection cursor | Sync service | Runtime clients | opaque cursor + policy/projection revision | Expiry/reset, never reinterpret | Client cursor disposable | PS-140 |
| Package | Registry | Other Deployments | manifest/schema/compiler/digest | Compatibility report before import | Preserve Release identity | PS-130, PS-530 |
| Plugin host API | Extension Host | Plugin Artifact | semver range + digest | Reject incompatible artifact | Runs keep artifact digest | PS-220 |
| Model Composition | Compiler | Extension Host | graph version + digest | Explicit graph migration | In-flight run stays pinned | PS-330 |
| Voting Method Adapter | Voting service | Adapter | algorithm version + digest | Deterministic vectors required | Tally and Certification retain method | PS-240 |
| Media Provider Adapter | Comms service | Provider | interface version + digest | Capability validation per Release/profile | Voice record keeps binding | PS-250 |
| Persisted Session | Runtime schema | Current/future app | migration chain + Release refs | Expand/backfill/switch/contract | No historical reinterpretation | PS-420, PS-530 |
| Research/report definition | Reporting engine | Exports | definition/metric version | New version, never mutate historical output | Source provenance retained | PS-520 |

Until OPEN-012 resolves, implementation may add compatible fields and explicit adapters, but cannot promise a support window or compiler determinism beyond tested versions.
