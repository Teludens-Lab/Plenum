import { writeFile } from "node:fs/promises";
import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture } from "../fixture.mjs";

const root = "output/playwright/golden-journey";
const path = "test-results/golden-journey/studio-checkpoint.json";
async function save(checkpoint) { await writeFile(path, JSON.stringify(checkpoint, null, 2)); }
export async function persona(browser, key, baseURL) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1024, height: 768 },
    extraHTTPHeaders: { Authorization: `Bearer ${fixture.tokens[key]}` } });
  context.setDefaultTimeout(30_000);
  return { context, page: await context.newPage() };
}
export async function command(page, click, operation, expected = "accepted") {
  const response = page.waitForResponse((response) => {
    if (response.request().method() !== "POST") return false;
    try { return response.request().postDataJSON()?.operationType === operation; } catch { return false; }
  });
  await click();
  const body = await (await response).json();
  const receipt = body.receipt ?? body;
  expect(receipt.status, JSON.stringify(body)).toBe(expected);
  return receipt;
}
export async function enterRole(actor, title, seat, entryLabel = seat) {
  await actor.page.goto("/?workspace=participant");
  const session = actor.page.getByRole("article", { name: title, exact: true });
  const chooser = actor.page.getByRole("navigation", { name: "Your Sessions" }).getByRole("button").filter({ hasText: title });
  await expect(session.or(chooser).first()).toBeVisible();
  if (!await session.isVisible()) await chooser.click();
  await session.getByRole("link", { name: entryLabel, exact: true }).click();
  await expect(actor.page.getByRole("button", { name: "Refresh authoritative state", exact: true })).toBeVisible();
}
export async function stageAction(page, operation, expected = "accepted") {
  const stage = page.locator("#stage-control-title").locator("..");
  const select = stage.getByLabel("Stage action", { exact: true });
  if (operation === "stage.advance") await select.locator('option[value="stage.advance"], option[value="stage.skip"]').first().waitFor({ state: "attached" });
  const actualOperation = operation === "stage.advance" && !await select.locator('option[value="stage.advance"]').count() &&
    await select.locator('option[value="stage.skip"]').count() ? "stage.skip" : operation;
  const beforeTitle = operation === "stage.advance" ? await page.locator("#stage-control-title").textContent() : null;
  await select.selectOption(actualOperation);
  if (operation === "stage.advance") {
    const choices = await stage.getByLabel("Transition target", { exact: true }).locator("option").evaluateAll((options) => options.map((option) => option.value).filter(Boolean));
    await stage.getByLabel("Transition target", { exact: true }).selectOption(choices[0]);
  }
  await stage.getByLabel("Reason", { exact: true }).fill("PS-830 exercise of authored Stage completion rules.");
  await stage.getByLabel("Confirm the previewed Stage intervention.").check();
  const receipt = await command(page, () => stage.getByRole("button", { name: "Apply Stage control", exact: true }).click(), actualOperation, expected);
  if (operation === "stage.advance" && expected === "accepted" && beforeTitle !== null) await expect(page.locator("#stage-control-title")).not.toHaveText(beforeTitle);
  return receipt;
}
export async function fillIndustryPlan(dialog, form) {
  const editor = dialog.locator("section.workspace-section:visible").first();
  for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
    for (const field of form.sections.filter((section) => section.page === pageIndex && !section.collapsed).flatMap((section) => section.fields)) {
      if (!field.required || field.readOnly) continue;
      if (field.type === "single_select") {
        const choice = field.options[(Number(field.key.match(/^risks\.(\d)\.type$/u)?.[1]) || 0) % field.options.length];
        if (field.control === "select" || field.options.length > 4) await editor.getByRole("combobox", { name: `${field.label} *`, exact: true }).selectOption(choice.value);
        else await editor.getByRole("radiogroup", { name: `${field.label} *`, exact: true }).getByRole("radio", { name: choice.label, exact: true }).check();
      } else if (field.type === "number" && field.control === "cards") await editor.getByRole("radiogroup", { name: `${field.label} *`, exact: true }).getByRole("radio", { name: "3", exact: true }).check();
      else await editor.getByLabel(`${field.label} *`, { exact: true }).fill(`Synthetic exercise: ${field.label}. Maintain continuity through diversified suppliers and agreed review milestones.`);
    }
    await editor.getByRole("button", { name: "Next", exact: true }).click();
    await expect(editor.getByText(`Page ${pageIndex + 2} of 6`, { exact: true })).toBeVisible();
  }
  return editor;
}

