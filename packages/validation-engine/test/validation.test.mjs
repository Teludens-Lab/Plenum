import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateStudioDraft } from "../dist/index.js";

test("SYNC-01 validation blocks an invalid merged workflow with a source link", async () => {
  const release = JSON.parse(await readFile(new URL("../../../definitions/fractured-order/fractured-order-release.json", import.meta.url), "utf8"));
  const invalid = structuredClone({ coreDesign: release.coreDesign, scenario: release.scenario });
  invalid.coreDesign.workflows[0].initialState = "missing-state";
  const report = validateStudioDraft(invalid);
  assert.equal(report.valid, false);
  assert.equal(report.issues.length > 0, true);
  assert.match(report.issues[0].message, /Workflow/u);
  assert.match(report.issues[0].path, /^workflows\./u);
  assert.match(report.reportDigest, /^[0-9a-f]{64}$/u);
});
