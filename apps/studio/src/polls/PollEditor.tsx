import { POLL_DEFINITION_CONTRACT_ID } from "@plenum/event-contracts";
import type { CoreDesignV1, RuntimePollDefinitionV1 } from "@plenum/simulation-schema";

import { StudioCollaborationClient } from "../collaboration/client.js";
import { AddButton, CheckField, ItemActions, MultiCheck, SelectField, TextField, Workspace } from "../core-design/Editor.js";
import { basicPoll, coreArray, identifier, stageChoiceLabel } from "../core-design/model.js";

const words = (value: string) => value.replaceAll("_", " ");

function audience(policy: NonNullable<CoreDesignV1["informationPolicies"]>[number] | undefined, core: CoreDesignV1): string {
  if (policy === undefined || policy.grants.length === 0) return "Nobody (deny by default)";
  const roles = new Map(coreArray(core, "sessionRoles").map(({ id, name }) => [id, name]));
  const teams = new Map(coreArray(core, "teams").map(({ id, name }) => [id, name]));
  const labels = policy.grants.flatMap(({ audience: item }) => [
    ...(item.public ? ["Everyone"] : []),
    ...(item.sessionRoleIds ?? []).map((id) => `Role: ${roles.get(id) ?? id}`),
    ...(item.teamIds ?? []).map((id) => `Team: ${teams.get(id) ?? id}`),
    ...(item.seatIds ?? []).map((id) => `Seat: ${id}`)
  ]);
  return labels.length === 0 ? "No directly named audience" : [...new Set(labels)].join(", ");
}

function countingRule(poll: RuntimePollDefinitionV1): string {
  const threshold = poll.thresholdRule.kind === "supermajority"
    ? `${Math.round((poll.thresholdRule.fraction ?? 0) * 100)}% supermajority`
    : words(poll.thresholdRule.kind);
  return `Count ${poll.tallyMethod === "builtin_count" ? "accepted ballots" : `with ${poll.votingMethodAdapterBindingId ?? "an unselected adapter"}`} using ${threshold} over ${words(poll.thresholdRule.denominator)}; abstentions ${poll.thresholdRule.abstentionCountsTowardDenominator ? "do" : "do not"} enter the denominator; quorum is ${poll.quorumRule.minimum} by ${words(poll.quorumRule.basis)}; a tie produces ${words(poll.tieRule)}.`;
}

