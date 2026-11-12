import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

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
const operatorEvidenceRoot = "output/playwright/ps-780";
const operationsEvidenceRoot = "output/playwright/ps-790";
const platformLifecycleEvidenceRoot = "output/playwright/ps-800/after/platform-lifecycle";
const studioAuthoringEvidenceRoot = "output/playwright/ps-800/after/studio-authoring";
const familyEvidenceRoot = "output/playwright/ps-800/after/view-families";
const controlPlaneEvidenceRoot = "output/playwright/platform-control-plane";
const headers = (token) => ({ Authorization: `Bearer ${token}` });

async function actor(browser, token, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, extraHTTPHeaders: headers(token) });
  return { context, page: await context.newPage() };
}

async function horizontalOverflowState(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const reportedOverflow = Math.max(0, Math.ceil(root.scrollWidth - window.innerWidth));
    if (reportedOverflow === 0) return { overflow: 0, offenders: [] };
    const workspace = document.querySelector(".product-workspaces");
    const offenders = Array.from(document.body.querySelectorAll("*"))
      .filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left < -1 || bounds.right > window.innerWidth + 1;
      })
      .slice(0, 8)
      .map((element) => {
        const name = element.id === "" ? element.tagName.toLowerCase() : `${element.tagName.toLowerCase()}#${element.id}`;
        const classes = Array.from(element.classList ?? []).slice(0, 3).join(".");
        return `${name}${classes === "" ? "" : `.${classes}`}`;
      });
    if (offenders.length === 0) return { overflow: 0, offenders: [] };
    offenders.unshift(`metrics(inner=${window.innerWidth},client=${root.clientWidth},scroll=${root.scrollWidth},workspace-gutter=${workspace === null ? "missing" : getComputedStyle(workspace).scrollbarGutter})`);
    return { overflow: reportedOverflow, offenders };
  });
}

async function expectCompactWorkWordmark(page) {
  const wordmark = page.locator(".app-header .brand-wordmark img:visible");
  await expect(wordmark).toHaveCount(1);
  expect(Math.round(await wordmark.evaluate((image) => image.getBoundingClientRect().width))).toBeLessThanOrEqual(92);
}

async function openStudioWorkspace(page, name, regionName = name) {
  const picker = page.getByRole("combobox", { name: "Design workspace", exact: true });
  if (await picker.isVisible()) await picker.selectOption({ label: name });
  else await page.getByRole("navigation", { name: "Design workspaces" }).getByRole("link", { name, exact: true }).click();
  const workspace = page.getByRole("region", { name: regionName });
  await expect(workspace).toBeVisible();
  return workspace;
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
  await mkdir(operatorEvidenceRoot, { recursive: true });
  await mkdir(operationsEvidenceRoot, { recursive: true });
  await mkdir(familyEvidenceRoot, { recursive: true });
  await mkdir(platformLifecycleEvidenceRoot, { recursive: true });
  await mkdir(studioAuthoringEvidenceRoot, { recursive: true });
  await mkdir(controlPlaneEvidenceRoot, { recursive: true });
});

/** Studio has received every local change: the header status is shown and reports nothing waiting to synchronize. */
async function expectDraftSynchronized(page, options = {}) {
  const status = page.locator(".studio-draft-status");
  await expect(status).toBeVisible(options);
  await expect(status).not.toContainText("waiting to synchronize", options);
}

test("CONTROL-PLANE-E2E Platform Administrator completes Organization activation without Organization-role substitution @a11y", async ({ browser }) => {
  const { context, page } = await actor(browser, fixture.tokens.operator, { width: 1440, height: 900 });
  await page.goto("/platform/organizations");
  await expect(page.getByRole("heading", { name: "Organizations" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Platform control plane/u })).toHaveAttribute("aria-current", "page");
  await page.locator("summary", { hasText: "Provision Organization" }).click();
  await page.getByLabel("Organization name").fill("Synthetic Control Plane Organization");
  await page.getByLabel("Legal name").fill("Synthetic Control Plane Organization Ltd");
  await page.getByLabel("Workspace address").fill("synthetic-control-plane");
  await page.getByLabel("Country code").fill("US");
  await page.getByLabel("Time zone", { exact: true }).fill("Eastern time");
  await page.getByLabel("Data residency region").fill("us-east-2");
  await page.getByLabel("Support contact").fill("support@synthetic-control.example");
  await expect(page.getByText("This records the location; it does not move data.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Create pending Organization" }).click();
  await expect(page.getByRole("alert")).toContainText("Time zone is not recognized");
  await expect(page.getByLabel("Organization name")).toHaveValue("Synthetic Control Plane Organization");
  await page.getByLabel("Time zone", { exact: true }).fill("America/New_York");
  await page.getByRole("button", { name: "Create pending Organization" }).click();
  await expect(page).toHaveURL(/\/platform\/organizations\/[0-9a-f-]{36}$/iu);
  await expect(page.getByRole("heading", { name: "Synthetic Control Plane Organization" })).toBeVisible();
  await expect(page.getByText("2 of 4 prerequisites complete")).toBeVisible();

  const editProfile = page.locator("summary", { hasText: "Edit organization profile" });
  await editProfile.click();
  await expect(page.getByLabel("Country code")).toHaveValue("US");
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue("America/New_York");
  await expect(page.getByLabel("Data residency region")).toHaveValue("us-east-2");
  await page.getByLabel("Time zone", { exact: true }).fill("UTC");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(editProfile).toBeFocused();
  await editProfile.click();
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue("America/New_York");
  await page.getByLabel("Time zone", { exact: true }).fill("America/Indiana/Indianapolis");
  await page.getByRole("button", { name: "Save organization profile" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("Organization profile saved.");
  await page.reload();
  await editProfile.click();
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue("America/Indiana/Indianapolis");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.goto("/platform/organizations");
  await page.getByRole("link", { name: "Edit Synthetic Control Plane Organization", exact: true }).click();
  await expect(page).toHaveURL(/\/platform\/organizations\/[0-9a-f-]{36}#edit-organization-profile$/iu);
  await expect(page.getByLabel("Organization name")).toBeFocused();
  await page.getByLabel("Organization name").fill("Synthetic Control Plane Organization Renamed");
  await page.getByRole("button", { name: "Save organization profile" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("Organization profile saved.");
  await expect(page.getByRole("heading", { level: 1, name: "Synthetic Control Plane Organization Renamed" })).toBeVisible();
  await expect(page.getByText("Organization Renamed", { exact: true })).toBeVisible();

  await page.getByLabel("Add domain").fill("synthetic-control.example");
  await page.getByRole("button", { name: "Add domain" }).click();
  await expect(page.getByText("_plenum-verification.synthetic-control.example")).toBeVisible();
  await page.getByRole("button", { name: "Check DNS" }).click();
  await page.getByLabel("Admin email").fill("admin@synthetic-control.example");
  await page.getByRole("button", { name: "Create invitation" }).click();
  const invitationUrl = await page.getByLabel("One-time invitation link").inputValue();
  expect(invitationUrl).toMatch(/\/platform\/invitations\/[A-Za-z0-9_-]{43}$/u);

  const invitationContext = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const invitationPage = await invitationContext.newPage();
  await invitationPage.goto(invitationUrl);
  await expect(invitationPage.getByRole("heading", { name: "Accept Organization Admin access" })).toBeVisible();
  await invitationPage.getByLabel("Display name").fill("Synthetic First Admin");
  await invitationPage.getByRole("button", { name: "Accept Admin invitation" }).click();
  await expect(invitationPage.getByRole("heading", { name: "Admin access accepted" })).toBeVisible();
  expect((await new AxeBuilder({ page: invitationPage }).analyze()).violations).toEqual([]);
  await invitationContext.close();

  await page.reload();
  await expect(page.getByText("4 of 4 prerequisites complete")).toBeVisible();
  await page.getByLabel("Reason", { exact: true }).fill("Synthetic activation evidence complete");
  await page.getByRole("button", { name: "Activate Organization" }).click();
  await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Add domain", { exact: true }).fill("synthetic-active-control.example");
  await page.getByRole("button", { name: "Add domain", exact: true }).click();
  await expect(page.getByText("_plenum-verification.synthetic-active-control.example", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("_plenum-verification.synthetic-active-control.example", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add domain", exact: true })).toBeVisible();
  await page.getByRole("region", { name: "Organization domains", exact: true }).screenshot({ path: `${controlPlaneEvidenceRoot}/active-organization-domains.png` });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${controlPlaneEvidenceRoot}/organization-active-1440x900.png`, fullPage: true });
  const activeUrl = page.url();

  const denied = await context.request.get("/v1/platform/organizations", { headers: headers(fixture.tokens.portalOperator) });
  expect(denied.status()).toBe(403);
  await context.close();

  const narrow = await actor(browser, fixture.tokens.operator, { width: 390, height: 844 });
  await narrow.page.goto(activeUrl);
  await expect(narrow.page.getByRole("heading", { name: "Synthetic Control Plane Organization" })).toBeVisible();
  expect(await narrow.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await narrow.page.screenshot({ path: `${controlPlaneEvidenceRoot}/organization-active-390x844.png`, fullPage: true });
  await narrow.context.close();
});

test("CONTROL-PLANE-E2E Platform Administrator workforce exposes step-up, dual approval, and final-admin gates @a11y", async ({ browser }) => {
  const { context, page } = await actor(browser, fixture.tokens.operator, { width: 1440, height: 900 });
  await page.goto("/platform/administrators");
  await expect(page.getByRole("heading", { name: "Platform administrators" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Platform control plane" })
    .getByRole("link", { name: "Platform administrators" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(/Multifactor verification is current/u)).toBeVisible();
  await expect(page.getByText(/final active administrator cannot be removed/iu)).toBeVisible();

  await page.getByLabel("Display name").fill("Synthetic Platform Administrator");
  await page.getByLabel("Verified work email").fill("platform-admin@example.test");
  await page.getByLabel("Operational reason").fill("Provide a second accountable control-plane approver");
  await page.getByRole("button", { name: "Request invitation" }).click();
  await expect(page.getByText(/different Platform Administrator must approve/iu).first()).toBeVisible();
  await expect(page.getByText(/Requesters cannot approve their own privilege changes/iu)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${controlPlaneEvidenceRoot}/platform-administrators-1440x900.png`, fullPage: true });
  await context.close();

  const narrow = await actor(browser, fixture.tokens.operator, { width: 390, height: 844 });
  await narrow.page.goto("/platform/administrators");
  await expect(narrow.page.getByRole("heading", { name: "Platform administrators" })).toBeVisible();
  expect(await narrow.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await narrow.page.screenshot({ path: `${controlPlaneEvidenceRoot}/platform-administrators-390x844.png`, fullPage: true });
  await narrow.context.close();

  const invitationContext = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const invitationPage = await invitationContext.newPage();
  await invitationPage.goto(`/platform/administrator-invitations/${"a".repeat(43)}`);
  await expect(invitationPage.getByRole("heading", { name: "Join Plenum platform operations" })).toBeVisible();
  await expect(invitationPage.getByRole("link", { name: "Verify identity and continue" })).toHaveAttribute("href", /platformAdminInvitation=/u);
  expect((await new AxeBuilder({ page: invitationPage }).analyze()).violations).toEqual([]);
  await invitationContext.close();
});

test("PS-700 local user-test sign-in and sign-out use only the synthetic loopback identity", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  const entryActions = page.locator(".entry-v12 .site-nav").locator("a, button");
  await expect(entryActions).toHaveCount(2);
  await expect(entryActions.nth(0)).toHaveText("Sign in");
  await expect(page.locator(".hero__wordmark")).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.querySelector(".entry-v12")).backgroundImage)).toBe("none");
  await expect(entryActions.nth(1)).toHaveAttribute("aria-label", /^Theme:/u);
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Choose a test role" })).toBeVisible();
  const submitShape = await page.locator(".entry-auth-submit").evaluate((button) => {
    const icon = button.querySelector("svg");
    return { height: button.getBoundingClientRect().height, iconWidth: icon.getBoundingClientRect().width,
      iconHeight: icon.getBoundingClientRect().height, stroke: getComputedStyle(icon).stroke };
  });
  expect(submitShape.height).toBeLessThanOrEqual(64);
  expect(submitShape.iconWidth).toBeLessThanOrEqual(24);
  expect(submitShape.iconHeight).toBeLessThanOrEqual(24);
  expect(submitShape.stroke).not.toBe("none");
  await expect(page.locator(".entry-auth-diagram")).toHaveCount(0);
  await expect(page.locator(".entry-branch-diagram")).toHaveCount(0);
  const authCanvas = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--material-canvas)";
    document.body.append(probe);
    const result = {
      actual: getComputedStyle(document.body).backgroundColor,
      expected: getComputedStyle(probe).backgroundColor,
      image: getComputedStyle(document.body).backgroundImage
    };
    probe.remove();
    return result;
  });
  expect(authCanvas).toEqual({ actual: authCanvas.expected, expected: authCanvas.expected, image: "none" });
  await page.getByRole("combobox", { name: "Test role", exact: true }).selectOption("publisher");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.locator(".product-header-organization")).toHaveText("PS-150 synthetic organization");
  await page.goto("/__test__/offline");
  await expect(page.getByRole("heading", { name: "Account context is unavailable" })).toBeVisible();
  await expect(page.getByText("PS-150 synthetic organization")).toHaveCount(0);
  await page.goto("/__test__/online");
  await expect(page.locator(".product-header-organization")).toHaveText("PS-150 synthetic organization");
  await page.getByRole("button", { name: /Open account menu/ }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Plenum", exact: true })).toBeVisible();
  await expect(page.getByLabel("Plenum status: Sign-in required")).toHaveCount(1);
  await expect(page.getByText("Connection error", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Plenum", exact: true })).toBeVisible();
  await expect(page.getByLabel("Plenum status: Sign-in required")).toHaveCount(1);
  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByRole("combobox", { name: "Test role", exact: true }).selectOption("publisher");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Active Projects" })).toBeVisible();
  await context.close();
});

test("PS-700 theme preference persists across Runtime, Studio, sign-in, and open tabs", async ({ browser }) => {
  const { context, page } = await actor(browser, fixture.tokens.designerA);
  const sibling = await context.newPage();
  await Promise.all([page.goto("/"), sibling.goto("/")]);

  await page.getByRole("button", { name: /Use dark theme/u }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(sibling.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.goto(`/studio/projects/${fixture.projectId}`);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: /Use light theme/u })).toBeVisible();
  await page.goto("/auth/login?returnTo=%2F");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.goto(`/studio/projects/${fixture.projectId}`);
  await page.getByRole("button", { name: /Use light theme/u }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(sibling.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/auth/login?returnTo=%2F");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await context.close();
});

test("PS-700 Plenum loader governs initial, page, section, and Studio workspace transitions @a11y", async ({ browser }) => {
  const { context, page } = await actor(browser, fixture.tokens.designerA);
  let releaseContext;
  const contextGate = new Promise((resolve) => { releaseContext = resolve; });
  await page.route("**/v1/product-context", async (route) => { await contextGate; await route.continue(); });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const initialLoader = page.getByRole("status", { name: "Resolving next state" });
  await expect(initialLoader).toBeVisible();
  await expect(initialLoader.locator(".plenum-loader__petal")).toHaveCount(8);
  expect((await new AxeBuilder({ page }).include(".plenum-loader-overlay.is-visible").analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${evidenceRoot}/platform-loader-light.png` });
  releaseContext();
  await expect(page.getByRole("heading", { name: "Active Projects" })).toBeVisible();
  await page.unroute("**/v1/product-context");

  let releaseProjects;
  const projectsGate = new Promise((resolve) => { releaseProjects = resolve; });
  await page.route("**/v1/projects?**", async (route) => { await projectsGate; await route.continue(); });
  await page.goto("/?workspace=projects", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("status", { name: "Loading recent Project work" })).toBeVisible();
  releaseProjects();
  await expect(page.getByRole("heading", { name: "Active Projects" })).toBeVisible();
  await page.unroute("**/v1/projects?**");

  await page.goto(`/studio/projects/${fixture.projectId}`);
  await expect(page.getByRole("navigation", { name: "Design workspaces" })).toBeVisible();
  await page.getByRole("navigation", { name: "Design workspaces" }).getByRole("link", { name: "Teams", exact: true }).click();
  await expect(page.getByRole("region", { name: "Teams" })).toBeVisible();
  await expect(page.locator(".plenum-loader-overlay.is-visible")).toHaveCount(0);
  await expect(page).toHaveURL(/#teams$/u);
  await expect(page.getByRole("heading", { name: "Teams" })).toBeFocused();
  await page.goBack();
  await expect(page.getByRole("region", { name: "Teams" })).toBeHidden();
  await page.goForward();
  await expect(page.getByRole("region", { name: "Teams" })).toBeVisible();

  await Promise.all([
    expect(page.getByRole("status", { name: "Loading next page" })).toBeVisible(),
    page.locator(".studio-app-header .product-header-organization").click({ noWaitAfter: true })
  ]);
  await expect(page).toHaveURL(/\?workspace=projects$/u);
  await context.close();
});

test("PS-710 local user-test persona chooser is accessible without authorization headers @a11y", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/__test__/personas");
  await expect(page.getByRole("img", { name: "Plenum" })).toHaveAttribute("src", "/branding/plenum-wordmark-primary.png");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${portalEvidenceRoot}/persona-chooser.png`, fullPage: true });
  await context.close();
});

const localUserTestPersonas = [
  { value: "designerA", displayName: "Synthetic Designer A", heading: "Create a Project" },
  { value: "designerB", displayName: "Synthetic Designer B", heading: "Create a Project" },
  { value: "operator", displayName: "Synthetic operator", heading: "Create a Project" },
  { value: "finalReviewer", displayName: "Synthetic final reviewer", heading: "Review access", project: "PS-150 S1 proof" },
  { value: "portalOperator", displayName: "Synthetic portal operator", heading: "Simulation Releases" }
];

for (const persona of localUserTestPersonas) {
  test(`PS-710 local user-test ${persona.displayName} works without authorization headers`, async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/__test__/personas");
    await expect(page.getByRole("heading", { name: "Choose a test role" })).toBeVisible();
    await page.getByRole("combobox", { name: "Test role", exact: true }).selectOption(persona.value);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(`${baseURL}/`);
    await expect(page.getByRole("button", { name: `Open account menu for ${persona.displayName}` })).toBeVisible();
    await expect(page.getByRole("heading", { name: persona.heading })).toBeVisible();
    if (persona.project !== undefined) await expect(page.getByText(persona.project)).toBeVisible();
    if (persona.displayName === "Synthetic Designer A") {
      await page.getByLabel("Project name").fill("PS-710 cookie-only Designer Draft");
      await page.getByRole("button", { name: "Create Project and open Draft" }).click();
      await expect(page).toHaveURL(/\/studio\/projects\/[0-9a-f-]{36}$/u);
      await expect(page.locator(".studio-app-header .product-header-title")).toBeVisible();
      await expect(page.getByText("Connected", { exact: true })).toBeVisible();
    }
    await context.close();
  });
}

test("PS-700-T01 authenticated root is useful, branded, responsive, and accessible @a11y", async ({ browser }) => {
  const { context, page } = await actor(browser, fixture.tokens.operator);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Plenum" })).toHaveAttribute("src", "/branding/plenum-wordmark-primary.png");
  await expect(page.locator(".product-header-organization")).toHaveText("PS-150 synthetic organization");
  await expect(page.locator(".workspace-context-header")).toHaveCount(0);
  await expect(page.locator(".shell-grid > .account-context")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Workspaces" }).getByRole("link", { name: /^Project editor/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Releases and Sessions/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Active Projects" })).toBeVisible();
  const headerGeometry = await page.evaluate(() => {
    const header = document.querySelector(".app-header");
    const wordmark = document.querySelector(".app-header .brand-wordmark img:not([aria-hidden='true'])");
    const actions = document.querySelector(".header-actions");
    if (!(header instanceof HTMLElement) || !(wordmark instanceof HTMLElement) || !(actions instanceof HTMLElement)) throw new Error("Header geometry is unavailable");
    const headerBounds = header.getBoundingClientRect();
    const wordmarkBounds = wordmark.getBoundingClientRect();
    const actionBounds = actions.getBoundingClientRect();
    return { headerHeight: Math.round(headerBounds.height), wordmarkWidth: Math.round(wordmarkBounds.width),
      leftInset: Math.round(wordmarkBounds.left - headerBounds.left), rightInset: Math.round(headerBounds.right - actionBounds.right),
      shellNotices: document.querySelectorAll(".shell-notice").length };
  });
  expect(headerGeometry.headerHeight).toBeLessThanOrEqual(64);
  expect(headerGeometry.wordmarkWidth).toBeLessThanOrEqual(92);
  expect(headerGeometry.leftInset).toBe(20);
  expect(headerGeometry.rightInset).toBe(20);
  expect(headerGeometry.shellNotices).toBe(0);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await page.screenshot({ path: `${evidenceRoot}/root-light-desktop.png`, fullPage: true });
  const accountToggle = page.getByRole("button", { name: "Open account menu for Synthetic operator" });
  await accountToggle.click();
  const accountMenu = page.getByRole("dialog", { name: "Synthetic operator" });
  await expect(accountMenu).toBeFocused();
  await expect(accountMenu.getByText("PS-150 synthetic organization")).toBeVisible();
  await expect(accountMenu.getByText("Connected", { exact: true })).toBeVisible();
  await accountMenu.evaluate((menu) => Promise.all(menu.getAnimations().map((animation) => animation.finished)));
  await page.screenshot({ path: `${evidenceRoot}/root-account-menu-open.png`, fullPage: true });
  await page.keyboard.press("Escape");
  await expect(accountMenu).toBeHidden();
  await expect(accountToggle).toBeFocused();
  const shell = await context.request.get("/v1/product-context");
  expect(shell.status()).toBe(200);
  const body = await shell.json();
  expect(body.contractId).toBe("product-shell-v1");
  expect(JSON.stringify(body)).not.toContain(fixture.sessionId);
  expect(Object.keys(body).sort()).toEqual(["contractId", "destinations", "organization", "platformRoles", "principal"]);
  const hostileTenant = await context.request.get("/v1/product-context?organizationId=ffffffff-ffff-4fff-8fff-ffffffffffff");
  expect((await hostileTenant.json()).organization.id).toBe(fixture.organizationId);
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations).toEqual([]);

  await page.getByRole("button", { name: /Use dark theme/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".brand-wordmark-light")).toBeVisible();
  // Audit the settled palette, rather than interpolated colors during the theme transition.
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
    .map((animation) => animation.finished.catch(() => {}))));
  const darkViolations = await new AxeBuilder({ page }).analyze();
  expect(darkViolations.violations).toEqual([]);
  await page.screenshot({ path: `${evidenceRoot}/root-dark-desktop.png`, fullPage: true });
  await page.getByRole("button", { name: "Open account menu for Synthetic operator" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Plenum", exact: true })).toBeVisible();
  await expect(page.getByText("PS-150 synthetic organization")).toHaveCount(0);
  await context.close();
});

