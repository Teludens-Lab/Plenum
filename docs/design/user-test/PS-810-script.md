# PS-810 operator acceptance script

Status: `NOT RUN`  
Scope: authorized non-production staging only  
Target duration: 60-90 minutes after all staging prerequisites exist

This is the human change-level acceptance gate for PS-810. It is not a coding exercise and it is not production approval. Its purpose is to prove that the checked-in controls also work in GitHub and in the real staging environment.

Use synthetic identities and content. Never paste secret values into this file, chat, tickets, screenshots, command history or logs. Do not run destructive steps against production. Scanner results are security evidence, not formal accreditation.

## What this script asks you to do

| Work | Usually performed by | What you must prove |
|---|---|---|
| CI and security workflows | GitHub Actions | Every required job ran against the same candidate commit and failed jobs block the build. |
| DAST | Authorized repository operator | The scanner ran only against the approved staging hostname and retained its report. |
| Correlation and security evidence | Platform operator with an engineer | A failed staging request can be traced without logging protected content. |
| Malware quarantine | Platform operator with an engineer | Scanner outage and infected content both fail closed. |
| Alert delivery | Platform operations owner | A real configured receiver obtains an actionable notification linked to the runbook. |
| Secret rotation | AWS staging administrator | One reversible staging credential can be replaced, verified and rolled back without exposing it. |
| Release provenance | Authorized repository operator | The package, checksum, SBOM and attestations all identify the same commit. |
| Final decision | Tester and approving owner | Every required result is recorded as `PASS`, or PS-810 remains open. |

You do not need to complete all of this alone. Low-level staging, database and secret-rotation steps should be performed by the authorized operator while you witness and record the result.

## Result meanings

- `PASS`: the step was executed against the candidate and the required evidence exists.
- `FAIL`: the step ran but behaved incorrectly. Stop acceptance and open a defect.
- `BLOCKED`: required staging capability, access or approval does not exist. Record the blocker; do not improvise.
- `NOT RUN`: nobody attempted the step. This cannot be treated as approval.

`BLOCKED` and `NOT RUN` are not equivalent to `PASS`.

## Step 0 - create the acceptance record

Record these values before running anything. Use links, IDs and version numbers only; do not record credentials.

| Field | Value |
|---|---|
| Candidate full commit SHA | |
| Candidate image digest | |
| GitHub CI run URL | |
| GitHub security run URL | |
| Staging deployment ID | |
| Staging hostname | `https://plenum-stage-01.duckdns.org` |
| AWS Region | `us-east-2` |
| EC2 instance ID | |
| Test date and UTC window | |
| Tester | |
| Platform operations witness | |
| Approving owner | |
| Approved synthetic Session ID | |
| Chosen rotation parameter name | |
| Prior SSM parameter version number | |
| Incident or evidence folder | |

Confirm the working copy points to the intended commit:

```powershell
git rev-parse HEAD
git status --short
```

Pass conditions:

- `git rev-parse HEAD` exactly matches the candidate SHA.
- The candidate image digest is the digest actually running in staging.
- `git status --short` is empty, or unrelated local work is explicitly excluded from the evidence.

## Step 1 - verify that staging can support the test

Do this before stopping services or rotating anything.

1. Open the staging site and confirm it is a non-production environment containing only approved synthetic data.
2. Confirm `/healthz` is ready:

   ```powershell
   curl.exe --fail --show-error --silent https://plenum-stage-01.duckdns.org/healthz
   ```

   Expected result: JSON containing `"status":"ready"`.
3. Confirm an authorized operator can open an AWS Systems Manager Session Manager terminal for the staging instance. Port 22 must remain closed.
4. In that terminal, confirm the service and containers are healthy:

   ```bash
   sudo systemctl status plenum.service --no-pager -l
   sudo docker compose --file /etc/plenum/compose.yaml ps -a
   ```

