# Plenum — Voice and Radio

## Document control

| Field | Value |
|---|---|
| Document ID | VOICE |
| Number | 12 |
| Version | 1.1.0 |
| Date | 2026-10-17 |
| Status | Product direction Confirmed (DEC-47 to DEC-51, DEC-59); technical design Approved by Product Owner direction on 2026-10-20 (ADR-017). First-release scope. |
| Owner | Technical Lead |
| Approvers | Product Owner; Technical Lead; Security Owner; Operations Owner (role placeholders — OPEN-001) |
| Reads from | 01 PRD; 02 Platform; 03 Schema; 05 Runtime; 06 Data and Security; 09 Contracts; Data Model v1.1; Sync v1.1; Decision Register; Glossary |
| Read by | Studio and Runtime implementation; operations; tests |
| Authority | Voice Channel behavior: definitions, access, push-to-talk floor control, media provider boundary, recording and transcription, offline rules and acceptance tests. |
| Supersedes | Owner-supplied `PLENUM_VOICE_AND_RADIO_ARCHITECTURE_v1.0.md` (COMMS-ARCH-001), kept in `archive/` |

---

## 1. Product contract

Voice and radio are core configurable Runtime capabilities (DEC-47) with interchangeable Media Provider Adapters (DEC-59). They are not model plugins. The designer chooses modes, channels, eligible Seats, Session Roles and Teams, visibility, active Stages, moderation, and recording and transcription policy. The Runtime owns authorization, channel lifecycle, transmission rights, consent and evidence. The media provider owns packet transport and congestion control.

First-release modes:

| Mode | Behavior |
|---|---|
| `radio_ptt` | Half-duplex push-to-talk; one Floor holder at a time |
| `open_room` | Open team voice room |
| `private_call` | Invited private or bilateral call; invitation must be accepted |
| `broadcast` | Authorized one-to-many transmission |

Video is deferred. A Release need not enable voice at all.

## 2. Trust and topology

```text
Designer -> Studio Voice Channel Definitions -> Release compiler -> Simulation Release
Participant -> Runtime authorization + projection -> short-lived Media Credential
   -> Media Provider Adapter -> institution-managed WebRTC SFU / TURN
Operator -> moderation Commands -> Runtime -> provider moderation API
Provider events (untrusted observations) -> event adapter -> Evidence Event metadata
```

- The Runtime grants access. A channel name, Team or Session Role supplied by the client is never authorization.
- Media Credentials are scoped to Session, Voice Channel, permission (`listen`, `transmit`, `moderate`), Participant and a short expiry (ADR-017).
- When a Seat Assignment ends, a Session Role is revoked or an active Stage closes, the Runtime revokes grants, expires credentials and disconnects the Participant where the provider allows. Operator documentation states the remaining propagation delay.
- The provider must support per-Participant grants, room mute and removal, and transport health events.
- The media stack is an approved exception to ADR-005 and ADR-013 (DEC-49). It never writes to the Plenum PostgreSQL database; any datastore it needs stays inside its boundary.

## 3. Voice Channel Definition

Compiled into the Release (03 Schema §13.3).

| Field | Meaning |
|---|---|
| `id`, `name`, `mode`, `capacity` | Identity, one of the four modes, maximum Participants |
| `activeStageIds` | Stages in which the channel may be open |
| `language`, `priorityPolicy` | Display language; who outranks whom for the Floor |
| `canListen`, `canTransmit`, `canModerate`, `canInvite` | References to Information Policy selectors, never script |
| `radio.floorLeaseMs`, `radio.queuePolicy` (`fifo`, `priority`), `radio.preemption` (`none`, `authorized_emergency`), `radio.maxTransmissionMs`, `radio.cooldownMs` | Push-to-talk rules |
| `recordingPolicy`, `transcriptionPolicy` | Recording: `off` (default), `on` or `with_consent`. Transcription: `off` (default) or `with_consent` (DEC-50) |
| `retentionClass` | Retention for recordings and transcripts |

Private calls require eligibility and acceptance; cross-Team permission is never inferred from a screen route. Publication validates policy references, impossible states, capacity and compatibility with the locally installed Media Provider Adapter; an unsupported capability fails with `CAPABILITY_UNAVAILABLE`.

## 4. Runtime entities

Schema `comms` (ADR-016). Entity status and constraints are in Data Model v1.1 §4.8.

