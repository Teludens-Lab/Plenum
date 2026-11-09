import assert from "node:assert/strict";
import test from "node:test";

import { nextOperatorSessionStatus } from "../dist/runtime/operator-control.js";
import { mayMutateArtifact } from "../dist/runtime/artifact-workflow.js";

test("PS-840 teamless records remain writable by their creator without granting peer or cross-Team writes", () => {
  const record = { owner_team_id: null, creator_participant_id: "creator" };
  assert.equal(mayMutateArtifact({ isControlRole: false }, record, "creator"), true);
  assert.equal(mayMutateArtifact({ isControlRole: false }, record, "peer"), false);
  assert.equal(mayMutateArtifact({ isControlRole: false, teamId: "other" }, record, "creator"), false);
  assert.equal(mayMutateArtifact({ isControlRole: true }, record, "control"), true);
  const teamRecord = { ...record, owner_team_id: "owner" };
  assert.equal(mayMutateArtifact({ isControlRole: false, teamId: "owner" }, teamRecord, "peer"), true);
  assert.equal(mayMutateArtifact({ isControlRole: false, teamId: "other" }, teamRecord, "creator"), false);
  assert.equal(mayMutateArtifact({ isControlRole: false }, teamRecord, "creator"), false);
});

test("PS-780-T01 Session lifecycle allows only the canonical forward and pause/resume transitions", () => {
  assert.equal(nextOperatorSessionStatus("session.start", "open"), "active");
  assert.equal(nextOperatorSessionStatus("session.pause", "active"), "paused");
  assert.equal(nextOperatorSessionStatus("session.resume", "paused"), "active");
  assert.equal(nextOperatorSessionStatus("session.complete", "active"), "completed");
  assert.equal(nextOperatorSessionStatus("session.complete", "paused"), "completed");
  assert.equal(nextOperatorSessionStatus("session.lock", "completed"), "locked");
  assert.equal(nextOperatorSessionStatus("session.start", "configured"), undefined);
  assert.equal(nextOperatorSessionStatus("session.resume", "active"), undefined);
  assert.equal(nextOperatorSessionStatus("session.lock", "active"), undefined);
});

test("PS-780-T02 archived and locked Sessions cannot be restarted through lifecycle controls", () => {
  for (const status of ["locked", "archived"]) {
    for (const operation of ["session.start", "session.pause", "session.resume", "session.complete", "session.lock"]) {
      assert.equal(nextOperatorSessionStatus(operation, status), undefined);
    }
  }
});
