import {
  CHECKPOINT_CONTRACT_ID,
  VERIFICATION_EXPORT_CONTRACT_ID
} from "@plenum/event-contracts";
import { evidenceProofEvent, verifyEvidenceExport } from "../apps/server/dist/index.js";

const eventColumns = `id,sequence,event_type,event_version,command_id,actor_person_id,actor_participant_id,
  governing_release_id,authority_epoch,correlation_id,causation_id,aggregate_id,aggregate_version,occurred_at,recorded_at,body`;

export async function verifyRestoredEvidence(pool, trustedPublicKeys, independentAnchors) {
  const sessions = await pool.query(
    `SELECT session.id,sequence.next_sequence-1 AS last_sequence
       FROM runtime.sessions session
       JOIN evidence.session_sequences sequence ON sequence.organization_id=session.organization_id AND sequence.session_id=session.id
      WHERE sequence.next_sequence>1 ORDER BY session.id`
  );
  const results = [];
  for (const session of sessions.rows) {
    const checkpoints = await pool.query(
      `SELECT checkpoint.*,signature.signing_key_id,signature.signature_algorithm,signature.signature,
              signature.public_key_jwk,signature.signed_at
         FROM evidence.checkpoint_batches checkpoint
         JOIN evidence.checkpoint_signatures signature ON signature.organization_id=checkpoint.organization_id
          AND signature.checkpoint_id=checkpoint.id
        WHERE checkpoint.session_id=$1 ORDER BY checkpoint.first_sequence`,
      [session.id]
    );
    const bundles = [];
    for (const row of checkpoints.rows) {
      const events = await pool.query(
        `SELECT ${eventColumns} FROM evidence.events WHERE session_id=$1 AND sequence BETWEEN $2 AND $3 ORDER BY sequence`,
        [session.id, row.first_sequence, row.last_sequence]
      );
      const receipts = await pool.query(
        `SELECT anchor_endpoint,anchor_reference,anchored_digest,signing_key_id,verification_result,recorded_at
           FROM evidence.anchor_receipts WHERE checkpoint_id=$1 ORDER BY recorded_at`,
        [row.id]
      );
      bundles.push({
        checkpoint: {
          contractId: CHECKPOINT_CONTRACT_ID,
          checkpointId: row.id,
          sessionId: session.id,
          firstSequence: Number(row.first_sequence),
          lastSequence: Number(row.last_sequence),
          previousCheckpointDigest: row.previous_checkpoint_digest,
          batchMerkleRoot: row.batch_merkle_root,
          canonicalization: row.canonicalization,
          algorithm: row.algorithm,
          checkpointDigest: row.checkpoint_digest,
          createdAt: row.created_at.toISOString()
        },
        events: events.rows.map(evidenceProofEvent),
        signature: {
          keyId: row.signing_key_id,
          algorithm: row.signature_algorithm,
          signature: row.signature.toString("base64"),
          publicKeyJwk: row.public_key_jwk,
          signedAt: row.signed_at.toISOString()
        },
        anchorReceipts: receipts.rows.map((receipt) => ({
          endpoint: receipt.anchor_endpoint,
          reference: receipt.anchor_reference,
          anchoredDigest: receipt.anchored_digest,
          keyId: receipt.signing_key_id,
          verificationResult: receipt.verification_result,
          recordedAt: receipt.recorded_at.toISOString()
        }))
      });
    }
    const verification = verifyEvidenceExport({
      contractId: VERIFICATION_EXPORT_CONTRACT_ID,
      sessionId: session.id,
      generatedAt: new Date().toISOString(),
      lastEvidenceSequence: Number(session.last_sequence),
      checkpoints: bundles
    }, trustedPublicKeys, independentAnchors);
    results.push({ sessionId: session.id, ...verification });
  }
  return results;
}
