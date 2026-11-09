import { randomUUID } from "node:crypto";
import { canonicalizeJson, type JsonObject } from "@plenum/event-contracts";
import type { Pool } from "pg";
import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import { requireCurrentOrganizationRole } from "../research/evidence.js";
import { sha256 } from "./formats.js";

export interface OrganizationArchive extends JsonObject {
  archiveVersion: 1 | 2;
  restoreContract: "plenum-organization-logical-v1" | "plenum-organization-logical-v2";
  databaseSchema?: "plenum-042";
  generatedAt: string;
  sourceOrganizationRef: string;
  data: JsonObject;
  dataSha256: string;
  excludedDataClasses: string[];
}

// Explicit allowlist in dependency order. Never discover/export arbitrary tables.
// These v2 datasets preserve authored versions and authoritative Runtime history.
const historyTables: ReadonlyArray<readonly [string, string, string]> = [
  ["publicationReviews", "studio.publication_reviews", "decided_at,id"],
  ["packageManifests", "registry.package_manifests", "release_id"],
  ["releaseApprovals", "registry.release_approvals", "id"],
  ["contentItems", "studio.content_items", "id"],
  ["contentVersions", "studio.content_versions", "id"],
  ["documentUpdates", "studio.document_updates", "id"],
  ["devices", "sync.devices", "id"],
  ["commandReceipts", "sync.command_receipts", "session_id,received_at,id"],
  ["sessionAccessConfigs", "runtime.session_access_configs", "session_id"],
  ["sessionOperators", "runtime.session_operators", "session_id,person_id"],
  ["sessionSeats", "runtime.session_seats", "session_id,seat_id"],
  ["readinessChecks", "runtime.session_readiness_checks", "session_id,check_key"],
  ["participantAccessRevisions", "runtime.participant_access_revisions", "session_id,participant_id"],
  ["stageState", "runtime.session_stage_state", "session_id"],
  ["stageHistory", "runtime.stage_transition_history", "session_id,id"],
  ["controlInterventions", "runtime.control_interventions", "session_id,id"],
  ["artifactRevisions", "runtime.artifact_revisions", "session_id,artifact_id,artifact_version"],
  ["artifactRevisionAuthors", "runtime.artifact_revision_authors", "artifact_revision_id,author_order"],
  ["messageThreads", "runtime.message_threads", "id"],
  ["messages", "runtime.messages", "id"],
  ["messageRecipients", "runtime.message_recipients", "message_id,participant_id"],
  ["messageApprovals", "runtime.message_approvals", "id"],
  ["injectInstances", "runtime.inject_instances", "id"],
  ["injectRecipients", "runtime.inject_recipient_states", "inject_instance_id,participant_id"],
  ["informationDeliveries", "runtime.information_deliveries", "id"],
  ["stateValues", "runtime.state_values", "id"],
  ["capabilityInstances", "runtime.capability_instances", "id"],
  ["resourceBalances", "runtime.resource_balances", "id"],
  ["stateTransactions", "runtime.state_transactions", "id"],
  ["scheduledStateEffects", "runtime.scheduled_state_effects", "id"],
  ["adjudicationRequests", "runtime.adjudication_requests", "id"],
  ["adjudicationActions", "runtime.adjudication_request_actions", "id"],
  ["adjudicationReviews", "runtime.adjudication_reviews", "id"],
  ["adjudicationRecords", "runtime.adjudication_records", "id"],
  ["adjudicationDeliveries", "runtime.adjudication_deliveries", "id"],
  ["polls", "voting.polls", "id"],
  ["pollOptions", "voting.poll_options", "poll_id,ordinal"],
  ["electorateMembers", "voting.electorate_members", "id"],
  ["ballots", "voting.ballots", "poll_id,accepted_sequence"],
  ["ballotReceipts", "voting.ballot_receipts", "poll_id,accepted_sequence"],
  ["tallies", "voting.tallies", "poll_id,poll_revision"],
  ["certifications", "voting.certifications", "certified_at,id"],
  ["voiceChannels", "comms.voice_channels", "id"],
  ["voiceConsents", "comms.consent_records", "id"],
  ["mediaEvents", "comms.media_events", "id"]
];

