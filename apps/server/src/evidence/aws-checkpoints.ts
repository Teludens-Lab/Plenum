import { createPublicKey } from "node:crypto";
import { KMSClient, SignCommand } from "@aws-sdk/client-kms";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { canonicalizeJson, type JsonObject } from "@plenum/event-contracts";
import type { EvidenceCheckpointAdapters } from "./checkpoint-worker.js";

/** Uses existing keys and custodian storage only. Public-key and account custody require external approval. */
export function createAwsEvidenceAdapters(options: {
  keyArn: string; trustedPublicKey: JsonObject; bucket: string; bucketOwner: string; prefix: string;
  kms: KMSClient; s3: S3Client;
}): EvidenceCheckpointAdapters {
  if (!/^arn:aws(?:-us-gov|-cn)?:kms:[a-z0-9-]+:[0-9]{12}:key\/[a-zA-Z0-9-]+$/u.test(options.keyArn) ||
      !/^[0-9]{12}$/u.test(options.bucketOwner) || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(options.bucket) ||
      !/^[a-zA-Z0-9/_-]{1,128}$/u.test(options.prefix) || options.prefix.includes("..") ||
      options.trustedPublicKey.kty !== "OKP" || options.trustedPublicKey.crv !== "Ed25519" ||
      Object.hasOwn(options.trustedPublicKey, "d") || Object.hasOwn(options.trustedPublicKey, "k")) {
    throw new Error("Invalid approved Evidence key or custodian configuration");
  }
  createPublicKey({ key: options.trustedPublicKey, format: "jwk" });
  return {
    signer: { async signCheckpoint(input, signal) {
      const result = await options.kms.send(new SignCommand({ KeyId: options.keyArn,
        Message: input.digestBytes, MessageType: "RAW", SigningAlgorithm: "ED25519_SHA_512" }), signal ? { abortSignal: signal } : {});
      if (result.KeyId !== options.keyArn || result.SigningAlgorithm !== "ED25519_SHA_512" || !result.Signature) {
        throw new Error("Unexpected Evidence signing key or algorithm");
      }
      return { keyId: options.keyArn, algorithm: "Ed25519", signature: result.Signature, publicKeyJwk: options.trustedPublicKey };
    } },
    anchor: { async anchorCheckpoint(input, signal) {
      const key = `${options.prefix.replace(/\/$/u, "")}/${input.sessionId}/${input.firstSequence}.json`;
      const body = canonicalizeJson({ checkpointId: input.checkpointId, sessionId: input.sessionId,
        firstSequence: input.firstSequence, lastSequence: input.lastSequence, checkpointDigest: input.checkpointDigest,
        checkpointCreatedAt: input.checkpointCreatedAt, keyId: input.keyId });
      const retainUntil = new Date(); retainUntil.setUTCFullYear(retainUntil.getUTCFullYear() + 7);
      const minimumRetention = new Date(input.checkpointCreatedAt);
      minimumRetention.setUTCFullYear(minimumRetention.getUTCFullYear() + 7);
      try {
        await options.s3.send(new PutObjectCommand({ Bucket: options.bucket, Key: key, ExpectedBucketOwner: options.bucketOwner,
          Body: body, ContentType: "application/json", IfNoneMatch: "*", ObjectLockMode: "COMPLIANCE",
          ObjectLockRetainUntilDate: retainUntil }), signal ? { abortSignal: signal } : {});
      } catch (error) {
        // A timeout after success is reconciled on retry by reading the immutable existing version.
        if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 412) throw error;
      }
      const stored = await options.s3.send(new GetObjectCommand({ Bucket: options.bucket, Key: key,
        ExpectedBucketOwner: options.bucketOwner }), signal ? { abortSignal: signal } : {});
      try {
        if (!stored.Body || !stored.VersionId || stored.VersionId === "null" ||
            stored.ObjectLockMode !== "COMPLIANCE" || !stored.ObjectLockRetainUntilDate ||
            stored.ObjectLockRetainUntilDate.getTime() < minimumRetention.getTime() ||
            stored.ContentLength === undefined || stored.ContentLength > 4096) throw new Error("Unprotected Evidence anchor");
        const bytes = await stored.Body.transformToByteArray();
        if (bytes.length > 4096 || Buffer.from(bytes).toString("utf8") !== body) throw new Error("Conflicting Evidence anchor");
        return { endpoint: `arn:${options.keyArn.split(":")[1]}:s3:::${options.bucket}`, reference: `${key}?versionId=${encodeURIComponent(stored.VersionId)}`,
          anchoredDigest: input.checkpointDigest, verificationResult: "verified", recordedAt: stored.LastModified ?? new Date() };
      } finally { if (stored.Body && "destroy" in stored.Body) stored.Body.destroy(); }
    } }
  };
}
