import { mkdir } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { fixture, operatorUrl, runtimeUrl } from "./fixture.mjs";

const evidenceRoot = "output/playwright/ps-150";
const headers = (token) => ({ Authorization: `Bearer ${token}` });

async function actor(browser, token, options = {}) {
  const context = await browser.newContext({ ...options, extraHTTPHeaders: headers(token) });
  return { context, page: await context.newPage() };
}

async function createDraft(page, summary) {
  const create = page.getByRole("region", { name: "Decision request" });
  await create.getByLabel("Summary").fill(summary);
  await create.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("The server accepted the Command.")).toBeVisible();
}

test.describe.serial("PS-150 configured Runtime shell", () => {
  test.beforeAll(async () => mkdir(evidenceRoot, { recursive: true }));

  test("@a11y AC-04 REQ-064 renders a keyboard and screen-reader operable empty workspace", async ({ browser }) => {
    const { context, page } = await actor(browser, fixture.tokens.author, { viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
    await page.goto(runtimeUrl());
    await expect(page.getByRole("heading", { level: 1, name: "Scribe workspace" })).toBeVisible();
    await expect(page.getByText("No Artifacts have been created yet.")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({ path: `${evidenceRoot}/runtime-desktop.png`, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("Summary").fill("A long representative request ".repeat(18));
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `${evidenceRoot}/runtime-390px.png`, fullPage: true });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `${evidenceRoot}/runtime-200-percent-text.png`, fullPage: true });
    await context.close();
  });

  test("AC-03/05/06/12/13 completes DEC-42 and denies forbidden or unauthorized paths", async ({ browser }) => {
    const author = await actor(browser, fixture.tokens.author);
    await author.page.goto(runtimeUrl());
    await createDraft(author.page, "Approve the first configured handoff");
    const authored = author.page.locator("article.artifact").first();
    await expect(authored.getByText("Draft", { exact: true })).toBeVisible();
    await authored.getByRole("button", { name: "Submit to Facilitator" }).click();
    await expect(authored.getByText("With Facilitator", { exact: true })).toBeVisible();
    await expect(authored.getByRole("button", { name: "Save changes" })).toHaveCount(0);

    const authorApi = author.context.request;
    const deviceResponse = await authorApi.post("/v1/devices", { data: {} });
    const { deviceId } = await deviceResponse.json();
    const invalid = await authorApi.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: { operationType: "artifact.edit" } });
    expect(invalid.status()).toBe(422);
    expect((await invalid.json()).error.code).toBe("INVALID_COMMAND");
    const authorProjection = await (await authorApi.get(`/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": deviceId } })).json();
    const submitted = authorProjection.artifacts[0];
    const forbidden = await authorApi.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId, operationType: "artifact.edit", aggregateId: submitted.id,
      expectedAggregateVersion: submitted.version, governingReleaseId: submitted.governingReleaseId,
      activeSessionRoleId: authorProjection.activeSessionRoleId, payload: { content: { summary: "Forbidden withdrawal" } }
    } });
    expect(forbidden.status()).toBe(409);
    expect((await forbidden.json()).errorCode).toBe("INVALID_TRANSITION");
    const unauthorizedOperator = await authorApi.get(`/v1/operator/sessions/${fixture.sessionId}`);
    expect(unauthorizedOperator.status()).toBe(403);

    const reviewer = await actor(browser, fixture.tokens.reviewer);
    await reviewer.page.goto(runtimeUrl());
    await reviewer.page.getByRole("button", { name: "Forward to White Cell" }).click();
    await expect(reviewer.page.getByText("With White Cell", { exact: true })).toBeVisible();

    const finalReviewer = await actor(browser, fixture.tokens.finalReviewer);
    await finalReviewer.page.goto(runtimeUrl());
    await finalReviewer.page.getByRole("button", { name: "Accept request" }).click();
    await expect(finalReviewer.page.getByText("Accepted", { exact: true })).toBeVisible();

    const operator = await actor(browser, fixture.tokens.operator);
    await operator.page.goto(operatorUrl());
    await expect(operator.page.getByRole("heading", { level: 1, name: "Session control view" })).toBeVisible();
    await expect(operator.page.locator(".status-list li").filter({ hasText: "accepted" })).toContainText("1");
    await expect(operator.page.getByText("artifact.accepted", { exact: true })).toBeVisible();
    await operator.page.screenshot({ path: `${evidenceRoot}/operator-accepted.png`, fullPage: true });
    await Promise.all([author.context.close(), reviewer.context.close(), finalReviewer.context.close(), operator.context.close()]);
  });

  test("AC-08/10 keeps stale and lost-acknowledgement states truthful", async ({ browser }) => {
    const author = await actor(browser, fixture.tokens.author);
    await author.page.goto(runtimeUrl());
    await createDraft(author.page, "Stale version proof");

    const deviceResponse = await author.context.request.post("/v1/devices", { data: {} });
    const { deviceId } = await deviceResponse.json();
    const projectionResponse = await author.context.request.get(`/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": deviceId } });
    const projection = await projectionResponse.json();
    const staleArtifact = projection.artifacts.at(-1);
    const changed = await author.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId, operationType: "artifact.edit", aggregateId: staleArtifact.id,
      expectedAggregateVersion: staleArtifact.version, governingReleaseId: staleArtifact.governingReleaseId,
      activeSessionRoleId: projection.activeSessionRoleId, payload: { content: { summary: "Changed on another connection" } }
    } });
    expect(changed.status()).toBe(200);
    const staleCard = author.page.locator("article.artifact").last();
    await staleCard.getByRole("button", { name: "Submit to Facilitator" }).click();
    await expect(author.page.getByText(/Authoritative state changed: The Artifact is at version 2/)).toBeVisible();

    let intercepted = false;
    await author.page.route("**/v1/sessions/*/commands", async (route) => {
      if (intercepted) return route.continue();
      intercepted = true;
      const response = await route.fetch();
      await response.body();
      await route.abort("failed");
    });
    const create = author.page.getByRole("region", { name: "Decision request" });
    await create.getByLabel("Summary").fill("Lost acknowledgement proof");
    await create.getByRole("button", { name: "Save draft" }).click();
    await expect(author.page.getByText("Delivery acknowledgement was lost. This Command is still local pending, not accepted.")).toBeVisible();
    await author.page.unroute("**/v1/sessions/*/commands");
    await author.page.getByRole("button", { name: "Check receipt and retry" }).click();
    await expect(author.page.getByText("The original server receipt was recovered.")).toBeVisible();
    await expect(author.page.getByText("Lost acknowledgement proof")).toBeVisible();
    await author.context.close();
  });

  test("AC-04 shows deterministic loading, denial, offline and retry states", async ({ browser }) => {
    const loading = await actor(browser, fixture.tokens.reviewer);
    let releaseProjection;
    const held = new Promise((resolve) => { releaseProjection = resolve; });
    await loading.page.route("**/v1/sessions/*/runtime-projection", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await held;
      await route.continue();
    });
    await loading.page.goto(runtimeUrl());
    await expect(loading.page.getByRole("heading", { name: "Loading Runtime" })).toBeVisible();
    releaseProjection();
    await expect(loading.page.getByRole("heading", { name: "Facilitator workspace" })).toBeVisible();
    await loading.page.unroute("**/v1/sessions/*/runtime-projection");
    await loading.context.setOffline(true);
    await loading.page.getByRole("button", { name: "Refresh authoritative state" }).click();
    await expect(loading.page.getByText("Offline", { exact: true })).toBeVisible();
    await loading.context.setOffline(false);
    await expect(loading.page.getByText("Connected", { exact: true })).toBeVisible();

    const denied = await browser.newPage();
    await denied.goto(operatorUrl());
    await expect(denied.getByRole("heading", { name: "Access denied" })).toBeVisible();
    await expect(denied.getByRole("alert")).toContainText("valid test identity");
    await denied.close();
    await loading.context.close();
  });
});
