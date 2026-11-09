import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { fixture } from "../fixture.mjs";

// Infrastructure and synthetic identity bootstrap only. Projects, Templates,
// Releases, Sessions, participants and all simulation content are created in UI.
export default async function bootstrap() {
  if (Number(process.versions.node.split(".")[0]) < 24) throw new Error("Node 24+ is required");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !/^\/plenum_ps830_g_browser[0-9]+$/u.test(new URL(databaseUrl).pathname)) {
    throw new Error("Golden bootstrap requires a dedicated plenum_ps830_g_browserN database");
  }
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const migrations = [];
  try {
    const existing = await pool.query("SELECT count(*) FROM information_schema.tables WHERE table_schema IN ('identity','studio','runtime','registry')");
    if (Number(existing.rows[0].count) !== 0) throw new Error("Golden bootstrap requires a blank database; it never resets existing data");
    for (const directory of ["references/plenum-runtime-slice/migrations", "apps/server/migrations"]) {
      for (const file of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
        const path = `${directory}/${file}`;
        const sql = await readFile(path, "utf8");
        await pool.query(sql);
        migrations.push({ path, sha256: createHash("sha256").update(sql).digest("hex") });
      }
    }
    const roles = { operator: ["operator", "admin"], designerA: ["designer"], designerB: ["designer", "research_analyst"],
      publisher: ["designer", "publisher", "reviewer"], finalReviewer: ["reviewer"], portalOperator: ["operator"] };
    const names = { author: "Synthetic Blue author", reviewer: "Synthetic Blue reviewer", finalReviewer: "Synthetic final reviewer",
      operator: "Synthetic operator", redAuthor: "Synthetic Red author", greenReviewer: "Synthetic Green reviewer", redReviewer: "Synthetic Red reviewer",
      designerA: "Synthetic Designer A", designerB: "Synthetic Designer B", publisher: "Synthetic Publisher", blueNotetaker: "Synthetic Blue notetaker",
      portalOperator: "Synthetic portal operator", invitedParticipant: "Synthetic invited participant", codeParticipant: "Synthetic code participant" };
    await pool.query("BEGIN");
    await pool.query("INSERT INTO identity.organizations(id,name) VALUES ($1,'PS-830 blank-install synthetic Organization')", [fixture.organizationId]);
    for (const [key, personId] of Object.entries(fixture.people)) {
      await pool.query("INSERT INTO identity.persons(id,display_name) VALUES ($1,$2)", [personId, names[key]]);
      await pool.query("INSERT INTO identity.organization_workforce_members(organization_id,person_id,source,status) VALUES ($1,$2,'legacy','active')", [fixture.organizationId, personId]);
      for (const role of roles[key] ?? []) await pool.query("INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,$3)", [fixture.organizationId, personId, role]);
      await pool.query(`INSERT INTO identity.authentication_sessions(id,organization_id,person_id,issuer,subject,authentication_strength,expires_at)
        VALUES ($1,$2,$3,'https://fixture.invalid',$4,'mfa','2099-01-01T00:00:00Z')`, [fixture.authenticationSessions[key], fixture.organizationId, personId, `ps830-${key}`]);
    }
    await pool.query("SELECT identity.bootstrap_platform_administrator($1,gen_random_uuid())", [fixture.people.operator]);
    await pool.query("COMMIT");
    const domainCounts = {};
    for (const table of ["studio.simulation_projects", "studio.drafts", "studio.simulation_templates", "registry.releases", "runtime.sessions", "runtime.participants"]) {
      domainCounts[table] = Number((await pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
    }
    if (Object.values(domainCounts).some((value) => value !== 0)) throw new Error("Bootstrap unexpectedly contains simulation domain records");
    await mkdir("test-results/golden-journey", { recursive: true });
    await writeFile("test-results/golden-journey/blank-install.json", JSON.stringify({ node: process.version,
      database: new URL(databaseUrl).pathname.slice(1), bootstrappedAt: new Date().toISOString(), migrations,
      identityCount: Object.keys(fixture.people).length, domainCounts,
      identityBoundary: "Synthetic loopback authentication sessions; external OIDC interoperability is not claimed." }, null, 2));
  } finally { await pool.end(); }
}