export async function executeEnergy(browser, baseURL, checkpoint, official) {
  const admin = await persona(browser, "operator", baseURL);
  const page = admin.page;
  if (!checkpoint.energySessionPath) {
    await page.goto("/?workspace=lifecycle");
    const release = page.locator("#release-catalog .lifecycle-row").filter({ hasText: checkpoint.energyTitle });
    await release.getByRole("button", { name: "Create Session from this Release", exact: true }).click();
    await release.getByLabel("Session name", { exact: true }).fill(checkpoint.energyTitle);
    await release.getByRole("button", { name: "Create configured Session", exact: true }).click();
    await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/u);
    checkpoint.energySessionPath = new URL(page.url()).pathname;
    await save(checkpoint);
  }
  await page.goto(`/admin${checkpoint.energySessionPath}`);
  const control = page.getByRole("region", { name: "Session control", exact: true });
  await expect(control).toBeVisible();
  if (!checkpoint.energyStarted) {
    await page.getByText("Open direct assignment form", { exact: true }).click();
    const assignment = page.getByRole("heading", { name: "Assign participant", exact: true }).locator("..");
    const assignments = [
      ["Synthetic Blue author", "Blue Scribe", "Scribe"], ["Synthetic Red author", "Red Scribe", "Scribe"],
      ["Synthetic Designer A", "Green Scribe", "Scribe"], ["Synthetic Designer B", "Industry Scribe", "Scribe"],
      ["Synthetic Blue reviewer", "Blue Facilitator", "Facilitator"], ["Synthetic Red reviewer", "Red Facilitator", "Facilitator"],
      ["Synthetic Green reviewer", "Green Facilitator", "Facilitator"], ["Synthetic Publisher", "Industry Facilitator", "Facilitator"],
      ["Synthetic final reviewer", "Control", "White Cell"], ["Synthetic code participant", "Blue Second Facilitator", "Facilitator"],
      ["Synthetic Blue notetaker", "Blue Notetaker", "Notetaker"]
    ];
    for (const [person, seat, role] of assignments) {
      const active = page.getByRole("heading", { name: "Active assignments", exact: true }).locator("xpath=following-sibling::ul[1]");
      const assignedSeat = active.locator("strong").filter({ hasText: new RegExp(`^${seat}$`, "u") });
      if (await assignedSeat.count()) continue;
      await assignment.getByLabel("Participant name", { exact: true }).selectOption({ label: person });
      await assignment.getByLabel("Seat", { exact: true }).selectOption({ label: seat });
      await assignment.getByLabel("Session Role", { exact: true }).selectOption({ label: role });
      await command(page, () => assignment.getByRole("button", { name: "Assign Seat", exact: true }).click(), "participant.assign");
      await expect(assignedSeat).toBeVisible();
    }
    const readiness = page.getByRole("region", { name: "Operator readiness", exact: true });
    while (await readiness.getByRole("button", { name: "Confirm", exact: true }).count()) {
      const count = await readiness.getByRole("button", { name: "Confirm", exact: true }).count();
      await readiness.getByRole("button", { name: "Confirm", exact: true }).first().click();
      await expect(readiness.getByRole("button", { name: "Confirm", exact: true })).toHaveCount(count - 1);
    }
    const ready = readiness.getByRole("button", { name: "Mark Session ready", exact: true });
    if (await ready.count()) {
      await expect(ready).toBeEnabled();
      await command(page, () => ready.click(), "session.ready");
    }
    await command(page, () => readiness.getByRole("button", { name: "Open Session", exact: true }).click(), "session.open");
    await control.getByLabel("Next valid action", { exact: true }).selectOption("session.start");
    await control.getByLabel("Reason", { exact: true }).fill("Start the fully staffed Energy design proof.");
    await control.getByLabel("Confirm this authoritative lifecycle change.").check();
    await command(page, () => control.getByRole("button", { name: "Apply Session control", exact: true }).click(), "session.start");
    checkpoint.energyStarted = true;
    await save(checkpoint);
  }
  const stage = page.locator("#stage-control-title").locator("..");
  if (await stage.getByLabel("Stage action", { exact: true }).locator('option[value="stage.start"]').count()) await stageAction(page, "stage.start");
  const industry = await persona(browser, "designerB", baseURL);
  const facilitator = await persona(browser, "publisher", baseURL);
  await enterRole(industry, checkpoint.energyTitle, "Industry Scribe");
  await enterRole(facilitator, checkpoint.energyTitle, "Industry Facilitator");
  if (!checkpoint.energyOrientationComplete) {
    const blocked = await stageAction(page, "stage.advance", "rejected");
    await writeFile(`${root}/energy-incomplete-orientation-receipt.json`, JSON.stringify(blocked, null, 2));
    checkpoint.energySectorsSubmitted ??= [];
    for (const sector of ["Agriculture", "Telecommunications", "Biotechnology", "Energy"]) {
      if (checkpoint.energySectorsSubmitted.includes(sector)) continue;
      const record = industry.page.locator("article.artifact[aria-labelledby]").filter({ hasText: sector });
      if (await record.count() === 0) {
        await industry.page.getByRole("button", { name: "Strategic Orientation", exact: true }).click();
        const dialog = industry.page.getByRole("dialog", { name: "Strategic Orientation", exact: true });
        await dialog.getByRole("button").filter({ hasText: sector }).click();
        const editor = await fillIndustryPlan(dialog, official.coreDesign.forms.find(({ id }) => id === "form-industry-orientation"));
        await editor.screenshot({ path: `${root}/energy-plan-${sector.toLowerCase()}-review.png` });
        await command(industry.page, () => editor.getByRole("button", { name: "Save draft", exact: true }).click(), "artifact.create");
        if (await dialog.isVisible()) await dialog.getByRole("button", { name: "Close Strategic Orientation", exact: true }).click();
      }
      await expect(record).toBeVisible();
      if (await record.getByRole("button", { name: "Submit to Team Facilitator", exact: true }).count()) {
        await command(industry.page, () => record.getByRole("button", { name: "Submit to Team Facilitator", exact: true }).click(), "artifact.submit");
      }
      await facilitator.page.getByRole("button", { name: "Refresh authoritative state", exact: true }).click();
      const review = facilitator.page.locator("article.artifact[aria-labelledby]").filter({ hasText: sector });
      await expect(review).toBeVisible();
      if (await review.getByRole("button", { name: "Forward to White Cell", exact: true }).count()) {
        await command(facilitator.page, () => review.getByRole("button", { name: "Forward to White Cell", exact: true }).click(), "artifact.forward");
      }
      await expect(review.getByText("With White Cell", { exact: true })).toBeVisible();
      checkpoint.energySectorsSubmitted.push(sector);
      await save(checkpoint);
    }
    await page.reload();
    await stageAction(page, "stage.advance");
    checkpoint.energyOrientationComplete = true;
    await save(checkpoint);
  }
  expect((await new AxeBuilder({ page: industry.page }).analyze()).violations).toEqual([]);
  await industry.page.screenshot({ path: `${root}/energy-runtime-sector-submissions.png`, fullPage: true });
  await industry.context.close(); await facilitator.context.close(); await admin.context.close();
  await executeEnergyAction(browser, baseURL, checkpoint);
}