export async function exportOrganizationArchive(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  correlationId: string,
  now = new Date()
): Promise<OrganizationArchive> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentOrganizationRole(client, principal, "admin", correlationId);
    const query = async (sql: string): Promise<JsonObject[]> => (await client.query<{ value: JsonObject }>(sql, [principal.organizationId])).rows.map(({ value }) => value);
    const data: JsonObject = {
      organization: (await query("SELECT to_jsonb(organization) AS value FROM identity.organizations organization WHERE id=$1"))[0] ?? {},
      persons: await query(`SELECT to_jsonb(person) AS value FROM identity.persons person
        WHERE EXISTS (
          SELECT 1 FROM identity.memberships membership
           WHERE membership.organization_id=$1 AND membership.person_id=person.id
        ) OR EXISTS (
          SELECT 1 FROM identity.organization_workforce_members workforce
           WHERE workforce.organization_id=$1 AND workforce.person_id=person.id
        ) OR EXISTS (
          SELECT 1 FROM runtime.participants participant
           WHERE participant.organization_id=$1 AND participant.person_id=person.id
        )
        ORDER BY person.id`),
      memberships: await query("SELECT to_jsonb(membership) AS value FROM identity.memberships membership WHERE organization_id=$1 ORDER BY person_id,organization_role"),
      organizationWorkforceMembers: await query("SELECT to_jsonb(member) AS value FROM identity.organization_workforce_members member WHERE organization_id=$1 ORDER BY person_id"),
      projects: await query("SELECT to_jsonb(project) AS value FROM studio.simulation_projects project WHERE organization_id=$1 ORDER BY id"),
      simulationTemplates: await query("SELECT to_jsonb(template) AS value FROM studio.simulation_templates template WHERE organization_id=$1 ORDER BY published_at,id"),
      templateLifecycleEvents: await query("SELECT to_jsonb(event) AS value FROM studio.template_lifecycle_events event WHERE organization_id=$1 ORDER BY occurred_at,id"),
      projectCollaborators: await query("SELECT to_jsonb(collaborator) AS value FROM studio.project_collaborators collaborator WHERE organization_id=$1 ORDER BY project_id,person_id,project_role"),
      projectMutationReceipts: await query("SELECT to_jsonb(receipt) AS value FROM studio.project_mutation_receipts receipt WHERE organization_id=$1 ORDER BY recorded_at,request_id"),
      collaborativeDocuments: await query("SELECT to_jsonb(document) AS value FROM studio.collaborative_documents document WHERE organization_id=$1 ORDER BY id"),
      publicationFreezes: await query("SELECT to_jsonb(publication_freeze) AS value FROM studio.publication_freezes publication_freeze WHERE organization_id=$1 ORDER BY frozen_at,id"),
      revisions: await query("SELECT to_jsonb(revision) AS value FROM studio.definition_revisions revision WHERE organization_id=$1 ORDER BY created_at,id"),
      releases: await query("SELECT to_jsonb(release) AS value FROM registry.releases release WHERE organization_id=$1 ORDER BY published_at,id"),
      sessions: await query("SELECT to_jsonb(session) AS value FROM runtime.sessions session WHERE organization_id=$1 ORDER BY created_at,id"),
      sessionAuthorities: await query("SELECT to_jsonb(authority) AS value FROM runtime.session_authorities authority WHERE organization_id=$1 ORDER BY session_id"),
      activationReviews: await query("SELECT to_jsonb(review) AS value FROM runtime.release_activation_reviews review WHERE organization_id=$1 ORDER BY reviewed_at,id"),
      activations: await query("SELECT to_jsonb(activation) AS value FROM runtime.release_activations activation WHERE organization_id=$1 ORDER BY session_id,activation_sequence"),
      participants: await query("SELECT to_jsonb(participant) AS value FROM runtime.participants participant WHERE organization_id=$1 ORDER BY session_id,id"),
      seatAssignments: await query("SELECT to_jsonb(assignment) AS value FROM runtime.seat_assignments assignment WHERE organization_id=$1 ORDER BY session_id,id"),
      artifacts: await query("SELECT to_jsonb(artifact) AS value FROM runtime.artifact_instances artifact WHERE organization_id=$1 ORDER BY session_id,id"),
      sessionSequences: await query("SELECT to_jsonb(session_sequence) AS value FROM evidence.session_sequences session_sequence WHERE organization_id=$1 ORDER BY session_id"),
      events: await query("SELECT to_jsonb(event) AS value FROM evidence.events event WHERE organization_id=$1 ORDER BY session_id,sequence"),
      checkpointBatches: await query("SELECT to_jsonb(checkpoint) AS value FROM evidence.checkpoint_batches checkpoint WHERE organization_id=$1 ORDER BY session_id,first_sequence"),
      checkpointSignatures: await query("SELECT to_jsonb(checkpoint_signature) AS value FROM evidence.checkpoint_signatures checkpoint_signature WHERE organization_id=$1 ORDER BY signed_at,id"),
      anchorReceipts: await query("SELECT to_jsonb(receipt) AS value FROM evidence.anchor_receipts receipt WHERE organization_id=$1 ORDER BY recorded_at,id"),
      reportDefinitions: await query("SELECT to_jsonb(definition) AS value FROM reporting.report_definitions definition WHERE organization_id=$1 ORDER BY definition_key,definition_version"),
      measurementDefinitions: await query("SELECT to_jsonb(measurement_definition) AS value FROM reporting.measurement_definitions measurement_definition WHERE organization_id=$1 ORDER BY measurement_key,version"),
      researchConsents: await query("SELECT to_jsonb(consent) AS value FROM reporting.research_consents consent WHERE organization_id=$1 ORDER BY recorded_at,id"),
      analyticalRecords: await query("SELECT to_jsonb(record) AS value FROM reporting.analytical_records record WHERE organization_id=$1 ORDER BY recorded_at,id"),
      retentionPolicies: await query("SELECT to_jsonb(policy) AS value FROM reporting.retention_policies policy WHERE organization_id=$1 ORDER BY policy_key,version"),
      formAttachments: await query("SELECT to_jsonb(attachment) AS value FROM runtime.form_attachments attachment WHERE organization_id=$1 ORDER BY created_at,id"),
      legalHoldEvents: await query("SELECT to_jsonb(hold_event) AS value FROM reporting.legal_hold_events hold_event WHERE organization_id=$1 ORDER BY recorded_at,id"),
      corrections: await query("SELECT to_jsonb(correction) AS value FROM reporting.corrections correction WHERE organization_id=$1 ORDER BY corrected_at,id"),
      exportJobs: await query("SELECT to_jsonb(job) AS value FROM reporting.export_jobs job WHERE organization_id=$1 ORDER BY completed_at,id"),
      exportArtifacts: await query("SELECT to_jsonb(artifact) AS value FROM reporting.export_artifacts artifact WHERE organization_id=$1 ORDER BY created_at,id")
    };
    for (const [key, table, order] of historyTables) {
      const value = table === "runtime.session_access_configs" ? "to_jsonb(item) - 'session_code_sha256'" : "to_jsonb(item)";
      // Deferred/private voting modes cannot enter the portable archive, even if
      // historical/imported data contains one. Their choices remain excluded.
      const privacy = table === "voting.polls" ? " AND item.definition->>'secrecy'='open'"
        : table.startsWith("voting.") ? " AND EXISTS (SELECT 1 FROM voting.polls poll WHERE poll.organization_id=$1 AND poll.id=item.poll_id AND poll.definition->>'secrecy'='open')" : "";
      data[key] = await query(`SELECT ${value} AS value FROM ${table} item WHERE item.organization_id=$1${privacy} ORDER BY ${order.split(",").map((column) => `item.${column}`).join(",")}`);
    }
    return { archiveVersion: 2, restoreContract: "plenum-organization-logical-v2", databaseSchema: "plenum-042", generatedAt: now.toISOString(), sourceOrganizationRef: sha256(principal.organizationId).slice(0, 24),
      data, dataSha256: sha256(canonicalizeJson(data)),
      excludedDataClasses: ["authentication_credentials", "session_join_credentials", "live_media_grants_and_floor_tokens",
        "secret_ballot_choices", "non_open_poll_records", "protected_voice_assets", "audit_record_details", "object_store_blobs"] };
  }, "repeatable read");
}

