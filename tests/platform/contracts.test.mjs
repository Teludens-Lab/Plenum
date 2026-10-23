import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMAND_ENVELOPE_CONTRACT_ID,
  COMMAND_RECEIPT_CONTRACT_ID,
  DOMAIN_EVENT_CONTRACT_ID,
  ERROR_ENVELOPE_CONTRACT_ID,
  EVENT_ENVELOPE_CONTRACT_ID,
  RUNTIME_SSE_CONTRACT_ID,
  SYNC_DELTAS_CONTRACT_ID,
  SYNC_SNAPSHOT_CONTRACT_ID,
  MODEL_RUN_CONTRACT_ID,
  EFFECT_PROPOSAL_CONTRACT_ID,
  APPROVAL_DECISION_CONTRACT_ID,
  COMPATIBILITY_REPORT_CONTRACT_ID,
  RELEASE_ACTIVATION_CONTRACT_ID,
  SESSION_OPERATOR_POLICY_V1,
  commandEnvelopeV1Schema,
  commandReceiptV1Schema,
  canonicalizeJson,
  eventEnvelopeV1Schema,
  runtimeSseV1Schema,
  syncDeltasV1Schema,
  syncSnapshotV1Schema,
  modelRunV1Schema,
  effectProposalV1Schema,
  approvalDecisionV1Schema,
  compatibilityReportV1Schema,
  releaseActivationV1Schema,
  isCommandOperationType,
  isPastTenseEventType
} from "@plenum/event-contracts";
import {
  SIMULATION_SCHEMA_VERSION,
  hasPinnedPluginDigest
} from "@plenum/simulation-schema";
import {
  AuthorizationError,
  authorizeCommandRole,
  requireTrustedSessionContext
} from "@plenum/server";
import { isServerAcceptedCommand, releaseIdentity } from "@plenum/runtime-web";

const ids = {
  commandId: "10000000-0000-4000-8000-000000000001",
  deviceId: "10000000-0000-4000-8000-000000000002",
  aggregateId: "10000000-0000-4000-8000-000000000003",
  releaseId: "10000000-0000-4000-8000-000000000004",
  correlationId: "10000000-0000-4000-8000-000000000005"
};

const command = {
  commandId: ids.commandId,
  deviceId: ids.deviceId,
  operationType: "artifact.submit",
  aggregateId: ids.aggregateId,
  expectedAggregateVersion: 1,
  governingReleaseId: ids.releaseId,
  activeSessionRoleId: "release-defined-role",
  payload: {}
};

