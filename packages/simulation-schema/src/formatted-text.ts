export const FORMATTED_TEXT_CONTRACT_ID = "formatted-text-v1";
export type FormattedInlineV1 = { kind: "text" | "strong" | "emphasis"; text: string } | { kind: "link"; text: string; href: string };
export type FormattedBlockV1 = { kind: "paragraph"; content: FormattedInlineV1[] } | { kind: "bullet_list" | "numbered_list"; items: FormattedInlineV1[][] };
export const formattedTextV1Schema = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: FORMATTED_TEXT_CONTRACT_ID,
  title: "Safe Formatted Text v1", type: "string", maxLength: 262144,
  description: "Paragraphs, flat bullet/numbered lists, **strong**, *emphasis*, and [label](https://example.org) links. No HTML, images, code or embedded content. At most 200 blocks and 2000 inline segments." } as const;

/** Returns text nodes and allowlisted links, never HTML. Renderers must use escaped text/DOM elements. */
export function parseFormattedText(value: unknown): FormattedBlockV1[] {
  if (typeof value !== "string" || value.length > 262144) throw new Error("Formatted text must be bounded text");
  if (/<\/?[A-Za-z!]/u.test(value) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value) || /!\[|```/u.test(value)) throw new Error("Formatted text does not allow HTML, images, scripts or embedded content");
  let segments = 0;
  const inline = (text: string): FormattedInlineV1[] => {
    const result: FormattedInlineV1[] = [];
    const tokens = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\[([^\[\]\n]+)\]\(([^\s()\[\]]+)\)/gu;
    let offset = 0;
    for (const match of text.matchAll(tokens)) {
      if (match.index > offset) result.push({ kind: "text", text: text.slice(offset, match.index) });
      if (match[1] !== undefined) result.push({ kind: "strong", text: match[1] });
      else if (match[2] !== undefined) result.push({ kind: "emphasis", text: match[2] });
      else {
        let url: URL;
        try { url = new URL(match[4]!); } catch { throw new Error("Formatted links need a complete HTTP or HTTPS URL"); }
        if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Formatted links allow only HTTP or HTTPS without credentials");
        result.push({ kind: "link", text: match[3]!, href: url.href });
      }
      offset = match.index + match[0].length;
    }
    if (offset < text.length) result.push({ kind: "text", text: text.slice(offset) });
    segments += result.length;
    if (segments > 2000) throw new Error("Formatted text exceeds 2000 inline segments");
    return result;
  };
  const blocks: FormattedBlockV1[] = [];
  let listItems = 0;
  for (const paragraph of value.replaceAll("\r\n", "\n").split(/\n\s*\n/u).filter((item) => item.trim())) {
    const lines = paragraph.split("\n");
    if (lines.every((line) => /^(?:- |\d+\. )/u.test(line))) {
      listItems += lines.length;
      if (listItems > 2000) throw new Error("Formatted text exceeds 2000 list items");
    }
    if (lines.every((line) => /^- /u.test(line))) blocks.push({ kind: "bullet_list", items: lines.map((line) => inline(line.slice(2))) });
    else if (lines.every((line) => /^\d+\. /u.test(line))) blocks.push({ kind: "numbered_list", items: lines.map((line) => inline(line.replace(/^\d+\. /u, ""))) });
    else blocks.push({ kind: "paragraph", content: inline(paragraph) });
    if (blocks.length > 200) throw new Error("Formatted text exceeds 200 blocks");
  }
  return blocks;
}
