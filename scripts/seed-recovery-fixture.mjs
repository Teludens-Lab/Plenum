import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { CreateBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Pool } from "pg";
import { createDueEvidenceCheckpoint } from "../apps/server/dist/index.js";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const migrations = [
  ...["001_core", "002_runtime_sync_evidence", "003_collaboration", "004_security"].map((name) => `references/plenum-runtime-slice/migrations/${name}.sql`),
  ...["005_identity_oidc_context", "006_command_kernel", "007_release_packages", "008_projection_cursors", "009_runtime_capabilities",
    "010_information_messages_injects", "011_extension_registry", "012_extension_runs_approvals", "013_voting_core", "014_comms_voice_core",
    "015_collaboration_runtime", "016_voice_consent_assets", "017_session_access", "018_identity_roles_and_governance", "019_world_state_automation",
    "020_adjudication_records", "021_live_release_activation", "022_offline_devices", "023_evidence_checkpoints", "024_reporting_research",
    "025_security_retention_enforcement", "026_product_portal", "027_release_session_catalog", "028_content_library",
    "030_template_review_governance", "032_operations_administration", "033_platform_control_plane",
    "034_platform_onboarding_operations", "035_platform_administrator_workforce",
    "036_organization_identity_providers", "037_organization_workforce", "038_identity_workforce_operations"]
    .map((name) => `apps/server/migrations/${name}.sql`)
];
const ids = {
  organization: "53000000-0000-4000-8000-000000000001", person: "53000000-0000-4000-8000-000000000002",
  project: "53000000-0000-4000-8000-000000000003", revision: "53000000-0000-4000-8000-000000000004",
  release: "53000000-0000-4000-8000-000000000005", session: "53000000-0000-4000-8000-000000000006",
  deployment: "53000000-0000-4000-8000-000000000007", event: "53000000-0000-4000-8000-000000000008"
};
const pool = new Pool({ connectionString: required("DATABASE_URL"), max: 1 });
try {
  for (const migration of migrations) await pool.query(await readFile(migration, "utf8"));
  const objectKey = `releases/${ids.organization}/${ids.release}.json`;
  const objectBytes = Buffer.from('{"contractId":"synthetic-recovery-release-v1"}\n');
  await pool.query("BEGIN");
  try {
    await pool.query("INSERT INTO identity.organizations(id,name) VALUES ($1,'PS-530 synthetic recovery organization')", [ids.organization]);
    await pool.query("INSERT INTO identity.persons(id,display_name) VALUES ($1,'Synthetic recovery operator')", [ids.person]);
    await pool.query("INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'admin'),($1,$2,'operator')", [ids.organization, ids.person]);
    await pool.query("INSERT INTO studio.simulation_projects(id,organization_id,title,created_by) VALUES ($1,$2,'PS-530 recovery drill',$3)", [ids.project, ids.organization, ids.person]);
    await pool.query(`INSERT INTO studio.definition_revisions
      (id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
      VALUES ($1,$2,$3,'{}',repeat('a',64),'1.3.1',$4)`, [ids.revision, ids.organization, ids.project, ids.person]);
    await pool.query(`INSERT INTO registry.releases
      (id,organization_id,project_id,definition_revision_id,release_number,release_label,package_schema_version,compiler_version,package_sha256,blob_key,published_by)
      VALUES ($1,$2,$3,$4,1,'PS-530 recovery 1.0.0','1.0.0','0.1.0',repeat('b',64),$5,$6)`,
    [ids.release, ids.organization, ids.project, ids.revision, objectKey, ids.person]);
    await pool.query(`INSERT INTO runtime.sessions(id,organization_id,project_id,initial_release_id,status,created_by)
      VALUES ($1,$2,$3,$4,'completed',$5)`, [ids.session, ids.organization, ids.project, ids.release, ids.person]);
    await pool.query(`INSERT INTO runtime.session_authorities(session_id,organization_id,deployment_id,authority_epoch,status)
      VALUES ($1,$2,$3,1,'active')`, [ids.session, ids.organization, ids.deployment]);
    await pool.query("INSERT INTO evidence.session_sequences(session_id,organization_id,next_sequence) VALUES ($1,$2,2)", [ids.session, ids.organization]);
    await pool.query(`INSERT INTO evidence.events
      (id,organization_id,session_id,sequence,event_type,governing_release_id,authority_epoch,body,aggregate_id,aggregate_version)
      VALUES ($1,$2,$3,1,'session.completed',$4,1,$5::jsonb,$3,1)`,
    [ids.event, ids.organization, ids.session, ids.release, JSON.stringify({ releaseId: ids.release, synthetic: true })]);
    await pool.query("COMMIT");
  } catch (error) { await pool.query("ROLLBACK"); throw error; }

  const s3 = new S3Client({ endpoint: required("S3_ENDPOINT"), region: process.env.S3_REGION ?? "us-east-1", forcePathStyle: true,
    credentials: { accessKeyId: required("S3_ACCESS_KEY_ID"), secretAccessKey: required("S3_SECRET_ACCESS_KEY") } });
  const bucket = required("S3_BUCKET");
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: objectKey, Body: objectBytes }));

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicJwk = publicKey.export({ format: "jwk" });
  const keyId = "ps-530-recovery-key-1";
  const anchors = [];
  const checkpoint = await createDueEvidenceCheckpoint(pool, ids.organization, ids.session, {
    async signCheckpoint({ digestBytes }) {
      return { keyId, algorithm: "Ed25519", signature: sign(null, digestBytes, privateKey), publicKeyJwk: publicJwk };
    }
  }, {
    async anchorCheckpoint(input) {
      const receipt = { endpoint: "file://independent-custodian/ps-530", reference: `checkpoint/${input.checkpointId}`,
        anchoredDigest: input.checkpointDigest, keyId };
      anchors.push(receipt);
      return { ...receipt, verificationResult: "verified", recordedAt: new Date() };
    }
  });
  if (checkpoint === null) throw new Error("Synthetic completed Session did not produce an Evidence checkpoint");
  await writeFile(required("PLENUM_TRUSTED_PUBLIC_KEYS_FILE"), `${JSON.stringify({ [keyId]: publicJwk }, null, 2)}\n`, { flag: "wx" });
  await writeFile(required("PLENUM_INDEPENDENT_ANCHORS_FILE"), `${JSON.stringify(anchors, null, 2)}\n`, { flag: "wx" });
  await writeFile(required("PLENUM_BACKUP_ENCRYPTION_KEY_FILE"), randomBytes(32).toString("base64") + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ ...ids, objectKey, checkpointId: checkpoint.checkpointId }));
} finally { await pool.end(); }

