# Deployment profiles

Profile behavior follows DEC-19 and the Proposed ADR-013. All profiles use the same application image digests; configuration and locally provided dependencies differ.

| Capability | Cloud | Institutional self-hosted | Air-gapped | Verification task |
|---|---|---|---|---|
| App server/worker | Managed container service | Compose/Podman; optional existing Kubernetes | Offline Compose/Podman bundle | PS-530 |
| PostgreSQL 18 | Managed | Packaged | Packaged | PS-001, PS-530 |
| S3 API | Provider object store | Evaluated Garage/SeaweedFS/Ceph RGW | Bundled local choice | PS-130, PS-530 |
| Identity | Customer IdP or Keycloak over OIDC | Bundled Keycloak, optional federation | Bundled local Keycloak/accounts | PS-110, PS-530 |
| Runtime realtime | HTTPS/SSE; polling fallback | Same over LAN | Same over isolated LAN | PS-140, PS-530 |
| Studio collaboration | Authenticated WebSocket | Same | Same on LAN | PS-300, PS-530 |
| Plugins | Approved; external connectors allowed by policy | Approved local/external | Local signed bundles only; external-required blocked | PS-220, PS-230, PS-530 |
| Media | Candidate digest-pinned local LiveKit SFU/TURN behind `@plenum/media-adapter` | Institution-owned SFU/TURN with local TLS/DNS | Same offline bundle; `use_external_ip: false`, local TURN, zero public egress | PS-250, PS-530 |
| Trust/signing | Platform/customer trust | Institution-approved roots | Pre-provisioned offline roots | OPEN-020, OPEN-029 |
| Backup/restore | Managed storage plus app procedure | Institution procedure | Fully local media and restore path | PS-510, PS-530 |
| Updates | Controlled release | Institution scheduled | Signed offline bundle | PS-530 |

## Air-gap closure checklist

- No external login, CDN, telemetry, package registry, object store, validation, anchor lookup, media, TURN, transcription, or Plugin call is mandatory at run time.
- Bundle includes image digests, dependencies, schemas, trust material references, Release/Plugin/Adapter closure, checksums, migration compatibility, and runbooks.
- Network-deny tests cover application, voting, voice, Plugins, identity, backup, restore, and verification.
- `external_required` Plugins and external transcription engines fail validation without a verified local replacement.
- Air-gapped accreditation remains institution-specific and is never claimed by this promptbook.

The PS-250 candidate profile and operational checks are in `deploy/media/livekit.yaml` and `docs/media-runbook.md`. ADR-017 remains Proposed; a future provider evaluation may replace LiveKit without changing Plenum's credential or Floor contracts.
