# Plenum PostgreSQL Data Model and Synchronization Protocol v1.1

| File | Contents |
|---|---|
| `POSTGRESQL_LOGICAL_DATA_MODEL_v1.1.md` | Schemas, entity catalog with implementation status, integrity and security enforcement, locking rules, database acceptance tests |
| `SYNCHRONIZATION_PROTOCOL_v1.1.md` | Command envelope and receipts, offline client behavior, reconnection, Release-activation compatibility, authority transfer, Studio collaboration, cursors, sync acceptance tests |

Both are **Proposed** detailed designs produced ahead of upstream approval under DEC-27; they depend on ADR-001 to ADR-005, ADR-010, ADR-014 and ADR-015 (OPEN-002).

The executable DDL for every entity marked "Implemented" is `plenum_runtime_slice/migrations/001–004`, tested on 2026-10-17 (see the slice README for the verification record). Operational values (RPO/RTO, key custody, credential lifetimes, retention, capacity targets) remain open in the Decision Register.

Superseded v1.0 files are in `archive/Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.0/`.