| Table | Key contents |
|---|---|
| `comms.voice_channels` | Organization, Session, Governing Release, definition ID, status, opened by and at, closed at, provider binding, version |
| `comms.voice_grants` | Seat Assignment, listen, transmit, moderate, valid until, revoked at, policy revision; the Runtime policy stays the source of truth |
| `comms.floor_leases` | Holder Seat Assignment, lease token digest, expiry, Authority Epoch, version; at most one active lease per push-to-talk channel |
| `comms.floor_requests` | Request ID unique per channel, Seat Assignment, priority, requested at, status |
| `comms.consent_records` | Participant, channel, recording or transcription, given or withdrawn, time |
| `comms.media_events` | Provider observations (`joined`, `left`, `muted`, `disconnected`) with source and ingest time; not proof that audio was heard |
| `comms.recording_assets` | References to encrypted recordings and transcripts in object storage, consent basis, classification, retention, hash |

Every table carries `organization_id`. No audio bytes are stored in database rows.

## 5. Push-to-talk floor control

Floor control is the one exception to the standard command endpoint (DEC-48). It uses dedicated endpoints because it is latency-sensitive and must never be replayed late.

1. A connected Participant sends a floor request with a request ID and the expected Authority Epoch.
2. The server checks the Seat Assignment, channel state, `canTransmit`, active Stage and priority policy, then acquires or updates the Floor atomically under a row lock.
3. If the Floor is free it issues an opaque, short-lived `floorToken` bound to Session, channel, Seat Assignment, epoch and expiry, and the provider grants transmit permission only to that holder.
4. If the Floor is busy, the request is queued or denied (`FLOOR_BUSY`) according to the channel's queue policy. Emergency preemption is allowed only for an explicitly authorized Seat or operator, with a recorded reason.
5. The client transmits only while its token is valid; renewals are bounded by `maxTransmissionMs`. On release, disconnection, expiry or preemption the transmit grant is revoked and members are notified. A stale epoch or token never grants a new Floor.
6. Provider muting is eventual. The Floor history records intent and grant, not an instantaneous media cutover. Worst-case overlap is tested; loss of the control plane fails closed and leases expire.

Floor requests are never placed in the Offline Outbox and are never replayed after reconnection (Sync §4.3). Each grant, queue, release, expiry and preemption writes an Evidence Event. A floor request is communication control, not adjudication; it needs no White Cell approval unless the Release's operator policy requires it.

## 6. Contracts

**Commands** (standard endpoint, 09 §3): `voice_channel.open`, `voice_channel.close`, `voice_channel.join` (receipt returns connection details and a Media Credential, never the policy bundle), `voice_channel.leave`, `voice_channel.moderate` (mute, remove, with reason and expected version), `voice_recording.start`, `voice_recording.stop`, `voice_transcription.start`, `voice_transcription.stop`, `voice_consent.give`, `voice_consent.withdraw`. None of these is offline-queueable.

**Floor endpoints** (DEC-48 exception):

```text
POST /v1/sessions/{sessionId}/voice-channels/{channelId}/floor-requests
POST /v1/sessions/{sessionId}/voice-channels/{channelId}/floor-requests/{requestId}/renew
POST /v1/sessions/{sessionId}/voice-channels/{channelId}/floor-requests/{requestId}/release
```

**Queries:** `GET /v1/sessions/{sessionId}/voice-channels` (authorized projection); `GET .../voice-channels/{channelId}/status` (presence where policy permits).

**Events:** `voice_channel.opened`, `voice_channel.closed`, `voice_channel.joined`, `voice_channel.left`, `floor_lease.granted`, `floor_lease.queued`, `floor_lease.released`, `floor_lease.expired`, `floor_lease.preempted`, `media_provider.unavailable`, `voice_recording.started`, `voice_recording.stopped`, `voice_transcription.started`, `voice_transcription.stopped`, `voice_consent.given`, `voice_consent.withdrawn`.

Provider notifications are checked for signature and identity, deduplicated and may arrive out of order. Authoritative notifications use the Plenum outbox.

**Error codes** (09 §8.1):

| Specification v1.0 code | Canonical code |
|---|---|
| `CHANNEL_FORBIDDEN` | `PERMISSION_DENIED` |
| `CHANNEL_CLOSED` | `INVALID_TRANSITION` |
| `FLOOR_BUSY` | `FLOOR_BUSY` |
| `FLOOR_TOKEN_EXPIRED` | `FLOOR_TOKEN_EXPIRED` |
| `MEDIA_UNAVAILABLE` | `MEDIA_UNAVAILABLE` |
| `AUTHORITY_UNAVAILABLE`, `STALE_EPOCH` | `AUTHORITY_UNAVAILABLE` |
| `PROVIDER_INCOMPATIBLE` | `CAPABILITY_UNAVAILABLE` |
| (new) recording or transcription without consent | `CONSENT_REQUIRED` |

