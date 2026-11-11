import type { IncomingMessage } from "node:http";

import { authorizationError } from "../errors.js";

export function configuredBrowserOrigin(publicBaseUrl: string | undefined): string | undefined {
  if (publicBaseUrl === undefined) return undefined;
  const url = new URL(publicBaseUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("A public HTTP(S) application URL without credentials is required");
  }
  return url.origin;
}

export function assertBrowserOrigin(request: IncomingMessage, approvedOrigin: string | undefined, correlationId: string): void {
  const origin = request.headers.origin;
  // Cookie-free machine clients retain their explicit credential checks at the owning route.
  if (origin === undefined && request.headers.cookie === undefined) return;
  if (typeof origin !== "string" || approvedOrigin === undefined || origin !== approvedOrigin) {
    throw authorizationError("PERMISSION_DENIED", "The request origin is not allowed.", correlationId);
  }
}
