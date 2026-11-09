import { useRef, useState, type TextareaHTMLAttributes } from "react";
import { parseFormattedText, type FormattedInlineV1 } from "@plenum/simulation-schema";

const inline = (items: FormattedInlineV1[]) => items.map((item, index) => item.kind === "strong" ? <strong key={index}>{item.text}</strong>
  : item.kind === "emphasis" ? <em key={index}>{item.text}</em> : item.kind === "link" ? <a key={index} href={item.href} rel="noreferrer noopener">{item.text}</a> : <span key={index}>{item.text}</span>);

export function FormattedText({ value }: { value: unknown }) {
  try {
    return <>{parseFormattedText(value).map((block, index) => block.kind === "paragraph" ? <p key={index}>{inline(block.content)}</p>
      : block.kind === "bullet_list" ? <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ul>
      : <ol key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ol>)}</>;
  } catch (error) { return <p className="field-error" role="alert">{error instanceof Error ? error.message : "Formatted content is unavailable."}</p>; }
}

export function FormattedTextInput({ value, change, id, ...props }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  id: string; value: string; change(value: string): void;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState(""); const [linkUrl, setLinkUrl] = useState("");
  const insert = (before: string, after = "", replacement?: string) => {
    const start = area.current?.selectionStart ?? value.length, end = area.current?.selectionEnd ?? value.length;
    change(value.slice(0, start) + before + (replacement ?? value.slice(start, end)) + after + value.slice(end));
    area.current?.focus();
  };
  return <>
    <div role="group" aria-label="Text formatting" className="form-actions">
      <button className="btn-secondary" type="button" disabled={props.disabled} onClick={() => insert("**", "**", area.current?.selectionStart === area.current?.selectionEnd ? "bold text" : undefined)}>Bold</button>
      <button className="btn-secondary" type="button" disabled={props.disabled} onClick={() => insert("*", "*", area.current?.selectionStart === area.current?.selectionEnd ? "emphasis" : undefined)}>Emphasis</button>
      <button className="btn-secondary" type="button" disabled={props.disabled} onClick={() => insert("\n\n- ")}>Bullet list</button>
      <button className="btn-secondary" type="button" disabled={props.disabled} onClick={() => insert("\n\n1. ")}>Numbered list</button>
      <button className="btn-secondary" type="button" disabled={props.disabled} aria-expanded={linkOpen} onClick={() => setLinkOpen(!linkOpen)}>Add link</button>
    </div>
    {linkOpen ? <fieldset disabled={props.disabled}><legend>Link</legend>
      <label htmlFor={`${id}-link-text`}>Link text</label><input id={`${id}-link-text`} value={linkText} onChange={(event) => setLinkText(event.target.value)} />
      <label htmlFor={`${id}-link-url`}>Link address</label><input id={`${id}-link-url`} type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} />
      <button type="button" className="btn-secondary" disabled={!linkText || !/^https?:\/\//u.test(linkUrl)} onClick={() => { insert("", "", `[${linkText}](${linkUrl})`); setLinkOpen(false); }}>Insert link</button>
    </fieldset> : null}
    <textarea {...props} id={id} ref={area} rows={5} value={value} onChange={(event) => change(event.target.value)} />
    <details><summary>Formatted preview</summary><FormattedText value={value} /></details>
  </>;
}
