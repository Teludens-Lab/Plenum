import { mkdir } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { fixture, runtimeUrl } from "../fixture.mjs";

const evidenceRoot = "output/playwright/ps-700";
const portalEvidenceRoot = "output/playwright/ps-710";
const lifecycleEvidenceRoot = "output/playwright/ps-720";
const studioEvidenceRoot = "output/playwright/ps-730";
const authoringEvidenceRoot = "output/playwright/ps-740";
const advancedAuthoringEvidenceRoot = "output/playwright/ps-750";
const governanceEvidenceRoot = "output/playwright/ps-760";
const participantEvidenceRoot = "output/playwright/ps-770";
const headers = (token) => ({ Authorization: `Bearer ${token}` });

async function actor(browser, token, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, extraHTTPHeaders: headers(token) });
  return { context, page: await context.newPage() };
}

test.beforeAll(async () => {
  await mkdir(evidenceRoot, { recursive: true });
  await mkdir(portalEvidenceRoot, { recursive: true });
  await mkdir(lifecycleEvidenceRoot, { recursive: true });
  await mkdir(studioEvidenceRoot, { recursive: true });
  await mkdir(authoringEvidenceRoot, { recursive: true });
  await mkdir(advancedAuthoringEvidenceRoot, { recursive: true });
  await mkdir(governanceEvidenceRoot, { recursive: true });
  await mkdir(participantEvidenceRoot, { recursive: true });
});

