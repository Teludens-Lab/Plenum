# PS-500 offline threat model and command allowlist

Date: 2026-10-23. Scope: the browser Runtime Offline Outbox introduced by PS-500. This is a change-level threat model, not production device accreditation. `ADR-001` and `ADR-010` retain their recorded status. OPEN-014 and OPEN-015 were resolved by user direction on 2026-10-23; their production controls still require implementation and accreditation evidence.

## Security boundary

The Session Authority remains the only authority. The server derives the Principal, Organization, Participant, Seat Assignments, Active Role Context, Authority Epoch, access revision, active Governing Release, and offline policy from current server state. A queued Command is provisional until the ordinary Command endpoint returns its canonical receipt.

The browser persists one minimized Runtime cache and Offline Outbox per Session and registered device in IndexedDB. AES-256-GCM protects confidentiality and integrity at rest with a non-extractable Web Crypto key stored for that device. The reusable Offline Outbox cryptographic contract binds Session, device, Participant, and Active Role Context; the combined Runtime cache binds Session/device in authenticated data and validates its embedded bootstrap/outbox Participant and role scopes after decryption. A changed online trusted context replaces the prior cache. Corrupt or mismatched data is cleared.

The key and ciphertext share the browser origin. Encryption therefore protects raw database or profile-file inspection, but it does not defend against same-origin script execution, a malicious browser extension, an unlocked authenticated profile, or an attacker able to invoke the stored key through the application origin. Browser storage is not a high-assurance keystore. Under resolved OPEN-014/015, production offline use is limited to managed single-user devices, is disabled on shared/unmanaged devices, and is disabled for high-security/air-gapped browser use unless TPM/OS-keystore protection is available. The current browser implementation has not yet evidenced those deployment controls.

## Authoritative command allowlist

The code owner is `OFFLINE_QUEUEABLE_COMMAND_TYPES_V1` in `packages/event-contracts/src/index.ts`; this table documents that contract without creating a second policy source.

| Command | Offline rule | Reconnect behavior |
|---|---|---|
| `artifact.create` | Allowed for a non-control Active Role Context before credential expiry | Preserve the original Command ID, aggregate ID, expected version, Governing Release, and payload; look up an existing receipt before submission |
| `artifact.edit` | Allowed under the same conditions | Submit after a dependent create and retain the editable local payload on rejection or reconciliation |
| `artifact.submit` | Allowed under the same conditions | Submit after dependent create/edit Commands and retain the draft on rejection or reconciliation |
| `ballot.cast` | Allowed only for an eligible, open Poll projected to the Participant | The Session Authority uses receipt time; a Poll closed before receipt returns `DEADLINE_EXPIRED` and the local payload remains editable |

Control-role Commands and adjudication, Stage, timer, Session, Release Activation, voice, Floor, composition, effect-approval, and other Approval Decision operations are never queued. They are refused offline and cannot be replayed by the outbox.

## Data minimization and lifecycle

- The cached projection retains only Session status, offline-capable Artifact forms/tasks/actions, the Participant's projected Artifacts, and eligible open uncast Ballots.
- Messages, Injects, voice data or credentials, closed/ineligible Ballots, tally/certification data, Poll management, adjudications, Effect Proposals, and control actions are absent.
- Device time is stored only as an observation. Server receipt time and server-side state decide acceptance.
- Credential expiry disables queueing, deletes the cached Session projection, and retains encrypted local drafts for re-authentication. It does not submit them.
- On an observed access, role, or device revocation, the client clears controllable cached data. An offline client cannot learn a new revocation until it reconnects; no remote-wipe claim is made.
- A trusted-context change creates a new scoped outbox. Queued work from the previous role is not submitted under the new role.

## Threats, controls, and residual risk

| Threat | Implemented control and evidence | Residual risk / owner |
|---|---|---|
| Raw stolen-device storage reveals Session content | AES-GCM ciphertext, non-extractable key, minimized projection; browser test verifies raw IndexedDB lacks the draft and operation type | An unlocked or origin-compromised profile can use the key. Resolved OPEN-014 requires managed devices and disables high-security browser offline storage without TPM/OS-keystore protection; enforcement/accreditation is pending. |
| Another role receives cached hidden data | Server-filtered projection, minimized cache, Participant/role scope binding, scope mismatch rejection, online scope reset | Resolved OPEN-014/015 disables shared/unmanaged-device offline use; deployment enforcement is pending. |
| Expired or revoked credentials create apparent authority | Local expiry blocks queueing and cached projection use; reconnect reauthorizes every receipt lookup and Command; authorization failures clear controllable cache | Resolved OPEN-015 caps offline authority at eight hours without offline renewal; exact server issuance/enforcement evidence is pending. |
| Lost acknowledgement duplicates a mutation | Durable write precedes the saved message; reconnect looks up the original receipt, resubmits the unchanged Command only when absent, and relies on server idempotency | Availability depends on the Session Authority; no automatic authority failover |
| Stale version or changed Release is silently overwritten | Original versions and Governing Release are immutable in the queued Command; canonical rejection/reconciliation is retained with an editable draft | A human must revise or replace the draft |
| Late Ballot is counted from device time | Device time is observational; the server evaluates receipt time and Poll state | Resolved OPEN-015 confirms server receipt time and Poll state as authoritative. |
| Live-only request is replayed | Fixed allowlist and control-role exclusion; browser coverage verifies Approval Decisions do not create an outbox | New Command types default to live-only until explicitly reviewed and added |
| Corrupt local storage causes silent loss or unsafe parsing | AES-GCM authentication, contract/scope checks, explicit clear-and-error behavior | Corrupt data is not recoverable from the browser cache; server state remains authoritative |

## Partial-failure recovery

1. Local encryption or IndexedDB write failure: show that the Command was not queued; do not claim saved state or send it.
2. Network failure after durable write: retain `local_pending`; never label it submitted or accepted.
3. Reconnect: process Commands in dependency order, look up each Command Receipt first, and then submit the original envelope only if no receipt exists.
4. Accepted receipt: remove the entry and refresh the authorized projection.
5. Rejected or `needs_reconciliation`: retain the canonical receipt and editable local payload.
6. Revocation, wrong role, wrong device, or corrupt scope: do not submit; clear controllable cached Session data.

## Release gate

PS-500 can be implementation-complete, but it is not production-release approved. OPEN-014 and OPEN-015 now approve the production device posture, key custody, eight-hour authority, shared-device exclusion, 30-day encrypted-draft retention and exact Command allowlist. Production still requires those controls to be implemented, tested and accredited. Revisit this model when the policy changes, browser storage is replaced, or a new Command type requests offline support.
