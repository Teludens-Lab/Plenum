# PS-810 observability and security operations

This runbook governs the `operational-telemetry-v1` boundary. It is a change-level operating contract, not evidence that a production monitoring provider or response team has been approved.

## Browser Origin and CSRF boundary — BA-03

`PLENUM_PUBLIC_BASE_URL` is the sole approved browser origin, parsed once at construction and compared exactly with the supplied Origin. Production requires HTTPS. AWS/OCI use `https://${application_hostname}`; Compose requires the explicitly configured URL (its example is `https://plenum.example.invalid`). Runtime and Studio share that origin. Identity, media and notification hostnames are not additional browser origins. No Host, Forwarded or X-Forwarded-Host request header selects the allowlist; there is no suffix/wildcard matching or credentialed cross-origin CORS response.

The common HTTP boundary checks every non-GET/HEAD/OPTIONS request under `/v1/` and `/scim/v2/` before authentication, body reading or mutation. The Studio gateway applies the same check before authentication, project reads, upgrade and initial Draft sync. A supplied Origin must equal the configured origin byte-for-byte: null, malformed, sibling origins, alternate scheme/port, paths and multiple values are rejected. Any Cookie header requires Origin, even if Authorization is also present. A missing public URL fails closed for browser requests; production configuration supplies it to both boundaries. Origin rejection uses generic HTTP 403 (`PERMISSION_DENIED` for HTTP APIs), without reflecting the supplied Origin or protected resource content.

Cookie-free requests may omit Origin. This preserves explicit Bearer Authentication Session clients, cookie-free authenticated Studio WebSocket clients, SCIM provisioning, invitation-delivery Bearer clients, the Postmark Basic-authenticated webhook, and single-use invitation-token acceptance. These requests still pass the owning endpoint's credential, token, Organization and resource checks; absence of Origin does not authenticate anyone. Machine clients carrying a Cookie header must remove it and use their supported explicit credential, or send the approved Origin. Non-browser clients can forge Origin, so Origin never substitutes for authentication or authorization.

Generic JSON readers accept `application/json` (including ordinary media-type parameters); SCIM additionally accepts `application/scim+json`. Text/plain, HTML form and multipart mutation bodies are rejected, including on bodyless actions. Release imports retain `application/vnd.plenum.release+json`; Plugin uploads retain `application/vnd.plenum.plugin+json` or JSON; Organization archive imports retain JSON/gzip and their size/decompression bounds. Bodyless actions may omit Content-Type. The existing readers still enforce the endpoint-specific type and size limits after the common boundary rejects unsupported mutation media types.

The route review covers these mutation families; [BA-03 evidence](../acceptance/BA-03-browser-origins.md) links the exact OpenAPI inventory and handler branch review, including implemented routes not yet enumerated in OpenAPI:

| Family | Mutations reviewed |
|---|---|
| Identity/control plane | Platform Administrator changes/decisions; Organization provisioning/update/domains/activation/lifecycle; IdP stage/preflight/test/approve/activate/suspend/rollback; workforce invitations, SCIM credentials, group mappings, reconciliation, reviews, retries and member roles; logout and device registration. |
| Studio | Project create/import/archive/reopen; Template publication/lifecycle; content uploads; composition validation, validation/rehearsal/preview, freeze/approve/publish; research grants/revocation; configured Session creation; collaborative WebSocket updates. |
| Runtime/operator | Session creation, access, join/invitation/participant/Seat/readiness/guest/display/revocation; Release impact/activation; all Commands including ballots; floor requests/renew/release; lifecycle/Stage/Inject/dead-letter retry; attachment upload/rescan. |
| Data/extensions | Research consent/report/replay; retention policies/legal holds/enforcement/corrections; archive and Release imports; Plugin publisher/trust/revocation/submission/approval/license/install. |
| Protocol clients | SCIM Users create/replace/patch/delete and Groups patch; first-admin/workforce capability invitations; `/v1/messages`, `/v1/events/postmark`, `/v1/invitation-deliveries/events`. Credential validation remains mandatory. |

`GET /auth/login` and `GET /auth/callback` remain explicit OIDC protocol endpoints outside the mutation gate. Cross-site top-level callback navigation is necessary: BA-01 state, nonce, PKCE, browser transaction credential, consumption and same-origin return validation remain mandatory. No POST/form-post callback is enabled. Read-only HTTP GET/HEAD and OPTIONS retain their existing authentication/authorization/routing; no CORS permission is added. Internal readiness/metrics and test-only persona/shutdown routes are not production cookie mutation APIs.

