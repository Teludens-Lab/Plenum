# Statecraft Simulations Group

This owner-authorized, one-time deployment bootstrap is bundled in the application image. It creates:

- The active `statecraft-simulations-group` organization.
- `trenton.ford`, `chloe.carr`, `sethu.nguna`, `ryan.paoloni`, and `ben.petrihos`, each with the Organization `admin` role only.
- An organization-scoped provider using the deployment's existing Keycloak realm and client. The existing recovery organization and `plenum-tester` are untouched.
- The Fractured Order Project, editable Draft, and immutable Template, including the original Scenario, from the verified bundled Release Package.
- A scheduled-work binding for this deployment with Sethu as the organization-local Admin actor.

The owner explicitly designated these identities and authorized setup without additional approvals. Bootstrap records that authorization and the source package digest in immutable audit/lifecycle records. It does **not** manufacture reviewer approvals, provider browser-test results, verified email addresses, or verified domains. Normal product authorization and subsequent publication workflows remain unchanged. Contact/country/time-zone information remains `needs_reconciliation` until entered through Platform Control; workspace-slug sign-in works without inventing domain ownership.

## Build and preview

From the repository root with Node 24+:

```powershell
npm run build
npm run setup:statecraft -- --plan
npm run test:statecraft
```

The plan verifies the bundled package and prints the five usernames, organization identity, digest and sign-in path. It makes no network calls or writes. The deployment image must include this change; run setup from that same image after migrations through `045` have completed.

## Apply on the existing staging host

Use an authorized Session Manager terminal. No Terraform apply, database reset, service restart, email invitation, or new paid resource is needed. The application Compose environment supplies `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `PLENUM_PUBLIC_BASE_URL`, `PLENUM_DEPLOYMENT_ID`, `PLENUM_RETENTION_ACTOR_PERSON_ID`, and the application secret bundle. Its database connection must be the existing privileged migration connection, and its actor must already be an active Platform Administrator. Ordinary application-role credentials are refused before accounts are created.

The following starts an isolated one-off process from the configured application image and prompts twice for each password with input hidden:

```sh
sudo docker compose --file /etc/plenum/compose.yaml run --rm --no-deps \
  --entrypoint node \
  --volume /etc/plenum/secrets/keycloak-admin-password:/run/plenum-bootstrap/keycloak-admin-password:ro \
  application deploy/statecraft/setup.mjs --apply
```

Use a different password of at least 12 characters for each person; the realm's password policy also applies. Passwords are set as non-temporary as requested. They are never printed or written by the prompt. Keep the mounted secret readable by the application's existing secret-reader group, not world-readable.

For unattended setup, supply a protected JSON file outside the checkout/image with exactly those five usernames as keys and their passwords as string values. Mount it read-only and set `STATECRAFT_PASSWORDS_FILE` to its container path. Do not put passwords in command arguments or commit the file. `KEYCLOAK_ADMIN_PASSWORD_FILE` can override the mounted administrator-password path. The Keycloak administrator is the existing `plenum-admin` in the master realm.

The script uses the [Keycloak Admin REST API](https://www.keycloak.org/docs-api/26.8.1/rest-api/) and does not enable direct password grants for application users. The otherwise empty `plenum-bootstrap-<organization UUID>` group identifies accounts owned by this setup for interrupted-run recovery; it grants no roles.

## Sign in and verify

Open the application's normal sign-in modal and enter workspace **`statecraft-simulations-group`**, or visit:

```text
https://plenum-stage-01.duckdns.org/auth/login?organization=statecraft-simulations-group
```

Sign in separately as all five users. Confirm the organization name, Administration access, and Fractured Order in Projects and the Template library. Select **Start from Template** with Scenario content and confirm the resulting Draft opens. Confirm these accounts cannot open Platform Administrator management or another organization's data. Organization Admin does not itself grant Publisher, Reviewer, or Operator roles; assign any additional working roles through normal organization administration when needed.

Keep the setup output with the deployed image digest. Its `providerBrowserTest: not_run` is intentional: successful setup is not a browser-login test. An administrator can complete missing organization profile/contact fields later.

## Retry and recovery

- Database creation is one transaction, serialized by a lock scoped to this organization. Failure rolls back its organization, memberships, template and audit marker together.
- Keycloak and PostgreSQL cannot share a transaction. If a run fails after creating some accounts, those accounts remain in the bootstrap group. Rerun with the same password input to finish; existing account passwords are **never reset**. No database access is granted until the database transaction commits.
- An existing username outside the bootstrap group, a disabled account, or an unrecognized organization/person collision fails closed. Resolve it explicitly; the script does not adopt, delete, or overwrite existing identities.
- Once the audit marker exists, rerunning is a no-op, even if an administrator has since removed a role, suspended the organization, changed a password, or edited a Draft. Setup is not access reconciliation or password rotation.
- The original installed Template remains immutable if a later build contains a changed package. Publish updates through the product workflow.
- To withdraw access, use normal account/workforce suspension. Do not delete the organization, Keycloak users, audit records or persistent volumes as a rollback.

## Isolated database regression

`tests/deployment/statecraft.integration.test.mjs` requires a **blank disposable PostgreSQL database** named `plenum_statecraft_test_<suffix>`, supplied through `STATECRAFT_TEST_DATABASE_URL`. It applies the repository migrations and never resets an existing database. Run `npm run test:statecraft:db` after building. The test covers real constraints, organization routing, tenant isolation, transaction rollback, and rerunning after access/content changes. It uses synthetic Keycloak subject IDs, so it does not prove live provider interoperability.
