import { randomUUID } from "node:crypto";

import { Pool } from "pg";

const personIndex = process.argv.indexOf("--person-id");
const personId = personIndex === -1 ? undefined : process.argv[personIndex + 1];
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required");
if (personId === undefined || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(personId)) {
  throw new Error("Usage: node scripts/bootstrap-platform-administrator.mjs --person-id <uuid>");
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
try {
  const result = await pool.query(
    "SELECT identity.bootstrap_platform_administrator($1,$2) AS bootstrapped",
    [personId, randomUUID()]
  );
  if (result.rows[0]?.bootstrapped !== true) {
    throw new Error("Bootstrap refused: a Platform Administrator already exists, or the Person is not an active Organization Admin.");
  }
  process.stdout.write(`Bootstrapped Platform Administrator ${personId}. An immutable platform audit record was written.\n`);
} finally {
  await pool.end();
}
