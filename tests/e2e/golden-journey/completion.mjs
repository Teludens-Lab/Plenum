import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { command, enterRole, fillIndustryPlan, persona, stageAction } from "./execution.mjs";

const root = "output/playwright/golden-journey";
const path = "test-results/golden-journey/studio-checkpoint.json";
async function save(checkpoint) { await writeFile(path, JSON.stringify(checkpoint, null, 2)); }

async function lifecycle(page, operation, reason) {
  const control = page.getByRole("region", { name: "Session control", exact: true });
  await control.getByLabel("Next valid action", { exact: true }).selectOption(operation);
  await control.getByLabel("Reason", { exact: true }).fill(reason);
  await control.getByLabel("Confirm this authoritative lifecycle change.").check();
  return command(page, () => control.getByRole("button", { name: "Apply Session control", exact: true }).click(), operation);
}

async function downloadReport(page, kind, format, basename) {
  await page.getByLabel("Report", { exact: true }).selectOption(kind);
  await page.getByLabel("Format", { exact: true }).selectOption(format);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generate and download", exact: true }).click();
  const file = await pending;
  const bytes = await readFile(await file.path());
  expect(bytes.byteLength).toBeGreaterThan(100);
  await writeFile(`${root}/${basename}`, bytes);
  await expect(page.getByRole("heading", { name: "Generated artifacts", exact: true })).toBeVisible();
  return { kind, format, filename: file.suggestedFilename(), bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex") };
}

async function completeSession(page, title, sessionPath, checkpoint, prefix) {
  await page.goto(`/admin${sessionPath}`);
  await expect(page.getByRole("region", { name: "Session control", exact: true })).toBeVisible();
  if (!checkpoint[`${prefix}Completed`]) {
    const stage = page.locator("#stage-control-title").locator("..");
    const option = (operation) => page.getByRole("region", { name: "Session control", exact: true })
      .getByLabel("Next valid action", { exact: true }).locator(`option[value="${operation}"]`);
    if (!checkpoint[`${prefix}StageTransition`] && await option("session.pause").count() &&
      await stage.getByLabel("Stage action", { exact: true }).locator('option[value="stage.advance"]').count()) {
      await stageAction(page, "stage.advance");
      await page.screenshot({ path: `${root}/${prefix}-stage-transition.png` });
      checkpoint[`${prefix}StageTransition`] = true;
      await save(checkpoint);
    }
    if (await option("session.pause").count()) {
      await lifecycle(page, "session.pause", `Pause ${title} to verify Session lifecycle fencing.`);
      await expect(option("session.resume")).toHaveCount(1);
    }
    if (await option("session.resume").count()) {
      await lifecycle(page, "session.resume", `Resume ${title} after the controlled pause.`);
      await expect(option("session.pause")).toHaveCount(1);
    }
    if (await option("session.complete").count()) {
      await lifecycle(page, "session.complete", `Complete ${title} after recorded participant and reviewer work.`);
      await expect(option("session.lock")).toHaveCount(1);
    }
    if (await option("session.lock").count()) await lifecycle(page, "session.lock", `Lock ${title} before generating and archiving its final records.`);
    checkpoint[`${prefix}Completed`] = true;
    await save(checkpoint);
  }
  if (!checkpoint[`${prefix}Reports`]) {
    await page.goto(`/admin${sessionPath}/reports`);
    const reports = [];
    for (const [kind, format, filename] of [
      ["after_action", "json", `${prefix}-after-action.json`],
      ["session_archive", "zip", `${prefix}-session-archive.zip`],
      ["control", "csv", `${prefix}-control.csv`],
      ["team", "pdf", `${prefix}-team.pdf`],
      ["after_action", "html", `${prefix}-after-action.html`]
    ]) reports.push(await downloadReport(page, kind, format, filename));
    checkpoint[`${prefix}Reports`] = reports;
    await save(checkpoint);
    await page.screenshot({ path: `${root}/${prefix}-report-provenance.png` });
  }
  if (!checkpoint[`${prefix}Replay`]) {
    await page.goto(`/admin${sessionPath}/replay`);
    await page.getByRole("button", { name: "Run replay", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Matched" }).last()).toBeVisible();
    await expect(page.getByText("No differences were found between captured and replayed history.", { exact: true })).toBeVisible();
    checkpoint[`${prefix}Replay`] = true;
    await save(checkpoint);
    await page.screenshot({ path: `${root}/${prefix}-replay.png` });
  }
  if (!checkpoint[`${prefix}Archived`]) {
    await page.goto(`/admin${sessionPath}/archive`);
    await expect(page.getByRole("heading", { name: "Archive Session", exact: true })).toBeVisible();
    await page.getByLabel("Archive reason", { exact: true }).fill(`Preserve the completed ${title} golden journey.`);
    await page.getByLabel("I understand this removes the Session from active operations.").check();
    await command(page, () => page.getByRole("button", { name: "Confirm archive", exact: true }).click(), "session.archive");
    await expect(page.getByRole("button", { name: "Session archived", exact: true })).toBeVisible();
    checkpoint[`${prefix}Archived`] = true;
    await save(checkpoint);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `${root}/${prefix}-archived.png` });
  }
}

export async function completeEnergy(browser, baseURL, checkpoint) {
  const operator = await persona(browser, "operator", baseURL);
  try {
    if (!checkpoint.energyRoleInspection) {
      const assignments = [
        ["author", "Blue Scribe", "Scribe"], ["redAuthor", "Red Scribe", "Scribe"],
        ["designerA", "Green Scribe", "Scribe"], ["designerB", "Industry Scribe", "Scribe"],
        ["reviewer", "Blue Facilitator", "Facilitator"], ["redReviewer", "Red Facilitator", "Facilitator"],
        ["greenReviewer", "Green Facilitator", "Facilitator"], ["publisher", "Industry Facilitator", "Facilitator"],
        ["finalReviewer", "Control", "White Cell"], ["codeParticipant", "Blue Second Facilitator", "Facilitator"],
        ["blueNotetaker", "Blue Notetaker", "Notetaker"]
      ];
      const coverage = [];
      for (const [person, seat, role] of assignments) {
        const actor = await persona(browser, person, baseURL);
        try {
          await enterRole(actor, checkpoint.energyTitle, seat, seat === "Control" ? "White Cell" : seat === "Blue Second Facilitator" ? "Blue Facilitator" : seat);
          await expect(actor.page.getByRole("button", { name: "Refresh authoritative state", exact: true })).toBeVisible();
          expect((await new AxeBuilder({ page: actor.page }).analyze()).violations).toEqual([]);
          await actor.page.screenshot({ path: `${root}/energy-role-${person}.png` });
          coverage.push({ person, seat, role, artifact: `energy-role-${person}.png` });
        } finally { await actor.context.close(); }
      }
      checkpoint.energyRoleInspection = coverage;
      await save(checkpoint);
    }
    await completeSession(operator.page, checkpoint.energyTitle, checkpoint.energySessionPath, checkpoint, "energy");
    if (!checkpoint.energyOrganizationArchive) {
      await operator.page.goto("/admin/data-policy");
      const pending = operator.page.waitForEvent("download", { timeout: 180_000 });
      await operator.page.getByRole("link", { name: "Export portable archive", exact: true }).click();
      const download = await pending;
      const compressed = await readFile(await download.path());
      const archive = JSON.parse(gunzipSync(compressed).toString("utf8"));
      expect(archive.archiveVersion).toBe(2);
      expect(archive.databaseSchema).toBe("plenum-042");
      const sessionId = checkpoint.energySessionPath.split("/").at(-1);
      expect(archive.data.sessions.find(({ id }) => id === sessionId)?.status).toBe("archived");
      expect(archive.data.artifacts.some(({ session_id }) => session_id === sessionId)).toBe(true);
      expect(archive.data.adjudicationRecords.some(({ session_id }) => session_id === sessionId)).toBe(true);
      expect(archive.data.commandReceipts.some(({ session_id }) => session_id === sessionId)).toBe(true);
      await writeFile(`${root}/energy-organization-archive.json.gz`, compressed);
      checkpoint.energyOrganizationArchive = { filename: download.suggestedFilename(), bytes: compressed.byteLength,
        sha256: createHash("sha256").update(compressed).digest("hex") };
      await save(checkpoint);
    }
  } finally { await operator.context.close(); }
}

export async function beginOriginal(browser, baseURL, checkpoint, official) {
  const operator = await persona(browser, "operator", baseURL);
  try {
    const page = operator.page;
    if (!checkpoint.originalSessionPath) {
      await page.goto("/?workspace=lifecycle");
      const release = page.locator("#release-catalog .lifecycle-row").filter({ hasText: checkpoint.originalTitle });
      await release.getByRole("button", { name: "Create Session from this Release", exact: true }).click();
      await release.getByLabel("Session name", { exact: true }).fill(checkpoint.originalTitle);
      await release.getByRole("button", { name: "Create configured Session", exact: true }).click();
      await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/u);
      checkpoint.originalSessionPath = new URL(page.url()).pathname;
      await save(checkpoint);
    }
    await page.goto(`/admin${checkpoint.originalSessionPath}`);
    if (!checkpoint.originalStarted) {
      await page.getByText("Open direct assignment form", { exact: true }).click();
      const form = page.getByRole("heading", { name: "Assign participant", exact: true }).locator("..");
      for (const [person, seat, role] of [
        ["Synthetic Blue author", "Blue Scribe", "Scribe"], ["Synthetic Red author", "Red Scribe", "Scribe"],
        ["Synthetic Designer A", "Green Scribe", "Scribe"], ["Synthetic Designer B", "Industry Scribe", "Scribe"],
        ["Synthetic Blue reviewer", "Blue Facilitator", "Facilitator"], ["Synthetic Red reviewer", "Red Facilitator", "Facilitator"],
        ["Synthetic Green reviewer", "Green Facilitator", "Facilitator"], ["Synthetic Publisher", "Industry Facilitator", "Facilitator"],
        ["Synthetic final reviewer", "Control", "White Cell"], ["Synthetic Blue notetaker", "Blue Notetaker", "Notetaker"]
      ]) {
        const active = page.getByRole("heading", { name: "Active assignments", exact: true }).locator("xpath=following-sibling::ul[1]");
        if (await active.locator("strong").filter({ hasText: new RegExp(`^${seat}$`, "u") }).count()) continue;
        await form.getByLabel("Participant name", { exact: true }).selectOption({ label: person });
        await form.getByLabel("Seat", { exact: true }).selectOption({ label: seat });
        await form.getByLabel("Session Role", { exact: true }).selectOption({ label: role });
        await command(page, () => form.getByRole("button", { name: "Assign Seat", exact: true }).click(), "participant.assign");
      }
      const readiness = page.getByRole("region", { name: "Operator readiness", exact: true });
      while (await readiness.getByRole("button", { name: "Confirm", exact: true }).count()) {
        const buttons = readiness.getByRole("button", { name: "Confirm", exact: true });
        const count = await buttons.count();
        await buttons.first().click();
        await expect(buttons).toHaveCount(count - 1);
      }
      const ready = readiness.getByRole("button", { name: "Mark Session ready", exact: true });
      if (await ready.count()) await command(page, () => ready.click(), "session.ready");
      await command(page, () => readiness.getByRole("button", { name: "Open Session", exact: true }).click(), "session.open");
      await lifecycle(page, "session.start", "Start the unchanged reference design with its original authored rules.");
      checkpoint.originalStarted = true;
      await save(checkpoint);
    }
    if (!checkpoint.originalOrientationComplete) {
      const stage = page.locator("#stage-control-title").locator("..");
      if (await stage.getByLabel("Stage action", { exact: true }).locator('option[value="stage.start"]').count()) await stageAction(page, "stage.start");
      const scribe = await persona(browser, "designerB", baseURL);
      const facilitator = await persona(browser, "publisher", baseURL);
      try {
        await enterRole(scribe, checkpoint.originalTitle, "Industry Scribe");
        await enterRole(facilitator, checkpoint.originalTitle, "Industry Facilitator");
        checkpoint.originalSectorsSubmitted ??= [];
        for (const sector of ["Agriculture", "Telecommunications", "Biotechnology"]) {
          if (checkpoint.originalSectorsSubmitted.includes(sector)) continue;
          await scribe.page.getByRole("button", { name: "Strategic Orientation", exact: true }).click();
          const dialog = scribe.page.getByRole("dialog", { name: "Strategic Orientation", exact: true });
          await dialog.getByRole("button").filter({ hasText: sector }).click();
          const editor = await fillIndustryPlan(dialog, official.coreDesign.forms.find(({ id }) => id === "form-industry-orientation"));
          await command(scribe.page, () => editor.getByRole("button", { name: "Save draft", exact: true }).click(), "artifact.create");
          if (await dialog.isVisible()) await dialog.getByRole("button", { name: "Close Strategic Orientation", exact: true }).click();
          const record = scribe.page.locator("article.artifact[aria-labelledby]").filter({ hasText: sector });
          await expect(record).toBeVisible();
          await command(scribe.page, () => record.getByRole("button", { name: "Submit to Team Facilitator", exact: true }).click(), "artifact.submit");
          await facilitator.page.getByRole("button", { name: "Refresh authoritative state", exact: true }).click();
          const review = facilitator.page.locator("article.artifact[aria-labelledby]").filter({ hasText: sector });
          await expect(review).toBeVisible();
          await command(facilitator.page, () => review.getByRole("button", { name: "Forward to White Cell", exact: true }).click(), "artifact.forward");
          checkpoint.originalSectorsSubmitted.push(sector);
          await save(checkpoint);
        }
      } finally { await scribe.context.close(); await facilitator.context.close(); }
      await page.reload();
      await stageAction(page, "stage.advance");
      checkpoint.originalOrientationComplete = true;
      await save(checkpoint);
    }
  } finally { await operator.context.close(); }
}

