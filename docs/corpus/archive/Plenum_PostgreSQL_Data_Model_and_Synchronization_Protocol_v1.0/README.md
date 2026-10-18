# Plenum Technical Specifications v1.0

**Delivered:** PostgreSQL Logical Data Model v1.0 and Synchronization and Offline Runtime Protocol v1.0. They implement the architecture directions approved by the product owner in this conversation. They are design specifications, not evidence of deployed code or tested migrations.

## Files
- `POSTGRESQL_LOGICAL_DATA_MODEL_v1.0.md` — logical schema, critical-path reference SQL, tenancy, versioning, atomic writes, authorization, evidence, indexing and migration/test requirements.
- `SYNCHRONIZATION_PROTOCOL_v1.0.md` — Studio CRDT, authoritative Runtime command protocol, local-LAN versus offline-device operation, idempotency, projection cursors, reconciliation, release activation, authority transfer and failure testing.
- `SOURCE_ALIGNMENT.md` — canonical sources and approved decisions versus open operational parameters.

**Important:** PostgreSQL SQL in the data model is a partial executable-looking reference, not a final migration script. It explicitly flags omitted auxiliary FKs and authorization tables. Schema, migration and integration test gates must be passed before production.
