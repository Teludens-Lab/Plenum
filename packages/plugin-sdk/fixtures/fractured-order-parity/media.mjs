import { createHash, randomUUID } from "node:crypto";

export const INLINE_AUDIO_BYTES = 256 * 1024;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function createMediaPluginState(available = true) {
  return { available, enabled: false, recording: { status: "stopped", id: null }, announcements: [], lifecycle: [] };
}

function requireEnabled(state) {
  if (!state.available) throw new Error("CAPABILITY_UNAVAILABLE");
  if (!state.enabled) throw new Error("PLUGIN_DISABLED");
}

export async function applyMediaPluginCommand(state, command, storage) {
  const next = structuredClone(state);
  if (command.type === "plugin.enable") {
    if (!next.available) throw new Error("CAPABILITY_UNAVAILABLE");
    next.enabled = true; next.lifecycle.push({ type: "plugin.enabled" }); return next;
  }
  if (command.type === "plugin.disable") {
    next.enabled = false; next.recording = { status: "stopped", id: null };
    next.lifecycle.push({ type: "plugin.disabled" }); return next;
  }
  requireEnabled(next);
  if (command.type === "intercom.publish") {
    if (!(command.bytes instanceof Uint8Array) || command.bytes.byteLength === 0) throw new Error("VALIDATION_FAILED");
    const id = command.id ?? randomUUID();
    const announcement = { id, bytes: command.bytes.byteLength, sha256: sha256(command.bytes),
      delivery: command.bytes.byteLength <= INLINE_AUDIO_BYTES ? "inline" : "storage" };
    if (announcement.delivery === "inline") announcement.inlineBase64 = Buffer.from(command.bytes).toString("base64");
    else {
      try { announcement.storageKey = await storage.put(`intercom/${id}`, command.bytes); }
      catch {
        next.failure = { code: "STORAGE_UNAVAILABLE", announcementId: id };
        next.lifecycle.push({ type: "intercom.storage_failed", id });
        const error = new Error("STORAGE_UNAVAILABLE"); error.state = next; throw error;
      }
    }
    next.announcements.push(announcement); next.lifecycle.push({ type: "intercom.published", id }); return next;
  }
  const transitions = {
    "recording.start": ["stopped", "recording", "recording.started"],
    "recording.pause": ["recording", "paused", "recording.paused"],
    "recording.resume": ["paused", "recording", "recording.resumed"],
    "recording.stop": ["recording", "stopped", "recording.stopped"]
  };
  const transition = transitions[command.type];
  if (transition === undefined || next.recording.status !== transition[0]) throw new Error("INVALID_TRANSITION");
  next.recording = { status: transition[1], id: command.type === "recording.start" ? (command.id ?? randomUUID()) :
    command.type === "recording.stop" ? null : next.recording.id };
  next.lifecycle.push({ type: transition[2], recordingId: next.recording.id });
  return next;
}

export function participantRecordingNotice(state) {
  if (!state.enabled || !new Set(["recording", "paused"]).has(state.recording.status)) return null;
  return { state: state.recording.status, title: state.recording.status === "paused" ? "Session recording paused" : "Session recording active",
    copy: "Audio capture is controlled by the Session Operator." };
}
