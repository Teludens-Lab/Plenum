-- Referential integrity, memberships, authoring, receipts and session projections
CREATE TABLE identity.memberships (
 organization_id uuid NOT NULL REFERENCES identity.organizations(id), user_id uuid NOT NULL,
 role text NOT NULL CHECK (role IN ('designer','publisher','scribe','facilitator','white_cell','operator')),
 PRIMARY KEY (organization_id,user_id,role)
);
CREATE TABLE studio.drafts (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, project_id uuid NOT NULL,
 document jsonb NOT NULL, version bigint NOT NULL DEFAULT 0 CHECK(version>=0),
 UNIQUE (organization_id,id),
 FOREIGN KEY (organization_id,project_id) REFERENCES studio.simulation_projects(organization_id,id)
);
CREATE TABLE runtime.participants (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, session_id uuid NOT NULL,
 user_id uuid NOT NULL, role text NOT NULL CHECK(role IN ('scribe','facilitator','white_cell','operator')),
 UNIQUE (organization_id,id), UNIQUE(session_id,user_id,role),
 FOREIGN KEY (organization_id,session_id) REFERENCES runtime.sessions(organization_id,id)
);
CREATE TABLE sync.devices (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES identity.organizations(id),
 user_id uuid NOT NULL, revoked_at timestamptz,
 UNIQUE (organization_id,id)
);
ALTER TABLE runtime.artifact_instances
 ADD CONSTRAINT artifact_creator_fk FOREIGN KEY (organization_id,creator_participant_id)
 REFERENCES runtime.participants(organization_id,id);
ALTER TABLE sync.command_receipts ADD CONSTRAINT command_device_fk
 FOREIGN KEY (organization_id,device_id) REFERENCES sync.devices(organization_id,id);
CREATE UNIQUE INDEX definition_revision_project_identity ON studio.definition_revisions(organization_id,project_id,id);
CREATE UNIQUE INDEX release_project_identity ON registry.releases(organization_id,project_id,id);
ALTER TABLE registry.releases ADD CONSTRAINT release_revision_project_fk
 FOREIGN KEY (organization_id,project_id,definition_revision_id)
 REFERENCES studio.definition_revisions(organization_id,project_id,id);
ALTER TABLE runtime.sessions ADD CONSTRAINT session_release_project_fk
 FOREIGN KEY (organization_id,project_id,initial_release_id)
 REFERENCES registry.releases(organization_id,project_id,id);
ALTER TABLE runtime.artifact_instances ADD CONSTRAINT artifact_session_identity UNIQUE(organization_id,session_id,id);
CREATE UNIQUE INDEX activation_session_identity ON runtime.release_activations(organization_id,session_id,id);
ALTER TABLE runtime.release_activations ADD CONSTRAINT activation_parent_same_session_fk
 FOREIGN KEY (organization_id,session_id,previous_activation_id)
 REFERENCES runtime.release_activations(organization_id,session_id,id);
CREATE TABLE evidence.checkpoints (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL,session_id uuid NOT NULL,
 through_sequence bigint NOT NULL CHECK (through_sequence>0),digest_sha256 text NOT NULL CHECK (digest_sha256 ~ '^[0-9a-f]{64}$'),
 signature bytea, signer_key_id text, external_anchor_ref text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(session_id,through_sequence),
 FOREIGN KEY (organization_id,session_id) REFERENCES runtime.sessions(organization_id,id)
);
