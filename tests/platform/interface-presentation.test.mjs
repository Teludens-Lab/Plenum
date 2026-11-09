import test from "node:test";
import assert from "node:assert/strict";
import { displayStatus, formatDate, plural, statusClass, authorityLabel, reportFileLabel } from "../../packages/design-system/src/presentation.mjs";
import { extensionSeconds } from "../../apps/runtime-web/dist/runtime/timer-extension.js";

test("PS-842-T02: presentation keeps statuses and singular counts readable", () => {
  assert.equal(displayStatus("stage_entry"), "On Stage entry");
  assert.equal(displayStatus("dead-lettered"), "Delivery needs attention");
  assert.equal(displayStatus("approved"), "Approved");
  assert.equal(plural(1, "installation"), "1 installation");
  assert.equal(plural(0, "binding"), "0 bindings");
  assert.equal(formatDate(null), "Not recorded");
  assert.equal(formatDate("invalid"), "Date unavailable");
  assert.equal(statusClass("approved"), statusClass("Completed"));
  assert.equal(statusClass("Active"), statusClass("open"));
  assert.equal(statusClass("With Team Facilitator"), "badge badge-info");
  assert.equal(statusClass("Immutable"), "badge badge-muted");
  assert.equal(authorityLabel(["operator", "admin"]), "Admin · Operator");
  assert.equal(authorityLabel(["designer", "publisher"], ["platform_administrator"]), "Platform Administrator · Publisher · Designer");
  assert.equal(authorityLabel([]), "Participant");
  assert.equal(reportFileLabel("after_action-15000000-0000-4000-8000-000000000001.pdf"), "After action");
  assert.equal(reportFileLabel("unexpected-private-reference.json"), "Generated report");
});

test("PS-842-T02: both timer surfaces convert minutes without rounding", () => {
  assert.equal(extensionSeconds("0.05"), 3);
  assert.equal(extensionSeconds("1"), 60);
  assert.equal(extensionSeconds("5"), 300);
  for (const value of ["", "0", "-1", "NaN", "Infinity", "0.001", "1e20"]) {
    assert.throws(() => extensionSeconds(value));
  }
});
