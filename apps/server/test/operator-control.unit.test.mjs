import assert from "node:assert/strict";
import test from "node:test";

import { nextOperatorSessionStatus } from "../dist/runtime/operator-control.js";

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
