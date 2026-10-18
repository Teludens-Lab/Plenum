import { Pool, type PoolClient } from "pg";

const databaseRole = process.env.PLENUM_DB_ROLE ?? "plenum_app";
if (!/^[a-z_][a-z0-9_]*$/u.test(databaseRole)) {
  throw new Error("PLENUM_DB_ROLE must be a simple lower-case role name");
}

export function createDatabasePool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

export async function withOrganizationTransaction<T>(
  pool: Pool,
  organizationId: string,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL ROLE ${databaseRole}`);
    await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original transaction failure.
    }
    throw error;
  } finally {
    client.release();
  }
}