Finding 10 was conditional: SameSite=Lax limits unrelated-site cookie delivery but does not protect against an attacker-controlled same-site sibling where the browser sends the application's cookie. The BA-03 Chromium fixture tests that actual cookie delivery; header-only tests separately cover missing/null/malformed Origin and machine policy. Do not generalize this into a claim that every unrelated site could exploit the old gateway. Existing per-update and broadcast revocation checks, CRDT generations, deduplication and reconnect behavior remain authoritative. No schema or cookie-policy change is required. Drain old application instances when deploying; rolling back reopens the finding. Deployed origin/proxy verification and final release approval remain separate gates.

## Runtime signals

The application writes one JSON object per operational event to standard output. Every event carries `contractId`, `event`, `severity`, `outcome`, `recordedAt`, `correlationId`, `traceId`, and `deploymentId`. HTTP completion events may add a normalized route, status, duration, and a Session UUID extracted from an authorized Session route.

The application never places request or response bodies, authorization values, cookies, IP addresses, email addresses, filenames, user-agent strings, raw exception messages, ballots, protected simulation content, or audio in operational telemetry. Route labels replace UUIDs and opaque path segments. Metrics never use Session or correlation identifiers as labels.

Prometheus-format metrics remain available to a human operator at `GET /internal/metrics` from the application container's loopback interface. Public callers receive `404`; the public proxy does not expose an `/internal/` route. AWS staging additionally exposes the same bounded metrics to `operations-agent` at `application:9090/metrics` on the private Compose network. That port is not published by Docker or Caddy.

The staging `operations-agent` polls readiness and metrics every 30 seconds, calculates windowed error-rate and latency signals, reads only the scrubbed `evidence.operational_security_event_feed`, and retains daily JSONL metric samples for 90 days in the private `operations-state` volume. It sends alerts directly to the configured Postmark receiver so application failure cannot suppress the notification. The agent receives only its read-only database password, verified sender, Postmark server token and one receiver address. It does not mount the application secret bundle, administrative database password, registry credential or object-storage credentials.

The checked-in dashboard and alert definitions in `deploy/observability/` are provider-neutral source contracts. A production collector must translate them without weakening thresholds or adding sensitive fields.

## Triage by correlation and Session

1. Copy the `x-correlation-id` from the failed client response or the operator's recorded value.
2. Search structured logs for that exact correlation UUID.
3. Confirm `deploymentId`, normalized route, status, outcome, and duration. If present, use `sessionId` to collect the surrounding Session-scoped events.
4. Read `evidence.operational_security_event_feed` through the `plenum_operations` account. Migration `040` grants its NOLOGIN capability role only `USAGE` on `evidence` and `SELECT` on that scrubbed view. The application role cannot read, update, delete, or truncate the underlying table.
5. Do not broaden the search to payload text or personal identifiers. Escalate through the incident owner if correlation evidence is insufficient.

## Readiness unavailable

Owner: `platform-operations`. Page after five minutes of non-2xx `/healthz` responses. Identify whether PostgreSQL, object storage, LiveKit, or retention enforcement is unavailable; stop new Sessions if readiness cannot be restored. Preserve logs and the current image digest before rollback.

## Server error rate

Owner: `platform-operations`. Page when the 5xx ratio exceeds five percent for ten minutes. Group by normalized route and deployment, then select a correlation UUID. Roll back only the application image when schema compatibility permits; additive migrations are forward-fixed.

## Request latency

Owner: `platform-operations`. Open a ticket when p95 exceeds one second for fifteen minutes. Check CPU, memory, PostgreSQL connections, object-storage latency, and route distribution before changing capacity.

## Security evidence failed

Owner: `platform-operations`. Page on any `security.evidence_failed`. The user-facing rate-limit decision remains denied, but the durable evidence insert failed. Preserve structured logs, stop privileged changes if evidence cannot be restored, and verify migrations `039` and `040` plus the operations reader bootstrap before resuming.

## Command rate limits — BA-02

Audit finding 2 is addressed by three separate database buckets, scoped to the deployment. All use the existing atomic `operations.consume_request_rate_limit` function and fixed UTC minute windows; no schema migration or distributed cache is required.

| Bucket | Requests/minute | Ownership and ordering |
|---|---:|---|
| Command ingress | 12,000 | Canonical network address, before authentication; all requests to `/v1/sessions/:id/commands` and its receipt paths, including missing/invalid credentials. Neither the URL Session nor credentials nor identity headers select its key. |
| Command principal | 120 | Trusted Organization + Person, across Authentication Sessions, devices, roles and simulation Sessions. POST only, after envelope validation and Session/participant/device access resolution. |
| Session aggregate | 1,200 | Trusted Organization + resolved Session, after the principal allowance. A principal denial never spends this allowance. |

