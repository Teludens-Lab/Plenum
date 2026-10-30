-- Plenum 027: human-addressable Release and Session lifecycle catalogs.
-- Sources: PS-720; REQ-021..025, REQ-032, REQ-046, REQ-069; INV-005, INV-012.

ALTER TABLE runtime.sessions
  ADD COLUMN title text,
  ADD COLUMN scheduled_start_at timestamptz,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT transaction_timestamp();

UPDATE runtime.sessions session
   SET title = left(project.title || ' Session', 200)
  FROM studio.simulation_projects project
 WHERE project.organization_id=session.organization_id
   AND project.id=session.project_id
   AND session.title IS NULL;

ALTER TABLE runtime.sessions
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN title SET DEFAULT 'Untitled Session',
  ADD CONSTRAINT sessions_title_length CHECK (length(trim(title)) BETWEEN 1 AND 200);

CREATE INDEX releases_catalog_list
  ON registry.releases (organization_id, published_at DESC, id DESC);
CREATE INDEX sessions_catalog_list
  ON runtime.sessions (organization_id, updated_at DESC, id DESC);

CREATE FUNCTION runtime.touch_session_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = transaction_timestamp();
  RETURN NEW;
END
$$;

CREATE TRIGGER touch_session_updated_at
  BEFORE UPDATE ON runtime.sessions
  FOR EACH ROW EXECUTE FUNCTION runtime.touch_session_updated_at();

