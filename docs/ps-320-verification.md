# PS-320 Poll, Voice Channel, and consent editor verification

Date: 2026-10-20.

## Outcome

PS-320 is implementation-complete for its bounded first-proof scope. Studio now provides canonical Poll and Voice Channel editors, an explicit plain-language counting rule, electorate/result previews, a Voice permission matrix, and Media Provider capability previews for cloud, institutional, and air-gapped profiles.

Runtime exposes participant-scoped recording/transcription status and consent controls. Consent changes are live-only and append-only. Starting a consent-gated process without every active Participant's current consent returns `CONSENT_REQUIRED`; withdrawal stops an active process and writes both the withdrawal and stop Evidence Events in the same transaction. Recording and transcription default to off.

The slice does not add ranked choice, video, anonymous surveys, legal-basis selection, production secret ballots, or production recording/transcription enablement.

## Contracts and controls

- `poll-definition-v1`, `voice-definition-v1`, and `voice-consent-v1` identify the shared definition and participant projection surfaces.
- Poll publication validation rejects an implicit denominator, abstention treatment, or tie rule. Secret ballots remain blocked by `OPEN-028`; anonymous surveys remain unavailable.
- Voice publication validation checks selected mode and recording/transcription capability for every declared target profile. Non-off recording/transcription remains blocked by `OPEN-027`.
- `comms.consent_records` records Participant, channel, kind, action, Command, and time. Update, delete, and truncate are refused.
- `comms.recording_assets` stores only classified object references, hashes, retention class, and consent basis; no audio or transcript bytes enter PostgreSQL.
- Consent records and Voice projections are tenant- and Session-scoped. Participant choices and media assets are not added to ordinary Evidence payloads.

## Acceptance evidence

| Reference | Result | Evidence |
|---|---|---|
| `VOTE-15` | PASS | Unit cases reject missing Poll denominator/tie semantics and gated secrecy modes; Studio E2E renders the explicit counting sentence and audience preview. |
| `VOICE-09` | PASS | Unit validation rejects an adapter/profile that cannot provide the selected mode; Studio displays the three-profile capability table. |
| `VOICE-11` | PASS | Runtime and Studio retain text status, permission, floor, consent, and moderator instructions independent of audio. |
| `VOICE-13` | PASS | Database integration returns `CONSENT_REQUIRED`, proves participant-scoped append-only consent, and leaves recording assets empty; browser flow captures consent. |
| `VOICE-14` | PASS | Database integration proves withdrawal flips transcription inactive and atomically records `voice_consent.withdrawn` plus `voice_transcription.stopped`; browser flow shows the immediate stopped state. |

## Verification

Commands ran from the repository root with the local qualified toolchain, PostgreSQL 18 in isolated disposable databases, and local Playwright Chromium.

| Registry ID / command | Result | Evidence |
|---|---|---|
| `CMD-PLATFORM-LINT` / `npm run lint` | PASS | 44 sources, 24 versioned contracts, canonical naming, acyclic workspaces. |
| `CMD-PLATFORM-TYPECHECK` / `npm run typecheck` | PASS | No TypeScript diagnostics. |
| `CMD-PLATFORM-TEST` / `npm test` | PASS | 64/64, including `VOTE-15` and `VOICE-09`. |
| `CMD-PLATFORM-BUILD` / `npm run build` | PASS | Exercised by lint/test/E2E; server/packages and both web bundles built. |
| `CMD-PLATFORM-DB` / `npm run test:db` | PASS | 14/14 on migration 016, including `VOICE-09/11/13/14`. |
| `CMD-PLATFORM-E2E` / `npm run test:e2e` | PASS | 12 passed; one live-SFU proof intentionally skipped because `MEDIA_TEST_URL` was absent. |
| `CMD-PLATFORM-A11Y` / `npm run test:a11y` | PASS | 6 passed; same live-SFU skip. Axe, keyboard semantics, consent UI, and Studio 200% reflow passed. |

Browser evidence remains under `output/playwright/ps-150/`. The existing 532.95 kB Runtime chunk warning remains; this slice does not claim a performance gate.

## Migration and recovery

`016_voice_consent_assets.sql` is additive. It adds inactive-by-default Voice process flags and two forced-RLS, append-only tables. Existing Voice definitions and rows remain readable; old application code ignores the additions.

After use, do not roll the migration back by deleting consent or asset provenance. Disable new recording/transcription Commands and forward-fix. Database restore must be coordinated with encrypted object storage because recording rows contain references, not media bytes. Retention/deletion execution and legal basis remain governed by the unresolved `OPEN-027` policy.

## Release limits

This is not production approval. `OPEN-027` still blocks production recording/transcription until authorized consent, legal-basis, retention, deletion, provider, and operating controls are ratified. `OPEN-028` still blocks production secret ballots. Manual screen-reader and human usability review remain outstanding.
