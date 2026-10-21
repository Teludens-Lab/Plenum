import assert from "node:assert/strict";
import test from "node:test";

import { audienceAllows, PolicyDeniedError, projectResource } from "@plenum/policy-engine";

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

test("PS-200-T07: Team audiences require the owner Team and preserve Control access", () => {
  const blueFacilitator = { ...context, activeSessionRoleId: "facilitator", activeTeamId: "blue", isControlRole: false };
  const redFacilitator = { ...blueFacilitator, activeTeamId: "red" };
  const whiteCell = { ...context, activeSessionRoleId: "white-cell", isControlRole: true };
  const audience = { ownerTeam: true, sessionRoleIds: ["scribe", "facilitator"] };

  assert.equal(audienceAllows(blueFacilitator, audience, "blue"), true);
  assert.equal(audienceAllows(redFacilitator, audience, "blue"), false);
  assert.equal(audienceAllows({ ...blueFacilitator, activeSessionRoleId: "observer" }, audience, "blue"), false);
  assert.equal(audienceAllows(whiteCell, { includeControlRoles: true }, "blue"), true);
  assert.equal(audienceAllows(redFacilitator, { payloadTeamField: "recipientTeams", sessionRoleIds: ["facilitator"] },
    "green", { recipientTeams: ["red"] }), true);
  assert.equal(audienceAllows(blueFacilitator, { payloadTeamField: "recipientTeams", sessionRoleIds: ["facilitator"] },
    "green", { recipientTeams: ["red"] }), false);
});

test("PS-210-T01: export and Plugin projections enforce their classification ceiling", () => {
  const resource = {
    organizationId: context.organizationId,
    sessionId: context.sessionId,
    resourceType: "external_snapshot",
    fields: {
      publicSummary: { classification: "public", audience: { public: true }, value: "shareable" },
      internalDetail: { classification: "internal", audience: { public: true }, value: "organization only" },
      restrictedDetail: { classification: "restricted", audience: { public: true }, value: "never exported" }
    }
  };

  assert.deepEqual(projectResource(context, resource, { maximumClassification: "public" }), {
    publicSummary: "shareable"
  });
  assert.deepEqual(projectResource(context, resource, { maximumClassification: "internal" }), {
    publicSummary: "shareable",
    internalDetail: "organization only"
  });
});

test("DEC-61: Reviewer and Research Analyst are distinct Organization Role audiences", () => {
  assert.equal(audienceAllows({ ...context, organizationRoles: ["reviewer"] }, { organizationRoles: ["reviewer"] }), true);
  assert.equal(audienceAllows({ ...context, organizationRoles: ["research_analyst"] }, { organizationRoles: ["reviewer"] }), false);
  assert.equal(audienceAllows({ ...context, organizationRoles: ["research_analyst"] }, { organizationRoles: ["research_analyst"] }), true);
});
