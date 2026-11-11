import { createHash, generateKeyPairSync } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { Pool } from "pg";
import { canonicalizeJson } from "@plenum/event-contracts";
import { createOfflinePluginBundle, createPluginRevocations, pluginDigest } from "@plenum/plugin-sdk";
import { compileRelease } from "@plenum/release-compiler";

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
  "apps/server/migrations/024_reporting_research.sql",
  "apps/server/migrations/025_security_retention_enforcement.sql",
  "apps/server/migrations/026_product_portal.sql",
  "apps/server/migrations/027_release_session_catalog.sql",
  "apps/server/migrations/028_content_library.sql",
  "apps/server/migrations/030_template_review_governance.sql",
  "apps/server/migrations/032_operations_administration.sql",
  "apps/server/migrations/033_platform_control_plane.sql",
  "apps/server/migrations/034_platform_onboarding_operations.sql",
  "apps/server/migrations/035_platform_administrator_workforce.sql",
  "apps/server/migrations/036_organization_identity_providers.sql",
  "apps/server/migrations/037_organization_workforce.sql",
  "apps/server/migrations/038_identity_workforce_operations.sql",
  "apps/server/migrations/039_operational_security_events.sql",
  "apps/server/migrations/040_operational_security_reader.sql",
  "apps/server/migrations/041_form_attachments.sql",
  "apps/server/migrations/042_inject_schedule_provenance.sql",
  "apps/server/migrations/043_oidc_browser_binding.sql",
  "apps/server/migrations/044_floor_provider_reconciliation.sql"
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
    releaseDefinition.coreDesign.accessPolicy.joinMethods = ["invitation", "code_and_verified_email", "open_seat_selection", "operator_assignment"];
    for (const seat of releaseDefinition.coreDesign.seats.slice(0, 2)) seat.joinMode = "open_selection";
    const consentChannel = releaseDefinition.coreDesign.communications.voiceChannels.find(({ id }) => id === "team-open-room");
    consentChannel.transcriptionPolicy = "with_consent";
    consentChannel.retentionPolicyId = "voice-short";
    const fixtureMediaAdapter = releaseDefinition.coreDesign.platformAdapters.find(({ id }) => id === "local-media-v1");
    for (const capability of fixtureMediaAdapter.voiceCapabilities) capability.transcription = true;
    const activationDefinition = structuredClone(releaseDefinition);
    activationDefinition.coreDesign.workflows[0].name = `${activationDefinition.coreDesign.workflows[0].name} (revised)`;
    const fixturePublishedAt = "2026-01-15T12:00:00.000Z";
    const compiledRelease = compileRelease({ releaseId: fixture.releaseId, projectId: fixture.projectId,
      definitionRevisionId: fixture.revisionId, releaseLabel: "S1 proof 1.0.0", semanticVersion: "1.0.0",
      methodologyVersion: "1.3.1", materialization: releaseDefinition, publishedBy: fixture.people.operator,
      approvedBy: [fixture.people.publisher], publishedAt: fixturePublishedAt, releaseNotes: "Synthetic PS-720 fixture.",
      validationReportId: "18000000-0000-4000-8000-000000000001" });
    const compiledActivation = compileRelease({ releaseId: fixture.activationReleaseId, projectId: fixture.projectId,
      definitionRevisionId: fixture.activationRevisionId, releaseLabel: "S1 proof 1.1.0", semanticVersion: "1.1.0",
      methodologyVersion: "1.3.1", materialization: activationDefinition, publishedBy: fixture.people.operator,
      approvedBy: [fixture.people.publisher], publishedAt: fixturePublishedAt, releaseNotes: "Synthetic activation fixture.",
      validationReportId: "18000000-0000-4000-8000-000000000002" });
    const people = Object.values(fixture.people);
    await owner.query("BEGIN");
    await owner.query("INSERT INTO identity.organizations(id,name) VALUES ($1,'PS-150 synthetic organization')", [fixture.organizationId]);
    await owner.query(
      `INSERT INTO identity.persons(id,display_name) VALUES
       ($1,'Synthetic Blue author'),($2,'Synthetic Blue reviewer'),($3,'Synthetic final reviewer'),($4,'Synthetic operator'),
       ($5,'Synthetic Red author'),($6,'Synthetic Green reviewer'),($7,'Synthetic Red reviewer'),
       ($8,'Synthetic Designer A'),($9,'Synthetic Designer B'),($10,'Synthetic Publisher'),($11,'Synthetic Blue notetaker'),
       ($12,'Synthetic portal operator'),($13,'Synthetic invited participant'),($14,'Synthetic code participant')`,
      people
    );
    await owner.query(
      "INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'operator'),($1,$2,'admin')",
      [fixture.organizationId, fixture.people.operator]
    );
    await owner.query("SELECT identity.bootstrap_platform_administrator($1,gen_random_uuid())", [fixture.people.operator]);
    await owner.query(
      `INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES
       ($1,$2,'designer'),($1,$3,'designer'),($1,$3,'research_analyst'),($1,$4,'designer'),($1,$4,'publisher'),($1,$4,'reviewer')`,
      [fixture.organizationId, fixture.people.designerA, fixture.people.designerB, fixture.people.publisher]
    );
    await owner.query(
      "INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'operator')",
      [fixture.organizationId, fixture.people.portalOperator]
    );
    await owner.query(
      "INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'reviewer')",
      [fixture.organizationId, fixture.people.finalReviewer]
    );
    await owner.query(
      "INSERT INTO studio.simulation_projects(id,organization_id,title,created_by) VALUES ($1,$2,'PS-150 S1 proof',$3)",
      [fixture.projectId, fixture.organizationId, fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO evidence.research_access_grants
       (id,organization_id,project_id,analyst_person_id,protocol_reference,classification_ceiling,approved_by,expires_at)
       VALUES ('2a000000-0000-4000-8000-000000000790',$1,$2,$3,'PS-790 synthetic protocol','internal',$4,'2099-01-01T00:00:00.000Z')`,
      [fixture.organizationId, fixture.projectId, fixture.people.designerB, fixture.people.operator]
    );
    await owner.query(`INSERT INTO reporting.retention_policies
      (id,organization_id,policy_key,version,scope_type,scope_reference,period_days,legal_hold_behavior,expiry_action,archive_destination,approval_required,created_by)
      VALUES ('2a000000-0000-4000-8000-000000000791',$1,'ps-790-synthetic-retention',1,'organization',$3,365,'retain','archive','institutional-archive',false,$2)`,
    [fixture.organizationId, fixture.people.operator, fixture.organizationId]);
    await owner.query(`INSERT INTO reporting.legal_hold_events
      (id,organization_id,hold_id,action,scope_type,scope_reference,reason,recorded_by)
      VALUES ('2a000000-0000-4000-8000-000000000792',$1,'2a000000-0000-4000-8000-000000000793','placed','organization',$3,'Synthetic PS-790 active hold',$2)`,
    [fixture.organizationId, fixture.people.operator, fixture.organizationId]);
    await owner.query(
      "INSERT INTO studio.drafts(id,organization_id,project_id,document,updated_by) VALUES (gen_random_uuid(),$1,$2,$3::jsonb,$4)",
      [fixture.organizationId, fixture.projectId, JSON.stringify(definition), fixture.people.designerA]
    );
    await owner.query(
      `INSERT INTO studio.project_collaborators(organization_id,project_id,person_id,project_role,added_by) VALUES
       ($1,$2,$3,'owner',$3),($1,$2,$4,'designer',$4),($1,$2,$5,'reviewer',$4),($1,$2,$6,'reviewer',$4)`,
      [fixture.organizationId, fixture.projectId, fixture.people.operator, fixture.people.designerA,
        fixture.people.publisher, fixture.people.finalReviewer]
    );
    await owner.query(
      `INSERT INTO studio.simulation_templates
       (id,organization_id,title,summary,source_project_id,core_design,scenario,published_by)
       VALUES ($1,$2,'Fractured Order Core Design','Synthetic reusable Core Design for PS-710 user testing.',$3,$4::jsonb,$5::jsonb,$6)`,
      [fixture.templateId, fixture.organizationId, fixture.projectId, JSON.stringify(definition.coreDesign),
        JSON.stringify(definition.scenario), fixture.people.publisher]
    );
    await owner.query(
      `INSERT INTO studio.definition_revisions
       (id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
       VALUES ($1,$2,$3,$4::jsonb,$5,'1.3.1',$6)`,
      [fixture.revisionId, fixture.organizationId, fixture.projectId, JSON.stringify(releaseDefinition),
        compiledRelease.contentDigest, fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO registry.releases
       (id,organization_id,project_id,definition_revision_id,release_number,release_label,
        package_schema_version,compiler_version,package_sha256,blob_key,published_by,published_at)
       VALUES ($1,$2,$3,$4,1,'S1 proof 1.0.0','1.0.0','0.1.0',$5,'fixtures/ps-150-release.json',$6,$7)`,
      [fixture.releaseId, fixture.organizationId, fixture.projectId, fixture.revisionId,
        compiledRelease.packageDigest, fixture.people.operator, fixturePublishedAt]
    );
    await owner.query(
      `INSERT INTO studio.definition_revisions
       (id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
       VALUES ($1,$2,$3,$4::jsonb,$5,'1.3.1',$6)`,
      [fixture.activationRevisionId, fixture.organizationId, fixture.projectId, JSON.stringify(activationDefinition),
        compiledActivation.contentDigest, fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO registry.releases
       (id,organization_id,project_id,definition_revision_id,release_number,release_label,
        package_schema_version,compiler_version,package_sha256,blob_key,published_by,published_at)
       VALUES ($1,$2,$3,$4,2,'S1 proof 1.1.0','1.0.0','0.1.0',$5,'fixtures/ps-420-release.json',$6,$7)`,
      [fixture.activationReleaseId, fixture.organizationId, fixture.projectId, fixture.activationRevisionId,
        compiledActivation.packageDigest, fixture.people.operator, fixturePublishedAt]
    );
    for (const [releaseId, compiled] of [[fixture.releaseId, compiledRelease], [fixture.activationReleaseId, compiledActivation]]) {
      await owner.query(`INSERT INTO registry.release_approvals
        (id,organization_id,release_id,approver_person_id,decision,notes,decided_at)
        VALUES (gen_random_uuid(),$1,$2,$3,'approved','Synthetic fixture approval',$4)`,
      [fixture.organizationId, releaseId, fixture.people.publisher, fixturePublishedAt]);
      await owner.query(`INSERT INTO registry.package_manifests
        (id,organization_id,release_id,contract_id,manifest,manifest_sha256,package_sha256,publication_status,publication_controls)
        VALUES (gen_random_uuid(),$1,$2,'package-import-v1',$3::jsonb,$4,$5,'published',$6::jsonb)`,
      [fixture.organizationId, releaseId, JSON.stringify(compiled.release.manifest), compiled.manifestDigest,
        compiled.packageDigest, JSON.stringify({ approvedBy: [fixture.people.publisher], approvalNotes: "Synthetic fixture approval" })]);
    }
    await owner.query(
      `INSERT INTO runtime.sessions(id,organization_id,project_id,initial_release_id,status,created_by,title)
       VALUES ($1,$2,$3,$4,'active',$5,'PS-150 S1 proof Session')`,
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
       (organization_id,session_id,governing_release_id,access_policy,session_code_sha256,assignment_version,configured_by)
       VALUES ($1,$2,$3,$4::jsonb,$5,1,$6)`,
      [fixture.organizationId, fixture.sessionId, fixture.releaseId, JSON.stringify(releaseDefinition.coreDesign.accessPolicy),
        createHash("sha256").update(fixture.sessionCode).digest("hex"), fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO identity.session_invitations
       (id,organization_id,session_id,token_sha256,recipient_person_id,expires_at,issued_by)
       VALUES ($1,$2,$3,repeat('7',64),$4,'2099-01-01T00:00:00.000Z',$5)`,
      [fixture.invitationId, fixture.organizationId, fixture.sessionId, fixture.people.invitedParticipant, fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO runtime.session_operators(organization_id,session_id,person_id,assigned_by)
       VALUES ($1,$2,$3,$3),($1,$2,$4,$3)`,
      [fixture.organizationId, fixture.sessionId, fixture.people.operator, fixture.people.portalOperator]
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
      `INSERT INTO reporting.research_consents
       (id,organization_id,session_id,participant_id,purpose_label,consent_version,decision,recorded_by)
       SELECT gen_random_uuid(),$1,$2,participant.id,'PS-790 research test','1','granted',$3
         FROM runtime.participants participant WHERE participant.organization_id=$1 AND participant.session_id=$2`,
      [fixture.organizationId, fixture.sessionId, fixture.people.operator]
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
      pendingArtifact: "24000000-0000-4000-8000-000000000790", trustRoot: "24000000-0000-4000-8000-000000000791",
      revocations: "24000000-0000-4000-8000-000000000792", license: "24000000-0000-4000-8000-000000000793",
      compositionRun: "24000000-0000-4000-8000-000000000005", modelRun: "24000000-0000-4000-8000-000000000006",
      stateValue: "24000000-0000-4000-8000-000000000007", proposal: "24000000-0000-4000-8000-000000000008"
    };
    const artifactDigest = `sha256:${"3".repeat(64)}`;
    const configurationDigest = `sha256:${"4".repeat(64)}`;
    const inputDigest = `sha256:${"5".repeat(64)}`;
    const outputDigest = `sha256:${"6".repeat(64)}`;
    const publisherKeys = generateKeyPairSync("ed25519");
    const revocationKeys = generateKeyPairSync("ed25519");
    const publisherKeyId = "ps-790-publisher-key-1";
    const revocationKeyId = "ps-790-revocation-key-1";
    const publicKeyPem = publisherKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
    const revocationPublicKeyPem = revocationKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
    const pluginBytes = new TextEncoder().encode("export default function syntheticPs790Plugin() { return { score: 1 }; }\n");
    const schemaBytes = new TextEncoder().encode('{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}');
    const sbomBytes = new TextEncoder().encode('{"bomFormat":"CycloneDX","specVersion":"1.5","version":1}');
    const pluginManifest = {
      contractId: "plugin-manifest-v1", manifestVersion: "1.0.0", pluginId: "org.ssg.fixtures.pending", version: "1.0.0",
      digest: pluginDigest(pluginBytes), artifactPath: "plugin/plugin.mjs",
      publisher: { id: extensionIds.publisher, signatureKeyId: publisherKeyId }, categories: ["world_and_simulation"],
      capabilities: ["compute"], execution: { mode: "container", entrypoint: "plugin/plugin.mjs", rootless: true, readOnlyRoot: true },
      connectivity: "offline_capable", contracts: { inputSchema: "schemas/input.json", outputSchema: "schemas/output.json" },
      compatibility: { hostApi: ">=1.0.0 <2.0.0", releaseSchema: ">=1.0.0 <2.0.0" },
      limits: { timeoutSeconds: 5, memoryMiB: 64, cpuMillis: 1000, outputBytes: 4096 }, requestedPermissions: [],
      dataClassificationMaximum: "internal", reproducibility: { deterministic: true, seedInput: "seed" }, dependencies: [],
      provenance: { sourceRevision: "synthetic-ps-790-only", buildSystem: "fixture" }, license: "ps-790-fixture-license-v1"
    };
    const pluginBuilt = createOfflinePluginBundle({ manifest: pluginManifest,
      files: new Map([["plugin/plugin.mjs", pluginBytes], ["schemas/input.json", schemaBytes],
        ["schemas/output.json", schemaBytes], ["sbom/sbom.cdx.json", sbomBytes]]),
      supplyChain: { sbomPath: "sbom/sbom.cdx.json", attestationType: "synthetic-ps-790",
        attestedAt: new Date().toISOString(), vulnerabilities: [], vulnerabilityExceptions: [], license: pluginManifest.license },
      privateKey: publisherKeys.privateKey });
    const revocations = createPluginRevocations({ generatedAt: new Date().toISOString(), publisherId: extensionIds.publisher,
      keyId: revocationKeyId, privateKey: revocationKeys.privateKey });
    const userTestRoot = new URL("../../output/user-test/ps-790/", import.meta.url);
    await mkdir(userTestRoot, { recursive: true });
    await Promise.all([
      writeFile(new URL("ps-790-synthetic-plugin.json", userTestRoot), pluginBuilt.bytes),
      writeFile(new URL("ps-790-revocations.json", userTestRoot), canonicalizeJson(revocations)),
      writeFile(new URL("ps-790-license-terms.txt", userTestRoot), "Synthetic PS-790 fixture license terms. No production rights are implied.\n")
    ]);
    const catalogManifest = (pluginId, digest, capability) => ({
      pluginId, version: "1.0.0", digest, categories: ["world_and_simulation"], capabilities: [capability],
      connectivity: "offline_capable", contracts: { inputSchema: `${pluginId}.input.schema.json`, outputSchema: `${pluginId}.output.schema.json` },
      limits: { timeoutSeconds: 30, memoryMiB: 128, cpuMillis: 1000, outputBytes: 65536 },
      requestedPermissions: capability === "propose_effect" ? ["effects.propose"] : [], dataClassificationMaximum: "confidential",
      dependencies: []
    });
    await owner.query(`INSERT INTO extension.publishers(id,organization_id,principal_id,display_name,signature_key_id,public_key_pem,status,approved_by)
      VALUES ($1,$2,$3,'PS-790 synthetic Publisher',$4,$5,'approved',$6)`,
      [extensionIds.publisher, fixture.organizationId, fixture.people.publisher, publisherKeyId, publicKeyPem, fixture.people.operator]);
    await owner.query(`INSERT INTO extension.trust_roots
      (id,organization_id,publisher_id,publisher_key_id,publisher_public_key_pem,revocation_key_id,revocation_public_key_pem,provisioned_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [extensionIds.trustRoot, fixture.organizationId, extensionIds.publisher,
      publisherKeyId, publicKeyPem, revocationKeyId, revocationPublicKeyPem, fixture.people.operator]);
    await owner.query(`INSERT INTO extension.revocation_lists
      (id,organization_id,publisher_id,trust_root_id,document,document_sha256,generated_at,imported_by)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`, [extensionIds.revocations, fixture.organizationId, extensionIds.publisher,
      extensionIds.trustRoot, JSON.stringify(revocations), pluginDigest(new TextEncoder().encode(canonicalizeJson(revocations))),
      revocations.generatedAt, fixture.people.operator]);
    await owner.query(`INSERT INTO extension.license_acceptances
      (id,organization_id,plugin_id,license,terms_digest,accepted_by)
      VALUES ($1,$2,$3,$4,$5,$6)`, [extensionIds.license, fixture.organizationId, pluginManifest.pluginId,
      pluginManifest.license, pluginDigest(new TextEncoder().encode("Synthetic PS-790 fixture license terms. No production rights are implied.\n")), fixture.people.operator]);
    await owner.query(`INSERT INTO extension.plugin_artifacts
      (id,organization_id,publisher_id,plugin_id,version,digest,manifest_digest,bundle_digest,object_key,manifest,supply_chain,lifecycle_status,submitted_by,approved_by,approved_at)
      VALUES ($1,$2,$3,'org.ssg.fixtures.effect','1.0.0',$4,$5,$6,'fixture',$7::jsonb,'{}','approved',$8,$8,now()),
             ($9,$2,$3,'org.ssg.fixtures.analysis','1.0.0',$10,$11,$12,'fixture-b',$13::jsonb,'{}','approved',$8,$8,now()),
             ($14,$2,$3,'org.ssg.fixtures.pending','1.0.0',$15,$16,$17,$18,$19::jsonb,
              $20::jsonb,'contract_validated',$21,NULL,NULL)`,
      [extensionIds.artifact, fixture.organizationId, extensionIds.publisher, artifactDigest, `sha256:${"8".repeat(64)}`, `sha256:${"9".repeat(64)}`,
        JSON.stringify(catalogManifest("org.ssg.fixtures.effect", artifactDigest, "propose_effect")), fixture.people.operator,
        extensionIds.artifactB, `sha256:${"c".repeat(64)}`, `sha256:${"d".repeat(64)}`, `sha256:${"f".repeat(64)}`,
        JSON.stringify(catalogManifest("org.ssg.fixtures.analysis", `sha256:${"c".repeat(64)}`, "compute")),
        extensionIds.pendingArtifact, pluginBuilt.bundle.manifest.digest, pluginBuilt.manifestDigest, pluginBuilt.bundleDigest,
        `plugins/${pluginManifest.pluginId}/${pluginManifest.version}/${pluginBuilt.bundleDigest.slice("sha256:".length)}.json`,
        JSON.stringify(pluginBuilt.bundle.manifest), JSON.stringify(pluginBuilt.bundle.supplyChain), fixture.people.publisher]);
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
    await owner.query(
      `INSERT INTO runtime.sessions(id,organization_id,project_id,initial_release_id,status,created_by,title)
       VALUES ($1,$2,$3,$4,'open',$5,'PS-780 Operator Control Exercise')`,
      [fixture.operatorSessionId, fixture.organizationId, fixture.projectId, fixture.activationReleaseId, fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO runtime.session_authorities(session_id,organization_id,deployment_id,authority_epoch,status)
       VALUES ($1,$2,$3,1,'active')`, [fixture.operatorSessionId, fixture.organizationId, fixture.deploymentId]
    );
    await owner.query(
      `INSERT INTO runtime.release_activations
       (id,organization_id,project_id,session_id,release_id,activation_sequence,compatibility_policy,approved_by)
       VALUES ('17000000-0000-4000-8000-000000000780',$1,$2,$3,$4,1,'{}',$5)`,
      [fixture.organizationId, fixture.projectId, fixture.operatorSessionId, fixture.activationReleaseId, fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO runtime.session_access_configs
       (organization_id,session_id,governing_release_id,access_policy,assignment_version,configured_by)
       VALUES ($1,$2,$3,$4::jsonb,1,$5)`,
      [fixture.organizationId, fixture.operatorSessionId, fixture.activationReleaseId, JSON.stringify(releaseDefinition.coreDesign.accessPolicy), fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO runtime.session_operators(organization_id,session_id,person_id,assigned_by)
       VALUES ($1,$2,$3,$3),($1,$2,$4,$3)`,
      [fixture.organizationId, fixture.operatorSessionId, fixture.people.operator, fixture.people.portalOperator]
    );
    for (const seat of releaseDefinition.coreDesign.seats) {
      await owner.query(
        `INSERT INTO runtime.session_seats
         (organization_id,session_id,seat_id,session_role_ids,team_id,min_occupancy,max_occupancy,required,join_mode)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [fixture.organizationId, fixture.operatorSessionId, seat.id, seat.sessionRoleIds, seat.teamId ?? null,
          seat.minOccupancy, seat.maxOccupancy, seat.required, seat.joinMode]
      );
    }
    await owner.query(
      `INSERT INTO runtime.participants(id,organization_id,session_id,person_id)
       VALUES ('32000000-0000-4000-8000-000000000780',$1,$2,$3)`,
      [fixture.organizationId, fixture.operatorSessionId, fixture.people.author]
    );
    await owner.query(
      `INSERT INTO runtime.seat_assignments
       (id,organization_id,session_id,participant_id,session_role_id,seat_id,assigned_by)
       VALUES ('42000000-0000-4000-8000-000000000780',$1,$2,'32000000-0000-4000-8000-000000000780','scribe','blue-scribe',$3)`,
      [fixture.organizationId, fixture.operatorSessionId, fixture.people.operator]
    );
    await owner.query(
      `INSERT INTO runtime.participant_access_revisions(organization_id,session_id,participant_id)
       VALUES ($1,$2,'32000000-0000-4000-8000-000000000780')`,
      [fixture.organizationId, fixture.operatorSessionId]
    );
    for (const check of releaseDefinition.coreDesign.accessPolicy.readiness) {
      await owner.query(
        `INSERT INTO runtime.session_readiness_checks
         (organization_id,session_id,check_key,label,blocking,governing_release_id,assignment_version,completed_by,completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,1,$7,now())`,
        [fixture.organizationId, fixture.operatorSessionId, check.key, check.label, check.blocking, fixture.activationReleaseId, fixture.people.operator]
      );
    }
    await owner.query(
      "INSERT INTO evidence.session_sequences(session_id,organization_id) VALUES ($1,$2)",
      [fixture.operatorSessionId, fixture.organizationId]
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
