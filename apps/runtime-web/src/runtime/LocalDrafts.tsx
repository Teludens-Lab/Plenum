import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { JsonObject } from "@plenum/event-contracts";
import type { OfflineRuntimeStore } from "../offline/storage.js";

export const LocalDraftContext = createContext<{
  store: OfflineRuntimeStore; sessionId: string; deviceId: string; scope: string;
} | null>(null);

export function LocalDraft({ draftKey, initial, children }: {
  draftKey: string; initial?: JsonObject;
  children(initial: JsonObject | undefined, changed: (value: JsonObject) => void, accepted: () => Promise<void>, reset: number): ReactNode;
}) {
  const context = useContext(LocalDraftContext);
  const scope = `${context?.scope ?? ""}:${draftKey}`;
  return <DraftEditor key={scope} context={context} scope={scope} initial={initial}>{children}</DraftEditor>;
}

function DraftEditor({ context, scope, initial, children }: {
  context: React.ContextType<typeof LocalDraftContext>; scope: string; initial: JsonObject | undefined;
  children(initial: JsonObject | undefined, changed: (value: JsonObject) => void, accepted: () => Promise<void>, reset: number): ReactNode;
}) {
  const [ready, setReady] = useState(context === null);
  const [restored, setRestored] = useState(initial);
  const [status, setStatus] = useState("");
  const [reset, setReset] = useState(0);
  const writes = useRef(Promise.resolve());
  const revision = useRef(0);
  useEffect(() => {
    if (context === null) return;
    let active = true;
    void context.store.loadDraft(context.sessionId, context.deviceId, scope).then((value) => {
      if (!active) return;
      setRestored(value === null ? initial : { ...value, ...initial });
      if (value !== null) setStatus("Local draft restored. It has not been submitted.");
    }).catch(() => { if (active) setStatus("The local draft could not be restored. New entries can still be submitted."); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  const changed = useCallback((value: JsonObject) => {
    if (context === null) return;
    const version = ++revision.current;
    setStatus("Saving local draft…");
    writes.current = writes.current.then(() => context.store.saveDraft(context.sessionId, context.deviceId, scope, value))
      .then(() => { if (revision.current === version) setStatus("Draft saved on this device. It has not been submitted."); })
      .catch(() => { if (revision.current === version) setStatus("Local draft could not be saved. Keep this page open and retry submission."); });
  }, [context?.store, context?.sessionId, context?.deviceId, scope]);
  const accepted = async () => {
    revision.current++;
    await writes.current;
    try {
      if (context !== null) await context.store.saveDraft(context.sessionId, context.deviceId, scope, null);
      setRestored(initial); setReset((value) => value + 1); setStatus("Submitted. Ready for a new entry.");
    } catch { setStatus("Submitted, but the local draft could not be cleared. Avoid submitting it again."); }
  };
  return <>{ready ? children(restored, changed, accepted, reset) : <p role="status">Restoring local draft…</p>}
    {status === "" ? null : <p className="hint" role="status">{status}</p>}</>;
}
