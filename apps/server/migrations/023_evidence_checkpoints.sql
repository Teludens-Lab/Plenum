-- Plenum 023: signed Evidence checkpoints and independently anchored receipts.
-- Sources: REQ-006, REQ-053, REQ-066, INV-015; OPEN-014 and OPEN-017.

ALTER TABLE evidence.checkpoint_signatures
  ADD COLUMN public_key_jwk jsonb NOT NULL,
  ADD CONSTRAINT checkpoint_signatures_algorithm_check CHECK (signature_algorithm = 'Ed25519'),
  ADD CONSTRAINT checkpoint_signatures_ed25519_size_check CHECK (octet_length(signature) = 64),
  ADD CONSTRAINT checkpoint_signatures_public_key_check CHECK (
    public_key_jwk->>'kty' = 'OKP'
    AND public_key_jwk->>'crv' = 'Ed25519'
    AND length(public_key_jwk->>'x') > 0
    AND NOT (public_key_jwk ? 'd')
    AND NOT (public_key_jwk ? 'k')
  ),
  ADD CONSTRAINT checkpoint_signatures_one_per_checkpoint UNIQUE (checkpoint_id);

ALTER TABLE evidence.anchor_receipts
  ADD COLUMN signing_key_id text NOT NULL,
  ADD CONSTRAINT anchor_receipts_one_endpoint UNIQUE (checkpoint_id, anchor_endpoint);

CREATE INDEX checkpoint_batches_session_last
  ON evidence.checkpoint_batches (session_id, last_sequence DESC);
