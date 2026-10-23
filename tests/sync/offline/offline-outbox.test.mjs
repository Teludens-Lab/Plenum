import assert from "node:assert/strict";
import test from "node:test";

import {
  canQueueOffline,
  createOfflineOutbox,
  enqueueOfflineCommand,
  generateOfflineOutboxKey,
  minimizeOfflineProjection,
  openOfflineOutbox,
  orderedOfflineCommands,
  recordOfflineReceipt,
  sealOfflineOutbox
} from "../../../packages/sync-client/dist/index.js";

const ids = {
  sessionId: "10000000-0000-4000-8000-000000000001",
  deviceId: "10000000-0000-4000-8000-000000000002",
  participantId: "10000000-0000-4000-8000-000000000003",
  releaseId: "10000000-0000-4000-8000-000000000004",
  aggregateId: "10000000-0000-4000-8000-000000000005"
};

const bootstrap = {
  contractId: "sync-bootstrap-v1",
  sessionId: ids.sessionId,
  deviceId: ids.deviceId,
  participantId: ids.participantId,
  seatAssignmentIds: ["10000000-0000-4000-8000-000000000006"],
  activeSessionRoleId: "scribe",
  isControlRole: false,
  authorityDeploymentId: "institutional-runtime",
  authorityEpoch: 2,
  accessRevision: 3,
  governingReleaseId: ids.releaseId,
  credentialExpiresAt: "2099-01-01T00:00:00.000Z",
  serverTime: "2026-10-23T12:00:00.000Z",
  projectionVersion: "runtime-projection-v1",
  policyVersion: "policy-decision-v1",
  offlineCommandTypes: ["artifact.create", "artifact.edit", "artifact.submit", "ballot.cast"]
};

const command = (operationType, commandId, expectedAggregateVersion = 0) => ({
  commandId,
  deviceId: ids.deviceId,
  operationType,
  aggregateId: ids.aggregateId,
  expectedAggregateVersion,
  governingReleaseId: ids.releaseId,
  activeSessionRoleId: "scribe",
  deviceObservedAt: "1999-01-01T00:00:00.000Z",
  payload: { content: { title: "protected offline draft" } }
});

test("SYNC-04/SYNC-14 persists local pending without treating device time as authority", () => {
  const queued = command("artifact.create", "20000000-0000-4000-8000-000000000001");
  assert.equal(canQueueOffline(queued, bootstrap), true);
  const outbox = enqueueOfflineCommand(createOfflineOutbox(bootstrap), queued, "2026-10-23T12:01:00.000Z");
  assert.equal(outbox.entries[0].status, "local_pending");
  assert.equal(outbox.entries[0].receipt, null);
  assert.equal(outbox.entries[0].command.deviceObservedAt, "1999-01-01T00:00:00.000Z");
  assert.equal(canQueueOffline(queued, { ...bootstrap, credentialExpiresAt: "2026-10-23T11:59:59.000Z" },
    Date.parse("2026-10-23T12:00:00.000Z")), false);
});

test("SYNC-17 excludes control, voice, floor, Stage, composition and Approval operations", () => {
  const forbidden = [
    "stage.advance", "session.pause", "voice_channel.join", "voice_consent.give",
    "composition_run.start", "effect_proposal.approve"
  ];
  for (const operationType of forbidden) {
    assert.equal(canQueueOffline(command(operationType, crypto.randomUUID()), bootstrap), false, operationType);
  }
  assert.equal(canQueueOffline(command("artifact.submit", crypto.randomUUID(), 2), { ...bootstrap, isControlRole: true }), false);
});

