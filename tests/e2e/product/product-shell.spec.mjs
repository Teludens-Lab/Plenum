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
const operatorEvidenceRoot = "output/playwright/ps-780";
const operationsEvidenceRoot = "output/playwright/ps-790";
const platformLifecycleEvidenceRoot = "output/playwright/ps-800/after/platform-lifecycle";
const studioAuthoringEvidenceRoot = "output/playwright/ps-800/after/studio-authoring";
const headers = (token) => ({ Authorization: `Bearer ${token}` });

async function actor(browser, token, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, extraHTTPHeaders: headers(token) });
  return { context, page: await context.newPage() };
}

async function openStudioWorkspace(page, name, regionName = name) {
  const picker = page.getByLabel("Design workspace", { exact: true });
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
  await mkdir(platformLifecycleEvidenceRoot, { recursive: true });
  await mkdir(studioAuthoringEvidenceRoot, { recursive: true });
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
  { label: /^Admin\b/u, displayName: "Synthetic operator", heading: "Create a Project" },
  { label: /^Reviewer\b/u, displayName: "Synthetic final reviewer", heading: "Review access", project: "PS-150 S1 proof" },
  { label: /^Operator only\b/u, displayName: "Synthetic portal operator", heading: "Simulation Releases" }
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
      await page.getByRole("button", { name: "Create Project and open Draft" }).click();
      await expect(page).toHaveURL(/\/studio\/projects\/[0-9a-f-]{36}$/u);
      await expect(page.locator(".studio-context h1")).toBeVisible();
      await expect(page.getByText("Connected", { exact: true })).toBeVisible();
    }
    await context.close();
  });
}

