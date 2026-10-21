import { mkdir } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { fixture, operatorUrl, runtimeUrl, studioUrl } from "./fixture.mjs";

const evidenceRoot = "output/playwright/ps-150";
const headers = (token) => ({ Authorization: `Bearer ${token}` });

async function actor(browser, token, options = {}) {
  const context = await browser.newContext({ ...options, extraHTTPHeaders: headers(token) });
  return { context, page: await context.newPage() };
}

async function fillBlueOrientation(page, description) {
  const create = page.getByRole("region", { name: "Blue Strategic Orientation" });
  await create.getByLabel("Blue strategic orientation").selectOption("stabilization");
  await create.getByLabel("Forecast Red orientation").selectOption("pressure");
  await create.getByLabel("What will Red do first?").fill(description);
  return create;
}

async function createDraft(page, description) {
  const create = await fillBlueOrientation(page, description);
  await create.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("The server accepted the Command.")).toBeVisible();
}

async function fillBlueAction(page, title) {
  const create = page.getByRole("region", { name: "Blue Action" });
  await create.getByLabel("Action title").fill(title);
  await create.getByLabel("Goal").fill("Protect allied capacity and continuity");
  await create.getByLabel("Objective").fill("Reduce strategic dependency this move");
  await create.getByLabel("Instruments").selectOption(["economic"]);
  await create.getByLabel("Policy levers").selectOption(["industrial_policy"]);
  await create.getByLabel("Focus sectors").selectOption(["agriculture"]);
  await create.getByLabel("Supply-chain focus?").selectOption("no");
  await create.getByLabel("Implementation path").selectOption("executive_order");
  await create.getByLabel("Focus countries").fill("Allied partner economies");
  await create.getByLabel("Coordinated action?").selectOption("no");
  await create.getByLabel("Who was informed or engaged?").selectOption(["allies"]);
  await create.getByLabel("Expected outcomes").fill("More resilient supply and credible coordination");
  return create;
}

async function createBlueActionDraft(page, title) {
  const create = await fillBlueAction(page, title);
  await create.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("The server accepted the Command.")).toBeVisible();
}