Capacity basis: DEC-16/OPEN-019 and `deploy/load-fixtures/reference-profile.json` support 500 participants per Session and 10 concurrent Sessions. The application profile sends 100 Commands from distinct actors over 10 seconds. Repeating that six times plus a 500-ballot burst requires 1,100 requests per Session/minute; 1,200 leaves 100 for control/retry traffic. An actor in the repeated application set plus the ballot burst uses seven requests, within 120. Ten such Sessions consume 11,000 ingress requests, within 12,000. These are arithmetic policy bounds, **not measured throughput or an SLO**. BA-12 must recheck `CMD-LOAD-APP` and `CMD-LOAD-VOTING` on the converged candidate. Those existing load harnesses call the Command kernel directly; BA-02's real production HTTP test separately proves limiter/authentication ordering. New workload shapes or retry volume require revisiting both bounds and measurements.

The database stores only category, SHA-256 of deployment/category/scope, minute, count and expiry. Denied attempts count in the bucket reached. Keys expire at minute end; every consumption deletes entries whose expiry is more than five minutes old. This is lazy retention (normally about six minute windows under traffic); idle deployments may retain stale hashes until the next request. Attacker-controlled token/Session/identity values cannot multiply Command keys. Distinct observed addresses still create distinct bounded-lifetime buckets; this is application abuse protection, not network-level DDoS protection.

`PLENUM_TRUST_PROXY=0` uses the socket address and ignores forwarded headers. Set it to `1` only where network policy makes the immediate ingress exclusive and that ingress replaces `X-Forwarded-For` or appends its observed peer. The application takes only the last, syntactically valid IP, normalizes IPv6, and falls back to the socket for invalid/ambiguous headers. Client prefixes cannot choose a bucket. Multi-hop ingress must normalize the final hop to the intended client address; verify this on each deployed profile. Shared NAT/proxy clients share ingress allowance and can affect one another there, but cannot debit one another's principal or Session allowance through rejected anonymous requests.

Throttles retain the generic `RATE_LIMITED` envelope, HTTP 429, `Retry-After`, no-store and quota headers. Rate-limit events/metrics contain category and correlation, never bucket keys, addresses, Session existence or participant identity. Receipt GETs do not spend Command principal/aggregate quota. Authorized POST retries do spend request quota; a 429 creates no receipt/event/outbox/domain write, and retrying the same Command after recovery retains the existing idempotent receipt. Aggregate denial can spend that caller's principal attempt but does not enter the Command kernel. The change preserves Organization isolation, Session authorization and authoritative receipt transactions. Evidence: [BA-02 handoff](../acceptance/BA-02-command-limits.md).

## Radio Floor provider reconciliation — BA-04

Floor lifetime and provider acknowledgement are separate. Migration `044_floor_provider_reconciliation.sql` adds `provider_state`, `provider_attempts`, `provider_retry_at` and `provider_disabled_at` to the existing, Organization-isolated Floor Lease rows. Expiry, release, preemption, Seat/Stage revocation and moderation retain the holder until provider disable is confirmed. An expired database row alone is not provider enforcement. `pending_enable` after process loss is uncertain and is revoked, never replayed as a grant.

The production composition starts `startFloorReconciliationWorker` immediately, polls every 250 ms, allows one batch in flight and drains that batch on shutdown. Each batch selects at most 20 due channels; each channel handles at most 20 old obligations and stops at its first provider failure. Provider calls have a five-second timeout with SDK regional failover disabled. A failed disable remains pending indefinitely with retry spacing of 1, 2, 4, 8, 16, then 30 seconds; the counter saturates at 30. HTTP traffic cannot accelerate this backoff. There is no retry-exhaustion path that silently declares success. Polling and RPC bounds are configuration policy, not a measured expiry SLO under provider outage or backlog.

All Floor requests, renewals, releases, reconciliation and direct moderation/removal effects serialize by Organization/channel using a PostgreSQL session advisory lock. Short RLS-scoped transactions use that same connection; no database transaction spans a provider call. A successor waits until previous disables are acknowledged. The lease and Authority Epoch are rechecked around enable, and a raced/ambiguous enable is compensated. Version-checked acknowledgements and completed obligation state prevent an old retry from muting a newer valid lease. A missing provider participant is an idempotent disable success; an enable for a missing participant fails.