async function originalDecisionRecords(browser, baseURL, checkpoint) {
  if (checkpoint.originalAdjudicationCompleted) return;
  const blue = await persona(browser, "author", baseURL);
  const facilitator = await persona(browser, "reviewer", baseURL);
  const control = await persona(browser, "finalReviewer", baseURL);
  try {
    await enterRole(blue, checkpoint.originalTitle, "Blue Scribe");
    await enterRole(facilitator, checkpoint.originalTitle, "Blue Facilitator");
    for (const title of ["Reference continuity action", "Reference diplomatic action"]) {
      if (!(checkpoint.originalDecisionsForwarded ?? []).includes(title)) {
        await blue.page.getByRole("button", { name: "Take Action", exact: true }).click();
        const dialog = blue.page.getByRole("dialog", { name: "Take Action", exact: true });
        await dialog.getByLabel(/^Action title/u).fill(title);
        await dialog.getByLabel(/^Objective/u).fill(`Coordinate ${title.toLowerCase()} with a recorded implementation and review milestone.`);
        await dialog.getByRole("group", { name: /^Instrument of Power/u }).getByLabel("Economic", { exact: true }).check();
        await dialog.getByRole("button", { name: "Next", exact: true }).click();
        await dialog.getByRole("radiogroup", { name: /Does this action/u }).getByLabel("No", { exact: true }).check();
        await dialog.getByRole("group", { name: /^(Focus sectors|Sectors)( \*)?$/u }).getByLabel("Agriculture", { exact: true }).check();
        await dialog.getByRole("button", { name: "Next", exact: true }).click();
        await dialog.getByLabel("Implementation *", { exact: true }).selectOption("executive_order");
        await dialog.getByRole("group", { name: /^Focus countries/u }).getByLabel("EU", { exact: true }).check();
        await dialog.getByLabel(/^Expected outcomes/u).fill("Diversified continuity with measurable milestones and a White Cell review.");
        await command(blue.page, () => dialog.getByRole("button", { name: "Save draft", exact: true }).click(), "artifact.create");
        if (await dialog.isVisible()) await dialog.getByRole("button", { name: "Close Take Action", exact: true }).click();
        const record = blue.page.locator("article.artifact[aria-labelledby]").filter({ hasText: title });
        await command(blue.page, () => record.getByRole("button", { name: "Submit to Team Facilitator", exact: true }).click(), "artifact.submit");
        await facilitator.page.getByRole("button", { name: "Refresh authoritative state", exact: true }).click();
        const review = facilitator.page.locator("article.artifact[aria-labelledby]").filter({ hasText: title });
        await command(facilitator.page, () => review.getByRole("button", { name: "Forward to White Cell", exact: true }).click(), "artifact.forward");
        checkpoint.originalDecisionsForwarded ??= [];
        checkpoint.originalDecisionsForwarded.push(title);
        await save(checkpoint);
      }
    }
    await enterRole(control, checkpoint.originalTitle, "Control", "White Cell");
    const review = control.page.locator("article.adjudication").filter({ hasText: "Authorized adjudicator review" });
    if (await review.count() === 0) {
      await control.page.getByLabel("Adjudication model", { exact: true }).selectOption({ label: "Authorized adjudicator review" });
      const choices = await control.page.getByLabel("Action to adjudicate", { exact: true }).locator("option").allTextContents();
      const first = choices.find((label) => label.includes("Reference continuity action"));
      expect(first).toBeTruthy();
      await control.page.getByLabel("Action to adjudicate", { exact: true }).selectOption({ label: first });
      await control.page.getByText("Include additional Decision Records", { exact: true }).click();
      await control.page.getByRole("checkbox", { name: /Reference diplomatic action/u }).check();
      await expect(control.page.getByText("2 selected.", { exact: false })).toBeVisible();
      await command(control.page, () => control.page.getByRole("button", { name: "Start adjudication", exact: true }).click(), "adjudication.request");
    }
    await expect(review.getByText("Reference continuity action", { exact: true })).toBeVisible();
    await expect(review.getByText("Reference diplomatic action", { exact: true })).toBeVisible();
    await expect(review.locator("dl.metadata dd").first()).toHaveText("2");
    if (await review.getByText("No reviewer input has been submitted.", { exact: true }).count()) {
      await review.getByLabel("Recommendation", { exact: true }).fill("Accept both Actions with recorded follow-up milestones.");
      await review.getByLabel("Rationale", { exact: true }).fill("The two separately submitted Decision Records support a joint continuity response.");
      await command(control.page, () => review.getByRole("button", { name: "Submit reviewer input", exact: true }).click(), "adjudication.review");
    }
    if (await review.getByRole("heading", { name: "Published outcome", exact: true }).count() === 0) {
      await review.getByLabel("Final outcome", { exact: true }).fill("accepted");
      await review.getByLabel("Decision rationale", { exact: true }).fill("Both Actions passed authorized review and may proceed with monitored effects.");
      await review.getByLabel("Participant-facing rationale", { exact: true }).fill("Proceed with the coordinated actions and report progress at the next review.");
      await review.getByLabel("Reviewer synthesis", { exact: true }).fill("One reviewer input considers two independently versioned Actions.");
      await command(control.page, () => review.getByRole("button", { name: "Save draft synthesis", exact: true }).click(), "adjudication.draft");
      await command(control.page, () => review.getByRole("button", { name: "Publish outcome and effects", exact: true }).click(), "adjudication.publish");
    }
    await expect(review.getByRole("heading", { name: "Published outcome", exact: true })).toBeVisible();
    await control.page.screenshot({ path: `${root}/original-multi-record-adjudication.png` });
    checkpoint.originalAdjudicationCompleted = true;
    await save(checkpoint);
  } finally { for (const actor of [blue, facilitator, control]) await actor.context.close(); }
}

