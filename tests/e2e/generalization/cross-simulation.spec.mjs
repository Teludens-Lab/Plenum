import { mkdir, readFile, writeFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { persona, command, enterRole, stageAction } from "../golden-journey/execution.mjs";
import { runtimeSourceHash } from "./source-evidence.mjs";

const root = "output/playwright/ps-840";
const exact = (name) => ({ name, exact: true });
let sourceBefore;
test.beforeAll(async () => { sourceBefore = await runtimeSourceHash(); });
test.afterEach(async ({}, testInfo) => {
  const sourceAfter = await runtimeSourceHash();
  expect(sourceAfter).toEqual(sourceBefore);
  await testInfo.attach("Runtime source continuity", { body: JSON.stringify({ before: sourceBefore, after: sourceAfter }), contentType: "application/json" });
});
async function workspace(page, label, region = label) {
  console.log(`Studio workspace: ${label}`);
  await page.getByRole("combobox", exact("Design workspace")).selectOption({ label });
  const target = page.getByRole("region", exact(region));
  await expect(target).toBeVisible();
  return target;
}
async function synced(page) {
  await expect(page.locator(".studio-draft-status")).toBeVisible();
  await expect(page.locator(".studio-draft-status")).not.toContainText("waiting to synchronize", { timeout: 90_000 });
}
async function addItem(region, button) {
  await region.getByRole("button", exact(button)).click();
  const item = region.locator("details.editor-item").last();
  if (await item.getAttribute("open") === null) await item.locator("summary").first().click();
  return item;
}
async function capture(page, name) {
  await synced(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${root}/${name}.png`, fullPage: true });
}
async function adaptiveCapture(page, name) {
  await page.setViewportSize({ width: 512, height: 384 });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${root}/${name}-200-percent.png`, fullPage: true });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference" });
}
async function author(page, kind) {
  const crisis = kind === "crisis-response";
  const title = crisis ? "PS-840 Flood response" : "PS-840 Transit policy negotiation";
  const roleName = crisis ? "Responder" : "Delegate";
  await page.goto("/?workspace=projects");
  await page.getByLabel("Blank Core Design", { exact: true }).check();
  await page.getByLabel("Project name", { exact: true }).fill(title);
  await page.getByRole("button", exact("Create Project and open Draft")).click();
  await expect(page).toHaveURL(/\/studio\/projects\/[0-9a-f-]{36}$/u);
  const studioPath = new URL(page.url()).pathname;
  const overview = await workspace(page, "Overview & Scenario");
  await overview.getByLabel("Core Design title", { exact: true }).fill(title);
  await overview.getByLabel("Scenario name", { exact: true }).fill(crisis ? "River flood" : "Transit agreement");
  await overview.getByLabel("Scenario description", { exact: true }).fill("Synthetic exercise for product acceptance; not a scientifically validated model.");
  const roles = await workspace(page, "Session Roles");
  const role = await addItem(roles, "Add Session Role");
  await role.getByLabel("Session Role name", { exact: true }).fill(roleName);
  await role.getByLabel("Capabilities (comma separated)").fill("artifact.create, artifact.submit, artifact.accept, inject.acknowledge, inject.respond, message.send");
  const seats = await workspace(page, "Seats");
  for (const suffix of ["North", "South"]) {
    const seat = await addItem(seats, "Add Seat");
    await seat.getByLabel("Seat name", { exact: true }).fill(`${suffix} ${roleName}`);
    await seat.getByRole("checkbox", exact(roleName)).check();
    await seat.getByLabel("Minimum occupancy").fill("1");
    await seat.getByLabel("Required Seat", { exact: true }).check();
  }
  const stages = await workspace(page, "Stages");
  for (const name of crisis ? ["Assess flood", "Recovery"] : ["Negotiate agreement"]) {
    await stages.getByRole("button", exact("Add next Stage")).click();
    const stage = stages.locator("details.editor-item").last();
    await stage.locator("summary").first().click();
    await stage.getByLabel("Stage name", { exact: true }).fill(name);
  }
  const policies = await workspace(page, "Information Policy");
  const policy = await addItem(policies, "Add deny-by-default policy");
  await policy.getByLabel("Policy name", { exact: true }).fill("Exercise participants");
  await policy.getByRole("button", exact("Allow an audience")).click();
  const workflows = await workspace(page, "Workflows");
  const workflow = await addItem(workflows, "Add simple review Workflow");
  await workflow.getByLabel("Workflow name", { exact: true }).fill("Review submission");
  const forms = await workspace(page, "Forms & Artifacts", "Forms & Artifact Types");
  const form = await addItem(forms, "Add Form and Artifact Type");
  const recordName = crisis ? "Response assessment" : "Negotiation proposal";
  await form.getByLabel("Form name", { exact: true }).fill(recordName);
  await form.getByLabel("Artifact Type name", { exact: true }).fill(recordName);
  await form.getByLabel("Ownership", { exact: true }).selectOption("individual");
  await form.getByRole("button", exact("Use approved form rules")).click();
  const fields = [["proposal", crisis ? "Response plan" : "Proposed agreement", "long_text"],
    ...(crisis ? [["households", "Households affected", "number"], ["evacuation", "Evacuation required", "yes_no"]] : [])];
  for (const [key, label, type] of fields) {
    await form.getByRole("button", exact("Add field")).click();
    const field = form.getByLabel("Field key", { exact: true }).last().locator("xpath=ancestor::fieldset[1]");
    await field.getByLabel("Field key", { exact: true }).fill(key);
    await field.getByLabel("Field label", { exact: true }).fill(label);
    await field.getByLabel("Field type", { exact: true }).selectOption(type);
    await field.getByLabel("Required", { exact: true }).check();
  }
  if (!crisis) {
    const communications = await workspace(page, "Communications");
    const channel = await addItem(communications, "Add Message Channel");
    await channel.getByLabel("Channel name", { exact: true }).fill("Policy table");
    const route = await addItem(communications, "Add Communication Route");
    await route.getByRole("checkbox", exact("Negotiate agreement")).check();
    await route.getByRole("checkbox", exact("Negotiate agreement")).uncheck();
  }
  const interfaces = await workspace(page, "Interfaces");
  const profile = await addItem(interfaces, "Add Interface Profile");
  await profile.getByLabel("Interface Profile name", { exact: true }).fill("Exercise workspace");
  for (const [moduleType, label, mode] of [["artifact_form", "New submission", "write"], ["task_list", "Submissions", "write"], ...(crisis ? [["inject_inbox", "Incident updates", "write"]] : [["message_inbox", "Policy exchange", "write"]])]) {
    await profile.getByRole("button", exact("Add module")).click();
    const module = profile.getByLabel("Module title", { exact: true }).last().locator("..").locator("..");
    await module.getByLabel("Module title", { exact: true }).fill(label);
    await module.getByLabel("Module", { exact: true }).selectOption(moduleType);
    await module.getByLabel("Interaction", { exact: true }).selectOption(mode);
    if (moduleType === "message_inbox") {
      await module.getByRole("checkbox", exact("Policy table")).check();
      await module.getByLabel("Send Route", { exact: true }).selectOption({ label: "Policy table to Delegate" });
    }
  }
  await capture(page, `${kind}-interfaces`);
  await adaptiveCapture(page, `${kind}-interfaces`);
  await workspace(page, "Session Roles");
  await roles.locator("details.editor-item").first().getByRole("checkbox", exact("Exercise workspace")).check();
  const access = await workspace(page, "Access & readiness", "Access");
  await access.getByRole("button", exact("Add access policy")).click();
  if (crisis) {
    const logic = await workspace(page, "Advanced logic & world state");
    await logic.getByRole("button", exact("Add Resource")).click();
    await logic.getByLabel("Resource name", { exact: true }).fill("Rescue vehicles");
    await logic.getByLabel("Unit", { exact: true }).fill("vehicles");
    await logic.getByLabel("Scenario initial balance", { exact: true }).fill("12");
    const variable = await addItem(logic, "Add State Value");
    await variable.getByLabel("Name", { exact: true }).fill("Flood severity");
    await variable.getByLabel("Scenario initial value", { exact: true }).fill("3");
    await workspace(page, "Overview & Scenario");
    const content = await addItem(overview, "Add Scenario content");
    await content.getByLabel("Title", { exact: true }).fill("Flood warning");
    await content.getByLabel("Content", { exact: true }).fill("Synthetic warning: confirm receipt and submit your response assessment.");
    await content.getByLabel("Information Policy", { exact: true }).selectOption({ label: "Exercise participants" });
    const injects = await workspace(page, "Injects");
    const inject = await addItem(injects, "Add Inject");
    await inject.getByLabel("Inject title", { exact: true }).fill("Flood alert");
    await inject.getByLabel("Release mode", { exact: true }).selectOption("gate");
    await inject.getByLabel("Comparison", { exact: true }).selectOption("greater_or_equal");
    await inject.getByLabel("Comparison value", { exact: true }).fill("2");
    await inject.getByLabel("Required response Artifact Type", { exact: true }).selectOption({ label: recordName });
    await capture(page, `${kind}-conditional-inject`);
    await adaptiveCapture(page, `${kind}-conditional-inject`);
  }
  const methodology = await workspace(page, "Methodology");
  for (const name of ["Team", "Decision Record", "Adjudication", "Effect", "Voice", "Poll", "Capability", "Research Question", ...(crisis ? ["Communication"] : ["State Variable", "Resource", "Inject"])]) {
    await methodology.getByRole("checkbox", exact(name)).uncheck();
  }
  await methodology.getByRole("checkbox", exact("Form")).uncheck();
  await synced(page);
  await expect(methodology.getByRole("status")).toContainText("attention");
  const blockedPublication = await workspace(page, "Review & publish", "Review and publish");
  await expect(blockedPublication.getByRole("button", exact("Freeze for review"))).toBeDisabled();
  await workspace(page, "Methodology");
  await methodology.getByRole("checkbox", exact("Form")).focus();
  await page.keyboard.press("Space");
  await expect(methodology.getByRole("status")).toHaveText("No concept dependencies are blocking publication.");
  await capture(page, `${kind}-methodology`);
  await page.reload();
  await workspace(page, "Forms & Artifacts", "Forms & Artifact Types");
  const reloadedForm = forms.locator("details.editor-item").first();
  await reloadedForm.locator("summary").first().click();
  for (const [index, [, label]] of fields.entries()) await expect(reloadedForm.getByLabel("Field label", { exact: true }).nth(index)).toHaveValue(label);
  await capture(page, `${kind}-forms`);
  await adaptiveCapture(page, `${kind}-forms`);
  return { title, studioPath, recordName, roleName, kind };
}
async function publish(page, reviewer, design) {
  const publication = await workspace(page, "Review & publish", "Review and publish");
  await publication.getByLabel("Release label", { exact: true }).fill(design.title);
  await publication.getByLabel("Semantic version", { exact: true }).fill("1.0.0");
  await publication.getByLabel("Release notes", { exact: true }).fill("Synthetic PS-840 UI-only proof; human UAT recorded separately.");
  await publication.getByText("Governance references", { exact: true }).click();
  await publication.getByLabel("Classification review reference").fill("ps840-synthetic-review");
  await publication.getByLabel("Retention policy reference", { exact: true }).fill("ps840-synthetic-retention");
  await publication.getByLabel("Approval notes", { exact: true }).fill("Synthetic automated publication with a separate Reviewer persona; target-user UAT is separate.");
  await publication.getByLabel("I acknowledge the validation warnings.").check();
  await synced(page);
  await expect(page.locator("#validation .issue-list"), "A blank-authored design must be publishable without fixture-only definitions").toHaveCount(0);
  await publication.getByRole("button", exact("Freeze for review")).click();
  await expect(page.getByText(/is frozen and ready for Reviewer approval/u)).toBeVisible();
  await reviewer.goto(page.url());
  const review = await workspace(reviewer, "Review & publish", "Review and publish");
  await review.getByLabel("Methodology review notes").fill("Independent synthetic persona review; not human UAT or domain validation.");
  await review.getByRole("button", exact("Approve freeze")).click();
  await expect(reviewer.getByText(/Reviewer approval was recorded/u)).toBeVisible();
  await publication.getByRole("button", exact("Freeze for review")).click();
  await expect(page.getByText("1 current approval.")).toBeVisible();
  const response = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/publish"));
  await publication.getByRole("button", exact("Publish approved freeze")).click();
  design.publication = await (await response).json();
  await expect(page.getByText(`Published ${design.title}.`, { exact: true })).toBeVisible();
}
async function runSession(browser, baseURL, design) {
  const operator = await persona(browser, "operator", baseURL);
  const page = operator.page;
  await page.goto("/?workspace=lifecycle");
  const release = page.locator("#release-catalog .lifecycle-row").filter({ hasText: design.title });
  await release.getByRole("button", exact("Create Session from this Release")).click();
  await release.getByLabel("Session name", { exact: true }).fill(design.title);
  await release.getByRole("button", exact("Create configured Session")).click();
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/u);
  design.sessionPath = new URL(page.url()).pathname;
  await page.goto(`/admin${design.sessionPath}`);
  await page.getByText("Open direct assignment form", { exact: true }).click();
  const assignment = page.getByRole("heading", exact("Assign participant")).locator("..");
  for (const [name, seat] of [["Synthetic Blue author", "North"], ["Synthetic Red author", "South"]]) {
    await assignment.getByLabel("Participant name", { exact: true }).selectOption({ label: name });
    await assignment.getByLabel("Seat", { exact: true }).selectOption({ label: `${seat} ${design.roleName}` });
    await assignment.getByLabel("Session Role", { exact: true }).selectOption({ label: design.roleName });
    await command(page, () => assignment.getByRole("button", exact("Assign Seat")).click(), "participant.assign");
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${root}/${design.kind}-staffing.png`, fullPage: true });
  const readiness = page.getByRole("region", exact("Operator readiness"));
  while (await readiness.getByRole("button", exact("Confirm")).count()) {
    const count = await readiness.getByRole("button", exact("Confirm")).count();
    await readiness.getByRole("button", exact("Confirm")).first().click();
    await expect(readiness.getByRole("button", exact("Confirm"))).toHaveCount(count - 1);
  }
  await command(page, () => readiness.getByRole("button", exact("Mark Session ready")).click(), "session.ready");
  await command(page, () => readiness.getByRole("button", exact("Open Session")).click(), "session.open");
  const control = page.getByRole("region", exact("Session control"));
  await control.getByLabel("Next valid action", { exact: true }).selectOption("session.start");
  await control.getByLabel("Reason", { exact: true }).fill("Start synthetic cross-simulation UAT.");
  await control.getByLabel("Confirm this authoritative lifecycle change.").check();
  await command(page, () => control.getByRole("button", exact("Apply Session control")).click(), "session.start");
  const stage = page.locator("#stage-control-title").locator("..");
  if (await stage.getByLabel("Stage action", { exact: true }).locator('option[value="stage.start"]').count()) await stageAction(page, "stage.start");
  const outsider = await persona(browser, "invitedParticipant", baseURL);
  const denied = await outsider.context.request.get(`/v1${design.sessionPath}/runtime-projection`);
  expect([403, 404]).toContain(denied.status());
  const deniedBody = await denied.json();
  expect(deniedBody).not.toHaveProperty("artifacts");
  expect(deniedBody).not.toHaveProperty("createTasks");
  const deniedStaffing = await outsider.context.request.get(`/v1${design.sessionPath}/readiness`);
  expect([403, 404]).toContain(deniedStaffing.status());
  expect(await deniedStaffing.json()).not.toHaveProperty("staffing");
  await outsider.context.close();
  const participant = await persona(browser, "author", baseURL);
  await enterRole(participant, design.title, `North ${design.roleName}`, design.roleName);
  const second = await persona(browser, "redAuthor", baseURL);
  await enterRole(second, design.title, `South ${design.roleName}`, design.roleName);
  if (design.kind === "policy-negotiation") {
    for (const [sender, receiver, text] of [[participant, second, "Proposal: preserve the transit service and review funding jointly."], [second, participant, "Counterproposal: agree with a quarterly public review."]]) {
      await sender.page.getByLabel("Message", { exact: true }).fill(text);
      await command(sender.page, () => sender.page.getByRole("button", exact("Send Message")).click(), "message.send");
      await receiver.page.getByRole("button", exact("Refresh authoritative state")).click();
      await expect(receiver.page.getByText(text, { exact: true })).toBeVisible();
    }
  }
  if (design.kind === "crisis-response") {
    const alert = participant.page.getByRole("article", exact("Flood alert"));
    await expect(alert).toBeVisible();
    await command(participant.page, () => alert.getByRole("button", exact("Acknowledge")).click(), "inject.acknowledge");
    await second.page.getByRole("button", exact("Refresh authoritative state")).click();
    await expect(second.page.getByRole("article", exact("Flood alert")).getByRole("button", exact("Acknowledge"))).toBeVisible();
  }
  for (const actor of [participant, second]) {
    await actor.page.getByLabel(design.kind === "crisis-response" ? "Response plan *" : "Proposed agreement *", { exact: true }).fill(design.kind === "crisis-response" ? "Synthetic response: evacuate 25 households and dispatch rescue vehicles to the agreed shelter." : "Synthetic agreement: maintain service with a quarterly joint review.");
    if (design.kind === "crisis-response") {
      await actor.page.getByLabel("Households affected *", { exact: true }).fill("25");
      await actor.page.getByLabel("Evacuation required *", { exact: true }).selectOption("true");
    }
    const creation = actor.page.waitForRequest((request) => {
      if (request.method() !== "POST") return false;
      try { return request.postDataJSON()?.operationType === "artifact.create"; } catch { return false; }
    });
    await command(actor.page, () => actor.page.getByRole("button", exact("Save draft")).click(), "artifact.create");
    const original = await creation;
    const originalCommand = original.postDataJSON();
    const record = actor.page.locator(`article.artifact[aria-labelledby="artifact-${originalCommand.aggregateId}"]`);
    const replay = await actor.context.request.post(original.url(), { data: originalCommand, headers: await original.allHeaders() });
    const replayBody = await replay.json();
    expect((replayBody.receipt ?? replayBody).status).toBe("accepted");
    expect((replayBody.receipt ?? replayBody).replayed).toBe(true);
    const peer = actor === participant ? second : participant;
    const peerDevice = await peer.page.evaluate(() => localStorage.getItem("plenum.runtime.deviceId"));
    const forbidden = await peer.context.request.post(original.url(), {
      headers: { "x-device-id": peerDevice },
      data: { ...originalCommand, deviceId: peerDevice, commandId: crypto.randomUUID(), operationType: "artifact.submit", expectedAggregateVersion: 1, payload: {} }
    });
    const forbiddenBody = await forbidden.json();
    expect((forbiddenBody.receipt ?? forbiddenBody).errorCode).toBe("TARGET_NOT_FOUND");
    await command(actor.page, () => record.getByRole("button", exact("Submit for review")).click(), "artifact.submit");
    await command(actor.page, () => record.getByRole("button", exact("Accept")).click(), "artifact.accept");
    await expect(record).toContainText("Completed");
    if (design.kind === "crisis-response") {
      const alert = actor.page.getByRole("article", exact("Flood alert"));
      if (actor === second) await command(actor.page, () => alert.getByRole("button", exact("Acknowledge")).click(), "inject.acknowledge");
      await alert.getByLabel("Response record", { exact: true }).selectOption(originalCommand.aggregateId);
      await command(actor.page, () => alert.getByRole("button", exact("Submit response")).click(), "inject.respond");
      await expect(alert.getByText("Your required steps are complete.", { exact: true })).toBeVisible();
      if (actor !== second) await expect(alert.getByText("closed", { exact: true })).toHaveCount(0);
      else await expect(alert.getByText("closed", { exact: true })).toBeVisible();
    }
  }
  expect((await new AxeBuilder({ page: participant.page }).analyze()).violations).toEqual([]);
  await participant.page.screenshot({ path: `${root}/${design.kind}-runtime.png`, fullPage: true });
  await adaptiveCapture(participant.page, `${design.kind}-runtime`);
  await second.context.close();
  await participant.context.close();
  for (const operation of ["session.pause", "session.resume", "session.complete", "session.lock"]) {
    await control.getByLabel("Next valid action", { exact: true }).selectOption(operation);
    await control.getByLabel("Reason", { exact: true }).fill("Synthetic UAT lifecycle and recovery proof.");
    await control.getByLabel("Confirm this authoritative lifecycle change.").check();
    await command(page, () => control.getByRole("button", exact("Apply Session control")).click(), operation);
    if (operation !== "session.lock") await expect(control.getByRole("button", exact("Apply Session control"))).toBeEnabled();
    else await expect(control.getByRole("button", exact("Apply Session control"))).toBeDisabled();
  }
  await page.screenshot({ path: `${root}/${design.kind}-completed.png`, fullPage: true });
  await operator.context.close();
}

for (const [index, kind] of ["policy-negotiation", "crisis-response"].entries()) {
  test(`PS-840-T0${index + 1} ${kind} authored from blank and executed through public UI @a11y`, async ({ browser, baseURL }) => {
    await mkdir(root, { recursive: true });
    const designer = await persona(browser, "publisher", baseURL);
    const reviewer = await persona(browser, "finalReviewer", baseURL);
    const design = await author(designer.page, kind);
    await publish(designer.page, reviewer.page, design);
    await runSession(browser, baseURL, design);
    expect(await runtimeSourceHash()).toEqual(sourceBefore);
    const evidence = { contractId: "uat-evidence-v1", generatedAt: new Date().toISOString(), testId: `PS-840-T0${index + 1}`,
      ...design, runtimeSourceHash: sourceBefore.digest, nodeVersion: process.version,
      status: "AUTOMATED_PASS", humanUat: "NOT RUN", domainFidelity: "NOT CLAIMED" };
    const schema = JSON.parse(await readFile(new URL("./uat-evidence-v1.schema.json", import.meta.url), "utf8"));
    const validate = new Ajv2020({ strict: true }).compile(schema);
    expect(validate(evidence), JSON.stringify(validate.errors)).toBe(true);
    await writeFile(`test-results/uat/${kind}.json`, JSON.stringify(evidence, null, 2));
    await designer.context.close();
    await reviewer.context.close();
  });
}


