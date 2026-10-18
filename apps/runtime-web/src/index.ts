import type {
  CommandEnvelopeV1,
  ErrorEnvelopeV1,
  EventEnvelopeV1
} from "@plenum/event-contracts";
import type { SimulationReleaseV1 } from "@plenum/simulation-schema";

/** Client-only state. `local_pending` is never a canonical server receipt status. */
export interface LocalPendingCommand {
  status: "local_pending";
  command: CommandEnvelopeV1;
}

export interface RuntimeContractView {
  release: SimulationReleaseV1;
  latestEvent?: EventEnvelopeV1;
  lastError?: ErrorEnvelopeV1;
}

export function releaseIdentity(view: RuntimeContractView): string {
  return `${view.release.manifest.releaseId}@${view.release.manifest.semanticVersion}`;
}
