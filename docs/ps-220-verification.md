# PS-220 Plugin SDK and registry verification

Date: 2026-10-19. Result: **IMPLEMENTATION PASS ON SUPPORTED RUNTIME; RELEASE APPROVAL PENDING**.

## Delivered

- `@plenum/plugin-sdk` defines `plugin-manifest-v1`, `plugin-registry-v1`, and `offline-plugin-bundle-v1`, validates JSON Schema 2020-12 contracts, creates canonical digest-complete bundles, signs and verifies detached Ed25519 signatures, verifies signed revocation data, enforces compatibility/connectivity/permission limits, and runs deterministic synthetic fixtures against a restricted host stub.
- The modular-monolith registry adds restricted Publisher intake, institution-provisioned trust roots, immutable bundle storage, distinct-person Artifact approval, Organization license acceptance, Installation, digest-pinned Definition Revision Binding, new-run authorization, revocation, catalog projection, tenant RLS, and same-transaction audit records.
- Migration `011_extension_registry.sql` is expand-only. It creates seven tenant-owned extension tables, forced RLS, denial of destructive mutation, unique digest/version constraints, and column-scoped update privileges that prevent the application role from changing Artifact identity or signed content.
- Offline import verifies the bundle only from local bytes plus independently provisioned trust/revocation/license records. It creates a `contract_validated` Artifact; a different Administrator must approve it before a separate Installation operation.
- `CMD-AIRGAP` runs the signed offline Plugin workflow in a digest-pinned Node 24 container with no network namespace, a read-only application mount/root filesystem, UID 65532, no Linux capabilities, no-new-privileges, and bounded CPU, memory, and process count. No catalog UI, Plugin execution host, or Python/native runtime was added; those remain with PS-230 and PS-330.

## Acceptance evidence

| Criterion | Evidence | Result |
|---|---|---|
| EXT-01 | An Operator submission is denied; Publisher submit, Administrator approval, Organization install, Designer/Admin bind, and Operator run authorization are separate functions with current-role checks. | PASS |
| EXT-02 | The synthetic fixture moves from signed bundle through `contract_validated`, distinct-person approval, digest-pinned install and bind, then run authorization. | PASS |
| EXT-03 | Mutated canonical bundle bytes and stale signed revocation data are rejected before import/install. | PASS |
| EXT-04 | A second bundle is imported and installed using local bytes with the `air_gapped` profile; `CMD-AIRGAP` independently executes SDK verification with the container network disabled. | PASS |
| EXT-05 | `external_required` is rejected for an `air_gapped` deployment profile and accepted for `connected`. | PASS |
| EXT-16 | Critical findings, revoked digests, stale trust material, digest reuse, incompatible versions, unaccepted licenses, ungranted permissions, and post-revocation new runs fail closed while Artifact/Installation/Binding/audit history remains. | PASS |

## Verification

Environment: Node 24.22.0, npm 11.19.1, TypeScript 5.9.3, PostgreSQL 18.6, and digest-pinned SeaweedFS 4.48.

The `CMD-AIRGAP` workload itself ran on the pinned Node 24.22.0 image. Its Docker launcher ran on the local Windows Node 22.16.0 host; the same source had already passed the independent Node 24 build, lint, typecheck, unit, and integration gates above.

| Check | Result |
|---|---|
| Lockfile install | PASS; 97 packages audited and npm reported 0 vulnerabilities |
| `CMD-PLATFORM-LINT` (`npm run lint`) | PASS; 26 sources, 14 versioned contracts, canonical naming, acyclic workspaces |
| `CMD-PLATFORM-TYPECHECK` (`npm run typecheck`) | PASS |
| `CMD-PLATFORM-BUILD` (`npm run build`) | PASS |
| `CMD-PLATFORM-TEST` (`npm test`) | PASS, 34/34 |
| `CMD-PLATFORM-INTEGRATION` (`npm run test:integration`) against clean PostgreSQL/S3 fixtures | PASS, 10/10 |
| `CMD-AIRGAP` (`npm run test:airgap`) | PASS, 6/6; rootless/read-only/no-egress controls and signed offline Plugin workflow |
| Promptbook validation | PASS; 31 tasks, REQ 94/94, INV 28/28, no dependency cycles |
| `git diff --check` | PASS |

The integration suite also proves the application role cannot mutate an Artifact digest, an approved Artifact cannot be installed without current trust/license/revocation material, and revocation blocks a new run without deleting prior Installation, Binding, or audit evidence.

## Migration and recovery

- Forward: apply migration 011 before enabling registry callers; existing schemas and rows are not rewritten.
- Rollback/disable: stop new registry calls and revoke or suspend affected Artifacts at the application boundary. Preserve migration 011 tables and immutable object bytes so audit and prior Installation/Binding evidence remain interpretable.
- Do not drop the extension schema as an application rollback. A destructive schema rollback requires explicit approval, backup validation, and a separate data-retention decision.

## Remaining release gates

- PS-230 must provide the hardened rootless container host, enforced runtime resource/network/filesystem limits, human approval of proposed authoritative effects, and execution evidence. PS-220 authorizes a run but does not execute third-party code.
- PS-330 owns the Plugin catalog/composition UI. PS-530 still owns full deployment-profile smoke, backup/restore, and packaged host recovery, but `CMD-AIRGAP` itself is implemented and verified by PS-220.
- Formal Security Owner review, production key ceremony/rotation procedures, deployment recovery validation, and performance/load evidence are not complete. This change is not release-approved.
