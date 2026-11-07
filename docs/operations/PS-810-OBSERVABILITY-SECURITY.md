# PS-810 observability and security operations

This runbook governs the `operational-telemetry-v1` boundary. It is a change-level operating contract, not evidence that a production monitoring provider or response team has been approved.

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
- `.github/workflows/security.yml` runs CodeQL and pull-request dependency review.
- `.github/workflows/staging-dast.yml` accepts only the approved non-production staging origin. Its reviewed rules file classifies only the observed modern-application and intentional public-cache notices as informational; every new or unlisted alert remains a failing warning.
- `.github/workflows/release-provenance.yml` packages the built output and requests GitHub build and SBOM attestations.
- `npm run test:supply-chain` emits a CycloneDX SBOM and fails on any unreviewed license expression.

CodeQL, dependency review, DAST, and GitHub attestations remain `NOT RUN` until their GitHub workflows complete. Repository visibility or plan restrictions are release blockers, not reasons to silently skip a job. DAST is a baseline unauthenticated scan; authenticated high-risk routes require a later approved staging session if the baseline cannot reach them.

## Recovery boundary

Telemetry failure must not convert a failed business operation into success. Durable security-event recording is required for the governed event paths; if it fails after a fail-closed denial, the denial stands and `security.evidence_failed` is emitted. Existing Releases, Sessions, audit records, and evidence are never deleted during rollback. Migrations `039` and `040` are additive and remain in place while application code is rolled back or forward-fixed.
