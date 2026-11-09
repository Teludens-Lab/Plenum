import { useState } from "react";
import { VOICE_DEFINITION_CONTRACT_ID } from "@plenum/event-contracts";
import type { CoreDesignV1, RuntimeActorSelectorV1, RuntimeVoiceChannelDefinitionV1 } from "@plenum/simulation-schema";

import { StudioCollaborationClient } from "../collaboration/client.js";
import { AddButton, CheckField, ItemActions, MultiCheck, SelectField, TextField, Workspace } from "../core-design/Editor.js";
import { basicVoiceChannel, coreArray, stageChoiceLabel } from "../core-design/model.js";

const words = (value: string) => value.replaceAll("_", " ");
const permission = (selector: RuntimeActorSelectorV1, sessionRoleId?: string, teamId?: string) =>
  selector.public === true || (sessionRoleId !== undefined && selector.sessionRoleIds?.includes(sessionRoleId)) || (teamId !== undefined && selector.teamIds?.includes(teamId));

function Matrix({ channel, core }: { channel: RuntimeVoiceChannelDefinitionV1; core: CoreDesignV1 }) {
  const rows: Array<{ key: string; name: string; sessionRoleId?: string; teamId?: string }> = [
    ...coreArray(core, "sessionRoles").map(({ id, name }) => ({ key: `role-${id}`, name: `Role: ${name}`, sessionRoleId: id })),
    ...coreArray(core, "teams").map(({ id, name }) => ({ key: `team-${id}`, name: `Team: ${name}`, teamId: id }))
  ];
  return <div className="table-scroll" tabIndex={0} aria-label={`Permission matrix for ${channel.name}`}><table className="permission-matrix">
    <caption>Effective configured permissions. Public access, when selected, applies to every row.</caption>
    <thead><tr><th scope="col">Actor</th><th scope="col">Listen</th><th scope="col">Transmit</th><th scope="col">Moderate</th><th scope="col">Invite</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.key}><th scope="row">{row.name}</th>
      {[channel.canListen, channel.canTransmit, channel.canModerate, channel.canInvite ?? {}].map((selector, index) => <td key={index}>{permission(selector, row.sessionRoleId, row.teamId) ? "Allowed" : "Denied"}</td>)}
    </tr>)}</tbody>
  </table></div>;
}

function SelectorEditor({ legend, selector, path, core, client, allowPublic = false }: {
  legend: string; selector: RuntimeActorSelectorV1; path: readonly (string | number)[]; core: CoreDesignV1;
  client: StudioCollaborationClient; allowPublic?: boolean;
}) {
  return <fieldset className="nested-editor"><legend>{legend}</legend>
    <MultiCheck legend="Session Roles" values={selector.sessionRoleIds ?? []} options={coreArray(core, "sessionRoles").map(({ id, name }) => ({ value: id, label: name }))} path={[...path, "sessionRoleIds"]} client={client} />
    <MultiCheck legend="Teams" values={selector.teamIds ?? []} options={coreArray(core, "teams").map(({ id, name }) => ({ value: id, label: name }))} path={[...path, "teamIds"]} client={client} />
    {allowPublic && <CheckField id={`${path.join("-")}-public`} label="Public / every participant" checked={selector.public === true} path={[...path, "public"]} client={client} />}
  </fieldset>;
}