Provider uncertainty returns `MEDIA_UNAVAILABLE`; release can be durably recorded while its disable remains pending. The first failed disable appends the existing `media_provider.unavailable` Evidence Event and outbox record. Scheduled failures emit a scrubbed `media_provider.unavailable` operational event with category `organization_jobs_floor`. Inspect pending counts, oldest due time and attempt counts under the affected Organization's RLS context; do not log tokens, credentials or audio. Restore the pinned provider endpoint, verify the worker is running, and wait for `provider_state='disabled'` with `provider_disabled_at` before declaring recovery. Do not manually mark a pending obligation complete or enable a successor at the provider console.

Deployment: drain all old application instances, apply additive migration 044, start the candidate, and allow legacy obligations (default `pending_disable`) to reconcile before reopening radio traffic. Preserve all historical rows. Older code is schema-compatible but unsafe to run alongside this grant path; rollback reopens finding 3. Keep radio unavailable and forward-fix rather than down-migrating.

BA-05 integrates Floor reconciliation for all explicitly bound eligible Organizations; BA-11 still owns the deployed multi-Organization rehearsal. The production-entrypoint database test uses a synthetic TLS provider and does not extend the earlier real LiveKit browser proof. A worker only disables existing trusted channel/holder bindings, checks the pinned adapter and current authority, and cannot grant participant rights. Representative TURN/TLS, host failure and deployed multi-Organization coverage remain separate from local synthetic browser proof. [BA-04 evidence](../acceptance/BA-04-floor-revocation.md) records exact provider versions, failures and acceptance scope.

## Malware scanner unavailable

Owner: `platform-operations`. Page on `security.upload_scan_failed`. The upload remains quarantined and unavailable. Check the pinned `malware-scanner` container, signature update state, TCP 3310 on the private Compose network, memory pressure, and application timeout. Never mark the version clean manually; restore the scanner and create a new governed version.

## Infected upload

Owner: `platform-operations`. Open a security ticket on `security.upload_infected`. The object remains unavailable. Preserve the content digest and immutable receipt, but do not download or attach the object to tickets. Follow the approved evidence-preservation and deletion decision.

## Retention enforcement failed

Owner: `platform-operations`. Page on `retention.enforcement_failed`. Verify the service actor is a current Admin, database availability, active legal holds, and the last successful enforcement time. Do not bypass holds or manually delete export bytes.

## Scanner lifecycle

Self-contained profiles run the official ClamAV `1.4.6` multi-architecture image pinned by digest. The application uses the bounded INSTREAM protocol and fails closed on timeout, connection error, malformed response, or missing configuration. Signature freshness, memory use, and image vulnerability review are deployment gates. Updating the scanner image requires a reviewed digest, clean/infected/failure contract tests, deployment smoke, and a new plan; it is not a floating-tag operation.

## Secret and key rotation

Rotate only in staging until a production change is separately approved.

1. Name the credential, owner, dependants, expiry, rollback version, and maintenance window. Never copy the value into tickets, chat, logs, Terraform, or shell history.
2. Create a new provider credential first where overlap is supported: Postmark server/webhook credential, GHCR read token, Keycloak administrator credential, database password, LiveKit key pair, invitation delivery credential, or application signing secret.
3. Write the replacement to the existing SSM `SecureString` parameter. Record only the parameter name, version, timestamp, and approver.
4. Restart through Systems Manager so `/usr/local/sbin/plenum-fetch-secrets` installs the new version. Verify the service identity, `/healthz`, login, storage, media, and invitation path.
5. Revoke the old provider credential after successful verification. If verification fails, restore the prior SSM version, restart, verify, and open an incident.
6. Confirm logs contain no credential material and record the rehearsal outcome.

The operations agent uses the separately scoped `/plenum/staging/operations` `SecureString`. For an existing staging installation, create it once with `deploy/aws/scripts/configure-operations.ps1`. That command refuses to overwrite an existing parameter. Later rotation must use the normal approved overlap, version-recording and rollback process above.

AWS object access is not a rotatable static key: the application receives temporary credentials from `plenum-staging-runtime`. S3 blocks public access and insecure transport and encrypts objects with S3-managed AES-256 keys. Replacing that trust model or introducing a customer-managed KMS key requires a separate approved plan and recovery test.

## CI and release evidence

