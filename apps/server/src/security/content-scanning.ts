/** Shared malware-scanning boundary for governed content and form attachments. */
export interface ContentScanResult { status: "clean" | "infected"; detail: string }
export interface ContentScanner { scan(bytes: Uint8Array, mediaType: string): Promise<ContentScanResult> }

export function detectedMediaType(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-") return "application/pdf";
  const text = Buffer.from(bytes).toString("utf8");
  if (!text.includes("\u0000") && Buffer.byteLength(text, "utf8") === bytes.byteLength) return "text";
  return undefined;
}

export async function scanContent(scanner: ContentScanner | undefined, bytes: Uint8Array, mediaType: string): Promise<{ status: "clean" | "infected" | "failed"; detail: string }> {
  if (!scanner) return { status: "failed", detail: "No approved malware scanner is configured; content remains unavailable." };
  try {
    const result = await scanner.scan(bytes, mediaType);
    return { status: result.status, detail: result.detail.slice(0, 1000) };
  } catch { return { status: "failed", detail: "The malware scan failed; content remains unavailable." }; }
}
