# Backup and recovery

The backup contains a PostgreSQL custom-format dump, every object in the configured S3 bucket, trusted Evidence public keys, and independent anchor receipts. Payload files are encrypted independently with AES-256-GCM. The encryption key is supplied by file and identified in the manifest by an external key reference; it is never stored in the backup or repository.

## Backup

Set `DATABASE_URL`, the `S3_*` variables, `PLENUM_BACKUP_DIRECTORY`, `PLENUM_BACKUP_ENCRYPTION_KEY_FILE`, `PLENUM_TRUSTED_PUBLIC_KEYS_FILE`, `PLENUM_INDEPENDENT_ANCHORS_FILE`, `PLENUM_BACKUP_KEY_REFERENCE`, and `PLENUM_DEPLOYMENT_PROFILE`, then run:

```text
node scripts/backup-deployment.mjs
```

The destination directory must not already exist. Copy the resulting encrypted directory to institution-controlled backup storage separate from the database, application hosts, signing key custody, and independent anchor custodian. `recoveryPointAt` is the database snapshot start and `rpoSeconds` is its age when the backup finishes; monitor it against the approved 900-second target and schedule backups at least every 15 minutes.

## Disposable restore drill

Provision an empty PostgreSQL database and an empty S3 bucket. Set the source backup variables plus `DATABASE_RESTORE_URL`, `S3_RESTORE_*`, and `PLENUM_DISPOSABLE_RESTORE=1`, then run:

```text
node scripts/restore-deployment.mjs
```

The restore refuses a nonempty database, a nonempty object bucket, or a target not explicitly marked disposable. It checks encrypted-file and plaintext-object digests, restores the database and objects, and independently verifies every restored signed Evidence checkpoint. A PASS records RPO, RTO, object count, and verified Session count in `restore-evidence.json`.

Run `npm run test:backup-restore` quarterly and before every major production release. The isolated drill must remain at RPO <=15 minutes and RTO <=4 hours. Production recovery requires an authorized incident procedure and separate approval; these scripts intentionally do not perform a destructive production restore.

Partial failures are safe to retry only with new empty targets. If `pg_restore`, object upload, or Evidence verification fails, discard the disposable targets, retain the failure logs, correct the cause, and start again. Never treat a partly restored target as serviceable.