test("PS-100-T01: versioned contracts are shared by server and frontend consumers", () => {
  assert.deepEqual(
    [COMMAND_ENVELOPE_CONTRACT_ID, COMMAND_RECEIPT_CONTRACT_ID, DOMAIN_EVENT_CONTRACT_ID,
      EVENT_ENVELOPE_CONTRACT_ID, ERROR_ENVELOPE_CONTRACT_ID],
    ["command-envelope-v1", "command-receipt-v1", "domain-event-v1",
      "event-envelope-v1", "error-envelope-v1"]
  );
  assert.equal(commandEnvelopeV1Schema.additionalProperties, false);
  assert.equal(eventEnvelopeV1Schema.properties.eventVersion.const, 1);
  assert.equal(commandReceiptV1Schema.additionalProperties, false);
  assert.deepEqual(
    [RUNTIME_SSE_CONTRACT_ID, SYNC_DELTAS_CONTRACT_ID, SYNC_SNAPSHOT_CONTRACT_ID],
    ["runtime-sse-v1", "sync-deltas-v1", "sync-snapshot-v1"]
  );
  assert.equal(runtimeSseV1Schema.additionalProperties, false);
  assert.equal(syncDeltasV1Schema.additionalProperties, false);
  assert.equal(syncSnapshotV1Schema.additionalProperties, false);
  assert.deepEqual(
    [MODEL_RUN_CONTRACT_ID, EFFECT_PROPOSAL_CONTRACT_ID, APPROVAL_DECISION_CONTRACT_ID],
    ["model-run-v1", "effect-proposal-v1", "approval-decision-v1"]
  );
  assert.equal(modelRunV1Schema.additionalProperties, false);
  assert.equal(effectProposalV1Schema.additionalProperties, false);
  assert.equal(approvalDecisionV1Schema.additionalProperties, false);
  assert.equal(compatibilityReportV1Schema.$id, COMPATIBILITY_REPORT_CONTRACT_ID);
  assert.equal(releaseActivationV1Schema.$id, RELEASE_ACTIVATION_CONTRACT_ID);
  assert.equal(canonicalizeJson({ z: 1, a: { y: 2, x: 3 } }), '{"a":{"x":3,"y":2},"z":1}');
  assert.equal(isCommandOperationType(command.operationType), true);
  assert.equal(isCommandOperationType("artifact.submitted"), false);
  assert.equal(isPastTenseEventType("artifact.submitted"), true);
  assert.equal(isPastTenseEventType("artifact.submit"), false);

  const release = {
    manifest: {
      schemaVersion: SIMULATION_SCHEMA_VERSION,
      releaseId: ids.releaseId,
      projectId: "10000000-0000-4000-8000-000000000006",
      definitionRevisionId: "10000000-0000-4000-8000-000000000007",
      releaseLabel: "Synthetic release",
      semanticVersion: "1.0.0",
      methodologyVersion: "1.0",
      compilerVersion: "0.1.0",
      contentDigest: "a".repeat(64),
      publishedBy: "10000000-0000-4000-8000-000000000008",
      approvedBy: ["10000000-0000-4000-8000-000000000009"],
      publishedAt: "2026-10-18T00:00:00Z",
      releaseNotes: "Synthetic fixture",
      validationReportId: "10000000-0000-4000-8000-000000000010"
    },
    coreDesign: { pluginBindings: [] },
    scenario: {
      id: "synthetic-scenario",
      name: "Synthetic scenario",
      description: "Contract fixture",
      deliveryModes: ["virtual"],
      tags: []
    }
  };
  assert.equal(releaseIdentity({ release }), `${ids.releaseId}@1.0.0`);
  assert.equal(hasPinnedPluginDigest({
    id: "binding-1",
    pluginId: "plugin-1",
    pluginVersion: "1.0.0",
    pluginDigest: `sha256:${"b".repeat(64)}`,
    installationId: "installation-1",
    categories: [],
    connectivity: "offline_capable",
    configuration: {},
    configurationDigest: "c".repeat(64),
    inputMappings: [],
    timeoutSeconds: 5,
    enabledInProfiles: ["institutional"]
  }), true);
  assert.equal(isServerAcceptedCommand({ status: "local_pending", command }), false);
  assert.equal(isServerAcceptedCommand({
    commandId: ids.commandId,
    status: "accepted",
    aggregateVersion: 2,
    evidenceSequence: 1,
    errorCode: null,
    message: null,
    replayed: false
  }), true);
});

test("PS-100-T02: client-supplied or incomplete identity context is denied", () => {
  assert.throws(
    () => requireTrustedSessionContext(undefined, ids.correlationId),
    (error) => error instanceof AuthorizationError && error.envelope.error.code === "UNAUTHENTICATED"
  );

  assert.throws(
    () => requireTrustedSessionContext({ principalId: "principal-1" }, ids.correlationId),
    (error) => error instanceof AuthorizationError && error.envelope.error.code === "NOT_A_PARTICIPANT"
  );

  const trusted = requireTrustedSessionContext({
    principalId: "principal-1",
    organizationId: "organization-1",
    sessionId: "session-1",
    participantId: "participant-1",
    seatAssignmentIds: ["seat-assignment-1"],
    activeSessionRoleId: "release-defined-role",
    authorityEpoch: 1
  }, ids.correlationId);

  assert.doesNotThrow(() => authorizeCommandRole(trusted, command, ids.correlationId));
  assert.throws(
    () => authorizeCommandRole(trusted, { ...command, activeSessionRoleId: "other-role" }, ids.correlationId),
    (error) => error instanceof AuthorizationError && error.envelope.error.code === "PERMISSION_DENIED"
  );
});

test("Game Master authorization is Organization- and Session-scoped without a Participant Seat", () => {
  assert.equal(SESSION_OPERATOR_POLICY_V1.displayLabel, "Game Master");
  assert.equal(SESSION_OPERATOR_POLICY_V1.organizationRole, "operator");
  assert.deepEqual(SESSION_OPERATOR_POLICY_V1.scope, ["organization", "session"]);
  assert.equal(SESSION_OPERATOR_POLICY_V1.participantSeat, "forbidden");
  assert.ok(SESSION_OPERATOR_POLICY_V1.consequentialOperations.includes("session.archive"));
  assert.ok(SESSION_OPERATOR_POLICY_V1.consequentialOperations.includes("participant.reassign"));
  assert.ok(SESSION_OPERATOR_POLICY_V1.consequentialOperations.includes("plugin_binding.enable"));
  assert.ok(SESSION_OPERATOR_POLICY_V1.consequentialOperations.includes("export.request"));
  assert.deepEqual(SESSION_OPERATOR_POLICY_V1.recording, {
    accepted: "command_receipt_evidence_event_and_immutable_audit_record",
    rejected: "command_receipt_and_evidence_event",
    recovery: "compensating_record_preserving_original"
  });
});