async function fillTurnSheet(dialog, form, sector) {
  const editor = dialog.locator("section.workspace-section:visible").first();
  for (let pageIndex = 0; pageIndex <= 2; pageIndex++) {
    const fields = form.sections.filter((section) => section.page === pageIndex && !section.collapsed).flatMap((section) => section.fields);
    for (const field of fields) {
      if (!field.required || field.readOnly) continue;
      const label = `${field.label} *`;
      if (field.type === "single_select") {
        const selected = field.key === "industryCellId"
          ? field.options.find((option) => option.label === sector)
          : field.options.find((option) => option.label === "No") ?? field.options[0];
        expect(selected, label).toBeTruthy();
        const control = editor.getByRole("combobox", { name: label, exact: true });
        if (field.control === "select" || field.options.length > 4 || await control.count()) {
          if (await control.isVisible()) await control.selectOption(selected.value);
        } else {
          const radio = editor.getByRole("radiogroup", { name: label, exact: true }).getByRole("radio", { name: selected.label, exact: true });
          if (await radio.isVisible()) await radio.check();
        }
      } else if (field.type === "multi_select") {
        const first = field.options[0];
        const choice = editor.getByRole("group", { name: label, exact: true }).getByLabel(first.label, { exact: true });
        if (await choice.isVisible()) await choice.check();
      } else {
        const input = editor.getByLabel(label, { exact: true });
        if (await input.isVisible()) await input.fill(field.key === "strategicPlanId"
          ? `Completed ${sector} strategic plan` : field.type === "number" ? "1"
            : `Synthetic ${sector} assessment: ${field.label}. Continue monitored diversification and review.`);
      }
    }
    await editor.getByRole("button", { name: "Next", exact: true }).click();
    await expect(editor.getByText(`Page ${pageIndex + 2} of 4`, { exact: true })).toBeVisible();
  }
  return editor;
}

