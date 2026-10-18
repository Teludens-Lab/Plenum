# Plenum Voice & Radio Architecture v1.0

**Document:** COMMS-ARCH-001 · **Status:** Approved product direction; technical design proposed for implementation · **Date:** 2026-10-17  
**Owner:** Runtime communications capability · **Depends on:** Enterprise PRD / Foundation v0.2, Platform v1.2, Runtime v1.2, Extension Framework v1.0, PostgreSQL Logical Data Model v1.0, Synchronization Protocol v1.0.

## 1. Product contract
Voice and radio are core configurable Runtime capabilities with interchangeable media-provider adapters; not model plugins. Designer chooses communication mode, channels, eligible seats/roles/teams, visibility, schedules, moderation, phase gates and recording policy. Network-independent institutional deployments MUST be possible with a locally provisioned media subsystem. Separately disconnected devices cannot join a live audio channel. The core owns authorization, channel lifecycle, transmission rights, evidence and publication validation; media provider owns packet transport and congestion mechanisms.

**Supported v1 modes:** (a) half-duplex push-to-talk radio; (b) open team voice room; (c) invited private/bilateral call; (d) authorized one-to-many broadcast. Full video is explicitly deferred. Communications need not be enabled by every Simulation Release.

## 2. Trust and runtime topology
```text
Designer -> Studio channel definitions -> Release compiler -> Immutable Release
Participant -> Plenum Runtime auth + projection -> short-lived scoped media credential
   -> Media Provider Adapter -> institution-managed WebRTC SFU/TURN/ICE
Operator -> channel management commands -> Runtime -> provider moderation
Provider events (untrusted observations) -> event adapter -> evidence metadata
```
The authoritative Runtime grants access; a client-supplied channel name, team or role is never authorization. Provider credentials MUST be scoped to session/channel, permission (`listen`, `transmit`, `moderate`), participant identity and short expiration. On role revocation or phase close, Runtime revokes grants, expires credentials and actively disconnects participants where provider APIs permit; operational documentation must disclose unavoidable propagation delay. Provider is required to support participant-specific grants, room muting/kick and transport health events. Media providers do not write to primary PostgreSQL tables.

## 3. Designer-authored definitions (compiled into Release)
`VoiceChannelDefinition`:
- `id`, `name`, `mode: radio_ptt|open_room|private_call|broadcast`, `capacity`, `phaseGates`, `language`, `priorityPolicy`, `recordingPolicy`, `retentionClass`.
- `canListen`, `canTransmit`, `canModerate`, `canInvite` are references to the canonical information/authorization policy vocabulary, **not arbitrary script**.
- `radio`: `floorLeaseMs`, `queuePolicy: fifo|priority`, `preemption: none|authorized_emergency`, `maxTransmissionMs`, `cooldownMs`.
- Private conversations: participant/role eligibility and invitation acceptance; never infer cross-team permissions from a UI route.
- Publication validates policy references, impossible channel states, capacity and locally installed provider compatibility. Unsupported capabilities cause a clear publish/deploy error.

## 4. Runtime entities and ownership
- `comms.channel_instances`: `(organization_id,session_id,channel_instance_id,release_id,definition_id,status,opened_by,opened_at,closed_at,provider_binding_id,version)`; UNIQUE scoped channel name as configured.
- `comms.participant_grants`: `(organization_id,session_id,channel_id,seat_assignment_id,can_listen,can_transmit,can_moderate,valid_until,revoked_at,policy_revision)`; derived grants may be cached but Runtime policy remains source of truth.
- `comms.floor_state`: `(channel_id,holder_seat_id,lease_token,lease_expires_at,authority_epoch,version)`; single active floor holder per half-duplex channel.
- `comms.floor_requests`: `(channel_id,request_id,seat_id,priority,requested_at,status)`; requests deduplicated by `(channel_id,request_id)`.
- `comms.media_events`: provider observations (`joined`, `left`, `muted`, `disconnected`) with source, effective metadata and ingest time; these are not proof that all media was heard.
- `comms.recording_assets`: controlled references to encrypted authorized recordings, consent/legal basis as required, classification, retention, hash; no recording by default.

All tenant roots carry `organization_id`. Cross-tenant denial and session/seat binding enforced on every operation. No persistent audio bytes in transactional rows.

## 5. Push-to-talk floor arbitration
1. A connected, authenticated participant sends `floor.request` with idempotency key, known channel and expected session authority epoch.
2. Server checks seat status, channel availability, `canTransmit`, phase and priority policy; acquires/updates floor atomically using a row lock or equivalent serializable transition.
3. If free, issues opaque short-lived `floorToken` bound to session, channel, seat, epoch and lease expiry; provider transmit permission granted only for lease holder.
4. If busy, returns queued/denied according to defined policy. Emergency priority may preempt only by expressly authorized operator/seat capability, with recorded reason.
5. Client transmits only while current token is valid; renewals bounded. On release, disconnect, timeout or preemption, revoke transmit grant and notify members. A stale epoch or token must never grant a new floor.
6. Provider mute/packet timing is eventual: authoritative floor history records intent and grant, not a mathematically guaranteed instantaneous media cutover. Test worst-case overlaps and fail closed on control-plane loss; media must not continue indefinitely with stale authorization.

