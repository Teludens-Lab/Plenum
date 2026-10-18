import { createHash } from "node:crypto";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

export interface ObjectStore {
  putImmutable(key: string, bytes: Uint8Array, sha256: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  deleteIfDigest(key: string, sha256: string): Promise<boolean>;
}

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function statusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("$metadata" in error)) return undefined;
  const metadata = error.$metadata;
  return typeof metadata === "object" && metadata !== null && "httpStatusCode" in metadata &&
    typeof metadata.httpStatusCode === "number" ? metadata.httpStatusCode : undefined;
}

function validateKey(key: string): void {
  if (key.length === 0 || key.includes("\\") || key.split("/").includes("..")) throw new Error("Invalid object key");
}

export class S3ObjectStore implements ObjectStore {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly keyPrefix = ""
  ) {
    if (bucket.length === 0) throw new Error("S3 bucket is required");
    if (keyPrefix.length > 0) validateKey(keyPrefix.replace(/\/$/u, ""));
  }

  private objectKey(key: string): string {
    validateKey(key);
    return this.keyPrefix.length === 0 ? key : `${this.keyPrefix.replace(/\/$/u, "")}/${key}`;
  }

  private async read(key: string): Promise<{ bytes: Uint8Array; etag?: string }> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }));
    if (result.Body === undefined) throw new Error("S3 object body is missing");
    const bytes = await result.Body.transformToByteArray();
    if (result.Metadata?.sha256 !== undefined && result.Metadata.sha256 !== digest(bytes)) {
      throw new Error("S3 object digest metadata mismatch");
    }
    return result.ETag === undefined ? { bytes } : { bytes, etag: result.ETag };
  }

  async putImmutable(key: string, bytes: Uint8Array, sha256: string): Promise<void> {
    if (digest(bytes) !== sha256) throw new Error("Object digest mismatch");
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(key),
        Body: bytes,
        ContentType: "application/octet-stream",
        Metadata: { sha256 },
        IfNoneMatch: "*"
      }));
    } catch (error) {
      if (statusCode(error) !== 409 && statusCode(error) !== 412) throw error;
      if (digest((await this.read(key)).bytes) !== sha256) throw new Error("Immutable object key collision");
    }
  }

  async get(key: string): Promise<Uint8Array> {
    return (await this.read(key)).bytes;
  }

  async deleteIfDigest(key: string, sha256: string): Promise<boolean> {
    let existing: { bytes: Uint8Array; etag?: string };
    try {
      existing = await this.read(key);
    } catch (error) {
      if (statusCode(error) === 404) return false;
      throw error;
    }
    if (digest(existing.bytes) !== sha256 || existing.etag === undefined) return false;
    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(key),
        IfMatch: existing.etag
      }));
      return true;
    } catch (error) {
      if (statusCode(error) === 404 || statusCode(error) === 412) return false;
      throw error;
    }
  }
}

export class LocalObjectStore implements ObjectStore {
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private resolveKey(key: string): string {
    validateKey(key);
    const target = path.resolve(this.root, ...key.split("/"));
    if (!target.startsWith(`${this.root}${path.sep}`)) throw new Error("Invalid object key");
    return target;
  }

  async putImmutable(key: string, bytes: Uint8Array, sha256: string): Promise<void> {
    if (digest(bytes) !== sha256) throw new Error("Object digest mismatch");
    const target = this.resolveKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    try {
      const handle = await open(target, "wx");
      try {
        await handle.writeFile(bytes);
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
      if (digest(await readFile(target)) !== sha256) throw new Error("Immutable object key collision");
    }
  }

  async get(key: string): Promise<Uint8Array> {
    return readFile(this.resolveKey(key));
  }

  async deleteIfDigest(key: string, sha256: string): Promise<boolean> {
    const target = this.resolveKey(key);
    let bytes: Uint8Array;
    try {
      bytes = await readFile(target);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
      throw error;
    }
    if (digest(bytes) !== sha256) return false;
    await rm(target);
    return true;
  }
}
