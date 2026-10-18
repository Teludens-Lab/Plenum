# Architecture change log — v1.2

Date: 2026-10-17. Change class: documentation-only, controlled amendment. No repository implementation, migration, deployment, or production changes performed.

| ID | Source document | Modification | Why | Status |
|---|---|---|---|---|
| ALN-01 | 02 Platform Architecture | Added session authority, offline/cloud/air-gap topologies, separate sync domains, safe activation, load assumption | Consistency and split-brain prevention | Proposed |
| ALN-02 | 04 Studio Specification | Added collaborative draft semantics, offline authoring UX, validation/publish freeze, activation review | Google-Docs-like simultaneous editing | Proposed |
| ALN-03 | 05 Runtime/Adjudication | Added serialized authoritative commands, offline outbox acceptance, stale-epoch rejection, version pinning | Offline operation without conflicting adjudication | Proposed |
| ALN-04 | 06 Data/Security/Reporting | Added logical domain ownership, offline projections, checkpoint custody, security/restore obligations | Tamper-evident institutional evidence and offline safety | Proposed |
| ALN-05 | 07 Roadmap | Added staged slices and negative tests for collaboration/offline/evidence/air-gap | Ensure traceable delivery gates | Proposed |
| ALN-06 | Governing Decision Register | Captured GOV-001–010 and draft ADR-001–005 | Single explicit decision reference | Draft for approval |
| ALN-07 | Cross-document Matrix | Recorded alignment and unresolved dependencies | Prevent phantom consistency claims | Completed targeted review |

All original v1.1 source files were preserved outside this versioned output directory; revisions are copies with append-only alignment amendments. The PRD, canonical schema, API/event contract documents and canonical control pack were not edited because their exact authoritative source revisions were not recoverable in this work session.
