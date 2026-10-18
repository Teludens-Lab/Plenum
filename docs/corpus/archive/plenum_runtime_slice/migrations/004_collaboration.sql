CREATE TABLE studio.collaborative_documents (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL,project_id uuid NOT NULL,
 branch_key text NOT NULL,document_key text NOT NULL,schema_version text NOT NULL,
 snapshot bytea, snapshot_sha256 text,updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,project_id,branch_key,document_key), UNIQUE(organization_id,id),
 FOREIGN KEY(organization_id,project_id) REFERENCES studio.simulation_projects(organization_id,id)
);
CREATE TABLE studio.document_updates (
 id uuid PRIMARY KEY,organization_id uuid NOT NULL,document_id uuid NOT NULL,
 bytes bytea NOT NULL,sha256 text NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,document_id) REFERENCES studio.collaborative_documents(organization_id,id)
);
