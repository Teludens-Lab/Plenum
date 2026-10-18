import type {
  CommandEnvelopeV1,
  CommandReceiptV1,
  ErrorEnvelopeV1,
  EventEnvelopeV1
} from "@plenum/event-contracts";
import type { SimulationReleaseV1 } from "@plenum/simulation-schema";
import type { RuntimeSyncState } from "@plenum/sync-client";

/** Client-only state. `local_pending` is never a canonical server receipt status. */
export interface LocalPendingCommand {
  status: "local_pending";
  command: CommandEnvelopeV1;
}

export function isServerAcceptedCommand(state: LocalPendingCommand | CommandReceiptV1): boolean {
  return state.status === "accepted";
}

export interface RuntimeContractView {
  release: SimulationReleaseV1;
  sync?: RuntimeSyncState;
  latestEvent?: EventEnvelopeV1;
  lastError?: ErrorEnvelopeV1;
}

export function releaseIdentity(view: RuntimeContractView): string {
  return `${view.release.manifest.releaseId}@${view.release.manifest.semanticVersion}`;
}
