import { randomUUID } from "node:crypto";

import { Pool } from "pg";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const actorPersonId = argument("--actor-person-id");
const targetPersonId = argument("--target-person-id");
const reason = argument("--reason");
const incidentReference = argument("--incident-ref");
const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl === undefined) throw new Error("DATABASE_URL is required");
if (actorPersonId === undefined || !uuid.test(actorPersonId) || targetPersonId === undefined || !uuid.test(targetPersonId) ||
    reason === undefined || reason.trim().length < 10 || incidentReference === undefined || incidentReference.trim().length < 3) {
  throw new Error("Usage: node scripts/recover-platform-administrator.mjs --actor-person-id <uuid> --target-person-id <uuid> --reason <10+ characters> --incident-ref <reference>");
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
try {
  const result = await pool.query(
    "SELECT identity.break_glass_recover_platform_administrator($1,$2,$3,$4,$5) AS recovered",
    [actorPersonId, targetPersonId, reason.trim(), incidentReference.trim(), randomUUID()]
  );
  if (result.rows[0]?.recovered !== true) {
    throw new Error("Break-glass recovery refused: verify distinct people, an eligible recovery actor and linked target, and fewer than two active Platform Administrators.");
  }
  process.stdout.write(`Recovered Platform Administrator ${targetPersonId}. Existing home-Organization sessions were revoked and an immutable audit record was written.\n`);
} finally {
  await pool.end();
}
