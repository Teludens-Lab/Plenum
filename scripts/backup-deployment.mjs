import { createDeploymentBackup } from "./deployment-backup-lib.mjs";

const manifest = await createDeploymentBackup();
console.log(`CMD-BACKUP-RESTORE backup PASS; ${manifest.objects.length} objects; RPO ${manifest.rpoSeconds}s`);
