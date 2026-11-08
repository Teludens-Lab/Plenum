import { useRef, useState, type ReactNode } from "react";
import { RuntimeIcon, type RuntimeIconName } from "./RuntimeFrame.js";

/** Keep live media and unfinished messages mounted when the tool is closed. */
export function SessionTool({ label, icon, count = 0, children, text = false }: {
  label: string; icon: RuntimeIconName; count?: number; children: ReactNode; text?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return <>
    <button ref={trigger} className={text ? "btn-primary" : "runtime-header-icon"} type="button" aria-label={label} title={label}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => { dialog.current?.showModal(); setOpen(true); }}>
      <RuntimeIcon name={icon} />
      {text ? label : null}
      {count > 0 ? <span className="runtime-notification-count" aria-hidden="true">{count > 99 ? "99+" : count}</span> : null}
      {count > 0 ? <span className="visually-hidden">{count} unread</span> : null}
    </button>
    <dialog ref={dialog} className="runtime-tool-dialog" aria-label={label}
      onClose={() => { setOpen(false); trigger.current?.focus(); }}>
      <div className="runtime-tool-heading"><h2>{label}</h2>
        <button className="btn-secondary" type="button" autoFocus onClick={() => dialog.current?.close()}>Close {label}</button></div>
      <div className="runtime-tool-body">{children}</div>
    </dialog>
  </>;
}
