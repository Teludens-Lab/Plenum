import {tx,pool} from './db.mjs';import {id} from './domain.mjs';
const org=process.env.DEMO_ORG_ID||id();const users={designer:id(),publisher:id(),operator:id(),scribe:id(),facilitator:id(),white_cell:id()};
await tx(org,async c=>{
 await c.query('INSERT INTO identity.organizations(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING',[org,'Local Development Organization']);
 for(const [role,user] of Object.entries(users))await c.query('INSERT INTO identity.memberships(organization_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[org,user,role]);
});await pool.end();console.log(JSON.stringify({organizationId:org,users},null,2));
