# Repository topology

## Observed tree

```text
Plenum/
  README.md
  AGENTS.md
  docs/
    corpus/                      # governing product documents and archive
    promptbook/                  # generated planning artifact and source
  references/
    README.md
    fractured-order/             # official immutable golden reference export
    fractured-order.snapshot.json
    plenum-runtime-slice/        # executable v0.2.0 spike
    teludens-design-system-catalog/
  rules/                         # QA and universal design standards
```

There is no live application implementation yet. Any application path beyond the observed tree is a planned output and must be created only by its owning task.

## Target code topology

Platform section 4 proposes one monorepo: React/TypeScript apps (`studio`, `runtime-web`, `operator-console`, `admin`) plus one Node/TypeScript `server`, with focused shared packages. Create packages only as a scheduled slice needs them. Retain the vanilla slice under `references/plenum-runtime-slice/` until parity and migration gates permit retirement.

Code folders do not imply deployable services. The target remains one application server and static frontends, plus bounded worker, Extension Host, media-provider, and storage/identity dependencies defined by ADR-013 and DEC-49.

## Ownership and dependency direction

| Owner | Mutable truth | Public boundary | Must not depend on |
|---|---|---|---|
| Studio Draft service | Collaborative Draft state | Draft/update/freeze contracts | Runtime mutable state |
| Release registry/compiler | Definition Revisions, Releases, Packages | Immutable manifest and import/export | UI widgets, Session state |
| Identity/context | Persons, memberships, trusted context | OIDC and Session Access Context | Client role or tenant claims |
| Runtime command kernel | Session mutations and receipts | Command/receipt contracts | Simulation-specific labels |
| Workflow/artifact | Artifact and Workflow Instance state | Release-defined transitions | UI route names |
| Policy/projection | Information decisions and filtered views | Policy decision/projection contract | Raw client filters |
| Evidence | Evidence Sequence, events, Checkpoints | Append-only journal and verification export | Feature-specific parallel audit ledgers |
| Voting | Poll/Ballot/Tally/Certification | Voting contracts | Media or Plugin authority |
| Comms | Voice grants and Floor leases | Media Adapter and voice contracts | Media-server internal datastore |
| Extension | Registry, runs, proposals, approvals | SDK/host/proposal contracts | Direct DB/object/secret access in Plugins |
| Reporting | Derived reports and metrics | Versioned report definitions | Transient interface state |

Feature modules use public application functions and contracts. Shared infrastructure may not import feature internals. Wiring belongs in the server composition root.

## Environments and version policy

| Environment | Purpose | Data | Network | Status |
|---|---|---|---|---|
| Local disposable | Unit/integration/browser work | Synthetic only | Developer LAN | Slice exists; platform absent |
| CI disposable | Repeatable gates | Seed fixtures | Deny unexpected egress | Planned by PS-100 |
| Institutional test | LAN, media, backup/restore | Synthetic representative | No public egress lane | Planned by PS-530 |
| Production profiles | Cloud, self-hosted, air-gapped | Governed | Per profile | Not approved |

Versions are pinned in one lockfile and deployment manifest. Node 26 target / 24 floor and PostgreSQL 18 are Proposed. Plugin, Platform Adapter, image, Release, schema, compiler, and contract versions are digest-pinned where applicable.
