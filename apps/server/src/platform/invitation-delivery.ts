import type { FirstAdminInvitationDelivery } from "./provisioning.js";

export class WebhookFirstAdminInvitationDelivery implements FirstAdminInvitationDelivery {
  readonly #endpoint: URL;
  readonly #bearerToken: string;

  constructor(input: { endpoint: string; bearerToken: string }) {
    this.#endpoint = new URL(input.endpoint);
    const loopback = ["127.0.0.1", "localhost", "::1"].includes(this.#endpoint.hostname);
    if (this.#endpoint.protocol !== "https:" && !(loopback && this.#endpoint.protocol === "http:")) {
      throw new Error("Invitation delivery endpoint must use HTTPS");
    }
    if (input.bearerToken.length < 16) throw new Error("Invitation delivery bearer token is invalid");
    this.#bearerToken = input.bearerToken;
  }

  async deliver(input: Parameters<FirstAdminInvitationDelivery["deliver"]>[0]): Promise<{ providerReference: string }> {
    const response = await fetch(this.#endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${this.#bearerToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        messageId: input.deliveryId,
        type: input.messageType,
        channel: "EMAIL",
        mandatory: true,
        recipient: input.recipientEmail,
        templateRef: input.templateRef,
        variables: { organizationName: input.organizationName, invitationUrl: input.invitationUrl, expiresAt: input.expiresAt }
      }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`Invitation delivery provider returned ${response.status}`);
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || !("messageId" in body) || typeof body.messageId !== "string" || body.messageId.length === 0) {
      throw new Error("Invitation delivery provider did not return a message ID");
    }
    return { providerReference: body.messageId };
  }
}
