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
  "apps/server/migrations/008_projection_cursors.sql",
  "apps/server/migrations/009_runtime_capabilities.sql",
  "apps/server/migrations/010_information_messages_injects.sql",
  "apps/server/migrations/011_extension_registry.sql",
  "apps/server/migrations/012_extension_runs_approvals.sql",
  "apps/server/migrations/013_voting_core.sql",
  "apps/server/migrations/014_comms_voice_core.sql",
  "apps/server/migrations/015_collaboration_runtime.sql",
  "apps/server/migrations/016_voice_consent_assets.sql",
  "apps/server/migrations/017_session_access.sql",
  "apps/server/migrations/018_identity_roles_and_governance.sql",
  "apps/server/migrations/019_world_state_automation.sql",
  "apps/server/migrations/020_adjudication_records.sql",
  "apps/server/migrations/021_live_release_activation.sql",
  "apps/server/migrations/022_offline_devices.sql",
  "apps/server/migrations/023_evidence_checkpoints.sql",
  "apps/server/migrations/024_reporting_research.sql"
];

export default async function globalSetup() {
  const owner = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    for (const migration of migrations) {
      await owner.query(await readFile(new URL(`../../${migration}`, import.meta.url), "utf8"));
    }
    const release = JSON.parse(await readFile(
      new URL("../../definitions/fractured-order/fractured-order-release.json", import.meta.url), "utf8"
    ));
    const definition = { coreDesign: { ...release.coreDesign, polls: [{
      id: "synthetic-resolution", scope: "session", question: "Adopt the synthetic accessibility resolution?",
      options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }, { id: "abstain", label: "Abstain" }],
      pollType: "yes_no_abstain", tallyMethod: "builtin_count", tallyMethodVersion: "builtin-count-v1",
      electoratePolicyId: "policy-public", oneBallotPer: "seat_assignment", allowRevote: false, secrecy: "open",
      thresholdRule: { kind: "simple_majority", denominator: "valid_votes", abstentionCountsTowardDenominator: false },
      quorumRule: { basis: "electorate_at_open", minimum: 1, abstentionCountsTowardParticipation: true },
      weights: [], vetoRule: { holderSeatIds: [] }, tieRule: "no_decision",
      openTrigger: { mode: "manual" }, closeTrigger: { mode: "manual" }, deadlinePolicy: { graceSeconds: 0 },
      resultVisibilityPolicyId: "policy-public", certificationPolicy: { certifierSessionRoleIds: ["white_cell"] }
    }] }, scenario: release.scenario };
    const releaseDefinition = structuredClone(definition);
    const consentChannel = releaseDefinition.coreDesign.communications.voiceChannels.find(({ id }) => id === "team-open-room");
    consentChannel.transcriptionPolicy = "with_consent";
    consentChannel.retentionPolicyId = "voice-short";
    const activationDefinition = structuredClone(releaseDefinition);
    activationDefinition.coreDesign.workflows[0].name = `${activationDefinition.coreDesign.workflows[0].name} (revised)`;
    const people = Object.values(fixture.people);
    await owner.query("BEGIN");
    await owner.query("INSERT INTO identity.organizations(id,name) VALUES ($1,'PS-150 synthetic organization')", [fixture.organizationId]);
    await owner.query(
      `INSERT INTO identity.persons(id,display_name) VALUES
       ($1,'Synthetic Blue author'),($2,'Synthetic Blue reviewer'),($3,'Synthetic final reviewer'),($4,'Synthetic operator'),
       ($5,'Synthetic Red author'),($6,'Synthetic Green reviewer'),($7,'Synthetic Red reviewer'),
       ($8,'Synthetic Designer A'),($9,'Synthetic Designer B'),($10,'Synthetic Publisher'),($11,'Synthetic Blue notetaker')`,
      people
    );
    await owner.query(
      "INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'operator'),($1,$2,'admin')",
      [fixture.organizationId, fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES
       ($1,$2,'designer'),($1,$3,'designer'),($1,$3,'research_analyst'),($1,$4,'designer'),($1,$4,'publisher'),($1,$4,'reviewer')`,
      [fixture.organizationId, fixture.people.designerA, fixture.people.designerB, fixture.people.publisher]
    );
    await owner.query(
      "INSERT INTO studio.simulation_projects(id,organization_id,title,created_by) VALUES ($1,$2,'PS-150 S1 proof',$3)",
      [fixture.projectId, fixture.organizationId, fixture.people.operator]
    );
    await owner.query(
      "INSERT INTO studio.drafts(id,organization_id,project_id,document,updated_by) VALUES (gen_random_uuid(),$1,$2,$3::jsonb,$4)",
      [fixture.organizationId, fixture.projectId, JSON.stringify(definition), fixture.people.designerA]
    );
    await owner.query(
      `INSERT INTO studio.definition_revisions
       (id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
       VALUES ($1,$2,$3,$4::jsonb,repeat('a',64),'1.3.1',$5)`,
      [fixture.revisionId, fixture.organizationId, fixture.projectId, JSON.stringify(releaseDefinition), fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO registry.releases
       (id,organization_id,project_id,definition_revision_id,release_number,release_label,
        package_schema_version,compiler_version,package_sha256,blob_key,published_by)
       VALUES ($1,$2,$3,$4,1,'S1 proof 1.0.0','1.0.0','0.1.0',repeat('b',64),'fixture://ps-150',$5)`,
      [fixture.releaseId, fixture.organizationId, fixture.projectId, fixture.revisionId, fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO studio.definition_revisions
       (id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
       VALUES ($1,$2,$3,$4::jsonb,repeat('c',64),'1.3.1',$5)`,
      [fixture.activationRevisionId, fixture.organizationId, fixture.projectId, JSON.stringify(activationDefinition), fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO registry.releases
       (id,organization_id,project_id,definition_revision_id,release_number,release_label,
        package_schema_version,compiler_version,package_sha256,blob_key,published_by)
       VALUES ($1,$2,$3,$4,2,'S1 proof 1.1.0','1.0.0','0.1.0',repeat('d',64),'fixture://ps-420',$5)`,
      [fixture.activationReleaseId, fixture.organizationId, fixture.projectId, fixture.activationRevisionId, fixture.people.operator]
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
      `INSERT INTO runtime.session_access_configs
       (organization_id,session_id,governing_release_id,access_policy,assignment_version,configured_by)
       VALUES ($1,$2,$3,$4::jsonb,1,$5)`,
      [fixture.organizationId, fixture.sessionId, fixture.releaseId, JSON.stringify(releaseDefinition.coreDesign.accessPolicy), fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO runtime.session_operators(organization_id,session_id,person_id,assigned_by)
       VALUES ($1,$2,$3,$3)`, [fixture.organizationId, fixture.sessionId, fixture.people.operator]
    );
    for (const seat of releaseDefinition.coreDesign.seats) {
      await owner.query(
        `INSERT INTO runtime.session_seats
         (organization_id,session_id,seat_id,session_role_ids,team_id,min_occupancy,max_occupancy,required,join_mode)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [fixture.organizationId, fixture.sessionId, seat.id, seat.sessionRoleIds, seat.teamId ?? null,
          seat.minOccupancy, seat.maxOccupancy, seat.required, seat.joinMode]
      );
    }
    for (const check of releaseDefinition.coreDesign.accessPolicy.readiness) {
      await owner.query(
        `INSERT INTO runtime.session_readiness_checks
         (organization_id,session_id,check_key,label,blocking,governing_release_id,assignment_version,completed_by,completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,1,$7,now())`,
        [fixture.organizationId, fixture.sessionId, check.key, check.label, check.blocking, fixture.releaseId, fixture.people.operator]
      );
    }
    await owner.query(
      `INSERT INTO runtime.participants(id,organization_id,session_id,person_id) VALUES
       ($1,$2,$3,$4),($5,$2,$3,$6),($7,$2,$3,$8),($9,$2,$3,$10),($11,$2,$3,$12),($13,$2,$3,$14),
       ($15,$2,$3,$16),($17,$2,$3,$18),($19,$2,$3,$20),($21,$2,$3,$22)`,
      [fixture.participants.author, fixture.organizationId, fixture.sessionId, fixture.people.author,
        fixture.participants.reviewer, fixture.people.reviewer,
        fixture.participants.finalReviewer, fixture.people.finalReviewer,
        fixture.participants.redAuthor, fixture.people.redAuthor,
        fixture.participants.greenReviewer, fixture.people.greenReviewer,
        fixture.participants.redReviewer, fixture.people.redReviewer,
        fixture.participants.greenAuthor, fixture.people.designerA,
        fixture.participants.industryAuthor, fixture.people.designerB,
        fixture.participants.industryReviewer, fixture.people.publisher,
        fixture.participants.blueNotetaker, fixture.people.blueNotetaker]
    );
    await owner.query(
      `INSERT INTO runtime.seat_assignments
       (id,organization_id,session_id,participant_id,session_role_id,seat_id,assigned_by) VALUES
       ($1,$2,$3,$4,'scribe','blue-scribe',$5),
       ($6,$2,$3,$7,'facilitator','blue-facilitator',$5),
       ($8,$2,$3,$9,'white_cell','control',$5),
       ($10,$2,$3,$11,'scribe','red-scribe',$5),
       ($12,$2,$3,$13,'facilitator','green-facilitator',$5),
       ($14,$2,$3,$15,'facilitator','red-facilitator',$5),
       ($16,$2,$3,$17,'scribe','green-scribe',$5),
       ($18,$2,$3,$19,'scribe','industry-scribe',$5),
       ($20,$2,$3,$21,'facilitator','industry-facilitator',$5),
       ($22,$2,$3,$23,'notetaker','blue-notetaker',$5)`,
      [fixture.assignments.author, fixture.organizationId, fixture.sessionId, fixture.participants.author,
        fixture.people.operator, fixture.assignments.reviewer, fixture.participants.reviewer,
        fixture.assignments.finalReviewer, fixture.participants.finalReviewer,
        fixture.assignments.redAuthor, fixture.participants.redAuthor,
        fixture.assignments.greenReviewer, fixture.participants.greenReviewer,
        fixture.assignments.redReviewer, fixture.participants.redReviewer,
        fixture.assignments.greenAuthor, fixture.participants.greenAuthor,
        fixture.assignments.industryAuthor, fixture.participants.industryAuthor,
        fixture.assignments.industryReviewer, fixture.participants.industryReviewer,
        fixture.assignments.blueNotetaker, fixture.participants.blueNotetaker]
    );
    await owner.query(
      `INSERT INTO runtime.artifact_instances
         (id,organization_id,session_id,governing_release_id,artifact_type_key,workflow_key,form_version,
          creator_participant_id,owner_team_id,state,payload,visible_role_ids,version)
       VALUES ($1,$2,$3,$4,'green_proposal','proposal','1.0.0',$5,'green','recipient_threads',
         '{"recipientTeams":["red"],"title":"Synthetic recipient-isolation proof"}'::jsonb,
         ARRAY['facilitator','white_cell'],4)`,
      [fixture.proposalArtifactId, fixture.organizationId, fixture.sessionId, fixture.releaseId, fixture.participants.greenReviewer]
    );
    const extensionIds = {
      publisher: "24000000-0000-4000-8000-000000000001", artifact: "24000000-0000-4000-8000-000000000002",
      installation: "24000000-0000-4000-8000-000000000003", binding: "24000000-0000-4000-8000-000000000004",
      artifactB: "24000000-0000-4000-8000-000000000012", installationB: "24000000-0000-4000-8000-000000000013",
      compositionRun: "24000000-0000-4000-8000-000000000005", modelRun: "24000000-0000-4000-8000-000000000006",
      stateValue: "24000000-0000-4000-8000-000000000007", proposal: "24000000-0000-4000-8000-000000000008"
    };
    const artifactDigest = `sha256:${"3".repeat(64)}`;
    const configurationDigest = `sha256:${"4".repeat(64)}`;
    const inputDigest = `sha256:${"5".repeat(64)}`;
    const outputDigest = `sha256:${"6".repeat(64)}`;
    const catalogManifest = (pluginId, digest, capability) => ({
      pluginId, version: "1.0.0", digest, categories: ["world_and_simulation"], capabilities: [capability],
      connectivity: "offline_capable", contracts: { inputSchema: `${pluginId}.input.schema.json`, outputSchema: `${pluginId}.output.schema.json` },
      limits: { timeoutSeconds: 30, memoryMiB: 128, cpuMillis: 1000, outputBytes: 65536 },
      requestedPermissions: capability === "propose_effect" ? ["effects.propose"] : [], dataClassificationMaximum: "confidential",
      dependencies: []
    });
    await owner.query(`INSERT INTO extension.publishers(id,organization_id,principal_id,display_name,signature_key_id,public_key_pem,status,approved_by)
      VALUES ($1,$2,$3,'PS-230 fixture','fixture','fixture','approved',$3)`, [extensionIds.publisher, fixture.organizationId, fixture.people.operator]);
    await owner.query(`INSERT INTO extension.plugin_artifacts
      (id,organization_id,publisher_id,plugin_id,version,digest,manifest_digest,bundle_digest,object_key,manifest,supply_chain,lifecycle_status,submitted_by,approved_by,approved_at)
      VALUES ($1,$2,$3,'org.ssg.fixtures.effect','1.0.0',$4,$5,$6,'fixture',$7::jsonb,'{}','approved',$8,$8,now()),
             ($9,$2,$3,'org.ssg.fixtures.analysis','1.0.0',$10,$11,$12,'fixture-b',$13::jsonb,'{}','approved',$8,$8,now())`,
      [extensionIds.artifact, fixture.organizationId, extensionIds.publisher, artifactDigest, `sha256:${"8".repeat(64)}`, `sha256:${"9".repeat(64)}`,
        JSON.stringify(catalogManifest("org.ssg.fixtures.effect", artifactDigest, "propose_effect")), fixture.people.operator,
        extensionIds.artifactB, `sha256:${"c".repeat(64)}`, `sha256:${"d".repeat(64)}`, `sha256:${"f".repeat(64)}`,
        JSON.stringify(catalogManifest("org.ssg.fixtures.analysis", `sha256:${"c".repeat(64)}`, "compute"))]);
    await owner.query(`INSERT INTO extension.plugin_installations
      (id,organization_id,deployment_id,artifact_id,artifact_digest,status,permitted_permissions,installed_by)
      VALUES ($1,$2,$3,$4,$5,'enabled',ARRAY['effects.propose'],$6),
             ($7,$2,$3,$8,$9,'enabled',ARRAY[]::text[],$6)`,
      [extensionIds.installation, fixture.organizationId, fixture.deploymentId, extensionIds.artifact, artifactDigest, fixture.people.operator,
        extensionIds.installationB, extensionIds.artifactB, `sha256:${"c".repeat(64)}`]);
    await owner.query(`INSERT INTO extension.plugin_bindings
      (id,organization_id,project_id,definition_revision_id,installation_id,artifact_digest,configuration_digest,deployment_profile,status,bound_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'air_gapped','enabled',$8)`,
      [extensionIds.binding, fixture.organizationId, fixture.projectId, fixture.revisionId, extensionIds.installation, artifactDigest, configurationDigest, fixture.people.operator]);
    await owner.query(`INSERT INTO runtime.state_values
      (id,organization_id,session_id,governing_release_id,state_variable_id,scope_reference,value,version)
      VALUES ($1,$2,$3,$4,'synthetic_risk','','10',1)`, [extensionIds.stateValue, fixture.organizationId, fixture.sessionId, fixture.releaseId]);
    await owner.query(`INSERT INTO extension.composition_runs
      (id,organization_id,session_id,governing_release_id,trigger_command_id,graph_digest,input_snapshot_id,input_snapshot,input_digest,execution_policy,authority_epoch,status,correlation_id,completed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'{"pressure":10}',$8,'{"reviewerSessionRoleIds":["white_cell"],"allowedEffects":[]}',1,'completed',$9,now())`,
      [extensionIds.compositionRun, fixture.organizationId, fixture.sessionId, fixture.releaseId, "24000000-0000-4000-8000-000000000009", `sha256:${"a".repeat(64)}`,
        "24000000-0000-4000-8000-00000000000a", inputDigest, "24000000-0000-4000-8000-00000000000b"]);
    await owner.query(`INSERT INTO extension.model_runs
      (id,organization_id,session_id,composition_run_id,binding_id,artifact_digest,configuration_digest,governing_release_id,input_snapshot_id,input_digest,output_digest,environment_digest,seed,status,completed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,42,'completed',now())`,
      [extensionIds.modelRun, fixture.organizationId, fixture.sessionId, extensionIds.compositionRun, extensionIds.binding, artifactDigest, configurationDigest,
        fixture.releaseId, "24000000-0000-4000-8000-00000000000a", inputDigest, outputDigest, `sha256:${"b".repeat(64)}`]);
    await owner.query(`INSERT INTO extension.effect_proposals
      (id,organization_id,session_id,model_run_id,proposal_hash,target_aggregate_id,target_state_variable_id,scope_reference,operation,value,rationale,reviewer_role_ids,lifecycle_status,expected_state_version,governing_release_id,authority_epoch,artifact_digest,configuration_digest,input_digest,output_digest)
      VALUES ($1,$2,$3,$4,$5,$6,'synthetic_risk','','adjust','5','Deterministic synthetic fixture result',ARRAY['white_cell'],'in_review',1,$7,1,$8,$9,$10,$11)`,
      [extensionIds.proposal, fixture.organizationId, fixture.sessionId, extensionIds.modelRun, `sha256:${"7".repeat(64)}`,
        extensionIds.stateValue, fixture.releaseId, artifactDigest, configurationDigest, inputDigest, outputDigest]);
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
    const voiceDefinitions = new Map(releaseDefinition.coreDesign.communications.voiceChannels.map((channel) => [channel.id, channel]));
    for (const [key, channelId] of Object.entries(fixture.voiceChannels)) {
      const definitionId = key === "openRoom" ? "team-open-room" : key === "privateCall" ? "private-consultation" :
        key === "broadcast" ? "control-broadcast" : "all-hands-radio";
      const voiceDefinition = voiceDefinitions.get(definitionId);
      await owner.query(`INSERT INTO comms.voice_channels
        (id,organization_id,session_id,governing_release_id,definition_id,definition_revision,definition,status,
         provider_binding_id,provider_adapter_digest,authority_epoch,opened_by)
        VALUES ($1,$2,$3,$4,$5,1,$6::jsonb,'open','local-media-v1',$7,1,$8)`,
      [channelId,fixture.organizationId,fixture.sessionId,fixture.releaseId,definitionId,JSON.stringify(voiceDefinition),
        `sha256:${"e".repeat(64)}`,fixture.people.operator]);
    }
    await owner.query("COMMIT");
  } catch (error) {
    await owner.query("ROLLBACK");
    throw error;
  } finally {
    await owner.end();
  }
}
