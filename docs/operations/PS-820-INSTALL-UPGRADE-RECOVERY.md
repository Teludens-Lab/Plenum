# PS-820 install, upgrade and recovery runbook

This runbook covers disposable acceptance rehearsal for the cloud-reference, institutional and air-gapped profiles. It does not authorize production mutation, schema rollback, provider activation or use of production data.

## BA-08 Model Run availability gate

Model Runs remain disabled by default. Check **Administration → Plugin operations** or the authorized `/v1/operations/plugins` response: `executor_not_configured` means no socket configuration; `executor_unavailable` means the configured supervisor is unhealthy/unreachable; `plans_not_configured` applies to an empty injected registry. `configured` describes the executor connection, never eligibility of a particular plan. Studio shows the same status. Missing metadata or a failed check is unverified. Approval and installation alone do not enable execution.

The owner approved implementation and synthetic testing of the [BA-08 constrained boundary](../ps-230-verification.md#ba-08-governed-production-model-runs--2026-11-11). Production activation and formal Security Owner review remain separate. Do not mount Docker control in the application or substitute direct host execution. Finding 7 remains open until the actual supported-profile acceptance test passes.

For an approved Linux rehearsal:

1. Provision a dedicated service account with rootless Docker, delegated **cgroup v2 memory, CPU quota and process controls**, and the exact cached image `node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f`. A non-root workload on a rootful daemon, or rootless Docker without cgroup delegation, does not qualify. The supervisor checks these controls before opening its socket and again before execution. No image pull occurs during a run.
2. Install the built repository and locked production dependencies read-only at `/opt/plenum`. Verify `/usr/bin/node` is the supported Node 24 runtime. Use `deploy/compose/plenum-extension-host.service` as a **user-service template** for that account. Its private staging directory is owned by the service UID, mode 0700. Its socket directory is mode 0750 and socket 0660; the dedicated primary group grants only the application access. Validate effective host/container GID mapping. Do not use world-writable permissions or share this account's Docker daemon with other workloads.
3. After supervisor startup, use the optional `deploy/compose/extension-host.yaml` override with `PLENUM_EXTENSION_SOCKET_DIRECTORY` and `PLENUM_EXTENSION_SOCKET_GID`. It mounts only the pre-existing socket directory and sets `PLENUM_EXTENSION_SOCKET=/run/plenum-extension/host.sock`. The application receives no Docker socket, CLI authority, staging directory or Plugin credentials. There is no TCP supervisor listener. Keep the default profile unconfigured until its acceptance gate is met.
4. Apply additive migration **047_model_run_work_queue.sql** before startup. It indexes only pending/running records; it changes no domain fields, privileges or historical rows. Budget the ordinary index-build write lock for existing deployments. Previous code remains schema-compatible; roll back code/configuration after draining attempts, leave the index, and forward-fix. Never down-migrate evidence.
5. The immutable Release composition must contain an explicit validated `executionPolicy` (seed, trigger Session Roles and allowed state-variable/scope/operation effects). Its approval-gate Roles are the reviewers. This executor supports one model and one approval gate, with optional output nodes, offline execution and no dependencies. Other graphs are unavailable. Bindings map `state.<stateVariableId>` to schema input keys with an optional exact `scopeReference`; the current actor's information policy and classification ceiling filter every mapped input/effect target. `cloud/institutional/air_gapped` map to registry `connected/self_hosted/air_gapped`. No environment-supplied plan map or arbitrary artifact path is accepted.
6. Run `PLENUM_TEST_EXTENSION_SOCKET=<actual socket> npm run test:integration` against named disposable PostgreSQL/S3 endpoints on that Linux host. The explicit BA-08-T01 test launches **profile-service.mjs**, stores a freshly signed synthetic artifact, starts a Command, waits for production scheduling, reviews/approves its proposal, and replays Commands after process restart. It does not replace the supervisor. Without that variable, this test reports NOT RUN; the separately labelled transport harness does not close T01. Repeat for each activated deployment profile before release.

BA-05 discovery owns tenant eligibility and the designated Admin service actor. The feature worker claims at most two local runs at once, with 128 pending/running runs per Organization, two pending candidates and sixteen expired attempts per tenant visit. The supervisor admits at most two executions, four IPC connections and no waiting queue. SDK ceilings remain 512 MiB bundle, 1 MiB input snapshot, 300 seconds execution, 4096 MiB per container and 10 MiB output; size host memory/storage for two bundles plus parsing/staging overhead and two containers. These are arithmetic bounds, not measured supported-profile capacity. Requests do not hold database transactions over object storage or execution.

Every attempt rechecks current Plugin trust, installation, original actor authentication/assignment, Release, Authority Epoch, tenant job authority and frozen target versions before staging output. Approval rechecks current Plugin trust and uses existing proposal hash/version/receipt enforcement. A completion stages proposals only; it never applies state automatically. Completion/failure and proposal staging append Evidence/outbox events atomically; Runtime's existing authorized proposal synchronization refreshes the review view.

On failure, inspect authorized Session extension provenance (`status`, `failure_code`, immutable pins), the existing `model_execution` telemetry category and tenant-job readiness. An unavailable configured supervisor degrades readiness; absent configuration remains an explicit capability gate. Pending work remains durable. Running attempts older than six minutes are terminally failed in batches of sixteen; late output cannot revive them. Do not reset failed rows to pending: after review, submit a new Run/Command ID. A retry of the original Command replays its receipt. No automatic ambiguous computation retry or effect reapplication occurs.

Shutdown stops claims and drains in-flight work before closing pools. Both supplied service templates allow seven minutes; an externally forced kill is handled by durable recovery. Supervisor restart confirms that a prior supervisor is dead, removes at most two labelled orphan containers, then removes their private staging directories. More orphans, unsafe custody, live PID/socket ownership or unconfirmed termination fail closed for operator investigation. Cleanup uncertainty makes the supervisor unavailable and preserves staging; never delete it before confirming the container stopped. Logs contain no input, audio, credential or Plugin output bytes.

## Preconditions

- Node 24 or newer, the locked root dependency tree and Docker are installed.
- The candidate application image and the named prior staging image are available locally.
- PostgreSQL is version 18. Synthetic fixtures and isolated object storage are mandatory.
- Record the candidate commit, image ID, prior image ID, operator and evidence location before execution.

External identity, notification and alert providers are not required for this disposable install/recovery rehearsal. Their independent acceptance remains recorded under PS-810 and PS-815.

## Clean install and upgrade

Run `npm run test:clean-install` from the repository root. The command:

1. builds the candidate image without pulling dependencies;
2. creates an empty disposable PostgreSQL 18 database;
3. applies the prior image's migration set and starts that image;
4. inserts representative Organization data;
5. applies only the candidate's later additive migrations;
6. verifies data preservation and the expected current schema;
7. starts the prior image again against the expanded schema;
8. starts the candidate image under cloud, institutional and air-gapped profile configuration; and
9. removes its application, database, network and candidate-image tag.

The evidence artifact is `test-results/clean-install/ps-820-clean-install.json`.

## Rollback and forward-fix

BA-04 migration 044 is additive, but the old application's Floor grant path does not honor pending provider revocations. Drain old instances before applying it and keep radio traffic closed until the new worker reconciles legacy leases. Schema compatibility is not permission for mixed-version radio operation or rollback to the vulnerable grant path; see the [Floor reconciliation runbook](PS-810-OBSERVABILITY-SECURITY.md#radio-floor-provider-reconciliation--ba-04).

Schema rollback is prohibited. Before a production upgrade, take and verify an encrypted backup. If the prior application remains compatible with the additive schema, redeploy its exact pinned image while preparing a forward-fix. If compatibility is not proven, keep the candidate stopped and forward-fix from the documented backup state. Never down-migrate persistent production data merely to match older code.

## Backup and recovery rehearsal

Run `npm run test:backup-restore` only against named disposable PostgreSQL and S3-compatible endpoints. The command refuses a restore unless `PLENUM_DISPOSABLE_RESTORE=1`, encrypts the database and object backup, keeps trust keys and independent anchors separate, restores into empty targets, and verifies the Evidence chain.

The approved objectives are RPO no greater than 15 minutes and RTO no greater than four hours. Evidence is written to `test-results/recovery/ps-530-restore.json`.

## Air-gapped profile

Run `npm run test:airgap`. It must use cached digest-pinned images, a read-only root filesystem, a non-root user and no network. External-required Plugins must fail closed unless a verified local replacement is present.

## Desktop accessibility

Run `npm run test:a11y` for automated keyboard, semantic and Axe coverage. Complete `docs/design/user-test/PS-820-script.md` separately with qualified Windows/macOS desktop testers and named assistive technology. Automated evidence cannot replace that human record.
# BA-10 Evidence signing and anchor activation

BA-10's AWS bridge is optional and **not activated by repository presence**. Before use, the accountable Operations/Security owners must identify an existing institution-controlled Ed25519 signing key, approve separately controlled anchor custody and distribute trusted public verification keys. Merely hosting Plenum on AWS or enabling ordinary bucket versioning does not satisfy OPEN-014/017. No private key, new key issuance or rotation is authorized by this implementation.

Configuration uses `PLENUM_EVIDENCE_KEY_ARN` (exact KMS key ARN, not an alias), `PLENUM_TRUSTED_PUBLIC_KEYS_FILE` (existing key-ID-to-public-JWK trust-file format), `PLENUM_EVIDENCE_REGION`, `PLENUM_EVIDENCE_ANCHOR_BUCKET` and `PLENUM_EVIDENCE_ANCHOR_ACCOUNT`. All must be present when activation is configured. The anchor bucket must differ from the application bucket. SDK credentials come from the deployment's established workload identity; never put private key material in environment variables or files. Partial configuration fails startup. Absent configuration leaves due work visibly incomplete and degrades readiness; it never substitutes a local signer.

The signing key must support `ED25519_SHA_512`; the adapter sends the checkpoint's SHA-256 digest bytes with `MessageType=RAW`. Public verification keys must come from the approved trust-distribution process, not an untrusted export. KMS signing permission does not imply key-administration permission. Application writes, signer administration, anchor administration and restore authority require the separation specified in OPEN-017. A separately administered AWS account is one way to establish anchor custody; code alone cannot verify organizational ownership. The AWS implementation is unsupported in `air_gapped` mode; offline close/daily transfer remains unimplemented and blocked pending an approved adapter.

The custodian bucket needs versioning and S3 Object Lock support for seven-year Compliance retention. The application needs narrowly scoped conditional object creation/read/retention-inspection rights under `plenum-checkpoints/`; it must not control bucket policy, key policy, retention reduction, deletion or custodian administration. Live permissions, retention, region, cost and ownership require review before any real writes. Compliance retention is intentionally not removable early; this task does not create or configure a bucket. AWS documentation: [KMS Ed25519 support](https://aws.amazon.com/about-aws/whats-new/2025/11/aws-kms-edwards-curve-digital-signature-algorithm/), [Sign request semantics](https://docs.aws.amazon.com/kms/latest/APIReference/API_Sign.html), [S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html).

For each golden Session, an authenticated current Organization Admin obtains `GET /v1/sessions/{sessionId}/evidence/verification`. The auditor obtains the approved public-key file independently and retrieves the precise S3 object versions named in the export from custodian-controlled access. Construct the existing independent-anchor file with `endpoint`, `reference`, `anchoredDigest`, `keyId` from those retrieved records; do not copy claimed receipts out of PostgreSQL and call them independent. Run `node scripts/verify-evidence.mjs <export.json> <trusted-public-keys.json> <independent-anchors.json>` outside the application. Retain the candidate, public key identifiers, exact custodian object versions, verifier output and negative tamper/omission/reordering results. Both original and Energy live Sessions must pass; the PS-840 exception does not waive this PS-850 requirement.

Investigate `organization_jobs_checkpoints` failures through the tenant-scoped `operations.evidence_checkpoint_work` journal: `last_failure`, `attempts`, `retry_at` and the presence/absence of a public signature distinguish signing from anchoring failure. Never log signature input bodies, credentials or private keys. Fix provider access/custody and let the bounded worker retry; do not discard the frozen range. Claims expire after 60 seconds; effects time out after ten seconds; retry delay grows from five seconds to five minutes. A timeout may have succeeded externally, so the retry checks the exact immutable anchor before recording completion. Missing/corrupt history or an anchor-content conflict requires investigation, not a new range or overwritten object.

Full database backup preserves pending work; paired object and independently held trust/anchor evidence remain required. Logical archives with pending work use `plenum-048` and need the updated importer; complete/legacy archives remain readable. Deploy migration 048 before the worker and stop older producers during transition. On rollback preserve journal and proof tables for forward fix. No actual AWS custody, live-golden verification or human release approval is implied by the local BA-10 harness.