export function PollEditor({ core, client }: { core: CoreDesignV1; client: StudioCollaborationClient }) {
  const polls = coreArray(core, "polls");
  const policies = coreArray(core, "informationPolicies");
  const stages = coreArray(core, "stages");
  const seats = coreArray(core, "seats");
  const roles = coreArray(core, "sessionRoles");
  const workflows = coreArray(core, "workflows");
  const votingAdapters = (core.platformAdapters ?? []).filter(({ kind }) => kind === "voting_method" || kind === undefined);
  const policyOptions = policies.map(({ id, name }) => ({ value: id, label: name }));

  return <Workspace id="polls" title="Polls" intro="Define who votes, exactly how ballots count, and who may see the result. Incomplete counting rules block publication.">
    <div className="editor-list" data-contract-id={POLL_DEFINITION_CONTRACT_ID}>{polls.map((poll, index) => {
      const base = ["coreDesign", "polls", index] as const;
      const scopeOptions = poll.scope === "team" ? coreArray(core, "teams") : poll.scope === "stage" ? stages : [];
      const readiness = [
        ...(poll.question.trim() === "" ? ["Question is required."] : []),
        ...(poll.options.length < 2 ? ["At least two options are required."] : []),
        ...(poll.electoratePolicyId === "" ? ["Electorate policy is required."] : []),
        ...(poll.resultVisibilityPolicyId === "" ? ["Result visibility policy is required."] : []),
        ...(poll.tallyMethodVersion.trim() === "" ? ["Tally method version is required."] : []),
        ...(poll.tallyMethod === "voting_method_adapter" && !poll.votingMethodAdapterBindingId ? ["Voting Method Adapter is required."] : []),
        ...((poll.certificationPolicy.certifierSessionRoleIds?.length ?? 0) === 0 && (poll.certificationPolicy.certifierOrganizationRoles?.length ?? 0) === 0 ? ["At least one certifier is required."] : []),
        ...(poll.secrecy !== "open" ? ["Version 1 production Polls must be explicitly non-secret under resolved OPEN-028."] : []),
        ...(poll.openTrigger.mode === "scheduled" && poll.openTrigger.offsetSeconds === undefined ? ["Scheduled open offset is required."] : []),
        ...(poll.closeTrigger.mode === "scheduled" && poll.closeTrigger.offsetSeconds === undefined ? ["Scheduled close offset is required."] : [])
      ];
      return <details className="editor-item" id={`polls-${poll.id}`} key={poll.id}>
        <summary><span>{poll.question || "Untitled Poll"}</span><span className="item-id">{poll.id}</span></summary>
        <div className="item-body grid-fields">
          <TextField id={`poll-question-${poll.id}`} label="Question" value={poll.question} path={[...base, "question"]} client={client} multiline />
          <SelectField id={`poll-type-${poll.id}`} label="Poll type" value={poll.pollType} options={["single_choice", "multiple_choice", "yes_no_abstain", "opinion"].map((value) => ({ value, label: words(value) }))} path={[...base, "pollType"]} client={client} />
          <TextField id={`poll-min-${poll.id}`} label="Minimum selections" type="number" value={poll.minSelections ?? 1} path={[...base, "minSelections"]} client={client} />
          <TextField id={`poll-max-${poll.id}`} label="Maximum selections" type="number" value={poll.maxSelections ?? 1} path={[...base, "maxSelections"]} client={client} />
          <fieldset className="nested-editor"><legend>Options</legend>{poll.options.map((option, optionIndex) => <div className="field-row" key={option.id}>
            <TextField id={`poll-option-${option.id}`} label={`Option ${optionIndex + 1}`} value={option.label} path={[...base, "options", optionIndex, "label"]} client={client} />
            <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath([...base, "options"], optionIndex)}>Remove option</button>
          </div>)}<AddButton label="Add option" onClick={() => client.appendAtPath([...base, "options"], { id: identifier(), label: "New option" })} /></fieldset>

          <SelectField id={`poll-scope-${poll.id}`} label="Scope" value={poll.scope} options={["session", "team", "stage"].map((value) => ({ value, label: words(value) }))} path={[...base, "scope"]} client={client} />
          {poll.scope !== "session" && <SelectField id={`poll-scope-ref-${poll.id}`} label={`${words(poll.scope)} scope`} value={poll.scopeReference ?? ""} options={[{ value: "", label: "Select scope" }, ...scopeOptions.map(({ id, name }) => ({ value: id, label: name }))]} path={[...base, "scopeReference"]} client={client} />}
          <SelectField id={`poll-electorate-${poll.id}`} label="Electorate policy" value={poll.electoratePolicyId} options={[{ value: "", label: "Select policy" }, ...policyOptions]} path={[...base, "electoratePolicyId"]} client={client} />
          <SelectField id={`poll-results-${poll.id}`} label="Result visibility policy" value={poll.resultVisibilityPolicyId} options={[{ value: "", label: "Select policy" }, ...policyOptions]} path={[...base, "resultVisibilityPolicyId"]} client={client} />
          <div className="rule-sentence"><strong>Electorate preview:</strong> {audience(policies.find(({ id }) => id === poll.electoratePolicyId), core)}</div>
          <div className="rule-sentence"><strong>Result audience preview:</strong> {audience(policies.find(({ id }) => id === poll.resultVisibilityPolicyId), core)}</div>

          <SelectField id={`poll-secrecy-${poll.id}`} label="Ballot visibility" value={poll.secrecy} options={["open", "secret_ballot", "anonymous_survey"].map((value) => ({ value, label: words(value) }))} path={[...base, "secrecy"]} client={client} />
          <p className="rule-sentence"><strong>{poll.secrecy === "secret_ballot" ? "Secret ballot" : poll.secrecy === "anonymous_survey" ? "Anonymous survey" : "Open ballot"}:</strong> {poll.secrecy === "secret_ballot" ? "This configuration is visible for design review, but version 1 production publication is blocked under resolved OPEN-028." : poll.secrecy === "anonymous_survey" ? "Responses are not attributable and therefore cannot enforce one ballot per Seat Assignment. This mode is unavailable." : "Ballots and choices remain attributable to authorized viewers."}</p>
          <label className="choice" htmlFor={`poll-revote-${poll.id}`}><input id={`poll-revote-${poll.id}`} type="checkbox" checked={poll.allowRevote} onChange={(event) => client.transact(() => {
            client.setAtPath([...base, "allowRevote"], event.target.checked);
            if (event.target.checked) client.setAtPath([...base, "finalBallotRule"], "latest_accepted"); else client.deleteAtPath([...base, "finalBallotRule"]);
          })} />Allow revote; latest accepted ballot is final</label>

          <SelectField id={`poll-tally-${poll.id}`} label="Tally method" value={poll.tallyMethod} options={[{ value: "builtin_count", label: "Built-in count" }, { value: "voting_method_adapter", label: "Voting method adapter" }]} path={[...base, "tallyMethod"]} client={client} />
          {poll.tallyMethod === "voting_method_adapter" && <SelectField id={`poll-adapter-${poll.id}`} label="Voting adapter" value={poll.votingMethodAdapterBindingId ?? ""} options={[{ value: "", label: "Select adapter" }, ...votingAdapters.map(({ id }) => ({ value: id, label: id }))]} path={[...base, "votingMethodAdapterBindingId"]} client={client} />}
          <TextField id={`poll-tally-version-${poll.id}`} label="Tally method version" value={poll.tallyMethodVersion} path={[...base, "tallyMethodVersion"]} client={client} />
          <SelectField id={`poll-threshold-${poll.id}`} label="Threshold" value={poll.thresholdRule.kind} options={["simple_majority", "supermajority", "unanimity", "plurality", "none"].map((value) => ({ value, label: words(value) }))} path={[...base, "thresholdRule", "kind"]} client={client} />
          {poll.thresholdRule.kind === "supermajority" && <TextField id={`poll-fraction-${poll.id}`} label="Supermajority fraction (0–1)" type="number" value={poll.thresholdRule.fraction ?? 0.67} path={[...base, "thresholdRule", "fraction"]} client={client} />}
          <SelectField id={`poll-denominator-${poll.id}`} label="Threshold denominator" value={poll.thresholdRule.denominator} options={["valid_votes", "votes_cast", "electorate"].map((value) => ({ value, label: words(value) }))} path={[...base, "thresholdRule", "denominator"]} client={client} />
          <CheckField id={`poll-abstain-denom-${poll.id}`} label="Count abstentions in threshold denominator" checked={poll.thresholdRule.abstentionCountsTowardDenominator} path={[...base, "thresholdRule", "abstentionCountsTowardDenominator"]} client={client} />
          <SelectField id={`poll-quorum-basis-${poll.id}`} label="Quorum basis" value={poll.quorumRule.basis} options={["electorate_at_open", "custom_snapshot"].map((value) => ({ value, label: words(value) }))} path={[...base, "quorumRule", "basis"]} client={client} />
          <TextField id={`poll-quorum-min-${poll.id}`} label="Minimum quorum" type="number" value={poll.quorumRule.minimum} path={[...base, "quorumRule", "minimum"]} client={client} />
          <CheckField id={`poll-abstain-quorum-${poll.id}`} label="Count abstentions toward participation" checked={poll.quorumRule.abstentionCountsTowardParticipation} path={[...base, "quorumRule", "abstentionCountsTowardParticipation"]} client={client} />
          <SelectField id={`poll-tie-${poll.id}`} label="Tie rule" value={poll.tieRule} options={["no_decision", "chair_decides", "reissue"].map((value) => ({ value, label: words(value) }))} path={[...base, "tieRule"]} client={client} />
          <p className="rule-sentence"><strong>Counting rule:</strong> {countingRule(poll)}</p>

          <fieldset className="nested-editor"><legend>Seat weights and veto</legend>{seats.map((seat) => {
            const weightIndex = poll.weights.findIndex(({ seatId }) => seatId === seat.id);
            return <div className="field-row" key={seat.id}><span>{seat.name}</span><label className="choice"><input type="checkbox" checked={weightIndex >= 0} onChange={(event) => event.target.checked ? client.appendAtPath([...base, "weights"], { seatId: seat.id, weight: 1 }) : client.removeAtPath([...base, "weights"], weightIndex)} />Weighted</label>{weightIndex >= 0 && <TextField id={`poll-weight-${poll.id}-${seat.id}`} label="Weight" type="number" value={poll.weights[weightIndex]?.weight ?? 1} path={[...base, "weights", weightIndex, "weight"]} client={client} />}</div>;
          })}<MultiCheck legend="Veto holder Seats" values={poll.vetoRule.holderSeatIds} options={seats.map(({ id, name }) => ({ value: id, label: name }))} path={[...base, "vetoRule", "holderSeatIds"]} client={client} /></fieldset>

          <SelectField id={`poll-open-${poll.id}`} label="Open trigger" value={poll.openTrigger.mode} options={["manual", "scheduled", "stage_entry"].map((value) => ({ value, label: words(value) }))} path={[...base, "openTrigger", "mode"]} client={client} />
          <SelectField id={`poll-close-${poll.id}`} label="Close trigger" value={poll.closeTrigger.mode} options={["manual", "scheduled", "stage_exit"].map((value) => ({ value, label: words(value) }))} path={[...base, "closeTrigger", "mode"]} client={client} />
          {poll.openTrigger.mode === "stage_entry" && <SelectField id={`poll-open-stage-${poll.id}`} label="Open at Stage" value={poll.openTrigger.stageId ?? ""} options={stages.map(({ id }) => ({ value: id, label: stageChoiceLabel(core, id) }))} path={[...base, "openTrigger", "stageId"]} client={client} />}
          {poll.closeTrigger.mode === "stage_exit" && <SelectField id={`poll-close-stage-${poll.id}`} label="Close after Stage" value={poll.closeTrigger.stageId ?? ""} options={stages.map(({ id }) => ({ value: id, label: stageChoiceLabel(core, id) }))} path={[...base, "closeTrigger", "stageId"]} client={client} />}
          {poll.openTrigger.mode === "scheduled" && <TextField id={`poll-open-offset-${poll.id}`} label="Open offset from Session start (seconds)" type="number" value={poll.openTrigger.offsetSeconds ?? 0} path={[...base, "openTrigger", "offsetSeconds"]} client={client} />}
          {poll.closeTrigger.mode === "scheduled" && <TextField id={`poll-close-offset-${poll.id}`} label="Close offset from Session start (seconds)" type="number" value={poll.closeTrigger.offsetSeconds ?? 0} path={[...base, "closeTrigger", "offsetSeconds"]} client={client} />}
          <TextField id={`poll-grace-${poll.id}`} label="Deadline grace (seconds)" type="number" value={poll.deadlinePolicy.graceSeconds} path={[...base, "deadlinePolicy", "graceSeconds"]} client={client} />
          <MultiCheck legend="Certifier Session Roles" values={poll.certificationPolicy.certifierSessionRoleIds ?? []} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={[...base, "certificationPolicy", "certifierSessionRoleIds"]} client={client} />
          <SelectField id={`poll-workflow-${poll.id}`} label="Workflow after certification" value={poll.onCertifiedWorkflowId ?? ""} options={[{ value: "", label: "No workflow" }, ...workflows.map(({ id, name }) => ({ value: id, label: name }))]} path={[...base, "onCertifiedWorkflowId"]} client={client} emptyDeletes />
          <TextField id={`poll-retention-${poll.id}`} label="Retention policy ID (optional)" value={poll.retentionPolicyId ?? ""} path={[...base, "retentionPolicyId"]} client={client} transform={(value) => value || undefined} />
          <div className={readiness.length === 0 ? "rule-sentence" : "status-error"} role="status"><strong>Publication readiness:</strong> {readiness.length === 0 ? "Complete. Every counting, electorate, visibility, lifecycle, and certification rule is explicit." : <ul>{readiness.map((reason) => <li key={reason}>{reason}</li>)}</ul>}</div>
          <ItemActions path={["coreDesign", "polls"]} index={index} count={polls.length} client={client} label={poll.question || "Poll"} />
        </div>
      </details>;
    })}</div>
    <AddButton label="Add Poll" disabled={policies.length === 0 || roles.length === 0} onClick={() => client.appendAtPath(["coreDesign", "polls"], basicPoll("New Poll", policies[0]?.id, roles[0]?.id))} />
    {policies.length === 0 && <p className="hint">Add an Information Policy before creating a Poll.</p>}
  </Workspace>;
}
