import type { PoolClient } from "pg";
import { authorizationError } from "../errors.js";

export type ReportingTarget = { id: string; scopeType: "organization" | "session" | "project" | "export"; label: string };

export async function listReportingTargets(client: PoolClient, organizationId: string): Promise<ReportingTarget[]> {
  // shortcut: selectors list 200 items per kind; add paginated search before larger catalogs need policy targeting.
  const result = await client.query<ReportingTarget>(
    `SELECT id,scope_type AS "scopeType",label FROM (
       (SELECT id::text,'session' AS scope_type,title AS label FROM runtime.sessions WHERE organization_id=$1 ORDER BY title,id LIMIT 200)
       UNION ALL
       (SELECT id::text,'project' AS scope_type,title AS label FROM studio.simulation_projects WHERE organization_id=$1 ORDER BY title,id LIMIT 200)
       UNION ALL
       (SELECT artifact.id::text,'export' AS scope_type,
         concat(initcap(replace(definition.report_kind,'_',' ')), ' / ', coalesce(session.title,project.title,'Report'),
           ' / ', upper(job.format), ' / Export ', row_number() OVER (ORDER BY artifact.created_at DESC,artifact.id)) AS label
        FROM reporting.export_artifacts artifact
        JOIN reporting.export_jobs job ON job.organization_id=artifact.organization_id AND job.id=artifact.job_id
        JOIN reporting.report_definitions definition ON definition.organization_id=job.organization_id AND definition.id=job.definition_id
        LEFT JOIN runtime.sessions session ON session.organization_id=job.organization_id AND session.id=job.session_id
        LEFT JOIN studio.simulation_projects project ON project.organization_id=job.organization_id AND project.id=job.project_id
        WHERE artifact.organization_id=$1 ORDER BY artifact.created_at DESC,artifact.id LIMIT 200)
     ) targets ORDER BY scope_type,label,id`, [organizationId]);
  return [{ id: organizationId, scopeType: "organization", label: "This Organization" }, ...result.rows];
}

export async function assertReportingTarget(client: PoolClient, organizationId: string, scope: string, id: string, correlationId: string): Promise<void> {
  const tables: Record<string, string> = { session: "runtime.sessions", project: "studio.simulation_projects", export: "reporting.export_artifacts" };
  if (scope === "organization") {
    if (id === organizationId || id === "*") return;
    throw authorizationError("PERMISSION_DENIED", "The selected Organization is unavailable.", correlationId);
  }
  if (scope === "export" && id === "*") return;
  const table = tables[scope];
  if (table === undefined) return;
  const result = await client.query(`SELECT 1 FROM ${table} WHERE organization_id=$1 AND id::text=$2`, [organizationId, id]);
  if (result.rowCount !== 1) throw authorizationError("PERMISSION_DENIED", "The selected item is unavailable in this Organization.", correlationId);
}