5. Confirm all of the following capabilities exist before continuing:

   - Migrations `039_operational_security_events` and `040_operational_security_reader` have been applied.
   - The accepted deployment profile contains a running malware scanner and the application is configured with `CONTENT_SCANNER_HOST`, `CONTENT_SCANNER_PORT` and a bounded timeout.
   - `operations-reader-bootstrap` exited with code `0`, and the separately credentialed `plenum_operations` login can read only `evidence.operational_security_event_feed`.
   - `operations-agent` is healthy and `operations-state` contains current metric samples.
   - `/plenum/staging/operations` contains one approved alert receiver and scoped Postmark credential; do not print its value.
   - The operator has approval to use the EICAR anti-malware test string in staging.
   - A reversible SSM `SecureString` has been selected, and its prior version is retained.

Confirm the deployed services rather than assuming source configuration reached the host:

```bash
sudo docker compose --file /etc/plenum/compose.yaml ps -a malware-scanner operations-reader-bootstrap operations-agent
sudo docker inspect plenum-functional-free-operations-reader-bootstrap-1 --format 'status={{.State.Status}} exit={{.State.ExitCode}}'
```

Expected: scanner and agent are healthy; the bootstrap is exited with code `0`. A host still missing these services is running the older rendered Compose file and is `BLOCKED` until the approved in-place runtime update is completed.

## Step 2 - verify the GitHub CI gates

1. Open the repository in GitHub.
2. Select **Actions**.
3. Open the **CI** run for the candidate SHA.
4. Confirm these jobs completed successfully:

   - `static-unit-security`
   - `integration`
   - `browser-accessibility (product)`
   - `browser-accessibility (accessibility)`
   - `packaging-migrations`

5. Download and retain these artifacts:

   - `static-security-evidence`
   - `deployment-evidence`

6. Open the **Security analysis** run for the same SHA.
7. Confirm `codeql` succeeded and download `codeql-sarif`.
8. Confirm `dependency-review` succeeded on the pull request that introduced the candidate. It runs only on `pull_request`; a green direct push does not prove this row.
9. Open each job and confirm no required step is marked **skipped**, **neutral**, or **continue-on-error**.

Pass conditions:

- Every required job is green and identifies the same candidate SHA.
- Required evidence artifacts can be downloaded and are not empty.
- A deliberately failing test would fail the job rather than produce a release artifact.
- Dependency review has pull-request evidence; otherwise record this item as `NOT RUN` or `BLOCKED`.

Record the run URLs and artifact names. Screenshots are optional; the durable GitHub URLs and downloaded artifacts are primary evidence.

## Step 3 - verify supply-chain failure and clean recovery

The clean path is automated by `npm run test:supply-chain`. The negative path is engineering-led because it temporarily changes an isolated branch.

1. On a disposable branch, an engineer introduces one synthetic unreviewed license expression into an isolated lockfile fixture or equivalent test fixture.
2. Run:

   ```powershell
   npm run test:supply-chain
   ```

3. Confirm the command exits non-zero, identifies the unreviewed expression and does not produce an approved release artifact.
4. Discard the disposable branch or fixture change.
5. Run the same command against the clean candidate.
6. Confirm it exits zero and produces:

   - `test-results/supply-chain/ps-810-supply-chain.json`
   - `test-results/supply-chain/sbom.cdx.json`

Pass conditions:

- Negative fixture: `FAIL` is observed and no release is produced.
- Clean candidate: `PASS` is observed and the CycloneDX SBOM identifies the candidate revision.

Do not modify the real dependency policy merely to manufacture this result.

## Step 4 - run staging DAST

1. In GitHub, open **Actions** > **Staging DAST**.
2. Select **Run workflow**.
3. Choose the candidate branch or commit.
4. Select the only approved target:

   ```text
   https://plenum-stage-01.duckdns.org
   ```

5. Run the workflow and wait for completion.
6. Download the `ps-810-staging-dast` artifact.
7. Review every finding. The tracked rules file may classify only the reviewed modern-application and intentional public-cache notices as informational. Any new or unlisted alert fails the workflow and requires review; any unresolved high-severity finding is a blocker.
8. Verify the target guard separately with `node --test --test-name-pattern="staging DAST dispatch" tests/security/release-security.test.mjs`. It must accept the approved target and refuse unapproved or empty targets before the scanner.

Pass conditions:

- The approved target produces a retained DAST report.
- The target guard refuses unapproved origins before scanning.
- There are no unresolved high-severity findings.

