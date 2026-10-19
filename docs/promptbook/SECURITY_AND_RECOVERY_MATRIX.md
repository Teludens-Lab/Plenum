# Security and recovery matrix

| Risk/control | Prevent | Detect | Recover | Evidence task | Production gate |
|---|---|---|---|---|---|
| Cross-tenant access | Trusted context, composite keys, forced RLS | Real app-role pooled-connection tests | Revoke context, investigate Audit Records | PS-110 | ADR-015/Security Owner |
| Session information leak | Default-deny policy and filtered projections | Negative role/field/route tests | Revoke, invalidate cursors, record incident | PS-210 | REQ-047 |
| Duplicate or stale mutation | Stable Command IDs, versions, authority epoch | Receipt/evidence reconciliation | Receipt lookup and explicit merge | PS-120 | ADR-001 |
| Lost/rewritten evidence | Append-only triggers, Checkpoints, independent Anchor | Offline verification | Restore and verify chain; compensating correction | PS-510 | OPEN-017 |
| Malicious Plugin | Restricted publisher, signature/digest, rootless read-only container, no capabilities, no-new-privileges, bounded resources/output and default-deny egress; no direct stores | Scan, contract tests, failed Model Run record and real air-gap execution evidence | Kill failed run; suspend/revoke; preserve provenance | PS-220/230 | Confirmed ADR-018 and accepted OPEN-029 baseline; formal Security Owner review |
| Unapproved model effect | Compiled effect allowlist and mandatory Approval Decision bound to proposal hash, target version, Release and epoch | Effect receipt, Command Receipt, Evidence Event and provenance export | Reject/return/stale proposal; no state change; exact receipt replay | PS-230 | DEC-54 |
| Secret Ballot exposure | Separate choice store and filtered evidence | Log/export/plugin leak tests | Void/correct under policy; incident response | PS-240/550 | OPEN-028 |
| Voice grant abuse | Short credential, Stage/role re-evaluation, one Floor lease | Provider/API cross-boundary tests | Revoke/mute/remove; leases expire | PS-250 | ADR-017 |
| Recording/transcription without consent | Default off; Consent Records | CONSENT_REQUIRED and withdrawal tests | Stop process; protect/delete under approved policy | PS-320 | OPEN-027 |
| Lost offline device | Minimal encrypted projection and expiry | Device-revocation/offline-bundle tests | Revoke; clear controllable cache; incident process | PS-500 | OPEN-014/015 |
| Dependency or secret exposure | Lockfile, scanning, environment-scoped secrets | CI scans and log review | Rotate/rebuild/revoke | PS-550 | REQ-051 |
| Database/object loss | Consistent backup manifest | Scheduled restore drill and proof verification | Restore to clean target; forward-fix | PS-530 | REQ-066/OPEN-017 |
| Authority loss | Explicit fencing; no auto-failover | Health and receipt lookup | Operator transfer procedure | Future approval under OPEN-016 | OPEN-016 |

RPO, RTO, retention, key custody, anchor ownership, credential lifetime, and incident owners are not invented here. Their absence blocks production readiness but not bounded local implementation tests.
