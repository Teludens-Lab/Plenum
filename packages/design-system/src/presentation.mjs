const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function formatDate(value) {
  if (value == null || value === "") return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : dateTime.format(date);
}

export function displayStatus(value) {
  if (value == null || value === "") return "Not available";
  const labels = { stage_entry: "On Stage entry", dead_lettered: "Delivery needs attention",
    "dead-lettered": "Delivery needs attention", local_pending: "Saved on this device",
    needs_reconciliation: "Needs reconciliation", not_started: "Not started" };
  return labels[value] ?? value.replaceAll(/[_-]+/gu, " ").replace(/^./u, (letter) => letter.toUpperCase());
}

export function plural(count, singular, multiple = `${singular}s`) {
  return `${count} ${count === 1 ? singular : multiple}`;
}

export function reportFileLabel(filename) {
  const kind = filename.match(/^([a-z_]+)-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.[a-z0-9]+$/u)?.[1];
  return kind ? displayStatus(kind) : "Generated report";
}

export function authorityLabel(roles, platformRoles = []) {
  const labels = { admin: "Admin", publisher: "Publisher", designer: "Designer", reviewer: "Reviewer", operator: "Operator", research_analyst: "Research Analyst" };
  return [...(platformRoles.includes("platform_administrator") ? ["Platform Administrator"] : []),
    ...Object.entries(labels).filter(([role]) => roles.includes(role)).map(([, label]) => label)].join(" · ") || "Participant";
}

export function statusClass(value) {
  const key = String(value ?? "").toLowerCase().replaceAll(/[ -]/gu, "_");
  if (["completed", "succeeded", "approved", "accepted", "clean", "linked"].includes(key)) return "badge badge-success";
  if (["failed", "rejected", "revoked", "error"].includes(key)) return "badge badge-error";
  if (["paused", "pending", "suspended", "dead_lettered", "needs_reconciliation"].includes(key)) return "badge badge-warning";
  if (["active", "open", "with_facilitator", "with_team_facilitator"].includes(key)) return "badge badge-info";
  return "badge badge-muted";
}
