-- Plenum 032: permit the trusted application boundary to revoke Organization Role rows.
-- Sources: PS-790, REQ-052, DEC-61.
--
-- RLS continues to constrain every delete to the active Organization. The application
-- service additionally requires a current Admin Authentication Session, serializes the
-- member set, prevents removal of the final Admin, and writes an append-only Audit Record.

GRANT DELETE ON identity.memberships TO plenum_app;
