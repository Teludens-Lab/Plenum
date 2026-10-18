// Forward-only migration runner. Applies each file in migrations/ once, in name order,
// inside its own transaction, under an advisory lock so two runners cannot interleave.
import {pool} from './db.mjs';
import {readFile, readdir} from 'node:fs/promises';

const dir = new URL('../migrations/', import.meta.url);
const q = await pool.connect();
try {
  await q.query('SELECT pg_advisory_lock(7218831)');
  await q.query('CREATE SCHEMA IF NOT EXISTS app_migrations');
  await q.query('CREATE TABLE IF NOT EXISTS app_migrations.applied(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  for (const name of (await readdir(dir)).filter((n) => n.endsWith('.sql')).sort()) {
    if ((await q.query('SELECT 1 FROM app_migrations.applied WHERE name=$1', [name])).rowCount) continue;
    await q.query('BEGIN');
    try {
      await q.query(await readFile(new URL(name, dir), 'utf8'));
      await q.query('INSERT INTO app_migrations.applied(name) VALUES($1)', [name]);
      await q.query('COMMIT');
      console.log('Applied', name);
    } catch (e) {
      await q.query('ROLLBACK');
      console.error('Failed', name, '-', e.message);
      throw e;
    }
  }
} finally {
  await q.query('SELECT pg_advisory_unlock(7218831)');
  q.release();
  await pool.end();
}
