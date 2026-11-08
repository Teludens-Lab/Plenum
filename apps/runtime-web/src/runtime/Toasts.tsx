import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Supplemental Runtime outcome messages (see docs/design/forms-dialogs-messages.md).
 * Success, information and arrival toasts dismiss themselves; caution, error and
 * progress toasts persist until the person dismisses them or a newer outcome replaces them.
 */
export type ToastTone = "success" | "info" | "message" | "paused" | "caution" | "error" | "progress";

export interface ToastAction { label: string; onSelect(): void }

export interface Toast { id: number; tone: ToastTone; message: string; action?: ToastAction }

const AUTO_DISMISS_MS = 8000;
const MAX_VISIBLE = 4;
const PERSISTENT: ReadonlySet<ToastTone> = new Set<ToastTone>(["caution", "error", "progress"]);

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());
  const latest = useRef<Toast[]>([]);
  latest.current = toasts;

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const schedule = useCallback((id: number) => {
    timers.current.set(id, window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS));
  }, [dismiss]);

  const notify = useCallback((message: string, tone: ToastTone = "info", action?: ToastAction) => {
    if (message.trim() === "") return;
    const id = nextId.current++;
    setToasts((current) => {
      // A newer outcome supersedes in-flight progress and identical repeats.
      const kept = current.filter((toast) => toast.tone !== "progress" && toast.message !== message);
      for (const removed of current) if (!kept.includes(removed)) {
        const timer = timers.current.get(removed.id);
        if (timer !== undefined) window.clearTimeout(timer);
        timers.current.delete(removed.id);
      }
      return [...kept, { id, tone, message, ...(action === undefined ? {} : { action }) }].slice(-MAX_VISIBLE);
    });
    if (!PERSISTENT.has(tone)) schedule(id);
  }, [schedule]);

  /** Hover or focus inside a toast pauses its timer so it can be read or acted on. */
  const hold = useCallback((id: number, held: boolean) => {
    const timer = timers.current.get(id);
    if (held) {
      if (timer !== undefined) window.clearTimeout(timer);
      timers.current.delete(id);
      return;
    }
    const toast = latest.current.find((candidate) => candidate.id === id);
    if (toast !== undefined && !PERSISTENT.has(toast.tone) && !timers.current.has(id)) schedule(id);
  }, [schedule]);

  useEffect(() => () => { for (const timer of timers.current.values()) window.clearTimeout(timer); }, []);

  return { toasts, notify, dismiss, hold };
}

const TONE_LABEL: Record<ToastTone, string> = {
  success: "Done", info: "Update", message: "New message", paused: "Paused", caution: "Attention", error: "Problem", progress: "In progress"
};

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === "progress") return <svg className="runtime-toast-icon runtime-toast-spinner" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </svg>;
  if (tone === "caution") return <svg className="runtime-toast-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path className="runtime-toast-icon-fill" d="M12 3 22 20H2Z" /><path className="runtime-toast-icon-mark" d="M12 10v4M12 17h.01" />
  </svg>;
  return <svg className="runtime-toast-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle className="runtime-toast-icon-fill" cx="12" cy="12" r="10" />
    <path className="runtime-toast-icon-mark" d={tone === "success" ? "m7.5 12.5 3 3 6-6.5"
      : tone === "error" ? "M12 7v6M12 16.5h.01"
        : tone === "paused" ? "M10 8.5v7M14 8.5v7"
          : tone === "message" ? "M8 10h8M8 14h8"
            : "M12 11v5.5M12 7.5h.01"} />
  </svg>;
}

export function ToastRegion({ toasts, dismiss, hold }: {
  toasts: Toast[]; dismiss(id: number): void; hold(id: number, held: boolean): void;
}) {
  const urgent = toasts.filter((toast) => toast.tone === "error");
  const polite = toasts.filter((toast) => toast.tone !== "error");
  const render = (toast: Toast) => <li className={`runtime-toast runtime-toast-${toast.tone}`} key={toast.id}
    onMouseEnter={() => hold(toast.id, true)} onMouseLeave={() => hold(toast.id, false)}
    onFocus={() => hold(toast.id, true)} onBlur={() => hold(toast.id, false)}>
    <ToastIcon tone={toast.tone} />
    <p><span className="visually-hidden">{TONE_LABEL[toast.tone]}: </span>{toast.message}</p>
    {toast.action === undefined ? null : <button className="runtime-toast-action" type="button" onClick={() => {
      toast.action?.onSelect(); dismiss(toast.id);
    }}>{toast.action.label}</button>}
    <button className="runtime-toast-dismiss" type="button" aria-label={`Dismiss: ${toast.message}`} onClick={() => dismiss(toast.id)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 7l10 10M17 7 7 17" /></svg>
    </button>
  </li>;
  return <div className="runtime-toast-region">
    <div role="alert"><ol className="runtime-toast-stack" aria-label="Urgent Session messages">{urgent.map(render)}</ol></div>
    <div role="status" aria-live="polite"><ol className="runtime-toast-stack" aria-label="Session messages">{polite.map(render)}</ol></div>
  </div>;
}