test.describe.serial("PS-150 configured Runtime shell", () => {
  test.beforeAll(async () => mkdir(evidenceRoot, { recursive: true }));

  test("@a11y AC-04 REQ-064 renders a keyboard and screen-reader operable empty workspace", async ({ browser }) => {
    const { context, page } = await actor(browser, fixture.tokens.author, { viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
    await page.goto(runtimeUrl());
    await expect(page.getByRole("heading", { level: 1, name: "Blue Scribe workspace" })).toBeVisible();
    await expect(page.getByText("No Artifacts have been created yet.")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({ path: `${evidenceRoot}/runtime-desktop.png`, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("What will Red do first?").fill("A long representative forecast ".repeat(18));
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `${evidenceRoot}/runtime-390px.png`, fullPage: true });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `${evidenceRoot}/runtime-200-percent-text.png`, fullPage: true });
    await context.close();
  });

  test("@a11y VOTE-01 VOTE-15 casts and certifies an accessible authoritative Poll", async ({ browser }) => {
    test.setTimeout(90_000);
    const control = await actor(browser, fixture.tokens.finalReviewer, { viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
    const participant = await actor(browser, fixture.tokens.author, { viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
    const controlDevice = (await (await control.context.request.post("/v1/devices", { data: {} })).json()).deviceId;
    const participantDevice = (await (await participant.context.request.post("/v1/devices", { data: {} })).json()).deviceId;
    const projection = async (current, deviceId) => (await current.context.request.get(
      `/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": deviceId } }
    )).json();
    const controlProjection = await projection(control, controlDevice);
    const opened = await control.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId: controlDevice, operationType: "poll.open", aggregateId: fixture.pollId,
      expectedAggregateVersion: 0, governingReleaseId: controlProjection.releaseId,
      activeSessionRoleId: controlProjection.activeSessionRoleId,
      payload: { definitionId: "synthetic-resolution", definitionRevision: 1 }
    } });
    expect(opened.status()).toBe(200);

    await participant.page.goto(runtimeUrl());
    const poll = participant.page.getByRole("article", { name: "Adopt the synthetic accessibility resolution?" });
    await expect(poll).toBeVisible();
    await poll.getByLabel("Yes").check();
    await poll.getByRole("button", { name: "Cast Ballot" }).click();
    await expect(poll.getByText(/Ballot accepted at/u)).toBeVisible();
    expect((await new AxeBuilder({ page: participant.page }).analyze()).violations).toEqual([]);

    await control.page.goto(runtimeUrl());
    const managed = control.page.getByRole("article", { name: "Adopt the synthetic accessibility resolution?" });
    await expect(managed.getByRole("button", { name: "Close Poll" })).toBeVisible();
    await control.context.setOffline(true);
    await managed.getByRole("button", { name: "Close Poll" }).click();
    await expect(control.page.getByText("Poll management requires the live Session Authority and was not queued.")).toBeVisible();
    await expect(managed.getByText("open", { exact: true })).toBeVisible();
    await control.context.setOffline(false);
    await managed.getByRole("button", { name: "Close Poll" }).click();
    await expect(managed.getByRole("button", { name: "Compute Tally" })).toBeVisible();
    await managed.getByRole("button", { name: "Compute Tally" }).click();
    await expect(managed.getByRole("button", { name: "Certify result" })).toBeVisible();
    await managed.getByRole("button", { name: "Certify result" }).click();
    await expect(managed.getByRole("heading", { name: "Certified result" })).toBeVisible();
    await expect(managed.getByText(/Quorum met.*Passed/u)).toBeVisible();
    expect((await new AxeBuilder({ page: control.page }).analyze()).violations).toEqual([]);
    await Promise.all([control.context.close(), participant.context.close()]);
  });

  test("@a11y EXT-06/18 reviews an Effect Proposal and never queues approval offline", async ({ browser }) => {
    const { context, page } = await actor(browser, fixture.tokens.finalReviewer, { viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
    await page.goto(runtimeUrl());
    const proposal = page.getByRole("article", { name: "synthetic risk" });
    await expect(proposal).toBeVisible();
    await expect(proposal.getByText("in review")).toBeVisible();
    await proposal.getByLabel("Decision reason").fill("Reviewed against current authoritative state");
    await context.setOffline(true);
    await proposal.getByRole("button", { name: "Approve effect" }).click();
    await expect(page.getByText("Approval Decisions require a live Session Authority and were not queued.")).toBeVisible();
    await expect(proposal.getByText("in review")).toBeVisible();
    await context.setOffline(false);
    await proposal.getByRole("button", { name: "Approve effect" }).click();
    await expect(page.getByText("The server accepted the Command.")).toBeVisible();
    await expect(proposal.getByText("applied")).toBeVisible({ timeout: 20_000 });
    await expect(proposal.getByRole("button", { name: "Approve effect" })).toHaveCount(0);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    await context.close();
  });

  test("@a11y VOICE-06/07/11 uses local media with keyboard controls and non-audio instructions", async ({ browser }) => {
    test.skip(process.env.MEDIA_TEST_URL === undefined, "A local SFU is required for the real media proof");
    test.setTimeout(60_000);
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce",
      permissions: ["microphone"] });
    await context.route("http://127.0.0.1:4173/v1/**", async (route) => route.continue({ headers: {
      ...route.request().headers(), Authorization: `Bearer ${fixture.tokens.author}`
    } }));
    const page = await context.newPage();
    await page.goto(runtimeUrl());
    await expect(page.getByRole("heading", { name: "Voice Channels" })).toBeVisible();
    await expect(page.getByText(/Push-to-talk: hold Space, Enter, or the Floor button/u)).toBeVisible();
    const openRoom = page.getByRole("article", { name: "Team open room" });
    const joinOpen = openRoom.getByRole("button", { name: "Join voice" });
    await joinOpen.focus(); await page.keyboard.press("Enter");
    await expect(page.getByText("Joined Team open room. Microphone is ready but muted.")).toBeVisible({ timeout: 15_000 });
    const listenerContext = await browser.newContext({ permissions: ["microphone"] });
    await listenerContext.route("http://127.0.0.1:4173/v1/**", async (route) => route.continue({ headers: {
      ...route.request().headers(), Authorization: `Bearer ${fixture.tokens.reviewer}`
    } }));
    const listener = await listenerContext.newPage();
    await listener.goto(runtimeUrl());
    const listenerRoom = listener.getByRole("article", { name: "Team open room" });
    await listenerRoom.getByRole("button", { name: "Join voice" }).click();
    await expect(listener.getByText("Joined Team open room. Microphone is ready but muted.")).toBeVisible({ timeout: 15_000 });
    const microphone = openRoom.getByRole("button", { name: "Enable microphone" });
    await microphone.focus(); await page.keyboard.press("Enter");
    await expect(openRoom.getByText("transmitting", { exact: true })).toBeVisible();
    await expect(listenerRoom.getByText("Receiving 1 remote audio stream.", { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Enter");
    await expect(openRoom.getByText("ready", { exact: true })).toBeVisible();
    await listenerRoom.getByRole("button", { name: "Leave voice" }).click();
    await listenerContext.close();
    await openRoom.getByRole("button", { name: "Leave voice" }).click();

    const radio = page.getByRole("article", { name: "All-hands radio" });
    await radio.getByRole("button", { name: "Join voice" }).focus(); await page.keyboard.press("Enter");
    await expect(page.getByText("Joined All-hands radio. Microphone is ready but muted.")).toBeVisible({ timeout: 15_000 });
    const floor = radio.getByRole("button", { name: /Hold to talk/u });
    await floor.focus(); await page.keyboard.down("Space");
    await expect(radio.getByText("transmitting", { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.keyboard.up("Space");
    await expect(radio.getByText("ready", { exact: true })).toBeVisible({ timeout: 10_000 });
    await radio.getByRole("button", { name: "Leave voice" }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `${evidenceRoot}/voice-keyboard-local-media.png`, fullPage: true });

    await context.setOffline(true);
    await expect(radio.getByRole("button", { name: "Join voice" })).toBeDisabled();
    await expect(page.getByText("Offline", { exact: true })).toBeVisible();
    await context.close();
  });

  test("@a11y VOICE-13/14 captures and withdraws participant-scoped transcription consent", async ({ browser }) => {
    const participant = await actor(browser, fixture.tokens.author, { reducedMotion: "reduce" });
    const moderator = await actor(browser, fixture.tokens.finalReviewer, { reducedMotion: "reduce" });
    const join = async (current) => {
      const deviceId = (await (await current.context.request.post("/v1/devices", { data: {} })).json()).deviceId;
      const projection = await (await current.context.request.get(
        `/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": deviceId } }
      )).json();
      const channel = projection.voiceChannels.find(({ id }) => id === fixture.voiceChannels.openRoom);
      const response = await current.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
        commandId: crypto.randomUUID(), deviceId, operationType: "voice_channel.join", aggregateId: channel.id,
        expectedAggregateVersion: channel.version, governingReleaseId: channel.governingReleaseId,
        activeSessionRoleId: projection.activeSessionRoleId, payload: {}
      } });
      expect(response.status()).toBe(200);
    };
    await Promise.all([join(participant), join(moderator)]);
    await Promise.all([participant.page.goto(runtimeUrl()), moderator.page.goto(runtimeUrl())]);
    const participantChannel = participant.page.getByRole("article", { name: "Team open room" });
    const moderatorChannel = moderator.page.getByRole("article", { name: "Team open room" });
    const participantTranscription = participantChannel.locator(".voice-privacy > div").filter({ hasText: "Transcription" });
    const moderatorTranscription = moderatorChannel.locator(".voice-privacy > div").filter({ hasText: "Transcription" });
    await expect(participantTranscription).toContainText("Policy: with consent · Your consent: not given");
    await participantTranscription.getByRole("button", { name: "Give transcription consent" }).click();
    await expect(participantTranscription).toContainText("Your consent: given");
    await moderatorTranscription.getByRole("button", { name: "Give transcription consent" }).click();
    await moderatorTranscription.getByRole("button", { name: "Start transcription" }).click();
    await expect(moderatorTranscription).toContainText("Active · Policy: with consent");
    await participant.page.getByRole("button", { name: "Refresh authoritative state" }).click();
    await expect(participantTranscription).toContainText("Active · Policy: with consent");
    await participantTranscription.getByRole("button", { name: "Withdraw transcription consent" }).click();
    await expect(participantTranscription).toContainText("Stopped · Policy: with consent · Your consent: withdrawn");
    expect((await new AxeBuilder({ page: participant.page }).analyze()).violations).toEqual([]);
    await Promise.all([participant.context.close(), moderator.context.close()]);
  });

  test("AC-03/05/06/12/13 completes DEC-42 and denies forbidden or unauthorized paths", async ({ browser }) => {
    test.setTimeout(60_000);
    const author = await actor(browser, fixture.tokens.author);
    await author.page.goto(runtimeUrl());
    await createDraft(author.page, "Approve the first configured handoff");
    const authored = author.page.locator("article.artifact").first();
    await expect(authored.getByText("Draft", { exact: true })).toBeVisible();
    await authored.getByRole("button", { name: "Submit to Team Facilitator" }).click();
    await expect(author.page.getByLabel("Connection status: Connected")).toBeVisible({ timeout: 15_000 });
    await expect(authored.getByText("With Team Facilitator", { exact: true })).toBeVisible();
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
      activeSessionRoleId: authorProjection.activeSessionRoleId, payload: { content: { ownOrientation: "pressure" } }
    } });
    expect(forbidden.status()).toBe(409);
    expect((await forbidden.json()).errorCode).toBe("INVALID_TRANSITION");
    const unauthorizedOperator = await authorApi.get(`/v1/operator/sessions/${fixture.sessionId}`);
    expect(unauthorizedOperator.status()).toBe(403);
    const forbiddenStage = await authorApi.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId, operationType: "stage.start", aggregateId: fixture.sessionId,
      expectedAggregateVersion: 0, governingReleaseId: authorProjection.releaseId,
      activeSessionRoleId: authorProjection.activeSessionRoleId, payload: { reason: "Unauthorized control attempt" }
    } });
    expect(forbiddenStage.status()).toBe(409);
    expect((await forbiddenStage.json()).errorCode).toBe("PERMISSION_DENIED");

    const red = await actor(browser, fixture.tokens.redAuthor);
    const redDeviceResponse = await red.context.request.post("/v1/devices", { data: {} });
    const { deviceId: redDeviceId } = await redDeviceResponse.json();
    const redProjection = await (await red.context.request.get(
      `/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": redDeviceId } }
    )).json();
    expect(redProjection.artifacts).toHaveLength(0);
    expect(redProjection.createTasks.map(({ artifactTypeKey }) => artifactTypeKey)).toContain("red_strategic_orientation");
    expect(redProjection.createTasks.map(({ artifactTypeKey }) => artifactTypeKey)).not.toContain("blue_strategic_orientation");
    const crossTeam = await red.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId: redDeviceId, operationType: "artifact.submit", aggregateId: submitted.id,
      expectedAggregateVersion: submitted.version, governingReleaseId: submitted.governingReleaseId,
      activeSessionRoleId: redProjection.activeSessionRoleId, payload: {}
    } });
    expect(crossTeam.status()).toBe(409);
    expect((await crossTeam.json()).errorCode).toBe("TARGET_NOT_FOUND");

    const reviewer = await actor(browser, fixture.tokens.reviewer);
    await reviewer.page.goto(runtimeUrl());
    await reviewer.page.getByRole("button", { name: "Forward to White Cell" }).click();
    await expect(reviewer.page.getByLabel("Connection status: Connected")).toBeVisible({ timeout: 15_000 });
    await expect(reviewer.page.getByText("With White Cell", { exact: true })).toBeVisible();

    const finalReviewer = await actor(browser, fixture.tokens.finalReviewer);
    await finalReviewer.page.goto(runtimeUrl());
    await finalReviewer.page.getByRole("button", { name: "Accept" }).click();
    await expect(finalReviewer.page.getByLabel("Connection status: Connected")).toBeVisible({ timeout: 15_000 });
    await expect(finalReviewer.page.getByText("Completed", { exact: true })).toBeVisible();
    const controlDeviceResponse = await finalReviewer.context.request.post("/v1/devices", { data: {} });
    const { deviceId: controlDeviceId } = await controlDeviceResponse.json();
    const controlProjection = await (await finalReviewer.context.request.get(
      `/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": controlDeviceId } }
    )).json();
    const started = await finalReviewer.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId: controlDeviceId, operationType: "stage.start", aggregateId: fixture.sessionId,
      expectedAggregateVersion: 0, governingReleaseId: controlProjection.releaseId,
      activeSessionRoleId: controlProjection.activeSessionRoleId, payload: { reason: "Begin the exercise" }
    } });
    expect(started.status()).toBe(200);
    const controlAfterStart = await (await finalReviewer.context.request.get(
      `/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": controlDeviceId } }
    )).json();
    expect(controlAfterStart.injects).toHaveLength(1);
    expect(controlAfterStart.injects[0]).toMatchObject({ definitionId: "opening-briefing", state: "released" });
    const broadcastId = crypto.randomUUID();
    const broadcast = await finalReviewer.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId: controlDeviceId, operationType: "message.send", aggregateId: broadcastId,
      expectedAggregateVersion: 0, governingReleaseId: controlProjection.releaseId,
      activeSessionRoleId: controlProjection.activeSessionRoleId,
      payload: { routeId: "control-broadcast", content: { text: "Move one is open." } }
    } });
    expect(broadcast.status()).toBe(200);
    const authorAfterBroadcast = await (await authorApi.get(
      `/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": deviceId } }
    )).json();
    expect(authorAfterBroadcast.injects).toHaveLength(1);
    expect(authorAfterBroadcast.messages).toContainEqual(expect.objectContaining({
      id: broadcastId,
      channelId: "broadcast",
      deliveryState: "released",
      content: { text: "Move one is open." }
    }));
    const forbiddenBroadcast = await authorApi.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId, operationType: "message.send", aggregateId: crypto.randomUUID(),
      expectedAggregateVersion: 0, governingReleaseId: authorProjection.releaseId,
      activeSessionRoleId: authorProjection.activeSessionRoleId,
      payload: { routeId: "control-broadcast", content: { text: "Unauthorized" } }
    } });
    expect(forbiddenBroadcast.status()).toBe(409);
    expect((await forbiddenBroadcast.json()).errorCode).toBe("PERMISSION_DENIED");
    const acknowledged = await authorApi.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId, operationType: "inject.acknowledge",
      aggregateId: authorAfterBroadcast.injects[0].id, expectedAggregateVersion: 1,
      governingReleaseId: authorProjection.releaseId, activeSessionRoleId: authorProjection.activeSessionRoleId, payload: {}
    } });
    expect(acknowledged.status()).toBe(200);
    const authorAfterAcknowledgement = await (await authorApi.get(
      `/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": deviceId } }
    )).json();
    expect(authorAfterAcknowledgement.injects[0]).toMatchObject({ acknowledgedAt: expect.any(String), respondedAt: null });
    const advanced = await finalReviewer.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId: controlDeviceId, operationType: "stage.advance", aggregateId: fixture.sessionId,
      expectedAggregateVersion: 1, governingReleaseId: controlProjection.releaseId,
      activeSessionRoleId: controlProjection.activeSessionRoleId,
      payload: { reason: "Orientation complete", targetStageId: "m1-deliberation" }
    } });
    expect(advanced.status()).toBe(200);

    const operator = await actor(browser, fixture.tokens.operator);
    const operatorProjection = await operator.context.request.get(`/v1/operator/sessions/${fixture.sessionId}`);
    expect(operatorProjection.status()).toBe(200);
    const operatorDeviceResponse = await operator.context.request.post("/v1/devices", { data: {} });
    const { deviceId: operatorDeviceId } = await operatorDeviceResponse.json();
    const participantProjection = await operator.context.request.get(
      `/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": operatorDeviceId } }
    );
    expect(participantProjection.status()).toBe(403);
    expect((await participantProjection.json()).error.code).toBe("NOT_A_PARTICIPANT");
    await operator.page.goto(operatorUrl());
    await expect(operator.page.getByRole("heading", { level: 1, name: "Session control view" })).toBeVisible();
    await expect(operator.page.locator(".status-list li").filter({ hasText: "completed" })).toContainText("1");
    await expect(operator.page.getByText("artifact.accepted", { exact: true })).toBeVisible();
    await operator.page.screenshot({ path: `${evidenceRoot}/operator-accepted.png`, fullPage: true });
    await Promise.all([author.context.close(), reviewer.context.close(), red.context.close(), finalReviewer.context.close(), operator.context.close()]);
  });

  test("AC-08/10 keeps stale and lost-acknowledgement states truthful", async ({ browser }) => {
    const author = await actor(browser, fixture.tokens.author);
    await author.page.goto(runtimeUrl());
    await createBlueActionDraft(author.page, "Stale version proof");

    const deviceResponse = await author.context.request.post("/v1/devices", { data: {} });
    const { deviceId } = await deviceResponse.json();
    const projectionResponse = await author.context.request.get(`/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": deviceId } });
    const projection = await projectionResponse.json();
    const staleArtifact = projection.artifacts.at(-1);
    const changed = await author.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId, operationType: "artifact.edit", aggregateId: staleArtifact.id,
      expectedAggregateVersion: staleArtifact.version, governingReleaseId: staleArtifact.governingReleaseId,
      activeSessionRoleId: projection.activeSessionRoleId, payload: { content: {
        title: "Changed on another connection", goal: "Protect allied capacity and continuity",
        objective: "Reduce strategic dependency this move", instruments: ["economic"], levers: ["industrial_policy"],
        sectors: ["agriculture"], supplyChainFocusDecision: "no", implementationPath: "executive_order",
        focusCountries: "Allied partner economies", coordinatedDecision: "no", informedEngagedDecision: ["allies"],
        expectedOutcomes: "More resilient supply and credible coordination"
      } }
    } });
    expect(changed.status()).toBe(200);
    const staleCard = author.page.locator("article.artifact").last();
    await staleCard.getByRole("button", { name: "Submit to Team Facilitator" }).click();
    await expect(author.page.getByText(/Authoritative state changed: The Artifact is at version 2/)).toBeVisible();

    let intercepted = false;
    await author.page.route("**/v1/sessions/*/commands", async (route) => {
      if (intercepted) return route.continue();
      intercepted = true;
      const response = await route.fetch();
      await response.body();
      await route.abort("failed");
    });
    const create = await fillBlueAction(author.page, "Lost acknowledgement proof");
    await create.getByRole("button", { name: "Save draft" }).click();
    await expect(author.page.getByText("Delivery acknowledgement was lost. This Command is still local pending, not accepted.")).toBeVisible();
    await author.page.unroute("**/v1/sessions/*/commands");
    await author.page.getByRole("button", { name: "Check receipt and retry" }).click();
    await expect(author.page.getByText("The original server receipt was recovered.")).toBeVisible();
    await expect(author.page.locator('input[value="Lost acknowledgement proof"]').first()).toBeVisible();
    await author.context.close();
  });

  test("PS-210-RFI-E2E PARITY-RFI-01 closes lifecycle parity including stale-answer and cross-team denial", async ({ browser }) => {
    const facilitator = await actor(browser, fixture.tokens.reviewer);
    const control = await actor(browser, fixture.tokens.finalReviewer);
    const otherTeam = await actor(browser, fixture.tokens.redReviewer);
    const actors = [facilitator, control, otherTeam];
    const devices = [];
    const projections = [];
    for (const current of actors) {
      const device = await current.context.request.post("/v1/devices", { data: {} });
      devices.push((await device.json()).deviceId);
      projections.push(await (await current.context.request.get(
        `/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": devices.at(-1) } }
      )).json());
    }
    const submit = (current, actorIndex, operationType, aggregateId, expectedAggregateVersion, payload) =>
      current.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
        commandId: crypto.randomUUID(), deviceId: devices[actorIndex], operationType, aggregateId,
        expectedAggregateVersion, governingReleaseId: projections[actorIndex].releaseId,
        activeSessionRoleId: projections[actorIndex].activeSessionRoleId, payload
      } });

    const rfiId = crypto.randomUUID();
    const original = {
      question: "When will the allied supply review begin?",
      context: "The team needs a dated planning assumption.",
      categories: ["Implementation Timeline"]
    };
    const created = await submit(facilitator, 0, "artifact.create", rfiId, 0,
      { artifactTypeKey: "rfi", content: original });
    expect(created.status()).toBe(200);
    expect(await created.json()).toMatchObject({ status: "accepted", aggregateVersion: 1, evidenceSequence: expect.any(Number) });

    const returned = await submit(control, 1, "artifact.return", rfiId, 1, {});
    expect(returned.status()).toBe(200);
    expect(await returned.json()).toMatchObject({ status: "accepted", aggregateVersion: 2, evidenceSequence: expect.any(Number) });

    const clarified = { ...original, question: "Will the allied supply review begin before the six-month checkpoint?" };
    const crossTeam = await submit(otherTeam, 2, "artifact.edit", rfiId, 2, { content: clarified });
    expect(crossTeam.status()).toBe(409);
    expect(await crossTeam.json()).toMatchObject({ status: "rejected", errorCode: "TARGET_NOT_FOUND" });

    const edited = await submit(facilitator, 0, "artifact.edit", rfiId, 2, { content: clarified });
    expect(edited.status()).toBe(200);
    expect(await edited.json()).toMatchObject({ status: "accepted", aggregateVersion: 3 });
    const resubmitted = await submit(facilitator, 0, "artifact.submit", rfiId, 3, {});
    expect(resubmitted.status()).toBe(200);
    expect(await resubmitted.json()).toMatchObject({ status: "accepted", aggregateVersion: 4 });

    const answer = { content: { response: "Yes. It begins before the six-month checkpoint." } };
    const [firstAnswer, staleAnswer] = await Promise.all([
      submit(control, 1, "artifact.accept", rfiId, 4, answer),
      submit(control, 1, "artifact.accept", rfiId, 4, answer)
    ]).then((responses) => responses.sort((left, right) => left.status() - right.status()));
    expect(firstAnswer.status()).toBe(200);
    expect(await firstAnswer.json()).toMatchObject({ status: "accepted", aggregateVersion: 5, evidenceSequence: expect.any(Number) });
    expect(staleAnswer.status()).toBe(409);
    expect(await staleAnswer.json()).toMatchObject({ status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION" });

    const finalProjection = await (await facilitator.context.request.get(
      `/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": devices[0] } }
    )).json();
    expect(finalProjection.artifacts).toContainEqual(expect.objectContaining({
      id: rfiId, artifactTypeKey: "rfi", state: "answered", version: 5,
      payload: expect.objectContaining({ question: clarified.question, response: answer.content.response })
    }));
    await Promise.all(actors.map(({ context }) => context.close()));
  });

  test("PS-210-COMMS-E2E PARITY-COMMS-01 closes reconnect and delivery-deduplication parity", async ({ browser }) => {
    const facilitator = await actor(browser, fixture.tokens.reviewer);
    const control = await actor(browser, fixture.tokens.finalReviewer);
    const participant = await actor(browser, fixture.tokens.author);
    const actors = [facilitator, control, participant];
    const devices = [];
    const projections = [];
    for (const current of actors) {
      const device = await current.context.request.post("/v1/devices", { data: {} });
      devices.push((await device.json()).deviceId);
      projections.push(await (await current.context.request.get(
        `/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": devices.at(-1) } }
      )).json());
    }
    const command = (actorIndex, operationType, aggregateId, payload) => ({
      commandId: crypto.randomUUID(), deviceId: devices[actorIndex], operationType, aggregateId,
      expectedAggregateVersion: 0, governingReleaseId: projections[actorIndex].releaseId,
      activeSessionRoleId: projections[actorIndex].activeSessionRoleId, payload
    });

    const rfiId = crypto.randomUUID();
    const created = await facilitator.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data:
      command(0, "artifact.create", rfiId, { artifactTypeKey: "rfi", content: {
        question: "Can Control confirm the communications checkpoint?", categories: ["Other"]
      } }) });
    expect(created.status()).toBe(200);

    const directId = crypto.randomUUID();
    const directCommand = command(0, "message.send", directId, {
      routeId: "team-to-control", artifactId: rfiId, content: { text: "Direct RFI coordination message." }
    });
    const direct = await facilitator.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: directCommand });
    expect(direct.status()).toBe(200);
    expect(await direct.json()).toMatchObject({ status: "accepted", replayed: false, aggregateVersion: 1 });
    const replay = await facilitator.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: directCommand });
    expect(replay.status()).toBe(200);
    expect(await replay.json()).toMatchObject({ status: "accepted", replayed: true, aggregateVersion: 1 });

    const forbidden = await participant.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data:
      command(2, "message.send", crypto.randomUUID(), {
        routeId: "team-to-control", artifactId: rfiId, content: { text: "Forbidden route attempt." }
      }) });
    expect(forbidden.status()).toBe(409);
    expect(await forbidden.json()).toMatchObject({ status: "rejected", errorCode: "PERMISSION_DENIED" });

    const broadcastId = crypto.randomUUID();
    const broadcast = await control.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data:
      command(1, "message.send", broadcastId, {
        routeId: "control-broadcast", content: { text: "Reconnect parity broadcast." }
      }) });
    expect(broadcast.status()).toBe(200);

    const controlProjection = await (await control.context.request.get(
      `/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": devices[1] } }
    )).json();
    expect(controlProjection.messages.filter(({ id }) => id === directId)).toEqual([
      expect.objectContaining({ channelId: "rfi", routeId: "team-to-control", deliveryState: "released" })
    ]);
    const participantProjection = await (await participant.context.request.get(
      `/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": devices[2] } }
    )).json();
    expect(participantProjection.messages.filter(({ id }) => id === broadcastId)).toEqual([
      expect.objectContaining({ channelId: "broadcast", routeId: "control-broadcast", deliveryState: "released" })
    ]);

    await control.page.goto(runtimeUrl());
    await expect(control.page.getByText("Direct RFI coordination message.", { exact: true })).toHaveCount(1);
    await control.page.reload();
    await expect(control.page.getByText("Direct RFI coordination message.", { exact: true })).toHaveCount(1);
    await expect(control.page.locator(".live-region")).toBeEmpty();

    await participant.page.goto(runtimeUrl());
    await expect(participant.page.getByText("Reconnect parity broadcast.", { exact: true })).toHaveCount(1);
    await participant.context.setOffline(true);
    await expect(participant.page.getByLabel("Connection status: Offline")).toBeVisible();
    await participant.context.setOffline(false);
    await expect(participant.page.getByLabel("Connection status: Connected")).toBeVisible({ timeout: 15_000 });
    await expect(participant.page.getByText("Reconnect parity broadcast.", { exact: true })).toHaveCount(1);
    await expect(participant.page.locator(".live-region")).toHaveText("Connection restored. Refreshing authoritative state.");
    await Promise.all(actors.map(({ context }) => context.close()));
  });

  test("@a11y PS-210 completes isolated multi-round proposal negotiation and two-sided closure", async ({ browser }) => {
    test.setTimeout(90_000);
    const control = await actor(browser, fixture.tokens.finalReviewer);
    const source = await actor(browser, fixture.tokens.greenReviewer);
    const recipient = await actor(browser, fixture.tokens.redReviewer);
    const outsider = await actor(browser, fixture.tokens.reviewer);
    const actionAuthor = await actor(browser, fixture.tokens.redAuthor);
    const contexts = [control, source, recipient, outsider, actionAuthor];
    const devices = {};
    for (const [index, current] of contexts.entries()) {
      const response = await current.context.request.post("/v1/devices", { data: {} });
      devices[index] = (await response.json()).deviceId;
    }
    const projection = async (current, deviceId) => (await current.context.request.get(
      `/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": deviceId } }
    )).json();
    const controlProjection = await projection(control, devices[0]);
    if (controlProjection.currentStageStatus === "not_started") {
      const started = await control.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
        commandId: crypto.randomUUID(), deviceId: devices[0], operationType: "stage.start", aggregateId: fixture.sessionId,
        expectedAggregateVersion: 0, governingReleaseId: controlProjection.releaseId,
        activeSessionRoleId: controlProjection.activeSessionRoleId, payload: { reason: "Prepare isolated proposal test" }
      } });
      expect(started.status()).toBe(200);
      const advanced = await control.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
        commandId: crypto.randomUUID(), deviceId: devices[0], operationType: "stage.advance", aggregateId: fixture.sessionId,
        expectedAggregateVersion: 1, governingReleaseId: controlProjection.releaseId,
        activeSessionRoleId: controlProjection.activeSessionRoleId,
        payload: { reason: "Open move-one Artifact availability", targetStageId: "m1-deliberation" }
      } });
      expect(advanced.status()).toBe(200);
    }
    await control.page.goto(runtimeUrl());
    await expect(control.page.getByRole("heading", { name: "Proposal custody" })).toBeVisible();
    await expect(control.page.getByRole("heading", { name: "Messages" })).toBeVisible();
    await expect(control.page.getByRole("heading", { name: "Injects" })).toBeVisible();
    await source.page.goto(runtimeUrl());
    await expect(source.page.getByRole("heading", { name: "Proposal negotiations" })).toBeVisible();
    for (const page of [control.page, source.page]) {
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }

    const sendProposal = async (current, deviceId, activeSessionRoleId, operationType, expectedAggregateVersion, content = {}) => {
      const commandId = crypto.randomUUID();
      const response = await current.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
        commandId, deviceId, operationType, aggregateId: threadId, expectedAggregateVersion,
        governingReleaseId: controlProjection.releaseId, activeSessionRoleId, payload: { content }
      } });
      expect(response.status()).toBe(200);
      return commandId;
    };
    const approve = async (messageId, expectedAggregateVersion) => {
      const response = await control.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
        commandId: crypto.randomUUID(), deviceId: devices[0], operationType: "message.proposal_approve_round",
        aggregateId: threadId, expectedAggregateVersion, governingReleaseId: controlProjection.releaseId,
        activeSessionRoleId: controlProjection.activeSessionRoleId, payload: { messageId }
      } });
      expect(response.status()).toBe(200);
    };
    const threadId = crypto.randomUUID();
    const opened = await control.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId: devices[0], operationType: "message.proposal_forward",
      aggregateId: threadId, expectedAggregateVersion: 0, governingReleaseId: controlProjection.releaseId,
      activeSessionRoleId: controlProjection.activeSessionRoleId,
      payload: { sourceArtifactId: fixture.proposalArtifactId, recipientTeamId: "red" }
    } });
    expect(opened.status()).toBe(200);
    await recipient.page.goto(runtimeUrl());
    await expect(recipient.page.getByRole("heading", { name: "Proposal negotiations" })).toBeVisible();
    expect((await new AxeBuilder({ page: recipient.page }).analyze()).violations).toEqual([]);
    expect((await projection(source, devices[1])).messages).toContainEqual(expect.objectContaining({
      threadId, operationType: "message.proposal_forward", routeId: "proposal-control-to-recipient",
      approvalRouteId: "proposal-control-to-recipient", approvedAt: expect.any(String), threadVersion: 1
    }));
    expect((await projection(outsider, devices[3])).messages.filter((message) => message.threadId === threadId)).toHaveLength(0);

    const recipientProjection = await projection(recipient, devices[2]);
    const sourceProjection = await projection(source, devices[1]);
    const negotiationId = await sendProposal(recipient, devices[2], recipientProjection.activeSessionRoleId,
      "message.proposal_negotiate", 1, { text: "We need reciprocal supply access." });
    expect((await projection(source, devices[1])).messages.filter(({ id }) => id === negotiationId)).toHaveLength(0);
    expect((await projection(control, devices[0])).messages).toContainEqual(expect.objectContaining({
      id: negotiationId, routeId: "proposal-recipient-to-control", approvalRouteId: null,
      approvedAt: null, threadVersion: 2
    }));
    await approve(negotiationId, 2);
    expect((await projection(source, devices[1])).messages).toContainEqual(expect.objectContaining({
      id: negotiationId, approvalRouteId: "proposal-control-to-source", approvedAt: expect.any(String), threadVersion: 3
    }));

    const replyId = await sendProposal(source, devices[1], sourceProjection.activeSessionRoleId,
      "message.proposal_reply", 3, { text: "Agreed, limited to this move." });
    expect((await projection(recipient, devices[2])).messages.filter(({ id }) => id === replyId)).toHaveLength(0);
    await approve(replyId, 4);
    expect((await projection(recipient, devices[2])).messages).toContainEqual(expect.objectContaining({
      id: replyId, routeId: "proposal-source-to-control", approvalRouteId: "proposal-control-to-recipient",
      approvedAt: expect.any(String), threadVersion: 5
    }));

    const acceptedId = await sendProposal(recipient, devices[2], recipientProjection.activeSessionRoleId,
      "message.proposal_accept", 5);
    await approve(acceptedId, 6);
    expect((await projection(source, devices[1])).messages).toContainEqual(expect.objectContaining({
      id: acceptedId, approvalRouteId: "proposal-control-to-source", approvedAt: expect.any(String),
      threadState: "accepted_terms", threadVersion: 7
    }));
    const actionProjection = await projection(actionAuthor, devices[4]);
    const acceptedReference = await actionAuthor.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId: devices[4], operationType: "artifact.create",
      aggregateId: crypto.randomUUID(), expectedAggregateVersion: 0, governingReleaseId: actionProjection.releaseId,
      activeSessionRoleId: actionProjection.activeSessionRoleId,
      payload: { artifactTypeKey: "red_move_response", content: {
        engagement: { acceptedProposalIds: [fixture.proposalArtifactId] }
      } }
    } });
    expect(acceptedReference.status()).toBe(200);
    const unavailableReference = await actionAuthor.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId: devices[4], operationType: "artifact.create",
      aggregateId: crypto.randomUUID(), expectedAggregateVersion: 0, governingReleaseId: actionProjection.releaseId,
      activeSessionRoleId: actionProjection.activeSessionRoleId,
      payload: { artifactTypeKey: "red_move_response", content: {
        engagement: { acceptedProposalIds: [crypto.randomUUID()] }
      } }
    } });
    expect(unavailableReference.status()).toBe(409);
    expect((await unavailableReference.json()).errorCode).toBe("VALIDATION_FAILED");
    const duplicate = await recipient.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId: devices[2], operationType: "message.proposal_accept",
      aggregateId: threadId, expectedAggregateVersion: 7, governingReleaseId: controlProjection.releaseId,
      activeSessionRoleId: recipientProjection.activeSessionRoleId, payload: { content: {} }
    } });
    expect(duplicate.status()).toBe(409);
    expect((await duplicate.json()).errorCode).toBe("INVALID_TRANSITION");

    const sourceCloseId = await sendProposal(source, devices[1], sourceProjection.activeSessionRoleId,
      "message.proposal_close_source", 7);
    await approve(sourceCloseId, 8);
    expect((await projection(recipient, devices[2])).messages).toContainEqual(expect.objectContaining({
      id: sourceCloseId, approvalRouteId: "proposal-control-to-recipient",
      threadState: "accepted_terms", threadVersion: 9
    }));
    const recipientCloseId = await sendProposal(recipient, devices[2], recipientProjection.activeSessionRoleId,
      "message.proposal_close_recipient", 9);
    await approve(recipientCloseId, 10);
    expect((await projection(source, devices[1])).messages).toContainEqual(expect.objectContaining({
      id: recipientCloseId, approvalRouteId: "proposal-control-to-source", threadState: "closed", threadVersion: 11
    }));
    const closedReply = await source.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId: devices[1], operationType: "message.proposal_reply",
      aggregateId: threadId, expectedAggregateVersion: 11, governingReleaseId: controlProjection.releaseId,
      activeSessionRoleId: sourceProjection.activeSessionRoleId, payload: { content: { text: "Too late" } }
    } });
    expect(closedReply.status()).toBe(409);
    expect((await closedReply.json()).errorCode).toBe("INVALID_TRANSITION");
    await Promise.all(contexts.map(({ context }) => context.close()));
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
    await expect(loading.page.getByRole("heading", { name: "Blue Facilitator workspace" })).toBeVisible();
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

test.describe.serial("PS-300 collaborative Studio", () => {
  test("@a11y SYNC-01 SYNC-02 AC-01 AC-02 reconnects, converges, validates, freezes and publishes from visual forms", async ({ browser }) => {
    test.setTimeout(180_000);
    const first = await actor(browser, fixture.tokens.publisher, { viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
    const second = await actor(browser, fixture.tokens.designerA, { viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await Promise.all([first.page.goto(studioUrl()), second.page.goto(studioUrl())]);
    await expect(first.page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(second.page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 40_000 });
    await expect(first.page.getByRole("heading", { name: "Core Design editor" })).toBeVisible();

    const teams = first.page.getByRole("region", { name: "Teams" });
    await teams.getByRole("button", { name: "Add Team" }).click();
    await teams.getByText("New Team", { exact: true }).click();
    await teams.getByLabel("Team name").last().fill("Browser-created Team");

    await first.page.getByLabel("Scenario name").fill("Browser convergence proof");
    await second.context.setOffline(true);
    await second.page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await second.page.getByLabel("Scenario description").fill("Offline visual-form edit merged after reconnect.");
    await expect(second.page.getByText("Offline", { exact: true })).toBeVisible();
    await expect(second.page.getByText("Save state: saved on device")).toBeVisible();
    await second.context.setOffline(false);
    await second.page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(second.page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 40_000 });
    await expect(first.page.getByLabel("Scenario description")).toHaveValue("Offline visual-form edit merged after reconnect.", { timeout: 20_000 });
    await expect(second.page.getByLabel("Scenario name")).toHaveValue("Browser convergence proof", { timeout: 20_000 });
    await expect(first.page.getByText("Valid", { exact: true })).toBeVisible();
    await expect(first.page.getByText("Save state: synchronized")).toBeVisible();

    const polls = first.page.getByRole("region", { name: "Polls" });
    await polls.locator("details").filter({ hasText: "Adopt the synthetic accessibility resolution?" }).locator("summary").click();
    await expect(polls.getByText(/Counting rule: Count accepted ballots using simple majority over valid votes/u)).toBeVisible();
    await expect(polls.getByText(/Electorate preview: Everyone/u)).toBeVisible();
    const voice = first.page.getByRole("region", { name: "Voice Channels" });
    await voice.locator("details").filter({ hasText: "Team open room" }).locator("summary").click();
    await expect(voice.getByRole("table", { name: "Selected adapter capability by target profile" })).toBeVisible();
    await expect(voice.getByRole("table", { name: "Effective configured permissions. Public access, when selected, applies to every row." })).toBeVisible();

    const preview = first.page.getByRole("region", { name: "Role & Stage preview" });
    await preview.getByLabel("Session Role").selectOption("scribe");
    await preview.getByLabel("Stage").selectOption("orientation");
    await preview.getByLabel("Team").selectOption("blue");
    await preview.getByRole("button", { name: "Preview interface" }).click();
    await expect(preview.getByText("Preview updated.")).toBeVisible();
    await expect(preview.getByLabel("Scribe interface preview")).toBeVisible();
    await expect(preview.getByRole("heading", { name: "Opening brief" })).toBeVisible();

    await first.page.getByLabel("Release label").fill("PS-300 browser proof");
    await first.page.getByLabel("Semantic version").fill("3.0.0");
    await first.page.getByLabel("Release notes").fill("Collaborative browser acceptance proof.");
    await first.page.getByLabel("Classification review ID").fill("browser-classification-review");
    await first.page.getByLabel("Retention policy ID", { exact: true }).fill("standard-retention");
    await first.page.getByLabel("Approval notes").fill("Synthetic browser approval.");
    await first.page.getByLabel("I acknowledge the validation warnings.").check();
    await first.page.getByRole("button", { name: "Freeze and publish" }).click();
    await expect(first.page.getByText(/Published release/u)).toBeVisible({ timeout: 20_000 });
    await expect(first.page.getByText("Save state: published")).toBeVisible({ timeout: 20_000 });

    await second.page.getByLabel("Scenario description").fill("Post-freeze next Draft edit.");
    await expect(first.page.getByLabel("Scenario description")).toHaveValue("Post-freeze next Draft edit.", { timeout: 20_000 });
    await expect(first.page.getByText("Save state: synchronized")).toBeVisible();
    expect((await new AxeBuilder({ page: first.page }).analyze()).violations).toEqual([]);
    await first.page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await expect.poll(() => first.page.evaluate(() => [...document.querySelectorAll("body *")].filter((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.right > document.documentElement.clientWidth + 1 || bounds.left < -1;
    }).slice(0, 12).map((element) => ({ element: `${element.tagName.toLowerCase()}.${element.className}`, right: Math.round(element.getBoundingClientRect().right),
      width: Math.round(element.getBoundingClientRect().width), text: element.textContent?.trim().slice(0, 80) })))).toEqual([]);
    await Promise.all([first.context.close(), second.context.close()]);
  });

  test("PS-310 AC-01 keeps Stage IDs stable while a reorder converges", async ({ browser }) => {
    test.setTimeout(60_000);
    const first = await actor(browser, fixture.tokens.publisher);
    const second = await actor(browser, fixture.tokens.designerA);
    await Promise.all([first.page.goto(studioUrl()), second.page.goto(studioUrl())]);
    await Promise.all([
      expect(first.page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 20_000 }),
      expect(second.page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 20_000 })
    ]);
    const stages = first.page.getByRole("region", { name: "Stages" });
    const stageCards = stages.locator("details[id^='stages-']");
    await expect(stageCards).toHaveCount(16, { timeout: 20_000 });
    const stageIdsBefore = await stageCards.evaluateAll((items) => items.map(({ id }) => id));
    await stageCards.nth(1).locator("summary").click();
    await stageCards.nth(1).getByRole("button", { name: "Earlier" }).click();
    const expectedStageIds = [stageIdsBefore[1], stageIdsBefore[0], ...stageIdsBefore.slice(2)];
    await expect.poll(() => stageCards.evaluateAll((items) => items.map(({ id }) => id))).toEqual(expectedStageIds);
    const secondStageCards = second.page.getByRole("region", { name: "Stages" }).locator("details[id^='stages-']");
    await expect.poll(() => secondStageCards.evaluateAll((items) => items.map(({ id }) => id))).toEqual(expectedStageIds);
    await Promise.all([first.context.close(), second.context.close()]);
  });

  test("@a11y EXT-12 EXT-13 EXT-14 builds and previews a two-model composition without code", async ({ browser }) => {
    test.setTimeout(120_000);
    const designer = await actor(browser, fixture.tokens.publisher, { viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    await designer.page.goto(studioUrl());
    await expect(designer.page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 20_000 });
    const plugins = designer.page.getByRole("region", { name: "Plugin catalog & bindings" });
    await expect(plugins.getByText("2 approved installed Plugins available.")).toBeVisible({ timeout: 20_000 });
    const catalogCards = plugins.locator(".catalog-card");
    await expect(catalogCards).toHaveCount(2);
    await catalogCards.nth(0).getByRole("button", { name: "Bind installed Plugin" }).click();
    await catalogCards.nth(1).getByRole("button", { name: "Bind installed Plugin" }).click();
    const effectBinding = plugins.locator("details").filter({ hasText: "org.ssg.fixtures.effect 1.0.0" });
    await effectBinding.locator("summary").click();
    await effectBinding.getByRole("button", { name: "Add input port" }).click();
    await expect(effectBinding.getByRole("group", { name: "Input ports" }).getByLabel("Port label")).toHaveValue("Input 1");
    await expect(designer.page.getByText("Save state: synchronized")).toBeVisible({ timeout: 20_000 });

    const compositions = designer.page.getByRole("region", { name: "Model Compositions" });
    await compositions.getByRole("button", { name: "Add Model Composition" }).click();
    const composition = compositions.locator("details").last();
    await composition.getByLabel("Approved Plugin Binding").selectOption({ label: "org.ssg.fixtures.analysis 1.0.0" });
    await composition.getByRole("button", { name: "Add model node" }).click();
    await composition.getByLabel("Approved Plugin Binding").selectOption({ label: "org.ssg.fixtures.effect 1.0.0" });
    await composition.getByRole("button", { name: "Add model node" }).click();
    await composition.getByRole("button", { name: "Add approval gate" }).click();
    await composition.getByRole("button", { name: "Add output" }).click();

    const edgeBuilder = composition.getByRole("group", { name: "Connect typed ports" });
    await edgeBuilder.getByLabel("Output port").selectOption({ label: "org.ssg.fixtures.analysis 1.0.0: Result · number · unitless · internal" });
    await edgeBuilder.getByLabel("Compatible input port").selectOption({ label: "org.ssg.fixtures.effect 1.0.0: Input 1 · ceiling internal" });
    await edgeBuilder.getByRole("button", { name: "Connect ports" }).click();
    await edgeBuilder.getByLabel("Output port").selectOption({ label: "org.ssg.fixtures.effect 1.0.0: Effect Proposals · effect proposal · unitless · internal" });
    await edgeBuilder.getByLabel("Compatible input port").selectOption({ label: "Mandatory approval: Effect Proposals · ceiling internal" });
    await edgeBuilder.getByRole("button", { name: "Connect ports" }).click();
    await edgeBuilder.getByLabel("Output port").selectOption({ label: "Mandatory approval: Effect Proposals · effect proposal · unitless · internal" });
    await edgeBuilder.getByLabel("Compatible input port").selectOption({ label: "Composition output: Approved Effect Proposals · ceiling internal" });
    await edgeBuilder.getByRole("button", { name: "Connect ports" }).click();
    await composition.getByRole("button", { name: "Run fixture without state change" }).click();
    await expect(composition.getByText("Status: completed")).toBeVisible({ timeout: 20_000 });
    await expect(composition.getByText("State changes: 0")).toBeVisible();
    expect((await new AxeBuilder({ page: designer.page }).include("#plugins").include("#compositions").analyze()).violations).toEqual([]);
    await designer.context.close();
  });
});
