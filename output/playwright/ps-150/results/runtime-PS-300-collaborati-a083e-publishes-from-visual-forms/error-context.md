# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: runtime.spec.mjs >> PS-300 collaborative Studio >> @a11y SYNC-01 SYNC-02 AC-01 AC-02 reconnects, converges, validates, freezes and publishes from visual forms
- Location: tests\e2e\runtime.spec.mjs:1380:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/is ready for Reviewer approval/u)
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText(/is ready for Reviewer approval/u) with timeout 20000ms
  - waiting for getByText(/is ready for Reviewer approval/u)

```

```yaml
- link "Skip to Draft editor":
  - /url: "#main-content"
- banner:
  - link "Plenum home":
    - /url: /
  - navigation "Studio":
    - link "Projects":
      - /url: /?workspace=projects
  - text: Connected
- main:
  - navigation "Breadcrumb":
    - list:
      - listitem:
        - link "Projects":
          - /url: /?workspace=projects
      - listitem: /Draft
  - heading "Fractured Order" [level=1]
  - paragraph: Core Design editor · Collaborative Draft · Browser convergence proof
  - term: Organization
  - definition: PS-150 synthetic organization
  - term: Signed in as
  - definition: Synthetic Publisher
  - term: Organization roles
  - definition: designer, publisher, reviewer
  - region "Draft status":
    - strong: Synchronized
    - text: All changes received by the server
    - strong: Ready for review
    - text: Publication checks passed
    - group: Sync details
  - paragraph: The synchronized Draft is frozen and ready for Reviewer approval.
  - navigation "Design workspaces":
    - heading "Draft map" [level=2]
    - button "Undo last change"
    - region "Set the foundation":
      - heading "Set the foundation" [level=3]
      - list:
        - listitem:
          - link "Overview & Scenario":
            - /url: "#overview"
        - listitem:
          - link "Methodology":
            - /url: "#methodology"
        - listitem:
          - link "Teams":
            - /url: "#teams"
    - region "Define people and work":
      - heading "Define people and work" [level=3]
      - list:
        - listitem:
          - link "Session Roles":
            - /url: "#roles"
        - listitem:
          - link "Seats":
            - /url: "#seats"
        - listitem:
          - link "Activities":
            - /url: "#activities"
        - listitem:
          - link "Stages":
            - /url: "#stages"
    - region "Design information flow":
      - heading "Design information flow" [level=3]
      - list:
        - listitem:
          - link "Forms & Artifacts":
            - /url: "#forms"
        - listitem:
          - link "Workflows":
            - /url: "#workflows"
        - listitem:
          - link "Information Policy":
            - /url: "#policies"
        - listitem:
          - link "Communications":
            - /url: "#communications"
        - listitem:
          - link "Injects":
            - /url: "#injects"
        - listitem:
          - link "Content Library":
            - /url: "#content-library"
    - region "Model decisions and systems":
      - heading "Model decisions and systems" [level=3]
      - list:
        - listitem:
          - link "Advanced logic & world state":
            - /url: "#advanced-logic"
        - listitem:
          - link "Adjudication Models":
            - /url: "#adjudication"
        - listitem:
          - link "Polls":
            - /url: "#polls"
        - listitem:
          - link "Voice Channels":
            - /url: "#voice"
        - listitem:
          - link "Plugin catalog & bindings":
            - /url: "#plugins"
        - listitem:
          - link "Model Compositions":
            - /url: "#compositions"
    - region "Shape the experience":
      - heading "Shape the experience" [level=3]
      - list:
        - listitem:
          - link "Interfaces":
            - /url: "#interfaces"
        - listitem:
          - link "Research":
            - /url: "#research"
        - listitem:
          - link "Measurements & reports":
            - /url: "#measurements-reports"
        - listitem:
          - link "Access & readiness":
            - /url: "#access"
    - region "Verify and release":
      - heading "Verify and release" [level=3]
      - list:
        - listitem:
          - link "Role walkthrough":
            - /url: "#preview"
        - listitem:
          - link "Test & validate":
            - /url: "#test-validate"
        - listitem:
          - link "Review & publish":
            - /url: "#review-publish"
        - listitem:
          - link "Live Changes":
            - /url: "#live-changes"
  - text: Core Design/
  - strong: Review & publish
  - region "Review and publish":
    - heading "Review and publish" [level=2]
    - paragraph: A Publisher freezes the exact synchronized state, a Reviewer approves that freeze, and a Publisher publishes it. Later edits remain in the next Draft.
    - button "Freeze for review"
    - paragraph:
      - strong: Frozen revision ready for review
    - paragraph: Frozen 11/3/2026, 10:07:24 AM by Synthetic Publisher.
    - paragraph: 0 current approvals.
    - group: Technical provenance
    - form "Reviewer approval":
      - heading "Reviewer approval" [level=3]
      - text: Methodology review notes
      - textbox "Methodology review notes"
      - button "Approve freeze" [disabled]
    - form "Release details":
      - heading "Release details" [level=3]
      - text: Release label
      - textbox "Release label": PS-300 browser proof
      - text: Semantic version
      - textbox "Semantic version": 3.0.0
      - text: Release notes
      - textbox "Release notes": Collaborative browser acceptance proof.
      - group:
        - text: Governance references
        - paragraph: These governed references are required by publication policy and remain attached to the Release record.
        - text: Classification review reference
        - textbox "Classification review reference": browser-classification-review
        - text: Retention policy reference
        - textbox "Retention policy reference": standard-retention
      - text: Approval notes
      - textbox "Approval notes": Synthetic browser approval.
      - checkbox "I acknowledge the validation warnings." [checked]
      - text: I acknowledge the validation warnings.
      - button "Publish approved freeze" [disabled]
    - form "Template version":
      - heading "Template version" [level=3]
      - paragraph: Publish the same approved frozen revision as an immutable Organization Template. Supersession preserves the earlier version and its history.
      - text: Template title
      - textbox "Template title"
      - text: Summary
      - textbox "Summary"
      - text: Supersedes (optional)
      - combobox "Supersedes (optional)":
        - option "New Template line" [selected]
        - option "Fractured Order Core Design v1 · published"
      - checkbox "Include the optional Scenario"
      - text: Include the optional Scenario Publication rationale
      - textbox "Publication rationale"
      - button "Publish immutable Template version" [disabled]
    - region "Template lifecycle history":
      - heading "Template lifecycle history" [level=3]
      - text: Template version
      - combobox "Template version":
        - option "Fractured Order Core Design v1 · published" [selected]
      - group: Attributable history
      - text: Lifecycle rationale
      - textbox "Lifecycle rationale"
      - button "Record deprecation" [disabled]
      - button "Record archival" [disabled]
  - complementary "Draft guidance":
    - region "Draft checks":
      - heading "Draft checks" [level=2]
      - text: Ready for review
      - paragraph: No blocking issues were found. This Draft can move to review when the authoring work is complete.
