# Upstream and downstream reconciliation matrix

| Concern | Upstream authority | Existing affected specification | Reconciliation outcome | Verification gap |
|---|---|---|---|---|
| Platform boundary | PRD v0.6 | Platform v1.2 | Retain Studio → immutable Release → Runtime; deployment/local authority addendum retained | Integration execution not tested |
| Authoring collaboration | PRD change request | Studio v1.2, Canonical Schema v1.2 | Mutable collaborative drafts distinct from immutable published revisions | Merge-domain invariant tests pending |
| Execution terminology | PRD + Canonical Schema | API/Event v1.0 | `run`/`scenario version` legacy names flagged; explicit mapping required | Contract compatibility mapping not yet signed |
| Offline local LAN | PRD change request | Platform/Runtime v1.2 | Local server authority with no cloud dependency | Deployment rehearsal pending |
| Offline isolated device | PRD change request | Runtime/Data Security/API addenda | Pending local commands distinct from committed server results | Offline reconnect/out-of-order tests pending |
| Adjudication | PRD + Runtime | API addendum | Single authoritative writer, epoch fencing proposed | Authority handover design pending |
| Live revisions | PRD + Canonical Schema | Runtime/Studio + Canonical addendum | Existing workflows pinned by default; safe activation proposed | Methodology approval pending |
| Evidence | PRD enterprise integrity | Data Security/Runtime/API | Append-only transactional journal, signed checkpoints proposed | Independent anchor custody and cryptographic proof tests pending |
| Air-gapped deployment | PRD change request | Platform/Data Security/Roadmap | Portable local execution; external services optional | Identity/key/offline package integration pending |
| Capacity | PRD change request | Platform/Roadmap | Planning target captured; not claimed tested | 500×10 performance test pending |

**Consistency result:** No new direct contradiction introduced by these amendments; terminology and approval gaps remain. This is a specification-level crosswalk, not executable conformance evidence.
