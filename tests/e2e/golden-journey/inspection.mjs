import { writeFile } from "node:fs/promises";
import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const root = "output/playwright/golden-journey";

// Read-only inspection uses the same workspace picker and disclosure controls as a Designer.
// The screenshots and labelled values form the review bundle; they do not assert human approval.
export async function inspectReference(page, official) {
  const picker = page.getByRole("combobox", { name: "Design workspace", exact: true });
  await expect(picker).toBeVisible();
  await expect(picker.locator("option")).toHaveCount(27);
  const choices = await picker.locator("option").evaluateAll((options) => options.map(({ value, label }) => ({ value, label })));
  const sections = [];
  const namedCollections = { teams: "teams", roles: "sessionRoles", seats: "seats", activities: "activities",
    stages: "stages", forms: "forms", workflows: "workflows", policies: "informationPolicies", interfaces: "interfaces" };
  for (const choice of choices.filter(({ value }) => !["preview", "test-validate", "review-publish", "live-changes"].includes(value))) {
    await picker.selectOption(choice.value);
    const slot = page.locator(".editor-workspace-slot:visible");
    await expect(slot).toBeVisible();
    const disclosures = slot.locator("details:not(.technical-details):not(.provenance-disclosure)");
    for (let index = 0; index < await disclosures.count(); index++) {
      const item = disclosures.nth(index);
      if (await item.isVisible() && await item.getAttribute("open") === null) await item.locator(":scope > summary").click();
    }
    const controls = await slot.locator("input,select,textarea").evaluateAll((elements) => elements.map((element) => ({
      label: [...(element.labels ?? [])].map(({ textContent }) => textContent.trim()).join("; ") || element.getAttribute("aria-label"),
      type: element.type, value: element.value, checked: "checked" in element ? element.checked : undefined,
      options: element.tagName === "SELECT" ? [...element.options].map(({ label, value }) => ({ label, value })) : undefined
    })));
    for (const element of official.coreDesign[namedCollections[choice.value]] ?? []) {
      expect(controls.map(({ value }) => value), `${choice.label}: ${element.name}`).toContain(element.name);
    }
    const screenshots = [];
    const items = slot.locator("details.editor-item");
    for (let index = 0; index < await items.count(); index++) {
      const item = items.nth(index);
      if (!await item.isVisible()) continue;
      const filename = `reference-all-${choice.value}-${index}.png`;
      await item.screenshot({ path: `${root}/${filename}` });
      screenshots.push({ title: await item.locator(":scope > summary").innerText(), filename });
    }
    await slot.locator("h2").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${root}/reference-workspace-${choice.value}.png` });
    sections.push({ ...choice, controls, screenshots, text: await slot.innerText() });
  }
  const collections = Object.fromEntries(Object.entries(official.coreDesign).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length]));
  expect(sections).toHaveLength(23);
  await writeFile(`${root}/reference-complete-inspection.json`, JSON.stringify({ collections, sections,
    reviewStatus: "Automated visible-control and screenshot inventory; named human visual acceptance pending." }, null, 2));
}

export async function inspectDesktopControls(page, studioPath) {
  await page.goto(studioPath);
  await page.getByRole("combobox", { name: "Design workspace", exact: true }).selectOption({ label: "Session Roles" });
  const scribe = page.locator("#sessionRoles-scribe");
  if (await scribe.getAttribute("open") === null) await scribe.locator(":scope > summary").click();
  const stages = scribe.getByRole("group", { name: "Available Stages (none means all)", exact: true });
  const labels = await stages.locator("label").allTextContents();
  expect(labels).toHaveLength(16);
  expect(new Set(labels).size).toBe(16);
  await expect(stages.getByRole("checkbox", { name: "Epoch 1 (2027-2030) / Internal Deliberation", exact: true })).toBeVisible();
  await stages.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/reference-qualified-stage-choices.png` });
  await page.getByRole("combobox", { name: "Design workspace", exact: true }).selectOption({ label: "Stages" });
  const orientation = page.locator("#stages-orientation");
  if (await orientation.getAttribute("open") === null) await orientation.locator(":scope > summary").click();
  const minimum = orientation.getByLabel("Minimum submitted records per cell", { exact: true });
  await expect(minimum).toHaveValue("1");
  for (const [name, width, height, forcedColors] of [["desktop", 1024, 768, "none"], ["zoom200-forced-colors", 512, 384, "active"]]) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ forcedColors, reducedMotion: "reduce" });
    await minimum.focus();
    await expect(minimum).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(orientation.getByLabel("Count records from Stage Group", { exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect((await new AxeBuilder({ page }).include("#stages").analyze()).violations).toEqual([]);
    await page.screenshot({ path: `${root}/energy-stage-controls-${name}.png` });
  }
}
