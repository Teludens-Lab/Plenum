import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { fixture } from "../fixture.mjs";
import { executeEnergy } from "./execution.mjs";
import { beginOriginal, completeEnergy, completeOriginal } from "./completion.mjs";
import { inspectReference, inspectDesktopControls } from "./inspection.mjs";

const evidenceRoot = "output/playwright/golden-journey";
const checkpointPath = "test-results/golden-journey/studio-checkpoint.json";
async function actor(browser, key, baseURL) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1024, height: 768 },
    extraHTTPHeaders: { Authorization: `Bearer ${fixture.tokens[key]}` } });
  context.setDefaultTimeout(30_000);
  return { context, page: await context.newPage() };
}
async function workspace(page, name, regionName = name) {
  await page.getByRole("combobox", { name: "Design workspace", exact: true }).selectOption({ label: name });
  const region = page.getByRole("region", { name: regionName, exact: true });
  await expect(region).toBeVisible();
  return region;
}
async function synchronized(page) {
  await expect(page.locator(".studio-draft-status")).toBeVisible();
  await expect(page.locator(".studio-draft-status")).not.toContainText("waiting to synchronize", { timeout: 90_000 });
}
async function approveAndPublish(page, reviewerPage, title) {
  await synchronized(page);
  const publication = await workspace(page, "Review & publish");
  await publication.getByLabel("Release label", { exact: true }).fill(title);
  await publication.getByLabel("Semantic version", { exact: true }).fill("1.0.0");
  await publication.getByLabel("Release notes", { exact: true }).fill("PS-830 UI-only golden journey; synthetic automated review, human acceptance remains separately recorded.");
  await publication.getByText("Governance references", { exact: true }).click();
  await publication.getByLabel("Classification review reference").fill("ps830-synthetic-internal-review");
  await publication.getByLabel("Retention policy reference", { exact: true }).fill("ps830-golden-retention");
  await publication.getByLabel("Approval notes", { exact: true }).fill("Automated independent persona review of the imported official design.");
  await publication.getByLabel("I acknowledge the validation warnings.").check();
  await publication.getByRole("button", { name: "Freeze for review", exact: true }).click();
  await expect(page.getByText(/is frozen and ready for Reviewer approval/u)).toBeVisible();
  await reviewerPage.goto(page.url());
  const review = await workspace(reviewerPage, "Review & publish");
  await review.getByLabel("Methodology review notes").fill("Independent synthetic Reviewer has inspected the frozen design. Named human acceptance is not asserted.");
  await review.getByRole("button", { name: "Approve freeze", exact: true }).click();
  await expect(reviewerPage.getByText(/Reviewer approval was recorded/u)).toBeVisible();
  await publication.getByRole("button", { name: "Freeze for review", exact: true }).click();
  await expect(page.getByText("1 current approval.")).toBeVisible();
  await publication.getByRole("button", { name: "Publish approved freeze", exact: true }).click();
  await expect(page.getByText(`Published ${title}.`, { exact: true })).toBeVisible();
  return publication;
}

