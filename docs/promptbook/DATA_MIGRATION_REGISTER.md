# Data migration register

IDs are planned and unique in `tasks.json`. Exact SQL filenames are assigned by the owning implementation task after inspecting the live migration sequence.

| Planned ID | Owner task | Change | Pattern | Recovery / compatibility |
|---|---|---|---|---|
| 001-004 | Observed slice | Core, Runtime/sync/evidence, collaboration schema, security/RLS | Forward-only, per-file transaction | Historical PASS Pg16; PS-001 rehearses Pg18 |
| `005_identity_oidc_context` | PS-110 | `apps/server/migrations/005_identity_oidc_context.sql`: federated identities, login/authentication sessions, access revisions, projection grants, Audit Records and Seat Assignment history fields | Expand; tested after 001-004 on disposable Pg18.6 | Demo headers stay slice-only; forward-fix before production, with no destructive contraction |
| `006_command_kernel` | PS-120 | `apps/server/migrations/006_command_kernel.sql`: receipt correlation/message fields, Domain Event correlation/aggregate/time fields and one-outcome-per-Command index | Additive expand; tested after 001-005 on Pg18.6 | Preserve all receipts/events; forward-fix after use, never drop populated evidence columns |
| `007_release_packages` | PS-130 | `apps/server/migrations/007_release_packages.sql`: append-only publication approvals and Package manifests plus one-content-per-project uniqueness | Additive expand; tested after 001-006 on Pg18.6; index creation scans existing Definition Revisions | Existing embedded slice Releases remain readable; forward-fix after use and retain immutable rows/objects |
| `008_projection_cursors` | PS-140 | Snapshots, grants, cursors | Expand | Cursors disposable; outbox preserved |
| `009_runtime_capabilities` | PS-200 | Generic Stage/Artifact/Inject/state tables | Expand/backfill/switch | Map slice IDs; retain adapter until parity |
| `010_information_messages_injects` | PS-210 | Policy/message/inject records | Expand | Default deny on missing policy |
| `011_extension_registry` | PS-220 | Publishers/artifacts/installations/bindings | Expand | Immutable digests survive revocation |
| `012_extension_runs_approvals` | PS-230 | Runs/proposals/approvals/receipts | Expand | Append-only provenance |
| `013_voting_core` | PS-240 | Poll/Electorate/Ballot/Tally/Certification | Expand | No production secret ballots before OPEN-028 |
| `014_comms_voice_core` | PS-250 | Voice/grants/Floor/provider observations | Expand | No audio bytes in DB |
| `015_collaboration_runtime` | PS-300 | CRDT update producers/snapshots | Expand, backfill Draft snapshot, switch | Old optimistic Draft remains readable during transition |
| `016_voice_consent_assets` | PS-320 | Consent and recording references | Expand | Append-only consent; assets separate |
| `017_session_access` | PS-340 | Invitations, guests, displays, Seats/readiness | Expand | Preserve participant attribution |
| `018_world_state_automation` | PS-400 | State/capability/resource/automation records | Expand | Backfill only from explicit sources |
| `019_adjudication_records` | PS-410 | Requests/reviews/records/effects | Expand | Keep failed/proposed/human origins distinct |
| `020_live_release_activation` | PS-420 | Compatibility and migration choices | Expand | Existing instances pinned; forward fix only |
| `021_offline_devices` | PS-500 | Device/outbox policy metadata | Expand | Local client migration must be reversible or export drafts |
| `022_evidence_checkpoints` | PS-510 | Signer/anchor operational metadata | Expand | Never rewrite existing checkpoint rows |
| `023_reporting_research` | PS-520 | Metrics, notes, findings, retention/export jobs | Expand | Raw observations remain immutable |

Every migration prompt must state lock/load risk, representative-data rehearsal, old/new application compatibility, and forward-fix/restore behavior. Destructive contraction requires a separate approval gate.
