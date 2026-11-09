import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture } from "../fixture.mjs";
import { plan } from "./cases.mjs";
import { interfaceFindings } from "./assertions.mjs";

for (const mode of ["create", "reconcile"]) test(`PS-842-T03 Platform ${mode} submits named capabilities and preserves custom contracts`, async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, reducedMotion: "reduce", extraHTTPHeaders: { Authorization: `Bearer ${fixture.tokens.operator}` } });
  try {
    const page = await context.newPage();
    const requests = [];
    const target = mode === "create" ? "/v1/platform/organizations" : `/v1/platform/organizations/${fixture.organizationId}/provisioning`;
    // Serialization check only; real Platform authorization and provisioning remain covered by the database suite.
    await page.route("**/v1/platform/organizations**", async (route) => {
      const request = route.request();
      if (["POST", "PUT"].includes(request.method()) && new URL(request.url()).pathname === target) {
        requests.push(request.postDataJSON());
        await route.fulfill({ status: 422, json: { error: { message: "Synthetic serializer check; no Organization was changed." } } });
      } else await route.continue();
    });
    await page.goto(mode === "create" ? "/platform/organizations" : `/platform/organizations/${fixture.organizationId}`);
    if (mode === "create") await page.locator("details.platform-create-disclosure > summary").click();
    const form = page.locator(mode === "create" ? "details.platform-create-disclosure form" : ".platform-reconciliation form");
    if (mode === "create") {
      await form.getByLabel("Organization name", { exact: true }).fill("Synthetic capability check");
      await form.getByLabel("Workspace address", { exact: true }).fill("ps842-capability-check");
    }
    for (const [label, value] of [["Legal name", "Synthetic capability check"], ["Country code", "ZA"], ["Time zone", "UTC"], ["Data residency region", "af-south"], ["Support contact", "synthetic@example.test"]]) {
      await form.getByLabel(label, { exact: true }).fill(value);
    }
    const choices = form.getByRole("group", { name: "Enabled capabilities", exact: true });
    await expect(choices.getByRole("checkbox", { name: "Studio Authoring", exact: true })).toBeChecked();
    await choices.getByRole("checkbox", { name: "Session Delivery", exact: true }).uncheck();
    expect(await interfaceFindings(page)).toEqual([]);
    const submit = form.locator('button[type="submit"]');
    await submit.click();
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0].entitlements).toEqual(["studio_authoring"]);
    await choices.getByText("Advanced capability configuration", { exact: true }).click();
    await choices.getByLabel("Additional contracted capability keys", { exact: true }).fill("custom_contract");
    await submit.click();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1].entitlements).toEqual(["studio_authoring", "custom_contract"]);
    await choices.getByRole("checkbox", { name: "Studio Authoring", exact: true }).uncheck();
    await choices.getByLabel("Additional contracted capability keys", { exact: true }).fill("");
    await submit.click();
    await expect(page.getByText("Select at least one capability.", { exact: true })).toBeVisible();
    expect(requests).toHaveLength(2);
  } finally { await context.close(); }
});

test("PS-842-T04 Studio mounts work on demand and preserves visited form state", async ({ page }) => {
  await page.setExtraHTTPHeaders({ Authorization: `Bearer ${fixture.tokens.designerA}` });
  await page.goto(`/studio/projects/${fixture.projectId}#content-library`);
  await page.getByLabel("Content title", { exact: true }).fill("Unsaved synthetic upload title");
  await expect(page.locator("#forms")).toHaveCount(0);
  await page.locator('.editor-nav a[href="#methodology"]').click();
  await expect(page.locator('.editor-nav a[href="#methodology"]')).toHaveAttribute("aria-current", "page");
  await page.locator('.editor-nav a[href="#content-library"]').click();
  await expect(page.getByLabel("Content title", { exact: true })).toHaveValue("Unsaved synthetic upload title");
});

for (const failure of ["offline", "error"]) test(`PS-842-T01 ${failure} recovery retains one page heading`, async ({ page }) => {
  await page.route("**/v1/product-context", (route) => failure === "offline" ? route.abort("failed")
    : route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Synthetic service unavailable" } }) }));
  await page.goto("/");
  await expect(page.locator(`[data-state="${failure}"]`)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Retry/ })).toBeVisible();
});

