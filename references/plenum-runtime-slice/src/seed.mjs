// Creates one organization, three organization-role holders and three people who will be
// staffed into a Session. Session Roles are not organization roles (DEC-44).
import {tx, pool} from './db.mjs';
import {id} from './domain.mjs';

const org = process.env.DEMO_ORG_ID || id();
const people = {
  designer: {id: id(), name: 'Demo Designer', role: 'designer'},
  publisher: {id: id(), name: 'Demo Publisher', role: 'publisher'},
  operator: {id: id(), name: 'Demo Operator', role: 'operator'},
  scribe: {id: id(), name: 'Demo Scribe', role: null},
  facilitator: {id: id(), name: 'Demo Facilitator', role: null},
  white_cell: {id: id(), name: 'Demo White Cell', role: null}
};

await tx(org, async (c) => {
  await c.query('INSERT INTO identity.organizations(id, name) VALUES($1, $2) ON CONFLICT DO NOTHING', [org, 'Local Development Organization']);
  for (const person of Object.values(people)) {
    await c.query('INSERT INTO identity.persons(id, display_name) VALUES($1, $2)', [person.id, person.name]);
    if (person.role) {
      await c.query('INSERT INTO identity.memberships(organization_id, person_id, organization_role) VALUES($1, $2, $3)', [org, person.id, person.role]);
    }
  }
});
await pool.end();

console.log(JSON.stringify({organizationId: org, persons: Object.fromEntries(Object.entries(people).map(([k, v]) => [k, v.id]))}, null, 2));
console.log('\n# For test/smoke.mjs:');
console.log(`export DEMO_ORG_ID=${org}`);
for (const [key, person] of Object.entries(people)) console.log(`export DEMO_${key.toUpperCase()}=${person.id}`);
