# PS-250 verification

Date: 2026-10-19. Mode: critical production-oriented implementation evidence in disposable local infrastructure; not release approval.

## Delivered

- `@plenum/media-adapter` provides the candidate digest-pinned local LiveKit boundary. It issues 30-second, Participant/channel/permission-scoped Media Credentials, permits microphone audio only, rejects public endpoints, and exposes provider moderation without giving the provider database access.
- Migration `014_comms_voice_core` adds Organization-scoped Voice Channels, grants, provider observations, Floor requests and row-locked bounded Floor Leases. Audio remains outside PostgreSQL; recording and transcription remain off.
- `voice_channel.open`, `close`, `join`, `leave` and `moderate` run through the existing atomic Command, Evidence Event and outbox kernel. Private calls require explicit invited Participant IDs and joining records acceptance; broadcasts issue listen-only credentials where configured.
- The DEC-48 exception uses the canonical live-only `floor-requests`, `renew` and `release` endpoints. Request identity is scoped to one connection, authority epochs and tokens fail stale, and a database uniqueness constraint permits at most one active Floor holder.
- The Runtime exposes visible microphone/Floor/remote-audio status, explicit playback and microphone activation, keyboard and pointer push-to-talk, non-audio instructions, disconnect fail-closed behavior, and no offline queue/replay.
- The Fractured Order Release configures all four first-release Voice Channel modes and pins the candidate adapter digest. Deployment profile and runbook keep public discovery, recording and transcription disabled.

## Acceptance evidence

| Evidence | Result |
|---|---|
| `VOICE-01` unauthorized or cross-Organization credential request | PASS: denied without a media grant |
| `VOICE-02` simultaneous Floor requests | PASS: row lock plus partial unique index produced one active lease |
| `VOICE-03` authorized priority preemption | PASS: old token rejected, provider transmit changed, immutable Evidence Event written |
| `VOICE-04` retry and reconnect replay | PASS: same live connection returned the original lease; a different connection ID was rejected without a duplicate row |
| `VOICE-05` Seat/Stage revocation | PASS: database triggers revoked grants and Floor Leases; provider reconciliation is idempotent |
| `VOICE-06` local media path | PASS: two independent browser Participants connected to the loopback-only pinned SFU; one published a synthetic microphone track and the other subscribed to it |
| `VOICE-07` disconnect/no public endpoint | PASS: UI cleared transmitted state and did not queue; adapter rejected non-allow-listed endpoints; the deployment profile disables external IP discovery and requires WAN-deny firewall policy |
| `VOICE-11` keyboard/assistive path | PASS: Join, microphone and hold-to-talk were keyboard-operated, visible state and non-audio instructions remained present, and axe found no violations |

## Registered commands

| Reference | Command and environment | Result |
|---|---|---|
| `CMD-PLATFORM-TEST` | `npm test`; repo root; Node 24.22.0/npm 11.19.1 in isolated Docker dependency volume with network disabled | PASS, exit 0, 39/39, 6.0 s |
| `CMD-PLATFORM-INTEGRATION` | `npm run test:integration`; repo root; Node 24.22.0, empty PostgreSQL 18 database, disposable SeaweedFS 4.48 | PASS, exit 0, 13/13, 14.5 s |
| `CMD-PLATFORM-E2E` | `npm run test:e2e`; repo root; host Node 22.16.0 launcher, empty PostgreSQL 18 database, Playwright Chromium, pinned LiveKit 1.13.10 on loopback | PASS, exit 0, 10/10, 2.8 min; screenshot at `output/playwright/ps-150/voice-keyboard-local-media.png` |
| `CMD-PLATFORM-A11Y` | `npm run test:a11y`; same fresh browser/database/media fixture | PASS, exit 0, 5/5, 1.8 min |
| `CMD-AIRGAP` | `npm run test:airgap`; pinned Node 24.22.0 image, rootless/read-only/no-network container | PASS, exit 0, 9/9, 14 s; `test-results/airgap/ps-220-airgap.json` |

