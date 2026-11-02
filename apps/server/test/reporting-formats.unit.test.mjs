import assert from "node:assert/strict";
import test from "node:test";

import { createTextPdf } from "../dist/reporting/formats.js";

test("PS-790-T02 long governed reports paginate and preserve every source line", () => {
  const lines = Array.from({ length: 90 }, (_, index) => `Captured History ${index + 1}: source-${index + 1}`);
  const text = Buffer.from(createTextPdf(lines)).toString("latin1");

  assert.match(text, /\/Type \/Pages .*\/Count 3/u);
  assert.match(text, /Page 1 of 3/u);
  assert.match(text, /Page 3 of 3/u);
  assert.match(text, /Captured History 1: source-1/u);
  assert.match(text, /Captured History 90: source-90/u);
});