const logicalRestoreTables = [
  ["projects", "studio.simulation_projects"],
  ["projectCollaborators", "studio.project_collaborators"],
  ["projectMutationReceipts", "studio.project_mutation_receipts"],
  ["collaborativeDocuments", "studio.collaborative_documents"],
  ["publicationFreezes", "studio.publication_freezes"],
  ["simulationTemplates", "studio.simulation_templates"],
  ["templateLifecycleEvents", "studio.template_lifecycle_events"],
  ["revisions", "studio.definition_revisions"],
  ["releases", "registry.releases"],
  ["sessions", "runtime.sessions"],
  ["sessionAuthorities", "runtime.session_authorities"],
  ["activationReviews", "runtime.release_activation_reviews"],
  ["activations", "runtime.release_activations"],
  ["participants", "runtime.participants"],
  ["seatAssignments", "runtime.seat_assignments"],
  ["artifacts", "runtime.artifact_instances"],
  ["sessionSequences", "evidence.session_sequences"],
  ["events", "evidence.events"],
  ["checkpointBatches", "evidence.checkpoint_batches"],
  ["checkpointSignatures", "evidence.checkpoint_signatures"],
  ["anchorReceipts", "evidence.anchor_receipts"],
  ["reportDefinitions", "reporting.report_definitions"],
  ["measurementDefinitions", "reporting.measurement_definitions"],
  ["researchConsents", "reporting.research_consents"],
  ["analyticalRecords", "reporting.analytical_records"],
  ["retentionPolicies", "reporting.retention_policies"],
  ["formAttachments", "runtime.form_attachments"],
  ["legalHoldEvents", "reporting.legal_hold_events"],
  ["corrections", "reporting.corrections"],
  ["exportJobs", "reporting.export_jobs"],
  ["exportArtifacts", "reporting.export_artifacts"],
  ...historyTables.map(([key, table]) => [key, table] as const)
] as const;