export function VoiceEditor({ core, client }: { core: CoreDesignV1; client: StudioCollaborationClient }) {
  const channels = core.communications?.voiceChannels ?? [];
  const stages = coreArray(core, "stages");
  const roles = coreArray(core, "sessionRoles");
  const adapters = (core.platformAdapters ?? []).filter(({ kind }) => kind === "media_provider" || kind === undefined);
  const profiles = ["cloud", "institutional", "air_gapped"] as const;
  const [targetProfile, setTargetProfile] = useState<(typeof profiles)[number]>("institutional");

  return <Workspace id="voice" title="Voice Channels" intro="Configure voice permissions and provider capability by deployment profile. Every channel also provides non-audio instructions.">
    <p className="rule-sentence"><strong>Version 1 privacy restriction:</strong> Production recording and transcription remain off. A future enablement needs a new approved legal, consent, retention, access, export, and provider decision.</p>
    <details className="technical-details"><summary>Policy provenance</summary><p>OPEN-027: version 1 recording and transcription restriction.</p></details>
    <div className="preview-controls"><label>Target deployment profile<select value={targetProfile} onChange={(event) => setTargetProfile(event.target.value as (typeof profiles)[number])}>{profiles.map((profile) => <option key={profile} value={profile}>{words(profile)}</option>)}</select></label></div>
    <div className="editor-list" data-contract-id={VOICE_DEFINITION_CONTRACT_ID}>{channels.map((channel, index) => {
      const base = ["coreDesign", "communications", "voiceChannels", index] as const;
      const adapter = adapters.find(({ id }) => id === channel.mediaProviderAdapterBindingId);
      const targetCapabilities = adapter?.voiceCapabilities?.find(({ profile }) => profile === targetProfile);
      const targetReasons = [
        ...(adapter === undefined ? ["No pinned Media Provider Adapter is selected."] : []),
        ...(adapter !== undefined && targetCapabilities === undefined ? ["The adapter declares no capability for this profile."] : []),
        ...(targetCapabilities !== undefined && !targetCapabilities.modes.includes(channel.mode) ? [`${words(channel.mode)} is not supported.`] : []),
        ...(channel.recordingPolicy !== "off" ? ["Recording is disabled in the version 1 production profile."] : []),
        ...(channel.transcriptionPolicy !== "off" ? ["Transcription is disabled in the version 1 production profile."] : [])
      ];
      return <details className="editor-item" id={`voice-${channel.id}`} key={channel.id}>
        <summary><span>{channel.name || "Untitled Voice Channel"}</span></summary><details className="technical-details"><summary>Technical reference</summary><code>{channel.id}</code></details>
        <div className="item-body grid-fields">
          <TextField id={`voice-name-${channel.id}`} label="Channel name" value={channel.name} path={[...base, "name"]} client={client} />
          <SelectField id={`voice-mode-${channel.id}`} label="Mode" value={channel.mode} options={["radio_ptt", "open_room", "private_call", "broadcast"].map((value) => ({ value, label: words(value) }))} path={[...base, "mode"]} client={client} />
          <TextField id={`voice-capacity-${channel.id}`} label="Capacity" type="number" value={channel.capacity} path={[...base, "capacity"]} client={client} />
          <TextField id={`voice-language-${channel.id}`} label="Language (optional)" value={channel.language ?? ""} path={[...base, "language"]} client={client} transform={(value) => value || undefined} />
          <MultiCheck legend="Active Stages (none means all)" values={channel.activeStageIds ?? []} options={stages.map(({ id }) => ({ value: id, label: stageChoiceLabel(core, id) }))} path={[...base, "activeStageIds"]} client={client} />
          <SelectorEditor legend="Can listen" selector={channel.canListen} path={[...base, "canListen"]} core={core} client={client} allowPublic />
          <SelectorEditor legend="Can transmit" selector={channel.canTransmit} path={[...base, "canTransmit"]} core={core} client={client} />
          <SelectorEditor legend="Can moderate" selector={channel.canModerate} path={[...base, "canModerate"]} core={core} client={client} />
          <SelectorEditor legend="Can invite" selector={channel.canInvite ?? {}} path={[...base, "canInvite"]} core={core} client={client} />

          {channel.mode === "radio_ptt" && <fieldset className="nested-editor"><legend>Push-to-talk policy</legend><div className="grid-fields">
            <TextField id={`voice-floor-${channel.id}`} label="Floor lease (ms)" type="number" value={channel.radio?.floorLeaseMs ?? 5000} path={[...base, "radio", "floorLeaseMs"]} client={client} />
            <SelectField id={`voice-queue-${channel.id}`} label="Queue policy" value={channel.radio?.queuePolicy ?? "fifo"} options={["fifo", "priority"].map((value) => ({ value, label: words(value) }))} path={[...base, "radio", "queuePolicy"]} client={client} />
            <SelectField id={`voice-preempt-${channel.id}`} label="Preemption" value={channel.radio?.preemption ?? "none"} options={["none", "authorized_emergency"].map((value) => ({ value, label: words(value) }))} path={[...base, "radio", "preemption"]} client={client} />
            <TextField id={`voice-max-${channel.id}`} label="Maximum transmission (ms)" type="number" value={channel.radio?.maxTransmissionMs ?? 30000} path={[...base, "radio", "maxTransmissionMs"]} client={client} />
            <TextField id={`voice-cooldown-${channel.id}`} label="Cooldown (ms)" type="number" value={channel.radio?.cooldownMs ?? 500} path={[...base, "radio", "cooldownMs"]} client={client} />
          </div></fieldset>}
          <fieldset className="nested-editor"><legend>Role priority</legend>{roles.map((role) => {
            const priorityIndex = channel.priorityPolicy?.findIndex(({ sessionRoleId }) => sessionRoleId === role.id) ?? -1;
            return <div className="field-row" key={role.id}><span>{role.name}</span><label className="choice"><input type="checkbox" checked={priorityIndex >= 0} onChange={(event) => event.target.checked ? client.appendAtPath([...base, "priorityPolicy"], { sessionRoleId: role.id, priority: 1 }) : client.removeAtPath([...base, "priorityPolicy"], priorityIndex)} />Priority</label>{priorityIndex >= 0 && <TextField id={`voice-priority-${channel.id}-${role.id}`} label="Priority value" type="number" value={channel.priorityPolicy?.[priorityIndex]?.priority ?? 1} path={[...base, "priorityPolicy", priorityIndex, "priority"]} client={client} />}</div>;
          })}</fieldset>

          <SelectField id={`voice-recording-${channel.id}`} label="Recording policy" value={channel.recordingPolicy} options={["off", "on", "with_consent"].map((value) => ({ value, label: words(value) }))} path={[...base, "recordingPolicy"]} client={client} />
          <SelectField id={`voice-transcription-${channel.id}`} label="Transcription policy" value={channel.transcriptionPolicy} options={["off", "with_consent"].map((value) => ({ value, label: words(value) }))} path={[...base, "transcriptionPolicy"]} client={client} />
          {(channel.recordingPolicy !== "off" || channel.transcriptionPolicy !== "off") && <p className="status-error">Production publication is blocked by the version 1 restriction for recording and transcription. Every active participant must consent in any future approved profile; withdrawal must stop the relevant process immediately.</p>}
          <TextField id={`voice-retention-${channel.id}`} label="Retention policy ID (required when enabled)" value={channel.retentionPolicyId ?? ""} path={[...base, "retentionPolicyId"]} client={client} transform={(value) => value || undefined} />
          <SelectField id={`voice-adapter-${channel.id}`} label="Media provider adapter" value={channel.mediaProviderAdapterBindingId} options={[{ value: "", label: "Select adapter" }, ...adapters.map(({ id }) => ({ value: id, label: id }))]} path={[...base, "mediaProviderAdapterBindingId"]} client={client} />
          <div className={targetReasons.length === 0 ? "rule-sentence" : "status-error"} role="status"><strong>{words(targetProfile)} compatibility:</strong> {targetReasons.length === 0 ? "Available with the pinned adapter; permissions still fail closed at Runtime." : targetReasons.join(" ")}</div>
          <div className="table-scroll" tabIndex={0} aria-label={`Adapter capability preview for ${channel.name}`}><table className="permission-matrix"><caption>Selected adapter capability by target profile</caption><thead><tr><th scope="col">Profile</th><th scope="col">Mode</th><th scope="col">Recording</th><th scope="col">Transcription</th></tr></thead><tbody>{profiles.map((profile) => {
            const capabilities = adapter?.voiceCapabilities?.find((item) => item.profile === profile);
            return <tr key={profile}><th scope="row">{words(profile)}</th><td>{capabilities?.modes.includes(channel.mode) ? "Supported" : "Unsupported"}</td><td>{capabilities?.recording ? "Supported" : "Unsupported"}</td><td>{capabilities?.transcription ? "Supported" : "Unsupported"}</td></tr>;
          })}</tbody></table></div>
          <Matrix channel={channel} core={core} />
          <p className="rule-sentence"><strong>Non-audio path:</strong> Participants receive text status, permission, floor/queue, and moderator instructions even when audio is unavailable.</p>
          <ItemActions path={["coreDesign", "communications", "voiceChannels"]} index={index} count={channels.length} client={client} label={channel.name || "Voice Channel"} />
        </div>
      </details>;
    })}</div>
    <AddButton label="Add Voice Channel" disabled={adapters.length === 0} onClick={() => client.appendAtPath(["coreDesign", "communications", "voiceChannels"], basicVoiceChannel("New Voice Channel", adapters[0]?.id))} />
    {adapters.length === 0 && <p className="hint">Bind a media provider adapter before creating a Voice Channel.</p>}
  </Workspace>;
}
