import { mkdir } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { fixture, runtimeUrl } from "../fixture.mjs";

const evidenceRoot = "output/playwright/ps-700";
const headers = (token) => ({ Authorization: `Bearer ${token}` });

async function actor(browser, token, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, extraHTTPHeaders: headers(token) });
  return { context, page: await context.newPage() };
}

test.beforeAll(async () => mkdir(evidenceRoot, { recursive: true }));

test("PS-700-T01 authenticated root is useful, branded, responsive, and accessible @a11y", async ({ browser }) => {
  const { context, page } = await actor(browser, fixture.tokens.operator);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Design with intent. Run with authority." })).toBeVisible();
  await expect(page.getByRole("img", { name: "Plenum" })).toBeVisible();
  await expect(page.getByText("PS-150 synthetic organization")).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: /^Studio/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Operations/ })).toBeVisible();
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
