import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { CommandReceiptV1, FloorLeaseV1, JsonObject, RuntimeProjectionV1, RuntimeVoiceChannelV1, VoiceCommandReceiptV1 } from "@plenum/event-contracts";
import type { BrowserMediaSession } from "@plenum/media-adapter/browser";

interface VoiceControlsProps {
  projection: RuntimeProjectionV1;
  online: boolean;
  disabled: boolean;
  command(channel: RuntimeVoiceChannelV1, operationType: string, payload?: JsonObject): Promise<CommandReceiptV1 | null>;
  floor(channel: RuntimeVoiceChannelV1, action: "request" | "renew" | "release", body: Record<string, unknown>): Promise<FloorLeaseV1>;
  notice(message: string): void;
}

export function VoiceControls({ projection, online, disabled, command, floor, notice }: VoiceControlsProps) {
  const [room, setRoom] = useState<BrowserMediaSession | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [microphone, setMicrophone] = useState<"muted" | "ready" | "transmitting">("muted");
  const [remoteAudioCount, setRemoteAudioCount] = useState(0);
  const [floorLease, setFloorLease] = useState<FloorLeaseV1 | null>(null);
  const audio = useRef<HTMLDivElement>(null);
  const connectionId = useRef(crypto.randomUUID());

  useEffect(() => () => { room?.disconnect(); }, [room]);
  useEffect(() => {
    if (online) return;
    room?.disconnect();
    setRoom(null); setChannelId(null); setFloorLease(null); setMicrophone("muted"); setRemoteAudioCount(0);
    connectionId.current = crypto.randomUUID();
  }, [online, room]);
  useEffect(() => {
    if (floorLease?.status === "queued" && channelId !== null) {
      const channel = projection.voiceChannels.find(({ id }) => id === channelId);
      if (channel === undefined) return;
      const timer = window.setTimeout(() => void floor(channel, "request", {
        requestId: floorLease.requestId, connectionId: connectionId.current, expectedAuthorityEpoch: projection.authorityEpoch
      }).then(setFloorLease).catch(() => setFloorLease(null)), 500);
      return () => window.clearTimeout(timer);
    }
    if (floorLease?.status !== "granted" || floorLease.expiresAt === null || channelId === null) return;
    const channel = projection.voiceChannels.find(({ id }) => id === channelId);
    if (channel === undefined) return;
    const delay = Math.max(250, (new Date(floorLease.expiresAt).getTime() - Date.now()) / 2);
    const timer = window.setTimeout(() => void floor(channel, "renew", {
      requestId: floorLease.requestId, connectionId: connectionId.current, floorToken: floorLease.floorToken,
      expectedAuthorityEpoch: projection.authorityEpoch
    }).then(setFloorLease).catch(() => release(channel)), delay);
    return () => window.clearTimeout(timer);
  }, [floorLease, channelId, projection, floor]);

  const join = async (channel: RuntimeVoiceChannelV1) => {
    if (!online) { notice("Voice needs a live connection and was not queued."); return; }
    const receipt = await command(channel, "voice_channel.join") as VoiceCommandReceiptV1 | null;
    if (receipt?.status !== "accepted" || receipt.mediaCredential === null) return;
    try {
      if (audio.current === null) throw new Error("The audio output is unavailable");
      const { connectMediaCredential } = await import("@plenum/media-adapter/browser");
      const next = await connectMediaCredential(receipt.mediaCredential, audio.current, {
        disconnected: () => {
          setRoom(null); setChannelId(null); setFloorLease(null); setMicrophone("muted"); setRemoteAudioCount(0);
        },
        remoteAudioCount: setRemoteAudioCount
      });
      setRoom(next); setChannelId(channel.id); setMicrophone(channel.canTransmit ? "ready" : "muted");
      notice(`Joined ${channel.name}. Microphone is ${channel.canTransmit ? "ready but muted" : "unavailable"}.`);
    } catch {
      notice("Voice media is unavailable. Nothing was queued.");
    }
  };
  const release = async (channel: RuntimeVoiceChannelV1) => {
    await room?.setMicrophoneEnabled(false); setMicrophone("ready");
    const lease = floorLease;
    if (lease === null || lease.floorToken === null) return;
    setFloorLease(null);
    if (!online) { notice("Transmission stopped locally. The Floor Lease will expire; release was not queued."); return; }
    await floor(channel, "release", {
      requestId: lease.requestId, connectionId: connectionId.current, floorToken: lease.floorToken,
      expectedAuthorityEpoch: projection.authorityEpoch
    });
  };
  const leave = async (channel: RuntimeVoiceChannelV1) => {
    if (floorLease?.status === "granted") await release(channel);
    await room?.setMicrophoneEnabled(false);
    room?.disconnect(); setRoom(null); setChannelId(null); setMicrophone("muted"); setRemoteAudioCount(0);
    if (online) await command(channel, "voice_channel.leave");
    else notice("Disconnected locally; the short-lived server grant will expire.");
  };
  const toggle = async () => {
    if (room === null) return;
    const enabled = microphone !== "transmitting";
    await room.setMicrophoneEnabled(enabled); setMicrophone(enabled ? "transmitting" : "ready");
  };
  const request = async (channel: RuntimeVoiceChannelV1) => {
    if (!online || room === null) { notice("Push to talk needs a live media connection and was not queued."); return; }
    const lease = await floor(channel, "request", {
      requestId: crypto.randomUUID(), connectionId: connectionId.current, expectedAuthorityEpoch: projection.authorityEpoch
    });
    setFloorLease(lease);
    if (lease.status === "granted") {
      await room.setMicrophoneEnabled(true); setMicrophone("transmitting");
      notice("Floor granted. Microphone transmitting.");
    } else notice(`Floor request queued at position ${lease.queuePosition ?? "unknown"}.`);
  };
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>, channel: RuntimeVoiceChannelV1) => {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); void request(channel); }
  };
  const keyUp = (event: KeyboardEvent<HTMLButtonElement>, channel: RuntimeVoiceChannelV1) => {
    if (event.key === " " || event.key === "Enter") { event.preventDefault(); void release(channel); }
  };
  const pointerDown = (event: PointerEvent<HTMLButtonElement>, channel: RuntimeVoiceChannelV1) => {
    event.currentTarget.setPointerCapture(event.pointerId); void request(channel);
  };
  const pointerUp = (event: PointerEvent<HTMLButtonElement>, channel: RuntimeVoiceChannelV1) => {
    event.currentTarget.releasePointerCapture(event.pointerId); void release(channel);
  };

  const consentAction = async (channel: RuntimeVoiceChannelV1, kind: "recording" | "transcription", action: "give" | "withdraw") => {
    if (!online) { notice("Consent changes require the live Session Authority and were not queued."); return; }
    await command(channel, `voice_consent.${action}`, { kind });
  };
  const mediaAction = async (channel: RuntimeVoiceChannelV1, kind: "recording" | "transcription", action: "start" | "stop") => {
    if (!online) { notice(`${kind === "recording" ? "Recording" : "Transcription"} control requires the live Session Authority and was not queued.`); return; }
    await command(channel, `voice_${kind}.${action}`);
  };

  return <section aria-labelledby="voice-heading">
    <div className="section-heading"><h2 id="voice-heading">Voice Channels</h2></div>
    <p className="hint">Voice is live-only. Use Join, then explicitly enable the microphone. Push-to-talk: hold Space, Enter, or the Floor button; release it to stop.</p>
    <div ref={audio} className="voice-audio" aria-hidden="true" />
    <div className="card-grid">{projection.voiceChannels.map((channel) => <article className="card voice-card" key={channel.id} aria-labelledby={`voice-${channel.id}`}>
      <div className="card-heading"><div><h3 id={`voice-${channel.id}`}>{channel.name}</h3><p className="hint">{channel.mode.replaceAll("_", " ")}</p></div>
        <span className="badge badge-state">{channelId === channel.id ? microphone : channel.microphoneState}</span></div>
      <p>{channel.canTransmit ? "You may listen and transmit." : "Listen-only access."} Text status and controls remain available without audio.</p>
      <div className="voice-privacy" aria-label={`Privacy controls for ${channel.name}`}>
        {(["recording", "transcription"] as const).map((kind) => {
          const state = channel.consent[kind];
          return <div key={kind}>
            <h4 id={`${channel.id}-${kind}`}>{kind === "recording" ? "Recording" : "Transcription"}</h4>
            <p role="status"><strong>{state.active ? "Active" : "Stopped"}</strong> · Policy: {state.policy.replaceAll("_", " ")} · Your consent: {state.mine.replaceAll("_", " ")}</p>
            {state.policy === "with_consent" && <div className="actions">{state.mine === "given"
              ? <button className="btn-secondary" type="button" disabled={disabled || !online} onClick={() => void consentAction(channel, kind, "withdraw")}>Withdraw {kind} consent</button>
              : <button className="btn-secondary" type="button" disabled={disabled || !online} onClick={() => void consentAction(channel, kind, "give")}>Give {kind} consent</button>}
              {channel.canModerate && <button className="btn-secondary" type="button" disabled={disabled || !online} onClick={() => void mediaAction(channel, kind, state.active ? "stop" : "start")}>{state.active ? "Stop" : "Start"} {kind}</button>}
            </div>}
            {state.policy === "on" && <p className="hint">Production recording is unavailable pending OPEN-027.</p>}
          </div>;
        })}
      </div>
      {channelId === channel.id ? <p className="hint" role="status" aria-live="polite">{remoteAudioCount === 0
        ? "No remote audio streams." : `Receiving ${remoteAudioCount} remote audio ${remoteAudioCount === 1 ? "stream" : "streams"}.`}</p> : null}
      <div className="actions">{channelId !== channel.id
        ? <button className="btn-primary" type="button" disabled={disabled || !online} onClick={() => void join(channel)}>Join voice</button>
        : <><button className="btn-secondary" type="button" onClick={() => void room?.startAudio()}>Enable audio playback</button>
          {channel.mode === "radio_ptt" ? <button className="btn-primary floor-control" type="button" disabled={!channel.canTransmit}
            aria-label={`Hold to talk in ${channel.name}; microphone ${microphone}`} onKeyDown={(event) => keyDown(event, channel)}
            onKeyUp={(event) => keyUp(event, channel)} onPointerDown={(event) => pointerDown(event, channel)}
            onPointerUp={(event) => pointerUp(event, channel)} onPointerCancel={() => void release(channel)}>Hold for Floor</button>
            : channel.canTransmit ? <button className="btn-primary" type="button" aria-pressed={microphone === "transmitting"}
              onClick={() => void toggle()}>{microphone === "transmitting" ? "Mute microphone" : "Enable microphone"}</button> : null}
          <button className="btn-secondary" type="button" onClick={() => void leave(channel)}>Leave voice</button></>}
      </div>
    </article>)}</div>
  </section>;
}