test("PS-700 local user-test sign-in and sign-out use only the synthetic loopback identity", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Choose a synthetic persona" })).toBeVisible();
  await page.getByLabel(/Publisher/u).check();
  await page.getByRole("button", { name: "Continue as selected persona" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:4173/");
  await expect(page.getByRole("complementary").getByText("PS-150 synthetic organization")).toBeVisible();
  await page.goto("/__test__/offline");
  await expect(page.getByRole("heading", { name: "Account context is unavailable" })).toBeVisible();
  await expect(page.getByText("PS-150 synthetic organization")).toHaveCount(0);
  await page.goto("/__test__/online");
  await expect(page.getByRole("complementary").getByText("PS-150 synthetic organization")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Continue to Plenum" })).toBeVisible();
  await expect(page.getByLabel("Plenum status: Sign-in required")).toBeVisible();
  await expect(page.getByText("Connection error", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Continue to Plenum" })).toBeVisible();
  await expect(page.getByLabel("Plenum status: Sign-in required")).toBeVisible();
  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByLabel(/Publisher/u).check();
  await page.getByRole("button", { name: "Continue as selected persona" }).click();
  await expect(page.getByRole("heading", { name: "Active Projects" })).toBeVisible();
  await context.close();
});

test("PS-710 local user-test persona chooser is accessible without authorization headers @a11y", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/__test__/personas");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${portalEvidenceRoot}/persona-chooser.png`, fullPage: true });
  await context.close();
});

const localUserTestPersonas = [
  { label: /^Designer Create,/u, displayName: "Synthetic Designer A", heading: "Create a Project" },
  { label: /^Designer B Collaborate/u, displayName: "Synthetic Designer B", heading: "Create a Project" },
  { label: /^Admin\b/u, displayName: "Synthetic operator", heading: "Organization members and roles" },
  { label: /^Reviewer\b/u, displayName: "Synthetic final reviewer", heading: "Review access", project: "PS-150 S1 proof" },
  { label: /^Operator only\b/u, displayName: "Synthetic portal operator", heading: "Project access unavailable" }
];

for (const persona of localUserTestPersonas) {
  test(`PS-710 local user-test ${persona.displayName} works without authorization headers`, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/__test__/personas");
    await expect(page.getByRole("heading", { name: "Choose a synthetic persona" })).toBeVisible();
    await page.getByRole("radio", { name: persona.label }).check();
    await page.getByRole("button", { name: "Continue as selected persona" }).click();
    await expect(page).toHaveURL("http://127.0.0.1:4173/");
    await expect(page.getByRole("complementary").getByText(persona.displayName)).toBeVisible();
    await expect(page.getByRole("heading", { name: persona.heading })).toBeVisible();
    if (persona.project !== undefined) await expect(page.getByText(persona.project)).toBeVisible();
    if (persona.displayName === "Synthetic Designer A") {
      await page.getByLabel("Project name").fill("PS-710 cookie-only Designer Draft");
      await page.getByRole("button", { name: "Create and open Draft" }).click();
      await expect(page).toHaveURL(/\/studio\/projects\/[0-9a-f-]{36}$/u);
      await expect(page.getByRole("heading", { name: "Core Design editor" })).toBeVisible();
      await expect(page.getByText("Connected", { exact: true })).toBeVisible();
    }
    await context.close();
  });
}

test("PS-700-T01 authenticated root is useful, branded, responsive, and accessible @a11y", async ({ browser }) => {
  const { context, page } = await actor(browser, fixture.tokens.operator);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Design with intent. Run with authority." })).toBeVisible();
  await expect(page.getByRole("img", { name: "Plenum" })).toBeVisible();
  await expect(page.getByRole("complementary").getByText("PS-150 synthetic organization")).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: /^Studio/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Operations/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Organization members and roles" })).toBeVisible();
  const shell = await context.request.get("/v1/product-context");
  expect(shell.status()).toBe(200);
  const body = await shell.json();
  expect(body.contractId).toBe("product-shell-v1");
  expect(JSON.stringify(body)).not.toContain(fixture.sessionId);
  expect(Object.keys(body).sort()).toEqual(["contractId", "destinations", "organization", "principal"]);
  const hostileTenant = await context.request.get("/v1/product-context?organizationId=ffffffff-ffff-4fff-8fff-ffffffffffff");
  expect((await hostileTenant.json()).organization.id).toBe(fixture.organizationId);
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations).toEqual([]);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.screenshot({ path: `${evidenceRoot}/root-light-desktop.png`, fullPage: true });

  await page.getByRole("button", { name: /Use dark theme/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".brand-wordmark-light")).toBeVisible();
  const darkViolations = await new AxeBuilder({ page }).analyze();
  expect(darkViolations.violations).toEqual([]);
  await page.screenshot({ path: `${evidenceRoot}/root-dark-desktop.png`, fullPage: true });
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Continue to Plenum" })).toBeVisible();
  await expect(page.getByText("PS-150 synthetic organization")).toHaveCount(0);
  await context.close();
});

test("PS-700-T02 clean, unauthorized, offline, narrow, and 200-percent-text states recover", async ({ browser }) => {
  const clean = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const cleanPage = await clean.newPage();
  await cleanPage.goto("/");
  await expect(cleanPage.getByRole("heading", { name: "Continue to Plenum" })).toBeVisible();
  await expect(cleanPage.getByLabel("Plenum status: Sign-in required")).toBeVisible();
  await expect(cleanPage.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth/login?returnTo=%2F");
  await expect(cleanPage.getByText("PS-150 synthetic organization")).toHaveCount(0);
  await cleanPage.screenshot({ path: `${evidenceRoot}/root-unauthorized-narrow.png`, fullPage: true });
  const denied = await clean.request.get("/v1/product-context");
  expect(denied.status()).toBe(401);
  await clean.close();

  const { context, page } = await actor(browser, fixture.tokens.designerA, { width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("PS-150 synthetic organization")).toBeVisible();
  await expect(page.getByRole("link", { name: /Operations/ })).toHaveCount(0);
  await page.screenshot({ path: `${evidenceRoot}/root-authenticated-narrow.png`, fullPage: true });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: `${evidenceRoot}/root-200-percent-text.png`, fullPage: true });
  await context.close();

  const offline = await actor(browser, fixture.tokens.designerB);
  await offline.page.route("**/v1/product-context", (route) => route.abort("internetdisconnected"));
  await offline.page.goto("/");
  await expect(offline.page.getByRole("heading", { name: "Account context is unavailable" })).toBeVisible();
  await expect(offline.page.getByText("PS-150 synthetic organization")).toHaveCount(0);
  await offline.page.screenshot({ path: `${evidenceRoot}/root-offline.png`, fullPage: true });
  await offline.context.close();
});

test("existing Studio and Runtime deep links remain valid", async ({ browser }) => {
  const { context, page } = await actor(browser, fixture.tokens.designerA);
  await page.goto("/studio/");
  await expect(page.getByRole("heading", { name: "No Project selected" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to Plenum home" })).toBeVisible();
  await page.goto(runtimeUrl(fixture.tokens.designerA));
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Design with intent. Run with authority.");
  await context.close();
});

test("PS-710-T01 Designer creates, archives, reopens, and resumes a blank Project using visible controls @a11y", async ({ browser }) => {
  const { context, page } = await actor(browser, fixture.tokens.designerA);
  const projectName = "PS-710 visible blank Project";
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Active Projects" })).toBeVisible();
  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Create and open Draft" }).click();
  await expect(page).toHaveURL(/\/studio\/projects\/[0-9a-f-]{36}$/u);
  await expect(page.getByRole("heading", { name: "Core Design editor" })).toBeVisible();

  await page.goto("/");
  const activeProject = page.locator(".project-row").filter({ hasText: projectName });
  await expect(activeProject).toBeVisible();
  const stalePage = await context.newPage();
  await stalePage.goto("/");
  const staleProject = stalePage.locator(".project-row").filter({ hasText: projectName });
  await expect(staleProject).toBeVisible();
  await activeProject.getByRole("button", { name: "Archive" }).click();
  await expect(activeProject.getByText("Existing published Releases remain immutable and available.")).toBeVisible();
  await activeProject.getByRole("button", { name: "Confirm archive" }).click();
  await expect(activeProject).toHaveCount(0);

  await staleProject.getByRole("button", { name: "Archive" }).click();
  await staleProject.getByRole("button", { name: "Confirm archive" }).click();
  const staleArchiveNotice = stalePage.getByText("Project state changed in another tab. This view was refreshed.");
  await expect(staleArchiveNotice).toBeVisible();
  await expect(staleArchiveNotice).toBeFocused();
  await expect(staleProject).toHaveCount(0);

  await page.getByLabel("Status", { exact: true }).selectOption("archived");
  await page.getByRole("button", { name: "Apply" }).click();
  await stalePage.getByLabel("Status", { exact: true }).selectOption("archived");
  await stalePage.getByRole("button", { name: "Apply" }).click();
  const archivedProject = page.locator(".project-row").filter({ hasText: projectName });
  const staleArchivedProject = stalePage.locator(".project-row").filter({ hasText: projectName });
  await expect(archivedProject).toBeVisible();
  await expect(staleArchivedProject).toBeVisible();
  await archivedProject.getByRole("button", { name: "Reopen" }).click();
  await expect(archivedProject).toHaveCount(0);
  await staleArchivedProject.getByRole("button", { name: "Reopen" }).click();
  const staleReopenNotice = stalePage.getByText("Project state changed in another tab. This view was refreshed.");
  await expect(staleReopenNotice).toBeVisible();
  await expect(staleReopenNotice).toBeFocused();
  await expect(staleArchivedProject).toHaveCount(0);
  await page.getByLabel("Status", { exact: true }).selectOption("active");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator(".project-row").filter({ hasText: projectName })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${portalEvidenceRoot}/designer-project-lifecycle.png`, fullPage: true });
  await context.close();
});

test("PS-710-T02 Template defaults, Admin and Reviewer views, and Operator denial are enforced", async ({ browser }) => {
  const designer = await actor(browser, fixture.tokens.designerB);
  const projectName = "PS-710 Template Core Design copy";
  await designer.page.goto("/");
  const template = designer.page.locator(".template-row").filter({ hasText: "Fractured Order Core Design" });
  await expect(template).toBeVisible();
  await template.getByRole("button", { name: "Use Template" }).click();
  await designer.page.getByLabel("Project name").fill(projectName);
  await expect(designer.page.getByLabel("Copy optional Scenario content")).not.toBeChecked();
  await designer.page.getByRole("button", { name: "Create and open Draft" }).click();
  await expect(designer.page).toHaveURL(/\/studio\/projects\/[0-9a-f-]{36}$/u);
  const projectId = new URL(designer.page.url()).pathname.split("/").at(-1);
  const draftResponse = await designer.context.request.get(`/v1/projects/${projectId}/draft`);
  expect(draftResponse.status()).toBe(200);
  const draft = await draftResponse.json();
  expect(draft.materialization.coreDesign.teams.length).toBeGreaterThan(0);
  expect(draft.materialization.scenario.name).toBe("Untitled Scenario");
  expect(draft.materialization.scenario.content).toBeUndefined();
  await designer.page.screenshot({ path: `${portalEvidenceRoot}/template-copy-default.png`, fullPage: true });
  await designer.context.close();

  const reviewer = await actor(browser, fixture.tokens.finalReviewer);
  await reviewer.page.goto("/");
  await expect(reviewer.page.getByRole("heading", { name: "Review access" })).toBeVisible();
  await expect(reviewer.page.getByRole("heading", { name: "Create a Project" })).toHaveCount(0);
  await expect(reviewer.page.getByRole("button", { name: "Archive" })).toHaveCount(0);
  expect((await reviewer.context.request.get("/v1/projects?limit=10")).status()).toBe(200);
  expect((await reviewer.context.request.post("/v1/projects", { data: { requestId: crypto.randomUUID(), title: "Denied" } })).status()).toBe(403);
  await reviewer.context.close();

  const operator = await actor(browser, fixture.tokens.portalOperator);
  await operator.page.goto("/");
  await expect(operator.page.getByRole("heading", { name: "Project access unavailable" })).toBeVisible();
  const denied = await operator.context.request.get("/v1/projects");
  expect(denied.status()).toBe(403);
  expect(JSON.stringify(await denied.json())).not.toContain(fixture.projectId);
  await operator.page.screenshot({ path: `${portalEvidenceRoot}/operator-denied.png`, fullPage: true });
  await operator.context.close();
});

test("PS-720-T01 Publisher finds, exports, verifies, and revisits an immutable Release @a11y", async ({ browser }) => {
  const { context, page } = await actor(browser, fixture.tokens.publisher);
  await page.goto("/");
  const catalog = page.locator("#release-catalog");
  await expect(catalog.getByRole("heading", { name: "Simulation Releases" })).toBeVisible();
  const release = catalog.locator(".lifecycle-row").filter({ hasText: "S1 proof 1.0.0" });
  await expect(release.getByText("immutable", { exact: true })).toBeVisible();
  await expect(release.getByText("1 Approval. 1 Session.", { exact: false })).toBeVisible();
  await expect(release.getByText(/Package digest [0-9a-f]{64}/u)).toBeVisible();
  await expect(release.getByRole("button", { name: "Create Session" })).toHaveCount(0);

  const downloadPromise = page.waitForEvent("download");
  await release.getByRole("link", { name: "Export Package" }).click();
  const download = await downloadPromise;
  const packagePath = await download.path();
  expect(packagePath).not.toBeNull();
  await page.getByLabel("Import a verified Release Package").setInputFiles(packagePath);
  await page.getByRole("button", { name: "Verify and import" }).click();
  await expect(page.getByText("This immutable Release Package was already present.")).toBeVisible();

  await release.getByRole("link", { name: "S1 proof 1.0.0" }).click();
  await expect(page).toHaveURL(new RegExp(`/releases/${fixture.releaseId}$`, "u"));
  await expect(page.locator("#release-detail-title")).toHaveText("S1 proof 1.0.0");
  await expect(page.getByText(/^[0-9a-f]{64}$/u)).toBeVisible();
  await expect(page.locator(".lifecycle-detail dl div").filter({ hasText: "Approvals" }).locator("dd")).toHaveText("1");
  await page.reload();
  await expect(page.locator("#release-detail-title")).toHaveText("S1 proof 1.0.0");
  await page.goBack();
  await expect(catalog.getByRole("heading", { name: "Simulation Releases" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${lifecycleEvidenceRoot}/publisher-release-catalog.png`, fullPage: true });
  await context.close();
});

test("PS-720-T02 Operator creates one configured Session and uses stable lifecycle navigation @a11y", async ({ browser }) => {
  const { context, page } = await actor(browser, fixture.tokens.portalOperator);
  const sessionName = "PS-720 visible configured Session";
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Project access unavailable" })).toBeVisible();
  const release = page.locator("#release-catalog .lifecycle-row").filter({ hasText: "S1 proof 1.0.0" });
  await release.getByRole("button", { name: "Create Session" }).click();
  await release.getByLabel("Session name").fill(sessionName);
  await release.getByRole("button", { name: "Create configured Session" }).click();
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/u);
  const detailUrl = page.url();
  const sessionId = new URL(detailUrl).pathname.split("/").at(-1);
  await expect(page.locator("#session-detail-title")).toHaveText(sessionName);
  await expect(page.getByText("configured", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Readiness 0/11; 11 blocking checks incomplete.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Staffing and readiness" })).toHaveAttribute("href", `/admin/sessions/${sessionId}#staffing-title`);
  await expect(page.getByRole("link", { name: "Runtime", exact: true })).toHaveAttribute("href", `/sessions/${sessionId}/runtime`);
  await expect(page.getByRole("link", { name: "Reports" })).toHaveAttribute("href", `/admin/sessions/${sessionId}/reports`);
  await expect(page.getByRole("link", { name: "Replay" })).toHaveAttribute("href", `/admin/sessions/${sessionId}/replay`);
  await expect(page.getByRole("link", { name: "Archive" })).toHaveAttribute("href", `/admin/sessions/${sessionId}/archive`);
  await page.reload();
  await expect(page.locator("#session-detail-title")).toHaveText(sessionName);
  await page.goBack();
  await expect(page.locator("#session-catalog .lifecycle-row").filter({ hasText: sessionName })).toBeVisible();
  await page.goto(`/admin/sessions/${sessionId}/reports`);
  await expect(page.getByRole("heading", { name: "Generate a Session report" })).toBeVisible();
  await page.getByRole("link", { name: "Session detail" }).click();
  await expect(page).toHaveURL(detailUrl);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${lifecycleEvidenceRoot}/operator-session-detail.png`, fullPage: true });
  await context.close();

  const reviewer = await actor(browser, fixture.tokens.finalReviewer);
  await reviewer.page.goto("/");
  await expect(reviewer.page.getByRole("heading", { name: "Release and Session access unavailable" })).toBeVisible();
  await expect(reviewer.page.getByText(sessionName)).toHaveCount(0);
  const denied = await reviewer.context.request.get("/v1/releases");
  expect(denied.status()).toBe(403);
  expect(JSON.stringify(await denied.json())).not.toContain(fixture.releaseId);
  await reviewer.context.close();

  const admin = await actor(browser, fixture.tokens.operator);
  await admin.page.goto("/admin/members");
  await expect(admin.page.getByRole("heading", { name: "Members and Organization Roles" })).toBeVisible();
  await expect(admin.page.getByRole("link", { name: "Plugins" })).toHaveAttribute("href", "/admin/plugins");
  await expect(admin.page.getByRole("link", { name: "Deployment" })).toHaveAttribute("href", "/admin/deployment");
  await expect(admin.page.getByRole("link", { name: "Data policy" })).toHaveAttribute("href", "/admin/data-policy");
  await admin.context.close();
});

test("PS-730-T01/AC-01 foundational Studio authoring converges, previews Runtime projection, and links validation to the exact control @a11y", async ({ browser }) => {
  test.setTimeout(480_000);
  const first = await actor(browser, fixture.tokens.designerA);
  const second = await actor(browser, fixture.tokens.designerB);
  const studioUrl = `/studio/projects/${fixture.projectId}`;
  await first.page.goto(studioUrl);
  await expect(first.page.getByRole("heading", { name: "Core Design editor" })).toBeVisible();
  await expect(first.page.getByText("Connected", { exact: true })).toBeVisible();
  await first.page.locator(".visual-editor").waitFor();
  await second.page.goto(studioUrl);
  await expect(second.page.getByRole("heading", { name: "Core Design editor" })).toBeVisible();
  await expect(second.page.getByText("Connected", { exact: true })).toBeVisible();
  await expect(first.page.locator(".visual-editor")).toHaveAttribute("data-contract-id", "studio-foundation-editor-v1");

  const convergedName = "PS-730 converged Scenario";
  await first.page.getByLabel("Scenario name").fill(convergedName);
  await expect(second.page.getByLabel("Scenario name")).toHaveValue(convergedName, { timeout: 120_000 });

  await first.page.getByRole("button", { name: "Add learning objective" }).click();
  await expect(second.page.locator("#overview").getByText("New objective", { exact: true })).toBeVisible({ timeout: 120_000 });
  await first.page.getByRole("button", { name: "Add Activity" }).click();
  await expect(second.page.locator("#activities").getByText("New Activity", { exact: true })).toBeVisible({ timeout: 120_000 });
  const firstStage = first.page.locator("#stages .timeline details").first();
  await firstStage.locator("summary").click();
  await firstStage.getByRole("checkbox", { name: "New Activity" }).check();
  await expect(first.page.getByText("0 unsynchronized changes")).toBeVisible();
  await expect.poll(async () => {
    const response = await first.context.request.get(`/v1/projects/${fixture.projectId}/draft`);
    const draft = await response.json();
    const activity = draft.materialization.coreDesign.activities?.find(({ name }) => name === "New Activity");
    return activity !== undefined && draft.materialization.coreDesign.stages[0].allowedActivityIds.includes(activity.id);
  }).toBe(true);

  const previewResponse = second.page.waitForResponse((response) => response.url().endsWith(`/v1/projects/${fixture.projectId}/role-preview`) && response.request().method() === "POST");
  await second.page.getByRole("button", { name: "Preview interface" }).click();
  const preview = await (await previewResponse).json();
  expect(preview.contractId).toBe("role-preview-v1");
  await expect(second.page.locator(".role-preview")).toHaveAttribute("aria-label", new RegExp(`${preview.sessionRoleLabel} interface preview`, "u"));
  await expect(second.page.locator(".role-preview .preview-heading")).toContainText(preview.stageLabel);

  const groups = first.page.locator("#stages .editor-list.compact-list details");
  const firstGroup = groups.nth(0);
  const secondGroup = groups.nth(1);
  await firstGroup.locator("summary").click();
  await secondGroup.locator("summary").click();
  const firstGroupName = await firstGroup.getByLabel("Group name").inputValue();
  const secondGroupName = await secondGroup.getByLabel("Group name").inputValue();
  await firstGroup.getByLabel("Parent Stage Group").selectOption({ label: secondGroupName });
  await secondGroup.getByLabel("Parent Stage Group").selectOption({ label: firstGroupName });
  await expect(first.page.getByText("0 unsynchronized changes")).toBeVisible();
  const issue = first.page.locator(".issue-list a").filter({ hasText: /^stageGroups\./u }).first();
  await expect(issue).toBeVisible();
  await issue.click();
  await expect(firstGroup.getByLabel("Group name")).toBeFocused();
  await first.page.getByRole("button", { name: "Undo last change" }).click();
  await expect(first.page.locator(".issue-list a").filter({ hasText: /^stageGroups\./u })).toHaveCount(0);

  expect((await new AxeBuilder({ page: first.page }).analyze()).violations).toEqual([]);
  await first.page.screenshot({ path: `${studioEvidenceRoot}/foundational-studio.png`, fullPage: true });
  await first.context.close();
  await second.context.close();
});

test("PS-740-T02 governed authoring exposes previews, DEC-42, communications, Injects, and quarantined content @a11y", async ({ browser }) => {
  test.setTimeout(360_000);
  const { context, page } = await actor(browser, fixture.tokens.designerA);
  await page.goto(`/studio/projects/${fixture.projectId}`);
  await expect(page.getByRole("heading", { name: "Core Design editor" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Forms & Artifact Types" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Workflows" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Communications" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Injects", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Content Library" })).toBeVisible();

  const firstForm = page.locator("#forms details.editor-item").first();
  await firstForm.locator("summary").click();
  await expect(firstForm.getByText("Form preview", { exact: true })).toBeVisible();
  await firstForm.getByLabel("Viewport").selectOption("mobile");
  await firstForm.getByLabel("Mode").selectOption("completed");
  await expect(firstForm.locator(".form-preview-canvas")).toHaveAttribute("aria-label", /mobile completed preview/u);

  await page.getByRole("button", { name: "Add DEC-42 reference Workflow" }).click();
  const dec42 = page.locator("#workflows details.editor-item").filter({ hasText: "DEC-42 reference review" });
  await expect(dec42).toBeVisible();
  await dec42.locator("summary").click();
  await expect(dec42.getByText("Return for revision", { exact: true }).first()).toBeVisible();
  await expect(dec42.getByText("Resubmit for intermediate review", { exact: true }).first()).toBeVisible();

  await expect(page.getByRole("table", { name: "Route matrix by Session Role" })).toBeVisible();
  await expect(page.getByLabel("Inject timeline")).toBeVisible();

  await page.getByLabel("Content title").fill("PS-740 safe content");
  await page.getByLabel("File (maximum 512 KiB)").setInputFiles({
    name: "ps-740-safe.txt", mimeType: "text/plain", buffer: Buffer.from("Safe synthetic PS-740 content.")
  });
  await page.getByRole("button", { name: "Upload and scan" }).click();
  await expect(page.getByText("Malware scan passed. This version is available for reuse.")).toBeVisible();
  const safeCard = page.locator("#content-library .catalog-card").filter({ hasText: "PS-740 safe content" });
  await expect(safeCard.getByText("clean", { exact: true })).toBeVisible();
  await safeCard.getByRole("button", { name: "Use current version in Scenario" }).click();

  await page.getByLabel("Content title").fill("PS-740 quarantined content");
  await page.getByLabel("File (maximum 512 KiB)").setInputFiles({
    name: "ps-740-eicar.txt", mimeType: "text/plain", buffer: Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")
  });
  await page.getByRole("button", { name: "Upload and scan" }).click();
  await expect(page.getByText(/This version remains unavailable/u)).toBeVisible();
  const infectedCard = page.locator("#content-library .catalog-card").filter({ hasText: "PS-740 quarantined content" });
  await expect(infectedCard.getByText("infected", { exact: true })).toBeVisible();
  await expect(infectedCard.getByRole("button", { name: "Use current version in Scenario" })).toBeDisabled();

  await expect(page.getByText("0 unsynchronized changes")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${authoringEvidenceRoot}/governed-authoring.png`, fullPage: true });
  await context.close();
});

test("PS-750-T02 advanced authoring is visual, explicit, fail-closed, and preview-only @a11y", async ({ browser }) => {
  test.setTimeout(360_000);
  const { context, page } = await actor(browser, fixture.tokens.designerA);
  await page.goto(`/studio/projects/${fixture.projectId}`);
  await page.getByRole("link", { name: "Advanced logic & world state" }).click();
  await expect(page.locator("#advanced-logic").getByRole("heading", { name: "Advanced logic & world state" })).toBeVisible();
  await expect(page.locator("#adjudication")).toBeAttached();
  await expect(page.locator("#plugins")).toBeAttached();
  await expect(page.locator("#compositions")).toBeAttached();
  await expect(page.locator("#polls")).toBeAttached();
  await expect(page.locator("#voice")).toBeAttached();

  await page.getByRole("button", { name: "Add State Value" }).click();
  const stateValue = page.locator("#advanced-logic details.editor-item").first();
  await stateValue.locator("summary").click();
  await expect(stateValue.getByLabel("Scenario initial value")).toBeVisible();
  await expect(stateValue.getByLabel("Unit")).toBeVisible();
  await expect(stateValue.getByLabel("History")).toBeVisible();
  await expect(stateValue.getByLabel("Display")).toBeVisible();
  await page.getByRole("button", { name: "Add Resource", exact: true }).click();
  await expect(page.getByLabel("Scenario initial balance").last()).toBeVisible();
  await page.getByRole("button", { name: "Add Capability" }).click();
  const capability = page.locator("#advanced-logic details.editor-item").filter({ hasText: "New Capability" });
  await expect(capability.getByText("Activation Gate", { exact: true })).toBeVisible();
  await expect(capability.getByText("Degradation Effects", { exact: true })).toBeVisible();
  await expect(capability.getByText("Resource costs", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add Adjudication Model" }).click();
  const adjudication = page.locator("#adjudication details.editor-item").last();
  await adjudication.getByLabel("Mechanism").selectOption("rules");
  await adjudication.getByRole("button", { name: "Add constrained rule" }).click();
  await expect(adjudication.getByLabel("Explanation shown in trace")).toBeVisible();
  await adjudication.getByRole("button", { name: "Run synthetic preview" }).click();
  await expect(adjudication.getByText("Preview complete. Authoritative state changes: 0.")).toBeVisible();
  for (const phase of ["Suggestion", "Review", "Approval", "Committed effect"]) {
    await expect(adjudication.getByText(phase, { exact: true })).toBeVisible();
  }

  const catalogCard = page.locator("#plugins article.catalog-card").first();
  await catalogCard.getByRole("button", { name: "Bind installed Plugin" }).click();
  const binding = page.locator("#plugins details.editor-item").last();
  await binding.locator("summary").click();
  await expect(binding.getByRole("table", { name: /Deployment compatibility/u })).toBeVisible();
  await expect(binding.getByText("Policy-filtered input mappings", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add Model Composition" }).click();
  const composition = page.locator("#compositions details.editor-item").last();
  await expect(composition.getByText(/cannot mutate Session state/u)).toBeVisible();
  await expect(composition.getByRole("button", { name: "Add approval gate" })).toBeVisible();

  await page.getByRole("button", { name: "Add Poll" }).click();
  const poll = page.locator("#polls details.editor-item").last();
  await poll.locator("summary").click();
  await expect(poll.locator('[role="status"]').filter({ hasText: "Publication readiness:" })).toContainText("Complete");
  await expect(poll.getByText(/Count accepted ballots/u)).toBeVisible();
  await poll.getByLabel("Ballot visibility").selectOption("secret_ballot");
  await expect(poll.getByText(/resolved OPEN-028/u).first()).toBeVisible();
  await poll.getByLabel("Ballot visibility").selectOption("open");

  await page.getByLabel("Target deployment profile").selectOption("air_gapped");
  const voice = page.locator("#voice details.editor-item").first();
  await voice.locator("summary").click();
  await expect(voice.getByText(/air gapped compatibility:/u)).toBeVisible();
  await expect(voice.getByText(/Non-audio path:/u)).toBeVisible();

  await expect(page.getByText("0 unsynchronized changes")).toBeVisible({ timeout: 40_000 });
  expect((await new AxeBuilder({ page }).include("#advanced-logic").include("#adjudication").include("#plugins").include("#compositions").include("#polls").include("#voice").analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${advancedAuthoringEvidenceRoot}/advanced-authoring.png`, fullPage: true });
  await context.close();
});

test("PS-760-T02 remaining Studio workspaces rehearse deterministically without identifiers or Runtime mutation @a11y", async ({ browser }) => {
  test.setTimeout(360_000);
  const { context, page } = await actor(browser, fixture.tokens.designerA);
  await page.goto(`/studio/projects/${fixture.projectId}`);
  for (const link of ["Interfaces", "Research", "Measurements & reports", "Access & readiness", "Role walkthrough", "Test & validate", "Review & publish", "Live Changes"]) {
    await expect(page.getByRole("link", { name: link, exact: true })).toBeVisible();
  }
  await expect(page.locator("#interfaces")).toBeAttached();
  await expect(page.locator("#research")).toBeAttached();
  await expect(page.locator("#measurements-reports")).toBeAttached();
  await expect(page.locator("#access")).toBeAttached();
  await expect(page.locator("#preview")).toBeAttached();
  await expect(page.locator("#review-publish")).toBeAttached();
  await expect(page.locator("#live-changes")).toBeAttached();

  await page.getByRole("link", { name: "Test & validate", exact: true }).click();
  await page.getByRole("button", { name: "Run deterministic rehearsal" }).click();
  await expect(page.getByText(/Rehearsal completed with \d+ evaluated trigger/u)).toBeVisible();
  const digest = await page.locator("#test-validate .digest-line").textContent();
  await page.getByRole("button", { name: "Run deterministic rehearsal" }).click();
  await expect(page.locator("#test-validate .digest-line")).toHaveText(digest ?? "");
  await expect(page.getByText("0 unsynchronized changes")).toBeVisible();

  await expect(page.locator('#review-publish input[pattern="[0-9a-fA-F-]{36}"]')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include("#interfaces").include("#research").include("#measurements-reports").include("#access").include("#preview").include("#test-validate").include("#review-publish").include("#live-changes").analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${governanceEvidenceRoot}/rehearsal-publication.png`, fullPage: true });
  await context.close();
});

test("PS-770-T01/T02 AC-08 AC-11 participant enters by policy, chooses labeled Seats, switches role, and recovers offline @a11y", async ({ browser }) => {
  test.setTimeout(180_000);
  const { context, page } = await actor(browser, fixture.tokens.invitedParticipant);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your Sessions" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Studio/u })).toHaveCount(0);
  await expect(page.getByText("Synthetic invited participant")).toBeVisible();
  const deniedAcceptance = await context.request.post(`/v1/participant-entry/invitations/${fixture.invitationId}/accept`, {
    headers: headers(fixture.tokens.author), data: {}
  });
  expect(deniedAcceptance.status()).toBe(403);
  expect(JSON.stringify(await deniedAcceptance.json())).not.toContain("PS-150 S1 proof Session");
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page.getByRole("group", { name: "Choose an eligible Seat" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("group", { name: "Choose an eligible Seat" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept invitation" })).toHaveCount(0);
  const choices = page.getByRole("group", { name: "Choose an eligible Seat" }).getByRole("button");
  await choices.first().click();
  await expect(page.getByRole("heading", { name: "Enter as" })).toBeVisible();
  const remainingChoices = page.getByRole("group", { name: "Choose an eligible Seat" }).getByRole("button");
  if (await remainingChoices.count() > 0) await remainingChoices.first().click();
  const entryLinks = page.locator(".role-entry-list a");
  await expect(entryLinks.first()).toBeVisible();
  await entryLinks.first().click();
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}\/runtime\?role=[a-z_]+$/u);
  await expect(page.getByRole("heading", { level: 1, name: /workspace$/u })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Runtime modules" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Exit Session" })).toBeVisible();
  if (await page.getByLabel("Active Role Context").count() > 0) {
    const roles = page.getByLabel("Active Role Context");
    expect((await roles.locator("option").allTextContents()).length).toBeGreaterThan(1);
    await roles.selectOption({ index: 1 });
    await expect(page).toHaveURL(/\?role=/u);
  }
  const runtimeLocation = page.url();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${participantEvidenceRoot}/participant-runtime.png`, fullPage: true });

  await page.goto("/__test__/offline");
  await page.goto(runtimeLocation);
  await expect(page.getByLabel("Plenum status: Offline")).toBeVisible();
  await expect(page.getByText(/protected offline view/u)).toBeVisible();
  await expect(page.getByText(/accepted/u).filter({ hasText: /local pending/u })).toHaveCount(0);
  await page.goto("/__test__/online");
  await page.goto(runtimeLocation);
  await expect(page.getByLabel("Plenum status: Connected")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /workspace$/u })).toBeVisible();
  await context.close();
});