test("PS-830-T08 blank-install official import and Studio customization @a11y", async ({ browser, baseURL }) => {
  await mkdir(evidenceRoot, { recursive: true });
  const designer = await actor(browser, "publisher", baseURL);
  const reviewer = await actor(browser, "finalReviewer", baseURL);
  const page = designer.page;
  const packagePath = "definitions/fractured-order/fractured-order-release.json";
  const packageBytes = await readFile(packagePath);
  const official = JSON.parse(packageBytes.toString("utf8"));
  let checkpoint;
  if (process.env.PLENUM_GOLDEN_RESUME === "true") checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
  else {
    await page.goto("/?workspace=projects");
    await expect(page.getByRole("heading", { name: "No active Projects yet", exact: true })).toBeVisible();
    await page.getByLabel("Release Package file", { exact: true }).check();
    await page.getByLabel("Project name", { exact: true }).fill("PS-830 unchanged Fractured Order");
    await page.getByLabel("Release Package", { exact: true }).setInputFiles(packagePath);
    expect((await new AxeBuilder({ page }).include("#projects").analyze()).violations).toEqual([]);
    await page.screenshot({ path: `${evidenceRoot}/blank-package-import.png`, fullPage: true });
    await page.getByRole("button", { name: "Create Project and open Draft", exact: true }).click();
    await expect(page).toHaveURL(/\/studio\/projects\/[0-9a-f-]{36}$/u);
    checkpoint = { originalStudioPath: new URL(page.url()).pathname,
      officialPackageSha256: createHash("sha256").update(packageBytes).digest("hex"), originalTitle: "PS-830 unchanged Fractured Order" };
    await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
  }
  await page.goto(checkpoint.originalStudioPath);
  if (checkpoint.referenceInspectionVersion !== 2) {
    await inspectReference(page, official);
    checkpoint.referenceInspectionComplete = true;
    checkpoint.referenceInspectionVersion = 2;
    await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
  }
  if (!checkpoint.originalPublished) {
    const publication = await approveAndPublish(page, reviewer.page, checkpoint.originalTitle);
    checkpoint.originalPublished = true;
    await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
    await publication.getByLabel("Template title", { exact: true }).fill("Official Fractured Order");
    await publication.getByLabel("Summary", { exact: true }).fill("Unchanged official reference design imported from the verified portable Package.");
    await publication.getByLabel("Include the optional Scenario", { exact: true }).check();
    await publication.getByLabel("Publication rationale", { exact: true }).fill("Reuse the independently approved official design for the PS-830 Energy variation.");
    await publication.getByRole("button", { name: "Publish immutable Template version", exact: true }).click();
    await expect(page.getByText("Published immutable Template version 1.", { exact: true })).toBeVisible();
    checkpoint.templatePublished = true;
    await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
  }
  if (!checkpoint.energyStudioPath) {
    await page.goto("/?workspace=projects");
    const template = page.locator(".template-row").filter({ hasText: "Official Fractured Order" });
    await expect(template).toBeVisible();
    checkpoint.templatePublished = true;
    await template.getByRole("button", { name: "Start from Template", exact: true }).click();
    await page.getByLabel("Project name", { exact: true }).fill("PS-830 Energy Fractured Order");
    await page.getByLabel("Copy optional Scenario content", { exact: true }).check();
    await page.getByRole("button", { name: "Create Project and open Draft", exact: true }).click();
    await expect(page).toHaveURL(/\/studio\/projects\/[0-9a-f-]{36}$/u);
    checkpoint.energyStudioPath = new URL(page.url()).pathname;
    checkpoint.energyTitle = "PS-830 Energy Fractured Order";
    await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
  }
  await page.goto(checkpoint.energyStudioPath);
  if (!checkpoint.energyAuthored) {
    const teams = await workspace(page, "Teams");
    const industry = teams.locator("#teams-industry");
    await industry.locator("summary").first().click();
    if (!(await industry.getByLabel("Cell name", { exact: true }).evaluateAll((inputs) => inputs.map((input) => input.value))).includes("Energy")) {
      await industry.getByRole("button", { name: "Add industry sector cell", exact: true }).click();
      await industry.getByLabel("Cell name", { exact: true }).last().fill("Energy");
    }
    await expect(industry.getByLabel("Energy enabled", { exact: true })).toBeChecked();
    await industry.screenshot({ path: `${evidenceRoot}/energy-sector.png` });
    const seats = await workspace(page, "Seats");
    let second = seats.locator("details.editor-item").filter({ has: page.locator("summary", { hasText: "Blue Second Facilitator" }) });
    if (await second.count() === 0) {
      const first = seats.locator("#seats-blue-facilitator");
      await first.locator("summary").first().click();
      await first.getByRole("button", { name: "Duplicate", exact: true }).click();
      second = seats.locator("details.editor-item").last();
      await second.locator("summary").first().click();
      await second.getByLabel("Seat name", { exact: true }).fill("Blue Second Facilitator");
    } else if (await second.getAttribute("open") === null) await second.locator("summary").first().click();
    await expect(second.getByLabel("Facilitator", { exact: true })).toBeChecked();
    await expect(second.getByLabel("Team", { exact: true })).toHaveValue("blue");
    await second.screenshot({ path: `${evidenceRoot}/energy-second-facilitator.png` });

    const forms = await workspace(page, "Forms & Artifacts");
    const form = forms.locator("#forms-form-blue-action");
    await form.locator("summary").first().click();
    if (await form.getByRole("button", { name: "Use approved form rules", exact: true }).count()) await form.getByRole("button", { name: "Use approved form rules", exact: true }).click();
    await form.getByLabel("Form version", { exact: true }).fill("3");
    let contingency = form.getByRole("group", { name: "Contingency planning", exact: true });
    if (await contingency.count() === 0) {
      await form.getByRole("button", { name: "Add Form section", exact: true }).click();
      const section = form.getByRole("group", { name: "New section", exact: true });
      await section.getByLabel("Section title", { exact: true }).fill("Contingency planning");
    }
    contingency = form.getByRole("group", { name: "Contingency planning", exact: true });
    if (await contingency.getByLabel("Field label", { exact: true }).count() === 0) await contingency.getByRole("button", { name: "Add field", exact: true }).click();
    await contingency.getByLabel("Field label", { exact: true }).fill("Contingency plan");
    await contingency.getByLabel("Field key", { exact: true }).fill("contingency");
    await contingency.getByLabel("Field type", { exact: true }).selectOption("long_text");
    await contingency.getByLabel("Required", { exact: true }).check();
    await contingency.screenshot({ path: `${evidenceRoot}/energy-required-contingency.png` });
    const stages = await workspace(page, "Stages");
    const orientation = stages.locator("#stages-orientation");
    await orientation.locator("summary").first().click();
    await orientation.getByLabel("Required Artifact Type", { exact: true }).selectOption({ label: "Industry Strategic Plan" });
    await orientation.getByLabel("Minimum submitted records per cell", { exact: true }).fill("2");
    await synchronized(page);
    await orientation.getByLabel("Minimum submitted records per cell", { exact: true }).fill("1");
    await orientation.getByLabel("Count records from Stage Group", { exact: true }).selectOption({ label: "All Stage Groups" });
    await orientation.screenshot({ path: `${evidenceRoot}/energy-orientation-requirement.png` });
    expect((await new AxeBuilder({ page }).include("#stages").analyze()).violations).toEqual([]);
    const adjudication = await workspace(page, "Adjudication Models");
    const model = adjudication.locator("#adjudicationModels-manual-white-cell");
    await model.getByLabel("Model name", { exact: true }).fill("Energy contingency rubric");
    await model.getByLabel("Mechanism", { exact: true }).selectOption("rubric");
    await model.getByLabel("Doctrine", { exact: true }).selectOption("expert_judgment");
    if (await model.getByLabel("Criterion", { exact: true }).count() === 0) await model.getByRole("button", { name: "Add rubric criterion", exact: true }).click();
    await model.getByLabel("Criterion", { exact: true }).fill("Contingency feasibility");
    await model.getByLabel("Weight", { exact: true }).fill("1");
    await model.getByLabel("Minimum", { exact: true }).fill("0");
    await model.getByLabel("Maximum", { exact: true }).fill("5");
    if (await model.getByRole("button", { name: "Add complete output contract", exact: true }).count()) await model.getByRole("button", { name: "Add complete output contract", exact: true }).click();
    await model.getByLabel("Outcome categories (comma separated)", { exact: true }).fill("accepted, returned");
    await model.getByLabel("Narrative rationale required", { exact: true }).check();
    await model.getByLabel("Confidence required", { exact: true }).check();
    await synchronized(page);
    await model.screenshot({ path: `${evidenceRoot}/energy-rubric.png` });
    expect((await new AxeBuilder({ page }).include("#adjudication").analyze()).violations).toEqual([]);
    checkpoint.energyAuthored = true;
    await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
  }
  if (!checkpoint.energyPublished) {
    await approveAndPublish(page, reviewer.page, checkpoint.energyTitle);
    checkpoint.energyPublished = true;
    await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
  }
  await inspectDesktopControls(page, checkpoint.energyStudioPath);
  await designer.context.close();
  await reviewer.context.close();
  await executeEnergy(browser, baseURL, checkpoint, official);
});

test("PS-830-T01/T02 original and customized Sessions reach verified archive @a11y", async ({ browser, baseURL }) => {
  const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
  expect(checkpoint.energyRubricCompleted).toBe(true);
  const official = JSON.parse(await readFile("definitions/fractured-order/fractured-order-release.json", "utf8"));
  await completeEnergy(browser, baseURL, checkpoint);
  await beginOriginal(browser, baseURL, checkpoint, official);
  await completeOriginal(browser, baseURL, checkpoint, official);
  expect(checkpoint.energyArchived).toBe(true);
  expect(checkpoint.originalArchived).toBe(true);
  expect(checkpoint.originalOrganizationArchive).toBeTruthy();
});