function archiveRows(archive: OrganizationArchive, key: string, correlationId: string): JsonObject[] {
  const value = archive.data[key];
  if (!Array.isArray(value) || value.some((row) => row === null || Array.isArray(row) || typeof row !== "object")) {
    throw authorizationError("VALIDATION_FAILED", `The Organization archive dataset ${key} is invalid.`, correlationId);
  }
  return value as JsonObject[];
}

function optionalArchiveRows(archive: OrganizationArchive, key: string, correlationId: string): JsonObject[] {
  return archive.data[key] === undefined ? [] : archiveRows(archive, key, correlationId);
}

export async function importOrganizationArchive(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  archive: OrganizationArchive,
  correlationId: string
): Promise<{ importId: string; replayed: boolean; restoredRows: number }> {
  if (!archive || (archive.archiveVersion !== 1 && archive.archiveVersion !== 2) ||
      archive.restoreContract !== `plenum-organization-logical-v${archive.archiveVersion}` ||
      (archive.archiveVersion === 2 && archive.databaseSchema !== "plenum-042") ||
      !archive.data || typeof archive.data !== "object" || Array.isArray(archive.data) ||
      !/^[0-9a-f]{64}$/u.test(archive.dataSha256) ||
      sha256(canonicalizeJson(archive.data)) !== archive.dataSha256) {
    throw authorizationError("VALIDATION_FAILED", "The Organization archive digest is invalid.", correlationId);
  }
  const organization = archive.data.organization;
  if (organization === null || Array.isArray(organization) || typeof organization !== "object" ||
      organization.id !== principal.organizationId ||
      archive.sourceOrganizationRef !== sha256(principal.organizationId).slice(0, 24)) {
    throw authorizationError("VALIDATION_FAILED", "The archive does not belong to the current Organization.", correlationId);
  }
  const persons = archiveRows(archive, "persons", correlationId);
  const memberships = archiveRows(archive, "memberships", correlationId);
  const workforce = archive.archiveVersion === 1 ? optionalArchiveRows(archive, "organizationWorkforceMembers", correlationId)
    : archiveRows(archive, "organizationWorkforceMembers", correlationId);
  const optionalDatasets = new Set(archive.archiveVersion === 1
    ? ["simulationTemplates", "templateLifecycleEvents", "projectCollaborators", "projectMutationReceipts", "legalHoldEvents", "formAttachments"] : []);
  if (archive.archiveVersion === 1) for (const [key] of historyTables) optionalDatasets.add(key);
  const datasets = logicalRestoreTables.map(([key, table]) => ({ key, table,
    rows: optionalDatasets.has(key) ? optionalArchiveRows(archive, key, correlationId) : archiveRows(archive, key, correlationId) }));
  const foreignDataset = memberships.some((row) => row.organization_id !== principal.organizationId) ? "memberships" :
    workforce.some((row) => row.organization_id !== principal.organizationId) ? "organizationWorkforceMembers" :
    datasets.find(({ rows }) => rows.some((row) => row.organization_id !== principal.organizationId))?.key;
  if (foreignDataset !== undefined) {
    throw authorizationError("VALIDATION_FAILED", `The archive dataset ${foreignDataset} contains data from another Organization.`, correlationId);
  }
  const polls = datasets.find(({ key }) => key === "polls")?.rows ?? [];
  if (polls.some(({ definition }) => !definition || typeof definition !== "object" || Array.isArray(definition) || definition.secrecy !== "open")) {
    throw authorizationError("VALIDATION_FAILED", "Portable archives support only open Poll records.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentOrganizationRole(client, principal, "admin", correlationId);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`organization.archive:${principal.organizationId}`]);
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM reporting.organization_imports WHERE organization_id=$1 AND source_package_sha256=$2`,
      [principal.organizationId, archive.dataSha256]
    );
    if (existing.rows[0] !== undefined) return { importId: existing.rows[0].id, replayed: true, restoredRows: 0 };
    const target = await client.query<{ name: string }>("SELECT name FROM identity.organizations WHERE id=$1", [principal.organizationId]);
    if (target.rows[0]?.name !== organization.name) {
      throw authorizationError("VALIDATION_FAILED", "The target Organization identity does not match the archive.", correlationId);
    }
    const occupied = await client.query<{ table_name: string }>(logicalRestoreTables
      .map(([, table]) => `SELECT '${table}' AS table_name WHERE EXISTS (SELECT 1 FROM ${table} WHERE organization_id=$1)`)
      .join(" UNION ALL "), [principal.organizationId]);
    if (occupied.rows[0] !== undefined) {
      throw authorizationError("VALIDATION_FAILED", "Organization archives can only be restored into an empty Organization deployment.", correlationId);
    }
    const restoredPersons = await client.query(
      "INSERT INTO identity.persons SELECT * FROM jsonb_populate_recordset(NULL::identity.persons,$1::jsonb) ON CONFLICT (id) DO NOTHING",
      [JSON.stringify(persons)]
    );
    const conflictingPerson = await client.query(
      `SELECT 1 FROM jsonb_array_elements($1::jsonb) source(value)
        JOIN identity.persons person ON person.id=(source.value->>'id')::uuid
       WHERE person.display_name IS DISTINCT FROM source.value->>'display_name' LIMIT 1`,
      [JSON.stringify(persons)]
    );
    if (conflictingPerson.rows[0] !== undefined) {
      throw authorizationError("VALIDATION_FAILED", "An archived Person conflicts with the target identity bootstrap.", correlationId);
    }
    let restoredRows = restoredPersons.rowCount ?? 0;
    if (workforce.length > 0) {
      const restored = await client.query(
        `INSERT INTO identity.organization_workforce_members
           SELECT * FROM jsonb_populate_recordset(NULL::identity.organization_workforce_members,$1::jsonb)
           ON CONFLICT (organization_id,person_id) DO UPDATE SET
             primary_email=EXCLUDED.primary_email,external_id=EXCLUDED.external_id,
             source=EXCLUDED.source,status=EXCLUDED.status,lifecycle_version=EXCLUDED.lifecycle_version,
             invited_at=EXCLUDED.invited_at,joined_at=EXCLUDED.joined_at,suspended_at=EXCLUDED.suspended_at,
             deprovisioned_at=EXCLUDED.deprovisioned_at,lifecycle_reason=EXCLUDED.lifecycle_reason,
             last_scim_seen_at=EXCLUDED.last_scim_seen_at,last_access_reviewed_at=EXCLUDED.last_access_reviewed_at,
             last_access_reviewed_by=EXCLUDED.last_access_reviewed_by,created_by=EXCLUDED.created_by,
             created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at`,
        [JSON.stringify(workforce)]
      );
      restoredRows += restored.rowCount ?? 0;
    }
    const restoredMemberships = await client.query(
      "INSERT INTO identity.memberships SELECT * FROM jsonb_populate_recordset(NULL::identity.memberships,$1::jsonb) ON CONFLICT DO NOTHING",
      [JSON.stringify(memberships)]
    );
    restoredRows += restoredMemberships.rowCount ?? 0;
    if (workforce.length > 0) {
      const current = (await client.query<{ value: JsonObject }>(
        "SELECT to_jsonb(member) AS value FROM identity.organization_workforce_members member WHERE organization_id=$1 ORDER BY person_id",
        [principal.organizationId]
      )).rows.map(({ value }) => value);
      if (canonicalizeJson(current) !== canonicalizeJson(workforce)) {
        throw authorizationError("VALIDATION_FAILED", "The archived workforce conflicts with target identity bootstrap.", correlationId);
      }
    }
    for (const { table, rows } of datasets) {
      if (rows.length === 0) continue;
      const restored = table === "studio.simulation_projects"
        ? await client.query(
          `INSERT INTO studio.simulation_projects
             (id,organization_id,title,created_by,created_at,lifecycle_status,version,updated_at,archived_at,archived_by,source_template_id)
           SELECT id,organization_id,title,created_by,created_at,
                  coalesce(lifecycle_status,'active'),coalesce(version,1),coalesce(updated_at,created_at),
                  archived_at,archived_by,NULL
             FROM jsonb_populate_recordset(NULL::studio.simulation_projects,$1::jsonb)`,
          [JSON.stringify(rows)]
        )
        : table === "voting.polls" ? await client.query(
          // Restore frozen children before reinstating the exact Poll status.
          // All rows remain invisible outside this transaction until commit.
          `INSERT INTO voting.polls SELECT * FROM jsonb_populate_recordset(NULL::voting.polls,
             (SELECT jsonb_agg(jsonb_set(value,'{status}','"draft"'::jsonb)) FROM jsonb_array_elements($1::jsonb)))`,
          [JSON.stringify(rows)]
        ) : await client.query(
          `INSERT INTO ${table} SELECT * FROM jsonb_populate_recordset(NULL::${table},$1::jsonb)`,
          [JSON.stringify(rows)]
        );
      restoredRows += restored.rowCount ?? 0;
    }
    if (polls.length > 0) await client.query(
      `UPDATE voting.polls poll SET status=source.status
         FROM jsonb_populate_recordset(NULL::voting.polls,$1::jsonb) source
        WHERE poll.organization_id=$2 AND poll.id=source.id`, [JSON.stringify(polls), principal.organizationId]
    );
    const projectRows = datasets.find(({ table }) => table === "studio.simulation_projects")?.rows ?? [];
    const templateRows = datasets.find(({ table }) => table === "studio.simulation_templates")?.rows ?? [];
    if (templateRows.length > 0 && projectRows.some((row) => row.source_template_id !== null && row.source_template_id !== undefined)) {
      await client.query(
        `UPDATE studio.simulation_projects project
            SET source_template_id=source.source_template_id
           FROM jsonb_populate_recordset(NULL::studio.simulation_projects,$1::jsonb) source
          WHERE project.organization_id=$2 AND project.id=source.id AND source.source_template_id IS NOT NULL`,
        [JSON.stringify(projectRows), principal.organizationId]
      );
    }
    const collaboratorRows = datasets.find(({ table }) => table === "studio.project_collaborators")?.rows ?? [];
    if (collaboratorRows.length === 0 && projectRows.length > 0) {
      const owners = await client.query(
        `INSERT INTO studio.project_collaborators
           (organization_id,project_id,person_id,project_role,added_by,added_at)
         SELECT organization_id,id,created_by,'owner',created_by,created_at
           FROM studio.simulation_projects WHERE organization_id=$1
         ON CONFLICT DO NOTHING`,
        [principal.organizationId]
      );
      restoredRows += owners.rowCount ?? 0;
    }
    const importId = randomUUID();
    await client.query(
      `INSERT INTO reporting.organization_imports(id,organization_id,source_package_sha256,source_manifest,imported_by)
       VALUES ($1,$2,$3,$4::jsonb,$5)`,
      [importId, principal.organizationId, archive.dataSha256, JSON.stringify(archive), principal.principalId]
    );
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'organization.archive_imported',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `organization_import:${importId}`,
        JSON.stringify({ correlationId, sourcePackageSha256: archive.dataSha256, restoredRows })]
    );
    return { importId, replayed: false, restoredRows };
  });
}
