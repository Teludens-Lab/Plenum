import assert from "node:assert/strict";
import test from "node:test";

import { PolicyDeniedError, projectResource } from "@plenum/policy-engine";

const context = {
  organizationId: "10000000-0000-4000-8000-000000000001",
  sessionId: "10000000-0000-4000-8000-000000000002",
  participantId: "10000000-0000-4000-8000-000000000003",
  activeSessionRoleId: "release-role-a",
  organizationRoles: []
};

test("PS-110-T02: projections fail closed across Organizations and omit hidden fields", () => {
  const visible = projectResource(context, {
    organizationId: context.organizationId,
    sessionId: context.sessionId,
    resourceType: "artifact",
    fields: {
      title: { classification: "internal", audience: { sessionRoleIds: ["release-role-a"] }, value: "Visible" },
      controlNotes: { classification: "restricted", audience: { sessionRoleIds: ["control-role"] }, value: "Hidden" },
      defaultDenied: { classification: "internal", audience: {}, value: "Hidden by default" }
    }
  });

  assert.deepEqual(visible, { title: "Visible" });
  assert.equal("controlNotes" in visible, false);
  assert.equal("defaultDenied" in visible, false);

  assert.throws(
    () => projectResource(context, {
      organizationId: "20000000-0000-4000-8000-000000000001",
      resourceType: "artifact",
      fields: {}
    }),
    (error) => error instanceof PolicyDeniedError && error.code === "TARGET_NOT_FOUND"
  );

  assert.throws(
    () => projectResource(context, {
      organizationId: context.organizationId,
      resourceType: "audit_record",
      fields: { action: { classification: "restricted", audience: { organizationRoles: ["admin"] }, value: "seat_assignment.changed" } }
    }),
    (error) => error instanceof PolicyDeniedError && error.code === "PERMISSION_DENIED"
  );
});
