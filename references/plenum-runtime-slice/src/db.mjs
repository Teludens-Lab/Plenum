import pg from 'pg';

const {Pool} = pg;

// bigint columns (versions, sequences, epochs) come back as numbers; values stay far below 2^53.
pg.types.setTypeParser(20, (value) => Number(value));

// Requests run as the non-owner application role so row-level security applies (ADR-015).
// In production the application connects as a LOGIN role with these grants; locally the
// migration owner switches to it with SET LOCAL ROLE.
const dbRole = process.env.PLENUM_DB_ROLE || 'plenum_app';
if (!/^[a-z_][a-z0-9_]*$/.test(dbRole)) throw new Error('PLENUM_DB_ROLE must be a simple lower-case role name');

export const pool = new Pool({connectionString: process.env.DATABASE_URL || 'postgres://plenum_owner:local-only@127.0.0.1:5432/plenum'});

export async function tx(org, fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SET LOCAL ROLE ${dbRole}`);
    await c.query("SELECT set_config('app.organization_id', $1, true)", [org]);
    const value = await fn(c);
    await c.query('COMMIT');
    return value;
  } catch (e) {
    try { await c.query('ROLLBACK'); } catch { /* connection already failed; original error is reported */ }
    throw e;
  } finally {
    c.release();
  }
}
