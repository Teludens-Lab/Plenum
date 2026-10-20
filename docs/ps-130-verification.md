# PS-130 verification

Date: 2026-10-18. Status: implementation evidence, not release approval.

## Environment

- Node.js 24.22.0 container pinned as `node@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f`; npm 11.19.1; TypeScript 5.9.3.
- PostgreSQL 18.6 Alpine pinned as `postgres@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873` with synthetic disposable databases.
- SeaweedFS 4.48 pinned as `chrislusf/seaweedfs@sha256:4e61d15fd35994cb1e43e1e553dff106794841fd9a99ade2fc8c8bfce4d7872d` with one synthetic disposable bucket; AWS SDK for JavaScript S3 client 3.1152.0.
- Root `npm ci --ignore-scripts`: PASS; 51 packages installed; 58 packages audited with zero vulnerabilities.

## Evidence

| Gate | Result | Demonstrated behavior |
|---|---|---|
| `npm run typecheck` | PASS, exit 0 | Strict types across six workspaces and the Release registry boundary |
| `npm run build` | PASS, exit 0 | All six workspaces compiled from the root lockfile |
| `npm test` | PASS 7/7, exit 0 | Deterministic canonical bytes; Release identity round-trip; tamper, secret, Participant-data, Plugin and Platform Adapter rejection; PS-100/110 regressions |
| `npm run test:integration` | PASS 7/7, exit 0 | Real Pg18 RLS and Command regressions plus publication authorization, safe object cleanup, concurrent conflict, byte-identical rereads, idempotent import, append-only enforcement and a real S3-compatible boundary |
| `npm run test:db` | PASS 6/6, exit 0 | Independent fresh-database run of the same Pg18 boundary suite |
| `npm run test:s3` | PASS 1/1, exit 0 | Real SeaweedFS immutable conditional put, byte-exact get, collision handling, conditional cleanup and concurrent first-writer behavior |
| `npm run lint` | PASS, exit 0 | 15 application/package sources, five versioned contracts, canonical naming and acyclic workspaces |
| `node scripts/validate-promptbook.mjs` | PASS, exit 0 | 31 tasks, REQ 94/94, INV 28/28 and no dependency cycles |

Required evidence IDs `AC-02`, `AC-06`, `PS-130-T01`, and `PS-130-T02` are present in the passing test output. The package compiler owns `package-import-v1`; Simulation Schema owns `release-manifest-v1`. Package schema `1.0.0`, Simulation Schema `1.3.1`, compiler `0.1.0`, Plugin digests, and Platform Adapter digests are pinned in compiled bytes.

## Data, deployment, and recovery

Migration `007_release_packages.sql` is additive. It adds append-only approval and Package-manifest records and a unique content index over existing Definition Revisions. Index creation scans the table and can fail if historical duplicate content exists; rehearse that check before a populated deployment. After use, preserve the immutable registry rows and objects and forward-fix rather than dropping them.

The object-store boundary now has a real AWS SDK S3 adapter plus the local filesystem development adapter. The S3 adapter uses conditional create, digest metadata verification and ETag-conditional delete; the live SeaweedFS test proves the required API behavior without adding a multi-cloud layer. Object bytes are written before the registry commit; a failed known transaction deletes only an unreferenced object with the expected digest, while an ambiguous cleanup failure intentionally leaves an orphan rather than risking deletion of a committed Release.

ADR-011's S3-compatible direction was Approved by Product Owner direction on 2026-10-20. SeaweedFS 4.48 is the verified interoperability target, not a final production deployment-profile selection; PS-530 still owns production configuration and operational validation.

## Open governance and QA limits

- OPEN-020 blocks Package signing for production; no signing policy was selected and signature fields remain empty.
- OPEN-012 leaves long-term compatibility policy unresolved, so import currently requires exact package schema, Simulation Schema, and compiler versions.
- OPEN-013 remains unresolved. ADR-011 and ADR-014 are Approved as of 2026-10-20; their named specialist sign-offs remain.
- The adapter was tested against a disposable, unauthenticated SeaweedFS service. Production IAM, TLS, encryption, lifecycle/versioning, backup/restore, HTTP handling, browser flow, load, Node 26, deployment and release approval were not tested; those are outside PS-130 or owned by later tasks.