test("PS-700-T01 authenticated root is useful, branded, responsive, and accessible @a11y", async ({ browser }) => {
  const { context, page } = await actor(browser, fixture.tokens.operator);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Plenum" })).toBeVisible();
  await expect(page.getByRole("complementary").getByText("PS-150 synthetic organization")).toBeVisible();
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
    return { wordmarkWidth: Math.round(wordmarkBounds.width), leftInset: Math.round(wordmarkBounds.left - headerBounds.left),
      rightInset: Math.round(headerBounds.right - actionBounds.right), shellNotices: document.querySelectorAll(".shell-notice").length };
  });
  expect(headerGeometry.wordmarkWidth).toBeLessThanOrEqual(128);
  expect(headerGeometry.leftInset).toBe(20);
  expect(headerGeometry.rightInset).toBe(20);
  expect(headerGeometry.shellNotices).toBe(0);
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
  await expect(page.getByText("PS-150 synthetic organization").first()).toBeVisible();
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
        workspace: size(".workspace-context-header h1"), portal: size(".portal-toolbar h2"),
        section: size(".section-heading h3"), object: size(".catalog-row h4"),
        detail: size(".catalog-row dd"), label: size(".catalog-row dt")
      },
      expected: {
        workspace: resolveSize("--text-2xl"), portal: resolveSize("--text-xl"),
        section: resolveSize("--text-lg"), object: resolveSize("--text-md"),
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
  await desktop.page.getByRole("button", { name: "Show all Releases" }).click();
  await expect(desktop.page.locator("#release-catalog .catalog-row").first()).toBeVisible();
  const releaseRows = desktop.page.locator("#release-catalog .catalog-row");
  await expect(releaseRows.locator(".catalog-primary-action")).toHaveCount(await releaseRows.count());
  await expect(releaseRows.first().locator(".catalog-facts dt")).toHaveText(["Project", "Published", "Approvals", "Sessions"]);
  await desktop.page.getByLabel("Search Sessions").fill("PS-800 no matching Session");
  await desktop.page.getByRole("button", { name: "Search Sessions" }).click();
  await expect(desktop.page.getByRole("heading", { name: "No matching Sessions" })).toBeVisible();
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
  await desktop.page.unroute("**/v1/sessions?**");
  await desktop.page.getByRole("button", { name: "Retry loading Sessions" }).click();
  await expect(desktop.page.locator("#session-catalog .catalog-row").first()).toBeVisible();
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
  await expect(constrained.page.getByRole("button", { name: "Open access context" })).toBeVisible();
  await expect(constrained.page.locator("#account-context-sheet")).toBeHidden();
  await expect.poll(() => constrained.page.evaluate(() => document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1)).toBe(true);
  await expect.poll(() => constrained.page.locator(".product-workspaces").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await constrained.page.getByRole("button", { name: "Open access context" }).click();
  const constrainedAccount = constrained.page.getByRole("dialog", { name: "Access" });
  await expect(constrainedAccount).toBeVisible();
  await expect(constrainedAccount).toHaveAttribute("aria-modal", "true");
  await expect(constrainedAccount).toBeFocused();
  await constrained.page.keyboard.press("Tab");
  expect(await constrainedAccount.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  await constrained.page.keyboard.press("Escape");
  await expect(constrainedAccount).toBeHidden();
  await expect(constrained.page.getByRole("button", { name: "Open access context" })).toBeFocused();
  await constrained.page.screenshot({ path: `${platformLifecycleEvidenceRoot}/platform-lifecycle-1280x600.png` });
  await constrained.context.close();

  const tablet = await actor(browser, fixture.tokens.operator, { width: 1024, height: 768 });
  await tablet.page.goto("/?workspace=lifecycle");
  await expect(tablet.page.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
  await expect(tablet.page.getByRole("button", { name: "Open access context" })).toBeVisible();
  await expect(tablet.page.locator("#account-context-sheet")).toBeHidden();
  await expect.poll(() => tablet.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await tablet.page.getByRole("button", { name: "Open access context" }).click();
  const tabletAccount = tablet.page.getByRole("dialog", { name: "Access" });
  await expect(tabletAccount).toBeFocused();
  await tablet.page.screenshot({ path: `${platformLifecycleEvidenceRoot}/platform-lifecycle-1024x768-access-sheet.png` });
  await tabletAccount.getByRole("button", { name: "Close access context" }).click();
  await expect(tablet.page.getByRole("button", { name: "Open access context" })).toBeFocused();
  await tablet.context.close();

  const portrait = await actor(browser, fixture.tokens.operator, { width: 768, height: 1024 });
  await portrait.page.goto("/?workspace=lifecycle");
  await expect(portrait.page.getByRole("navigation", { name: "Workspaces" })).toBeHidden();
  await portrait.page.getByRole("button", { name: "Open workspaces" }).click();
  await expect(portrait.page.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
  await portrait.page.getByRole("button", { name: "Open access context" }).click();
  await expect(portrait.page.getByRole("navigation", { name: "Workspaces" })).toBeHidden();
  await expect(portrait.page.locator("#account-context-sheet")).toBeFocused();
  expect(await portrait.page.evaluate(() => {
    const account = document.querySelector("#account-context-sheet")?.getBoundingClientRect();
    return account !== undefined && account.top >= 0 && account.right <= innerWidth && account.bottom <= innerHeight;
  })).toBe(true);
  await expect.poll(() => portrait.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await portrait.page.screenshot({ path: `${platformLifecycleEvidenceRoot}/platform-lifecycle-768x1024-access-context.png`, fullPage: true });
  await portrait.context.close();

  const zoomed = await actor(browser, fixture.tokens.operator, { width: 320, height: 720 });
  await zoomed.page.goto("/?workspace=lifecycle");
  await zoomed.page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expect.poll(() => zoomed.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await zoomed.page.evaluate(() => {
    const workspaces = document.querySelector(".workspace-navigation-toggle")?.getBoundingClientRect();
    const account = document.querySelector(".account-context-toggle")?.getBoundingClientRect();
    return workspaces !== undefined && account !== undefined && account.top >= workspaces.bottom;
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

test("PS-710-T01 Designer creates, archives, reopens, and resumes a blank Project using visible controls @a11y", async ({ browser }) => {
  const { context, page } = await actor(browser, fixture.tokens.designerA);
  const projectName = "PS-710 visible blank Project";
  await page.goto("/?workspace=projects");
  await expect(page.getByRole("heading", { name: "Active Projects" })).toBeVisible();
  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Create Project and open Draft" }).click();
  await expect(page).toHaveURL(/\/studio\/projects\/[0-9a-f-]{36}$/u);
  await expect(page.locator(".studio-context h1")).toBeVisible();

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
  await expect(admin.page.getByRole("heading", { name: "Members and Organization Roles" })).toBeVisible();
  await expect(admin.page.getByRole("link", { name: "Plugin operations", exact: true })).toHaveAttribute("href", "/admin/plugins");
  await expect(admin.page.getByRole("link", { name: "Deployment posture", exact: true })).toHaveAttribute("href", "/admin/deployment");
  await expect(admin.page.getByRole("link", { name: "Data policy", exact: true })).toHaveAttribute("href", "/admin/data-policy");
  await admin.context.close();
});

test("PS-730-T01/AC-01 foundational Studio authoring converges, previews Runtime projection, and links validation to the exact control @a11y", async ({ browser }) => {
  test.setTimeout(900_000);
  const first = await actor(browser, fixture.tokens.designerA);
  const second = await actor(browser, fixture.tokens.designerB);
  const studioUrl = `/studio/projects/${fixture.projectId}`;
  await first.page.goto(studioUrl);
  await expect(first.page.locator(".studio-context h1")).toBeVisible();
  await expect(first.page.getByText("Connected", { exact: true })).toBeVisible();
  await first.page.locator(".visual-editor").waitFor();
  await second.page.goto(studioUrl);
  await expect(second.page.locator(".studio-context h1")).toBeVisible();
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
  await firstStage.locator("summary").click();
  await firstStage.getByRole("checkbox", { name: "New Activity" }).check();
  await expect(first.page.getByText("All changes received by the server")).toBeVisible({ timeout: 240_000 });
  await expect.poll(async () => {
    const response = await first.context.request.get(`/v1/projects/${fixture.projectId}/draft`);
    const draft = await response.json();
    const activity = draft.materialization.coreDesign.activities?.find(({ name }) => name === "New Activity");
    return activity !== undefined && draft.materialization.coreDesign.stages[0].allowedActivityIds.includes(activity.id);
  }, { timeout: 240_000 }).toBe(true);

  const secondPreview = await openStudioWorkspace(second.page, "Role walkthrough", "Role & Stage preview");
  const previewResponse = second.page.waitForResponse((response) => response.url().endsWith(`/v1/projects/${fixture.projectId}/role-preview`) && response.request().method() === "POST");
  await secondPreview.getByRole("button", { name: "Preview interface" }).click();
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
  await expect(first.page.getByText("All changes received by the server")).toBeVisible({ timeout: 240_000 });
  const issueItem = first.page.locator(".issue-list li").filter({ hasText: /stageGroups\./u }).first();
  const issue = issueItem.getByRole("link", { name: "Open Stages" });
  await expect(issue).toBeVisible();
  await issue.click();
  await expect(firstGroup.getByLabel("Group name")).toBeFocused();
  await first.page.getByRole("button", { name: "Undo last change" }).click();
  await expect(first.page.getByText("All changes received by the server")).toBeVisible({ timeout: 240_000 });
  await expect(first.page.locator(".issue-list li").filter({ hasText: /stageGroups\./u })).toHaveCount(0);

  expect((await new AxeBuilder({ page: first.page }).analyze()).violations).toEqual([]);
  await first.page.screenshot({ path: `${studioEvidenceRoot}/foundational-studio.png`, fullPage: true });
  await first.context.close();
  await second.context.close();
});

test("PS-740-T02 governed authoring exposes previews, DEC-42, communications, Injects, and quarantined content @a11y", async ({ browser }) => {
  test.setTimeout(360_000);
  const { context, page } = await actor(browser, fixture.tokens.designerA);
  await page.goto(`/studio/projects/${fixture.projectId}`);
  await expect(page.locator(".studio-context h1")).toBeVisible();

  const formsWorkspace = await openStudioWorkspace(page, "Forms & Artifacts", "Forms & Artifact Types");
  const firstForm = formsWorkspace.locator("details.editor-item").first();
  await firstForm.locator("summary").click();
  await expect(firstForm.getByText("Form preview", { exact: true })).toBeVisible();
  await firstForm.getByLabel("Viewport").selectOption("mobile");
  await firstForm.getByLabel("Mode").selectOption("completed");
  await expect(firstForm.locator(".form-preview-canvas")).toHaveAttribute("aria-label", /mobile completed preview/u);

  const workflowsWorkspace = await openStudioWorkspace(page, "Workflows");
  await workflowsWorkspace.getByRole("button", { name: "Add DEC-42 reference Workflow" }).click();
  const dec42 = workflowsWorkspace.locator("details.editor-item").filter({ hasText: "DEC-42 reference review" });
  await expect(dec42).toBeVisible();
  await dec42.locator("summary").click();
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
  await expect(page.getByText("Malware scan passed. This version is available for reuse.")).toBeVisible();
  const safeCard = page.locator("#content-library .catalog-card").filter({ hasText: "PS-740 safe content" });
  await expect(safeCard.getByText("clean", { exact: true })).toBeVisible();
  await safeCard.getByRole("button", { name: "Use current version in Scenario" }).click();

  await contentWorkspace.getByLabel("Content title").fill("PS-740 quarantined content");
  await contentWorkspace.getByLabel("File (maximum 512 KiB)").setInputFiles({
    name: "ps-740-eicar.txt", mimeType: "text/plain", buffer: Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")
  });
  await contentWorkspace.getByRole("button", { name: "Upload and scan" }).click();
  const infectedCard = page.locator("#content-library .catalog-card").filter({ hasText: "PS-740 quarantined content" });
  await expect(infectedCard.getByText("infected", { exact: true })).toBeVisible();
  await expect(infectedCard.getByRole("button", { name: "Use current version in Scenario" })).toBeDisabled();

  await expect(page.getByText("All changes received by the server")).toBeVisible();
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
  await expect(page.locator("#adjudication")).toBeAttached();
  await expect(page.locator("#plugins")).toBeAttached();
  await expect(page.locator("#compositions")).toBeAttached();
  await expect(page.locator("#polls")).toBeAttached();
  await expect(page.locator("#voice")).toBeAttached();

  await advancedWorkspace.getByRole("button", { name: "Add State Value" }).click();
  const stateValue = advancedWorkspace.locator("details.editor-item").first();
  await stateValue.locator("summary").click();
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
  const catalogCard = pluginsWorkspace.locator("article.catalog-card").first();
  await catalogCard.getByRole("button", { name: "Bind installed Plugin" }).click();
  const binding = pluginsWorkspace.locator("details.editor-item").last();
  await binding.locator("summary").click();
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
  await poll.locator("summary").click();
  await expect(poll.locator('[role="status"]').filter({ hasText: "Publication readiness:" })).toContainText("Complete");
  await expect(poll.getByText(/Count accepted ballots/u)).toBeVisible();
  await poll.getByLabel("Ballot visibility").selectOption("secret_ballot");
  await expect(poll.getByText(/resolved OPEN-028/u).first()).toBeVisible();
  await poll.getByLabel("Ballot visibility").selectOption("open");

  const voiceWorkspace = await openStudioWorkspace(page, "Voice Channels");
  await voiceWorkspace.getByLabel("Target deployment profile").selectOption("air_gapped");
  const voice = voiceWorkspace.locator("details.editor-item").first();
  await voice.locator("summary").click();
  await expect(voice.getByText(/air gapped compatibility:/u)).toBeVisible();
  await expect(voice.getByText(/Non-audio path:/u)).toBeVisible();

  await expect(page.getByText("All changes received by the server")).toBeVisible({ timeout: 40_000 });
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

  const reviewWorkspace = await openStudioWorkspace(page, "Review & publish", "Review and publish");
  await expect(reviewWorkspace.getByText("Governance references")).toBeVisible();
  await expect(reviewWorkspace.getByText("Artifact digest")).toBeHidden();
  const liveChangesWorkspace = await openStudioWorkspace(page, "Live Changes", "Activate a Release");
  await expect(liveChangesWorkspace).toBeVisible();

  const testWorkspace = await openStudioWorkspace(page, "Test & validate");
  await page.goBack();
  await expect(page.getByRole("region", { name: "Activate a Release" })).toBeVisible();
  await page.goForward();
  await expect(testWorkspace).toBeVisible();
  await testWorkspace.getByRole("button", { name: "Run deterministic rehearsal" }).click();
  await expect(page.getByText(/Rehearsal completed with \d+ evaluated trigger/u)).toBeVisible();
  const digest = await page.locator("#test-validate .digest-line").textContent();
  await testWorkspace.getByRole("button", { name: "Run deterministic rehearsal" }).click();
  await expect(page.locator("#test-validate .digest-line")).toHaveText(digest ?? "");
  await expect(page.getByText("All changes received by the server")).toBeVisible();

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

test("PS-770-T01/T02 AC-08 AC-11 participant enters by policy, chooses labeled Seats, switches role, and recovers offline @a11y", async ({ browser }) => {
  test.setTimeout(180_000);
  const { context, page } = await actor(browser, fixture.tokens.invitedParticipant);
  await page.goto("/?workspace=participant");
  await expect(page.getByRole("heading", { level: 1, name: "Your Sessions" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Project editor/u })).toHaveCount(0);
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

test("PS-780-T01/T02 AC-12/AC-13 Operator runs reasoned lifecycle and Stage controls without a Participant Seat @a11y", async ({ browser }) => {
  test.setTimeout(180_000);
  const { context, page } = await actor(browser, fixture.tokens.portalOperator);
  await page.goto(`/admin/sessions/${fixture.operatorSessionId}`);
  await expect(page.getByRole("heading", { name: "Session control view" })).toBeVisible();
  await expect(page.getByText("PS-780 Operator Control Exercise")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Session control", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Injects" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Adjudications" })).toBeVisible();

  const applySession = async (operation, reason) => {
    const target = { "session.start": "active", "session.pause": "paused", "session.resume": "active",
      "session.complete": "completed", "session.lock": "locked" }[operation];
    await page.getByLabel("Next valid action").selectOption(operation);
    await page.getByLabel("Reason", { exact: true }).first().fill(reason);
    await page.getByLabel("Confirm this authoritative lifecycle change.").check();
    await page.getByRole("button", { name: "Apply Session control" }).click();
    await expect(page.locator(".hero")).toContainText(`Session ${target}`);
  };
  await applySession("session.start", "Start PS-780 operator exercise");
  await expect(page.getByText(/Session active/u)).toBeVisible();

  await page.getByLabel("Stage action").selectOption("stage.start");
  await page.getByLabel("Reason", { exact: true }).nth(1).fill("Start first governed Stage");
  await page.getByLabel("Confirm the previewed Stage intervention.").check();
  await page.getByRole("button", { name: "Apply Stage control" }).click();
  await expect(page.getByText("Authoritative Session state updated.")).toBeVisible();
  await expect(page.getByText(/Status:\s*active/u)).toBeVisible();

  await applySession("session.pause", "Pause for operator verification");
  await applySession("session.resume", "Resume after operator verification");
  await applySession("session.complete", "Complete operator exercise");
  await applySession("session.lock", "Lock immutable exercise evidence");
  await expect(page.getByText(/Session locked/u)).toBeVisible();
  await expect(page.getByText("session.locked")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${operatorEvidenceRoot}/operator-control-floor.png`, fullPage: true });
  await context.close();
});

test("PS-790-T01 Admin and Publisher complete role, trust, Plugin, policy, and archive operations @a11y", async ({ browser }) => {
  test.setTimeout(180_000);
  const publisher = await actor(browser, fixture.tokens.publisher);
  await publisher.page.goto("/admin/plugins");
  await expect(publisher.page.getByRole("heading", { name: "Plugin operations" })).toBeVisible();
  await publisher.page.getByLabel("Signed Plugin bundle").setInputFiles("output/user-test/ps-790/ps-790-synthetic-plugin.json");
  await publisher.page.getByRole("button", { name: "Verify and submit" }).click();
  await expect(publisher.page.locator(".administration-notice")).toContainText("Plugin bundle submitted");
  await publisher.context.close();

  const admin = await actor(browser, fixture.tokens.operator);
  const { page } = admin;
  await page.goto("/admin/members");
  await expect(page.getByRole("heading", { name: "Members and Organization Roles" })).toBeVisible();
  const reviewer = page.locator("li.administration-record").filter({ hasText: "Synthetic final reviewer" });
  await reviewer.getByLabel("Operator", { exact: true }).check();
  await reviewer.getByRole("button", { name: "Save role assignment" }).click();
  await expect(page.locator(".administration-notice")).toContainText("Organization Roles updated");
  const updatedReviewer = page.locator("li.administration-record").filter({ hasText: "Synthetic final reviewer" });
  await updatedReviewer.getByLabel("Operator", { exact: true }).uncheck();
  await updatedReviewer.getByRole("button", { name: "Save role assignment" }).click();
  await expect(page.locator(".administration-notice")).toContainText("Organization Roles updated");

  await page.goto("/admin/plugins");
  await expect(page.getByText("1 Publishers")).toBeVisible();
  await expect(page.getByText("1 trust roots")).toBeVisible();
  await expect(page.getByText("1 revocation lists")).toBeVisible();
  await expect(page.getByText("1 license acceptances")).toBeVisible();
  const plugin = page.locator("li.administration-record").filter({ hasText: "org.ssg.fixtures.pending" });
  await plugin.getByRole("button", { name: "Approve Artifact" }).click();
  await expect(page.locator(".administration-notice")).toContainText("Plugin Artifact approved");
  const approvedPlugin = page.locator("li.administration-record").filter({ hasText: "org.ssg.fixtures.pending" });
  await approvedPlugin.getByText("Install approved Artifact").click();
  await approvedPlugin.getByRole("button", { name: "Verify and install" }).click();
  await expect(page.locator(".administration-notice")).toContainText("Plugin installed");
  const installedPlugin = page.locator("li.administration-record").filter({ hasText: "org.ssg.fixtures.pending" });
  await expect(installedPlugin).toContainText("1 installations");
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
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export portable archive" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("plenum-organization-archive.json");
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
  await expect(operator.page.getByRole("heading", { name: "Generated artifacts" }).locator("..")).toContainText("after_action");

  await operator.page.goto(`/admin/sessions/${fixture.sessionId}/replay`);
  await operator.page.getByRole("button", { name: "Run replay" }).click();
  await expect(operator.page.getByText("Matched", { exact: true })).toBeVisible();
  await expect(operator.page.getByText("No differences were found between captured and replayed history.")).toBeVisible();

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
  await expect(analyst.page.getByRole("heading", { name: "Your generated exports" }).locator("..")).toContainText("research_dataset");
  expect((await new AxeBuilder({ page: analyst.page }).analyze()).violations).toEqual([]);
  await analyst.page.screenshot({ path: `${operationsEvidenceRoot}/research-provenance.png`, fullPage: true });
  await analyst.context.close();

  const reviewer = await actor(browser, fixture.tokens.finalReviewer);
  await reviewer.page.goto("/admin/members");
  await expect(reviewer.page.getByRole("heading", { name: "Administration access unavailable" })).toBeVisible();
  await expect(reviewer.page.getByText("Synthetic operator")).toHaveCount(0);
  await reviewer.context.close();
});
