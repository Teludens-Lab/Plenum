import { readFile } from "node:fs/promises";

import { Pool } from "pg";

import { fixture } from "./fixture.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required for CMD-PLATFORM-E2E and CMD-PLATFORM-A11Y");

const migrations = [
  "references/plenum-runtime-slice/migrations/001_core.sql",
  "references/plenum-runtime-slice/migrations/002_runtime_sync_evidence.sql",
  "references/plenum-runtime-slice/migrations/003_collaboration.sql",
  "references/plenum-runtime-slice/migrations/004_security.sql",
  "apps/server/migrations/005_identity_oidc_context.sql",
  "apps/server/migrations/006_command_kernel.sql",
  "apps/server/migrations/007_release_packages.sql",
  "apps/server/migrations/008_projection_cursors.sql"
];

export default async function globalSetup() {
  const owner = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    for (const migration of migrations) {
      await owner.query(await readFile(new URL(`../../${migration}`, import.meta.url), "utf8"));
    }
    const definition = JSON.parse(await readFile(
      new URL("../../definitions/fractured-order/s1-runtime-release.json", import.meta.url), "utf8"
    ));
    const people = Object.values(fixture.people);
    await owner.query("BEGIN");
    await owner.query("INSERT INTO identity.organizations(id,name) VALUES ($1,'PS-150 synthetic organization')", [fixture.organizationId]);
    await owner.query(
      `INSERT INTO identity.persons(id,display_name) VALUES
       ($1,'Synthetic author'),($2,'Synthetic reviewer'),($3,'Synthetic final reviewer'),($4,'Synthetic operator')`,
      people
    );
    await owner.query(
      "INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'operator')",
      [fixture.organizationId, fixture.people.operator]
    );
    await owner.query(
      "INSERT INTO studio.simulation_projects(id,organization_id,title,created_by) VALUES ($1,$2,'PS-150 S1 proof',$3)",
      [fixture.projectId, fixture.organizationId, fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO studio.definition_revisions
       (id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
       VALUES ($1,$2,$3,$4::jsonb,repeat('a',64),'1.3.1',$5)`,
      [fixture.revisionId, fixture.organizationId, fixture.projectId, JSON.stringify(definition), fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO registry.releases
       (id,organization_id,project_id,definition_revision_id,release_number,release_label,
        package_schema_version,compiler_version,package_sha256,blob_key,published_by)
       VALUES ($1,$2,$3,$4,1,'S1 proof 1.0.0','1.0.0','0.1.0',repeat('b',64),'fixture://ps-150',$5)`,
      [fixture.releaseId, fixture.organizationId, fixture.projectId, fixture.revisionId, fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO runtime.sessions(id,organization_id,project_id,initial_release_id,status,created_by)
       VALUES ($1,$2,$3,$4,'active',$5)`,
      [fixture.sessionId, fixture.organizationId, fixture.projectId, fixture.releaseId, fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO runtime.session_authorities(session_id,organization_id,deployment_id,authority_epoch,status)
       VALUES ($1,$2,$3,1,'active')`,
      [fixture.sessionId, fixture.organizationId, fixture.deploymentId]
    );
    await owner.query(
      `INSERT INTO runtime.release_activations
       (id,organization_id,project_id,session_id,release_id,activation_sequence,compatibility_policy,approved_by)
       VALUES ('17000000-0000-4000-8000-000000000001',$1,$2,$3,$4,1,'{}',$5)`,
      [fixture.organizationId, fixture.projectId, fixture.sessionId, fixture.releaseId, fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO runtime.participants(id,organization_id,session_id,person_id) VALUES
       ($1,$2,$3,$4),($5,$2,$3,$6),($7,$2,$3,$8)`,
      [fixture.participants.author, fixture.organizationId, fixture.sessionId, fixture.people.author,
        fixture.participants.reviewer, fixture.people.reviewer,
        fixture.participants.finalReviewer, fixture.people.finalReviewer]
    );
    await owner.query(
      `INSERT INTO runtime.seat_assignments
       (id,organization_id,session_id,participant_id,session_role_id,seat_id,assigned_by) VALUES
       ($1,$2,$3,$4,'scribe','seat-author',$5),
       ($6,$2,$3,$7,'facilitator','seat-reviewer',$5),
       ($8,$2,$3,$9,'white_cell','seat-final-reviewer',$5)`,
      [fixture.assignments.author, fixture.organizationId, fixture.sessionId, fixture.participants.author,
        fixture.people.operator, fixture.assignments.reviewer, fixture.participants.reviewer,
        fixture.assignments.finalReviewer, fixture.participants.finalReviewer]
    );
    for (const participantId of Object.values(fixture.participants)) {
      await owner.query(
        "INSERT INTO runtime.participant_access_revisions(organization_id,session_id,participant_id) VALUES ($1,$2,$3)",
        [fixture.organizationId, fixture.sessionId, participantId]
      );
    }
    for (const [key, authenticationSessionId] of Object.entries(fixture.authenticationSessions)) {
      await owner.query(
        `INSERT INTO identity.authentication_sessions
         (id,organization_id,person_id,issuer,subject,authentication_strength,expires_at)
         VALUES ($1,$2,$3,'https://fixture.invalid',$4,'mfa','2099-01-01T00:00:00.000Z')`,
        [authenticationSessionId, fixture.organizationId, fixture.people[key], `ps150-${key}`]
      );
    }
    await owner.query(
      "INSERT INTO evidence.session_sequences(session_id,organization_id) VALUES ($1,$2)",
      [fixture.sessionId, fixture.organizationId]
    );
    await owner.query("COMMIT");
  } catch (error) {
    await owner.query("ROLLBACK");
    throw error;
  } finally {
    await owner.end();
  }
}