## 7. Recording and transcription

- Both are off by default (DEC-50).
- Transcription runs only while every Participant whose speech would be transcribed has a current Consent Record. If anyone withdraws consent, transcription of that channel stops and `voice_transcription.stopped` is recorded. Starting transcription without that consent fails with `CONSENT_REQUIRED`.
- Recording is opt-in per channel. Whether recording also needs individual consent depends on Organization policy and applicable law (OPEN-027); where it does, the same Consent Records and `CONSENT_REQUIRED` rule apply.
- Recordings and transcripts are encrypted object-storage assets with classification, retention and hash. They never appear in logs, debugging output, analytics or hidden client state.
- A transcription engine that needs an external service cannot run in an air-gapped profile; only locally installed engines qualify. Consent capture, legal basis, retention and access: OPEN-027.

## 8. LAN, offline and air-gapped operation

- With the Internet down and the LAN up, the local Plenum API, media server, TURN relays, certificates and identity provider operate with zero public egress: no CDN scripts, external login or cloud recording.
- Different LAN zones and strict firewalls may still need an internal TURN relay; real UDP and TCP routing is tested at installation.
- A fully disconnected device shows the channel as unavailable, its Media Credential expires, and it may keep unrelated authorized offline drafts. It never shows audio as delivered. Ad hoc peer-to-peer radio is out of scope, and there is no automatic switch to a cloud provider.

## 9. Failure, accessibility and evidence

- Provider outage: channels show `degraded` or `unavailable`, permissions fail closed, Participants keep unrelated workflow access.
- Control-plane outage: no new transmit grants; Floor Leases expire.
- Reconnection: re-authenticate and re-derive grants; stale floor requests are not replayed.
- Accessibility (06 §20): keyboard push-to-talk, visible microphone state, optional captions under the consent rule, and a non-audio path for every essential instruction. Browser microphone permission is explicit.
- Evidence records channel and Floor lifecycle, moderation and security decisions, policy revision, provider health and recording metadata. It does not assume that audio content was captured.

## 10. Deployment and capacity

The first Media Provider Adapter targets a self-hosted WebRTC selective forwarding unit; LiveKit is the candidate, not a hard dependency (ADR-017). The media server, TURN relays and any internal datastore ship as additional images in the ADR-013 bundle (DEC-49). Rooms are sized by concurrent listeners, active speakers, relay use, bitrate and recordings, separately from the DEC-16 application workload (OPEN-019). No throughput is claimed without benchmark evidence.

## 11. Acceptance tests

| ID | Scenario | Required observation |
|---|---|---|
| VOICE-01 | Unauthorized Session Role requests a Media Credential | Denied; no media grant |
| VOICE-02 | Simultaneous floor requests | At most one valid Floor Lease |
| VOICE-03 | Priority preemption | Only an authorized preemptor; old token revoked; evidence written |
| VOICE-04 | Same floor request retried | No duplicate grant or queue entry |
| VOICE-05 | Stage or Session Role changes while connected | Policy re-evaluated; Participant removed or muted |
| VOICE-06 | Internet down, institutional LAN up | Local audio and control with zero public egress |
| VOICE-07 | Device fully disconnected | Shown unavailable; no false transmitted state |
| VOICE-08 | Media server outage or control-plane loss | Leases expire; no new transmit grants |
| VOICE-09 | Recording disabled | No recording created or exported |
| VOICE-10 | Cross-organization channel probing | Denied at the API and provider boundary |
| VOICE-11 | Keyboard and assistive technology | Microphone, push-to-talk and status operable and understandable |
| VOICE-12 | DEC-16 workload with voice | Media profile measured, not inferred from participant count |
| VOICE-13 | Transcription started while one Participant has not consented | Refused with `CONSENT_REQUIRED`; nothing transcribed |
| VOICE-14 | Participant withdraws consent mid-transcription | Transcription stops; `voice_transcription.stopped` recorded |

Status: specification only. No provider deployment or tests have been run.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-10-17 | Owner-supplied specification COMMS-ARCH-001 (archived). |
| 1.1.0 | 2026-10-17 | Integrated into the document set: Session, Stage and Seat Assignment terms; channel Commands through the standard endpoint with push-to-talk as the exception (DEC-48); media stack exception (DEC-49); consent rule for recording and transcription (DEC-50, OPEN-027); Voice Channel term (DEC-51); canonical event names and error codes; VOICE-13 and VOICE-14 added. |
