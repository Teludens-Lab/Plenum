# PS-820 install, upgrade and recovery runbook

This runbook covers disposable acceptance rehearsal for the cloud-reference, institutional and air-gapped profiles. It does not authorize production mutation, schema rollback, provider activation or use of production data.

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

Schema rollback is prohibited. Before a production upgrade, take and verify an encrypted backup. If the prior application remains compatible with the additive schema, redeploy its exact pinned image while preparing a forward-fix. If compatibility is not proven, keep the candidate stopped and forward-fix from the documented backup state. Never down-migrate persistent production data merely to match older code.

## Backup and recovery rehearsal

Run `npm run test:backup-restore` only against named disposable PostgreSQL and S3-compatible endpoints. The command refuses a restore unless `PLENUM_DISPOSABLE_RESTORE=1`, encrypts the database and object backup, keeps trust keys and independent anchors separate, restores into empty targets, and verifies the Evidence chain.

The approved objectives are RPO no greater than 15 minutes and RTO no greater than four hours. Evidence is written to `test-results/recovery/ps-530-restore.json`.

## Air-gapped profile

Run `npm run test:airgap`. It must use cached digest-pinned images, a read-only root filesystem, a non-root user and no network. External-required Plugins must fail closed unless a verified local replacement is present.

## Desktop accessibility

Run `npm run test:a11y` for automated keyboard, semantic and Axe coverage. Complete `docs/design/user-test/PS-820-script.md` separately with qualified Windows/macOS desktop testers and named assistive technology. Automated evidence cannot replace that human record.
