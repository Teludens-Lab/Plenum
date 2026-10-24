# Offline bundle

Build the application image and ensure every digest-pinned dependency image in `deploy/offline-bundle/deployment-manifest.json` exists locally. Provide an institution-controlled Ed25519 private key outside the repository:

```text
PLENUM_APPLICATION_IMAGE=plenum-platform:0.1.0
PLENUM_OFFLINE_BUNDLE_DIRECTORY=<new-directory>
PLENUM_OFFLINE_SIGNING_KEY_FILE=<ed25519-private-key.pem>
npm run bundle:offline
```

The new directory contains the OCI image archive, all profile files, operations runbooks, a resolved deployment manifest, `SHA256SUMS`, its detached Ed25519 signature, and the public verification key. Transfer the public key through a separately approved trust channel. The bundle deliberately contains references to operational trust material, not private signing, TLS, media, database, or backup keys.

At the destination, verify the detached signature, then every checksum, before `docker load --input images.tar`. Compare the loaded application image ID with `applicationImageId`; Compose configuration must use that same image in every profile. Reject altered, incomplete, unsigned, or unexpectedly network-dependent bundles.

