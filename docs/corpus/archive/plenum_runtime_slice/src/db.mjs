import pg from 'pg';
const {Pool}=pg; export const pool=new Pool({connectionString:process.env.DATABASE_URL||'postgres://plenum_owner:local-only@127.0.0.1:5432/plenum'});
export async function tx(org,fn){const c=await pool.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('app.organization_id',$1,true)",[org]);const v=await fn(c);await c.query('COMMIT');return v;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
