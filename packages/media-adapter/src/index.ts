import { createHash } from "node:crypto";
import { AccessToken, RoomServiceClient, ServerError, TrackSource } from "livekit-server-sdk";
import {
  MEDIA_CREDENTIAL_CONTRACT_ID,
  type MediaCredentialV1
} from "@plenum/event-contracts";

export const MEDIA_PROVIDER_ADAPTER_VERSION = "livekit-local-v1";

export type MediaPermission = "listen" | "transmit" | "moderate";

export interface IssueMediaCredentialInput {
  organizationId: string;
  sessionId: string;
  channelId: string;
  participantId: string;
  permissions: MediaPermission[];
  capacity: number;
  ttlSeconds: number;
}

export interface MediaParticipantInput {
  organizationId: string;
  sessionId: string;
  channelId: string;
  participantId: string;
}

export interface MediaProviderAdapter {
  readonly id: string;
  readonly version: string;
  readonly digest: string;
  issueCredential(input: IssueMediaCredentialInput): Promise<MediaCredentialV1>;
  /** Resolve only after provider acknowledgement; reject uncertain outcomes. Callers persist retries. */
  setTransmit(input: MediaParticipantInput, enabled: boolean): Promise<void>;
  removeParticipant(input: MediaParticipantInput): Promise<void>;
  closeChannel(input: Omit<MediaParticipantInput, "participantId">): Promise<void>;
  health(): Promise<"available" | "unavailable">;
}

export interface LiveKitLocalAdapterOptions {
  apiUrl: string;
  websocketUrl: string;
  apiKey: string;
  apiSecret: string;
  adapterDigest: string;
  allowedHosts: string[];
  allowInsecureLoopback?: boolean;
}

function assertLocalUrl(value: string, protocols: string[], options: LiveKitLocalAdapterOptions): URL {
  const url = new URL(value);
  if (!protocols.includes(url.protocol)) throw new Error(`Media endpoint protocol ${url.protocol} is not allowed`);
  if (!options.allowedHosts.includes(url.hostname)) throw new Error(`Media endpoint host ${url.hostname} is outside the local deployment allow-list`);
  const insecure = url.protocol === "http:" || url.protocol === "ws:";
  if (insecure && !(options.allowInsecureLoopback === true && ["127.0.0.1", "localhost", "::1"].includes(url.hostname))) {
    throw new Error("Insecure media endpoints are allowed only on explicit development loopback");
  }
  return url;
}

function roomName(input: MediaParticipantInput): string {
  return `plenum-${createHash("sha256").update(`${input.organizationId}:${input.sessionId}:${input.channelId}`).digest("hex").slice(0, 32)}`;
}

function participantIdentity(input: MediaParticipantInput): string {
  return createHash("sha256").update(`${input.organizationId}:${input.participantId}`).digest("hex");
}

export class LiveKitLocalMediaProviderAdapter implements MediaProviderAdapter {
  readonly id = "livekit-local";
  readonly version = MEDIA_PROVIDER_ADAPTER_VERSION;
  readonly #websocketUrl: string;
  readonly #apiKey: string;
  readonly #apiSecret: string;
  readonly #adapterDigest: string;
  readonly #rooms: RoomServiceClient;

  constructor(options: LiveKitLocalAdapterOptions) {
    const apiUrl = assertLocalUrl(options.apiUrl, ["https:", "http:"], options);
    this.#websocketUrl = assertLocalUrl(options.websocketUrl, ["wss:", "ws:"], options).toString();
    if (!/^sha256:[0-9a-f]{64}$/u.test(options.adapterDigest)) throw new Error("Media Provider Adapter digest is invalid");
    if (options.apiKey.length === 0 || (options.apiSecret.length < 16 && options.allowInsecureLoopback !== true)) {
      throw new Error("Media provider credentials are incomplete");
    }
    this.#apiKey = options.apiKey;
    this.#apiSecret = options.apiSecret;
    this.#adapterDigest = options.adapterDigest;
    this.#rooms = new RoomServiceClient(apiUrl.toString(), options.apiKey, options.apiSecret, { requestTimeout: 5, failover: false });
  }

  get digest(): string { return this.#adapterDigest; }

  async issueCredential(input: IssueMediaCredentialInput): Promise<MediaCredentialV1> {
    if (!Number.isInteger(input.ttlSeconds) || input.ttlSeconds < 5 || input.ttlSeconds > 60) {
      throw new Error("Media Credential TTL must be between 5 and 60 seconds");
    }
    const room = roomName(input);
    await this.#rooms.createRoom({ name: room, maxParticipants: input.capacity, emptyTimeout: 60, departureTimeout: 20 });
    const canTransmit = input.permissions.includes("transmit");
    const token = new AccessToken(this.#apiKey, this.#apiSecret, {
      identity: participantIdentity(input),
      ttl: input.ttlSeconds
    });
    token.addGrant({
      roomJoin: true,
      room,
      canSubscribe: input.permissions.includes("listen"),
      canPublish: canTransmit,
      canPublishData: false,
      canPublishSources: canTransmit ? [TrackSource.MICROPHONE] : []
    });
    const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000).toISOString();
    return {
      contractId: MEDIA_CREDENTIAL_CONTRACT_ID,
      providerAdapterId: this.id,
      providerAdapterVersion: this.version,
      providerAdapterDigest: this.#adapterDigest,
      serverUrl: this.#websocketUrl,
      room,
      participantIdentity: participantIdentity(input),
      token: await token.toJwt(),
      permissions: [...input.permissions].sort(),
      expiresAt
    };
  }

  async setTransmit(input: MediaParticipantInput, enabled: boolean): Promise<void> {
    try { await this.#rooms.updateParticipant(roomName(input), participantIdentity(input), {
      permission: {
        canSubscribe: true,
        canPublish: enabled,
        canPublishData: false,
        canPublishSources: enabled ? [TrackSource.MICROPHONE] : []
      }
    }); } catch (error) {
      // An absent radio participant cannot publish; enabling an absent participant still fails.
      if (enabled || !(error instanceof ServerError) || error.status !== 404) throw error;
    }
  }

  async removeParticipant(input: MediaParticipantInput): Promise<void> {
    try {
      await this.#rooms.removeParticipant(roomName(input), participantIdentity(input), {
        revokeTokenTs: BigInt(Math.floor(Date.now() / 1000))
      });
    } catch (error) {
      if (!(error instanceof ServerError) || error.status !== 404) throw error;
    }
  }

  async closeChannel(input: Omit<MediaParticipantInput, "participantId">): Promise<void> {
    try {
      await this.#rooms.deleteRoom(roomName({ ...input, participantId: "channel" }));
    } catch (error) {
      if (!(error instanceof ServerError) || error.status !== 404) throw error;
    }
  }

  async health(): Promise<"available" | "unavailable"> {
    try {
      await this.#rooms.listRooms([]);
      return "available";
    } catch {
      return "unavailable";
    }
  }
}
