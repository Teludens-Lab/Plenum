import { mkdir, writeFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

import { fixture, operatorUrl, runtimeUrl, studioUrl } from "./fixture.mjs";

const evidenceRoot = "output/playwright/ps-150";
const headers = (token) => ({ Authorization: `Bearer ${token}` });
const databaseUrl = process.env.DATABASE_URL;
let publishedReleaseId;

const round = (value) => Math.round(value * 100) / 100;
function percentile(values, proportion) {
  const ordered = [...values].sort((left, right) => left - right);
  return round(ordered[Math.max(0, Math.ceil(ordered.length * proportion) - 1)]);
}

async function installRtcProbe(context) {
  await context.addInitScript(() => {
    const NativePeerConnection = globalThis.RTCPeerConnection;
    globalThis.__plenumPeerConnections = [];
    function TrackedPeerConnection(...args) {
      const connection = new NativePeerConnection(...args);
      globalThis.__plenumPeerConnections.push(connection);
      return connection;
    }
    TrackedPeerConnection.prototype = NativePeerConnection.prototype;
    Object.setPrototypeOf(TrackedPeerConnection, NativePeerConnection);
    globalThis.RTCPeerConnection = TrackedPeerConnection;
  });
}

async function rtcSnapshot(page) {
  return page.evaluate(async () => {
    let packetsReceived = 0, packetsLost = 0;
    const selectedCandidateTypes = new Set(), selectedProtocols = new Set();
    const remoteCandidateTypes = new Set(), remotePorts = new Set();
    for (const connection of globalThis.__plenumPeerConnections ?? []) {
      const report = await connection.getStats();
      for (const stat of report.values()) {
        if (stat.type === "inbound-rtp" && (stat.kind === "audio" || stat.mediaType === "audio")) {
          packetsReceived += stat.packetsReceived ?? 0;
          packetsLost += stat.packetsLost ?? 0;
        }
        if (stat.type !== "transport" || stat.selectedCandidatePairId === undefined) continue;
        const pair = report.get(stat.selectedCandidatePairId);
        const local = pair === undefined ? undefined : report.get(pair.localCandidateId);
        const remote = pair === undefined ? undefined : report.get(pair.remoteCandidateId);
        if (local?.candidateType !== undefined) selectedCandidateTypes.add(local.candidateType);
        if (local?.relayProtocol !== undefined) selectedProtocols.add(local.relayProtocol);
        else if (local?.protocol !== undefined) selectedProtocols.add(local.protocol);
        if (remote?.candidateType !== undefined) remoteCandidateTypes.add(remote.candidateType);
        if (remote?.port !== undefined) remotePorts.add(remote.port);
      }
    }
    return { packetsReceived, packetsLost, selectedCandidateTypes: [...selectedCandidateTypes],
      selectedProtocols: [...selectedProtocols], remoteCandidateTypes: [...remoteCandidateTypes], remotePorts: [...remotePorts] };
  });
}

async function waitForPacketsToSettle(page) {
  let previous = -1, stableChecks = 0;
  await expect.poll(async () => {
    const current = (await rtcSnapshot(page)).packetsReceived;
    if (current === previous) stableChecks += 1;
    else { previous = current; stableChecks = 0; }
    return stableChecks;
  }, { timeout: 2_000, intervals: [40] }).toBeGreaterThanOrEqual(2);
  return previous;
}

async function receivingConnectionState(page) {
  return page.evaluate(async () => {
    const connections = globalThis.__plenumPeerConnections ?? [];
    for (let index = connections.length - 1; index >= 0; index -= 1) {
      const connection = connections[index];
      const report = await connection.getStats();
      if ([...report.values()].some((stat) => stat.type === "inbound-rtp" &&
        (stat.kind === "audio" || stat.mediaType === "audio") && (stat.packetsReceived ?? 0) > 0)) {
        return connection.connectionState;
      }
    }
    return "missing";
  });
}

async function actor(browser, token, options = {}) {
  const context = await browser.newContext({ ...options, extraHTTPHeaders: headers(token) });
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

function setFormValue(target, path, value) {
  const parts = path.split(".");
  let owner = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = /^\d+$/u.test(parts[index]) ? Number(parts[index]) : parts[index];
    const nextIsIndex = /^\d+$/u.test(parts[index + 1]);
    owner[key] ??= nextIsIndex ? [] : {};
    owner = owner[key];
  }
  const last = /^\d+$/u.test(parts.at(-1)) ? Number(parts.at(-1)) : parts.at(-1);
  owner[last] = value;
}

function representativePayload(form, overrides = {}) {
  const payload = {};
  for (const field of form.sections.flatMap(({ fields }) => fields)) {
    const option = field.options?.[0]?.value;
    const value = field.type === "multi_select" ? (option === undefined ? [] : [option]) :
      option ?? (field.type === "number" ? 1 : field.type === "checkbox" ? true :
        `Synthetic parity evidence for ${field.label}. This narrative is intentionally representative.`);
    setFormValue(payload, field.key, value);
  }
  for (const [path, value] of Object.entries(overrides)) setFormValue(payload, path, value);
  return payload;
}

async function apiActor(browser, token) {
  const instance = await actor(browser, token);
  const deviceId = (await (await instance.context.request.post("/v1/devices", { data: {} })).json()).deviceId;
  const readProjection = async () => (await (await instance.context.request.get(
    `/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": deviceId } }
  )).json());
  return { ...instance, deviceId, readProjection };
}

async function submitRuntime(instance, projection, operationType, aggregateId, expectedAggregateVersion, payload = {}) {
  return instance.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
    commandId: crypto.randomUUID(), deviceId: instance.deviceId, operationType, aggregateId,
    expectedAggregateVersion, governingReleaseId: projection.releaseId,
    activeSessionRoleId: projection.activeSessionRoleId, payload
  } });
}

async function createRuntimeArtifact(instance, projection, artifactTypeKey, overrides = {}, coauthorParticipantIds = []) {
  const task = projection.createTasks.find((candidate) => candidate.artifactTypeKey === artifactTypeKey);
  expect(task, `Missing create task ${artifactTypeKey}`).toBeDefined();
  const artifactId = crypto.randomUUID();
  const response = await submitRuntime(instance, projection, "artifact.create", artifactId, 0, {
    artifactTypeKey,
    content: representativePayload(task.form, overrides),
    coauthorParticipantIds
  });
  expect(response.status()).toBe(200);
  return artifactId;
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
  await expect(page.getByText("The server accepted the Command.")).toBeVisible({ timeout: 15_000 });
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
  await expect(page.getByText("The server accepted the Command.")).toBeVisible({ timeout: 15_000 });
}

test.describe.serial("PS-150 configured Runtime shell", () => {
  test.beforeAll(async () => mkdir(evidenceRoot, { recursive: true }));

  test("@a11y AC-04 REQ-064 renders a keyboard and screen-reader operable empty workspace", async ({ browser }) => {
    const { context, page } = await actor(browser, fixture.tokens.author, { viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
    await page.goto(runtimeUrl());
    await expect(page.getByRole("heading", { level: 1, name: "Blue Scribe workspace" })).toBeVisible({ timeout: 15_000 });
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

  test("@a11y AC-11 SYNC-04/05 survives restart and reconciles one encrypted offline Command", async ({ browser }) => {
    test.setTimeout(90_000);
    const uniqueDraft = "Durable offline restart proof";
    const { context, page } = await actor(browser, fixture.tokens.author, {
      viewport: { width: 1280, height: 720 }, reducedMotion: "reduce"
    });
    await page.goto(runtimeUrl());
    await expect(page.getByRole("heading", { level: 1, name: "Blue Scribe workspace" })).toBeVisible({ timeout: 15_000 });
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    const create = await fillBlueOrientation(page, uniqueDraft);
    await create.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Saved on this device as local pending. It has not been submitted.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Offline Outbox" })).toBeVisible();
    await expect(page.getByText("local pending", { exact: true })).toBeVisible();
    const rawStorage = await page.evaluate(async () => new Promise((resolve, reject) => {
      const open = indexedDB.open("plenum-offline-v1");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const getAll = open.result.transaction("runtime").objectStore("runtime").getAll();
        getAll.onerror = () => reject(getAll.error);
        getAll.onsuccess = () => resolve(JSON.stringify(getAll.result));
      };
    }));
    expect(rawStorage).not.toContain(uniqueDraft);
    expect(rawStorage).not.toContain("artifact.create");
    await page.close();

    await context.setOffline(false);
    const restored = await context.newPage();
    await restored.goto(runtimeUrl());
    await expect(restored.getByText("Reconnect complete: 1 accepted.")).toBeVisible({ timeout: 20_000 });
    const restoredArtifact = restored.getByRole("article", { name: "Blue Strategic Orientation" });
    await expect(restoredArtifact.getByLabel("What will Red do first?")).toHaveValue(uniqueDraft, { timeout: 15_000 });
    await restored.reload();
    await expect(restoredArtifact.getByLabel("What will Red do first?")).toHaveValue(uniqueDraft, { timeout: 15_000 });
    expect((await new AxeBuilder({ page: restored }).analyze()).violations).toEqual([]);

    const database = new Pool({ connectionString: databaseUrl, max: 1 });
    const committed = await database.query(
      "SELECT count(*)::int AS count FROM runtime.artifact_instances WHERE organization_id=$1 AND session_id=$2 AND payload::text LIKE $3",
      [fixture.organizationId, fixture.sessionId, `%${uniqueDraft}%`]
    );
    await database.end();
    expect(committed.rows[0].count).toBe(1);
    await context.close();
  });

  test("@a11y VOTE-01 VOTE-15 casts and certifies an accessible authoritative Poll", async ({ browser }) => {
    test.setTimeout(90_000);
    const commandTimeout = 15_000;
    const control = await actor(browser, fixture.tokens.finalReviewer, { viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
    const participant = await actor(browser, fixture.tokens.author, { viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
    const lateParticipant = await actor(browser, fixture.tokens.redAuthor, { viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
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

    await lateParticipant.page.goto(runtimeUrl());
    const latePoll = lateParticipant.page.getByRole("article", { name: "Adopt the synthetic accessibility resolution?" });
    await expect(latePoll).toBeVisible({ timeout: commandTimeout });
    await lateParticipant.context.setOffline(true);
    await lateParticipant.page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await latePoll.getByLabel("No").check();
    await latePoll.getByRole("button", { name: "Cast Ballot" }).click();
    await expect(lateParticipant.page.getByText("Saved on this device as local pending. It has not been submitted.")).toBeVisible();
    await expect(lateParticipant.page.getByText("local pending", { exact: true })).toBeVisible();
    await lateParticipant.page.close();

    await participant.page.goto(runtimeUrl());
    const poll = participant.page.getByRole("article", { name: "Adopt the synthetic accessibility resolution?" });
    await expect(poll).toBeVisible({ timeout: 15_000 });
    await poll.getByLabel("Yes").check();
    await poll.getByRole("button", { name: "Cast Ballot" }).click();
    await expect(poll.getByText(/Ballot accepted at/u)).toBeVisible({ timeout: commandTimeout });
    expect((await new AxeBuilder({ page: participant.page }).analyze()).violations).toEqual([]);

    await control.page.goto(runtimeUrl());
    const managed = control.page.getByRole("article", { name: "Adopt the synthetic accessibility resolution?" });
    await expect(managed.getByRole("button", { name: "Close Poll" })).toBeVisible({ timeout: commandTimeout });
    await control.context.setOffline(true);
    await managed.getByRole("button", { name: "Close Poll" }).click();
    await expect(control.page.getByText("Poll management requires the live Session Authority and was not queued.")).toBeVisible();
    await expect(managed.getByText("open", { exact: true })).toBeVisible();
    await control.context.setOffline(false);
    await managed.getByRole("button", { name: "Close Poll" }).click();
    await expect(managed.getByRole("button", { name: "Compute Tally" })).toBeVisible({ timeout: commandTimeout });

    await lateParticipant.context.setOffline(false);
    const lateReconnect = await lateParticipant.context.newPage();
    await lateReconnect.goto(runtimeUrl());
    await expect(lateReconnect.getByText("Reconnect complete: 1 rejected.")).toBeVisible({ timeout: 20_000 });
    await expect(lateReconnect.getByText("The Poll is not accepting Ballots.")).toBeVisible();
    await expect(lateReconnect.getByText("rejected", { exact: true })).toBeVisible();
    await expect(lateReconnect.getByLabel("Editable local draft")).toBeVisible();

    await managed.getByRole("button", { name: "Compute Tally" }).click();
    await expect(managed.getByRole("button", { name: "Certify result" })).toBeVisible({ timeout: commandTimeout });
    await managed.getByRole("button", { name: "Certify result" }).click();
    await expect(managed.getByRole("heading", { name: "Certified result" })).toBeVisible({ timeout: commandTimeout });
    await expect(managed.getByText(/Quorum met.*Passed/u)).toBeVisible({ timeout: commandTimeout });
    expect((await new AxeBuilder({ page: control.page }).analyze()).violations).toEqual([]);
    await Promise.all([control.context.close(), participant.context.close(), lateParticipant.context.close()]);
  });

  test("@a11y EXT-06/18 reviews an Effect Proposal and never queues approval offline", async ({ browser }) => {
    test.setTimeout(240_000);
    const commandTimeout = 40_000;
    const { context, page } = await actor(browser, fixture.tokens.finalReviewer, { viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
    await page.goto(runtimeUrl());
    const proposal = page.getByRole("article", { name: "synthetic risk" });
    await expect(proposal).toBeVisible({ timeout: commandTimeout });
    await expect(proposal.getByText("in review")).toBeVisible({ timeout: commandTimeout });
    await proposal.getByLabel("Decision reason").fill("Reviewed against current authoritative state");
    await context.setOffline(true);
    await proposal.getByRole("button", { name: "Approve effect" }).click();
    await expect(page.getByText("Approval Decisions require a live Session Authority and were not queued.")).toBeVisible({ timeout: commandTimeout });
    await expect(proposal.getByText("in review")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Offline Outbox" })).toHaveCount(0);
    await context.setOffline(false);
    await proposal.getByRole("button", { name: "Approve effect" }).click();
    await expect(page.getByText("The server accepted the Command.")).toBeVisible({ timeout: commandTimeout });
    await expect(proposal.getByText("applied")).toBeVisible({ timeout: 20_000 });
    await expect(proposal.getByRole("button", { name: "Approve effect" })).toHaveCount(0);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    await context.close();
  });

  test("VOICE-06/07/11 sends microphone audio through the local media provider", async ({ browser }) => {
    test.skip(process.env.MEDIA_TEST_URL === undefined, "A local SFU is required for the real media proof");
    test.setTimeout(240_000);
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce",
      permissions: ["microphone"] });
    await installRtcProbe(context);
    await context.route("http://127.0.0.1:4173/v1/**", async (route) => route.continue({ headers: {
      ...route.request().headers(), Authorization: `Bearer ${fixture.tokens.author}`
    } }));
    const page = await context.newPage();
    await page.goto(runtimeUrl());
    await expect(page.getByRole("heading", { name: "Voice Channels" })).toBeVisible();
    await expect(page.getByText(/Push-to-talk: hold Space, Enter, or the Floor button/u)).toBeVisible();
    const openRoom = page.getByRole("article", { name: "Team open room" });
    const listenerContext = await browser.newContext({ permissions: ["microphone"] });
    await installRtcProbe(listenerContext);
    await listenerContext.route("http://127.0.0.1:4173/v1/**", async (route) => route.continue({ headers: {
      ...route.request().headers(), Authorization: `Bearer ${fixture.tokens.reviewer}`
    } }));
    const listener = await listenerContext.newPage();
    await listener.goto(runtimeUrl());
    const listenerRoom = listener.getByRole("article", { name: "Team open room" });
    const joinLatency = [], speechStartLatency = [];
    let network;

    // Warm the browser, signaling, TURN/TLS and microphone track before collecting steady-state percentiles.
    await openRoom.getByRole("button", { name: "Join voice" }).click();
    await expect(openRoom.getByRole("button", { name: "Enable microphone" })).toBeVisible({ timeout: 15_000 });
    await listenerRoom.getByRole("button", { name: "Join voice" }).click();
    await expect(listenerRoom.getByRole("button", { name: "Leave voice" })).toBeVisible({ timeout: 15_000 });
    const warmMicrophone = openRoom.getByRole("button", { name: "Enable microphone" });
    let before = await waitForPacketsToSettle(listener);
    await warmMicrophone.click();
    await expect.poll(async () => (await rtcSnapshot(listener)).packetsReceived,
      { timeout: 15_000, intervals: [20] }).toBeGreaterThan(before);
    await openRoom.getByRole("button", { name: "Mute microphone" }).click();
    await expect(openRoom.getByText("ready", { exact: true })).toBeVisible();
    await listenerRoom.getByRole("button", { name: "Leave voice" }).click();
    await openRoom.getByRole("button", { name: "Leave voice" }).click();
    await expect(listenerRoom.getByRole("button", { name: "Join voice" })).toBeEnabled();
    await expect(openRoom.getByRole("button", { name: "Join voice" })).toBeEnabled();

    for (let cycle = 0; cycle < 10; cycle += 1) {
      let started = performance.now();
      const joinOpen = openRoom.getByRole("button", { name: "Join voice" });
      if (cycle === 0) { await joinOpen.focus(); await page.keyboard.press("Enter"); } else await joinOpen.click();
      await expect(openRoom.getByRole("button", { name: "Enable microphone" })).toBeVisible({ timeout: 15_000 });
      joinLatency.push(performance.now() - started);
      started = performance.now();
      await listenerRoom.getByRole("button", { name: "Join voice" }).click();
      await expect(listenerRoom.getByRole("button", { name: "Leave voice" })).toBeVisible({ timeout: 15_000 });
      joinLatency.push(performance.now() - started);
      await listenerRoom.getByRole("button", { name: "Leave voice" }).click();
      await openRoom.getByRole("button", { name: "Leave voice" }).click();
      await expect(listenerRoom.getByRole("button", { name: "Join voice" })).toBeEnabled();
      await expect(openRoom.getByRole("button", { name: "Join voice" })).toBeEnabled();
    }

    await openRoom.getByRole("button", { name: "Join voice" }).click();
    await expect(openRoom.getByRole("button", { name: "Enable microphone" })).toBeVisible({ timeout: 15_000 });
    await listenerRoom.getByRole("button", { name: "Join voice" }).click();
    await expect(listenerRoom.getByRole("button", { name: "Leave voice" })).toBeVisible({ timeout: 15_000 });
    const microphone = openRoom.getByRole("button", { name: "Enable microphone" });
    for (let sample = 0; sample < 5; sample += 1) {
      before = await waitForPacketsToSettle(listener);
      const started = performance.now();
      await microphone.focus(); await page.keyboard.press("Enter");
      await expect(openRoom.getByText("transmitting", { exact: true })).toBeVisible();
      await expect.poll(async () => (await rtcSnapshot(listener)).packetsReceived,
        { timeout: 15_000, intervals: [20] }).toBeGreaterThan(before);
      speechStartLatency.push(performance.now() - started);
      await expect(listenerRoom.getByText("Receiving 1 remote audio stream.", { exact: true })).toBeVisible({ timeout: 15_000 });
      network = await rtcSnapshot(listener);
      await page.keyboard.press("Enter");
      await expect(openRoom.getByText("ready", { exact: true })).toBeVisible();
    }
    await listenerRoom.getByRole("button", { name: "Leave voice" }).click();
    await openRoom.getByRole("button", { name: "Leave voice" }).click();
    await expect(openRoom.getByRole("button", { name: "Join voice" })).toBeEnabled();
    await listenerContext.close();

    const radio = page.getByRole("article", { name: "All-hands radio" });
    const radioJoinStarted = performance.now();
    const radioJoin = radio.getByRole("button", { name: "Join voice" });
    await expect(radioJoin).toBeEnabled();
    await radioJoin.focus(); await page.keyboard.press("Enter");
    await expect(radio.getByRole("button", { name: /Hold to talk/u })).toBeVisible({ timeout: 15_000 });
    joinLatency.push(performance.now() - radioJoinStarted);
    const floor = radio.getByRole("button", { name: /Hold to talk/u });
    const floorLatency = [];
    for (let sample = 0; sample < 10; sample += 1) {
      await floor.focus();
      const started = performance.now();
      await page.keyboard.down("Space");
      await expect(radio.getByText("transmitting", { exact: true })).toBeVisible({ timeout: 10_000 });
      floorLatency.push(performance.now() - started);
      const released = page.waitForResponse((response) => response.url().endsWith("/release") && response.request().method() === "POST");
      await page.keyboard.up("Space");
      await released;
      await expect(radio.getByText("ready", { exact: true })).toBeVisible({ timeout: 10_000 });
    }
    await radio.getByRole("button", { name: "Leave voice" }).click();
    await page.screenshot({ path: `${evidenceRoot}/voice-keyboard-local-media.png`, fullPage: true });

    const packetLossPercent = network.packetsReceived + network.packetsLost === 0 ? null :
      round(network.packetsLost * 100 / (network.packetsReceived + network.packetsLost));
    const report = {
      contractId: "ps-545-institutional-media-v1", generatedAt: new Date().toISOString(),
      topology: "Windows Chromium client to Linux Mint LiveKit over the representative segmented LAN",
      warmup: { join: 2, speechStart: 1 },
      samples: { join: joinLatency.length, speechStart: speechStartLatency.length, floor: floorLatency.length },
      observationsMs: { join: joinLatency.map(round), speechStart: speechStartLatency.map(round), floor: floorLatency.map(round) },
      latencyMs: { joinP95: percentile(joinLatency, 0.95), speechStartMedian: percentile(speechStartLatency, 0.5),
        floorP95: percentile(floorLatency, 0.95) },
      network: { selectedCandidateTypes: network.selectedCandidateTypes, selectedProtocols: network.selectedProtocols,
        remoteCandidateTypes: network.remoteCandidateTypes, remotePorts: network.remotePorts,
        packetsReceived: network.packetsReceived, packetsLost: network.packetsLost, packetLossPercent },
      thresholds: { joinP95Ms: 3000, speechStartMedianMs: 300, floorP95Ms: 500, packetLossPercent: 1 }
    };
    await mkdir(evidenceRoot, { recursive: true });
    await writeFile(`${evidenceRoot}/ps-545-institutional-media.json`, `${JSON.stringify(report, null, 2)}\n`);
    expect(report.network.selectedProtocols).toContain("tls");
    expect(report.latencyMs.joinP95).toBeLessThanOrEqual(report.thresholds.joinP95Ms);
    expect(report.latencyMs.speechStartMedian).toBeLessThanOrEqual(report.thresholds.speechStartMedianMs);
    expect(report.latencyMs.floorP95).toBeLessThanOrEqual(report.thresholds.floorP95Ms);
    expect(report.network.packetLossPercent).not.toBeNull();
    expect(report.network.packetLossPercent).toBeLessThan(report.thresholds.packetLossPercent);

    await context.setOffline(true);
    await expect(radio.getByRole("button", { name: "Join voice" })).toBeDisabled();
    await expect(page.getByText("Offline", { exact: true })).toBeVisible();
    await context.close();
  });

  test("VOICE-12-RECOVERY resumes TURN/TLS audio after the media provider restarts", async ({ browser }) => {
    test.skip(process.env.MEDIA_RECOVERY_TEST !== "1", "The provider restart proof requires an operator-coordinated run");
    test.setTimeout(360_000);
    const context = await browser.newContext({ permissions: ["microphone"] });
    const listenerContext = await browser.newContext({ permissions: ["microphone"] });
    await installRtcProbe(context); await installRtcProbe(listenerContext);
    await context.route("http://127.0.0.1:4173/v1/**", async (route) => route.continue({ headers: {
      ...route.request().headers(), Authorization: `Bearer ${fixture.tokens.author}`
    } }));
    await listenerContext.route("http://127.0.0.1:4173/v1/**", async (route) => route.continue({ headers: {
      ...route.request().headers(), Authorization: `Bearer ${fixture.tokens.reviewer}`
    } }));
    const page = await context.newPage();
    const listener = await listenerContext.newPage();
    await Promise.all([page.goto(runtimeUrl()), listener.goto(runtimeUrl())]);
    const room = page.getByRole("article", { name: "Team open room" });
    const listenerRoom = listener.getByRole("article", { name: "Team open room" });
    await room.getByRole("button", { name: "Join voice" }).click();
    await listenerRoom.getByRole("button", { name: "Join voice" }).click();
    await expect(room.getByRole("button", { name: "Enable microphone" })).toBeVisible({ timeout: 15_000 });
    await expect(listenerRoom.getByRole("button", { name: "Leave voice" })).toBeVisible({ timeout: 15_000 });
    const before = await rtcSnapshot(listener);
    await room.getByRole("button", { name: "Enable microphone" }).click();
    await expect.poll(async () => (await rtcSnapshot(listener)).packetsReceived,
      { timeout: 15_000, intervals: [20] }).toBeGreaterThan(before.packetsReceived);
    await expect.poll(() => receivingConnectionState(listener), { timeout: 15_000 }).toBe("connected");

    process.stdout.write("\nPS-545 RECOVERY READY: on Linux run: sudo docker restart plenum-media-lab-media-1\n");
    await expect.poll(async () => (await receivingConnectionState(listener)) !== "connected",
      { timeout: 240_000, intervals: [100] }).toBe(true);
    const interruptedAt = performance.now();
    let priorPackets = (await rtcSnapshot(listener)).packetsReceived;
    await expect.poll(async () => {
      const current = await rtcSnapshot(listener);
      const resumed = await receivingConnectionState(listener) === "connected" && current.packetsReceived > priorPackets;
      priorPackets = current.packetsReceived;
      return resumed;
    }, { timeout: 300_000, intervals: [100] }).toBe(true);
    const recoveryMilliseconds = round(performance.now() - interruptedAt);
    const network = await rtcSnapshot(listener);
    const packetLossPercent = network.packetsReceived + network.packetsLost === 0 ? null :
      round(network.packetsLost * 100 / (network.packetsReceived + network.packetsLost));
    const report = {
      contractId: "ps-545-institutional-media-recovery-v1", generatedAt: new Date().toISOString(),
      topology: "Windows Chromium client to Linux Mint LiveKit over forced TURN/TLS",
      injectedFailure: "LiveKit container restart", recoveryMilliseconds,
      network: { ...network, packetLossPercent },
      thresholds: { recoveryMilliseconds: 300_000, packetLossPercent: 1 }
    };
    await mkdir(evidenceRoot, { recursive: true });
    await writeFile(`${evidenceRoot}/ps-545-institutional-media-recovery.json`, `${JSON.stringify(report, null, 2)}\n`);
    expect(network.selectedProtocols).toContain("tls");
    expect(recoveryMilliseconds).toBeLessThanOrEqual(report.thresholds.recoveryMilliseconds);
    expect(packetLossPercent).not.toBeNull();
    expect(packetLossPercent).toBeLessThan(report.thresholds.packetLossPercent);
    await Promise.all([context.close(), listenerContext.close()]);
  });

  test("@a11y VOICE-13/14 captures and withdraws participant-scoped transcription consent", async ({ browser }) => {
    test.setTimeout(120_000);
    const commandTimeout = 30_000;
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
    await expect(participantTranscription).toContainText("Policy: with consent · Your consent: not given", { timeout: commandTimeout });
    await participantTranscription.getByRole("button", { name: "Give transcription consent" }).click();
    await expect(participantTranscription).toContainText("Your consent: given", { timeout: commandTimeout });
    await moderatorTranscription.getByRole("button", { name: "Give transcription consent" }).click();
    await expect(moderatorTranscription).toContainText("Your consent: given", { timeout: commandTimeout });
    await moderatorTranscription.getByRole("button", { name: "Start transcription" }).click();
    await expect(moderatorTranscription).toContainText("Active · Policy: with consent", { timeout: commandTimeout });
    await participant.page.getByRole("button", { name: "Refresh authoritative state" }).click();
    await expect(participantTranscription).toContainText("Active · Policy: with consent", { timeout: commandTimeout });
    await participantTranscription.getByRole("button", { name: "Withdraw transcription consent" }).click();
    await expect(participantTranscription).toContainText("Stopped · Policy: with consent · Your consent: withdrawn", { timeout: commandTimeout });
    expect((await new AxeBuilder({ page: participant.page }).analyze()).violations).toEqual([]);
    await Promise.all([participant.context.close(), moderator.context.close()]);
  });

  test("AC-03/05/06/12/13 completes DEC-42 and denies forbidden or unauthorized paths", async ({ browser }) => {
    test.setTimeout(600_000);
    const commandTimeout = 40_000;
    const author = await actor(browser, fixture.tokens.author);
    await author.page.goto(runtimeUrl());
    await createDraft(author.page, "Approve the first configured handoff");
    const authored = author.page.locator("article.artifact").first();
    await expect(authored.getByText("Draft", { exact: true })).toBeVisible();
    await authored.getByRole("button", { name: "Submit to Team Facilitator" }).click();
    await expect(author.page.getByLabel("Plenum status: Connected")).toBeVisible({ timeout: 15_000 });
    await expect(authored.getByText("With Team Facilitator", { exact: true })).toBeVisible({ timeout: commandTimeout });
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
    const unauthorizedReadiness = await authorApi.get(`/v1/sessions/${fixture.sessionId}/readiness`);
    expect(unauthorizedReadiness.status()).toBe(403);
    const anonymous = await browser.newContext();
    const codeOnlyJoin = await anonymous.request.post(`/v1/sessions/${fixture.sessionId}/join-requests`, { data: {
      commandId: crypto.randomUUID(), deviceId: crypto.randomUUID(), operationType: "join_request.submit",
      aggregateId: crypto.randomUUID(), expectedAggregateVersion: 0, governingReleaseId: fixture.releaseId,
      payload: { sessionCode: "code-alone-is-not-authority" }
    } });
    expect(codeOnlyJoin.status()).toBe(401);
    await anonymous.close();
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
    await expect(reviewer.page.getByLabel("Plenum status: Connected")).toBeVisible({ timeout: 15_000 });
    await expect(reviewer.page.getByText("With White Cell", { exact: true })).toBeVisible({ timeout: commandTimeout });

    const finalReviewer = await actor(browser, fixture.tokens.finalReviewer);
    await finalReviewer.page.goto(runtimeUrl());
    await finalReviewer.page.getByRole("button", { name: "Return for revision" }).click();
    await expect(finalReviewer.page.getByLabel("Plenum status: Connected")).toBeVisible({ timeout: 15_000 });
    await expect(finalReviewer.page.getByText("Returned for revision", { exact: true })).toBeVisible({ timeout: commandTimeout });

    await author.page.reload();
    await expect(author.page.getByText("Returned for revision", { exact: true })).toBeVisible({ timeout: commandTimeout });
    await authored.getByLabel("What will Red do first?").fill("Revised after White Cell feedback");
    await authored.getByRole("button", { name: "Save revision" }).click();
    await expect(authored.locator("dl.metadata dd").first()).toHaveText("5", { timeout: commandTimeout });
    await authored.getByRole("button", { name: "Resubmit to Team Facilitator" }).click();
    await expect(authored.getByText("With Team Facilitator", { exact: true })).toBeVisible({ timeout: commandTimeout });
    await reviewer.page.reload();
    await reviewer.page.getByRole("button", { name: "Forward to White Cell" }).click();
    await expect(reviewer.page.getByText("With White Cell", { exact: true })).toBeVisible({ timeout: commandTimeout });
    await finalReviewer.page.reload();

    const controlDeviceResponse = await finalReviewer.context.request.post("/v1/devices", { data: {} });
    const { deviceId: controlDeviceId } = await controlDeviceResponse.json();
    let controlProjection = await (await finalReviewer.context.request.get(
      `/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": controlDeviceId } }
    )).json();
    const adjudicated = controlProjection.artifacts.find(({ id }) => id === submitted.id);
    const acceptance = (commandId) => finalReviewer.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId, deviceId: controlDeviceId, operationType: "artifact.accept", aggregateId: adjudicated.id,
      expectedAggregateVersion: adjudicated.version, governingReleaseId: adjudicated.governingReleaseId,
      activeSessionRoleId: controlProjection.activeSessionRoleId, payload: {}
    } });
    const competing = await Promise.all([acceptance(crypto.randomUUID()), acceptance(crypto.randomUUID())]);
    expect(competing.map((response) => response.status()).sort()).toEqual([200, 409]);
    const competingReceipts = await Promise.all(competing.map((response) => response.json()));
    expect(competingReceipts).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "accepted", evidenceSequence: expect.any(Number) }),
      expect.objectContaining({ status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION" })
    ]));
    await finalReviewer.page.reload();
    await expect(finalReviewer.page.getByText("Completed", { exact: true })).toBeVisible({ timeout: commandTimeout });
    controlProjection = await (await finalReviewer.context.request.get(
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
    const controlActor = { ...finalReviewer, deviceId: controlDeviceId };
    const gateClosed = await submitRuntime(controlActor, controlAfterStart, "stage.advance", fixture.sessionId, 1, {
      reason: "Attempt before every Industry orientation reaches Control", targetStageId: "m1-deliberation"
    });
    expect(gateClosed.status()).toBe(409);
    expect(await gateClosed.json()).toMatchObject({ status: "rejected", errorCode: "INVALID_TRANSITION",
      message: "The Stage completion requirements are not satisfied." });

    const invalidGreen = await apiActor(browser, fixture.tokens.designerA);
    let greenProjection = await invalidGreen.readProjection();
    const incompleteOrientationId = crypto.randomUUID();
    const incompleteDraft = await submitRuntime(invalidGreen, greenProjection, "artifact.create", incompleteOrientationId, 0, {
      artifactTypeKey: "green_strategic_orientation", content: {}
    });
    expect(incompleteDraft.status()).toBe(200);
    const missingNarrative = await submitRuntime(invalidGreen, greenProjection, "artifact.submit", incompleteOrientationId, 1);
    expect(missingNarrative.status()).toBe(409);
    expect((await missingNarrative.json()).errorCode).toBe("VALIDATION_FAILED");
    await createRuntimeArtifact(invalidGreen, greenProjection, "green_strategic_orientation");
    await createRuntimeArtifact({ ...red, deviceId: redDeviceId }, redProjection, "red_strategic_orientation");

    const industry = await apiActor(browser, fixture.tokens.designerB);
    const industryReview = await apiActor(browser, fixture.tokens.publisher);
    const industryProjection = await industry.readProjection();
    for (const industryCellId of ["industry-agriculture", "industry-telecommunications", "industry-biotechnology"]) {
      const artifactId = await createRuntimeArtifact(industry, industryProjection, "industry_strategic_plan", { industryCellId });
      expect((await submitRuntime(industry, industryProjection, "artifact.submit", artifactId, 1)).status()).toBe(200);
      const reviewProjection = await industryReview.readProjection();
      const submittedIndustry = reviewProjection.artifacts.find(({ id }) => id === artifactId);
      expect(submittedIndustry).toMatchObject({ state: "with_facilitator", version: 2 });
      expect((await submitRuntime(industryReview, reviewProjection, "artifact.forward", artifactId, 2)).status()).toBe(200);
    }
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

    const deliveryDatabase = new Pool({ connectionString: databaseUrl, max: 1 });
    let originalDelivery;
    try {
      const failedDelivery = await deliveryDatabase.query(
        `WITH target AS (
           SELECT id,publication_status,attempts,published_at FROM sync.session_delta_outbox
            WHERE organization_id=$1 AND session_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1
         )
         UPDATE sync.session_delta_outbox item SET publication_status='dead_lettered',attempts=3,published_at=NULL
          FROM target WHERE item.id=target.id
          RETURNING item.id,target.publication_status,target.attempts,target.published_at`,
        [fixture.organizationId, fixture.sessionId]
      );
      expect(failedDelivery.rowCount).toBe(1);
      originalDelivery = failedDelivery.rows[0];
    } finally { await deliveryDatabase.end(); }

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
    await expect(operator.page.getByRole("heading", { level: 2, name: "Session staffing" })).toBeVisible();
    await expect(operator.page.getByText("No ambiguous roster rows.")).toBeVisible();
    await expect(operator.page.getByRole("heading", { level: 2, name: "Operator readiness" })).toBeVisible();
    await expect(operator.page.getByRole("heading", { level: 2, name: "Runtime deliveries" })).toBeVisible();
    await expect(operator.page.getByText("1 dead-lettered")).toBeVisible();
    await operator.page.getByRole("button", { name: "Retry delivery" }).click();
    await expect(operator.page.getByText("Delivery returned to the pending queue.")).toBeVisible();
    await expect(operator.page.getByText("No dead-lettered deliveries.")).toBeVisible();
    await expect(operator.page.getByText("Current governing Release is pinned")).toBeVisible();
    expect((await new AxeBuilder({ page: operator.page }).analyze()).violations).toEqual([]);
    await expect(operator.page.locator(".status-list li").filter({ hasText: "completed" })).toContainText("1");
    await expect(operator.page.getByText("stage.advanced", { exact: true })).toBeVisible();
    await operator.page.screenshot({ path: `${evidenceRoot}/operator-accepted.png`, fullPage: true });
    const restoreDeliveryDatabase = new Pool({ connectionString: databaseUrl, max: 1 });
    try {
      await restoreDeliveryDatabase.query(
        `UPDATE sync.session_delta_outbox SET publication_status=$1,attempts=$2,published_at=$3 WHERE id=$4`,
        [originalDelivery.publication_status, originalDelivery.attempts, originalDelivery.published_at, originalDelivery.id]
      );
    } finally { await restoreDeliveryDatabase.end(); }
    await Promise.all([author.context.close(), reviewer.context.close(), red.context.close(), finalReviewer.context.close(),
      operator.context.close(), invalidGreen.context.close(), industry.context.close(), industryReview.context.close()]);
  });

  test("PARITY-NOTES-01 keeps concurrent operational notes editable and seat isolated", async ({ browser }) => {
    test.setTimeout(120_000);
    const author = await apiActor(browser, fixture.tokens.author);
    const notetaker = await apiActor(browser, fixture.tokens.blueNotetaker);
    const red = await apiActor(browser, fixture.tokens.redAuthor);
    const authorProjection = await author.readProjection();
    const notetakerProjection = await notetaker.readProjection();
    const authorNoteId = await createRuntimeArtifact(author, authorProjection, "note", {}, [fixture.participants.blueNotetaker]);
    const notetakerNoteId = await createRuntimeArtifact(notetaker, notetakerProjection, "note");

    const pool = new Pool({ connectionString: databaseUrl, max: 1 });
    try {
      const authors = await pool.query(`SELECT author.display_name,author.organization_name,author.is_command_actor
        FROM runtime.artifact_revision_authors author JOIN runtime.artifact_revisions revision
          ON revision.organization_id=author.organization_id AND revision.id=author.artifact_revision_id
        WHERE revision.artifact_id=$1 AND revision.artifact_version=1 ORDER BY author.author_order`, [authorNoteId]);
      expect(authors.rows).toEqual([
        { display_name: "Synthetic Blue author", organization_name: "PS-150 synthetic organization", is_command_actor: true },
        { display_name: "Synthetic Blue notetaker", organization_name: "PS-150 synthetic organization", is_command_actor: false }
      ]);
    } finally { await pool.end(); }

    const refreshedAuthor = await author.readProjection();
    expect(refreshedAuthor.artifacts.map(({ id }) => id)).toContain(authorNoteId);
    expect(refreshedAuthor.artifacts.map(({ id }) => id)).not.toContain(notetakerNoteId);
    const authorNote = refreshedAuthor.artifacts.find(({ id }) => id === authorNoteId);
    const edited = await submitRuntime(author, refreshedAuthor, "artifact.edit", authorNoteId, 1, {
      content: representativePayload(authorNote.form, { notes: "Autosaved operational note revision." })
    });
    expect(edited.status()).toBe(200);
    expect((await author.readProjection()).artifacts.find(({ id }) => id === authorNoteId)).toMatchObject({ version: 2 });

    const forbidden = await submitRuntime(notetaker, notetakerProjection, "artifact.edit", authorNoteId, 1, {
      content: representativePayload(authorNote.form)
    });
    expect(forbidden.status()).toBe(409);
    expect((await forbidden.json()).errorCode).toBe("TARGET_NOT_FOUND");
    expect((await red.readProjection()).artifacts.map(({ id }) => id)).not.toContain(authorNoteId);
    await Promise.all([author.context.close(), notetaker.context.close(), red.context.close()]);
  });

  test("PARITY-CONTROL-01 exercises timer, reset, advance, return, stale and reconnect controls", async ({ browser }) => {
    const control = await apiActor(browser, fixture.tokens.finalReviewer);
    let projection = await control.readProjection();
    expect(projection).toMatchObject({ currentStageId: "m1-deliberation", currentStageStatus: "active" });
    expect((await submitRuntime(control, projection, "timer.pause", fixture.sessionId, 2, { reason: "Parity pause" })).status()).toBe(200);
    const stale = await submitRuntime(control, projection, "timer.resume", fixture.sessionId, 2, { reason: "Stale parity resume" });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).errorCode).toBe("STALE_AGGREGATE_VERSION");
    expect((await submitRuntime(control, projection, "timer.resume", fixture.sessionId, 3, { reason: "Parity resume" })).status()).toBe(200);
    const beforeExtension = await control.readProjection();
    expect((await submitRuntime(control, projection, "timer.extend", fixture.sessionId, 4,
      { reason: "Per-mark allocation", seconds: 60 })).status()).toBe(200);
    projection = await control.readProjection();
    expect(Date.parse(projection.stageDeadlineAt) - Date.parse(beforeExtension.stageDeadlineAt)).toBe(60_000);
    expect((await submitRuntime(control, projection, "stage.end", fixture.sessionId, 5, { reason: "End mark" })).status()).toBe(200);
    expect((await submitRuntime(control, projection, "stage.reopen", fixture.sessionId, 6, { reason: "Reset mark" })).status()).toBe(200);
    expect((await submitRuntime(control, projection, "stage.advance", fixture.sessionId, 7,
      { reason: "Advance mark", targetStageId: "m1-consultation" })).status()).toBe(200);
    projection = await control.readProjection();
    expect(projection.currentStageId).toBe("m1-consultation");
    expect((await submitRuntime(control, projection, "stage.return", fixture.sessionId, 8,
      { reason: "Return to prior mark", targetStageId: "m1-deliberation" })).status()).toBe(200);
    await control.context.close();
    const reconnected = await apiActor(browser, fixture.tokens.finalReviewer);
    expect(await reconnected.readProjection()).toMatchObject({ currentStageId: "m1-deliberation", currentStageStatus: "active" });
    await reconnected.context.close();
  });

  test("AC-08/10 keeps stale and lost-acknowledgement states truthful", async ({ browser }) => {
    const author = await actor(browser, fixture.tokens.author);
    await author.page.goto(runtimeUrl());
    await createBlueActionDraft(author.page, "Stale version proof");

    const deviceResponse = await author.context.request.post("/v1/devices", { data: {} });
    const { deviceId } = await deviceResponse.json();
    const projectionResponse = await author.context.request.get(`/v1/sessions/${fixture.sessionId}/runtime-projection`, { headers: { "x-device-id": deviceId } });
    const projection = await projectionResponse.json();
    const unavailablePlugin = await author.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId, operationType: "composition_run.start", aggregateId: crypto.randomUUID(),
      expectedAggregateVersion: 0, governingReleaseId: projection.releaseId,
      activeSessionRoleId: projection.activeSessionRoleId, payload: { planId: "unavailable-plan" }
    } });
    expect(unavailablePlugin.status()).toBe(409);
    expect((await unavailablePlugin.json()).errorCode).toBe("CAPABILITY_UNAVAILABLE");
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
    await expect(author.page.getByText(/Authoritative state changed: The Artifact is at version 2/)).toBeVisible({ timeout: 15_000 });

    let intercepted = false;
    let lostCommand;
    await author.page.route("**/v1/sessions/*/commands", async (route) => {
      if (intercepted) return route.continue();
      intercepted = true;
      lostCommand = route.request().postDataJSON();
      const response = await route.fetch();
      await response.body();
      await route.abort("failed");
    });
    const create = await fillBlueAction(author.page, "Lost acknowledgement proof");
    await create.getByRole("button", { name: "Save draft" }).click();
    await expect(author.page.getByText("Delivery acknowledgement was lost. This Command is still local pending, not accepted.")).toBeVisible({ timeout: 15_000 });
    await author.page.unroute("**/v1/sessions/*/commands");
    const retries = await Promise.all([1, 2, 3].map(() => author.context.request.post(
      `/v1/sessions/${fixture.sessionId}/commands`, { data: lostCommand }
    )));
    expect(retries.map((response) => response.status())).toEqual([200, 200, 200]);
    const retryReceipts = await Promise.all(retries.map((response) => response.json()));
    expect(new Set(retryReceipts.map(({ evidenceSequence }) => evidenceSequence)).size).toBe(1);
    expect(retryReceipts.every(({ replayed }) => replayed === true)).toBe(true);
    await expect(author.page.getByText("Reconnect complete: 1 accepted.")).toBeVisible({ timeout: 15_000 });
    await expect(author.page.getByRole("region", { name: "Offline Outbox" }).getByText("artifact.create")).toHaveCount(0);
    await expect(author.page.locator('input[value="Lost acknowledgement proof"]').first()).toBeVisible();
    await author.context.close();
  });

  test("AC-06/13 reconciles a structured export with canonical accepted and rejected Evidence Events", async ({ browser }) => {
    const author = await actor(browser, fixture.tokens.author);
    const deviceId = (await (await author.context.request.post("/v1/devices", { data: {} })).json()).deviceId;
    const projection = await (await author.context.request.get(`/v1/sessions/${fixture.sessionId}/runtime-projection`, {
      headers: { "x-device-id": deviceId }
    })).json();
    const rejectedResponse = await author.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
      commandId: crypto.randomUUID(), deviceId, operationType: "composition_run.start", aggregateId: crypto.randomUUID(),
      expectedAggregateVersion: 0, governingReleaseId: projection.releaseId,
      activeSessionRoleId: projection.activeSessionRoleId, payload: { planId: "missing-first-proof-plan" }
    } });
    expect(rejectedResponse.status()).toBe(409);
    const rejected = await rejectedResponse.json();
    expect(rejected).toMatchObject({ status: "rejected", errorCode: "CAPABILITY_UNAVAILABLE",
      evidenceSequence: expect.any(Number) });

    const operator = await actor(browser, fixture.tokens.operator);
    const grantResponse = await operator.context.request.post(`/v1/projects/${fixture.projectId}/research-access-grants`, { data: {
      analystPersonId: fixture.people.designerB,
      protocolReference: "PS-350 canonical export reconciliation",
      expiresAt: "2099-01-01T00:00:00.000Z"
    } });
    expect(grantResponse.status()).toBe(201);
    const analyst = await actor(browser, fixture.tokens.designerB);
    const exportResponse = await analyst.context.request.get(`/v1/sessions/${fixture.sessionId}/research-evidence-index`);
    expect(exportResponse.status()).toBe(200);
    const exported = await exportResponse.json();
    const exportedRejection = exported.events.find(({ sequence }) => sequence === rejected.evidenceSequence);
    expect(exportedRejection).toMatchObject({ eventType: "command.rejected", governingReleaseId: projection.releaseId });
    expect(exported.events.some(({ eventType }) => eventType === "artifact.accepted")).toBe(true);

    const database = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    try {
      const canonical = await database.query(
        `SELECT sequence,event_type,event_version,governing_release_id,recorded_at
           FROM evidence.events WHERE organization_id=$1 AND session_id=$2 ORDER BY sequence`,
        [fixture.organizationId, fixture.sessionId]
      );
      expect(exported.events).toEqual(canonical.rows.map((row) => ({
        sequence: Number(row.sequence), eventType: row.event_type, eventVersion: row.event_version,
        governingReleaseId: row.governing_release_id, recordedAt: row.recorded_at.toISOString()
      })));
    } finally {
      await database.end();
    }
    const consentResponse = await analyst.context.request.post(`/v1/sessions/${fixture.sessionId}/research-consents`, { data: {
      purposeLabel: "PS-520 browser reconciliation", consentVersion: "1.0", decision: "granted"
    } });
    expect(consentResponse.status()).toBe(201);
    const idempotencyKey = crypto.randomUUID();
    const reportRequest = { idempotencyKey, reportKind: "research_dataset", format: "json",
      purposeLabel: "PS-520 browser reconciliation" };
    const reportResponse = await analyst.context.request.post(`/v1/sessions/${fixture.sessionId}/reports`, { data: reportRequest });
    expect(reportResponse.status()).toBe(200);
    const reportText = await reportResponse.text();
    const report = JSON.parse(reportText);
    expect(report).toMatchObject({ contractId: "research-export-v1", anonymizationProfile: "consent-filtered-ordinal-v1" });
    expect(report.excludedDataClasses).toContain("secret_ballot_choices");
    expect(reportText).not.toContain(fixture.people.designerB);
    expect(reportText).not.toContain(fixture.participants.industryAuthor);
    const replayedReport = await analyst.context.request.post(`/v1/sessions/${fixture.sessionId}/reports`, { data: reportRequest });
    expect(await replayedReport.text()).toBe(reportText);
    await Promise.all([author.context.close(), operator.context.close(), analyst.context.close()]);
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
    await expect(control.page.getByText("Direct RFI coordination message.", { exact: true })).toHaveCount(1, { timeout: 15_000 });
    await control.page.reload();
    await expect(control.page.getByText("Direct RFI coordination message.", { exact: true })).toHaveCount(1, { timeout: 15_000 });
    await expect(control.page.locator(".live-region")).toBeEmpty();

    await participant.page.goto(runtimeUrl());
    await expect(participant.page.getByText("Reconnect parity broadcast.", { exact: true })).toHaveCount(1, { timeout: 15_000 });
    await participant.context.setOffline(true);
    await expect(participant.page.getByLabel("Connection status: Offline")).toBeVisible();
    await participant.context.setOffline(false);
    await expect(participant.page.getByLabel("Plenum status: Connected")).toBeVisible({ timeout: 15_000 });
    await expect(participant.page.getByText("Reconnect parity broadcast.", { exact: true })).toHaveCount(1);
    await expect(participant.page.locator(".live-region")).toHaveText("Connection restored. Refreshing authoritative state.");
    await Promise.all(actors.map(({ context }) => context.close()));
  });

  test("@a11y PS-210 completes isolated multi-round proposal negotiation and two-sided closure", async ({ browser }) => {
    test.setTimeout(120_000);
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
      // This scenario tests proposal accessibility, so seed its unrelated completed-orientation precondition directly.
      const stageDatabase = new Pool({ connectionString: databaseUrl, max: 1 });
      try {
        await stageDatabase.query(
          `UPDATE runtime.session_stage_state
              SET stage_id='m1-deliberation',status='active',version=2,updated_at=transaction_timestamp()
            WHERE organization_id=$1 AND session_id=$2`,
          [fixture.organizationId, fixture.sessionId]
        );
      } finally {
        await stageDatabase.end();
      }
    }
    await control.page.goto(runtimeUrl());
    await expect(control.page.getByRole("heading", { name: "Proposal custody" })).toBeVisible({ timeout: 15_000 });
    await expect(control.page.getByRole("heading", { name: "Messages" })).toBeVisible();
    await expect(control.page.getByRole("heading", { name: "Injects" })).toBeVisible();
    await source.page.goto(runtimeUrl());
    await expect(source.page.getByRole("heading", { name: "Proposal negotiations" })).toBeVisible({ timeout: 15_000 });
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
    await expect(recipient.page.getByRole("heading", { name: "Proposal negotiations" })).toBeVisible({ timeout: 15_000 });
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
    await expect(loading.page.getByRole("heading", { name: "Blue Facilitator workspace" })).toBeVisible({ timeout: 15_000 });
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
    test.setTimeout(1_200_000);
    const serverTimeout = 20_000;
    const first = await actor(browser, fixture.tokens.publisher, { viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
    const second = await actor(browser, fixture.tokens.designerA, { viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await Promise.all([first.page.goto(studioUrl()), second.page.goto(studioUrl())]);
    await expect(first.page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 40_000 });
    await expect(second.page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 120_000 });
    await expect(first.page.locator(".studio-context h1")).toBeVisible();

    const teams = await openStudioWorkspace(first.page, "Teams");
    await teams.getByRole("button", { name: "Add Team" }).click();
    await teams.getByText("New Team", { exact: true }).click();
    await teams.getByLabel("Team name").last().fill("Browser-created Team");

    const roles = await openStudioWorkspace(first.page, "Session Roles");
    await roles.locator("details").first().locator("summary").click();
    await roles.getByLabel("Description").first().fill("Configured by the PS-350 visual proof.");
    const stages = await openStudioWorkspace(first.page, "Stages");
    await stages.locator("details[id^='stages-']").first().locator("summary").click();
    await stages.getByLabel("Duration in seconds (0 for untimed)").first().fill("1799");
    const forms = await openStudioWorkspace(first.page, "Forms & Artifacts", "Forms & Artifact Types");
    await forms.locator("details[id^='forms-']").first().locator("summary").click();
    await forms.getByLabel("Form name").first().fill("PS-350 browser-configured form");
    const workflows = await openStudioWorkspace(first.page, "Workflows");
    await workflows.locator("details[id^='workflows-']").first().locator("summary").click();
    await workflows.getByLabel("Workflow name").first().fill("PS-350 DEC-42 review workflow");
    await expect(first.page.getByText("Synchronized", { exact: true })).toBeVisible({ timeout: 40_000 });

    const firstOverview = await openStudioWorkspace(first.page, "Overview & Scenario");
    await firstOverview.getByLabel("Scenario name").fill("Browser convergence proof");
    await expect(first.page.getByText("Synchronized", { exact: true })).toBeVisible({ timeout: 40_000 });
    await expect(second.page.getByLabel("Scenario name")).toHaveValue("Browser convergence proof", { timeout: 20_000 });
    await second.context.setOffline(true);
    await second.page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await second.page.getByLabel("Scenario description").fill("Offline visual-form edit merged after reconnect.");
    await expect(second.page.getByText("Offline", { exact: true })).toBeVisible();
    await expect(second.page.getByText("Saved on this device", { exact: true })).toBeVisible();
    await second.context.setOffline(false);
    await second.page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(second.page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 40_000 });
    await expect(second.page.getByText("Synchronized", { exact: true })).toBeVisible({ timeout: 120_000 });
    await expect(first.page.getByLabel("Scenario description")).toHaveValue("Offline visual-form edit merged after reconnect.", { timeout: 20_000 });
    await expect(second.page.getByLabel("Scenario name")).toHaveValue("Browser convergence proof", { timeout: 20_000 });
    await expect(first.page.locator(".studio-state-strip").getByText("Ready for review", { exact: true })).toBeVisible();
    await expect(first.page.getByText("Synchronized", { exact: true })).toBeVisible();

    const polls = await openStudioWorkspace(first.page, "Polls");
    await polls.locator("details").filter({ hasText: "Adopt the synthetic accessibility resolution?" }).locator("summary").click();
    await expect(polls.getByText(/Counting rule: Count accepted ballots using simple majority over valid votes/u)).toBeVisible();
    await expect(polls.getByText(/Electorate preview: Everyone/u)).toBeVisible();
    const voice = await openStudioWorkspace(first.page, "Voice Channels");
    await voice.locator("details").filter({ hasText: "Team open room" }).locator("summary").click();
    await expect(voice.getByRole("table", { name: "Selected adapter capability by target profile" })).toBeVisible();
    await expect(voice.getByRole("table", { name: "Effective configured permissions. Public access, when selected, applies to every row." })).toBeVisible();

    const preview = await openStudioWorkspace(first.page, "Role walkthrough", "Role & Stage preview");
    await preview.getByLabel("Session Role").selectOption("scribe");
    await preview.getByLabel("Stage").selectOption("orientation");
    await preview.getByLabel("Team").selectOption("blue");
    await preview.getByRole("button", { name: "Preview interface" }).click();
    await expect(preview.getByText("Preview updated.")).toBeVisible({ timeout: serverTimeout });
    await expect(preview.getByLabel("Scribe interface preview")).toBeVisible({ timeout: serverTimeout });
    await expect(preview.getByRole("heading", { name: "Opening brief" })).toBeVisible();

    const publication = await openStudioWorkspace(first.page, "Review & publish", "Review and publish");
    await publication.getByLabel("Release label").fill("PS-300 browser proof");
    await publication.getByLabel("Semantic version").fill("3.0.0");
    await publication.getByLabel("Release notes").fill("Collaborative browser acceptance proof.");
    await publication.getByText("Governance references").click();
    await publication.getByLabel("Classification review reference").fill("browser-classification-review");
    await publication.getByLabel("Retention policy reference", { exact: true }).fill("standard-retention");
    await publication.getByLabel("Approval notes").fill("Synthetic browser approval.");
    await publication.getByLabel("I acknowledge the validation warnings.").check();
    await publication.getByRole("button", { name: "Freeze for review" }).click();
    await expect(first.page.getByText(/is frozen and ready for Reviewer approval/u)).toBeVisible({ timeout: serverTimeout });
    const reviewer = await actor(browser, fixture.tokens.finalReviewer, { viewport: { width: 1024, height: 768 }, reducedMotion: "reduce" });
    await reviewer.page.goto(studioUrl());
    const reviewerPublication = await openStudioWorkspace(reviewer.page, "Review & publish", "Review and publish");
    await expect(reviewerPublication.getByRole("button", { name: "Approve freeze" })).toBeEnabled({ timeout: serverTimeout });
    await reviewerPublication.getByLabel("Methodology review notes").fill("Synthetic independent methodology review.");
    await reviewerPublication.getByRole("button", { name: "Approve freeze" }).click();
    await expect(reviewer.page.getByText(/Reviewer approval was recorded/u)).toBeVisible({ timeout: serverTimeout });
    await reviewer.context.close();
    await publication.getByRole("button", { name: "Freeze for review" }).click();
    await expect(first.page.getByText("1 current approval.")).toBeVisible({ timeout: serverTimeout });
    const publishedResponse = first.page.waitForResponse((response) =>
      response.request().method() === "POST" && response.url().endsWith(`/v1/projects/${fixture.projectId}/publish`));
    await publication.getByRole("button", { name: "Publish approved freeze" }).click();
    publishedReleaseId = (await (await publishedResponse).json()).releaseId;
    expect(publishedReleaseId).toMatch(/^[0-9a-f-]{36}$/u);
    await expect(first.page.getByText("Published PS-300 browser proof.")).toBeVisible({ timeout: 20_000 });
    await expect(first.page.getByText("Published", { exact: true })).toBeVisible({ timeout: 20_000 });

    await second.page.getByLabel("Scenario description").fill("Post-freeze next Draft edit.");
    await expect(second.page.getByText("Synchronized", { exact: true })).toBeVisible({ timeout: 120_000 });
    const returnedOverview = await openStudioWorkspace(first.page, "Overview & Scenario");
    await expect(returnedOverview.getByLabel("Scenario description")).toHaveValue("Post-freeze next Draft edit.", { timeout: 20_000 });
    await expect(first.page.getByText("Synchronized", { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page: first.page }).analyze()).violations).toEqual([]);
    await first.page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await expect.poll(() => first.page.evaluate(() => [...document.querySelectorAll("body *")].filter((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.right > document.documentElement.clientWidth + 1 || bounds.left < -1;
    }).slice(0, 12).map((element) => ({ element: `${element.tagName.toLowerCase()}.${element.className}`, right: Math.round(element.getBoundingClientRect().right),
      width: Math.round(element.getBoundingClientRect().width), text: element.textContent?.trim().slice(0, 80) })))).toEqual([]);
    await Promise.all([first.context.close(), second.context.close()]);
  });

  test("AC-03 creates a Session from the Release published in the visual journey", async ({ browser }) => {
    expect(publishedReleaseId).toMatch(/^[0-9a-f-]{36}$/u);
    const operator = await actor(browser, fixture.tokens.operator);
    const createdResponse = await operator.context.request.post(`/v1/projects/${fixture.projectId}/sessions`, {
      data: { releaseId: publishedReleaseId }
    });
    expect(createdResponse.status()).toBe(201);
    const created = await createdResponse.json();
    expect(created).toMatchObject({
      contractId: "session-onboarding-v1",
      projectId: fixture.projectId,
      governingReleaseId: publishedReleaseId,
      status: "created"
    });
    const designer = await actor(browser, fixture.tokens.designerA);
    const denied = await designer.context.request.post(`/v1/projects/${fixture.projectId}/sessions`, {
      data: { releaseId: publishedReleaseId }
    });
    expect(denied.status()).toBe(403);
    expect((await denied.json()).error.code).toBe("PERMISSION_DENIED");
    await Promise.all([operator.context.close(), designer.context.close()]);
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
    const stages = await openStudioWorkspace(first.page, "Stages");
    const stageCards = stages.locator("details[id^='stages-']");
    await expect(stageCards).toHaveCount(16, { timeout: 20_000 });
    const stageIdsBefore = await stageCards.evaluateAll((items) => items.map(({ id }) => id));
    await stageCards.nth(1).locator("summary").click();
    await stageCards.nth(1).getByRole("button", { name: "Earlier" }).click();
    const expectedStageIds = [stageIdsBefore[1], stageIdsBefore[0], ...stageIdsBefore.slice(2)];
    await expect.poll(() => stageCards.evaluateAll((items) => items.map(({ id }) => id))).toEqual(expectedStageIds);
    await expect(first.page.getByText("Saved on this device", { exact: true })).toBeVisible();
    await expect(first.page.getByText("Synchronized", { exact: true })).toBeVisible({ timeout: 20_000 });
    const secondStages = await openStudioWorkspace(second.page, "Stages");
    const secondStageCards = secondStages.locator("details[id^='stages-']");
    await expect.poll(() => secondStageCards.evaluateAll((items) => items.map(({ id }) => id)), { timeout: 20_000 }).toEqual(expectedStageIds);
    await Promise.all([first.context.close(), second.context.close()]);
  });

  test("@a11y EXT-12 EXT-13 EXT-14 builds and previews a two-model composition without code", async ({ browser }) => {
    test.setTimeout(180_000);
    const designer = await actor(browser, fixture.tokens.publisher, { viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    await designer.page.goto(studioUrl());
    await expect(designer.page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 20_000 });
    const plugins = await openStudioWorkspace(designer.page, "Plugin catalog & bindings");
    await expect(plugins.getByText("2 approved installed Plugins available.")).toBeVisible({ timeout: 20_000 });
    const catalogCards = plugins.locator(".catalog-card");
    await expect(catalogCards).toHaveCount(2);
    await catalogCards.nth(0).getByRole("button", { name: "Bind installed Plugin" }).click();
    await catalogCards.nth(1).getByRole("button", { name: "Bind installed Plugin" }).click();
    const effectBinding = plugins.locator("details").filter({ hasText: "org.ssg.fixtures.effect 1.0.0" });
    await effectBinding.locator("summary").click();
    await effectBinding.getByRole("button", { name: "Add input port" }).click();
    await expect(effectBinding.getByRole("group", { name: "Input ports" }).getByLabel("Port label")).toHaveValue("Input 1");
    await expect(designer.page.getByText("Synchronized", { exact: true })).toBeVisible({ timeout: 40_000 });

    const compositions = await openStudioWorkspace(designer.page, "Model Compositions");
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
    await expect(designer.page.getByText("Synchronized", { exact: true })).toBeVisible({ timeout: 40_000 });
    await composition.getByRole("button", { name: "Run fixture without state change" }).click();
    await expect(composition.getByText("Status: completed")).toBeVisible({ timeout: 20_000 });
    await expect(composition.getByText("State changes: 0")).toBeVisible();
    expect((await new AxeBuilder({ page: designer.page }).include("#plugins").include("#compositions").analyze()).violations).toEqual([]);
    await designer.context.close();
  });

  test("@a11y PS-410 reviews, explains and publishes an adjudication without exposing hidden notes", async ({ browser }) => {
    test.setTimeout(90_000);
    expect(databaseUrl).toBeTruthy();
    const pool = new Pool({ connectionString: databaseUrl, max: 1 });
    const actionId = "66000000-0000-4000-8000-000000000001";
    const requestId = "66000000-0000-4000-8000-000000000002";
    try {
      await pool.query(`INSERT INTO runtime.artifact_instances
        (id,organization_id,session_id,governing_release_id,artifact_type_key,workflow_key,form_version,
         creator_participant_id,owner_team_id,state,payload,visible_role_ids,version)
        VALUES ($1,$2,$3,$4,'blue_action','action_submission_review','1.0.0',$5,'blue','completed',
          '{"title":"Synthetic adjudication Action"}'::jsonb,ARRAY['white_cell'],1)`,
        [actionId, fixture.organizationId, fixture.sessionId, fixture.releaseId, fixture.participants.author]);
      await pool.query(`INSERT INTO runtime.adjudication_requests
        (id,organization_id,session_id,governing_release_id,adjudication_model_id,requested_by_person_id,
         requested_by_participant_id,requested_by_display_name,requested_by_organization_name)
        VALUES ($1,$2,$3,$4,'manual-white-cell',$5,$6,'Synthetic final reviewer','PS-150 synthetic organization')`,
        [requestId, fixture.organizationId, fixture.sessionId, fixture.releaseId,
          fixture.people.finalReviewer, fixture.participants.finalReviewer]);
      await pool.query(`INSERT INTO runtime.adjudication_request_actions
        (id,organization_id,session_id,request_id,artifact_id,artifact_version,artifact_type_key,payload_sha256,payload_snapshot)
        VALUES (gen_random_uuid(),$1,$2,$3,$4,1,'blue_action',repeat('a',64),'{"title":"Synthetic adjudication Action"}'::jsonb)`,
        [fixture.organizationId, fixture.sessionId, requestId, actionId]);
    } finally { await pool.end(); }

    const control = await actor(browser, fixture.tokens.finalReviewer, { viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    await control.page.goto(runtimeUrl());
    const adjudication = control.page.getByRole("article", { name: "Authorized adjudicator review" });
    await expect(adjudication).toBeVisible({ timeout: 20_000 });
    await adjudication.getByLabel("Recommendation").fill("Approve with a bounded narrative consequence");
    await adjudication.getByLabel("Rationale", { exact: true }).fill("The submitted Action is coherent and supported by the visible evidence.");
    await adjudication.getByLabel(/Restricted analytical notes/u).fill("Hidden synthetic control note");
    await adjudication.getByRole("button", { name: "Submit reviewer input" }).click();
    await adjudication.getByText("Reviewer inputs (1)").click();
    await expect(adjudication.getByText("Synthetic final reviewer", { exact: true })).toBeVisible({ timeout: 20_000 });

    await adjudication.getByLabel("Final outcome").fill("Action approved");
    await adjudication.getByLabel("Decision rationale").fill("The authorized adjudicator approved the Action after reviewing its evidence.");
    await adjudication.getByLabel("Participant-facing rationale").fill("Your Action was approved after review.");
    await adjudication.getByLabel("Reviewer synthesis").fill("The distinct reviewer input supports approval.");
    await adjudication.getByRole("button", { name: "Save draft synthesis" }).click();
    await expect(adjudication.getByRole("heading", { name: "Draft outcome" })).toBeVisible({ timeout: 20_000 });
    await adjudication.getByText(/^Explanation trace \(/u).click();
    await expect(adjudication.getByText(/Authorized human judgment required/u)).toBeVisible();
    expect((await new AxeBuilder({ page: control.page }).include(".adjudication").analyze()).violations).toEqual([]);
    await adjudication.getByRole("button", { name: "Publish outcome and effects" }).click();
    await expect(adjudication.getByRole("heading", { name: "Published outcome" })).toBeVisible({ timeout: 20_000 });
    await control.page.screenshot({ path: `${evidenceRoot}/ps-410-adjudication.png`, fullPage: true });

    const participant = await actor(browser, fixture.tokens.author);
    await participant.page.goto(runtimeUrl());
    const published = participant.page.getByRole("article", { name: "Authorized adjudicator review" });
    await expect(published.getByText("Your Action was approved after review.")).toBeVisible({ timeout: 20_000 });
    await expect(published.getByText("Hidden synthetic control note")).toHaveCount(0);
    await Promise.all([control.context.close(), participant.context.close()]);
  });

  test("@a11y PS-400 authors bounded branches, counted capabilities and delayed effects without code", async ({ browser }) => {
    test.setTimeout(180_000);
    const designer = await actor(browser, fixture.tokens.publisher, { viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    await designer.page.goto(studioUrl());
    await expect(designer.page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 40_000 });

    const stages = await openStudioWorkspace(designer.page, "Stages");
    await stages.locator("details[id^='stages-']").first().locator("summary").click();
    await expect(stages.getByLabel("Outgoing branch behavior").first()).toHaveValue("exclusive");
    await expect(stages.getByLabel("Incoming merge behavior").first()).toHaveValue("");

    const workflows = await openStudioWorkspace(designer.page, "Workflows");
    await workflows.locator("details[id^='workflows-']").first().locator("summary").click();
    await expect(workflows.getByRole("button", { name: "Add Workflow transition" }).first()).toBeVisible();

    const advanced = await openStudioWorkspace(designer.page, "Advanced logic & world state");
    await advanced.getByRole("button", { name: "Add State Value" }).click();
    await advanced.getByRole("button", { name: "Add Capability" }).click();
    await advanced.getByLabel("Capability mode").last().selectOption("counted");
    await advanced.getByLabel("Renew on Stage type").last().check();
    await expect(advanced.getByLabel("Renew quantity").last()).toHaveValue("1");
    await expect(advanced.getByLabel("Branch priority").first()).toBeVisible();

    const inject = advanced.locator("details").filter({ hasText: "Opening briefing" });
    await inject.locator("summary").click();
    await inject.getByRole("button", { name: "Add State Effect" }).click();
    await inject.getByLabel("Delay in seconds").last().fill("30");
    await expect(inject.getByLabel("Delay in seconds").last()).toHaveValue("30");
    expect((await new AxeBuilder({ page: designer.page }).include("#stages").include("#workflows").include("#advanced-logic").analyze()).violations).toEqual([]);
    await designer.page.screenshot({ path: `${evidenceRoot}/ps-400-advanced-logic.png`, fullPage: true });
    await designer.context.close();
  });

  test("@a11y AC-07 AC-11 SYNC-09 activates a reviewed Release while live work stays pinned", async ({ browser }) => {
    test.setTimeout(90_000);
    expect(databaseUrl).toBeTruthy();
    const pool = new Pool({ connectionString: databaseUrl, max: 1 });
    try {
      await pool.query(`INSERT INTO voting.polls
        (id,organization_id,session_id,governing_release_id,definition_id,definition_revision,definition,
         definition_sha256,status,opened_at,version,authority_epoch,created_by)
        SELECT $1,$2,$3,$4,'ps420-browser-open',1,poll,repeat('e',64),'open',now(),1,1,$5
          FROM studio.definition_revisions revision,
               jsonb_array_elements(revision.snapshot->'coreDesign'->'polls') poll
         WHERE revision.id=$6 AND poll->>'id'='synthetic-resolution'`,
        [fixture.activationPollId, fixture.organizationId, fixture.sessionId, fixture.releaseId,
          fixture.people.operator, fixture.revisionId]);
      await pool.query(`INSERT INTO extension.composition_runs
        (id,organization_id,session_id,governing_release_id,trigger_command_id,graph_digest,input_snapshot_id,
         input_snapshot,input_digest,execution_policy,authority_epoch,status,correlation_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'{}'::jsonb,$8,'{}'::jsonb,1,'running',$9)`,
        [fixture.activationCompositionId, fixture.organizationId, fixture.sessionId, fixture.releaseId,
          "64000000-0000-4000-8000-000000000002", `sha256:${"a".repeat(64)}`,
          "64000000-0000-4000-8000-000000000003", `sha256:${"b".repeat(64)}`,
          "64000000-0000-4000-8000-000000000004"]);

      const reviewer = await actor(browser, fixture.tokens.finalReviewer, { viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
      await reviewer.page.goto(studioUrl());
      const reviewChanges = await openStudioWorkspace(reviewer.page, "Live Changes", "Activate a Release");
      await reviewChanges.getByLabel("Session").selectOption(fixture.sessionId);
      await reviewChanges.getByLabel("Candidate Release").selectOption(fixture.activationReleaseId);
      await reviewChanges.getByRole("button", { name: "Preview impact" }).click();
      await expect(reviewChanges.getByText("Impact preview is ready for explicit review.")).toBeVisible({ timeout: 20_000 });
      await expect(reviewChanges.getByText("consequential", { exact: true })).toBeVisible();
      await expect(reviewChanges.locator(".impact-counts > div").filter({ hasText: "Open Polls" })).toContainText("1");
      await expect(reviewChanges.locator(".impact-counts > div").filter({ hasText: "In-flight compositions" })).toContainText("1");
      expect((await new AxeBuilder({ page: reviewer.page }).include(".live-changes").analyze()).violations).toEqual([]);
      await reviewChanges.getByLabel(/I reviewed this exact impact/u).check();
      await reviewChanges.getByRole("button", { name: "Record fresh Reviewer approval" }).click();
      await expect(reviewChanges.getByText(/Fresh Reviewer approval recorded/u)).toBeVisible({ timeout: 20_000 });
      await reviewer.context.close();

      const operator = await actor(browser, fixture.tokens.operator, { viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
      await operator.page.goto(studioUrl());
      const liveChanges = await openStudioWorkspace(operator.page, "Live Changes", "Activate a Release");
      await liveChanges.getByLabel("Session").selectOption(fixture.sessionId);
      await liveChanges.getByLabel("Candidate Release").selectOption(fixture.activationReleaseId);
      await liveChanges.getByRole("button", { name: "Preview impact" }).click();
      await expect(liveChanges.getByText(/Current approval:/u)).toBeVisible({ timeout: 20_000 });
      await liveChanges.getByLabel(/I reviewed this exact impact/u).check();
      await liveChanges.getByRole("button", { name: "Activate for new work" }).click();
      await expect(liveChanges.getByText(/is active for new work. Existing work remains pinned/u)).toBeVisible({ timeout: 20_000 });
      await operator.page.screenshot({ path: `${evidenceRoot}/ps-420-live-release-activation.png`, fullPage: true });

      const historyResponse = await operator.context.request.get(`/v1/sessions/${fixture.sessionId}/release-history`);
      expect(historyResponse.status()).toBe(200);
      expect((await historyResponse.json()).activeReleaseId).toBe(fixture.activationReleaseId);
      const deviceId = (await (await operator.context.request.post("/v1/devices", { data: {} })).json()).deviceId;
      const staleResponse = await operator.context.request.post(`/v1/sessions/${fixture.sessionId}/release-activations`, { data: {
        commandId: crypto.randomUUID(), deviceId, operationType: "release.activate", aggregateId: fixture.sessionId,
        expectedAggregateVersion: 1, governingReleaseId: fixture.releaseId,
        payload: { candidateReleaseId: fixture.activationReleaseId, impactReviewId: crypto.randomUUID(),
          reportDigest: "0".repeat(64), existingInstanceHandling: "keep_existing" }
      } });
      expect(staleResponse.status()).toBe(409);
      expect((await staleResponse.json()).status).toBe("needs_reconciliation");

      const author = await apiActor(browser, fixture.tokens.author);
      const projection = await author.readProjection();
      expect(projection.releaseId).toBe(fixture.activationReleaseId);
      const newArtifactId = await createRuntimeArtifact(author, projection, "note");
      const pinned = await pool.query(`SELECT
        (SELECT governing_release_id FROM runtime.artifact_instances WHERE id=$1) AS existing_release,
        (SELECT governing_release_id FROM runtime.artifact_instances WHERE id=$2) AS new_release,
        (SELECT governing_release_id FROM voting.polls WHERE id=$3) AS poll_release,
        (SELECT governing_release_id FROM extension.composition_runs WHERE id=$4) AS composition_release`,
        [fixture.proposalArtifactId, newArtifactId, fixture.activationPollId, fixture.activationCompositionId]);
      expect(pinned.rows[0]).toEqual({ existing_release: fixture.releaseId, new_release: fixture.activationReleaseId,
        poll_release: fixture.releaseId, composition_release: fixture.releaseId });
      await Promise.all([operator.context.close(), author.context.close()]);
    } finally {
      await pool.end();
    }
  });
});