Never enter a production hostname into this workflow.

## Step 5 - prove request correlation without data leakage

Use the approved synthetic Session ID from Step 0. In the commands below, replace `SESSION_ID_VALUE` with the UUID itself; do not keep placeholder text or angle brackets.

1. From a trusted terminal, make an intentionally unauthorized read request:

   ```powershell
   $sessionId = 'SESSION_ID_VALUE'
   curl.exe --silent --show-error --dump-header - --output NUL "https://plenum-stage-01.duckdns.org/v1/sessions/$sessionId"
   ```

2. Confirm the response is denied and copy the `x-correlation-id` response header.
3. In the authorized Session Manager terminal, search only for that correlation UUID:

   ```bash
   CORRELATION_ID='CORRELATION_ID_VALUE'
   sudo docker compose --file /etc/plenum/compose.yaml logs --no-color --since=10m application | grep --fixed-strings "$CORRELATION_ID"
   ```

4. Confirm the event identifies the deployment, normalized route, outcome, status and synthetic Session where applicable.
5. Inspect the matching JSON event and confirm it does **not** contain request or response bodies, authorization values, cookies, IP addresses, email addresses, filenames, user-agent strings, ballots, protected simulation content, audio or raw exception messages.

Pass conditions:

- The denied response and log share the same correlation ID.
- The route is normalized rather than containing uncontrolled opaque identifiers.
- The operator can identify the affected synthetic Session when the route is Session-scoped.
- No prohibited data appears in the event.

If a correlation ID is absent or the log cannot be found, record `FAIL`; do not search by personal data.

## Step 6 - prove private metrics are private and useful

