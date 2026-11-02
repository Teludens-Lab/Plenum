import { createHash } from "node:crypto";

import { canonicalizeJson, type JsonObject, type JsonValue } from "@plenum/event-contracts";

const encoder = new TextEncoder();

export const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

export const encodeJson = (value: JsonObject): Uint8Array => encoder.encode(canonicalizeJson(value));

export const encodeValue = (value: string | JsonValue): Uint8Array =>
  encoder.encode(typeof value === "string" ? value : canonicalizeJson(value));

export const csvCell = (value: unknown): string =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export const escapeHtml = (value: unknown): string => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createStoredZip(files: Array<{ path: string; bytes: Uint8Array }>): Uint8Array {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.path, "utf8");
    const body = Buffer.from(file.bytes);
    const checksum = crc32(body);
    const header = Buffer.alloc(30 + name.length);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
    header.writeUInt32LE(checksum, 14); header.writeUInt32LE(body.length, 18); header.writeUInt32LE(body.length, 22);
    header.writeUInt16LE(name.length, 26); name.copy(header, 30);
    local.push(header, body);
    const directory = Buffer.alloc(46 + name.length);
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt32LE(checksum, 16); directory.writeUInt32LE(body.length, 20); directory.writeUInt32LE(body.length, 24);
    directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(offset, 42); name.copy(directory, 46);
    central.push(directory); offset += header.length + body.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBytes, end]);
}

const pdfEscape = (value: string): string => value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");

export function createTextPdf(lines: string[]): Uint8Array {
  const wrapped = lines.flatMap((line) => {
    if (line.length === 0) return [""];
    const parts: string[] = [];
    for (let offset = 0; offset < line.length; offset += 96) parts.push(line.slice(offset, offset + 96));
    return parts;
  });
  const chunks: string[][] = [];
  for (let offset = 0; offset < Math.max(wrapped.length, 1); offset += 44) chunks.push(wrapped.slice(offset, offset + 44));
  const pageIds = chunks.map((_, index) => 4 + index * 2);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${chunks.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  chunks.forEach((chunk, index) => {
    const pageId = pageIds[index]!;
    const contentId = pageId + 1;
    const heading = index === 0 ? "Plenum governed report" : "Plenum governed report (continued)";
    const stream = [
      `BT /F1 13 Tf 40 760 Td (${pdfEscape(heading)}) Tj ET`,
      `BT /F1 9 Tf 40 738 Td ${chunk.map((line, lineIndex) =>
        `${lineIndex === 0 ? "" : "0 -15 Td "}(${pdfEscape(line)}) Tj`).join(" ")} ET`,
      `BT /F1 8 Tf 500 24 Td (Page ${index + 1} of ${chunks.length}) Tj ET`
    ].join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
    );
  });
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  output += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encoder.encode(output);
}
