# Reference implementations

This directory contains immutable source snapshots used for behavior discovery, extraction, and parity testing. Reference code is evidence, not the architecture or dependency baseline for the new Plenum implementation.

## Fractured Order

`fractured-order/` is the immutable tracked-file export of the official golden reference recorded in `fractured-order.snapshot.json`.

Rules:

- Do not edit the snapshot in place.
- Do not copy its Supabase architecture into the new platform merely because it exists in the reference.
- Record intentional parity differences before implementation.
- Replace the snapshot only through a new pinned commit and an updated manifest.
- Never add local environments, credentials, dependency directories, build output, coverage, or repository metadata.

The Product Owner confirmed commit `ae5d5065bc04a53631815b1b1715a54e21e3ef5b` as the official Fractured Order golden reference on 2026-10-17, resolving OPEN-003. This approval pins source identity only; parity classification and AC-09 evidence remain separate work.

## Plenum runtime slice

`plenum-runtime-slice/` is the executable v0.2.0 Plenum spike formerly stored with the corpus. It is an observed implementation baseline, not the official Fractured Order golden reference and not production application code.

## Teludens design-system catalog

`teludens-design-system-catalog/` is supporting design reference material. It does not override the product corpus or independently establish application requirements.
