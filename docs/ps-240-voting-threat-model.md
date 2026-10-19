# PS-240 voting privacy and threat model

Status: implementation evidence for identified, non-secret voting. Production secret ballots remain blocked by OPEN-028 and require separate Security Owner approval.

| Threat | Control | Evidence |
|---|---|---|
| Client claims eligibility or another Seat Assignment | The server resolves the frozen Electorate from active Seat Assignments and Information Policy, then issues a Poll/Seat-scoped random capability. Casting binds that capability to the trusted Participant and active Session Role. | VOTE-01, VOTE-02 |
| Duplicate or concurrent voting | The Session Authority lock, current-receipt uniqueness, Command digest and durable receipt make retry idempotent and allow only one current Ballot per Seat Assignment when revote is disabled. | VOTE-03, VOTE-04 |
| Device timestamp extends the voting window | Poll state and deadline are checked against server receipt time while the Poll row is locked. Device time remains observational. | VOTE-05 |
| Poll rules change after voting starts | Definition, options and Electorate rows freeze at open; the application role cannot update options. Changes require void and reissue. | VOTE-06 |
| Tally manipulation or non-reproducibility | The built-in method canonicalizes the current Ballot set, records its SHA-256 digest and method version, and binds the result digest into Certification. | VOTE-07 |
| Early or unauthorized result disclosure | Participant projections omit the Tally until Certification and the frozen result-visibility policy allows it. Restricted audit requires certification permission. | VOTE-08, VOTE-09 |
| Choice leakage through general evidence or audit | Choice rows are held in `voting.ballots`; identity is in `voting.ballot_receipts`. `ballot.accepted` includes receipt metadata only, while audit exposes digests and the Certification chain, not choices or identities. | VOTE-01, VOTE-08, VOTE-09 |
| Competing Certifications | Poll row locking, expected versions and the unique current-Certification index permit at most one current record. Corrections append a linked record and preserve the original. | VOTE-10 |
| Secret-ballot controls are incomplete | `poll.open` rejects `secret_ballot` and `anonymous_survey` with `CAPABILITY_UNAVAILABLE`; no production secret choice is accepted before OPEN-028 resolves. | VOTE-09 |

Residual risks: the identified open-vote slice is not coercion resistant or end-to-end verifiable; PostgreSQL administrators can correlate the separated tables; voting load and metadata suppression are not verified. These are not represented as completed controls.
