# PS-810 operator acceptance script

Status: `NOT RUN`  
Scope: authorized non-production staging only  
Target duration: 30-45 minutes

This script is the human change-level acceptance gate for PS-810. Use synthetic identities and content. Do not run destructive steps against production, expose secret values, or interpret scanner output as accreditation.

## Preconditions

- A reviewed staging release contains migration `039` and the exact candidate image.
- The GitHub CI, security, staging DAST, and release-provenance workflows are enabled.
- The operator can read staging logs and approved operational evidence without using the application database role.
- A harmless clean text file and the standard EICAR anti-malware test string are available under the organization's security policy.
- A secret with a reversible prior SSM parameter version is selected for the rotation rehearsal.

## Steps

1. Open the candidate commit's CI run. Confirm static/unit, integration, browser/accessibility, security, migration/package, and completeness jobs all exist and none is skipped or allowed to fail.
2. Deliberately run the supply-chain command against an isolated branch with one unreviewed license fixture, then discard the branch. Confirm the job fails and emits no release artifact. Re-run the clean candidate and confirm PASS evidence and a CycloneDX SBOM.
3. Submit a failing synthetic Session request. Record the response's `x-correlation-id`; locate its structured log event and confirm the exact Session can be identified without payload, cookie, authorization, address, filename, email, ballot, or audio data.
4. Query the durable security event through the approved operational account. Confirm the application role cannot read or mutate it and that correlation, outcome, time, and category agree with the log.
5. Stop the staging malware scanner, upload a clean synthetic file, and confirm the version remains quarantined with a scan-failed event and actionable alert. Restart the scanner and create a new version; confirm it becomes available only after a clean result.
6. Upload the approved EICAR fixture. Confirm the version remains unavailable, an infected-upload event is recorded, and no file bytes or filename appear in logs or alerts.
7. Run the staging-only DAST workflow against `https://plenum-stage-01.duckdns.org`. Confirm another origin is refused and the approved target produces retained evidence. Record every unresolved high-severity finding as a blocker.
8. Rotate the selected reversible staging secret using the runbook. Confirm the new parameter version is active, old credential is revoked only after health/login/integration checks, and rollback restores service if the negative rehearsal is performed.
9. Trigger or simulate one alert condition in staging. Confirm the alert reaches the named owner, links to the correct runbook section, and the owner can identify the affected deployment and Session where applicable.
10. Run the release-provenance workflow for the exact candidate. Verify the packaged artifact, SBOM, checksum, and GitHub attestation refer to the same commit. Record any GitHub plan/visibility restriction as a release blocker.

## Acceptance record

| Evidence | Result | Reference / notes |
|---|---|---|
| Required CI jobs fail closed | NOT RUN | |
| Correlation and Session diagnosis without leakage | NOT RUN | |
| Append-only security evidence and least privilege | NOT RUN | |
| Scanner outage and clean recovery | NOT RUN | |
| Infected fixture quarantine | NOT RUN | |
| Staging DAST | NOT RUN | |
| Secret rotation and rollback | NOT RUN | |
| Actionable alert delivery | NOT RUN | |
| Artifact provenance, SBOM, and license result | NOT RUN | |

Change-level approval requires every row to be `PASS`, all high-severity defects closed, and the tester and approving owner recorded. Production approval remains a later independent gate.
