# Task handoff template

## Outcome

- Task: `<PS-nnn — title>`
- Status: `PASS | FAIL | BLOCKED | NOT RUN`
- Delivered behavior: `<observable user/system outcome>`
- Files/modules changed: `<exact paths>`
- Architecture/topology impact: `<none or concise explanation>`

## Acceptance and evidence

| Acceptance/test ID | Result | Actual behavior | Evidence artifact / output reference |
|---|---|---|---|
| `<ID>` | `<status>` | `<observed result>` | `<stable path/hash/run ID>` |

Include valid behavior and applicable unauthorized, cross-tenant, disconnected, stale, duplicate/retry, deadline, concurrency, and partial-failure cases. Never substitute an expected result for an actual one.

## Verification

| Command ID | Exact command and cwd | Environment/tool versions | Result / exit code | Duration | Artifact |
|---|---|---|---|---|---|
| `<CMD-*>` | `<command>` | `<names and versions; no secret values>` | `PASS/FAIL/BLOCKED/NOT RUN` | `<time>` | `<path/reference>` |

## Data, compatibility, and recovery

- Migration IDs and state: `<none or identifiers>`
- Compatibility impact: `<Package/API/client/Plugin/persisted Session>`
- Rollback or forward-fix: `<tested approach>`
- Backup/restore impact: `<none or evidence>`
- Deployment/configuration impact: `<none or exact variables/profile>`

## Security and privacy

- Trusted-context and authorization behavior: `<evidence>`
- Tenant/session denial: `<evidence>`
- Sensitive-data/log review: `<evidence>`
- Consent, ballot, voice, or Plugin trust impact: `<none or gate>`

## Working tree and commit

- Pre/post `git status --short`: `<summary>`
- Unrelated user changes preserved: `<yes/no and details>`
- Commit created: `<no unless authorized; otherwise SHA and subject>`
- PR/push/deploy performed: `<no unless separately authorized>`

## Risks and continuation

- Known limitations/defects: `<list with severity>`
- Unratified dependencies: `<DEC/ADR/OPEN IDs>`
- Gates not run and reason: `<list>`
- Documentation/state updated: `<paths>`
- Next eligible task: `<ID or none>`
- Revisit triggers: `<decision, evidence, version, or operational change>`
