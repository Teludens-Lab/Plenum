import { test, expect } from "@playwright/test";
import { interfaceFindings } from "./assertions.mjs";

test("PS-842 scanner keeps visible descendants and excludes disclosed or hidden provenance", async ({ page }) => {
  await page.setContent(`<h1>Workspace</h1><main>
    <div hidden>hidden_enum</div><div style="display:none">also_hidden</div>
    <details class="technical-details" open><summary>Technical details</summary>allowed_enum</details>
    <div style="display:contents"><span>visible_enum</span></div>
    <input aria-label="Primary reference" value="input_enum"><textarea aria-label="Primary text">textarea_enum</textarea>
    <select aria-label="Primary selection"><option value="hidden_id">selected_enum</option></select>
    <input type="password" aria-label="Secret" value="secret_enum">
    <label><input type="checkbox" value="hidden_checkbox">Readable choice</label>
    <label><input type="radio" value="hidden_radio">Readable option</label>
    <div class="card"><div class="card">Nested</div></div>
  </main>`);
  expect(await interfaceFindings(page)).toEqual([
    "Technical primary label: visible_enum", "Technical primary label: input_enum",
    "Technical primary label: textarea_enum", "Technical primary label: selected_enum", "Nested card: card"
  ]);
});

test("PS-842 scanner rejects overflow, multiple headings, primary identifiers and nested scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.setContent(`<h1>Workspace</h1><h1>Duplicate</h1>
    <p>12345678-1234-4234-8234-123456789abc OPEN-027 text/plain</p>
    <main style="height:100px;overflow:auto"><div style="height:80px;overflow:auto">
      <div style="height:200px">Long list</div></div><div style="height:200px">More content</div></main>
    <div style="width:1400px">Too wide</div>`);
  const findings = await interfaceFindings(page);
  expect(findings).toContain("Expected one visible H1; found 2");
  expect(findings).toContain("Horizontal page overflow");
  expect(findings).toContain("Technical primary label: 12345678-1234-4234-8234-123456789abc, OPEN-027, text/plain");
  expect(findings).toContain("Competing scroll owners in : 2");
});