test("PS-700-T02 clean, unauthorized, offline, narrow, and 200-percent-text states recover", async ({ browser }) => {
  const clean = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const cleanPage = await clean.newPage();
  await cleanPage.goto("/");
  await expect(cleanPage.getByRole("heading", { name: "Plenum", exact: true })).toBeVisible();
  await expect(cleanPage.getByText("Design and deliver simulations,", { exact: false })).toBeVisible();
  await expect(cleanPage.getByLabel("Plenum status: Sign-in required")).toHaveCount(1);
  await expect(cleanPage.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth/login?returnTo=%2F");
  await expect(cleanPage.locator(".entry-branch-diagram")).toHaveCount(0);
  await expect(cleanPage.getByText("PS-150 synthetic organization")).toHaveCount(0);
  await cleanPage.screenshot({ path: `${evidenceRoot}/root-unauthorized-narrow.png`, fullPage: true });
  const denied = await clean.request.get("/v1/product-context");
  expect(denied.status()).toBe(401);
  await clean.close();

  const { context, page } = await actor(browser, fixture.tokens.designerA, { width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".product-header-organization")).toBeHidden();
  const accountToggle = page.getByRole("button", { name: "Open account menu for Synthetic Designer A" });
  await accountToggle.click();
  await expect(page.getByRole("dialog", { name: "Synthetic Designer A" }).getByText("PS-150 synthetic organization")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(accountToggle).toBeFocused();
  await expect(page.getByRole("link", { name: /Releases and Sessions/ })).toHaveCount(0);
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

test("PS-800-T01/T02 platform lifecycle uses one bounded, restorable workspace across desktop and narrow layouts @a11y", async ({ browser }) => {
  const desktop = await actor(browser, fixture.tokens.operator, { width: 1440, height: 900 });
  await desktop.page.goto("/?workspace=projects");
  await desktop.page.setViewportSize({ width: 1920, height: 900 });
  expect(await desktop.page.locator(".product-shell").evaluate((shell) => Math.round(shell.getBoundingClientRect().width))).toBe(1920);
  await desktop.page.setViewportSize({ width: 1440, height: 900 });
  await expect(desktop.page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  await expect(desktop.page.locator(".portal-toolbar")).toHaveCount(0);
  await expect(desktop.page.getByRole("navigation", { name: "Workspaces" }).getByRole("link", { name: /^Projects/ })).toHaveAttribute("aria-current", "page");
  await expect(desktop.page.locator(".project-list > .catalog-row").first()).toBeVisible();
  await expect(desktop.page.locator(".project-list > .card")).toHaveCount(0);
  const initialProjectRows = desktop.page.locator(".project-list > .catalog-row");
  await expect(initialProjectRows.locator(".catalog-primary-action")).toHaveCount(await initialProjectRows.count());
  await desktop.page.locator(".product-workspaces").evaluate((element) => { element.scrollTop = 0; });
  await desktop.page.screenshot({ path: `${platformLifecycleEvidenceRoot}/platform-projects-1440x900.png` });
  await desktop.page.locator(".product-workspaces").evaluate((element) => { element.scrollTop = Math.min(360, element.scrollHeight - element.clientHeight); });
  await desktop.page.screenshot({ path: `${platformLifecycleEvidenceRoot}/platform-project-catalog-1440x900.png` });
  await desktop.page.locator(".product-workspaces").evaluate((element) => { element.scrollTop = 0; });
  await desktop.page.getByLabel("Search Projects").fill("PS-800 no matching Project");
  await desktop.page.getByRole("button", { name: "Search Projects" }).click();
  await expect(desktop.page.getByRole("heading", { name: "No matching Projects" })).toBeVisible();
  await desktop.page.screenshot({ path: `${platformLifecycleEvidenceRoot}/projects-empty-no-results-1440x900.png` });
  await desktop.page.getByRole("button", { name: "Clear Project filters" }).click();
  await expect(desktop.page.locator(".project-list > .catalog-row").first()).toBeVisible();
  const typeRoles = await desktop.page.evaluate(() => {
    const resolveSize = (token) => {
      const probe = document.createElement("span");
      probe.style.fontSize = `var(${token})`;
      document.body.append(probe);
      const value = getComputedStyle(probe).fontSize;
      probe.remove();
      return value;
    };
    const size = (selector) => getComputedStyle(document.querySelector(selector)).fontSize;
    return {
      actual: {
        workspace: size(".product-header-title"),
        section: size(".section-heading h2"), object: size(".project-row h3"),
        detail: size(".catalog-row dd"), label: size(".catalog-row dt")
      },
      expected: {
        workspace: resolveSize("--text-sm"),
        section: resolveSize("--text-lg"), object: resolveSize("--text-base"),
        detail: resolveSize("--text-sm"), label: resolveSize("--text-xs")
      }
    };
  });
  expect(typeRoles.actual).toEqual(typeRoles.expected);
  await expect.poll(() => desktop.page.evaluate(() => document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1)).toBe(true);
  await desktop.page.getByRole("link", { name: /^Releases and Sessions/ }).click();
  await expect(desktop.page).toHaveURL(/\?workspace=lifecycle$/u);
  await expect(desktop.page.getByRole("heading", { level: 1, name: "Releases and Sessions" })).toBeVisible();
  await expect(desktop.page.getByRole("heading", { name: "Releases and Sessions", exact: true })).toHaveCount(1);
  await expect(desktop.page.getByRole("navigation", { name: "Workspaces" }).locator('a[aria-current="page"] span')).toBeVisible();
  expect(await desktop.page.getByRole("navigation", { name: "Workspaces" }).locator('a:not([aria-current="page"]) span').evaluateAll((descriptions) =>
    descriptions.every((description) => getComputedStyle(description).display === "none"))).toBe(true);
  await expect(desktop.page.locator("#release-catalog")).toBeVisible();
  await expect(desktop.page.locator("#release-catalog .release-list > .card")).toHaveCount(0);
  await expect(desktop.page.locator("#session-catalog .session-list > .card")).toHaveCount(0);
  await desktop.page.getByLabel("Search Releases").fill("PS-800 no matching Release");
  await desktop.page.getByRole("button", { name: "Search Releases" }).click();
  await expect(desktop.page.getByRole("heading", { name: "No matching Releases" })).toBeVisible();
  await desktop.page.screenshot({ path: `${platformLifecycleEvidenceRoot}/releases-empty-no-results-1440x900.png` });
  await desktop.page.getByRole("button", { name: "Show all Releases" }).click();
  await expect(desktop.page.locator("#release-catalog .catalog-row").first()).toBeVisible();
  const releaseRows = desktop.page.locator("#release-catalog .catalog-row");
  await expect(releaseRows.locator(".catalog-primary-action")).toHaveCount(await releaseRows.count());
  await expect(releaseRows.first().locator(".catalog-facts dt")).toHaveText(["Project", "Published", "Approvals", "Sessions"]);
  await desktop.page.getByLabel("Search Sessions").fill("PS-800 no matching Session");
  await desktop.page.getByRole("button", { name: "Search Sessions" }).click();
  await expect(desktop.page.getByRole("heading", { name: "No matching Sessions" })).toBeVisible();
  await desktop.page.screenshot({ path: `${platformLifecycleEvidenceRoot}/sessions-empty-no-results-1440x900.png` });
  await desktop.page.getByRole("button", { name: "Show all Sessions" }).click();
  await expect(desktop.page.locator("#session-catalog .catalog-row").first()).toBeVisible();
  const sessionRows = desktop.page.locator("#session-catalog .catalog-row");
  await expect(sessionRows.locator(".catalog-primary-action")).toHaveCount(await sessionRows.count());
  const openSession = sessionRows.filter({ hasText: "PS-780 Operator Control Exercise" });
  await expect(openSession.getByRole("link", { name: "Start Session" })).toHaveAttribute("href", /#staffing-title$/u);
  const activeSession = sessionRows.filter({ hasText: "PS-150 S1 proof Session" });
  await expect(activeSession.getByRole("link", { name: "Open Runtime" })).toHaveAttribute("href", /\/runtime$/u);
  await desktop.page.route("**/v1/sessions?**", (route) => route.fulfill({
    status: 503, contentType: "application/json",
    body: JSON.stringify({ error: { code: "SERVICE_UNAVAILABLE", message: "Session catalog temporarily unavailable.", correlationId: "ps-800-step-4" } })
  }));
  await desktop.page.getByRole("button", { name: "Search Sessions" }).click();
  await expect(desktop.page.getByRole("alert")).toContainText("Sessions could not be loaded. Releases remain available");
  await desktop.page.getByRole("alert").scrollIntoViewIfNeeded();
  await desktop.page.screenshot({ path: `${platformLifecycleEvidenceRoot}/sessions-error-recoverable-partial-failure-1440x900.png` });
  await desktop.page.unroute("**/v1/sessions?**");
  await desktop.page.getByRole("button", { name: "Retry loading Sessions" }).click();
  await expect(desktop.page.locator("#session-catalog .catalog-row").first()).toBeVisible();
  await desktop.page.locator("#session-catalog .catalog-row").first().scrollIntoViewIfNeeded();
  await desktop.page.screenshot({ path: `${platformLifecycleEvidenceRoot}/sessions-success-recovered-1440x900.png` });
  expect((await new AxeBuilder({ page: desktop.page }).analyze()).violations).toEqual([]);
  await desktop.page.locator(".product-workspaces").evaluate((element) => { element.scrollTop = 0; });
  await desktop.page.screenshot({ path: `${platformLifecycleEvidenceRoot}/platform-lifecycle-1440x900.png` });
  await desktop.context.close();

  const narrow = await actor(browser, fixture.tokens.designerA, { width: 390, height: 844 });
  await narrow.page.goto("/?workspace=projects");
  await expect(narrow.page.getByRole("button", { name: "Open workspaces" })).toBeVisible();
  await expect(narrow.page.getByRole("navigation", { name: "Workspaces" })).toBeHidden();
  await narrow.page.getByRole("button", { name: "Open workspaces" }).click();
  await expect(narrow.page.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
  await narrow.page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expect.poll(() => narrow.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await narrow.page.screenshot({ path: `${platformLifecycleEvidenceRoot}/platform-lifecycle-390x844-200-percent.png`, fullPage: true });
  await narrow.context.close();
});

test("PS-800-T03 platform lifecycle preserves task order across height, tablet, mobile, touch, zoom, reduced motion, and forced colors @a11y", async ({ browser }) => {
  test.setTimeout(180_000);

  const constrained = await actor(browser, fixture.tokens.operator, { width: 1280, height: 600 });
  await constrained.page.goto("/?workspace=lifecycle");
  const constrainedToggle = constrained.page.getByRole("button", { name: "Open account menu for Synthetic operator" });
  await expect(constrainedToggle).toBeVisible();
  await expect(constrained.page.locator("#account-context-menu")).toBeHidden();
  await expect.poll(() => constrained.page.evaluate(() => document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1)).toBe(true);
  await expect.poll(() => constrained.page.locator(".product-workspaces").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await constrainedToggle.click();
  const constrainedAccount = constrained.page.getByRole("dialog", { name: "Synthetic operator" });
  await expect(constrainedAccount).toBeVisible();
  await expect(constrainedAccount).not.toHaveAttribute("aria-modal", "true");
  await expect(constrainedAccount).toBeFocused();
  await constrained.page.keyboard.press("Escape");
  await expect(constrainedAccount).toBeHidden();
  await expect(constrainedToggle).toBeFocused();
  await constrained.page.screenshot({ path: `${platformLifecycleEvidenceRoot}/platform-lifecycle-1280x600.png` });
  await constrained.context.close();

  const tablet = await actor(browser, fixture.tokens.operator, { width: 1024, height: 768 });
  await tablet.page.goto("/?workspace=lifecycle");
  await expect(tablet.page.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
  const tabletToggle = tablet.page.getByRole("button", { name: "Open account menu for Synthetic operator" });
  await expect(tabletToggle).toBeVisible();
  await expect(tablet.page.locator("#account-context-menu")).toBeHidden();
  await expect.poll(() => tablet.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await tabletToggle.click();
  const tabletAccount = tablet.page.getByRole("dialog", { name: "Synthetic operator" });
  await expect(tabletAccount).toBeFocused();
  await tabletAccount.evaluate((menu) => Promise.all(menu.getAnimations().map((animation) => animation.finished)));
  await tablet.page.screenshot({ path: `${platformLifecycleEvidenceRoot}/platform-lifecycle-1024x768-account-menu.png` });
  await tablet.page.keyboard.press("Escape");
  await expect(tabletToggle).toBeFocused();
  await tablet.context.close();

  const portrait = await actor(browser, fixture.tokens.operator, { width: 768, height: 1024 });
  await portrait.page.goto("/?workspace=lifecycle");
  await expect(portrait.page.getByRole("navigation", { name: "Workspaces" })).toBeHidden();
  await portrait.page.getByRole("button", { name: "Open workspaces" }).click();
  await expect(portrait.page.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
  await portrait.page.getByRole("button", { name: "Open account menu for Synthetic operator" }).click();
  await expect(portrait.page.getByRole("navigation", { name: "Workspaces" })).toBeHidden();
  await expect(portrait.page.locator("#account-context-menu")).toBeFocused();
  expect(await portrait.page.evaluate(() => {
    const account = document.querySelector("#account-context-menu")?.getBoundingClientRect();
    return account !== undefined && account.top >= 0 && account.right <= innerWidth && account.bottom <= innerHeight;
  })).toBe(true);
  await expect.poll(() => portrait.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await portrait.page.screenshot({ path: `${platformLifecycleEvidenceRoot}/platform-lifecycle-768x1024-access-context.png`, fullPage: true });
  await portrait.context.close();

  const zoomed = await actor(browser, fixture.tokens.operator, { width: 320, height: 720 });
  await zoomed.page.goto("/?workspace=lifecycle");
  await zoomed.page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expect.poll(() => horizontalOverflowState(zoomed.page)).toEqual({ overflow: 0, offenders: [] });
  expect(await zoomed.page.evaluate(() => {
    const workspaces = document.querySelector(".workspace-navigation-toggle")?.getBoundingClientRect();
    const account = document.querySelector(".account-context-toggle")?.getBoundingClientRect();
    return workspaces !== undefined && account !== undefined && account.top === workspaces.top && account.right <= innerWidth;
  })).toBe(true);
  await expect(zoomed.page.locator("#release-catalog .catalog-primary-action").first()).toBeVisible();
  expect(await zoomed.page.locator("#release-catalog .catalog-row").first().evaluate((row) => {
    const identity = row.querySelector("h3");
    const primary = row.querySelector(".catalog-primary-action");
    return identity !== null && primary !== null && Boolean(identity.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  expect((await new AxeBuilder({ page: zoomed.page }).analyze()).violations).toEqual([]);
  await zoomed.page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await zoomed.page.screenshot({ path: `${platformLifecycleEvidenceRoot}/platform-lifecycle-320x720-200-percent.png`, fullPage: true });
  await zoomed.context.close();

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, extraHTTPHeaders: headers(fixture.tokens.operator) });
  const touchPage = await touchContext.newPage();
  await touchPage.goto("/?workspace=lifecycle");
  await touchPage.getByRole("button", { name: "Open workspaces" }).tap();
  await expect(touchPage.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
  expect(await touchPage.evaluate(() => Array.from(document.querySelectorAll(".shell-navigation a, .catalog-primary-action, button"))
    .filter((element) => element instanceof HTMLElement && element.offsetParent !== null && element.getBoundingClientRect().height < 44)
    .map((element) => ({ tag: element.tagName, label: element.textContent?.trim(), className: element.className,
      height: element.getBoundingClientRect().height })))).toEqual([]);
  await touchPage.getByRole("button", { name: "Close workspaces" }).tap();
  await touchPage.screenshot({ path: `${platformLifecycleEvidenceRoot}/platform-lifecycle-390x844-touch.png`, fullPage: true });
  await touchContext.close();

  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", extraHTTPHeaders: headers(fixture.tokens.operator) });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto("/?workspace=lifecycle");
  expect(await reducedPage.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  expect(await reducedPage.getByRole("button", { name: "Open workspaces" }).evaluate((element) => {
    const values = getComputedStyle(element).transitionDuration.split(",").map((value) => value.trim());
    return values.every((value) => value.endsWith("ms") ? Number.parseFloat(value) <= 0.01 : Number.parseFloat(value) * 1000 <= 0.01);
  })).toBe(true);
  await reducedPage.getByRole("button", { name: "Open workspaces" }).click();
  await expect(reducedPage.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
  await reducedPage.screenshot({ path: `${platformLifecycleEvidenceRoot}/platform-lifecycle-390x844-reduced-motion.png`, fullPage: true });
  await reducedContext.close();

  const forcedContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, forcedColors: "active", extraHTTPHeaders: headers(fixture.tokens.operator) });
  const forcedPage = await forcedContext.newPage();
  await forcedPage.goto("/?workspace=lifecycle");
  expect(await forcedPage.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true);
  await expect(forcedPage.getByRole("link", { name: "PS-780 Operator Control Exercise", exact: true })).toBeVisible();
  expect(await forcedPage.evaluate(() => {
    const current = document.querySelector('.shell-navigation a[aria-current="page"]');
    const available = Array.from(document.querySelectorAll(".shell-navigation a")).find((link) => link !== current);
    if (!(current instanceof HTMLElement) || !(available instanceof HTMLElement)) return false;
    return getComputedStyle(current).borderInlineStartColor !== getComputedStyle(available).borderInlineStartColor;
  })).toBe(true);
  await forcedPage.getByRole("link", { name: "PS-780 Operator Control Exercise", exact: true }).click();
  const forcedDestinations = forcedPage.getByRole("navigation", { name: "Session destinations" });
  await expect(forcedDestinations.locator(".btn-primary")).toHaveCount(1);
  const forcedReports = forcedDestinations.getByRole("link", { name: "Reports", exact: true });
  await expect(forcedReports).toHaveAttribute("aria-disabled", "true");
  await expect(forcedReports).toHaveAccessibleDescription("Complete the Session before Reports is available.");
  await expect(forcedReports).toHaveCSS("border-top-style", "solid");
  expect((await new AxeBuilder({ page: forcedPage }).analyze()).violations).toEqual([]);
  await forcedPage.screenshot({ path: `${platformLifecycleEvidenceRoot}/platform-lifecycle-1280x720-forced-colors.png`, fullPage: true });
  await forcedContext.close();
});

test("PS-800-T04 Studio and the five remaining view families preserve bounded workspaces, task order, and progressive provenance @a11y", async ({ browser }) => {
  test.setTimeout(180_000);

  const studio = await actor(browser, fixture.tokens.designerA, { width: 1440, height: 900 });
  await studio.page.goto(`/studio/projects/${fixture.projectId}`);
  await expectCompactWorkWordmark(studio.page);
  await expect(studio.page.locator(".studio-app-header .product-header-organization")).toHaveText("PS-150 synthetic organization");
  await expect(studio.page.locator(".studio-app-header .product-header-title")).toBeVisible();
  await expect(studio.page.locator(".studio-context")).toHaveCount(0);
  await expect(studio.page.getByLabel("Plenum status: Connected")).toBeVisible();
  await expect(studio.page.getByRole("button", { name: /^Theme:/u })).toBeVisible();
  const studioAccount = studio.page.getByRole("button", { name: "Open account menu for Synthetic Designer A" });
  await studioAccount.click();
  await expect(studio.page.getByRole("dialog", { name: "Synthetic Designer A" })).toContainText("Designer");
  await studio.page.keyboard.press("Escape");
  await expect(studioAccount).toBeFocused();
  await expect(studio.page.locator(".visual-editor")).toBeVisible();
  await expect(studio.page.getByRole("navigation", { name: "Design workspaces" })).toBeVisible();
  await expect(studio.page.getByRole("complementary", { name: "Draft guidance" })).toBeVisible();
  await expect.poll(() => studio.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page: studio.page }).analyze()).violations).toEqual([]);
  await studio.page.screenshot({ path: `${familyEvidenceRoot}/studio-authoring-1440x900.png` });
  await studio.context.close();

  const participant = await actor(browser, fixture.tokens.designerA, { width: 1440, height: 900 });
  await participant.page.goto(runtimeUrl(fixture.tokens.designerA));
  await expect(participant.page.locator(".participant-runtime-workspace")).toBeVisible();
  await expect(participant.page.getByRole("button", { name: /^Session: /u })).toBeVisible();
  await expect(participant.page.locator("#runtime-navigation")).toBeVisible();
  await expect(participant.page.getByText("Start here", { exact: true })).toBeVisible();
  await expect.poll(() => participant.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page: participant.page }).analyze()).violations).toEqual([]);
  await participant.page.screenshot({ path: `${familyEvidenceRoot}/participant-runtime-1440x900.png` });
  await participant.context.close();

  const operator = await actor(browser, fixture.tokens.portalOperator, { width: 1440, height: 900 });
  await operator.page.goto(`/admin/sessions/${fixture.operatorSessionId}`);
  await expect(operator.page.getByRole("button", { name: /^Session: PS-780 Operator Control Exercise/u })).toBeVisible();
  await expect(operator.page.locator(".operator-workspace")).toBeVisible();
  await expect(operator.page.getByRole("navigation", { name: "Session operations" })).toBeVisible();
  await expect(operator.page.getByText("Start here", { exact: true })).toBeVisible();
  await expect(operator.page.getByLabel("Next valid action")).toBeVisible();
  expect((await new AxeBuilder({ page: operator.page }).analyze()).violations).toEqual([]);
  await operator.page.screenshot({ path: `${familyEvidenceRoot}/operator-control-1440x900.png` });
  await operator.context.close();

  const administration = await actor(browser, fixture.tokens.operator, { width: 1440, height: 900 });
  await administration.page.goto("/admin/members");
  await expectCompactWorkWordmark(administration.page);
  await expect(administration.page.getByRole("heading", { level: 1, name: "Workforce access" })).toBeVisible();
  await expect(administration.page.getByRole("navigation", { name: "Administration destinations" })).toBeVisible();
  expect((await new AxeBuilder({ page: administration.page }).analyze()).violations).toEqual([]);
  await administration.page.screenshot({ path: `${familyEvidenceRoot}/organization-administration-1440x900.png` });
  await administration.context.close();

  const research = await actor(browser, fixture.tokens.designerB, { width: 1440, height: 900 });
  await research.page.goto("/research/reports");
  await expectCompactWorkWordmark(research.page);
  await expect(research.page.getByRole("heading", { level: 1, name: "Research reports" })).toBeVisible();
  await expect(research.page.getByRole("heading", { name: "Provenance inspection" })).toBeVisible();
  await expect(research.page.getByRole("heading", { name: "Your generated exports" })).toBeVisible();
  expect((await new AxeBuilder({ page: research.page }).analyze()).violations).toEqual([]);
  await research.page.screenshot({ path: `${familyEvidenceRoot}/reporting-research-1440x900.png` });
  await research.context.close();

  const replay = await actor(browser, fixture.tokens.portalOperator, { width: 1440, height: 900 });
  await replay.page.goto(`/admin/sessions/${fixture.operatorSessionId}/replay`);
  await expect(replay.page.getByRole("heading", { level: 1, name: "Replay" })).toBeVisible();
  await expect(replay.page.getByRole("heading", { name: "Replay Session evidence" })).toBeVisible();
  await expect(replay.page.getByText(/^Deterministic Replay is unavailable on this deployment/u)).toBeVisible();
  await expect(replay.page.getByRole("button", { name: "Run replay" })).toHaveCount(0);
  await expect(replay.page.getByRole("heading", { level: 2, name: "Session control", exact: true })).toHaveCount(0);
  expect((await new AxeBuilder({ page: replay.page }).analyze()).violations).toEqual([]);
  await replay.page.screenshot({ path: `${familyEvidenceRoot}/replay-archive-1440x900.png` });
  await replay.context.close();

  const constrained = await actor(browser, fixture.tokens.designerA, { width: 320, height: 720 });
  await constrained.page.goto(runtimeUrl(fixture.tokens.designerA));
  await expect(constrained.page.locator(".participant-runtime-workspace")).toBeVisible();
  await constrained.page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expect.poll(() => constrained.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await constrained.page.evaluate(() => Array.from(document.querySelectorAll("button,a,input,select,textarea,summary"))
    .filter((element) => element instanceof HTMLElement && element.offsetParent !== null &&
      (element.getBoundingClientRect().width < 24 || element.getBoundingClientRect().height < 24)).length)).toBe(0);
  expect((await new AxeBuilder({ page: constrained.page }).analyze()).violations).toEqual([]);
  await constrained.page.screenshot({ path: `${familyEvidenceRoot}/participant-runtime-320x720-200-percent.png`, fullPage: true });
  await constrained.context.close();
});

test("PS-710-T01 Designer creates, archives, reopens, and resumes a blank Project using visible controls @a11y", async ({ browser }) => {
  const { context, page } = await actor(browser, fixture.tokens.designerA);
  const projectName = "PS-710 visible blank Project";
  await page.goto("/?workspace=projects");
  await expect(page.getByRole("heading", { name: "Active Projects" })).toBeVisible();
  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Create Project and open Draft" }).click();
  await expect(page).toHaveURL(/\/studio\/projects\/[0-9a-f-]{36}$/u);
  await expect(page.locator(".studio-app-header .product-header-title")).toBeVisible();

  await page.goto("/?workspace=projects");
  const activeProject = page.locator(".project-row").filter({ hasText: projectName });
  await expect(activeProject).toBeVisible();
  const stalePage = await context.newPage();
  await stalePage.goto("/?workspace=projects");
  const staleProject = stalePage.locator(".project-row").filter({ hasText: projectName });
  await expect(staleProject).toBeVisible();
  await activeProject.getByRole("button", { name: "Archive Project" }).click();
  await expect(activeProject.getByRole("button", { name: "Keep Project active" })).toBeFocused();
  await expect(activeProject.getByText("Existing published Releases remain available and unchanged.", { exact: false })).toBeVisible();
  await activeProject.getByRole("button", { name: "Archive Project" }).last().click();
  await expect(activeProject).toHaveCount(0);

  await staleProject.getByRole("button", { name: "Archive Project" }).click();
  await staleProject.getByRole("button", { name: "Archive Project" }).last().click();
  const staleArchiveNotice = stalePage.getByText("Project state changed in another tab. This view was refreshed.");
  await expect(staleArchiveNotice).toBeVisible();
  await expect(staleArchiveNotice).toBeFocused();
  await expect(staleProject).toHaveCount(0);

  await page.getByLabel("Status", { exact: true }).selectOption("archived");
  await page.getByRole("button", { name: "Search Projects" }).click();
  await stalePage.getByLabel("Status", { exact: true }).selectOption("archived");
  await stalePage.getByRole("button", { name: "Search Projects" }).click();
  const archivedProject = page.locator(".project-row").filter({ hasText: projectName });
  const staleArchivedProject = stalePage.locator(".project-row").filter({ hasText: projectName });
  await expect(archivedProject).toBeVisible();
  await expect(staleArchivedProject).toBeVisible();
  await archivedProject.getByRole("button", { name: "Reopen Project" }).click();
  await expect(archivedProject).toHaveCount(0);
  await staleArchivedProject.getByRole("button", { name: "Reopen Project" }).click();
  const staleReopenNotice = stalePage.getByText("Project state changed in another tab. This view was refreshed.");
  await expect(staleReopenNotice).toBeVisible();
  await expect(staleReopenNotice).toBeFocused();
  await expect(staleArchivedProject).toHaveCount(0);
  await page.getByLabel("Status", { exact: true }).selectOption("active");
  await page.getByRole("button", { name: "Search Projects" }).click();
  await expect(page.locator(".project-row").filter({ hasText: projectName })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${portalEvidenceRoot}/designer-project-lifecycle.png`, fullPage: true });
  await context.close();
});

test("PS-710-T02 Template defaults, Admin and Reviewer views, and Operator denial are enforced", async ({ browser }) => {
  test.setTimeout(240_000);
  const designer = await actor(browser, fixture.tokens.designerB);
  const projectName = "PS-710 Template Core Design copy";
  await designer.page.goto("/?workspace=projects");
  const template = designer.page.locator(".template-row").filter({ hasText: "Fractured Order Core Design" });
  await expect(template).toBeVisible();
  await template.getByRole("button", { name: "Start from Template" }).click();
  await designer.page.getByLabel("Project name").fill(projectName);
  await expect(designer.page.getByLabel("Copy optional Scenario content")).not.toBeChecked();
  await designer.page.getByRole("button", { name: "Create Project and open Draft" }).click();
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
  await reviewer.page.goto("/?workspace=projects");
  await expect(reviewer.page.getByRole("heading", { name: "Review access" })).toBeVisible();
  await expect(reviewer.page.getByRole("heading", { name: "Create a Project" })).toHaveCount(0);
  await expect(reviewer.page.getByRole("button", { name: "Archive" })).toHaveCount(0);
  expect((await reviewer.context.request.get("/v1/projects?limit=10")).status()).toBe(200);
  expect((await reviewer.context.request.post("/v1/projects", { data: { requestId: crypto.randomUUID(), title: "Denied" } })).status()).toBe(403);
  await reviewer.context.close();

  const operator = await actor(browser, fixture.tokens.portalOperator);
  await operator.page.goto("/?workspace=lifecycle");
  await expect(operator.page.getByRole("heading", { level: 1, name: "Releases and Sessions" })).toBeVisible();
  await expect(operator.page.getByRole("link", { name: /^Projects/ })).toHaveCount(0);
  const denied = await operator.context.request.get("/v1/projects");
  expect(denied.status()).toBe(403);
  expect(JSON.stringify(await denied.json())).not.toContain(fixture.projectId);
  await operator.page.screenshot({ path: `${portalEvidenceRoot}/operator-denied.png`, fullPage: true });
  await operator.context.close();
});

test("PS-800 Project QA demo is role-navigable, interactive, isolated, and least-privilege @a11y", async ({ browser, request }) => {
  test.setTimeout(120_000);
  expect((await request.get(`/v1/projects/${fixture.projectId}/demo`, { headers: headers(fixture.tokens.designerA) })).status()).toBe(200);
  expect((await request.get(`/v1/projects/${fixture.projectId}/demo`, { headers: headers(fixture.tokens.finalReviewer) })).status()).toBe(200);
  expect((await request.get(`/v1/projects/${fixture.projectId}/demo`, { headers: headers(fixture.tokens.operator) })).status()).toBe(200);
  expect((await request.get(`/v1/projects/${fixture.projectId}/demo`, { headers: headers(fixture.tokens.portalOperator) })).status()).toBe(403);

  const { context, page } = await actor(browser, fixture.tokens.designerA, { width: 1440, height: 900 });
  await page.goto("/?workspace=projects");
  const project = page.locator(".project-row").filter({ hasText: "PS-150 S1 proof" });
  await expect(project.getByRole("link", { name: "Open QA demo" })).toBeVisible();
  await project.getByRole("link", { name: "Open QA demo" }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/projects/${fixture.projectId}/demo`);
  await expect(page.locator(".qa-demo-mode-label")).toContainText("QA Demo Isolated Draft");
  await expect(page.getByText("Sessions, participants, evidence, reports, and the Project Draft are unchanged.")).toBeVisible();
  await expectCompactWorkWordmark(page);

  await page.getByLabel("Role", { exact: true }).selectOption("scribe");
  await page.getByLabel("Team", { exact: true }).selectOption("blue");
  await page.getByLabel("Stage", { exact: true }).selectOption("orientation");
  const orientation = page.getByRole("region", { name: "Strategic Orientation", exact: true })
    .getByRole("region", { name: "Blue Strategic Orientation", exact: true });
  await orientation.getByRole("radiogroup", { name: "Blue strategic orientation" }).getByRole("radio", { name: "Pressure", exact: true }).check();
  await orientation.getByRole("radiogroup", { name: "Forecast Red orientation" }).getByRole("radio", { name: "Stabilization", exact: true }).check();
  await orientation.getByLabel("What will Red do first?").fill("Red will consolidate its opening position before applying pressure.");
  await orientation.getByRole("button", { name: "Create demo artifact" }).click();
  const artifact = page.locator(".qa-demo-artifact").filter({ has: page.getByRole("heading", { name: "Blue Strategic Orientation" }) });
  await expect(artifact).toBeVisible();
  await artifact.getByRole("button", { name: "Submit to Team Facilitator" }).click();
  await expect(artifact.getByText("With Team Facilitator", { exact: true })).toBeVisible();

  await page.getByLabel("Role", { exact: true }).selectOption("facilitator");
  await artifact.getByRole("button", { name: "Forward to White Cell" }).click();
  await expect(artifact.getByText("With White Cell", { exact: true })).toBeVisible();
  await page.getByLabel("Role", { exact: true }).selectOption("white_cell");
  await page.getByRole("navigation", { name: "Participant interface" }).getByRole("button", { name: "Actions", exact: true }).click();
  await artifact.getByRole("button", { name: "Accept" }).click();
  await expect(artifact.getByText("Completed", { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${studioAuthoringEvidenceRoot}/project-qa-demo-1440x900.png`, fullPage: true });

  await page.reload();
  await expect(page.locator(".qa-demo-artifact")).toHaveCount(0);
  await expect(page.getByText("Actions and artifacts stay in this browser memory and clear on reload.")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 720 });
  await expect(page.locator(".qa-demo-context")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `${studioAuthoringEvidenceRoot}/project-qa-demo-320x720.png`, fullPage: true });
  await context.close();
});

test("PS-720-T01 Publisher finds, exports, verifies, and revisits an immutable Release @a11y", async ({ browser }) => {
  const { context, page } = await actor(browser, fixture.tokens.publisher);
  await page.goto("/?workspace=lifecycle");
  const catalog = page.locator("#release-catalog");
  await expect(catalog.getByRole("heading", { name: "Simulation Releases" })).toBeVisible();
  const release = catalog.locator(".lifecycle-row").filter({ hasText: "S1 proof 1.0.0" });
  await expect(release.getByText("Immutable", { exact: true })).toBeVisible();
  await expect(release.locator(".catalog-facts div").filter({ hasText: "Approvals" }).locator("dd")).toHaveText("1");
  await expect(release.locator(".catalog-facts div").filter({ hasText: "Sessions" }).locator("dd")).toHaveText("1");
  await expect(release.getByText(/^[0-9a-f]{64}$/u)).toBeHidden();
  await release.getByText("Package provenance").click();
  await expect(release.getByText(/^[0-9a-f]{64}$/u)).toBeVisible();
  await expect(release.getByRole("button", { name: "Create Session from this Release" })).toHaveCount(0);
  await expect(release.locator(".catalog-primary-action")).toHaveCount(1);
  await expect(release.getByRole("link", { name: "Export verified Package" })).toHaveClass(/btn-primary/u);

  const downloadPromise = page.waitForEvent("download");
  await release.getByRole("link", { name: "Export verified Package" }).click();
  const download = await downloadPromise;
  const packagePath = await download.path();
  expect(packagePath).not.toBeNull();
  await page.getByLabel("Release Package file").setInputFiles(packagePath);
  await page.getByRole("button", { name: "Verify and import Release" }).click();
  await expect(page.getByText("This immutable Release Package was already present.")).toBeVisible();

  await release.getByRole("link", { name: "S1 proof 1.0.0" }).click();
  await expect(page).toHaveURL(new RegExp(`/releases/${fixture.releaseId}$`, "u"));
  const releaseDetail = page.locator(".lifecycle-detail");
  await expect(releaseDetail.locator("#release-detail-title")).toHaveText("S1 proof 1.0.0");
  await expect(releaseDetail.getByText(/^[0-9a-f]{64}$/u)).toBeHidden();
  await releaseDetail.getByText("Package provenance").click();
  await expect(releaseDetail.getByText(/^[0-9a-f]{64}$/u)).toBeVisible();
  await expect(releaseDetail.locator("dl div").filter({ hasText: "Approvals" }).locator("dd")).toHaveText("1");
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
  await page.goto("/?workspace=lifecycle");
  await expect(page.getByRole("heading", { level: 1, name: "Releases and Sessions" })).toBeVisible();
  const release = page.locator("#release-catalog .lifecycle-row").filter({ hasText: "S1 proof 1.0.0" });
  await release.getByRole("button", { name: "Create Session from this Release" }).click();
  await expect(release.getByLabel("Session name")).toBeFocused();
  await release.getByLabel("Session name").fill(sessionName);
  await release.getByRole("button", { name: "Create configured Session" }).click();
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/u);
  const detailUrl = page.url();
  const sessionId = new URL(detailUrl).pathname.split("/").at(-1);
  await expect(page.locator("#session-detail-title")).toHaveText(sessionName);
  await expect(page.getByText("Configured", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("0 of 11 readiness checks complete. 11 blocking checks remain.")).toBeVisible();
  const destinations = page.getByRole("navigation", { name: "Session destinations" });
  await expect(destinations.locator(".btn-primary")).toHaveCount(1);
  await expect(destinations.getByRole("link", { name: "Complete readiness", exact: true })).toHaveAttribute("href", `/admin/sessions/${sessionId}#staffing-title`);
  const runtimeDestination = destinations.getByRole("link", { name: "Session Runtime", exact: true });
  await expect(runtimeDestination).toHaveAttribute("aria-disabled", "true");
  await expect(runtimeDestination).not.toHaveAttribute("href", /.+/u);
  await expect(runtimeDestination).toHaveAccessibleDescription("Complete readiness, mark the Session ready, open it, and start it before Runtime is available.");
  const reportsDestination = destinations.getByRole("link", { name: "Reports", exact: true });
  await expect(reportsDestination).toHaveAttribute("aria-disabled", "true");
  await expect(reportsDestination).toHaveAccessibleDescription("Complete the Session before Reports is available.");
  const replayDestination = destinations.getByRole("link", { name: "Replay", exact: true });
  await expect(replayDestination).toHaveAttribute("aria-disabled", "true");
  await expect(replayDestination).toHaveAccessibleDescription("Complete the Session before Replay is available.");
  const archiveDestination = destinations.getByRole("link", { name: "Archive", exact: true });
  await expect(archiveDestination).toHaveAttribute("aria-disabled", "true");
  await expect(archiveDestination).toHaveAccessibleDescription("Complete and lock the Session before Archive is available.");
  await page.reload();
  await expect(page.locator("#session-detail-title")).toHaveText(sessionName);
  await page.goBack();
  const configuredSessionRow = page.locator("#session-catalog .lifecycle-row").filter({ hasText: sessionName });
  await expect(configuredSessionRow).toBeVisible();
  await expect(configuredSessionRow.locator(".catalog-primary-action")).toHaveCount(1);
  await expect(configuredSessionRow.getByRole("link", { name: "Complete readiness" })).toHaveAttribute("href", `/admin/sessions/${sessionId}#staffing-title`);
  await page.goto(`/admin/sessions/${sessionId}/reports`);
  await expect(page.getByRole("heading", { name: "Generate a Session report" })).toBeVisible();
  await page.getByRole("link", { name: "Session detail" }).click();
  await expect(page).toHaveURL(detailUrl);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${lifecycleEvidenceRoot}/operator-session-detail.png`, fullPage: true });
  await context.close();

  const reviewer = await actor(browser, fixture.tokens.finalReviewer);
  await reviewer.page.goto("/?workspace=lifecycle");
  await expect(reviewer.page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  await expect(reviewer.page.getByRole("link", { name: /^Releases and Sessions/ })).toHaveCount(0);
  await expect(reviewer.page.getByText(sessionName)).toHaveCount(0);
  const denied = await reviewer.context.request.get("/v1/releases");
  expect(denied.status()).toBe(403);
  expect(JSON.stringify(await denied.json())).not.toContain(fixture.releaseId);
  await reviewer.context.close();

  const admin = await actor(browser, fixture.tokens.operator);
  await admin.page.goto("/admin/members");
  await expect(admin.page.getByRole("heading", { name: "Workforce access" })).toBeVisible();
  await expect(admin.page.getByRole("link", { name: "Plugin operations", exact: true })).toHaveAttribute("href", "/admin/plugins");
  await expect(admin.page.getByRole("link", { name: "Deployment posture", exact: true })).toHaveAttribute("href", "/admin/deployment");
  await expect(admin.page.getByRole("link", { name: "Data policy", exact: true })).toHaveAttribute("href", "/admin/data-policy");
  await admin.context.close();
});

test("PS-830-T06/T07 published files and configured Injects use product controls @a11y", async ({ browser }) => {
  test.setTimeout(600_000);
  const suffix = crypto.randomUUID().slice(0, 8);
  let title = `PS-830 files ${suffix}`;
  const admin = await actor(browser, fixture.tokens.operator, { width: 1024, height: 768 });
  const designer = await actor(browser, fixture.tokens.publisher, { width: 1024, height: 768 });
  const page = designer.page;
  page.setDefaultTimeout(20_000);
  admin.page.setDefaultTimeout(20_000);
  let reviewer;
  if (!process.env.PLENUM_PS830_E_SESSION_PATH) {
  await admin.page.goto("/admin/data-policy");
  const policy = admin.page.getByRole("heading", { name: "Retention policy", exact: true }).locator("..");
  await policy.getByLabel("Policy key").fill(`ps830-files-${suffix}`);
  await policy.getByLabel("Expiry action").selectOption("delete");
  await policy.getByLabel("Retention period in days").fill("1");
  await policy.getByRole("button", { name: "Record policy version" }).click();
  await expect(admin.page.locator(".administration-notice")).toContainText("Retention policy recorded");

  await page.goto("/?workspace=projects");
  await page.locator(".template-row").filter({ hasText: "Fractured Order Core Design" }).getByRole("button", { name: "Start from Template" }).click();
  await page.getByLabel("Project name").fill(title);
  await page.getByLabel("Copy optional Scenario content").check();
  await page.getByRole("button", { name: "Create Project and open Draft" }).click();
  await expect(page).toHaveURL(/\/studio\/projects\/[0-9a-f-]{36}$/u);
  const studioUrl = page.url();
  await expect(page.getByRole("combobox", { name: "Design workspace", exact: true })).toBeVisible();
  const forms = await openStudioWorkspace(page, "Forms & Artifacts");
  const form = forms.locator("details.editor-item").first();
  await form.locator("summary").first().click();
  await form.getByRole("button", { name: "Use approved form rules" }).click();
  await form.getByLabel("Allow attachments", { exact: true }).check();
  await form.getByLabel("Attachment retention", { exact: true }).selectOption({ label: `ps830-files-${suffix} · version 1 · delete after 1 day` });
  await form.getByLabel("Exportable", { exact: true }).check();
  await expectDraftSynchronized(page, { timeout: 90_000 });
  expect((await new AxeBuilder({ page }).include("#forms").analyze()).violations).toEqual([]);
  const injectWorkspace = await openStudioWorkspace(page, "Injects");
  for (const [index, name] of ["PS-830 informational", "PS-830 acknowledge", "PS-830 response"].entries()) {
    if (index > 0) await injectWorkspace.getByRole("button", { name: "Add Inject", exact: true }).click();
    const inject = index === 0 ? injectWorkspace.locator("details.editor-item").first() : injectWorkspace.locator("details.editor-item").last();
    await inject.locator("summary").first().click();
    await inject.getByLabel("Inject title", { exact: true }).fill(name);
    await inject.getByLabel("Release mode", { exact: true }).selectOption("manual");
    await inject.getByLabel("Public recipients", { exact: true }).check();
    await inject.getByLabel("Acknowledgement requirement", { exact: true }).selectOption(index === 1 ? "true" : "false");
    if (index === 2) await inject.getByLabel("Required response Artifact Type", { exact: true }).selectOption({ label: "Blue Strategic Orientation" });
  }
  await expectDraftSynchronized(page, { timeout: 90_000 });
  expect((await new AxeBuilder({ page }).include("#injects").analyze()).violations).toEqual([]);
  // Focused files proof needs one participant; the unchanged reference's full staffing belongs to the golden journey.
  const seats = await openStudioWorkspace(page, "Seats");
  for (const seat of await seats.locator("details.editor-item").all()) {
    await seat.locator("summary").first().click();
    await seat.getByLabel("Required Seat", { exact: true }).uncheck();
  }
  await expectDraftSynchronized(page, { timeout: 90_000 });
  const publication = await openStudioWorkspace(page, "Review & publish");
  await publication.getByLabel("Release label").fill(title);
  await publication.getByLabel("Semantic version").fill("1.0.0");
  await publication.getByLabel("Release notes").fill("Focused attachment and interchange browser proof.");
  await publication.getByText("Governance references").click();
  await publication.getByLabel("Classification review reference").fill("synthetic-internal-review");
  await publication.getByLabel("Retention policy reference", { exact: true }).fill(`ps830-files-${suffix}`);
  await publication.getByLabel("Approval notes").fill("Synthetic automated review; named human acceptance remains separate.");
  await publication.getByLabel("I acknowledge the validation warnings.").check();
  await publication.getByRole("button", { name: "Freeze for review" }).click();
  await expect(page.getByText(/is frozen and ready for Reviewer approval/u)).toBeVisible();
  reviewer = await actor(browser, fixture.tokens.finalReviewer);
  await reviewer.page.goto(studioUrl);
  const review = await openStudioWorkspace(reviewer.page, "Review & publish");
  await review.getByLabel("Methodology review notes").fill("Synthetic independent review of the focused file workflow.");
  await review.getByRole("button", { name: "Approve freeze" }).click();
  await expect(reviewer.page.getByText(/Reviewer approval was recorded/u)).toBeVisible();
  await publication.getByRole("button", { name: "Freeze for review" }).click();
  await expect(page.getByText("1 current approval.")).toBeVisible();
  await publication.getByRole("button", { name: "Publish approved freeze" }).click();
  await expect(page.getByText(`Published ${title}.`)).toBeVisible();

  await admin.page.goto("/?workspace=lifecycle");
  const release = admin.page.locator("#release-catalog .lifecycle-row").filter({ hasText: title });
  await release.getByRole("button", { name: "Create Session from this Release" }).click();
  await release.getByLabel("Session name").fill(title);
  await release.getByRole("button", { name: "Create configured Session" }).click();
  await expect(admin.page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/u);
  await mkdir("test-results/golden-journey", { recursive: true });
  await writeFile("test-results/golden-journey/checkpoint-e-published-session.json", JSON.stringify({ title,
    sessionPath: new URL(admin.page.url()).pathname, studioPath: new URL(studioUrl).pathname,
    provenance: "Created, authored, reviewed, published and configured through product controls in PS-830-T06." }, null, 2));
  } else {
    if (!/^\/sessions\/[0-9a-f-]{36}$/u.test(process.env.PLENUM_PS830_E_SESSION_PATH)) throw new Error("Resume requires the recorded product Session path.");
    await admin.page.goto(process.env.PLENUM_PS830_E_SESSION_PATH);
    await expect(admin.page.locator("#session-detail-title")).toBeVisible();
    title = await admin.page.locator("#session-detail-title").innerText();
  }
  if (process.env.PLENUM_PS830_E_SESSION_PATH) await admin.page.goto(`/admin${process.env.PLENUM_PS830_E_SESSION_PATH}`);
  else await admin.page.getByRole("navigation", { name: "Session destinations" }).getByRole("link", { name: "Complete readiness", exact: true }).click();
  const control = admin.page.getByRole("region", { name: "Session control", exact: true });
  await expect(control).toBeVisible();
  if (await control.getByLabel("Next valid action").locator('option[value="session.pause"]').count() === 0) {
  await admin.page.getByText("Open direct assignment form", { exact: true }).click();
  const assignment = admin.page.getByRole("heading", { name: "Assign participant", exact: true }).locator("..");
  await assignment.getByLabel("Participant name", { exact: true }).selectOption({ label: "Synthetic Designer A" });
  await assignment.getByLabel("Seat", { exact: true }).selectOption({ label: "Blue Scribe" });
  await assignment.getByLabel("Session Role", { exact: true }).selectOption({ label: "Scribe" });
  await assignment.getByRole("button", { name: "Assign Seat" }).click();
  await expect(admin.page.getByRole("heading", { name: "Active assignments" }).locator(".." )).toContainText("Blue Scribe");
  const readiness = admin.page.getByRole("region", { name: "Operator readiness" });
  while (await readiness.getByRole("button", { name: "Confirm", exact: true }).count()) {
    const remaining = await readiness.getByRole("button", { name: "Confirm", exact: true }).count();
    await readiness.getByRole("button", { name: "Confirm", exact: true }).first().click();
    await expect(readiness.getByRole("button", { name: "Confirm", exact: true })).toHaveCount(remaining - 1);
  }
  await readiness.getByRole("button", { name: "Mark Session ready" }).click();
  await readiness.getByRole("button", { name: "Open Session", exact: true }).click();
  await control.getByLabel("Next valid action").selectOption("session.start");
  await control.getByLabel("Reason", { exact: true }).fill("Begin focused file proof.");
  await control.getByLabel("Confirm this authoritative lifecycle change.").check();
  await control.getByRole("button", { name: "Apply Session control" }).click();
  await expect(control.getByLabel("Next valid action").locator('option[value="session.pause"]')).toHaveCount(1);
  }

  const participant = await actor(browser, fixture.tokens.designerA, { width: 1024, height: 768 });
  participant.page.setDefaultTimeout(20_000);
  await participant.page.goto("/?workspace=participant");
  const session = participant.page.getByRole("article", { name: title, exact: true });
  if (!await session.isVisible()) await participant.page.getByRole("navigation", { name: "Your Sessions" }).getByRole("button").filter({ hasText: title }).click();
  await session.getByRole("link", { name: "Blue Scribe", exact: true }).click();
  if (process.env.PLENUM_PS830_F_RESUME_INJECTS !== "true") {
  await participant.page.getByRole("button", { name: "Strategic Orientation", exact: true }).click();
  const dialog = participant.page.getByRole("dialog", { name: "Strategic Orientation", exact: true });
  const entry = dialog.getByRole("region", { name: "Blue Strategic Orientation", exact: true });
  await entry.getByRole("radiogroup", { name: "Blue strategic orientation" }).getByRole("radio", { name: "Pressure", exact: true }).check();
  await entry.getByRole("radiogroup", { name: "Forecast Red orientation" }).getByRole("radio", { name: "Stabilization", exact: true }).check();
  await entry.getByLabel("What will Red do first?").fill("Synthetic initial narrative.");
  await entry.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(participant.page.getByText("The server accepted the Command.", { exact: true }).first()).toBeVisible();
  if (await dialog.isVisible()) await dialog.getByRole("button", { name: "Close Strategic Orientation", exact: true }).click();
  const record = participant.page.getByRole("article").filter({ has: participant.page.getByRole("heading", { name: "Blue Strategic Orientation", exact: true }) });
  await expect(record).toBeVisible();
  const editSummary = record.locator("details.artifact-edit > summary").first();
  const editLabel = await editSummary.innerText();
  await editSummary.click();
  await record.getByText("Import record values", { exact: true }).click();
  await record.getByLabel("Import records file").setInputFiles({ name: "narrative.csv", mimeType: "text/csv", buffer: Buffer.from('narrative\r\n"Imported, reviewed narrative"\r\n') });
  await record.getByLabel("narrative", { exact: true }).selectOption({ label: "What will Red do first?" });
  await record.getByRole("button", { name: "Preview mapped rows" }).click();
  await record.getByText("Row 2 · Ready to review", { exact: true }).click();
  await expect(record).toContainText("Imported, reviewed narrative");
  await record.getByRole("button", { name: "Load row 2 into editor" }).click();
  await record.getByRole("button", { name: editLabel, exact: true }).click();
  await expect(record.locator(".artifact-content")).toContainText("Imported, reviewed narrative");
  const files = participant.page.getByRole("region", { name: "Attachments for Blue Strategic Orientation" });
  await files.getByLabel("Choose attachment").setInputFiles({ name: "proof.txt", mimeType: "text/plain", buffer: Buffer.from("Synthetic attachment proof.") });
  await participant.context.setOffline(true);
  await expect(files.getByRole("button", { name: "Upload and scan" })).toBeDisabled();
  await participant.context.setOffline(false);
  await expect(files.getByRole("button", { name: "Upload and scan" })).toBeEnabled();
  // The server receives the real upload; only its first response is lost. Retry must recover that receipt.
  await participant.page.route(/\/runtime-artifacts\/[^/]+\/attachments\?/u, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fetch(); await route.abort("failed");
    await participant.page.unroute(/\/runtime-artifacts\/[^/]+\/attachments\?/u);
  });
  await files.getByRole("button", { name: "Upload and scan" }).click();
  await expect(files.getByRole("status")).toContainText("not confirmed accepted");
  await files.getByRole("button", { name: "Retry pending operation" }).click();
  await expect(files.getByRole("status")).toContainText("original server receipt was recovered");
  await expect(files.getByRole("button", { name: "Download proof.txt" })).toBeEnabled();
  const download = participant.page.waitForEvent("download");
  await files.getByRole("button", { name: "Download proof.txt" }).click();
  expect((await readFile(await (await download).path())).toString()).toBe("Synthetic attachment proof.");
  await files.getByLabel("Choose attachment").setInputFiles({ name: "scan-failed.txt", mimeType: "text/plain", buffer: Buffer.from("PS740-SCANNER-FAILURE") });
  await files.getByRole("button", { name: "Upload and scan" }).click();
  await expect(files.getByRole("button", { name: "Download scan-failed.txt" })).toBeDisabled();
  await expect(files.getByRole("button", { name: "Retry scan for scan-failed.txt" })).toBeEnabled();
  await record.getByText("Export record", { exact: true }).click();
  const exported = participant.page.waitForEvent("download");
  await record.getByRole("button", { name: "Export JSON", exact: true }).click();
  const exportedRecord = JSON.parse((await readFile(await (await exported).path())).toString());
  expect(exportedRecord.attachmentManifest.files.map((file) => file.fileName)).toContain("proof.txt");
  expect(exportedRecord.attachmentManifest.bytesIncluded).toBe(false);
  expect((await new AxeBuilder({ page: participant.page }).analyze()).violations).toEqual([]);
  for (const dismiss of await participant.page.getByRole("button", { name: /^Dismiss:/u }).all()) if (await dismiss.isVisible()) await dismiss.click();
  await files.getByRole("heading").scrollIntoViewIfNeeded();
  await participant.page.screenshot({ path: "output/playwright/golden-journey/published-record-files.png", fullPage: true });
  await participant.page.setViewportSize({ width: 512, height: 384 });
  await participant.page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await files.getByLabel("Choose attachment").focus();
  expect(await participant.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page: participant.page }).analyze()).violations).toEqual([]);
  await participant.page.screenshot({ path: "output/playwright/golden-journey/published-files-200-percent.png", fullPage: true });
  }
  await participant.page.setViewportSize({ width: 1024, height: 768 });
  await participant.page.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference" });
  await participant.page.getByRole("link", { name: "Notifications", exact: true }).click();
  for (const name of ["PS-830 informational", "PS-830 acknowledge", "PS-830 response"]) {
    const queued = admin.page.locator("#inject-queue-title").locator("..").locator("..").getByRole("listitem").filter({ hasText: name });
    await expect(queued).toBeVisible();
    if (await queued.getByRole("button", { name: "Release Inject", exact: true }).count()) {
      await queued.getByRole("button", { name: "Release Inject", exact: true }).click();
      await expect(admin.page.getByText("Authoritative Session state updated.", { exact: true })).toBeVisible();
    }
    await participant.page.getByRole("button", { name: "Refresh authoritative state", exact: true }).click();
    const inject = participant.page.getByRole("article", { name, exact: true });
    await expect(inject).toBeVisible();
    if (name === "PS-830 informational") {
      await expect(inject.getByRole("button", { name: "Acknowledge" })).toHaveCount(0);
      await expect(inject.getByText("Closed", { exact: true })).toBeVisible();
    } else if (name === "PS-830 acknowledge") {
      if (await inject.getByRole("button", { name: "Acknowledge", exact: true }).count()) {
        await inject.getByRole("button", { name: "Acknowledge", exact: true }).focus();
        await participant.page.keyboard.press("Enter");
      }
      await expect(inject.getByText("Closed", { exact: true })).toBeVisible();
    } else {
      await expect(inject.getByRole("button", { name: "Acknowledge" })).toHaveCount(0);
      if (await inject.getByLabel("Response record", { exact: true }).count()) {
        const responseChoice = await inject.getByLabel("Response record", { exact: true }).getByRole("option").filter({ hasText: "Blue Strategic Orientation" }).innerText();
        await inject.getByLabel("Response record", { exact: true }).selectOption({ label: responseChoice });
        await inject.getByRole("button", { name: "Submit response", exact: true }).click();
      }
      await expect(inject.getByText("Closed", { exact: true })).toBeVisible();
    }
    await expect(inject.getByText("Your required steps are complete.", { exact: true })).toBeVisible();
  }
  expect((await new AxeBuilder({ page: participant.page }).analyze()).violations).toEqual([]);
  await participant.page.screenshot({ path: "output/playwright/golden-journey/inject-completion.png", fullPage: true });
  await participant.page.setViewportSize({ width: 512, height: 384 });
  await participant.page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  expect(await horizontalOverflowState(participant.page)).toEqual({ overflow: 0, offenders: [] });
  expect((await new AxeBuilder({ page: participant.page }).analyze()).violations).toEqual([]);
  await participant.page.screenshot({ path: "output/playwright/golden-journey/inject-completion-200-percent.png", fullPage: true });
  await admin.page.goto("/admin/data-policy");
  await admin.page.getByRole("button", { name: "Apply attachment retention" }).click();
  await expect(admin.page.locator(".administration-notice")).toContainText("0 files deleted");
  await Promise.all([admin.context.close(), designer.context.close(), reviewer?.context.close(), participant.context.close()]);
});

test("PS-830-T03 concept controls protect foundations and retain inactive authoring @a11y", async ({ browser }) => {
  test.setTimeout(180_000);
  const designer = await actor(browser, fixture.tokens.designerA, { width: 1024, height: 768 });
  const { page, context } = designer;
  const baseURL = test.info().project.use.baseURL;
  const created = await context.request.post(new URL("/v1/projects", baseURL).href, { data: {
    requestId: crypto.randomUUID(), title: "PS-830 concept controls", templateId: fixture.templateId, includeScenario: true
  } });
  expect(created.status()).toBe(201);
  const { projectId } = await created.json();
  await page.goto(`/studio/projects/${projectId}`);
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Design workspace", exact: true })).toBeVisible();
  const teams = await openStudioWorkspace(page, "Teams");
  const teamNames = await teams.locator("details.editor-item > summary").allTextContents();
  expect(teamNames.length).toBeGreaterThan(0);
  const workspace = await openStudioWorkspace(page, "Methodology");
  for (const label of ["Identity and permissions", "Information Policy", "Versioned Releases", "Evidence and audit", "Session Authority", "Stage", "Session Role", "Seat"]) {
    await expect(workspace.getByRole("checkbox", { name: label, exact: true })).toBeDisabled();
    await expect(workspace.getByRole("checkbox", { name: label, exact: true })).toBeChecked();
  }
  await workspace.getByRole("checkbox", { name: "Team", exact: true }).uncheck();
  await expect(workspace.getByText("Disabled; authored content retained", { exact: true })).toBeVisible();
  await expectDraftSynchronized(page);
  await expect(page.locator("#validation .issue-list")).toContainText("requires Team");
  await openStudioWorkspace(page, "Teams");
  await expect(teams.locator("details.editor-item > summary")).toHaveText(teamNames);
  await openStudioWorkspace(page, "Methodology");
  await workspace.getByRole("checkbox", { name: "Team", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(workspace.getByRole("checkbox", { name: "Team", exact: true })).toBeChecked();
  await expectDraftSynchronized(page);
  await expect(page.locator("#validation .issue-list")).not.toContainText("requires Team");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await mkdir("output/playwright/golden-journey", { recursive: true });
  await page.screenshot({ path: "output/playwright/golden-journey/concepts-1024x768.png", fullPage: true });
  await page.setViewportSize({ width: 512, height: 384 });
  expect(await horizontalOverflowState(page)).toEqual({ overflow: 0, offenders: [] });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.screenshot({ path: "output/playwright/golden-journey/concepts-200-percent-forced-colors.png", fullPage: true });
  const denied = await browser.newContext({ extraHTTPHeaders: headers(fixture.tokens.portalOperator) });
  expect((await denied.request.post(new URL(`/v1/projects/${projectId}/publication-freezes`, baseURL).href)).status()).toBe(403);
  await denied.close();
  await context.close();
});

test("PS-830-T04/T05 bounded fields, calculations and safe text are authored visually and use the shared Runtime renderer @a11y", async ({ browser }) => {
  test.setTimeout(360_000);
  const { page, context } = await actor(browser, fixture.tokens.designerA, { width: 1024, height: 768 });
  const loadDiagnostics = [];
  page.on("pageerror", (error) => loadDiagnostics.push(error.message));
  page.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => {
    try { const frame = JSON.parse(String(payload)); loadDiagnostics.push({ type: frame.type, contractId: frame.contractId, updateBytes: frame.update?.length ?? 0 }); } catch { /* Non-JSON diagnostics contain no captured content. */ }
  }));
  const baseURL = test.info().project.use.baseURL;
  const created = await context.request.post(new URL("/v1/projects", baseURL).href, { data: {
    requestId: crypto.randomUUID(), title: "PS-830 form controls", templateId: fixture.templateId, includeScenario: true
  } });
  expect(created.status()).toBe(201);
  const { projectId } = await created.json();
  await page.goto(`/studio/projects/${projectId}`);
  try { await expect(page.getByRole("combobox", { name: "Design workspace", exact: true })).toBeVisible(); }
  catch (error) { await test.info().attach("draft-load-diagnostics", { body: JSON.stringify(loadDiagnostics), contentType: "application/json" }); throw error; }
  const workspace = await openStudioWorkspace(page, "Forms & Artifacts");
  const form = workspace.locator("details.editor-item").first();
  await form.locator("summary").first().click();
  await form.getByRole("button", { name: "Use approved form rules" }).click();
  await expect(form).toContainText("262144 UTF-8 JSON bytes");
  for (const [type, label] of [["yes_no", "Contingency available"], ["date", "Review date"], ["time", "Review time"],
    ["date_time", "Review instant"], ["currency", "Budget"], ["percentage", "Confidence"]]) {
    await form.getByRole("button", { name: "Add field", exact: true }).click();
    const labelInput = form.getByRole("textbox", { name: "Field label", exact: true }).last();
    const field = labelInput.locator("xpath=ancestor::fieldset[1]");
    await labelInput.fill(label);
    await field.getByRole("combobox", { name: "Field type", exact: true }).selectOption(type);
    await field.getByRole("checkbox", { name: "Required", exact: true }).check();
    if (["currency", "percentage"].includes(type)) {
      await field.getByRole("textbox", { name: "Unit (currency code or measurement)", exact: true }).fill(type === "currency" ? "EUR" : "%");
      await field.getByRole("spinbutton", { name: "Minimum value", exact: true }).fill("0");
      await field.getByRole("spinbutton", { name: "Maximum value", exact: true }).fill("100");
    }
  }
  await form.getByRole("button", { name: "Add field", exact: true }).click();
  const note = form.getByRole("textbox", { name: "Field label", exact: true }).last().locator("xpath=ancestor::fieldset[1]");
  await note.getByRole("textbox", { name: "Field label", exact: true }).fill("Budget note");
  await note.getByRole("button", { name: "Add conditional visibility", exact: true }).click();
  await note.getByRole("combobox", { name: "Source field", exact: true }).selectOption({ label: "Budget" });
  await note.getByRole("combobox", { name: "Comparison", exact: true }).selectOption("equals");
  await note.getByRole("spinbutton", { name: "Comparison value", exact: true }).fill("12.25");
  await form.getByRole("button", { name: "Add field", exact: true }).click();
  const calculated = form.getByRole("textbox", { name: "Field label", exact: true }).last().locator("xpath=ancestor::fieldset[1]");
  await calculated.getByRole("textbox", { name: "Field label", exact: true }).fill("Double budget");
  await calculated.getByRole("combobox", { name: "Field type", exact: true }).selectOption("number");
  await calculated.getByRole("checkbox", { name: "Compute this field", exact: true }).check();
  await calculated.getByRole("textbox", { name: "Formula version", exact: true }).fill("budget-1");
  const expression = calculated.getByRole("group", { name: "Calculation", exact: true });
  await expression.getByRole("combobox", { name: "Value or operation", exact: true }).selectOption("multiply");
  const left = expression.getByRole("group", { name: "Left value", exact: true });
  await left.getByRole("combobox", { name: "Value or operation", exact: true }).selectOption("field");
  await left.getByRole("combobox", { name: "Input field", exact: true }).selectOption({ label: "Budget" });
  await expression.getByRole("group", { name: "Right value", exact: true }).getByRole("spinbutton", { name: "Constant value", exact: true }).fill("2");
  await form.getByRole("button", { name: "Add field", exact: true }).click();
  const formatted = form.getByRole("textbox", { name: "Field label", exact: true }).last().locator("xpath=ancestor::fieldset[1]");
  await formatted.getByRole("textbox", { name: "Field label", exact: true }).fill("Contingency explanation");
  await formatted.getByRole("combobox", { name: "Field type", exact: true }).selectOption("formatted_text");
  await form.getByRole("button", { name: "Add Form section" }).click();
  const section = form.getByRole("textbox", { name: "Section title", exact: true }).last().locator("xpath=ancestor::fieldset[1]");
  await section.getByRole("textbox", { name: "Section title", exact: true }).fill("Contingency items");
  await section.getByRole("checkbox", { name: "Repeatable section" }).check();
  await section.getByRole("spinbutton", { name: "Maximum entries" }).fill("2");
  await section.getByRole("button", { name: "Add field", exact: true }).click();
  await section.getByRole("textbox", { name: "Field label", exact: true }).fill("Item description");
  await section.getByRole("textbox", { name: "Field key", exact: true }).fill("itemDescription");
  await expectDraftSynchronized(page, { timeout: 90_000 });
  await expect(page.locator("#validation")).toContainText("No blocking issues");
  await page.screenshot({ path: "output/playwright/golden-journey/expressions-authoring.png", fullPage: true });
  await form.getByText("Import or export Form definition", { exact: true }).click();
  const fileInput = form.getByLabel("Choose Form JSON file");
  await fileInput.setInputFiles({ name: "malformed.json", mimeType: "application/json", buffer: Buffer.from("{") });
  await expect(form.getByRole("status").filter({ hasText: "not valid JSON" })).toBeVisible();
  const exportedFile = page.waitForEvent("download");
  await form.getByRole("button", { name: "Export Form JSON", exact: true }).click();
  const downloaded = await exportedFile;
  const exportedBytes = await readFile(await downloaded.path());
  await fileInput.setInputFiles({ name: "form-definition.json", mimeType: "application/json", buffer: exportedBytes });
  const importReview = form.getByRole("region", { name: "Imported Form review" });
  await expect(importReview).toContainText("Double budget");
  await expect(importReview).toContainText("Contingency items (repeating)");
  expect((await new AxeBuilder({ page }).include("#forms").analyze()).violations).toEqual([]);
  await page.screenshot({ path: "output/playwright/golden-journey/interchange-form-review.png", fullPage: true });
  await importReview.getByRole("button", { name: "Apply reviewed Form" }).click();
  await expectDraftSynchronized(page, { timeout: 90_000 });
  await expect(page.locator("#validation")).toContainText("No blocking issues");

  // This uses the actual shared Runtime FieldEditor in the isolated preview. Live Command authority is covered by the DB integration test.
  await page.goto(`/projects/${projectId}/demo`);
  await page.getByRole("combobox", { name: "Role", exact: true }).selectOption({ label: "Scribe" });
  await page.getByRole("combobox", { name: "Team", exact: true }).selectOption({ label: "Blue" });
  await page.getByRole("combobox", { name: "Stage", exact: true }).selectOption({ label: "Orientation" });
  const entry = page.getByRole("region", { name: "Strategic Orientation", exact: true }).getByRole("region", { name: "Blue Strategic Orientation", exact: true });
  await entry.getByRole("radiogroup", { name: "Blue strategic orientation" }).getByRole("radio", { name: "Pressure", exact: true }).check();
  await entry.getByRole("radiogroup", { name: "Forecast Red orientation" }).getByRole("radio", { name: "Stabilization", exact: true }).check();
  await entry.getByLabel("What will Red do first?").fill("A synthetic contingency description.");
  await entry.getByRole("combobox", { name: /Contingency available/u }).selectOption("false");
  await entry.getByLabel(/Review date/u).fill("2026-11-08");
  await entry.getByLabel(/Review time/u).fill("12:30:00");
  await entry.getByLabel("Review instant (UTC)").fill("2026-11-08T12:30");
  await entry.getByLabel("Review instant (UTC)").fill("2026-11-08T12:30:00.1");
  await expect(entry.getByRole("textbox", { name: "Budget note", exact: true })).toHaveCount(0);
  await entry.getByRole("spinbutton", { name: /Budget/u }).fill("12.25");
  await entry.getByRole("textbox", { name: "Budget note", exact: true }).fill("Visible for this amount.");
  await entry.getByRole("spinbutton", { name: /Confidence/u }).fill("50.25");
  await entry.getByRole("button", { name: "Add item", exact: true }).click();
  await entry.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(entry.getByRole("button", { name: "Add item", exact: true })).toBeDisabled();
  await entry.getByRole("textbox", { name: "Item description", exact: true }).nth(0).fill("Primary response");
  await entry.getByRole("textbox", { name: "Item description", exact: true }).nth(1).fill("Fallback response");
  await expect(entry.getByRole("spinbutton", { name: "Double budget", exact: true })).toBeDisabled();
  await expect(entry.getByRole("spinbutton", { name: "Double budget", exact: true })).toHaveValue("24.5");
  const explanation = entry.getByRole("textbox", { name: "Contingency explanation", exact: true });
  await explanation.fill("<script>unsafe</script>");
  await entry.getByRole("button", { name: "Create demo artifact" }).click();
  await expect(entry.getByRole("alert").filter({ hasText: "does not allow HTML" })).toBeVisible();
  await explanation.fill("Contingency");
  await explanation.press("Control+A");
  await entry.getByRole("button", { name: "Bold", exact: true }).click();
  await expect(explanation).toHaveValue("**Contingency**");
  await expect(entry.getByRole("alert").filter({ hasText: "does not allow HTML" })).toHaveCount(0);
  await entry.getByText("Formatted preview", { exact: true }).click();
  await expect(entry.locator("strong").filter({ hasText: "Contingency" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: "output/playwright/golden-journey/expressions-runtime-renderer.png", fullPage: true });
  await page.setViewportSize({ width: 512, height: 384 });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await entry.getByRole("combobox", { name: /Contingency available/u }).focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowDown");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: "output/playwright/golden-journey/expressions-200-percent-forced-colors.png", fullPage: true });
  await entry.getByRole("button", { name: "Create demo artifact" }).click();
  await expect(page.locator(".qa-demo-artifact").filter({ has: page.getByRole("heading", { name: "Blue Strategic Orientation" }) })).toBeVisible();
  await context.close();
});

test("PS-730-T01/AC-01 foundational Studio authoring converges, previews Runtime projection, and links validation to the exact control @a11y", async ({ browser }) => {
  test.setTimeout(900_000);
  const first = await actor(browser, fixture.tokens.designerA);
  const second = await actor(browser, fixture.tokens.designerB);
  const studioUrl = `/studio/projects/${fixture.projectId}`;
  await first.page.goto(studioUrl);
  await expect(first.page.locator(".studio-app-header .product-header-title")).toBeVisible();
  await expect(first.page.getByText("Connected", { exact: true })).toBeVisible();
  expect(await first.page.locator(".studio-app-header .brand-wordmark img:not([aria-hidden='true'])").evaluate((image) => Math.round(image.getBoundingClientRect().width))).toBeLessThanOrEqual(92);
  await first.page.locator(".visual-editor").waitFor();
  await second.page.goto(studioUrl);
  await expect(second.page.locator(".studio-app-header .product-header-title")).toBeVisible();
  await expect(second.page.getByText("Connected", { exact: true })).toBeVisible();
  await expect(first.page.locator(".visual-editor")).toHaveAttribute("data-contract-id", "studio-foundation-editor-v1");

  const convergedName = "PS-730 converged Scenario";
  await first.page.getByLabel("Scenario name").fill(convergedName);
  await expect(second.page.getByLabel("Scenario name")).toHaveValue(convergedName, { timeout: 240_000 });

  await first.page.getByRole("button", { name: "Add learning objective" }).click();
  await expect(second.page.locator("#overview").getByText("New objective", { exact: true })).toBeVisible({ timeout: 240_000 });
  const firstActivities = await openStudioWorkspace(first.page, "Activities");
  await firstActivities.getByRole("button", { name: "Add Activity" }).click();
  const secondActivities = await openStudioWorkspace(second.page, "Activities");
  await expect(secondActivities.getByText("New Activity", { exact: true })).toBeVisible({ timeout: 240_000 });
  const firstStages = await openStudioWorkspace(first.page, "Stages");
  const firstStage = firstStages.locator(".timeline details").first();
  await firstStage.locator(":scope > summary").click();
  await firstStage.getByRole("checkbox", { name: "New Activity" }).check();
  await expectDraftSynchronized(first.page, { timeout: 240_000 });
  await expect.poll(async () => {
    const response = await first.context.request.get(`/v1/projects/${fixture.projectId}/draft`);
    const draft = await response.json();
    const activity = draft.materialization.coreDesign.activities?.find(({ name }) => name === "New Activity");
    return activity !== undefined && draft.materialization.coreDesign.stages[0].allowedActivityIds.includes(activity.id);
  }, { timeout: 240_000 }).toBe(true);

  const secondPreview = await openStudioWorkspace(second.page, "Role walkthrough");
  const previewResponse = second.page.waitForResponse((response) => response.url().endsWith(`/v1/projects/${fixture.projectId}/role-preview`) && response.request().method() === "POST");
  await secondPreview.getByRole("button", { name: "Preview interface" }).click();
  const preview = await (await previewResponse).json();
  expect(preview.contractId).toBe("role-preview-v1");
  await expect(second.page.locator(".role-preview")).toHaveAttribute("aria-label", new RegExp(`${preview.sessionRoleLabel} interface preview`, "u"));
  await expect(second.page.locator(".role-preview .preview-heading")).toContainText(preview.stageLabel);

  const groups = first.page.locator("#stages .editor-list.compact-list details");
  const firstGroup = groups.nth(0);
  const secondGroup = groups.nth(1);
  await firstGroup.locator(":scope > summary").click();
  await secondGroup.locator(":scope > summary").click();
  const firstGroupName = await firstGroup.getByLabel("Group name").inputValue();
  const secondGroupName = await secondGroup.getByLabel("Group name").inputValue();
  await firstGroup.getByLabel("Parent Stage Group").selectOption({ label: secondGroupName });
  await secondGroup.getByLabel("Parent Stage Group").selectOption({ label: firstGroupName });
  await expectDraftSynchronized(first.page, { timeout: 240_000 });
  const issueItem = first.page.locator(".issue-list li").filter({ hasText: /stageGroups\./u }).first();
  const issue = issueItem.getByRole("link", { name: "Open Stages" });
  await expect(issue).toBeVisible();
  await issue.click();
  await expect(firstGroup.getByLabel("Group name")).toBeFocused();
  await first.page.getByRole("button", { name: "Undo last change" }).click();
  await expectDraftSynchronized(first.page, { timeout: 240_000 });
  await expect(first.page.locator(".issue-list li").filter({ hasText: /stageGroups\./u })).toHaveCount(0);

  expect((await new AxeBuilder({ page: first.page }).analyze()).violations).toEqual([]);
  await first.page.screenshot({ path: `${studioEvidenceRoot}/foundational-studio.png`, fullPage: true });
  await first.context.close();
  await second.context.close();
});

test("PS-740-T01 Project authoring governs participant sign-in branding @a11y", async ({ browser }) => {
  test.setTimeout(180_000);
  const { context, page } = await actor(browser, fixture.tokens.designerA);
  await page.goto(`/studio/projects/${fixture.projectId}`);
  await expect(page.locator(".studio-app-header .product-header-title")).toBeVisible();

  const overviewWorkspace = await openStudioWorkspace(page, "Overview & Scenario");
  const brandingImage = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlUcAAAAASUVORK5CYII=", "base64");
  await overviewWorkspace.getByLabel("Developer logo file (PNG or JPEG, maximum 512 KiB)").setInputFiles({
    name: "ps-740-developer-logo.png", mimeType: "image/png", buffer: brandingImage
  });
  await overviewWorkspace.getByRole("button", { name: "Upload developer logo" }).click();
  await expect(overviewWorkspace.getByText("Developer logo added to this Draft.")).toBeVisible();
  await overviewWorkspace.getByLabel("Participant login image file (PNG or JPEG, maximum 512 KiB)").setInputFiles({
    name: "ps-740-simulation-image.png", mimeType: "image/png", buffer: brandingImage
  });
  await overviewWorkspace.getByLabel("Image description").fill("Synthetic participant login artwork");
  await overviewWorkspace.getByRole("button", { name: "Upload participant login image" }).click();
  await expect(overviewWorkspace.getByText("Participant login image added to this Draft.")).toBeVisible();
  await expectDraftSynchronized(page, { timeout: 240_000 });
  await expect.poll(async () => {
    const response = await context.request.get(`/v1/projects/${fixture.projectId}/draft`);
    const draft = await response.json();
    const resources = draft.materialization.coreDesign.resources ?? [];
    return draft.materialization.coreDesign.identity.developerLogoResourceId === "project-developer-logo" &&
      draft.materialization.coreDesign.presentation?.login?.imageResourceId === "project-participant-login-image" &&
      resources.some(({ id, dataUri, usage }) => id === "project-developer-logo" && dataUri.startsWith("data:image/png;base64,") && usage.includes("developer_branding")) &&
      resources.some(({ id, altText, usage }) => id === "project-participant-login-image" && altText === "Synthetic participant login artwork" && usage.includes("login"));
  }, { timeout: 240_000 }).toBe(true);
  expect((await new AxeBuilder({ page }).include("#overview").analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${authoringEvidenceRoot}/project-participant-branding.png`, fullPage: true });
  await context.close();
});

test("PS-740-T02 governed authoring exposes previews, DEC-42, communications, Injects, and quarantined content @a11y", async ({ browser }) => {
  test.setTimeout(360_000);
  const { context, page } = await actor(browser, fixture.tokens.designerA);
  await page.goto(`/studio/projects/${fixture.projectId}`);
  await expect(page.locator(".studio-app-header .product-header-title")).toBeVisible();

  const formsWorkspace = await openStudioWorkspace(page, "Forms & Artifacts");
  const firstForm = formsWorkspace.locator("details.editor-item").first();
  await firstForm.locator("summary").first().click();
  await expect(firstForm.getByText("Form preview", { exact: true })).toBeVisible();
  await firstForm.getByLabel("Viewport").selectOption("mobile");
  await firstForm.getByLabel("Mode").selectOption("completed");
  await expect(firstForm.locator(".form-preview-canvas")).toHaveAttribute("aria-label", /mobile completed preview/u);

  const workflowsWorkspace = await openStudioWorkspace(page, "Workflows");
  await workflowsWorkspace.getByRole("button", { name: "Add review Workflow" }).click();
  const dec42 = workflowsWorkspace.locator("details.editor-item").filter({ hasText: "Reference review" });
  await expect(dec42).toBeVisible();
  await dec42.locator(":scope > summary").click();
  await expect(dec42.getByText("Return for revision", { exact: true }).first()).toBeVisible();
  await expect(dec42.getByText("Resubmit for intermediate review", { exact: true }).first()).toBeVisible();

  const communicationsWorkspace = await openStudioWorkspace(page, "Communications");
  await expect(communicationsWorkspace.getByRole("table", { name: "Route matrix by Session Role" })).toBeVisible();
  const injectsWorkspace = await openStudioWorkspace(page, "Injects");
  await expect(injectsWorkspace.getByLabel("Inject timeline")).toBeVisible();

  const contentWorkspace = await openStudioWorkspace(page, "Content Library");
  await contentWorkspace.getByLabel("Content title").fill("PS-740 safe content");
  await contentWorkspace.getByLabel("File (maximum 512 KiB)").setInputFiles({
    name: "ps-740-safe.txt", mimeType: "text/plain", buffer: Buffer.from("Safe synthetic PS-740 content.")
  });
  await contentWorkspace.getByRole("button", { name: "Upload and scan" }).click();
  const safeCard = page.locator("#content-library .catalog-card").filter({ hasText: "PS-740 safe content" });
  await expect(safeCard.getByText("Clean", { exact: true })).toBeVisible();
  await safeCard.getByRole("button", { name: "Use current version in Scenario" }).click();

  await contentWorkspace.getByLabel("Content title").fill("PS-740 quarantined content");
  await contentWorkspace.getByLabel("File (maximum 512 KiB)").setInputFiles({
    name: "ps-740-eicar.txt", mimeType: "text/plain", buffer: Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")
  });
  await contentWorkspace.getByRole("button", { name: "Upload and scan" }).click();
  const infectedCard = page.locator("#content-library .catalog-card").filter({ hasText: "PS-740 quarantined content" });
  await expect(infectedCard.getByText("Infected", { exact: true })).toBeVisible();
  await expect(infectedCard.getByRole("button", { name: "Use current version in Scenario" })).toBeDisabled();

  await expectDraftSynchronized(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${authoringEvidenceRoot}/governed-authoring.png`, fullPage: true });
  await context.close();
});

test("PS-750-T02 advanced authoring is visual, explicit, fail-closed, and preview-only @a11y", async ({ browser }) => {
  test.setTimeout(600_000);
  const { context, page } = await actor(browser, fixture.tokens.designerA);
  await page.goto(`/studio/projects/${fixture.projectId}`);
  const advancedWorkspace = await openStudioWorkspace(page, "Advanced logic & world state");
  await expect(advancedWorkspace.getByRole("heading", { name: "Advanced logic & world state" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Design workspaces" }).locator('a[href="#adjudication"]')).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Design workspaces" }).locator('a[href="#plugins"]')).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Design workspaces" }).locator('a[href="#compositions"]')).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Design workspaces" }).locator('a[href="#polls"]')).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Design workspaces" }).locator('a[href="#voice"]')).toBeVisible();

  await advancedWorkspace.getByRole("button", { name: "Add State Value" }).click();
  const stateValue = advancedWorkspace.locator("details.editor-item").first();
  await stateValue.locator(":scope > summary").click();
  await expect(stateValue.getByLabel("Scenario initial value")).toBeVisible();
  await expect(stateValue.getByLabel("Unit")).toBeVisible();
  await expect(stateValue.getByLabel("History")).toBeVisible();
  await expect(stateValue.getByLabel("Display")).toBeVisible();
  await advancedWorkspace.getByRole("button", { name: "Add Resource", exact: true }).click();
  await expect(advancedWorkspace.getByLabel("Scenario initial balance").last()).toBeVisible();
  await advancedWorkspace.getByRole("button", { name: "Add Capability" }).click();
  const capability = advancedWorkspace.locator("details.editor-item").filter({ hasText: "New Capability" });
  await expect(capability.getByText("Activation Gate", { exact: true })).toBeVisible();
  await expect(capability.getByText("Degradation Effects", { exact: true })).toBeVisible();
  await expect(capability.getByText("Resource costs", { exact: true })).toBeVisible();

  const adjudicationWorkspace = await openStudioWorkspace(page, "Adjudication Models");
  await adjudicationWorkspace.getByRole("button", { name: "Add Adjudication Model" }).click();
  const adjudication = adjudicationWorkspace.locator("details.editor-item").last();
  await adjudication.getByLabel("Mechanism").selectOption("rules");
  await adjudication.getByRole("button", { name: "Add constrained rule" }).click();
  await expect(adjudication.getByLabel("Explanation shown in trace")).toBeVisible();
  await adjudication.getByRole("button", { name: "Run synthetic preview" }).click();
  await expect(adjudication.getByText("Preview complete. Authoritative state changes: 0.")).toBeVisible();
  for (const phase of ["Suggestion", "Review", "Approval", "Committed effect"]) {
    await expect(adjudication.getByText(phase, { exact: true })).toBeVisible();
  }

  const pluginsWorkspace = await openStudioWorkspace(page, "Plugin catalog & bindings");
  await expect(pluginsWorkspace.getByRole("status")).toContainText("Model Runs are unavailable");
  for (const viewport of [{ width: 1024, height: 768 }, { width: 512, height: 384 }]) {
    await page.setViewportSize(viewport);
    await pluginsWorkspace.getByRole("status").scrollIntoViewIfNeeded();
    await expect(pluginsWorkspace.getByRole("status")).toBeInViewport();
    expect((await horizontalOverflowState(page)).overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `output/ba-08/studio-${viewport.width}.png` });
  }
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.screenshot({ path: "output/ba-08/studio-forced-colors.png" });
  await page.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const catalogCard = pluginsWorkspace.locator("article.catalog-card").first();
  await catalogCard.getByRole("button", { name: "Bind installed Plugin" }).click();
  const binding = pluginsWorkspace.locator("details.editor-item").last();
  await binding.locator(":scope > summary").click();
  await expect(binding.getByRole("table", { name: /Deployment compatibility/u })).toBeVisible();
  await expect(binding.getByText("Policy-filtered input mappings", { exact: true })).toBeVisible();

  const compositionsWorkspace = await openStudioWorkspace(page, "Model Compositions");
  await compositionsWorkspace.getByRole("button", { name: "Add Model Composition" }).click();
  const composition = compositionsWorkspace.locator("details.editor-item").last();
  await expect(composition.getByText(/cannot mutate Session state/u)).toBeVisible();
  await expect(composition.getByRole("button", { name: "Add approval gate" })).toBeVisible();

  const pollsWorkspace = await openStudioWorkspace(page, "Polls");
  await pollsWorkspace.getByRole("button", { name: "Add Poll" }).click();
  const poll = pollsWorkspace.locator("details.editor-item").last();
  await poll.locator(":scope > summary").click();
  await expect(poll.locator('[role="status"]').filter({ hasText: "Publication readiness:" })).toContainText("Complete");
  await expect(poll.getByText(/Count accepted ballots/u)).toBeVisible();
  await poll.getByLabel("Ballot visibility").selectOption("secret_ballot");
  await expect(poll.getByText(/version 1 privacy policy/u).first()).toBeVisible();
  await poll.getByLabel("Ballot visibility").selectOption("open");

  const voiceWorkspace = await openStudioWorkspace(page, "Voice Channels");
  await voiceWorkspace.getByLabel("Target deployment profile").selectOption("air_gapped");
  const voice = voiceWorkspace.locator("details.editor-item").first();
  await voice.locator(":scope > summary").click();
  await expect(voice.getByText(/air gapped compatibility:/u)).toBeVisible();
  await expect(voice.getByText(/Non-audio path:/u)).toBeVisible();

  await expectDraftSynchronized(page, { timeout: 40_000 });
  expect((await new AxeBuilder({ page }).include("#advanced-logic").include("#adjudication").include("#plugins").include("#compositions").include("#polls").include("#voice").analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${advancedAuthoringEvidenceRoot}/advanced-authoring.png`, fullPage: true });
  await context.close();
});

test("PS-760-T02 remaining Studio workspaces rehearse deterministically without identifiers or Runtime mutation @a11y", async ({ browser }) => {
  test.setTimeout(360_000);
  const { context, page } = await actor(browser, fixture.tokens.designerA);
  await page.goto(`/studio/projects/${fixture.projectId}#interfaces`);
  await expect(page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("region", { name: "Interfaces" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Overview & Scenario" })).toBeHidden();
  await page.reload();
  await expect(page).toHaveURL(/#interfaces$/u);
  await expect(page.getByRole("region", { name: "Interfaces" })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect.poll(() => page.locator(".studio-layout").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { left: Math.round(bounds.left), right: Math.round(window.innerWidth - bounds.right) };
  })).toEqual({ left: 0, right: 0 });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `${studioAuthoringEvidenceRoot}/studio-workstation-1440x1000.png`, fullPage: false });
  for (const label of ["Interfaces","Research","Measurements & reports","Access & readiness","Role walkthrough","Test & validate","Review & publish","Live Changes"]) {
    const section = await openStudioWorkspace(page, label);
    await expect(section).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }

  const reviewWorkspace = await openStudioWorkspace(page, "Review & publish");
  await expect(reviewWorkspace.getByText("Governance references")).toBeVisible();
  await expect(reviewWorkspace.getByText("Artifact digest")).toBeHidden();
  const liveChangesWorkspace = await openStudioWorkspace(page, "Live Changes");
  await expect(liveChangesWorkspace).toBeVisible();

  const testWorkspace = await openStudioWorkspace(page, "Test & validate");
  await page.goBack();
  await expect(page.getByRole("region", { name: "Live Changes" })).toBeVisible();
  await page.goForward();
  await expect(testWorkspace).toBeVisible();
  await testWorkspace.getByRole("button", { name: "Run deterministic rehearsal" }).click();
  await expect(page.getByText(/Rehearsal completed with \d+ evaluated trigger/u)).toBeVisible();
  const digest = await page.locator("#test-validate .digest-line").textContent();
  await testWorkspace.getByRole("button", { name: "Run deterministic rehearsal" }).click();
  await expect(page.locator("#test-validate .digest-line")).toHaveText(digest ?? "");
  await expectDraftSynchronized(page);

  await expect(page.locator('#review-publish input[pattern="[0-9a-fA-F-]{36}"]')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include("#interfaces").include("#research").include("#measurements-reports").include("#access").include("#preview").include("#test-validate").include("#review-publish").include("#live-changes").analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${governanceEvidenceRoot}/rehearsal-publication.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#main-content").evaluate((element) => element.scrollIntoView());
  await page.screenshot({ path: `${studioAuthoringEvidenceRoot}/studio-workstation-390x844.png`, fullPage: false });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll("body *")].filter((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.right > document.documentElement.clientWidth + 1 || bounds.left < -1;
  }).slice(0, 12).map((element) => ({ element: `${element.tagName.toLowerCase()}.${element.className}`, right: Math.round(element.getBoundingClientRect().right) })))).toEqual([]);
  await page.screenshot({ path: `${studioAuthoringEvidenceRoot}/studio-workstation-320px-200pct.png`, fullPage: false });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await expect(page.getByRole("region", { name: "Test & validate" })).toBeVisible();
  await page.screenshot({ path: `${studioAuthoringEvidenceRoot}/studio-workstation-forced-colors.png`, fullPage: false });
  await context.close();
});

test("PS-770-T00 authenticated participant joins a branded simulation with a Session code @a11y", async ({ browser }) => {
  const { context, page } = await actor(browser, fixture.tokens.codeParticipant);
  await page.goto("/?workspace=participant");
  await expect(page.getByRole("heading", { level: 1, name: "Your Sessions" })).toBeVisible();
  await expect(page.getByText("Synthetic code participant")).toBeVisible();
  await page.getByLabel("Session code").fill("WRONG00");
  await page.getByRole("button", { name: "Find session" }).click();
  await expect(page.locator(".participant-entry-notice")).toContainText("invalid or unavailable");
  await page.getByLabel("Session code").fill(fixture.sessionCode);
  await page.getByRole("button", { name: "Find session" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Fractured Order" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Available team and role" })).toBeVisible();
  expect((await new AxeBuilder({ page }).include(".participant-portal").analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${participantEvidenceRoot}/participant-code-entry.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: `${participantEvidenceRoot}/participant-code-entry-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 320, height: 720 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await context.close();
});

test("PS-770-T03 Release-authored profiles govern roles, teams, regions, navigation, and presentation resources", async ({ request, browser }) => {
  const projectionFor = async (token, role) => {
    const deviceResponse = await request.post("/v1/devices", { headers: headers(token), data: {} });
    expect(deviceResponse.status()).toBe(201);
    const { deviceId } = await deviceResponse.json();
    const projectionResponse = await request.get(
      `/v1/sessions/${fixture.sessionId}/runtime-projection?activeSessionRoleId=${encodeURIComponent(role)}`,
      { headers: { ...headers(token), "x-device-id": deviceId } }
    );
    expect(projectionResponse.status()).toBe(200);
    return { deviceId, projection: await projectionResponse.json() };
  };

  const blueAuthor = await projectionFor(fixture.tokens.author, "scribe");
  const redAuthor = await projectionFor(fixture.tokens.redAuthor, "scribe");
  const facilitator = await projectionFor(fixture.tokens.reviewer, "facilitator");
  const control = await projectionFor(fixture.tokens.finalReviewer, "white_cell");

  expect(blueAuthor.projection.activeTeamId).toBe("blue");
  expect(redAuthor.projection.activeTeamId).toBe("red");
  expect(blueAuthor.projection.interfaceProfileId).toBe("participant-author");
  const release = JSON.parse(await readFile(new URL("../../../definitions/fractured-order/fractured-order-release.json", import.meta.url), "utf8"));
  for (const { projection } of [blueAuthor, redAuthor, facilitator, control]) {
    const profile = release.coreDesign.interfaces.find(({ id }) => id === projection.interfaceProfileId);
    expect(projection.navigation.contractId).toBe("runtime-navigation-v1");
    expect(projection.navigation.defaultItemId).toBe(profile.navigation.defaultItemId);
    expect(projection.navigation.items.map(({ id, label, regionId }) => ({ id, label, regionId }))).toEqual(
      [...profile.navigation.items].sort((left, right) => left.order - right.order)
        .map(({ id, label, target }) => ({ id, label, regionId: target.regionId }))
    );
    for (const item of projection.navigation.items) {
      expect(projection.regions.find(({ id }) => id === item.regionId).moduleIds).toContain(item.moduleId);
    }
    expect(projection.regions.map(({ id, moduleIds }) => ({ id, moduleIds }))).toEqual(
      profile.layout.regions.map(({ id, modules }) => ({ id, moduleIds: modules.map((module) => module.id) }))
    );
  }
  expect(facilitator.projection.interfaceProfileId).toBe("participant-review");
  expect(facilitator.projection.navigation.defaultItemId).toBe("review");
  expect(facilitator.projection.resources).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "fractured-order-session-deck", name: "Fractured Order Facilitator Deck", mediaType: "text/html" })
  ]));
  expect(blueAuthor.projection.resources).toEqual([]);
  expect(control.projection.interfaceProfileId).toBe("control");

  const deckId = facilitator.projection.modules.find(({ type }) => type === "slide_deck").configuration.releaseResourceId;
  const facilitatorDeck = await request.get(
    `/v1/sessions/${fixture.sessionId}/runtime-resources/${deckId}?deviceId=${facilitator.deviceId}&activeSessionRoleId=facilitator`,
    { headers: headers(fixture.tokens.reviewer) }
  );
  expect(facilitatorDeck.status()).toBe(200);
  expect(facilitatorDeck.headers()["content-type"]).toBe("text/html");
  expect(facilitatorDeck.headers()["content-security-policy"]).toContain("sandbox");
  const deniedDeck = await request.get(
    `/v1/sessions/${fixture.sessionId}/runtime-resources/${deckId}?deviceId=${blueAuthor.deviceId}&activeSessionRoleId=scribe`,
    { headers: headers(fixture.tokens.author) }
  );
  expect(deniedDeck.status()).toBe(403);

  const facilitatorBrowser = await actor(browser, fixture.tokens.reviewer);
  await facilitatorBrowser.page.goto(`/sessions/${fixture.sessionId}/runtime?role=facilitator`);
  await expect(facilitatorBrowser.page.getByRole("button", { name: /^Session: PS-150 S1 proof Session/u })).toBeVisible();
  await expect(facilitatorBrowser.page.locator("#runtime-navigation").getByRole("link").locator(".runtime-sidebar-label")).toHaveText(
    facilitator.projection.navigation.items.map(({ label }) => label));
  // The page band repeats Review/Deck as a Record views switch; both it and the sidebar must mark the same destination.
  const facilitatorSidebar = facilitatorBrowser.page.locator("#runtime-navigation");
  const recordViews = facilitatorBrowser.page.getByRole("navigation", { name: "Record views", exact: true });
  await expect(facilitatorSidebar.getByRole("link", { name: "Team Action Review" })).toHaveAttribute("aria-current", "page");
  await expect(recordViews.getByRole("link", { name: "Team Action Review" })).toHaveAttribute("aria-current", "page");
  await expect(facilitatorBrowser.page.getByTitle("Session slide deck")).toBeHidden();
  await facilitatorSidebar.getByRole("link", { name: "Deck", exact: true }).click();
  await expect(facilitatorSidebar.getByRole("link", { name: "Deck", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(recordViews.getByRole("link", { name: "Deck", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(facilitatorBrowser.page.getByTitle("Session slide deck")).toBeVisible();
  await expect(facilitatorBrowser.page.getByTitle("Session slide deck").contentFrame().getByText("Fractured Order", { exact: false }).first()).toBeVisible();
  await facilitatorBrowser.page.screenshot({ path: `${participantEvidenceRoot}/participant-facilitator-runtime.png`, fullPage: true });
  await facilitatorBrowser.context.close();
});

test("PS-770-T04 Designer uploads and assigns a governed resource to a role interface @a11y", async ({ browser }) => {
  const { context, page } = await actor(browser, fixture.tokens.designerA);
  await page.goto(`/studio/projects/${fixture.projectId}`);
  const interfaces = await openStudioWorkspace(page, "Interfaces");
  await interfaces.getByLabel("Resource name").fill("Participant field notes");
  await interfaces.getByLabel("Resource kind").selectOption("notes");
  await interfaces.getByLabel("Participant description").fill("Reference notes for the assigned participant role.");
  await interfaces.getByLabel("File (maximum 512 KiB)").setInputFiles({
    name: "participant-field-notes.md", mimeType: "", buffer: Buffer.from("# Field notes\n\nUse during the exercise.")
  });
  await interfaces.getByRole("button", { name: "Upload role resource" }).click();
  await expect(interfaces.getByText("Participant field notes is ready to assign to a role interface.")).toBeVisible();

  const authorProfile = interfaces.locator("details.editor-item").filter({ has: page.getByText("Scribe workspace", { exact: true }) });
  await authorProfile.locator(":scope > summary").click();
  const firstRegion = authorProfile.locator("fieldset.nested-editor").first();
  await firstRegion.getByRole("button", { name: "Add module" }).click();
  const resourceModule = firstRegion.locator(".field-row").last();
  await resourceModule.getByLabel("Module title").fill("Role resources");
  await resourceModule.getByLabel("Module", { exact: true }).selectOption("resource_library");
  await resourceModule.getByRole("group", { name: "Resources available in this role workspace" })
    .getByLabel("Participant field notes").check();
  await expectDraftSynchronized(page, { timeout: 240_000 });
  await expect.poll(async () => {
    const draft = await (await context.request.get(`/v1/projects/${fixture.projectId}/draft`)).json();
    const resource = draft.materialization.coreDesign.resources.find(({ name }) => name === "Participant field notes");
    const profile = draft.materialization.coreDesign.interfaces.find(({ id }) => id === "participant-author");
    const module = profile.layout.regions.flatMap(({ modules }) => modules).find(({ title }) => title === "Role resources");
    return resource?.mediaType === "text/markdown" && resource.usage.includes("role_resource") &&
      module?.moduleType === "resource_library" && module.configuration.resourceIds.includes(resource.id);
  }, { timeout: 240_000 }).toBe(true);
  expect((await new AxeBuilder({ page }).include("#interfaces").analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${authoringEvidenceRoot}/role-resource-assignment.png`, fullPage: true });
  await context.close();
});

test("PS-770-T01/T02 AC-08 AC-11 participant enters by policy, chooses labeled Seats, switches role, and recovers offline @a11y", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const { context, page } = await actor(browser, fixture.tokens.invitedParticipant);
  await page.goto("/?workspace=participant");
  await expect(page.getByRole("heading", { level: 1, name: "Your Sessions" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Project editor/u })).toHaveCount(0);
  await expect(page.getByText("Synthetic invited participant")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Fractured Order" })).toBeVisible();
  await expect(page.getByText("Statecraft Simulation Group")).toBeVisible();
  await expect(page.getByRole("img", { name: "Fractured Order — A Seminar Simulation" })).toBeVisible();
  await expect.poll(() => page.locator(".participant-simulation-image").evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect.poll(() => page.locator(".participant-developer-logo").evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect((await new AxeBuilder({ page }).include(".participant-portal").analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${participantEvidenceRoot}/participant-entry-branded.png`, fullPage: true });
  const participantBranding = await context.request.get((await page.getByRole("img", { name: "Fractured Order — A Seminar Simulation" }).getAttribute("src")) ?? "");
  expect(participantBranding.status()).toBe(200);
  expect(participantBranding.headers()["content-type"]).toBe("image/png");
  const deniedBranding = await request.get(participantBranding.url(), { headers: headers(fixture.tokens.portalOperator) });
  expect(deniedBranding.status()).toBe(403);
  const deniedAcceptance = await context.request.post(`/v1/participant-entry/invitations/${fixture.invitationId}/accept`, {
    headers: headers(fixture.tokens.author), data: {}
  });
  expect(deniedAcceptance.status()).toBe(403);
  expect(JSON.stringify(await deniedAcceptance.json())).not.toContain("PS-150 S1 proof Session");
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page.getByRole("group", { name: "Available team and role" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("group", { name: "Available team and role" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept invitation" })).toHaveCount(0);
  const choices = page.getByRole("group", { name: "Available team and role" }).getByRole("button");
  await choices.first().click();
  await expect(page.getByRole("heading", { name: "Enter your workspace" })).toBeVisible();
  const remainingChoices = page.getByRole("group", { name: "Available team and role" }).getByRole("button");
  if (await remainingChoices.count() > 0) await remainingChoices.first().click();
  const entryLinks = page.locator(".role-entry-list a");
  await expect(entryLinks.first()).toBeVisible();
  await entryLinks.first().click();
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}\/runtime\?role=[a-z_]+$/u);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("#runtime-navigation")).toBeVisible();
  await page.getByRole("button", { name: /^Role: /u }).click();
  await expect(page.getByRole("link", { name: "Exit Session" })).toBeVisible();
  const roleSwitch = page.getByRole("group", { name: "Switch role" });
  if (await roleSwitch.count() > 0) {
    await roleSwitch.locator("button:enabled").first().click();
    await expect(page).toHaveURL(/\?role=/u);
  } else {
    await page.keyboard.press("Escape");
  }
  const runtimeLocation = page.url();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${participantEvidenceRoot}/participant-runtime.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const runtimeNavigationToggle = page.getByRole("button", { name: "Open workspace navigation" });
  await expect(runtimeNavigationToggle).toBeVisible();
  await expect(page.locator("#runtime-navigation").getByRole("link", { name: /^Actions\b/u })).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: `${participantEvidenceRoot}/participant-runtime-mobile.png`, fullPage: true });
  await runtimeNavigationToggle.click();
  await expect(page.locator("#runtime-navigation").getByRole("link", { name: /^Actions\b/u })).toBeVisible();
  await page.screenshot({ path: `${participantEvidenceRoot}/participant-runtime-mobile-navigation-open.png`, fullPage: true });

  await page.goto("/__test__/offline");
  await page.goto(runtimeLocation);
  await expect(page.getByLabel("Plenum status: Offline")).toBeVisible();
  await expect(page.getByRole("list", { name: "Session messages", exact: true })).toContainText(/protected offline view/u);
  await expect(page.getByText(/accepted/u).filter({ hasText: /local pending/u })).toHaveCount(0);
  await page.goto("/__test__/online");
  await page.goto(runtimeLocation);
  await expect(page.getByLabel("Plenum status: Connected")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await context.close();
});

test("PS-780-T01/T02 AC-12/AC-13 Operator runs reasoned lifecycle and Stage controls without a Participant Seat @a11y", async ({ browser }) => {
  test.setTimeout(180_000);
  const { context, page } = await actor(browser, fixture.tokens.portalOperator);
  await page.goto(`/admin/sessions/${fixture.operatorSessionId}`);
  await expect(page.locator(".operator-workspace")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Session: PS-780 Operator Control Exercise/u })).toBeVisible();
  await expect(page.locator("#lifecycle-control-title")).toHaveText("Session control");
  await expect(page.getByRole("heading", { name: "Injects" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Adjudication status" })).toBeVisible();

  const applySession = async (operation, reason) => {
    const target = { "session.start": "active", "session.pause": "paused", "session.resume": "active",
      "session.complete": "completed", "session.lock": "locked" }[operation];
    await page.getByLabel("Next valid action").selectOption(operation);
    await page.getByLabel("Reason", { exact: true }).first().fill(reason);
    await page.getByLabel("Confirm this authoritative lifecycle change.").check();
    await page.getByRole("button", { name: "Apply Session control" }).click();
    await expect(page.locator(".runtime-page-header")).toContainText(new RegExp(`Session ${target}`, "iu"));
  };
  await applySession("session.start", "Start PS-780 operator exercise");
  await expect(page.locator(".runtime-page-header")).toContainText(/Session active/iu);

  await page.getByLabel("Stage action").selectOption("stage.start");
  await page.getByLabel("Reason", { exact: true }).nth(1).fill("Start first governed Stage");
  await page.getByLabel("Confirm the previewed Stage intervention.").check();
  await page.getByRole("button", { name: "Apply Stage control" }).click();
  await expect(page.getByText("Authoritative Session state updated.")).toBeVisible();
  await expect(page.getByText(/Status:\s*Active/u)).toBeVisible();

  await applySession("session.pause", "Pause for operator verification");
  await applySession("session.resume", "Resume after operator verification");
  await applySession("session.complete", "Complete operator exercise");
  await applySession("session.lock", "Lock immutable exercise evidence");
  await expect(page.locator(".runtime-page-header")).toContainText(/Session locked/iu);
  await expect(page.getByText("Session locked", { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${operatorEvidenceRoot}/operator-control-floor.png`, fullPage: true });
  await context.close();
});

test("BA-09-T03 Replay unavailable, checking, and retry states never promise reconstruction @a11y", async ({ browser }) => {
  const operator = await actor(browser, fixture.tokens.operator);
  const { page } = operator;
  const path = `/v1/sessions/${fixture.sessionId}/replay`;
  const checking = Promise.withResolvers();
  try {
    await page.route(`**${path}`, async route => { await checking.promise; await route.continue(); }, { times: 1 });
    await page.goto(`/admin/sessions/${fixture.sessionId}/replay`);
    await expect(page.getByText('Checking Replay availability.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run replay' })).toHaveCount(0);
    checking.resolve();
    const unavailable = page.getByText(/^Deterministic Replay is unavailable on this deployment/u);
    await expect(unavailable).toBeVisible();
    const response = await page.request.post(path, { data: {} });
    expect((await response.json()).error.code).toBe('CAPABILITY_UNAVAILABLE');
    await expect(page.getByText('Matched', { exact: true })).toHaveCount(0);
    for (const viewport of [{ width: 1024, height: 768 }, { width: 512, height: 384 }]) {
      await page.setViewportSize(viewport); await unavailable.scrollIntoViewIfNeeded();
      await expect(unavailable).toBeInViewport();
      expect((await horizontalOverflowState(page)).overflow).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `output/ba-09/replay-${viewport.width}.png` });
    }
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await page.getByRole('link', { name: 'View captured history in Reports' }).focus();
    await expect(page.getByRole('link', { name: 'View captured history in Reports' })).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: 'output/ba-09/replay-forced-colors.png' });
    await page.route(`**${path}`, route => route.fulfill({ status: 503, contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'CAPABILITY_UNAVAILABLE', message: 'Synthetic availability failure' } }) }), { times: 1 });
    await page.reload();
    await expect(page.getByText(/Replay availability could not be verified/u)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run replay' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Check Replay availability again' }).click();
    await expect(unavailable).toBeVisible();
  } finally { checking.resolve(); await operator.context.close(); }
});

test("BA-08-T03 Plugin execution unavailability and unverified states remain visible @a11y", async ({ browser }) => {
  const admin = await actor(browser, fixture.tokens.operator);
  const { page } = admin;
  try {
    await page.goto('/admin/plugins');
    const status = page.getByText(/^Model Runs are unavailable:/u);
    await expect(status).toBeVisible();
    for (const viewport of [{ width: 1024, height: 768 }, { width: 512, height: 384 }]) {
      await page.setViewportSize(viewport);
      await status.scrollIntoViewIfNeeded();
      await expect(status).toBeInViewport();
      expect((await horizontalOverflowState(page)).overflow).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `output/ba-08/plugins-${viewport.width}.png` });
    }
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await expect(status).toBeVisible();
    await page.screenshot({ path: 'output/ba-08/plugins-forced-colors.png' });
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    expect((await new AxeBuilder({ page }).include('.administration-main').analyze()).violations).toEqual([]);
    await page.route('**/v1/operations/plugins', async route => {
      const response = await route.fetch();
      const body = await response.json();
      delete body.modelRuns;
      await route.fulfill({ response, json: body });
    });
    await page.reload();
    await expect(page.getByText(/^Model Run availability could not be verified/u)).toBeVisible();
    await page.unroute('**/v1/operations/plugins');
    await page.route('**/v1/operations/plugins', route => route.fulfill({ status: 503, contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'CAPABILITY_UNAVAILABLE', message: 'Synthetic unavailable service' } }) }));
    await page.reload();
    await expect(page.getByText(/^Model Run availability could not be verified/u)).toBeVisible();
  } finally { await admin.context.close(); }
});