async function originalTurnSheets(browser, baseURL, checkpoint, official, move) {
  const scribe = await persona(browser, "designerB", baseURL);
  const facilitator = await persona(browser, "publisher", baseURL);
  try {
    await enterRole(scribe, checkpoint.originalTitle, "Industry Scribe");
    await enterRole(facilitator, checkpoint.originalTitle, "Industry Facilitator");
    for (const sector of ["Agriculture", "Telecommunications", "Biotechnology"]) {
      const key = `${move}:${sector}`;
      if ((checkpoint.originalTurnSheetsForwarded ?? []).includes(key)) continue;
      await scribe.page.getByRole("button", { name: "Take Action", exact: true }).click();
      const dialog = scribe.page.getByRole("dialog", { name: "Take Action", exact: true });
      await dialog.getByRole("button", { name: `Industry Turn Sheet / Proposal · ${sector}`, exact: true }).click();
      const editor = await fillTurnSheet(dialog, official.coreDesign.forms.find(({ id }) => id === "form-industry-turn-sheet"), sector);
      await command(scribe.page, () => editor.getByRole("button", { name: "Save draft", exact: true }).click(), "artifact.create");
      if (await dialog.isVisible()) await dialog.getByRole("button", { name: "Close Take Action", exact: true }).click();
      const pending = scribe.page.locator("article.artifact[aria-labelledby]").filter({ hasText: sector })
        .filter({ has: scribe.page.getByRole("button", { name: "Submit to Team Facilitator", exact: true }) });
      await expect(pending).toHaveCount(1);
      await command(scribe.page, () => pending.getByRole("button", { name: "Submit to Team Facilitator", exact: true }).click(), "artifact.submit");
      await facilitator.page.getByRole("button", { name: "Refresh authoritative state", exact: true }).click();
      const review = facilitator.page.locator("article.artifact[aria-labelledby]").filter({ hasText: sector })
        .filter({ has: facilitator.page.getByRole("button", { name: "Forward to White Cell", exact: true }) });
      await expect(review).toHaveCount(1);
      await command(facilitator.page, () => review.getByRole("button", { name: "Forward to White Cell", exact: true }).click(), "artifact.forward");
      checkpoint.originalTurnSheetsForwarded ??= [];
      checkpoint.originalTurnSheetsForwarded.push(key);
      await save(checkpoint);
    }
  } finally { await scribe.context.close(); await facilitator.context.close(); }
}

