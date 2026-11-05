import { createHash, timingSafeEqual } from "node:crypto";

const deliveryIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const templateByMessageType = Object.freeze({
  PLATFORM_FIRST_ADMIN_INVITATION: "platform-first-admin-v1",
  PLATFORM_ADMINISTRATOR_INVITATION: "platform-administrator-v1",
  ORGANIZATION_WORKFORCE_INVITATION: "organization-workforce-v1"
} as const);

export type InvitationMessageType = keyof typeof templateByMessageType;

export interface GovernedInvitationMessage {
  messageId: string;
  type: InvitationMessageType;
  channel: "EMAIL";
  mandatory: true;
  recipient: string;
  templateRef: (typeof templateByMessageType)[InvitationMessageType];
  variables: {
    organizationName: string;
    invitationUrl: string;
    expiresAt: string;
  };
}

export interface NormalizedInvitationDeliveryEvent {
  providerEventId: string;
  deliveryId: string;
  status: "delivered" | "bounced";
  occurredAt: string;
  reason?: string;
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

function secureEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function validHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function parseGovernedInvitationMessage(value: unknown): GovernedInvitationMessage {
  if (!isRecord(value) || Object.keys(value).some((field) =>
    !["messageId", "type", "channel", "mandatory", "recipient", "templateRef", "variables"].includes(field))) {
    throw new Error("The invitation message contains an unknown field.");
  }
  const type = value.type;
  const variables = value.variables;
  if (!boundedString(type, 80) || !(type in templateByMessageType) || !isRecord(variables) ||
      Object.keys(variables).some((field) => !["organizationName", "invitationUrl", "expiresAt"].includes(field)) ||
      typeof value.messageId !== "string" || !deliveryIdPattern.test(value.messageId) ||
      value.channel !== "EMAIL" || value.mandatory !== true ||
      typeof value.recipient !== "string" || value.recipient.length > 320 || !emailPattern.test(value.recipient) ||
      value.templateRef !== templateByMessageType[type as InvitationMessageType] ||
      !boundedString(variables.organizationName, 200) || !boundedString(variables.invitationUrl, 2_048) ||
      !validHttpsUrl(variables.invitationUrl) || !boundedString(variables.expiresAt, 64) ||
      !Number.isFinite(new Date(variables.expiresAt).getTime())) {
    throw new Error("The invitation message is invalid.");
  }
  return value as unknown as GovernedInvitationMessage;
}

export class PostmarkInvitationAdapter {
  readonly #serverToken: string;
  readonly #from: string;
  readonly #messageStream: string;
  readonly #webhookPassword: string;
  readonly #fetcher: Fetcher;

  constructor(input: {
    serverToken: string;
    from: string;
    webhookPassword: string;
    messageStream?: string;
    fetcher?: Fetcher;
  }) {
    const from = input.from.trim();
    const messageStream = input.messageStream?.trim() || "outbound";
    if (input.serverToken.trim().length < 16) throw new Error("The Postmark server token is invalid.");
    if (input.webhookPassword.length < 24) throw new Error("The Postmark webhook password is invalid.");
    if (from.length === 0 || from.length > 255 || /[\r\n]/u.test(from)) throw new Error("The Postmark sender is invalid.");
    if (!/^[A-Za-z0-9._-]{1,100}$/u.test(messageStream)) throw new Error("The Postmark message stream is invalid.");
    this.#serverToken = input.serverToken.trim();
    this.#from = from;
    this.#messageStream = messageStream;
    this.#webhookPassword = input.webhookPassword;
    this.#fetcher = input.fetcher ?? fetch;
  }

  webhookAuthorized(authorization: string | undefined): boolean {
    if (authorization === undefined || !authorization.startsWith("Basic ")) return false;
    let decoded: string;
    try {
      decoded = Buffer.from(authorization.slice("Basic ".length), "base64").toString("utf8");
    } catch {
      return false;
    }
    return secureEqual(decoded, `plenum-postmark:${this.#webhookPassword}`);
  }

  async send(message: GovernedInvitationMessage): Promise<{ messageId: string }> {
    const response = await this.#fetcher("https://api.postmarkapp.com/email/withTemplate", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-postmark-server-token": this.#serverToken
      },
      body: JSON.stringify({
        From: this.#from,
        To: message.recipient,
        TemplateAlias: message.templateRef,
        TemplateModel: message.variables,
        Tag: message.type,
        Metadata: { deliveryId: message.messageId, messageType: message.type },
        MessageStream: this.#messageStream,
        TrackOpens: false,
        TrackLinks: "None"
      }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`Postmark rejected the invitation message with status ${response.status}.`);
    const value: unknown = await response.json();
    if (!isRecord(value) || value.ErrorCode !== 0 || !boundedString(value.MessageID, 300)) {
      throw new Error("Postmark did not accept the invitation message.");
    }
    return { messageId: value.MessageID };
  }

  normalizeWebhook(value: unknown, traceId?: string): NormalizedInvitationDeliveryEvent | null {
    if (!isRecord(value) || !boundedString(value.RecordType, 80)) {
      throw new Error("The Postmark webhook payload is invalid.");
    }
    if (value.RecordType !== "Delivery" && value.RecordType !== "Bounce") return null;
    if (!isRecord(value.Metadata) || value.Metadata.deliveryId === undefined) return null;
    const deliveryId = value.Metadata.deliveryId;
    const providerMessageId = value.MessageID;
    const occurredAt = value.RecordType === "Delivery" ? value.DeliveredAt : value.BouncedAt;
    if (typeof deliveryId !== "string" || !deliveryIdPattern.test(deliveryId) ||
        !boundedString(providerMessageId, 300) || !boundedString(occurredAt, 64) ||
        !Number.isFinite(new Date(occurredAt).getTime())) {
      throw new Error("The Postmark webhook payload is invalid.");
    }
    const fallbackEventId = `postmark:${value.RecordType}:${providerMessageId}:${occurredAt}`;
    const providerEventId = traceId?.trim();
    const event: NormalizedInvitationDeliveryEvent = {
      providerEventId: providerEventId && providerEventId.length <= 300 ? providerEventId : fallbackEventId.slice(0, 300),
      deliveryId,
      status: value.RecordType === "Delivery" ? "delivered" : "bounced",
      occurredAt
    };
    if (value.RecordType === "Bounce") {
      const reason = typeof value.Description === "string" && value.Description.trim().length > 0
        ? value.Description.trim().slice(0, 1_000)
        : "Postmark reported that the invitation message bounced.";
      event.reason = reason;
    }
    return event;
  }
}