test("PS-790-T01 Admin and Publisher complete role, trust, Plugin, policy, and archive operations @a11y", async ({ browser }) => {
  test.setTimeout(360_000);
  const publisher = await actor(browser, fixture.tokens.publisher);
  await publisher.page.goto("/admin/plugins");
  await expect(publisher.page.getByRole("heading", { name: "Plugin operations" })).toBeVisible();
  await expect(publisher.page.getByText(/^Model Runs are unavailable:/u)).toBeVisible();
  await publisher.page.getByLabel("Signed Plugin bundle").setInputFiles("output/user-test/ps-790/ps-790-synthetic-plugin.json");
  await publisher.page.getByRole("button", { name: "Verify and submit" }).click();
  await expect(publisher.page.locator(".administration-notice")).toContainText("Plugin bundle submitted");
  await publisher.context.close();

  const admin = await actor(browser, fixture.tokens.operator);
  const { page } = admin;
  await page.goto("/admin/members");
  await expect(page.getByRole("heading", { name: "Workforce access" })).toBeVisible();
  const reviewer = page.locator("li.administration-record").filter({ hasText: "Synthetic final reviewer" });
  const lifecycleRequests = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/v1\/operations\/workforce\/members\/[^/]+\/suspend$/u.test(request.url())) lifecycleRequests.push(request.url());
  });
  await reviewer.getByText("Manage access for Synthetic final reviewer", { exact: true }).click();
  const lifecycleReason = reviewer.getByLabel("Lifecycle reason");
  await reviewer.getByRole("button", { name: "Suspend" }).click();
  await expect(lifecycleReason).toBeFocused();
  await expect(lifecycleReason).toHaveAttribute("aria-invalid", "true");
  await expect(lifecycleReason).toHaveAccessibleDescription(/Required for suspension or deprovisioning.*Enter a lifecycle reason between 3 and 1,000 characters/iu);
  expect(lifecycleRequests).toHaveLength(0);
  await lifecycleReason.fill("Role verification completed without lifecycle change");
  await expect(lifecycleReason).toHaveAttribute("aria-invalid", "false");
  await reviewer.getByLabel("Operator", { exact: true }).check();
  await reviewer.getByRole("button", { name: "Save roles" }).click();
  await expect(page.locator(".administration-notice")).toContainText("Organization Roles updated");
  const updatedReviewer = page.locator("li.administration-record").filter({ hasText: "Synthetic final reviewer" });
  await updatedReviewer.getByLabel("Operator", { exact: true }).uncheck();
  await updatedReviewer.getByRole("button", { name: "Save roles" }).click();
  await expect(page.locator(".administration-notice")).toContainText("Organization Roles updated");

  await page.goto("/admin/plugins");
  await expect(page.getByText("1 Publisher")).toBeVisible();
  await expect(page.getByText("1 trust root")).toBeVisible();
  await expect(page.getByText("1 revocation list")).toBeVisible();
  await expect(page.getByText("1 license acceptance")).toBeVisible();
  const plugin = page.locator("li.administration-record").filter({ hasText: "Org ssg fixtures pending" });
  await plugin.getByRole("button", { name: "Approve Artifact" }).click();
  await expect(page.locator(".administration-notice")).toContainText("Plugin Artifact approved");
  const approvedPlugin = page.locator("li.administration-record").filter({ hasText: "Org ssg fixtures pending" });
  await approvedPlugin.getByText("Install approved Artifact").click();
  await approvedPlugin.getByRole("button", { name: "Verify and install" }).click();
  await expect(page.locator(".administration-notice")).toContainText("Plugin installed");
  const installedPlugin = page.locator("li.administration-record").filter({ hasText: "Org ssg fixtures pending" });
  await expect(installedPlugin.getByText(/^1 installation · /u)).toBeVisible();
  await installedPlugin.getByRole("button", { name: "Revoke Artifact" }).click();
  await expect(page.locator(".administration-notice")).toContainText("historical provenance is preserved");

  await page.goto("/admin/data-policy");
  const policy = page.getByRole("heading", { name: "Retention policy" }).locator("..");
  await policy.getByLabel("Policy key").fill("ps-790-e2e-retention");
  await policy.getByRole("button", { name: "Record policy version" }).click();
  await expect(page.locator(".administration-notice")).toContainText("Retention policy recorded");
  const hold = page.getByRole("heading", { name: "Legal hold" }).locator("..");
  await hold.getByLabel("Reason").fill("Preserve PS-790 synthetic acceptance evidence");
  await hold.getByRole("button", { name: "Place legal hold" }).click();
  await expect(page.locator(".administration-notice")).toContainText("matching purge is blocked");
  const downloadPromise = page.waitForEvent("download", { timeout: 120_000 });
  await page.getByRole("link", { name: "Export portable archive" }).click();
  const archiveDownload = await downloadPromise;
  expect(archiveDownload.suggestedFilename()).toBe("plenum-organization-archive.json.gz");
  const archive = JSON.parse(gunzipSync(await readFile(await archiveDownload.path())).toString("utf8"));
  expect(archive.archiveVersion).toBe(2);
  expect(archive.databaseSchema).toBe("plenum-042");
  expect(Array.isArray(archive.data.injectInstances)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${operationsEvidenceRoot}/administration-data-policy.png`, fullPage: true });
  await admin.context.close();
});

test("PS-790-T02 reports, replay, retention consequences, research privacy, and denials remain explicit @a11y", async ({ browser }) => {
  test.setTimeout(180_000);
  const operator = await actor(browser, fixture.tokens.portalOperator);
  await operator.page.goto(`/admin/sessions/${fixture.sessionId}/reports`);
  await operator.page.getByRole("button", { name: "Generate and download" }).click();
  await expect(operator.page.getByRole("heading", { name: "Report source trace" })).toBeVisible();
  await expect(operator.page.getByText("Captured History", { exact: true })).toBeVisible();
  await expect(operator.page.getByText("Reconstructed Narrative", { exact: true })).toBeVisible();
  await expect(operator.page.getByRole("heading", { name: "Generated artifacts" }).locator("..")).toContainText("After action");

  await operator.page.goto(`/admin/sessions/${fixture.sessionId}/replay`);
  await expect(operator.page.getByText(/^Deterministic Replay is unavailable on this deployment/u)).toBeVisible();
  await expect(operator.page.getByRole("button", { name: "Run replay" })).toHaveCount(0);
  await expect(operator.page.getByText("Matched", { exact: true })).toHaveCount(0);
  await expect(operator.page.getByRole("link", { name: "View captured history in Reports" })).toBeVisible();

  await operator.page.goto(`/admin/sessions/${fixture.sessionId}/archive`);
  await expect(operator.page.getByText("Active legal hold:")).toBeVisible();
  await expect(operator.page.getByText("ps-790-synthetic-retention v1")).toBeVisible();
  await operator.context.close();

  const analyst = await actor(browser, fixture.tokens.designerB);
  await analyst.page.goto("/research/reports");
  const researchSession = analyst.page.getByLabel("Authorized Session").locator("option").filter({ hasText: "PS-150 S1 proof Session" });
  await analyst.page.getByLabel("Authorized Session").selectOption(await researchSession.getAttribute("value"));
  await analyst.page.getByLabel("Approved research purpose").fill("PS-790 research test");
  await analyst.page.getByRole("button", { name: "Generate consent-filtered export" }).click();
  await expect(analyst.page.getByRole("heading", { name: "Provenance inspection" })).toBeVisible();
  const researchTrace = analyst.page.locator(".report-trace");
  await expect(researchTrace.getByText("Consented observations")).toBeVisible();
  await expect(researchTrace).not.toContainText("Synthetic Blue author");
  await expect(analyst.page.getByRole("heading", { name: "Your generated exports" }).locator("..")).toContainText("Research dataset");
  expect((await new AxeBuilder({ page: analyst.page }).analyze()).violations).toEqual([]);
  await analyst.page.screenshot({ path: `${operationsEvidenceRoot}/research-provenance.png`, fullPage: true });
  await analyst.context.close();

  const reviewer = await actor(browser, fixture.tokens.finalReviewer);
  await reviewer.page.goto("/admin/members");
  await expect(reviewer.page.getByRole("heading", { name: "Administration access unavailable" })).toBeVisible();
  await expect(reviewer.page.getByText("Synthetic operator")).toHaveCount(0);
  await reviewer.context.close();
});
