import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Child-process-only mutations: never imported by the application or packaged entrypoint.
const replacements = {
  startup: ["/deploy/compose/profile-service.mjs", "const organizationJobs = startOrganizationJobs(",
    "const organizationJobs = (() => { process.send('omitted:startup'); return { stop: async () => {}, healthy: () => false }; })("],
  inject: ["/apps/server/dist/operations/organization-jobs.js", "runScheduledInjects(pool, authority.organizationId, deploymentId, authority, cancellation.signal)",
    "(process.send('omitted:inject'), Promise.resolve({ failures: [] }))"],
  publication: ["/apps/server/dist/operations/organization-jobs.js", "publishPendingRuntimeDeltas(pool, authority.organizationId, 100, authority)",
    "(process.send('omitted:publication'), Promise.resolve())"],
  attachments: ["/apps/server/dist/operations/organization-jobs.js", "enforceFormAttachmentRetention(pool, authority, store, randomUUID(), undefined, cancellation.signal)",
    "(process.send('omitted:attachments'), Promise.resolve({ failed: 0 }))"]
};
const replacement = replacements[process.env.PLENUM_TEST_OMIT_WIRING];
assert.ok(replacement, "a known BA-11 test mutation is required");
registerHooks({ load(url, context, nextLoad) {
  const result = nextLoad(url, context);
  if (!url.endsWith(replacement[0])) return result;
  const source = String(result.source);
  assert.equal(source.split(replacement[1]).length, 2, "BA-11 mutation must match exactly one production call");
  return { ...result, source: source.replace(replacement[1], replacement[2]) };
} });
