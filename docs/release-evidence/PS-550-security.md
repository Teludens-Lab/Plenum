# PS-550 security assurance report

Date: 2026-10-26  
Scope: PS-550 local engineering evidence only; this is not accreditation or a formal penetration test.

## Mandatory control matrix

| Control | Result | Evidence / limitation |
|---|---|---|
| Input validation | PASS | Unit, database and browser suites exercise malformed, stale, oversized and unauthorized Commands at trusted boundaries. |
| Output encoding and browser response hardening | PASS | React/JSON boundaries remain typed; packaged responses now assert CSP, HSTS, no-sniff, deny framing, referrer and permissions policies. |
| CSRF protection | PASS | Authentication cookie is `Secure`, `HttpOnly`, `SameSite=Lax`; state-changing APIs derive identity server-side and reject unauthorized contexts. |
| Secure token handling | PASS | OIDC/session tests and deployment configuration keep browser credentials protected and server authoritative. |
| Rate limiting | PASS locally | The packaged entry point applies PostgreSQL-backed atomic limits across replicas: authentication 10/min/IP, agent 30/min/session, upload 5/min/session, Session Commands 120/min/Session and other API requests 300/min/session or IP. Excess requests receive 429 and `Retry-After`; forwarded addresses are trusted only when explicitly configured. Fresh-database concurrency tests pass. Institution monitoring remains external. |
| Retention enforcement | PASS locally | Migration 025 adds forced-RLS append-only legal holds and a trigger-guarded one-way export-byte purge. The five-minute tenant job enforces OPEN-009's 90-day export period in bounded batches and writes immutable Audit Records. Fresh-database hold/release/purge/restore tests pass; institution scheduler monitoring remains external. |
| Upload type validation and malware scanning | NOT RUN | No production malware-scanning service or institutional upload procedure was available. This control must be completed before enabling untrusted uploads. |
| Encryption in transit | PASS | Reference deployment requires TLS material; HSTS and secure cookies are asserted. Representative media used real TLS/TURN. Institution-owned certificate operations remain external. |
| Encryption at rest | NOT RUN | Local encrypted backup/offline-cache behavior passes, but production database/object/media storage encryption was not inspected. |
| Key lifecycle management | NOT RUN | Local Ed25519 rotation and verification pass; production KMS/HSM custody, rotation and revocation were not exercised. |
| Least-privilege service roles | PASS | Forced-RLS PostgreSQL tests, tenant denials, no-egress extension host and dropped-container-capability checks pass locally. |
| Secret rotation | NOT RUN | Secret files/mounts are configured, but production rotation and rollback were not rehearsed. |
| Dependency scanning | PASS | `npm audit` reports 0 total vulnerabilities after updating `fast-uri` to 3.1.9. |
| Secret scanning | PASS | `PS-550-T01` scans non-ignored source plus all Git revisions for tracked sensitive filenames and high-confidence credential/private-key patterns. It is not an entropy scanner. |
| Security event monitoring | NOT RUN | Audit/Evidence records exist and are tested; institution-owned alert routing, retention and response were not exercised. |
| SAST | NOT RUN | No approved SAST tool is configured in this repository. |
| DAST / penetration test | NOT RUN | No approved staging target or assessor was provided. |
| Administrative Audit Record isolation (`REQ-052`) | PASS | Policy and forced-RLS tests deny ordinary Participant access while privileged mutations retain Audit Records. |
| Tenant and protected projection isolation (`INV-002`) | PASS | Cross-Organization requests, hidden Artifact/version probing and protected export fields are denied or omitted server-side. |
| Secret Ballot privacy (`VOTE-09`, `INV-025`) | PASS | Early/unauthorized results and identity-choice linkage are absent from shared evidence, analytics and research output in local integration tests. OPEN-028 still blocks production custody. |
| Voice Organization isolation (`VOICE-10`) | PASS | Cross-Organization channel/provider probing is denied by integration boundaries. |
| Transcription consent (`VOICE-13`, `INV-027`) | PASS | Missing consent returns `CONSENT_REQUIRED`; withdrawal stops transcription atomically. OPEN-027 still blocks production policy. |

## Automated result

`npm run test:security` is the verified `CMD-SECURITY` command. It runs the PS-550 source/history and deployment checks, then the locked dependency audit. Machine-readable evidence is written to `test-results/security/ps-550-security.json` and includes the baseline revision, full source-manifest digest, package-lock digest, runtime, duration and exit code.

## Security decision

Local negative controls pass, but security release approval is **NOT GRANTED**. The NOT RUN production controls remain release blockers. Security Owner review cannot be inferred from automated evidence.

