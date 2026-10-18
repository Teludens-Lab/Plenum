# Contract compatibility matrix

Compatibility policy remains unresolved by OPEN-012. The matrix defines what tasks must prove without choosing that policy silently.

| Contract | Producer | Consumers | Pin | Breaking-change rule | Persistence impact | Test owner |
|---|---|---|---|---|---|---|
| Simulation Release schema (`release-manifest-v1`) | `@plenum/simulation-schema` / Release compiler | Runtime, Studio preview, import | schema `1.3.1` + digest | New version or explicit migration | Historical Sessions keep original | PS-100, PS-130 |
| Compiler output (`package-import-v1`) | `@plenum/release-compiler` | Registry, import | compiler `0.1.0` + manifest/content/package digests | Exact-version compatibility and deterministic fixture comparison while OPEN-012 remains unresolved | Definition Revision, Release and Package manifest are immutable | PS-130 |
| HTTP API | Server | Web clients/integrations | `/v1` + schema | New API version or compatible extension | Commands/receipts retained | PS-100 onward |
| Command envelope | Client | Session Authority | v1 schema | Required-field/semantic break needs new version | Stored payload digest must remain interpretable | PS-120 |
| Event envelope/type | Feature owner | Projections, reports, integrations | type + integer version | New type version; one producer | Evidence keeps original version | PS-120 |
| Runtime sync (`runtime-sse-v1`, `sync-deltas-v1`, `sync-snapshot-v1`) | Sync service | `@plenum/sync-client`, Runtime web | opaque UUID cursor + `policy-decision-v1` + `runtime-projection-v1` | Expiry or policy/access/version change requires authorized snapshot; never reinterpret | Server cursor and client cursor are disposable; authoritative state and outbox remain | PS-140 |
| Package | Registry | Other Deployments | `package-import-v1` + schema/compiler/digests | Exact-version rejection until OPEN-012 defines a support window | Import preserves Release and Definition Revision identity | PS-130, PS-530 |
| Plugin host API | Extension Host | Plugin Artifact | semver range + digest | Reject incompatible artifact | Runs keep artifact digest | PS-220 |
| Model Composition | Compiler | Extension Host | graph version + digest | Explicit graph migration | In-flight run stays pinned | PS-330 |
| Voting Method Adapter | Voting service | Adapter | algorithm version + digest | Deterministic vectors required | Tally and Certification retain method | PS-240 |
| Media Provider Adapter | Comms service | Provider | interface version + digest | Capability validation per Release/profile | Voice record keeps binding | PS-250 |
| Persisted Session | Runtime schema | Current/future app | migration chain + Release refs | Expand/backfill/switch/contract | No historical reinterpretation | PS-420, PS-530 |
| Research/report definition | Reporting engine | Exports | definition/metric version | New version, never mutate historical output | Source provenance retained | PS-520 |

Until OPEN-012 resolves, implementation may add compatible fields and explicit adapters, but cannot promise a support window or compiler determinism beyond tested versions.
