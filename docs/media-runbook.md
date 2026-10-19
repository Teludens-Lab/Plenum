# Local voice media runbook

Status: candidate implementation for Proposed ADR-017. Recording and transcription remain disabled until PS-320 and OPEN-027 are resolved.

## Deployment boundary

Plenum owns authorization, Voice grants, Floor Leases, Evidence Events, and Command Receipts. The candidate local LiveKit service carries audio only through the `@plenum/media-adapter` interface. It has no PostgreSQL credentials and its join/leave/mute callbacks are untrusted observations, never proof that audio was delivered.

Use `deploy/media/livekit.yaml` with a digest-pinned LiveKit image already admitted to the institutional bundle. Supply API keys with a root-readable `--key-file`; never put them in the Release, browser bundle, repository, logs, or command line history. Mount the TLS certificate and key at the paths in the profile. The certificate SAN must cover `media.plenum.lan`, and Participant devices must trust its issuing CA.

The PS-250 candidate proof used `livekit/livekit-server:v1.13.10@sha256:89ca9ce0791e18d6e03bf6e2c49ceb27e1c754eae8bd50c989386c1a5963791a`. Treat that as evaluation evidence, not ratification of ADR-017; admit any replacement image by digest and repeat the media, firewall and recovery checks.

The application adapter requires:

- an HTTPS API URL and WSS browser URL whose host is in the deployment allow-list;
- the Release-pinned adapter digest (`sha256:<64 hex>`);
- an API key/secret from the deployment secret store;
- no insecure URL except explicit loopback development.

## LAN and firewall

Resolve `media.plenum.lan` only to an institutional LAN address. Permit client traffic to TCP 7880 (WSS), TCP 7881 (WebRTC fallback), UDP 50000-50100 (media), and TCP/UDP 5349 (TURN/TLS) as required by the site. Deny default-route/WAN egress for the media container or host. `rtc.use_external_ip` must remain `false`; do not configure public STUN/TURN, telemetry, an egress/recording worker, or cloud DNS.

Before a session, verify from two representative client networks that WSS, direct UDP, TCP fallback, and local TURN all use LAN addresses. Capture firewall flow evidence showing zero public destinations. Verify microphone permission, speaker output, keyboard push-to-talk, role/Stage revocation, and a provider restart. This repository does not treat a static configuration check as proof that audio traversed the LAN.

## Failure and recovery

- Provider unavailable: Join or Floor returns `MEDIA_UNAVAILABLE`; the client shows Voice unavailable and does not queue or replay it.
- Lost acknowledgement: a Voice Command may be retried only with its original Command ID to recover its durable receipt; a new short-lived Media Credential is issued after current authorization is rechecked.
- Disconnect: the browser stops its microphone immediately. Credentials expire within 30 seconds and grants within 60 seconds; reconnect creates a new connection/request identity, so old Floor requests are not replayed.
- Role or Stage change: database triggers revoke grants and leases in the authoritative transaction; the HTTP command path reconciles revoked provider participants. A failed provider enforcement returns `MEDIA_UNAVAILABLE` for retry while the lease remains fail-closed.
- Rollback: disable the Release provider binding and stop the local media service. Existing Floor Leases expire at their bounded deadline. Keep migration 014 in place; forward-fix schema changes rather than dropping Evidence-linked data.

## Health and evidence

Probe the adapter `health()` result from inside the application network. Do not expose provider administration publicly. Retain application Evidence Events and scrubbed operational media metadata only; never store audio in PostgreSQL. For release evidence, record provider/image digests, certificate expiry, local DNS, firewall flows, two-client audio results, TURN path, browser/OS versions, and the exact validation commands.