```

# Test source

```ts
  1355 |       if (route.request().method() !== "GET") return route.continue();
  1356 |       await held;
  1357 |       await route.continue();
  1358 |     });
  1359 |     await loading.page.goto(runtimeUrl());
  1360 |     await expect(loading.page.getByRole("heading", { name: "Loading Runtime" })).toBeVisible();
  1361 |     releaseProjection();
  1362 |     await expect(loading.page.getByRole("heading", { name: "Blue Facilitator workspace" })).toBeVisible({ timeout: 15_000 });
  1363 |     await loading.page.unroute("**/v1/sessions/*/runtime-projection");
  1364 |     await loading.context.setOffline(true);
  1365 |     await loading.page.getByRole("button", { name: "Refresh authoritative state" }).click();
  1366 |     await expect(loading.page.getByText("Offline", { exact: true })).toBeVisible();
  1367 |     await loading.context.setOffline(false);
  1368 |     await expect(loading.page.getByText("Connected", { exact: true })).toBeVisible();
  1369 | 
  1370 |     const denied = await browser.newPage();
  1371 |     await denied.goto(operatorUrl());
  1372 |     await expect(denied.getByRole("heading", { name: "Access denied" })).toBeVisible();
  1373 |     await expect(denied.getByRole("alert")).toContainText("valid test identity");
  1374 |     await denied.close();
  1375 |     await loading.context.close();
  1376 |   });
  1377 | });
  1378 | 
  1379 | test.describe.serial("PS-300 collaborative Studio", () => {
  1380 |   test("@a11y SYNC-01 SYNC-02 AC-01 AC-02 reconnects, converges, validates, freezes and publishes from visual forms", async ({ browser }) => {
  1381 |     test.setTimeout(1_200_000);
  1382 |     const serverTimeout = 20_000;
  1383 |     const first = await actor(browser, fixture.tokens.publisher, { viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
  1384 |     const second = await actor(browser, fixture.tokens.designerA, { viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  1385 |     await Promise.all([first.page.goto(studioUrl()), second.page.goto(studioUrl())]);
  1386 |     await expect(first.page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 40_000 });
  1387 |     await expect(second.page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 120_000 });
  1388 |     await expect(first.page.locator(".studio-context h1")).toBeVisible();
  1389 | 
  1390 |     const teams = await openStudioWorkspace(first.page, "Teams");
  1391 |     await teams.getByRole("button", { name: "Add Team" }).click();
  1392 |     await teams.getByText("New Team", { exact: true }).click();
  1393 |     await teams.getByLabel("Team name").last().fill("Browser-created Team");
  1394 | 
  1395 |     const roles = await openStudioWorkspace(first.page, "Session Roles");
  1396 |     await roles.locator("details").first().locator("summary").click();
  1397 |     await roles.getByLabel("Description").first().fill("Configured by the PS-350 visual proof.");
  1398 |     const stages = await openStudioWorkspace(first.page, "Stages");
  1399 |     await stages.locator("details[id^='stages-']").first().locator("summary").click();
  1400 |     await stages.getByLabel("Duration in seconds (0 for untimed)").first().fill("1799");
  1401 |     const forms = await openStudioWorkspace(first.page, "Forms & Artifacts", "Forms & Artifact Types");
  1402 |     await forms.locator("details[id^='forms-']").first().locator("summary").click();
  1403 |     await forms.getByLabel("Form name").first().fill("PS-350 browser-configured form");
  1404 |     const workflows = await openStudioWorkspace(first.page, "Workflows");
  1405 |     await workflows.locator("details[id^='workflows-']").first().locator("summary").click();
  1406 |     await workflows.getByLabel("Workflow name").first().fill("PS-350 DEC-42 review workflow");
  1407 |     await expect(first.page.getByText("Synchronized", { exact: true })).toBeVisible({ timeout: 40_000 });
  1408 | 
  1409 |     const firstOverview = await openStudioWorkspace(first.page, "Overview & Scenario");
  1410 |     await firstOverview.getByLabel("Scenario name").fill("Browser convergence proof");
  1411 |     await expect(first.page.getByText("Synchronized", { exact: true })).toBeVisible({ timeout: 40_000 });
  1412 |     await expect(second.page.getByLabel("Scenario name")).toHaveValue("Browser convergence proof", { timeout: 20_000 });
  1413 |     await second.context.setOffline(true);
  1414 |     await second.page.evaluate(() => window.dispatchEvent(new Event("offline")));
  1415 |     await second.page.getByLabel("Scenario description").fill("Offline visual-form edit merged after reconnect.");
  1416 |     await expect(second.page.getByText("Offline", { exact: true })).toBeVisible();
  1417 |     await expect(second.page.getByText("Saved on this device", { exact: true })).toBeVisible();
  1418 |     await second.context.setOffline(false);
  1419 |     await second.page.evaluate(() => window.dispatchEvent(new Event("online")));
  1420 |     await expect(second.page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 40_000 });
  1421 |     await expect(second.page.getByText("Synchronized", { exact: true })).toBeVisible({ timeout: 120_000 });
  1422 |     await expect(first.page.getByLabel("Scenario description")).toHaveValue("Offline visual-form edit merged after reconnect.", { timeout: 20_000 });
  1423 |     await expect(second.page.getByLabel("Scenario name")).toHaveValue("Browser convergence proof", { timeout: 20_000 });
  1424 |     await expect(first.page.locator(".studio-state-strip").getByText("Ready for review", { exact: true })).toBeVisible();
  1425 |     await expect(first.page.getByText("Synchronized", { exact: true })).toBeVisible();
  1426 | 
  1427 |     const polls = await openStudioWorkspace(first.page, "Polls");
  1428 |     await polls.locator("details").filter({ hasText: "Adopt the synthetic accessibility resolution?" }).locator("summary").click();
  1429 |     await expect(polls.getByText(/Counting rule: Count accepted ballots using simple majority over valid votes/u)).toBeVisible();
  1430 |     await expect(polls.getByText(/Electorate preview: Everyone/u)).toBeVisible();
  1431 |     const voice = await openStudioWorkspace(first.page, "Voice Channels");
  1432 |     await voice.locator("details").filter({ hasText: "Team open room" }).locator("summary").click();
  1433 |     await expect(voice.getByRole("table", { name: "Selected adapter capability by target profile" })).toBeVisible();
  1434 |     await expect(voice.getByRole("table", { name: "Effective configured permissions. Public access, when selected, applies to every row." })).toBeVisible();
  1435 | 
  1436 |     const preview = await openStudioWorkspace(first.page, "Role walkthrough", "Role & Stage preview");
  1437 |     await preview.getByLabel("Session Role").selectOption("scribe");
  1438 |     await preview.getByLabel("Stage").selectOption("orientation");
  1439 |     await preview.getByLabel("Team").selectOption("blue");
  1440 |     await preview.getByRole("button", { name: "Preview interface" }).click();
  1441 |     await expect(preview.getByText("Preview updated.")).toBeVisible({ timeout: serverTimeout });
  1442 |     await expect(preview.getByLabel("Scribe interface preview")).toBeVisible({ timeout: serverTimeout });
  1443 |     await expect(preview.getByRole("heading", { name: "Opening brief" })).toBeVisible();
  1444 | 
  1445 |     const publication = await openStudioWorkspace(first.page, "Review & publish", "Review and publish");
  1446 |     await publication.getByLabel("Release label").fill("PS-300 browser proof");
  1447 |     await publication.getByLabel("Semantic version").fill("3.0.0");
  1448 |     await publication.getByLabel("Release notes").fill("Collaborative browser acceptance proof.");
  1449 |     await publication.getByText("Governance references").click();
  1450 |     await publication.getByLabel("Classification review reference").fill("browser-classification-review");
  1451 |     await publication.getByLabel("Retention policy reference", { exact: true }).fill("standard-retention");
  1452 |     await publication.getByLabel("Approval notes").fill("Synthetic browser approval.");
  1453 |     await publication.getByLabel("I acknowledge the validation warnings.").check();
  1454 |     await publication.getByRole("button", { name: "Freeze for review" }).click();
> 1455 |     await expect(first.page.getByText(/is ready for Reviewer approval/u)).toBeVisible({ timeout: serverTimeout });
       |                                                                           ^ Error: expect(locator).toBeVisible() failed
  1456 |     const reviewer = await actor(browser, fixture.tokens.finalReviewer, { viewport: { width: 1024, height: 768 }, reducedMotion: "reduce" });
  1457 |     await reviewer.page.goto(studioUrl());
  1458 |     const reviewerPublication = await openStudioWorkspace(reviewer.page, "Review & publish", "Review and publish");
  1459 |     await expect(reviewerPublication.getByRole("button", { name: "Approve freeze" })).toBeEnabled({ timeout: serverTimeout });
  1460 |     await reviewerPublication.getByLabel("Methodology review notes").fill("Synthetic independent methodology review.");
  1461 |     await reviewerPublication.getByRole("button", { name: "Approve freeze" }).click();
  1462 |     await expect(reviewer.page.getByText(/Reviewer approval recorded/u)).toBeVisible({ timeout: serverTimeout });
  1463 |     await reviewer.context.close();
  1464 |     await publication.getByRole("button", { name: "Freeze for review" }).click();
  1465 |     await expect(first.page.getByText("1 current approval.")).toBeVisible({ timeout: serverTimeout });
  1466 |     const publishedResponse = first.page.waitForResponse((response) =>
  1467 |       response.request().method() === "POST" && response.url().endsWith(`/v1/projects/${fixture.projectId}/publish`));
  1468 |     await publication.getByRole("button", { name: "Publish approved freeze" }).click();
  1469 |     publishedReleaseId = (await (await publishedResponse).json()).releaseId;
  1470 |     expect(publishedReleaseId).toMatch(/^[0-9a-f-]{36}$/u);
  1471 |     await expect(first.page.getByText("Published PS-300 browser proof.")).toBeVisible({ timeout: 20_000 });
  1472 |     await expect(first.page.getByText("Published", { exact: true })).toBeVisible({ timeout: 20_000 });
  1473 | 
  1474 |     await second.page.getByLabel("Scenario description").fill("Post-freeze next Draft edit.");
  1475 |     await expect(second.page.getByText("Synchronized", { exact: true })).toBeVisible({ timeout: 120_000 });
  1476 |     const returnedOverview = await openStudioWorkspace(first.page, "Overview & Scenario");
  1477 |     await expect(returnedOverview.getByLabel("Scenario description")).toHaveValue("Post-freeze next Draft edit.", { timeout: 20_000 });
  1478 |     await expect(first.page.getByText("Synchronized", { exact: true })).toBeVisible();
  1479 |     expect((await new AxeBuilder({ page: first.page }).analyze()).violations).toEqual([]);
  1480 |     await first.page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  1481 |     await expect.poll(() => first.page.evaluate(() => [...document.querySelectorAll("body *")].filter((element) => {
  1482 |       const bounds = element.getBoundingClientRect();
  1483 |       return bounds.right > document.documentElement.clientWidth + 1 || bounds.left < -1;
  1484 |     }).slice(0, 12).map((element) => ({ element: `${element.tagName.toLowerCase()}.${element.className}`, right: Math.round(element.getBoundingClientRect().right),
  1485 |       width: Math.round(element.getBoundingClientRect().width), text: element.textContent?.trim().slice(0, 80) })))).toEqual([]);
  1486 |     await Promise.all([first.context.close(), second.context.close()]);
  1487 |   });
  1488 | 
  1489 |   test("AC-03 creates a Session from the Release published in the visual journey", async ({ browser }) => {
  1490 |     expect(publishedReleaseId).toMatch(/^[0-9a-f-]{36}$/u);
  1491 |     const operator = await actor(browser, fixture.tokens.operator);
  1492 |     const createdResponse = await operator.context.request.post(`/v1/projects/${fixture.projectId}/sessions`, {
  1493 |       data: { releaseId: publishedReleaseId }
  1494 |     });
  1495 |     expect(createdResponse.status()).toBe(201);
  1496 |     const created = await createdResponse.json();
  1497 |     expect(created).toMatchObject({
  1498 |       contractId: "session-onboarding-v1",
  1499 |       projectId: fixture.projectId,
  1500 |       governingReleaseId: publishedReleaseId,
  1501 |       status: "created"
  1502 |     });
  1503 |     const designer = await actor(browser, fixture.tokens.designerA);
  1504 |     const denied = await designer.context.request.post(`/v1/projects/${fixture.projectId}/sessions`, {
  1505 |       data: { releaseId: publishedReleaseId }
  1506 |     });
  1507 |     expect(denied.status()).toBe(403);
  1508 |     expect((await denied.json()).error.code).toBe("PERMISSION_DENIED");
  1509 |     await Promise.all([operator.context.close(), designer.context.close()]);
  1510 |   });
  1511 | 
  1512 |   test("PS-310 AC-01 keeps Stage IDs stable while a reorder converges", async ({ browser }) => {
  1513 |     test.setTimeout(60_000);
  1514 |     const first = await actor(browser, fixture.tokens.publisher);
  1515 |     const second = await actor(browser, fixture.tokens.designerA);
  1516 |     await Promise.all([first.page.goto(studioUrl()), second.page.goto(studioUrl())]);
  1517 |     await Promise.all([
  1518 |       expect(first.page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 20_000 }),
  1519 |       expect(second.page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 20_000 })
  1520 |     ]);
  1521 |     const stages = await openStudioWorkspace(first.page, "Stages");
  1522 |     const stageCards = stages.locator("details[id^='stages-']");
  1523 |     await expect(stageCards).toHaveCount(16, { timeout: 20_000 });
  1524 |     const stageIdsBefore = await stageCards.evaluateAll((items) => items.map(({ id }) => id));
  1525 |     await stageCards.nth(1).locator("summary").click();
  1526 |     await stageCards.nth(1).getByRole("button", { name: "Earlier" }).click();
  1527 |     const expectedStageIds = [stageIdsBefore[1], stageIdsBefore[0], ...stageIdsBefore.slice(2)];
  1528 |     await expect.poll(() => stageCards.evaluateAll((items) => items.map(({ id }) => id))).toEqual(expectedStageIds);
  1529 |     await expect(first.page.getByText("Saved on this device", { exact: true })).toBeVisible();
  1530 |     await expect(first.page.getByText("Synchronized", { exact: true })).toBeVisible({ timeout: 20_000 });
  1531 |     const secondStages = await openStudioWorkspace(second.page, "Stages");
  1532 |     const secondStageCards = secondStages.locator("details[id^='stages-']");
  1533 |     await expect.poll(() => secondStageCards.evaluateAll((items) => items.map(({ id }) => id)), { timeout: 20_000 }).toEqual(expectedStageIds);
  1534 |     await Promise.all([first.context.close(), second.context.close()]);
  1535 |   });
  1536 | 
  1537 |   test("@a11y EXT-12 EXT-13 EXT-14 builds and previews a two-model composition without code", async ({ browser }) => {
  1538 |     test.setTimeout(180_000);
  1539 |     const designer = await actor(browser, fixture.tokens.publisher, { viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  1540 |     await designer.page.goto(studioUrl());
  1541 |     await expect(designer.page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 20_000 });
  1542 |     const plugins = await openStudioWorkspace(designer.page, "Plugin catalog & bindings");
  1543 |     await expect(plugins.getByText("2 approved installed Plugins available.")).toBeVisible({ timeout: 20_000 });
  1544 |     const catalogCards = plugins.locator(".catalog-card");
  1545 |     await expect(catalogCards).toHaveCount(2);
  1546 |     await catalogCards.nth(0).getByRole("button", { name: "Bind installed Plugin" }).click();
  1547 |     await catalogCards.nth(1).getByRole("button", { name: "Bind installed Plugin" }).click();
  1548 |     const effectBinding = plugins.locator("details").filter({ hasText: "org.ssg.fixtures.effect 1.0.0" });
  1549 |     await effectBinding.locator("summary").click();
  1550 |     await effectBinding.getByRole("button", { name: "Add input port" }).click();
  1551 |     await expect(effectBinding.getByRole("group", { name: "Input ports" }).getByLabel("Port label")).toHaveValue("Input 1");
  1552 |     await expect(designer.page.getByText("Synchronized", { exact: true })).toBeVisible({ timeout: 40_000 });
  1553 | 
  1554 |     const compositions = await openStudioWorkspace(designer.page, "Model Compositions");
  1555 |     await compositions.getByRole("button", { name: "Add Model Composition" }).click();
```