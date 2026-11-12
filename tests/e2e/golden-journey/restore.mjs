import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { fixture } from "../fixture.mjs";

const root = "output/playwright/golden-journey";
const checkpoint = JSON.parse(await readFile("test-results/golden-journey/studio-checkpoint.json", "utf8"));
const archivePath = `${root}/original-organization-archive.json.gz`;
const compressed = await readFile(archivePath);
assert.equal(createHash("sha256").update(compressed).digest("hex"), checkpoint.originalOrganizationArchive.sha256);
const browser = await chromium.launch();
const context = await browser.newContext({ baseURL: process.env.PLENUM_RESTORE_URL ?? "http://127.0.0.1:4228",
  viewport: { width: 1024, height: 768 }, extraHTTPHeaders: { Authorization: `Bearer ${fixture.tokens.operator}` } });
const page = await context.newPage();
const result = { archiveBytes: compressed.byteLength, imported: false, sessions: [] };
try {
  await page.goto("/admin/data-policy");
  await page.getByText("Import into an empty Organization deployment", { exact: true }).click();
  await page.getByLabel("Verified Organization archive", { exact: true }).setInputFiles(archivePath);
  const pending = page.waitForResponse((response) => response.request().method() === "POST" &&
    response.url().includes(`/v1/organizations/${fixture.organizationId}/archive/import`), { timeout: 600_000 });
  await page.getByRole("button", { name: "Verify and import archive", exact: true }).click();
  const response = await pending;
  assert.equal(response.status(), 201, `Archive import returned ${response.status()}`);
  result.imported = true;
  result.restoreStatus = response.status();
  await expect(page.getByText(/Portable Organization archive verified and imported/u)).toBeVisible();
  await page.screenshot({ path: `${root}/restored-organization.png` });
  for (const prefix of ["energy", "original"]) {
    const sessionPath = checkpoint[`${prefix}SessionPath`];
    await page.goto(`/admin${sessionPath}`);
    await expect(page.getByRole("region", { name: "Session control", exact: true })).toBeVisible();
    await expect(page.getByText("Session Archived", { exact: false })).toBeVisible();
    await page.goto(`/admin${sessionPath}/replay`);
    const capability = await page.request.get(`/v1${sessionPath}/replay`);
    expect(capability.status()).toBe(200);
    expect((await capability.json()).available, "BA-09: restored-history reconstruction is unavailable; the restore Replay gate remains BLOCKED.").toBe(true);
    await page.getByRole("button", { name: "Run replay", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Matched" }).last()).toBeVisible();
    await expect(page.getByText("No differences were found between captured and replayed history.", { exact: true })).toBeVisible();
    await page.screenshot({ path: `${root}/restored-${prefix}-replay.png` });
    await page.goto(`/admin${sessionPath}/reports`);
    await page.getByLabel("Report", { exact: true }).selectOption("after_action");
    await page.getByLabel("Format", { exact: true }).selectOption("json");
    const download = page.waitForEvent("download", { timeout: 90_000 });
    await page.getByRole("button", { name: "Generate and download", exact: true }).click();
    const file = await download;
    const bytes = await readFile(await file.path());
    assert.ok(bytes.byteLength > 100);
    result.sessions.push({ prefix, sessionPath, replay: "matched", reportBytes: bytes.byteLength,
      reportSha256: createHash("sha256").update(bytes).digest("hex") });
  }
  await writeFile("test-results/golden-journey/checkpoint-h-restore-ui-result.json", JSON.stringify(result, null, 2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await context.close();
  await browser.close();
}
