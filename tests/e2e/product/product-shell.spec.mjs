import { mkdir } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { fixture, runtimeUrl } from "../fixture.mjs";

const evidenceRoot = "output/playwright/ps-700";
const portalEvidenceRoot = "output/playwright/ps-710";
const lifecycleEvidenceRoot = "output/playwright/ps-720";
const studioEvidenceRoot = "output/playwright/ps-730";
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
  { label: /^Designer$/u, displayName: "Synthetic Designer A", heading: "Create a Project" },
  { label: /^Designer B\b/u, displayName: "Synthetic Designer B", heading: "Create a Project" },
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
  test.setTimeout(180_000);
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
  await expect(second.page.getByLabel("Scenario name")).toHaveValue(convergedName);

  await first.page.getByRole("button", { name: "Add learning objective" }).click();
  await expect(second.page.locator("#overview").getByText("New objective", { exact: true })).toBeVisible();
  await first.page.getByRole("button", { name: "Add Activity" }).click();
  await expect(second.page.locator("#activities").getByText("New Activity", { exact: true })).toBeVisible();
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
  await firstGroup.getByLabel("Parent Stage Group").selectOption({ index: 1 });
  await secondGroup.getByLabel("Parent Stage Group").selectOption({ index: 1 });
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