async function executeEnergyAction(browser, baseURL, checkpoint) {
  if (checkpoint.energyRubricCompleted) return;
  const blue = await persona(browser, "author", baseURL);
  const first = await persona(browser, "reviewer", baseURL);
  const second = await persona(browser, "codeParticipant", baseURL);
  const control = await persona(browser, "finalReviewer", baseURL);
  await enterRole(blue, checkpoint.energyTitle, "Blue Scribe");
  const title = "Energy continuity action";
  const record = blue.page.locator("article.artifact[aria-labelledby]").filter({ hasText: title });
  if (await record.count() === 0) {
    await blue.page.getByRole("button", { name: "Take Action", exact: true }).click();
    const dialog = blue.page.getByRole("dialog", { name: "Take Action", exact: true });
    await dialog.getByLabel(/^Action title/u).fill(title);
    await dialog.getByLabel(/^Objective/u).fill("Preserve reliable energy supply while diversifying critical inputs.");
    await dialog.getByRole("group", { name: /^Instrument of Power/u }).getByLabel("Economic", { exact: true }).check();
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(dialog.getByLabel(/^Contingency plan/u)).toHaveAttribute("aria-invalid", "true");
    await dialog.screenshot({ path: `${root}/energy-runtime-required-contingency.png` });
    await dialog.getByLabel(/^Contingency plan/u).fill("Activate reserve supply agreements, prioritize essential demand and review delivery capacity with the Energy sector.");
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await dialog.getByRole("radiogroup", { name: /Does this action/u }).getByLabel("No", { exact: true }).check();
    await dialog.getByRole("group", { name: /^(Focus sectors|Sectors)( \*)?$/u }).getByLabel("Agriculture", { exact: true }).check();
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await dialog.getByLabel("Implementation *", { exact: true }).selectOption("executive_order");
    await dialog.getByRole("group", { name: /^Focus countries/u }).getByLabel("EU", { exact: true }).check();
    await dialog.getByLabel(/^Expected outcomes/u).fill("Resilient continuity with measurable reserves and accountable delivery milestones.");
    await command(blue.page, () => dialog.getByRole("button", { name: "Save draft", exact: true }).click(), "artifact.create");
    if (await dialog.isVisible()) await dialog.getByRole("button", { name: "Close Take Action", exact: true }).click();
  }
  await expect(record).toBeVisible();
  if (await record.getByRole("button", { name: "Submit to Team Facilitator", exact: true }).count()) {
    await command(blue.page, () => record.getByRole("button", { name: "Submit to Team Facilitator", exact: true }).click(), "artifact.submit");
  }
  await enterRole(first, checkpoint.energyTitle, "Blue Facilitator");
  await enterRole(second, checkpoint.energyTitle, "Blue Second Facilitator", "Blue Facilitator");
  const firstRecord = first.page.locator("article.artifact[aria-labelledby]").filter({ hasText: title });
  const secondRecord = second.page.locator("article.artifact[aria-labelledby]").filter({ hasText: title });
  if (await secondRecord.getByRole("button", { name: "Forward to White Cell", exact: true }).count()) {
    await expect(firstRecord.getByRole("button", { name: "Forward to White Cell", exact: true })).toBeVisible();
    await secondRecord.screenshot({ path: `${root}/energy-shared-facilitator-custody.png` });
    const contingency = secondRecord.getByRole("definition").filter({ hasText: "Activate reserve supply agreements, prioritize essential demand and review delivery capacity with the Energy sector." });
    await expect(contingency).toBeVisible();
    await contingency.scrollIntoViewIfNeeded();
    await second.page.screenshot({ path: `${root}/energy-facilitator-contingency-viewport.png` });
    await command(second.page, () => secondRecord.getByRole("button", { name: "Forward to White Cell", exact: true }).click(), "artifact.forward");
    await first.page.getByRole("button", { name: "Refresh authoritative state", exact: true }).click();
    await expect(firstRecord.getByRole("button", { name: "Forward to White Cell", exact: true })).toHaveCount(0);
  }
  await enterRole(control, checkpoint.energyTitle, "Control", "White Cell");
  const review = control.page.locator("article.adjudication").filter({ hasText: "Energy contingency rubric" });
  if (await review.count() === 0) {
    await control.page.getByLabel("Adjudication model", { exact: true }).selectOption({ label: "Energy contingency rubric" });
    const choices = await control.page.getByLabel("Action to adjudicate", { exact: true }).locator("option").allTextContents();
    const choice = choices.find((label) => label.includes(title));
    expect(choice).toBeTruthy();
    await control.page.getByLabel("Action to adjudicate", { exact: true }).selectOption({ label: choice });
    await command(control.page, () => control.page.getByRole("button", { name: "Start adjudication", exact: true }).click(), "adjudication.request");
  }
  await expect(review).toBeVisible();
  if (await review.getByText("No reviewer input has been submitted.", { exact: true }).count()) {
    await review.getByLabel("Recommendation", { exact: true }).fill("Accept with the reserve-supply contingency retained.");
    await review.getByLabel("Rationale", { exact: true }).fill("The submitted Action includes a specific fallback and accountable delivery milestones.");
    await command(control.page, () => review.getByRole("button", { name: "Submit reviewer input", exact: true }).click(), "adjudication.review");
  }
  await expect(review.getByText("Reviewer inputs (1)", { exact: true })).toBeVisible();
  if (await review.getByRole("heading", { name: "Published outcome", exact: true }).count() === 0) {
    await review.getByLabel("Contingency feasibility", { exact: true }).fill("4");
    await review.getByLabel("Final outcome", { exact: true }).fill("accepted");
    await review.getByLabel("Decision rationale", { exact: true }).fill("Approved following the authorized White Cell review of the contingency and the rubric score.");
    await review.getByLabel("Participant-facing rationale", { exact: true }).fill("Proceed with reserve agreements and report progress at the next review.");
    await review.getByLabel("Reviewer synthesis", { exact: true }).fill("The reviewer and lead synthesis agree on the proposed contingency.");
    await review.getByLabel(/^Override rationale/u).fill("The numerical suggestion informs the authorized categorical acceptance; the lead retains responsibility for the result.");
    await command(control.page, () => review.getByRole("button", { name: "Save draft synthesis", exact: true }).click(), "adjudication.draft");
    await expect(review.getByText("Weighted rubric score: 4", { exact: true })).toBeVisible();
    await command(control.page, () => review.getByRole("button", { name: "Publish outcome and effects", exact: true }).click(), "adjudication.publish");
  }
  await expect(review.getByRole("heading", { name: "Published outcome", exact: true })).toBeVisible();
  await review.screenshot({ path: `${root}/energy-published-rubric-outcome.png` });
  await review.getByRole("heading", { name: "Published outcome", exact: true }).scrollIntoViewIfNeeded();
  await control.page.screenshot({ path: `${root}/energy-published-rubric-viewport.png` });
  expect((await new AxeBuilder({ page: control.page }).analyze()).violations).toEqual([]);
  checkpoint.energyRubricCompleted = true;
  await save(checkpoint);
  for (const actor of [blue, first, second, control]) await actor.context.close();
}