for (const [persona, token] of plan.filter(([, token]) => token)) {
  test(`PS-842-T01 visible workspaces: ${persona}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: { width: 1024, height: 768 }, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const page = await context.newPage();
    try {
      await page.goto("/");
      const nav = page.locator("#workspace-navigation");
      await expect(nav).toBeAttached();
      const destinations = await nav.locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      expect(destinations.length).toBeGreaterThan(0);
      for (const href of destinations) {
        await page.goto("/");
        const toggle = page.getByRole("button", { name: "Open workspaces", exact: true });
        if (await toggle.isVisible()) await toggle.click();
        await nav.locator(`a[href=${JSON.stringify(href)}]`).click();
        await expect(page.locator(".plenum-loader:visible")).toHaveCount(0);
        await expect(page.locator('[data-state="unauthorized"]')).toHaveCount(0);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      }
    } finally { await context.close(); }
  });
}

test("PS-842-T01 legacy Session links preserve the role and resolve canonically", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${fixture.tokens.blueNotetaker}` } });
  try {
    const page = await context.newPage();
    await page.goto(`/?sessionId=${fixture.sessionId}&role=notetaker#capture`);
    await expect(page).toHaveURL(`${baseURL}/sessions/${fixture.sessionId}/runtime?role=notetaker#capture`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  } finally { await context.close(); }
});

for (const persona of [
  { key: "designerB", roles: ["research_analyst"], destinations: ["home"], platformRoles: [], heading: "Research reports" },
  { key: "publisher", roles: ["publisher"], destinations: ["home", "operations"], platformRoles: [], heading: "Releases" },
  { key: "operator", roles: [], destinations: ["home", "platform"], platformRoles: ["platform_administrator"], heading: "Organizations" }
]) test(`PS-842-T01 single-authority shell fixture: ${persona.heading}`, async ({ browser, baseURL }) => {
  // Presentation fixture only: real API denial and tenant isolation are verified by the database suites.
  const context = await browser.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${fixture.tokens[persona.key]}` } });
  try {
    const page = await context.newPage();
    await page.route("**/v1/product-context", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.organization.roles = persona.roles;
      body.destinations = persona.destinations;
      body.platformRoles = persona.platformRoles;
      await route.fulfill({ response, json: body });
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: persona.heading, exact: true })).toBeVisible();
    await expect(page.locator('#workspace-navigation [aria-current="page"]')).toHaveCount(1);
    if (persona.key === "publisher") {
      await expect(page.locator('#workspace-navigation a[href="/admin/plugins"]')).toHaveCount(1);
      await expect(page.getByText("Sessions are not available", { exact: false })).toHaveCount(0);
    }
  } finally { await context.close(); }
});

for (const count of [1, 100]) test(`PS-842-T04 Inject badge accessible name includes its visible count: ${count}`, async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${fixture.tokens.finalReviewer}` } });
  try {
    const page = await context.newPage();
    await page.route("**/runtime-projection", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.messages = [];
      body.injects = Array.from({ length: count }, (_, index) => ({ id: `badge-${index}`, definitionId: `definition-${index}`,
        title: `Synthetic Inject ${index + 1}`, content: { body: "Header badge fixture." }, state: "released",
        releasedAt: "2026-01-15T12:00:00Z", acknowledgedAt: null, respondedAt: null,
        requiredResponseArtifactTypeId: null, acknowledgementRequired: false, version: 1 }));
      await route.fulfill({ response, json: body });
    });
    await page.goto(`/sessions/${fixture.sessionId}/runtime`);
    const button = page.locator(".runtime-notifications");
    await expect(button).toHaveAccessibleName(count === 1 ? "Injects 1" : "Injects 99+");
    await expect(button).toHaveAccessibleDescription(`Injects: ${count} new`);
    expect((await new AxeBuilder({ page }).include(".runtime-header").analyze()).violations).toEqual([]);
  } finally { await context.close(); }
});

test("PS-842-T03 UUID effect targets remain in explicit provenance", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${fixture.tokens.finalReviewer}` } });
  const target = "84200000-0000-4000-8000-000000000001";
  try {
    const page = await context.newPage();
    await page.route("**/effect-proposals", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      expect(body.proposals.length).toBeGreaterThan(0);
      body.proposals[0].targetStateVariableId = target;
      await route.fulfill({ response, json: body });
    });
    await page.goto(`/sessions/${fixture.sessionId}/runtime`);
    const proposal = page.getByRole("article", { name: "Proposed state change 1", exact: true });
    await expect(proposal).toBeVisible();
    await expect(proposal.getByText(target, { exact: true })).toBeHidden();
    await proposal.getByText("Provenance", { exact: true }).click();
    await expect(proposal.getByText(target, { exact: true })).toBeVisible();
  } finally { await context.close(); }
});

for (const path of ["/", "/studio/"]) test(`PS-842-T04 OS theme remains live until an explicit preference is persisted: ${path}`, async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, colorScheme: "dark" });
  try {
    const page = await context.newPage();
    await page.goto(path);
    await expect(page.getByRole("button", { name: /^Theme:/ })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => localStorage.getItem("plenum.theme"))).toBeNull();
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: /^Theme:/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  } finally { await context.close(); }
});