1. From outside the EC2 host, request the internal path:

   ```powershell
   curl.exe --silent --output NUL --write-out "%{http_code}`n" https://plenum-stage-01.duckdns.org/internal/metrics
   ```

   Expected result: `404`.
2. From the authorized Session Manager terminal, request metrics inside the application container:

   ```bash
   sudo docker compose --file /etc/plenum/compose.yaml exec -T application node -e "fetch('http://127.0.0.1:8080/internal/metrics').then(async response => { console.log(response.status); console.log((await response.text()).slice(0, 2000)); if (!response.ok) process.exit(1); })"
   ```

3. Confirm metrics include bounded request count and duration signals.
4. Confirm metric labels do not contain Session IDs, correlation IDs, email addresses or arbitrary raw paths.
5. Confirm the independent collector can reach only the private listener and is writing current bounded samples:

   ```bash
   sudo docker compose --file /etc/plenum/compose.yaml exec -T operations-agent \
     node -e "fetch('http://application:9090/metrics').then(async response => { console.log(response.status); if (!response.ok) process.exit(1) })"
   sudo docker compose --file /etc/plenum/compose.yaml exec -T operations-agent \
     /bin/sh -ec 'find /var/lib/plenum-operations/telemetry -type f -name "*.jsonl" -mtime -1 -print | head -n 1'
   ```

Pass conditions:

- Public access is `404`.
- Private access is `200`.
- Metrics are useful for rate, error and latency diagnosis without high-cardinality or sensitive labels.
- The collector writes a current daily sample file in its private state volume.

## Step 7 - prove malware-scanner outage recovery

This step is allowed only after Step 1 proves that the accepted staging profile has a configured scanner. Use a clean synthetic text file; do not use personal or production content.

1. Record the current healthy status and the scanner container name.
2. In Session Manager, stop only the scanner service:

   ```bash
   sudo docker compose --file /etc/plenum/compose.yaml stop malware-scanner
   ```

3. Through the Studio Content Library, upload a new version of the clean synthetic file.
4. Confirm the version remains quarantined or unavailable and the UI does not report it as clean.
5. Confirm a scrubbed `security.upload_scan_failed` event and the expected alert are produced.
6. Restart the scanner:

   ```bash
   sudo docker compose --file /etc/plenum/compose.yaml start malware-scanner
   ```

7. Wait for the scanner to become healthy.
8. Upload the clean content as a **new governed version**. Do not manually relabel the failed version.
9. Confirm the new version becomes available only after a clean result.

Pass conditions:

- Scanner outage never makes content available.
- The failure is visible and actionable.
- Recovery requires a newly scanned version.
- The scanner is healthy again before proceeding.

If the scanner fails to restart, stop the acceptance session and follow the runbook.

## Step 8 - prove infected-content quarantine

1. Confirm the organization has approved use of the standard EICAR anti-malware fixture in this staging window.
2. Upload it through the same governed Content Library path.
3. Confirm the version remains unavailable and cannot be attached to a Scenario.
4. Confirm a `security.upload_infected` event and expected security ticket or notification are produced.
5. Confirm neither the filename nor file bytes appear in logs, metrics, alerts or screenshots.

Pass conditions:

- The infected version is quarantined.
- The event is immutable and scrubbed.
- No protected content is copied into the evidence record.

Do not download or attach the quarantined object to a ticket.

## Step 9 - verify append-only security evidence and least privilege

Use the correlation ID from the scanner-failure or infected-content event.

1. In Session Manager, set the scrubbed correlation UUID and query the narrow view through the operations container. The command reads its mounted secret without printing it:

   ```bash
   CORRELATION_ID='CORRELATION_ID_VALUE'
   sudo docker compose --file /etc/plenum/compose.yaml exec -T \
     -e CORRELATION_ID="$CORRELATION_ID" operations-agent /bin/sh -ec '
       export PGPASSWORD="$(node -e "const fs=require(\"fs\");process.stdout.write(JSON.parse(fs.readFileSync(\"/run/secrets/operations.json\",\"utf8\")).DATABASE_PASSWORD)")"
       psql --host database --username plenum_operations --dbname plenum --set ON_ERROR_STOP=1 \
         --set correlation_id="$CORRELATION_ID" --command \
         "SELECT event_type,severity,outcome,correlation_id,category,recorded_at FROM evidence.operational_security_event_feed WHERE correlation_id=:'\''correlation_id'\''::uuid"
     '
   ```

2. Confirm the same identity cannot change the view:

   ```bash
   sudo docker compose --file /etc/plenum/compose.yaml exec -T operations-agent /bin/sh -ec '
     export PGPASSWORD="$(node -e "const fs=require(\"fs\");process.stdout.write(JSON.parse(fs.readFileSync(\"/run/secrets/operations.json\",\"utf8\")).DATABASE_PASSWORD)")"
     psql --host database --username plenum_operations --dbname plenum --command \
       "UPDATE evidence.operational_security_event_feed SET category='\''changed'\'' WHERE false"
   '
   ```

   Expected: PostgreSQL refuses the update. A successful update is an immediate `FAIL`.

3. Confirm category, outcome, time, deployment and correlation agree with the structured log.
4. Use the automated integration evidence to confirm the application role cannot select, update, delete or truncate the security-evidence table.

Pass conditions:

- The operational reader can retrieve the event without receiving unrelated protected data.
- The application role cannot read or mutate the table.
- The event cannot be updated or deleted through the operational account.
- Database and log fields agree.

If no approved operational reader exists, record `BLOCKED`. Do not grant the application role broader access to complete the test.

## Step 10 - prove real alert delivery

1. Choose one reversible alert condition, preferably `malware-scanner-unavailable` during Step 7.
2. Record the trigger time in UTC.
3. Confirm the configured staging collector receives the matching signal.
   In Session Manager, inspect only its bounded delivery event:

   ```bash
   sudo docker compose --file /etc/plenum/compose.yaml logs --no-color --since=15m operations-agent | grep 'operations.alert_delivered'
   ```

4. Confirm the named receiver for `platform-operations` receives the notification.
5. Confirm the notification includes:

   - alert identity;
   - staging deployment identity;
   - UTC time;
   - severity and outcome;
   - correlation ID where applicable;
   - the correct section of `docs/operations/PS-810-OBSERVABILITY-SECURITY.md`.

6. Confirm it does not contain secrets, payloads, filenames, email addresses or file bytes.

Pass conditions:

- Delivery reaches the real configured receiver.
- The notification is actionable and correctly routed.
- The runbook link resolves to the correct response procedure.

A console log or checked-in alert JSON is not delivery evidence. If no collector and receiver are configured, record `BLOCKED`.

## Step 11 - rehearse one reversible staging secret rotation

This is a separate approval gate. Do not begin until the staging administrator, credential owner and rollback approver are present.

1. Select one staging-only credential that supports overlap. Record only its SSM parameter name, current version, owner and rollback version.
2. Create the replacement credential at its provider without revoking the old credential.
3. Update the existing SSM `SecureString` parameter. Keep its type as `SecureString`; do not change it to plain text.
4. Through Session Manager, fetch the current secrets and restart Plenum:

   ```bash
   sudo /usr/local/sbin/plenum-fetch-secrets
   sudo systemctl restart plenum.service
   sudo systemctl status plenum.service --no-pager -l
   ```

5. Verify:

   ```bash
   curl --fail --show-error --silent https://plenum-stage-01.duckdns.org/healthz
   sudo docker compose --file /etc/plenum/compose.yaml ps -a
   ```

6. Also verify OIDC login, storage upload/read/delete, media entry and invitation delivery for the dependency affected by the chosen credential.
7. Only after all checks pass, revoke the old provider credential.
8. If any check fails, restore the prior SSM parameter version, rerun the fetch and restart commands, and verify service recovery.
9. Inspect the relevant logs and confirm no credential value was emitted.

Pass conditions:

- The new SSM parameter version is active.
- Dependent services work before the old credential is revoked.
- The documented rollback can restore service.
- No secret appears in evidence.

Do not rotate AWS S3 access keys: staging S3 uses the `plenum-staging-runtime` instance role and has no static S3 credential.

## Step 12 - produce release provenance for the exact candidate

1. In GitHub, open **Actions** > **Release provenance**.
2. Select **Run workflow** and run it against the exact candidate ref.
3. Wait for the `attest` job to complete.
4. Download `plenum-release-CANDIDATE_SHA`.
5. Confirm the artifact contains:

   - `plenum-platform-CANDIDATE_SHA.tar.gz`;
   - `test-results/supply-chain/sbom.cdx.json`;
   - `test-results/supply-chain/ps-810-supply-chain.json`.

6. Confirm the package name, supply-chain evidence revision and GitHub attestations all reference the same full candidate SHA.
7. Record the workflow URL, artifact name, attestation URLs and checksums.

Pass conditions:

- Package, SBOM, checksum and attestations all identify the candidate.
- The workflow used no production credentials.
- GitHub retained the evidence.

If repository visibility or plan restrictions prevent attestations, record `BLOCKED`; do not describe an unattested package as approved.

## Step 13 - close the acceptance record

| Evidence | Result | Required reference or notes |
|---|---|---|
| Required CI jobs fail closed | NOT RUN | CI and security run URLs; artifact names; PR dependency-review URL |
| Supply-chain negative and clean paths | NOT RUN | Command output; SBOM and evidence paths |
| Staging DAST and target refusal | NOT RUN | Workflow URL; DAST artifact; reviewed findings |
| Correlation and Session diagnosis without leakage | NOT RUN | Correlation UUID; scrubbed log evidence reference |
| Public denial and private metrics | NOT RUN | HTTP results and bounded metric names |
| Scanner outage and clean recovery | NOT RUN | UTC window; failed and clean version receipt references |
| Infected fixture quarantine | NOT RUN | Immutable event and quarantine receipt references |
| Append-only security evidence and least privilege | NOT RUN | Operational query evidence and integration-test reference |
| Actionable alert delivery | NOT RUN | Receiver, delivery timestamp and runbook link |
| Secret rotation and rollback | NOT RUN | Parameter name and version numbers only; health evidence |
| Artifact provenance, SBOM and license result | NOT RUN | Workflow, artifact, attestation and checksum references |

Final decision:

| Decision field | Value |
|---|---|
| Change-level result | `PENDING` |
| Open high-severity defects | |
| Blocked or not-run rows | |
| Tester and date | |
| Platform operations witness and date | |
| Approving owner and date | |
| Exact approved commit SHA | |

Change-level approval requires every required row to be `PASS`, all high-severity defects to be closed, and the tester, witness and approving owner to be recorded. A green CI run alone does not complete PS-810. Production approval remains a later independent gate.