export async function completeOriginal(browser, baseURL, checkpoint, official) {
  await originalDecisionRecords(browser, baseURL, checkpoint);
  const operator = await persona(browser, "operator", baseURL);
  try {
    const page = operator.page;
    for (const move of [1, 2, 3]) {
      if ((checkpoint.originalMovesCompleted ?? []).includes(move)) continue;
      await page.goto(`/admin${checkpoint.originalSessionPath}`);
      const stage = page.locator("#stage-control-title").locator("..");
      if (await stage.getByLabel("Stage action", { exact: true }).locator('option[value="stage.start"]').count()) await stageAction(page, "stage.start");
      await originalTurnSheets(browser, baseURL, checkpoint, official, move);
      await page.reload();
      for (let transition = checkpoint.originalStageTransitions?.[move] ?? 0; transition < (move === 3 ? 4 : 5); transition++) {
        if (await stage.getByLabel("Stage action", { exact: true }).locator('option[value="stage.start"]').count()) await stageAction(page, "stage.start");
        await stageAction(page, "stage.advance");
        checkpoint.originalStageTransitions ??= {};
        checkpoint.originalStageTransitions[move] = transition + 1;
        await save(checkpoint);
      }
      if (move < 3 && await stage.getByLabel("Stage action", { exact: true }).locator('option[value="stage.start"]').count()) await stageAction(page, "stage.start");
      if (move === 3) {
        if (await stage.getByLabel("Stage action", { exact: true }).locator('option[value="stage.start"]').count()) await stageAction(page, "stage.start");
        await expect(stage.getByLabel("Stage action", { exact: true }).locator('option[value="stage.end"]')).toHaveCount(1);
        await stageAction(page, "stage.end");
      }
      checkpoint.originalMovesCompleted ??= [];
      checkpoint.originalMovesCompleted.push(move);
      await save(checkpoint);
      await page.screenshot({ path: `${root}/original-move-${move}-complete.png` });
    }
    await completeSession(page, checkpoint.originalTitle, checkpoint.originalSessionPath, checkpoint, "original");
    if (!checkpoint.originalOrganizationArchive) {
      await page.goto("/admin/data-policy");
      const pending = page.waitForEvent("download", { timeout: 180_000 });
      await page.getByRole("link", { name: "Export portable archive", exact: true }).click();
      const download = await pending;
      const compressed = await readFile(await download.path());
      const archive = JSON.parse(gunzipSync(compressed).toString("utf8"));
      const sessionId = checkpoint.originalSessionPath.split("/").at(-1);
      expect(archive.archiveVersion).toBe(2);
      expect(archive.data.sessions.find(({ id }) => id === sessionId)?.status).toBe("archived");
      expect(archive.data.artifacts.some(({ session_id }) => session_id === sessionId)).toBe(true);
      expect(archive.data.adjudicationRecords.some(({ session_id }) => session_id === sessionId)).toBe(true);
      await writeFile(`${root}/original-organization-archive.json.gz`, compressed);
      checkpoint.originalOrganizationArchive = { filename: download.suggestedFilename(), bytes: compressed.byteLength,
        sha256: createHash("sha256").update(compressed).digest("hex") };
      await save(checkpoint);
    }
  } finally { await operator.context.close(); }
}