test("AC-11/SYNC-05/SYNC-08/SYNC-09 orders unchanged Commands and records canonical outcomes", () => {
  const create = command("artifact.create", "20000000-0000-4000-8000-000000000002");
  const submit = command("artifact.submit", "20000000-0000-4000-8000-000000000003", 1);
  let outbox = enqueueOfflineCommand(createOfflineOutbox(bootstrap), submit, "2026-10-23T12:02:00.000Z");
  outbox = enqueueOfflineCommand(outbox, create, "2026-10-23T12:03:00.000Z");
  assert.deepEqual(orderedOfflineCommands(outbox.entries).map(({ command: queued }) => queued.commandId),
    [create.commandId, submit.commandId]);
  outbox = recordOfflineReceipt(outbox, {
    commandId: submit.commandId,
    status: "needs_reconciliation",
    aggregateVersion: null,
    evidenceSequence: 10,
    errorCode: "INCOMPATIBLE_RELEASE",
    message: "The governing Release changed.",
    replayed: false
  });
  const retained = outbox.entries.find(({ command: queued }) => queued.commandId === submit.commandId);
  assert.equal(retained.status, "needs_reconciliation");
  assert.deepEqual(retained.draftPayload, submit.payload);
  assert.strictEqual(retained.command, submit);
});

test("SYNC-10 minimizes cached projections to offline drafting and eligible Ballots", () => {
  const projection = {
    contractId: "runtime-projection-v1", sessionId: ids.sessionId, sessionStatus: "active",
    releaseId: ids.releaseId, releaseLabel: "Fixture", participantId: ids.participantId,
    activeSessionRoleId: "scribe", activeSessionRoleLabel: "Scribe", authorityEpoch: 2,
    activeTeamId: "blue", activeTeamLabel: "Blue", currentStageId: "stage", currentStageLabel: "Stage",
    currentStageStatus: "active", stageStartedAt: null, stageDeadlineAt: null, stageRemainingSeconds: null,
    interfaceProfileId: "fixture", layout: "single_column",
    modules: [
      { id: "forms", type: "artifact_form", title: "Forms", mode: "write", emptyStateText: "Empty", configuration: {} },
      { id: "messages", type: "message_inbox", title: "Messages", mode: "read", emptyStateText: "Empty", configuration: {} }
    ],
    createTasks: [], artifacts: [], messages: [{ secret: "other-role content" }], injects: [{ secret: "hidden" }],
    polls: [{ id: "open", status: "open", eligible: true, hasVoted: false, canManage: true, canCertify: true, tally: { secret: true }, certification: { secret: true } },
      { id: "closed", status: "closed", eligible: true, hasVoted: false }],
    voiceChannels: [{ token: "must-not-cache" }]
  };
  const minimized = minimizeOfflineProjection(projection);
  assert.deepEqual(minimized.modules.map(({ type }) => type), ["artifact_form"]);
  assert.deepEqual(minimized.messages, []);
  assert.deepEqual(minimized.injects, []);
  assert.deepEqual(minimized.voiceChannels, []);
  assert.deepEqual(minimized.polls.map(({ id }) => id), ["open"]);
  assert.equal(minimized.polls[0].canManage, false);
  assert.equal(JSON.stringify(minimized).includes("other-role content"), false);
});

test("SYNC-16 encrypted Ballot rejection remains editable and scoped to its Participant role", async () => {
  const ballot = command("ballot.cast", "20000000-0000-4000-8000-000000000004", 4);
  let outbox = enqueueOfflineCommand(createOfflineOutbox(bootstrap), ballot, "2026-10-23T12:04:00.000Z");
  outbox = recordOfflineReceipt(outbox, {
    commandId: ballot.commandId,
    status: "rejected",
    aggregateVersion: null,
    evidenceSequence: 11,
    errorCode: "DEADLINE_EXPIRED",
    message: "The Poll is closed.",
    replayed: false
  });
  const key = await generateOfflineOutboxKey();
  const sealed = await sealOfflineOutbox(outbox, key);
  assert.equal(JSON.stringify(sealed).includes("protected offline draft"), false);
  assert.deepEqual(await openOfflineOutbox(sealed, key, bootstrap), outbox);
  await assert.rejects(openOfflineOutbox(sealed, key, { ...bootstrap, activeSessionRoleId: "facilitator" }), /another scope/);
  const corrupted = { ...sealed, ciphertext: `${sealed.ciphertext.slice(0, -2)}AA` };
  await assert.rejects(openOfflineOutbox(corrupted, key, bootstrap), /corrupt/);
});
