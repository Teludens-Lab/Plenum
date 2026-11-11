import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { RoomServiceClient } from "livekit-server-sdk";
import { expect, test } from "@playwright/test";
import { fixture } from "./fixture.mjs";

test.use({ trace: "off" });

test("BA-04 real provider revokes an uncooperative radio publisher before its successor", async ({ browser, baseURL }) => {
  const endpoint = new URL(process.env.MEDIA_TEST_URL);
  test.skip(!["127.0.0.1", "localhost"].includes(endpoint.hostname), "BA-04 fault proof is limited to disposable loopback media");
  const provider = new RoomServiceClient(endpoint.origin, "devkey", "secret", { requestTimeout: 5, failover: false });
  const owner = new Pool({ connectionString: process.env.DATABASE_URL });
  const clients = [];
  const channelId = fixture.voiceChannels.radio;
  const floorPath = `/v1/sessions/${fixture.sessionId}/voice-channels/${channelId}/floor-requests`;
  try {
    await owner.query(`UPDATE comms.voice_channels SET definition=jsonb_set(jsonb_set(definition,'{radio,floorLeaseMs}','5000'),
      '{radio,maxTransmissionMs}','15000') WHERE id=$1`, [channelId]);
    for (const token of [fixture.tokens.author, fixture.tokens.reviewer]) {
      const context = await browser.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
      await context.grantPermissions(["local-network-access"], { origin: baseURL });
      clients.push({ context });
      const deviceId = (await (await context.request.post("/v1/devices", { data: {} })).json()).deviceId;
      const projection = await (await context.request.get(`/v1/sessions/${fixture.sessionId}/runtime-projection`,
        { headers: { "x-device-id": deviceId } })).json();
      const joined = await context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { data: {
        commandId: randomUUID(), deviceId, operationType: "voice_channel.join", aggregateId: channelId,
        expectedAggregateVersion: 1, governingReleaseId: fixture.releaseId, activeSessionRoleId: projection.activeSessionRoleId, payload: {}
      } });
      expect(joined.status()).toBe(200);
      const credential = (await joined.json()).mediaCredential;
      await context.setExtraHTTPHeaders({});
      const page = await context.newPage();
      page.on("requestfailed", (request) => console.log("BA-04 media transport failure", new URL(request.url()).origin, request.failure()?.errorText));
      page.on("console", (message) => {
        if (message.type() === "error") console.log("BA-04 browser diagnostic", message.text().replace(/\?[^\s'"<>]+/gu, "?<redacted>"));
      });
      await page.route("**/__ba04_media", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>BA-04 synthetic radio</title>" }));
      await page.goto("/__ba04_media");
      await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/livekit-client/dist/livekit-client.umd.js", import.meta.url)) });
      await page.evaluate(async ({ serverUrl, token }) => {
        window.radio = new LivekitClient.Room();
        await radio.connect(serverUrl, token);
        window.publishSyntheticAudio = async () => {
          window.synth = new AudioContext();
          const oscillator = synth.createOscillator(), destination = synth.createMediaStreamDestination();
          oscillator.connect(destination); oscillator.start(); await synth.resume();
          await radio.localParticipant.publishTrack(destination.stream.getAudioTracks()[0], { source: LivekitClient.Track.Source.Microphone });
        };
      }, credential);
      Object.assign(clients.at(-1), { page, deviceId, credential, activeSessionRoleId: projection.activeSessionRoleId,
        headers: { Authorization: `Bearer ${token}`, "x-device-id": deviceId } });
    }
    const requestFloor = async (client) => {
      const requestId = randomUUID(), connectionId = randomUUID();
      const response = await client.context.request.post(floorPath, { headers: client.headers,
        data: { requestId, connectionId, expectedAuthorityEpoch: 1 } });
      expect(response.status()).toBe(200);
      const lease = await response.json();
      expect(lease.status).toBe("granted");
      return { ...lease, connectionId };
    };
    const participant = (client) => provider.getParticipant(client.credential.room, client.credential.participantIdentity);
    const [first, second] = clients;
    const old = await requestFloor(first);
    await first.page.evaluate(() => publishSyntheticAudio());
    await expect.poll(async () => (await participant(first)).tracks.length).toBe(1);
    // The browser never renews, releases, or calls local mute. Only the server deadline advances.
    await owner.query("UPDATE comms.floor_leases SET expires_at=now()-interval '1 second' WHERE request_id=$1", [old.requestId]);
    await expect.poll(async () => (await participant(first)).permission.canPublish, { timeout: 10_000 }).toBe(false);
    expect((await participant(first)).tracks).toHaveLength(0);
    const next = await requestFloor(second);
    await second.page.evaluate(() => publishSyntheticAudio());
    expect((await participant(first)).permission.canPublish).toBe(false);
    await expect.poll(async () => (await participant(second)).tracks.length).toBe(1);
    const released = await second.context.request.post(`${floorPath}/${next.requestId}/release`, {
      headers: second.headers, data: { ...next, expectedAuthorityEpoch: 1 }
    });
    expect(released.status()).toBe(200);
    expect((await participant(second)).permission.canPublish).toBe(false);
    expect((await participant(second)).tracks).toHaveLength(0);
    await second.page.evaluate(() => radio.disconnect());
    const rejoin = await second.context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { headers: second.headers, data: {
      commandId: randomUUID(), deviceId: second.deviceId, operationType: "voice_channel.join", aggregateId: channelId,
      expectedAggregateVersion: 1, governingReleaseId: fixture.releaseId, activeSessionRoleId: second.activeSessionRoleId, payload: {}
    } });
    expect(rejoin.status()).toBe(200);
    const freshCredential = (await rejoin.json()).mediaCredential;
    await second.page.evaluate(({ serverUrl, token }) => radio.connect(serverUrl, token), freshCredential);
    expect((await participant(second)).permission.canPublish).toBe(false);
    const replay = await second.context.request.post(floorPath, { headers: second.headers,
      data: { requestId: next.requestId, connectionId: next.connectionId, expectedAuthorityEpoch: 1 } });
    expect((await replay.json()).error.code).toBe("FLOOR_TOKEN_EXPIRED");
    const fresh = await requestFloor(second);
    expect((await participant(second)).permission.canPublish).toBe(true);
    expect((await second.context.request.post(`${floorPath}/${fresh.requestId}/release`, { headers: second.headers,
      data: { ...fresh, expectedAuthorityEpoch: 1 } })).status()).toBe(200);
    console.log("BA-04 provider proof PASS: LiveKit revoked canPublish and unpublished synthetic audio; prior holder remained connected");
  } finally {
    await Promise.all(clients.map(({ context }) => context.close()));
    await owner.end();
  }
});
