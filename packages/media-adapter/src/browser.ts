import type { MediaCredentialV1 } from "@plenum/event-contracts";
import { Room, RoomEvent, type RemoteTrack } from "livekit-client";

export interface BrowserMediaSession {
  setMicrophoneEnabled(enabled: boolean): Promise<void>;
  startAudio(): Promise<void>;
  disconnect(): Promise<void>;
}

export async function connectMediaCredential(credential: MediaCredentialV1, audioContainer: HTMLElement,
  handlers: { disconnected(): void; remoteAudioCount(count: number): void }): Promise<BrowserMediaSession> {
  if (credential.providerAdapterId !== "livekit-local") throw new Error("The Media Credential uses an unsupported adapter");
  const room = new Room({ adaptiveStream: true, dynacast: false });
  let remoteAudioCount = 0;
  room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
    if (track.kind === "audio") {
      audioContainer.append(track.attach());
      handlers.remoteAudioCount(++remoteAudioCount);
    }
  });
  room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
    if (track.kind === "audio") {
      track.detach().forEach((element) => element.remove());
      handlers.remoteAudioCount(remoteAudioCount = Math.max(0, remoteAudioCount - 1));
    }
  });
  room.on(RoomEvent.Disconnected, handlers.disconnected);
  try {
    await room.connect(credential.serverUrl, credential.token, { autoSubscribe: true });
  } catch (error) {
    await room.disconnect();
    throw error;
  }
  return {
    setMicrophoneEnabled: (enabled) => room.localParticipant.setMicrophoneEnabled(enabled).then(() => undefined),
    startAudio: () => room.startAudio(),
    disconnect: () => room.disconnect()
  };
}
