function websocketOrigin(value, name) {
  const url = new URL(value);
  if (url.protocol === "https:") url.protocol = "wss:";
  else if (url.protocol === "http:") url.protocol = "ws:";
  else if (!new Set(["ws:", "wss:"]).has(url.protocol)) throw new Error(`${name} must use HTTP(S) or WS(S)`);
  return url.origin;
}

export function buildSecurityHeaders({ publicBaseUrl, mediaUrl }) {
  const connectSources = [...new Set([
    "'self'",
    websocketOrigin(publicBaseUrl, "PLENUM_PUBLIC_BASE_URL"),
    websocketOrigin(mediaUrl, "MEDIA_URL")
  ])].join(" ");

  return {
    "content-security-policy": [
      "default-src 'self'",
      "base-uri 'self'",
      `connect-src ${connectSources}`,
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data:",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self'"
    ].join("; "),
    "cross-origin-embedder-policy": "credentialless",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "permissions-policy": "camera=(), geolocation=(), microphone=(self)",
    "referrer-policy": "no-referrer",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY"
  };
}
