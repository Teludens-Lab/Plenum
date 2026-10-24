import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { restoreDeploymentBackup } from "./deployment-backup-lib.mjs";

const evidence = await restoreDeploymentBackup();
await writeFile(join(process.env.PLENUM_BACKUP_DIRECTORY, "restore-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
console.log(`CMD-BACKUP-RESTORE restore PASS; ${evidence.sessionsVerified} Evidence chains; RTO ${evidence.rtoSeconds}s`);
