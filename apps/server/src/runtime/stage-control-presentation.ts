import type { JsonObject } from "@plenum/event-contracts";

/** Project controls from the same capability and stage rules used by executeStageCommand. */
export function stageControlPresentation(
  capabilities: Array<{ capability: string }>,
  stage: { id: string; operatorControls?: { allowStart: boolean; allowEnd: boolean; allowReopen: boolean; allowExtend: boolean; allowSkip: boolean; allowReturnToPrevious: boolean };
    transitions?: Array<{ targetStageId: string; mode: string }> } | null,
  status: string, version: number, stages: Array<{ id: string; label: string; transitions?: Array<{ targetStageId: string }> }>
): JsonObject | null {
  const timer = capabilities.some((grant) => grant.capability === "timer.control");
  const advance = capabilities.some((grant) => grant.capability === "stage.advance");
  if (stage === null || (!timer && !advance)) return null;
  const actions: JsonObject[] = [];
  const add = (operation: string, label: string, targetStageId?: string) => actions.push({
    id: `${operation}:${targetStageId ?? ""}`, operation, label, ...(targetStageId === undefined ? {} : { targetStageId })
  });
  const controls = stage.operatorControls;
  if (timer) {
    if (status === "not_started" && controls?.allowStart) add("stage.start", "Start timer");
    if (status === "active") add("stage.pause", "Pause timer");
    if (status === "paused") add("stage.resume", "Resume timer");
    if (["active", "paused"].includes(status) && controls?.allowExtend) add("stage.extend", "Extend timer");
    if (["active", "paused"].includes(status) && controls?.allowEnd) add("stage.end", "Complete stage");
    if (status === "completed" && controls?.allowReopen) add("stage.reopen", "Reopen stage");
  }
  if (advance) {
    if (status !== "not_started" || controls?.allowSkip) for (const transition of stage.transitions ?? []) {
      if (transition.mode === "automatic") continue;
      add("stage.advance", `Advance to ${stages.find((item) => item.id === transition.targetStageId)?.label ?? transition.targetStageId}`, transition.targetStageId);
    }
    if (controls?.allowReturnToPrevious) for (const previous of stages.filter((item) => item.transitions?.some((transition) => transition.targetStageId === stage.id))) {
      add("stage.return", `Return to ${previous.label}`, previous.id);
    }
  }
  return { version, actions };
}