- `.github/workflows/ci.yml` blocks on static, unit, integration, browser, accessibility, security, migration/package, and completeness gates.
- Browser/accessibility jobs use the official Playwright Noble image pinned by amd64 digest; its version must match `@playwright/test` in the root lockfile. Update the image tag/digest together with Playwright. Browsers and OS libraries come from that image, so these jobs do not run apt or `playwright install`; `setup-node` still selects Node 24.22.1 and `npm ci` installs locked packages. PostgreSQL uses the job-network hostname `postgres`. Keep both suites blocking. [BA-05 CI follow-up](../acceptance/BA-05-tenant-jobs.md#ci-browser-setup-follow-up---2026-11-11) records the repeated runner DNS failure and replacement-environment checks.
- `.github/workflows/security.yml` runs CodeQL and pull-request dependency review.
- `.github/workflows/staging-dast.yml` accepts only the approved non-production staging origin. Its reviewed rules file classifies only the observed modern-application and intentional public-cache notices as informational; every new or unlisted alert remains a failing warning. The workflow passes that file explicitly to the pinned scanner because the action does not otherwise forward an INFO-only configuration.
- `.github/workflows/release-provenance.yml` packages the built output and requests GitHub build and SBOM attestations.
- `npm run test:supply-chain` emits a CycloneDX SBOM and fails on any unreviewed license expression.

CodeQL, dependency review, DAST, and GitHub attestations remain `NOT RUN` until their GitHub workflows complete. Repository visibility or plan restrictions are release blockers, not reasons to silently skip a job. DAST is a baseline unauthenticated scan; authenticated high-risk routes require a later approved staging session if the baseline cannot reach them.

## Recovery boundary

Telemetry failure must not convert a failed business operation into success. Durable security-event recording is required for the governed event paths; if it fails after a fail-closed denial, the denial stands and `security.evidence_failed` is emitted. Existing Releases, Sessions, audit records, and evidence are never deleted during rollback. Migrations `039` and `040` are additive and remain in place while application code is rolled back or forward-fixed.

## Organization scheduled work

### Runtime publication and client recovery (BA-06)

Runtime outbox publication now runs within the existing eligible-Organization sweep. Each invocation publishes at most 100 pending rows, ordered by Evidence sequence, for Sessions currently owned by this Deployment with active authority. The Organization's designated Admin service actor and binding revision are revalidated under tenant RLS. A transaction advisory claim serializes publishers for an Organization: overlapping processes cannot commit a later batch ahead of an earlier batch and make a cursor skip work. Publication and attempts commit atomically; rollback/restart leaves pending work recoverable. No provider/network call is held in this transaction. Existing discovery, SQL timeout and shutdown bounds below apply. Migration 045 from BA-05 remains required; BA-06 adds none.

Failures use the existing scrubbed `organization_jobs_publication` category and unhealthy-sweep readiness policy. Inspect pending count/oldest age and active Session Authority in the affected authorized tenant context; restore binding/actor/authority or database availability and allow the next bounded sweep to retry. Do not mark rows published manually. Publication does not disclose event bodies: each client read rechecks access and emits only metadata selected by the same authorized projections, with opaque cursors and no hidden Evidence sequence/version gaps.

Runtime consumes the existing finite SSE replay response every second while connected, falling back to the existing delta endpoint after transport errors. One request/batch is active per view, with a 10 s abort deadline and exponential retries capped at 30 s. Only nonduplicate affected events refresh authoritative Runtime/effect/adjudication projections; an empty batch does not reload the page. Snapshot/release recovery reloads the scoped bootstrap and projections. The cursor advances only after refreshed views are stored; memory cursors reset on page restart, retaining the existing encrypted Offline Outbox and canonical Command receipts. Server replay remains capped at 100 rows and 101 retained cursors per device; client deduplication retains the last 512 IDs.

Expired or changed-scope cursors clear protected projections and acquire a new snapshot. Access/device revocation clears scoped offline data; expired authentication removes projections and requires reauthentication while retaining local drafts. Logout/unmount/Session change abort requests and timers. Response-generation guards and serialized cache writes prevent an old read or Command response from restoring revoked state or overwriting a queued Command. Disconnect preserves the already-rendered view and existing live-only operation refusals; durable storage/reload retains only the approved minimized offline projection. A disconnected client cannot observe server revocation until connectivity returns. Reconnecting is announced in the status UI.

These are processing bounds, not measured deployment capacity. Re-run PS-830/840 Runtime/offline/role workflows on the converged candidate; BA-11 owes deployed tenant coverage and BA-12 owns representative app/voting load. [BA-06 handoff](../acceptance/BA-06-live-sync.md) records actual browser/database evidence and remaining limits. Attachment/checkpoint integration stays in its owning feature and subsequent audit tasks.

Owner: `platform-operations`. BA-05 addresses [audit finding 5](../release-evidence/2026-11-10-build-audit.md) under the user-approved durable tenant binding decision; see [authority and evidence](../acceptance/BA-05-tenant-jobs.md). The discovery transaction can read only binding metadata for the configured Deployment. Tenant jobs retain RLS and recheck the active Organization, active workforce/Admin actor, binding revision and enabled state inside mutation transactions. Injects/Floor also retain owning Deployment and current Session Authority Epoch checks. No human bootstrap actor is reused for another Organization.

The monolith polls every 250 ms, with one in-flight page of 10 bindings, two Organizations admitted concurrently, and a separate four-connection worker pool. Connection acquisition is limited to 5 s, statements to 10 s, query responses to 12 s. Discovery/bootstrap failures retry no faster than 5 s; a bootstrap failure cannot stop other tenants. A failed tenant advances the cursor so later tenants progress. Organizations suspended/offboarded or without an enabled binding are ineligible; an active Organization with a revoked actor raises an authority failure. Admin revocation/rotation increments the binding revision and waits for current short SQL transactions; already admitted provider disables drain under BA-04 fencing and timeout rules.

Injects retain 50 due Sessions / 100 Injects per Session per invocation. Floor work retains 20 channels and its existing provider retry bounds. Retention retains 10,000 artifacts per transaction, a database advisory claim, and a durable database-clock deadline: immediate after enrollment, 24 h after a completed batch, or the next discovery visit when backlog remains. Failed transactions preserve both bytes and the due deadline; legal holds remain effective. Deadline updates, purge and audit evidence commit together. Duplicate processes may scan the same tenant; domain claims/locks prevent duplicate effects. No deployment-size throughput guarantee is inferred from these arithmetic bounds.

Page on failed categories `organization_jobs_discovery`, `organization_jobs_authority`, `organization_jobs_inject`, `organization_jobs_floor` or `organization_jobs_retention`. Existing feature failure events remain; retention also preserves durable operational security evidence. Categories contain no tenant identity or payload. After the existing 60 s startup grace, readiness requires a complete healthy discovery sweep within 60 s; one tenant's successful work cannot hide another's failure. Investigate deployment bindings, current actor membership/workforce, lifecycle, due deadlines, Session Authority and dependencies under the affected tenant's authorized context. Restore/re-authorize the correct actor through the Admin API; never bypass holds, fabricate success or grant global access.

SIGTERM/SIGINT stops admission, cancels queued Session/channel work and drains admitted database/provider operations before closing either pool. A process restart rediscovers durable due work and never re-enables a revoked binding. Four connections/two Organizations are bounds, not measured production capacity; BA-11 must validate sweep latency for the actual tenant population. BA-06/07/10 retain feature ownership and must reuse this discovery boundary when their worker semantics are implemented.

### BA-07 attachment cleanup

The existing tenant worker now also runs Form attachment retention. Apply migration 046 before startup. The existing deployment binding and its own active Admin actor authorize each tenant; no new credential or environment setting is required. See [retention policy and recovery](../ps-520-data-dictionary-and-retention.md#ba-07-form-attachment-expiry-2026-11-11) for the owner-approved distinction between availability and held-byte preservation.

Page on `retention.enforcement_failed` with category `organization_jobs_attachments`. This also records durable operational security evidence without attachment names, object keys, hashes, tenant identities or content in metrics/logs. An unheld `purge_pending` row continues to degrade worker health during its retry cooldown; an empty successful scan cannot conceal it. Under an authorized tenant context, inspect pending journal rows and `retention_attempted_at`, active holds, actor status/binding revision, and object-store reachability. Restore storage or correct authority, then allow automatic retries. Do not clear the journal or mark a purge successful manually. Held pending work preserves bytes and resumes after authorized hold release; a previously completed deletion cannot be reversed by a later hold.

Each visit admits at most 10 rows, with a five-second admission budget, 30-second durable per-row retry spacing and ten-second S3 read/delete deadlines (an already-absent-object check can add another read). Two Organizations and four worker connections remain the composition-root bounds. Stop cancels admission and drains an in-flight operation. Local tests cover two processes, restart, post-startup enrollment, held bytes, failed delete and database interruption after successful S3 deletion. BA-11 must still prove tenant population/sweep timing in the actual deployment; BA-10 checkpoint wiring remains separate.
