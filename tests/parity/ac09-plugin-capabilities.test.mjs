import assert from "node:assert/strict";
import { test } from "node:test";

import { finalizePliCopyPacket, projectPliPacket, reviewPliSeat } from
  "../../packages/plugin-sdk/fixtures/fractured-order-parity/pli.mjs";
import { applyMediaPluginCommand, createMediaPluginState, INLINE_AUDIO_BYTES, participantRecordingNotice } from
  "../../packages/plugin-sdk/fixtures/fractured-order-parity/media.mjs";

test("PARITY-PLI-01 enforces matching-seat review, rationale, Macro unlock, final copy and Control read-only access", () => {
  let packet = { id: "pli-packet-1", macroUnlocked: false, seats: {
    macro: { key: "macro", assignedSessionRoleId: "macro-reviewer", status: "pending", engineValue: { trend: 2 } },
    narrative: { key: "narrative", assignedSessionRoleId: "narrative-reviewer", status: "pending", engineValue: { copy: "Engine copy" } }
  } };
  assert.throws(() => reviewPliSeat(packet, { seatKey: "macro", actorSessionRoleId: "wrong-reviewer", decision: "accept" }), /PERMISSION_DENIED/u);
  assert.throws(() => reviewPliSeat(packet, { seatKey: "macro", actorSessionRoleId: "macro-reviewer", decision: "override",
    overrideValue: { trend: 3 } }), /RATIONALE_REQUIRED/u);
  const macro = reviewPliSeat(packet, { seatKey: "macro", actorSessionRoleId: "macro-reviewer", decision: "override",
    overrideValue: { trend: 3 }, rationale: "Observed reference change" });
  packet = macro.packet;
  assert.equal(packet.macroUnlocked, true);
  assert.match(macro.inputSha256, /^[0-9a-f]{64}$/u);
  assert.match(macro.outputSha256, /^[0-9a-f]{64}$/u);
  packet = reviewPliSeat(packet, { seatKey: "narrative", actorSessionRoleId: "narrative-reviewer", decision: "accept" }).packet;
  const control = projectPliPacket(packet, "control-observer");
  assert.equal(control.readOnly, true);
  assert.equal(control.reviewSeatKey, null);
  const copyPacket = finalizePliCopyPacket(packet);
  assert.deepEqual(copyPacket.outputs, { macro: { trend: 3 }, narrative: { copy: "Engine copy" } });
  assert.match(copyPacket.sha256, /^[0-9a-f]{64}$/u);
});

test("PARITY-PLUGIN-01 covers enablement, audio routing, recorder lifecycle, notice, storage failure and unavailability", async () => {
  const storage = { objects: new Map(), async put(key, bytes) { this.objects.set(key, bytes.slice()); return key; } };
  await assert.rejects(applyMediaPluginCommand(createMediaPluginState(false), { type: "plugin.enable" }, storage), /CAPABILITY_UNAVAILABLE/u);
  let state = await applyMediaPluginCommand(createMediaPluginState(), { type: "plugin.enable" }, storage);
  state = await applyMediaPluginCommand(state, { type: "intercom.publish", id: "small", bytes: new Uint8Array([1, 2, 3]) }, storage);
  assert.equal(state.announcements.at(-1).delivery, "inline");
  const large = new Uint8Array(INLINE_AUDIO_BYTES + 1); large[0] = 7;
  state = await applyMediaPluginCommand(state, { type: "intercom.publish", id: "large", bytes: large }, storage);
  assert.equal(state.announcements.at(-1).delivery, "storage");
  assert.equal(storage.objects.get("intercom/large").byteLength, large.byteLength);
  const beforeFailure = structuredClone(state);
  await assert.rejects(applyMediaPluginCommand(state, { type: "intercom.publish", id: "failed", bytes: large },
    { async put() { throw new Error("offline"); } }), (error) => {
      assert.deepEqual(error.state.failure, { code: "STORAGE_UNAVAILABLE", announcementId: "failed" });
      assert.equal(error.state.lifecycle.at(-1).type, "intercom.storage_failed");
      return true;
    });
  assert.deepEqual(state, beforeFailure);
  state = await applyMediaPluginCommand(state, { type: "recording.start", id: "recording-1" }, storage);
  assert.equal(participantRecordingNotice(state).state, "recording");
  state = await applyMediaPluginCommand(state, { type: "recording.pause" }, storage);
  assert.equal(participantRecordingNotice(state).state, "paused");
  state = await applyMediaPluginCommand(state, { type: "recording.resume" }, storage);
  state = await applyMediaPluginCommand(state, { type: "recording.stop" }, storage);
  assert.equal(participantRecordingNotice(state), null);
  state = await applyMediaPluginCommand(state, { type: "plugin.disable" }, storage);
  assert.equal(state.enabled, false);
  assert.deepEqual(state.lifecycle.map(({ type }) => type), [
    "plugin.enabled", "intercom.published", "intercom.published",
    "recording.started", "recording.paused", "recording.resumed", "recording.stopped", "plugin.disabled"
  ]);
});
