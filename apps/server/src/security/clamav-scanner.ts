import { Socket } from "node:net";

import type { ContentScanResult, ContentScanner } from "../studio/content-library.js";

const MAX_SCAN_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;

export interface ClamAvScannerOptions {
  host: string;
  port?: number;
  timeoutMs?: number;
}

/** Fail-closed ClamAV INSTREAM adapter. No file content or identifying metadata is logged. */
export class ClamAvContentScanner implements ContentScanner {
  readonly #host: string;
  readonly #port: number;
  readonly #timeoutMs: number;

  constructor(options: ClamAvScannerOptions) {
    if (options.host.trim().length === 0) throw new Error("ClamAV host is required");
    this.#host = options.host;
    this.#port = options.port ?? 3310;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isSafeInteger(this.#port) || this.#port < 1 || this.#port > 65_535) throw new Error("ClamAV port is invalid");
    if (!Number.isSafeInteger(this.#timeoutMs) || this.#timeoutMs < 100 || this.#timeoutMs > 60_000) throw new Error("ClamAV timeout is invalid");
  }

  async scan(bytes: Uint8Array, _mediaType: string): Promise<ContentScanResult> {
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_SCAN_BYTES) throw new Error("Scan payload is outside its approved size bound");
    return new Promise<ContentScanResult>((resolve, reject) => {
      const socket = new Socket();
      const response: Buffer[] = [];
      let settled = false;
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(new Error(message));
      };
      socket.setTimeout(this.#timeoutMs, () => fail("Malware scanner timed out"));
      socket.on("error", () => fail("Malware scanner connection failed"));
      socket.on("data", (chunk: Buffer) => response.push(chunk));
      socket.on("end", () => {
        if (settled) return;
        const result = Buffer.concat(response).toString("utf8").trim();
        settled = true;
        if (/^stream: OK$/u.test(result)) resolve({ status: "clean", detail: "Approved malware scanner reported clean." });
        else if (/^stream: .+ FOUND$/u.test(result)) resolve({ status: "infected", detail: "Approved malware scanner detected unsafe content." });
        else reject(new Error("Malware scanner returned an invalid response"));
      });
      socket.connect(this.#port, this.#host, () => {
        socket.write("zINSTREAM\0");
        const length = Buffer.allocUnsafe(4);
        length.writeUInt32BE(bytes.byteLength, 0);
        socket.write(length);
        socket.write(bytes);
        socket.end(Buffer.alloc(4));
      });
    });
  }

  async health(): Promise<"available" | "unavailable"> {
    return new Promise<"available" | "unavailable">((resolve) => {
      const socket = new Socket();
      const response: Buffer[] = [];
      let settled = false;
      const finish = (status: "available" | "unavailable") => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(status);
      };
      socket.setTimeout(this.#timeoutMs, () => finish("unavailable"));
      socket.on("error", () => finish("unavailable"));
      socket.on("data", (chunk: Buffer) => response.push(chunk));
      socket.on("end", () => finish(Buffer.concat(response).toString("utf8").trim() === "PONG" ? "available" : "unavailable"));
      socket.connect(this.#port, this.#host, () => socket.end("zPING\0"));
    });
  }
}
