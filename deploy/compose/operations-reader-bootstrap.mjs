import { readFile } from "node:fs/promises";

import pg from "pg";

import { readOperationsSecretBundle } from "./operations-secrets.mjs";

const { Pool } = pg;
const operations = await readOperationsSecretBundle();
const administratorPassword = (await readFile("/run/secrets/postgres-password", "utf8")).trim();
if (administratorPassword === "") throw new Error("The PostgreSQL administrator secret is empty.");

const pool = new Pool({
  connectionString: `postgres://plenum:${encodeURIComponent(administratorPassword)}@database:5432/plenum`,
  max: 1,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000
});

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const capability = await client.query(
      "SELECT 1 FROM pg_roles WHERE rolname='plenum_operations_evidence_reader'"
    );
    if (capability.rowCount !== 1) throw new Error("Migration 040 has not created the operations reader capability.");
    await client.query(`DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='plenum_operations') THEN
          CREATE ROLE plenum_operations LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
            INHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3;
        END IF;
      END
      $$`);
    const formatted = await client.query(
      "SELECT format('ALTER ROLE plenum_operations PASSWORD %L', $1::text) AS statement",
      [operations.DATABASE_PASSWORD]
    );
    await client.query(formatted.rows[0].statement);
    await client.query("ALTER ROLE plenum_operations SET default_transaction_read_only = on");
    await client.query("ALTER ROLE plenum_operations SET statement_timeout = '10s'");
    await client.query("ALTER ROLE plenum_operations SET lock_timeout = '2s'");
    await client.query("GRANT plenum_operations_evidence_reader TO plenum_operations");
    await client.query("COMMIT");
    console.info("Operational security evidence reader configured.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