Additional checks: `npm run typecheck` PASS; Node 24 `npm run lint` PASS for 33 sources and 20 contracts; `npm run build:fractured-order` PASS with content digest `c0f1a471d97e6d2dfb1852fc8a9169f4340f2be6f451380f931520348e67db5c`; TLS-verified `npm audit --omit=dev --json` PASS with zero advisories. The browser launcher remains Node 22 because the installed Chromium toolchain is Windows-hosted; application/unit/database checks were repeated on required Node 24.

## Architecture, migration and recovery

The topology remains a modular monolith plus one replaceable institution-owned SFU/TURN deployment. The Release pins an adapter interface/version/digest, while provider-specific server and browser SDKs stay inside the adapter package. Provider callbacks are observation rows only and never become delivery proof or authorization state.

Migration 014 is additive and was rehearsed from migrations 001 through 014 on clean PostgreSQL 18 databases. Old application versions ignore the new schema. After first use, rollback means disabling the Release provider binding and stopping the media service; short credentials and Floor Leases expire. Preserve Voice/Floor Evidence data and forward-fix the schema rather than dropping it.

## Changed files

- Media package: `packages/media-adapter/package.json`, `packages/media-adapter/tsconfig.json`, `packages/media-adapter/src/index.ts`, `packages/media-adapter/src/browser.ts`, `packages/media-adapter/test/adapter.test.mjs`.
- Contracts/schema: `packages/event-contracts/src/index.ts`, `packages/simulation-schema/src/index.ts`, `apps/server/contracts/openapi.yaml`.
- Server/data: `apps/server/migrations/014_comms_voice_core.sql`, `apps/server/src/comms/voice.ts`, `apps/server/src/http/runtime-http.ts`, `apps/server/src/runtime/artifact-workflow.ts`, `apps/server/src/index.ts`, `apps/server/test/identity.integration.test.mjs`, `apps/server/package.json`, `apps/server/tsconfig.json`.
- Runtime web: `apps/runtime-web/src/voice/VoiceControls.tsx`, `apps/runtime-web/src/App.tsx`, `apps/runtime-web/src/styles.css`, `apps/runtime-web/package.json`, `apps/runtime-web/tsconfig.json`.
- Release/deployment/docs: `definitions/fractured-order/fractured-order-release-source.json`, `definitions/fractured-order/fractured-order-release.json`, `deploy/media/livekit.yaml`, `docs/media-runbook.md`, `docs/promptbook/DEPLOYMENT_PROFILES.md`, `docs/promptbook/PROJECT_STATE.md`, `docs/ps-250-verification.md`.
- Build/test wiring: `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.typecheck.json`, `scripts/contract-lint.mjs`, `scripts/test-airgap.mjs`, `tests/airgap/media-profile.test.mjs`, `tests/e2e/fixture.mjs`, `tests/e2e/global-setup.mjs`, `tests/e2e/playwright.config.mjs`, `tests/e2e/runtime-server.mjs`, `tests/e2e/runtime.spec.mjs`.
- Browser evidence: `output/playwright/ps-150/operator-accepted.png`, `output/playwright/ps-150/runtime-200-percent-text.png`, `output/playwright/ps-150/runtime-390px.png`, `output/playwright/ps-150/runtime-desktop.png`, `output/playwright/ps-150/voice-keyboard-local-media.png`.

## Release limits

- ADR-013 and ADR-017 remain unratified/Proposed; LiveKit is a candidate adapter, not a permanent product dependency.
- OPEN-027 remains unresolved. Recording and transcription are disabled; PS-320 owns their editor/consent work.
- The repository proves two-client loopback media and a no-public-egress deployment configuration. Institutional firewall-flow, certificate, local TURN, representative LAN-segment and provider-restart evidence remain deployment verification work, not claims made by this local test.
- Formal Security Owner/Operations Owner review, production recovery validation, media load/capacity and manual assistive-technology review are pending.
