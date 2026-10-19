import type { RuntimeStageDefinitionV1 } from "@plenum/simulation-schema";

export interface WorkflowTransitionLike {
  from: string | null;
  command: string;
  to: string;
  allowedSessionRoleIds: string[];
  label?: string;
  notifySessionRoleIds?: string[];
  notifyCreator?: boolean;
  contentOnly?: boolean;
  editableFieldKeys?: string[];
}
type WorkflowLike = { transitions: WorkflowTransitionLike[] };
type FormLike = { sections?: Array<{ fields: Array<{ key: string; label: string; required?: boolean }> }>; fields?: Array<{ key: string; label: string; required?: boolean }> };

export type TransitionResult =
  | { allowed: true; transition: WorkflowTransitionLike }
  | { allowed: false; reason: "INVALID_TRANSITION" | "PERMISSION_DENIED" };

export function resolveWorkflowTransition(
  workflow: WorkflowLike,
  state: string | null,
  operationType: string,
  activeSessionRoleId: string
): TransitionResult {
  const operation = workflow.transitions.filter((transition) =>
    transition.from === state && transition.command === operationType);
  const transition = operation.find((candidate) => candidate.allowedSessionRoleIds.includes(activeSessionRoleId));
  return transition === undefined
    ? { allowed: false, reason: operation.length === 0 ? "INVALID_TRANSITION" : "PERMISSION_DENIED" }
    : { allowed: true, transition };
}

export function requiredFieldsMissing(form: FormLike, payload: Record<string, unknown>): string[] {
  const fields = form.sections?.flatMap((section) => section.fields) ?? form.fields ?? [];
  return fields.filter((field) => {
    if (field.required !== true) return false;
    const value = payload[field.key];
    if (typeof value === "string") return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    return value === undefined || value === null;
  }).map((field) => field.label);
}

export function nextStage(
  stages: readonly RuntimeStageDefinitionV1[],
  currentStageId: string,
  targetStageId: string
): RuntimeStageDefinitionV1 | undefined {
  const current = stages.find((stage) => stage.id === currentStageId);
  if (current === undefined || !current.transitions.some((transition) => transition.targetStageId === targetStageId)) return undefined;
  return stages.find((stage) => stage.id === targetStageId);
}

export function remainingSeconds(
  stage: RuntimeStageDefinitionV1,
  startedAt: Date | null,
  pausedAt: Date | null,
  accumulatedPauseSeconds: number,
  now: Date
): number | null {
  if (stage.timerMode !== "countdown" || stage.durationSeconds === undefined || startedAt === null) return null;
  const end = pausedAt ?? now;
  const elapsed = Math.max(0, Math.floor((end.getTime() - startedAt.getTime()) / 1000) - accumulatedPauseSeconds);
  return Math.max(0, stage.durationSeconds - elapsed);
}
