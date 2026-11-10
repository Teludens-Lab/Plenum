-- BA-01: additive binding; pre-upgrade pending attempts fail closed and must restart.
ALTER TABLE identity.oidc_login_attempts
  ADD COLUMN browser_credential_sha256 text
    CHECK (browser_credential_sha256 ~ '^[0-9a-f]{64}$');