`floor.request` is a communication-control action, not a model adjudication. Its server decision does not require White Cell approval unless simulation-defined operator policy explicitly demands one.

## 6. Public and realtime contracts
- `POST /v1/sessions/{sessionId}/voice/channels/{channelId}/join` -> scoped media connection info and short-lived credential (never full session policy bundle).
- `POST .../leave`, `POST .../floor-requests`, `POST .../floor-requests/{requestId}/release`.
- `POST /v1/sessions/{sessionId}/voice/channels/{channelId}/moderation` -> operator commands with reason and expected version.
- `GET /v1/sessions/{sessionId}/voice/channels` -> authorized projection only; `GET .../{channelId}/status` -> presence only where policy permits.
- Server events: `comms.channel.opened`, `.closed`, `comms.floor.granted`, `.queued`, `.released`, `.preempted`, `comms.participant.joined`, `.left`, `comms.provider.unavailable`, `comms.recording.started`, `.stopped`.
- Errors: `CHANNEL_FORBIDDEN`, `CHANNEL_CLOSED`, `FLOOR_BUSY`, `FLOOR_TOKEN_EXPIRED`, `MEDIA_UNAVAILABLE`, `AUTHORITY_UNAVAILABLE`, `STALE_EPOCH`, `PROVIDER_INCOMPATIBLE`.
Provider notifications are subject to signature/identity checks, event deduplication, and possible reordering. Use Plenum outbox for authoritative command notifications.

## 7. LAN, offline and air-gapped semantics
Internet unavailable, LAN available: locally hosted Plenum API, media server, STUN/TURN where needed, local certificate and identity infrastructure must operate with **zero public egress**. No browser CDN/remote JS, external login or cloud recording dependency. Different LAN zones and restrictive firewalls may still require internal TURN; validate actual UDP/TCP routing. Individual disconnected device: display truthful `unavailable`, terminate/expire media entitlement, permit unrelated authorized offline drafts but never fabricate voice delivery. Offline peer-to-peer ad hoc radio is out of scope. No automatic switching to an external cloud provider.

## 8. Evidence, privacy, failure and accessibility
Record channel/floor lifecycle, security/moderation decisions, policy revision, provider health and recording metadata in Plenum evidence pipeline; do **not** assume capture of voice content. Recording/transcription opt-in governed by organization, applicable consent and simulation information classification. Audio content must not leak through logs, debugging, analytics or client hidden state. Support push-to-talk keyboard access, visible mic state, captions/transcription as optional approved capability, and a non-audio path for essential exercise instructions. Local device mic permissions are explicit.
Provider outage: room shown `degraded/unavailable`, permissions fail closed, participants retain unrelated workflow access. Control-plane outage: no new transmit grants, floor leases expire. Reconnect: reauthenticate and rederive permissions, do not replay stale PTT requests. No guarantees of delivery or recording completeness without observed proof.

## 9. Deployment and capacity
A media provider adapter SHOULD first target a self-hosted WebRTC SFU (LiveKit candidate, not a hard product dependency); media-provider-specific Redis/turn requirements are allowed inside its isolated operational boundary. Size rooms for concurrency, active publishers, relay usage, bitrate, networking and recordings separately from the 500×10 application-user planning envelope. No target throughput is claimed without benchmark evidence.

## 10. Acceptance tests
| ID | Scenario | Required observation |
|---|---|---|
| VOICE-01 | Unauthorized role requests channel token | Denied, no media grant |
| VOICE-02 | Simultaneous PTT floor requests | At most one valid server floor lease |
| VOICE-03 | Priority preemption | Only authorized preemptor; old token revoked; evidence |
| VOICE-04 | Same floor request retried | No duplicate grants or queue entries |
| VOICE-05 | Phase/role changes while connected | Policy re-evaluated and participant removed/muted |
| VOICE-06 | Internet down; institutional LAN works | Local audio and control path with zero external egress |
| VOICE-07 | Device disconnected entirely | Clearly unavailable; no false transmitted state |
| VOICE-08 | Media server outage/control loss | Lease expiry; no unauthorized fresh talk grants |
| VOICE-09 | Recording disabled | No recording generated or exported |
| VOICE-10 | Cross-organization channel probing | Denied at API/provider boundary |
| VOICE-11 | Keyboard and assistive workflow | Mic/PTT/status operable and understandable |
| VOICE-12 | Concurrent 500×10 exercises | Media profile measured, not merely inferred from participant count |

**Status:** Specification only; provider deployment and tests NOT RUN.
