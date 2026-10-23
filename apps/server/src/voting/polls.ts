import { createHash, randomUUID } from "node:crypto";
import { BALLOT_COMMAND_CONTRACT_ID, CERTIFICATION_CONTRACT_ID, canonicalizeJson,
  type CertificationV1, type JsonValue, type RuntimePollTallyV1, type RuntimePollV1 } from "@plenum/event-contracts";
import { audienceAllows, type FieldAudience } from "@plenum/policy-engine";
import type { RuntimePollDefinitionV1 } from "@plenum/simulation-schema";
import type { Pool, PoolClient } from "pg";
import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { SessionAccessContextV1 } from "../identity/context.js";
import type { CommandDecision, CommandExecutionContext } from "../runtime/commands/processor.js";

interface VotingDefinition {
  polls: RuntimePollDefinitionV1[];
  informationPolicies: Array<{ id: string; grants: Array<{ audience: FieldAudience }> }>;
  sessionRoles: Array<{ id: string; isControlRole?: boolean }>;
  seats: Array<{ id: string; sessionRoleIds: string[]; teamId?: string }>;
}
interface PollRow {
  id: string; governing_release_id: string; definition_id: string; definition_revision: number;
  definition: RuntimePollDefinitionV1; status: RuntimePollV1["status"]; deadline_at: Date | null; version: string;
}
export interface BallotForTally {
  id: string; ballot_revision: number; choices: string[]; accepted_sequence: string; weight: string; veto: boolean;
}
interface TallyResult extends RuntimePollTallyV1 {
  source: Array<{ id: string; ballotRevision: number; choices: string[]; acceptedSequence: number; weight: number; veto: boolean }>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const digest = (value: JsonValue) => createHash("sha256").update(canonicalizeJson(value)).digest("hex");
const fail = (errorCode: "VALIDATION_FAILED" | "PERMISSION_DENIED" | "TARGET_NOT_FOUND" | "TARGET_EXISTS" |
  "STALE_AGGREGATE_VERSION" | "INCOMPATIBLE_RELEASE" | "INVALID_TRANSITION" | "ALREADY_VOTED" |
  "DEADLINE_EXPIRED" | "CAPABILITY_UNAVAILABLE", message: string, reconcile = false): CommandDecision =>
  ({ status: reconcile ? "needs_reconciliation" : "rejected", errorCode, message });

async function readDefinition(client: PoolClient, organizationId: string, releaseId: string): Promise<VotingDefinition> {
  const result = await client.query<{ snapshot: unknown }>(
    `SELECT revision.snapshot FROM registry.releases release JOIN studio.definition_revisions revision
       ON revision.organization_id=release.organization_id AND revision.id=release.definition_revision_id
      WHERE release.organization_id=$1 AND release.id=$2`, [organizationId, releaseId]);
  const snapshot = result.rows[0]?.snapshot;
  const definition = isRecord(snapshot) && isRecord(snapshot.coreDesign) ? snapshot.coreDesign : snapshot;
  if (!isRecord(definition) || !Array.isArray(definition.informationPolicies) ||
      !Array.isArray(definition.sessionRoles) || !Array.isArray(definition.seats)) throw new Error("Release lacks the voting definition");
  return { ...definition, polls: Array.isArray(definition.polls) ? definition.polls : [] } as unknown as VotingDefinition;
}

function canCertify(poll: RuntimePollDefinitionV1, context: SessionAccessContextV1): boolean {
  return poll.certificationPolicy.certifierSessionRoleIds?.includes(context.activeSessionRoleId) === true ||
    poll.certificationPolicy.certifierOrganizationRoles?.some((role) => context.organizationRoles.includes(role.toLowerCase() as "admin" | "operator")) === true;
}

function policyAllows(definition: VotingDefinition, policyId: string, context: SessionAccessContextV1,
  sessionRoleId: string, participantId: string, seatId?: string): boolean {
  const seat = definition.seats.find(({ id }) => id === seatId);
  const role = definition.sessionRoles.find(({ id }) => id === sessionRoleId);
  return definition.informationPolicies.find(({ id }) => id === policyId)?.grants.some(({ audience }) => audienceAllows({
    organizationId: context.organizationId, sessionId: context.sessionId, participantId, activeSessionRoleId: sessionRoleId,
    ...(seat?.teamId === undefined ? {} : { activeTeamId: seat.teamId }), isControlRole: role?.isControlRole === true,
    organizationRoles: participantId === context.participantId ? context.organizationRoles : []
  }, audience)) === true;
}

function choices(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string") && new Set(value).size === value.length ? value : undefined;
}
function validChoices(poll: RuntimePollDefinitionV1, selected: string[]): boolean {
  if (selected.some((id) => !poll.options.some((option) => option.id === id))) return false;
  return poll.pollType === "multiple_choice"
    ? selected.length >= Number(poll.minSelections) && selected.length <= Number(poll.maxSelections)
    : selected.length === 1;
}

export function computeBuiltInTally(poll: RuntimePollDefinitionV1, ballots: BallotForTally[], electorateSize: number,
  computedAt = new Date()): TallyResult {
  const source = ballots.map((ballot) => ({ id: ballot.id, ballotRevision: Number(ballot.ballot_revision),
    choices: [...ballot.choices].sort(), acceptedSequence: Number(ballot.accepted_sequence), weight: Number(ballot.weight), veto: ballot.veto
  })).sort((a, b) => a.acceptedSequence - b.acceptedSequence || a.id.localeCompare(b.id));
  const counts: Record<string, number> = Object.fromEntries(poll.options.map(({ id }) => [id, 0]));
  let participationCount = 0, votesCast = 0, validVotes = 0, vetoExercised = false;
  for (const ballot of source) {
    const abstains = ballot.choices.includes("abstain");
    if (!abstains || poll.quorumRule.abstentionCountsTowardParticipation) participationCount += ballot.weight;
    votesCast += ballot.weight;
    if (!abstains) validVotes += ballot.weight;
    ballot.choices.forEach((option) => { counts[option] = (counts[option] ?? 0) + ballot.weight; });
    if (ballot.veto && ballot.choices.includes("no")) vetoExercised = true;
  }
  const candidates = poll.options.filter(({ id }) => id !== "abstain");
  const maximum = Math.max(0, ...candidates.map(({ id }) => counts[id] ?? 0));
  const winningOptionIds = candidates.filter(({ id }) => maximum > 0 && counts[id] === maximum).map(({ id }) => id).sort();
  const tied = winningOptionIds.length > 1;
  const denominator = poll.thresholdRule.denominator === "electorate" ? electorateSize :
    poll.thresholdRule.denominator === "votes_cast" ? votesCast : validVotes;
  const leading = winningOptionIds.length === 1 ? counts[winningOptionIds[0]!] ?? 0 : 0;
  const thresholdMet = poll.thresholdRule.kind === "none" ? true : poll.thresholdRule.kind === "plurality" ? !tied && leading > 0 :
    poll.thresholdRule.kind === "unanimity" ? denominator > 0 && leading === denominator :
      poll.thresholdRule.kind === "supermajority" ? denominator > 0 && leading >= denominator * Number(poll.thresholdRule.fraction) :
        denominator > 0 && leading > denominator / 2;
  const quorumMet = participationCount >= poll.quorumRule.minimum;
  const ballotSetSha256 = digest(source as unknown as JsonValue);
  const outcome = { counts, electorateSize, participationCount, quorumMet, winningOptionIds, tied, vetoExercised,
    passed: quorumMet && thresholdMet && !vetoExercised && (!tied || poll.tieRule === "chair_decides") };
  return { ballotSetSha256, resultSha256: digest({ ballotSetSha256, method: "builtin_count",
    methodVersion: poll.tallyMethodVersion, ...outcome } as JsonValue), method: "builtin_count",
    methodVersion: poll.tallyMethodVersion, ...outcome, computedAt: computedAt.toISOString(), source };
}

async function readPoll(client: PoolClient, context: SessionAccessContextV1, id: string, lock = false): Promise<PollRow | undefined> {
  const result = await client.query<PollRow>(`SELECT id,governing_release_id,definition_id,definition_revision,definition,status,deadline_at,version
    FROM voting.polls WHERE organization_id=$1 AND session_id=$2 AND id=$3${lock ? " FOR UPDATE" : ""}`,
  [context.organizationId, context.sessionId, id]);
  return result.rows[0];
}

async function openPoll({ client, context, command, activeReleaseId }: CommandExecutionContext): Promise<CommandDecision> {
  if (command.governingReleaseId !== activeReleaseId) return fail("INCOMPATIBLE_RELEASE", "New Polls use the active Release.", true);
  if (command.expectedAggregateVersion !== 0) return fail("STALE_AGGREGATE_VERSION", "A new Poll starts at version zero.", true);
  const release = await readDefinition(client, context.organizationId, activeReleaseId);
  const poll = typeof command.payload.definitionId === "string" ? release.polls.find(({ id }) => id === command.payload.definitionId) : undefined;
  if (poll === undefined) return fail("VALIDATION_FAILED", "The Poll Definition is not in the Release.");
  if (poll.scope === "stage") {
    const stage = await client.query<{ stage_id: string }>(
      "SELECT stage_id FROM runtime.session_stage_state WHERE organization_id=$1 AND session_id=$2 AND status='active'",
      [context.organizationId, context.sessionId]);
    if (stage.rows[0]?.stage_id !== poll.scopeReference) return fail("INVALID_TRANSITION", "The Poll is not available in the active Stage.");
  }
  if (!canCertify(poll, context)) return fail("PERMISSION_DENIED", "The Active Role Context cannot open this Poll.");
  if (poll.secrecy !== "open") return fail("CAPABILITY_UNAVAILABLE", "Production secret ballots remain blocked by OPEN-028.");
  if (poll.tallyMethod !== "builtin_count") return fail("CAPABILITY_UNAVAILABLE", "The configured Voting Method Adapter is unavailable.");
  if ((await client.query("SELECT 1 FROM voting.polls WHERE organization_id=$1 AND id=$2", [context.organizationId, command.aggregateId])).rowCount !== 0)
    return fail("TARGET_EXISTS", "The Poll already exists.");
  const revision = Number(command.payload.definitionRevision);
  if (!Number.isSafeInteger(revision) || revision < 1) return fail("VALIDATION_FAILED", "A positive Poll definition revision is required.");
  const assignments = await client.query<{ id: string; participant_id: string; session_role_id: string; seat_id: string | null }>(
    "SELECT id,participant_id,session_role_id,seat_id FROM runtime.seat_assignments WHERE organization_id=$1 AND session_id=$2 AND valid_to IS NULL ORDER BY id",
    [context.organizationId, context.sessionId]);
  const eligible = assignments.rows.filter((assignment) => {
    const seat = release.seats.find(({ id }) => id === assignment.seat_id);
    return (poll.scope !== "team" || seat?.teamId === poll.scopeReference) &&
      policyAllows(release, poll.electoratePolicyId, context, assignment.session_role_id, assignment.participant_id, assignment.seat_id ?? undefined);
  });
  if (eligible.length === 0) return fail("VALIDATION_FAILED", "The Electorate is empty.");
  const electorate = eligible.map((assignment) => ({ seatAssignmentId: assignment.id,
    weight: poll.weights.find(({ seatId }) => seatId === assignment.seat_id)?.weight ?? 1,
    veto: poll.vetoRule.holderSeatIds.includes(assignment.seat_id ?? "") }));
  const definitionSha = digest(poll as unknown as JsonValue), electorateSha = digest(electorate as unknown as JsonValue);
  const deadline = poll.closeTrigger.mode === "scheduled" && Number.isSafeInteger(poll.closeTrigger.offsetSeconds)
    ? new Date(Date.now() + (Number(poll.closeTrigger.offsetSeconds) + poll.deadlinePolicy.graceSeconds) * 1000) : null;
  await client.query(`INSERT INTO voting.polls
    (id,organization_id,session_id,governing_release_id,definition_id,definition_revision,definition,definition_sha256,electorate_sha256,
     status,opened_at,deadline_at,version,authority_epoch,created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,'configured',transaction_timestamp(),$10,0,$11,$12)`,
    [command.aggregateId, context.organizationId, context.sessionId, activeReleaseId, poll.id, revision, JSON.stringify(poll), definitionSha,
      electorateSha, deadline, context.authorityEpoch, context.principalId]);
  for (const [ordinal, option] of poll.options.entries()) await client.query(
    "INSERT INTO voting.poll_options(organization_id,poll_id,option_id,label,ordinal) VALUES ($1,$2,$3,$4,$5)",
    [context.organizationId, command.aggregateId, option.id, option.label, ordinal]);
  for (const member of electorate) await client.query(`INSERT INTO voting.electorate_members
    (id,organization_id,session_id,poll_id,seat_assignment_id,ballot_capability,weight,veto,policy_snapshot_sha256)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [randomUUID(), context.organizationId, context.sessionId, command.aggregateId,
    member.seatAssignmentId, randomUUID(), member.weight, member.veto, electorateSha]);
  await client.query("UPDATE voting.polls SET status='open',version=1,updated_at=transaction_timestamp() WHERE organization_id=$1 AND id=$2",
    [context.organizationId, command.aggregateId]);
  return { status: "accepted", aggregateVersion: 1, eventType: "poll.opened", eventPayload: { pollId: command.aggregateId,
    definitionId: poll.id, definitionRevision: revision, definitionSha256: definitionSha, electorateSha256: electorateSha,
    electorateSize: electorate.length, deadlineAt: deadline?.toISOString() ?? null } };
}

async function castBallot({ client, context, command }: CommandExecutionContext, row: PollRow): Promise<CommandDecision> {
  const version = Number(row.version);
  if (command.governingReleaseId !== row.governing_release_id) return fail("INCOMPATIBLE_RELEASE", "The Poll is governed by another Release.", true);
  if (row.status !== "open" || (row.deadline_at !== null && row.deadline_at.getTime() < Date.now()))
    return fail(row.status === "closed" || row.deadline_at !== null ? "DEADLINE_EXPIRED" : "INVALID_TRANSITION", "The Poll is not accepting Ballots.");
  if (command.expectedAggregateVersion !== version) return fail("STALE_AGGREGATE_VERSION", `The Poll is at version ${version}.`, true);
  const selected = choices(command.payload.optionIds), capability = command.payload.ballotCapability;
  if (Number(command.payload.pollDefinitionRevision) !== row.definition_revision || typeof capability !== "string" ||
      selected === undefined || !validChoices(row.definition, selected)) return fail("VALIDATION_FAILED", "The Ballot does not match the frozen Poll Definition.");
  const memberResult = await client.query<{ id: string; seat_assignment_id: string }>(`SELECT member.id,member.seat_assignment_id
    FROM voting.electorate_members member JOIN runtime.seat_assignments assignment
      ON assignment.organization_id=member.organization_id AND assignment.id=member.seat_assignment_id
    WHERE member.organization_id=$1 AND member.poll_id=$2 AND member.ballot_capability=$3 AND member.status='eligible'
      AND assignment.participant_id=$4 AND assignment.session_role_id=$5 AND assignment.valid_to IS NULL`,
    [context.organizationId, row.id, capability, context.participantId, context.activeSessionRoleId]);
  const member = memberResult.rows[0];
  if (member === undefined) return fail("PERMISSION_DENIED", "The Participant is not in the frozen Electorate.");
  const prior = await client.query<{ ballot_revision: number }>(`SELECT ballot_revision FROM voting.ballot_receipts
    WHERE organization_id=$1 AND poll_id=$2 AND seat_assignment_id=$3 AND is_current FOR UPDATE`,
    [context.organizationId, row.id, member.seat_assignment_id]);
  if (prior.rowCount !== 0 && !row.definition.allowRevote) return fail("ALREADY_VOTED", "This Seat Assignment already cast a Ballot.");
  if (prior.rowCount !== 0) await client.query("UPDATE voting.ballot_receipts SET status='superseded',is_current=false WHERE organization_id=$1 AND poll_id=$2 AND seat_assignment_id=$3 AND is_current",
    [context.organizationId, row.id, member.seat_assignment_id]);
  const sequenceResult = await client.query<{ next_sequence: string }>("SELECT next_sequence FROM evidence.session_sequences WHERE organization_id=$1 AND session_id=$2",
    [context.organizationId, context.sessionId]);
  const sequence = Number(sequenceResult.rows[0]?.next_sequence);
  if (!Number.isSafeInteger(sequence)) throw new Error("Session evidence sequence is missing");
  const ballotId = randomUUID(), receiptId = randomUUID(), ballotRevision = Number(prior.rows[0]?.ballot_revision ?? 0) + 1;
  await client.query(`INSERT INTO voting.ballots(id,organization_id,session_id,poll_id,ballot_revision,choices,accepted_sequence)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`, [ballotId, context.organizationId, context.sessionId, row.id, ballotRevision, JSON.stringify(selected), sequence]);
  await client.query(`INSERT INTO voting.ballot_receipts
    (id,organization_id,session_id,poll_id,command_id,seat_assignment_id,eligibility_consumption_id,ballot_id,ballot_revision,status,is_current,revote_allowed,accepted_sequence)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'accepted',true,$10,$11)`, [receiptId, context.organizationId, context.sessionId, row.id,
    command.commandId, member.seat_assignment_id, member.id, ballotId, ballotRevision, row.definition.allowRevote, sequence]);
  return { status: "accepted", aggregateVersion: version, eventType: "ballot.accepted", eventPayload: {
    contractId: BALLOT_COMMAND_CONTRACT_ID, pollId: row.id, receiptId, ballotRevision } };
}

async function ballots(client: PoolClient, context: SessionAccessContextV1, pollId: string): Promise<BallotForTally[]> {
  return (await client.query<BallotForTally>(`SELECT ballot.id,ballot.ballot_revision,ballot.choices,ballot.accepted_sequence,member.weight,member.veto
    FROM voting.ballot_receipts receipt JOIN voting.ballots ballot ON ballot.organization_id=receipt.organization_id AND ballot.id=receipt.ballot_id
    JOIN voting.electorate_members member ON member.organization_id=receipt.organization_id AND member.id=receipt.eligibility_consumption_id
    WHERE receipt.organization_id=$1 AND receipt.poll_id=$2 AND receipt.is_current ORDER BY ballot.accepted_sequence,ballot.id`,
    [context.organizationId, pollId])).rows;
}

async function managePoll({ client, context, command }: CommandExecutionContext, row: PollRow): Promise<CommandDecision> {
  const version = Number(row.version), next = version + 1;
  if (command.governingReleaseId !== row.governing_release_id) return fail("INCOMPATIBLE_RELEASE", "The Poll is governed by another Release.", true);
  if (command.expectedAggregateVersion !== version) return fail("STALE_AGGREGATE_VERSION", `The Poll is at version ${version}.`, true);
  if (!canCertify(row.definition, context)) return fail("PERMISSION_DENIED", "The Active Role Context cannot manage this Poll.");
  if (command.operationType === "poll.close") {
    if (row.status !== "open") return fail("INVALID_TRANSITION", "Only an open Poll can close.");
    await client.query("UPDATE voting.polls SET status='closed',closed_at=transaction_timestamp(),version=$3,updated_at=transaction_timestamp() WHERE organization_id=$1 AND id=$2",
      [context.organizationId, row.id, next]);
    return { status: "accepted", aggregateVersion: next, eventType: "poll.closed", eventPayload: { pollId: row.id } };
  }
  if (command.operationType === "poll.tally") {
    if (row.status !== "closed") return fail("INVALID_TRANSITION", "Only a closed Poll can be tallied.");
    if (row.definition.tallyMethod !== "builtin_count") return fail("CAPABILITY_UNAVAILABLE", "The configured Voting Method Adapter is unavailable.");
    const electorateSize = Number((await client.query<{ count: string }>("SELECT count(*) AS count FROM voting.electorate_members WHERE organization_id=$1 AND poll_id=$2",
      [context.organizationId, row.id])).rows[0]?.count ?? 0);
    const tally = computeBuiltInTally(row.definition, await ballots(client, context, row.id), electorateSize), tallyId = randomUUID();
    await client.query(`INSERT INTO voting.tallies
      (id,organization_id,session_id,poll_id,poll_revision,ballot_set_sha256,result_sha256,method,method_version,counts,outcome,computed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'builtin_count',$8,$9::jsonb,$10::jsonb,$11)`, [tallyId, context.organizationId,
      context.sessionId, row.id, row.definition_revision, tally.ballotSetSha256, tally.resultSha256, tally.methodVersion,
      JSON.stringify(tally.counts), JSON.stringify({ electorateSize: tally.electorateSize, participationCount: tally.participationCount,
        quorumMet: tally.quorumMet, winningOptionIds: tally.winningOptionIds, tied: tally.tied, vetoExercised: tally.vetoExercised, passed: tally.passed }), tally.computedAt]);
    await client.query("UPDATE voting.polls SET status='tallied',tallied_at=$3,version=$4,updated_at=transaction_timestamp() WHERE organization_id=$1 AND id=$2",
      [context.organizationId, row.id, tally.computedAt, next]);
    return { status: "accepted", aggregateVersion: next, eventType: "poll.tallied", eventPayload: { pollId: row.id, tallyId,
      ballotSetSha256: tally.ballotSetSha256, resultSha256: tally.resultSha256, method: tally.method, methodVersion: tally.methodVersion } };
  }
  if (command.operationType === "poll.certify" || command.operationType === "poll.correct") {
    const correction = command.operationType === "poll.correct";
    if ((!correction && row.status !== "tallied") || (correction && !["certified", "correction_issued"].includes(row.status)))
      return fail("INVALID_TRANSITION", correction ? "Only a certified Poll can be corrected." : "Only a tallied Poll can be certified.");
    const tally = (await client.query<{ id: string; result_sha256: string; method_version: string }>(
      "SELECT id,result_sha256,method_version FROM voting.tallies WHERE organization_id=$1 AND poll_id=$2 AND poll_revision=$3",
      [context.organizationId, row.id, row.definition_revision])).rows[0];
    if (tally === undefined || command.payload.resultSha256 !== tally.result_sha256) return fail("VALIDATION_FAILED", "The Certification result hash does not match the Tally.");
    const reason = correction && typeof command.payload.reason === "string" && command.payload.reason.trim() !== "" ? command.payload.reason.trim() : null;
    if (correction && reason === null) return fail("VALIDATION_FAILED", "A correction reason is required.");
    const current = await client.query<{ id: string }>(`SELECT id FROM voting.certifications
      WHERE organization_id=$1 AND poll_id=$2 AND poll_revision=$3 AND is_current FOR UPDATE`,
      [context.organizationId, row.id, row.definition_revision]);
    if (!correction && current.rowCount !== 0) return fail("STALE_AGGREGATE_VERSION", "The Poll already has a current Certification.", true);
    if (correction) await client.query("UPDATE voting.certifications SET is_current=false WHERE organization_id=$1 AND id=$2",
      [context.organizationId, current.rows[0]?.id]);
    const certificationId = randomUUID();
    await client.query(`INSERT INTO voting.certifications
      (id,organization_id,session_id,poll_id,poll_revision,tally_id,result_sha256,method_version,certifier_person_id,
       certifier_participant_id,certifier_session_role_id,authority_epoch,corrects_certification_id,reason)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [certificationId, context.organizationId, context.sessionId,
      row.id, row.definition_revision, tally.id, tally.result_sha256, tally.method_version, context.principalId, context.participantId,
      context.activeSessionRoleId, context.authorityEpoch, current.rows[0]?.id ?? null, reason]);
    await client.query("UPDATE voting.polls SET status=$3,certified_at=transaction_timestamp(),version=$4,updated_at=transaction_timestamp() WHERE organization_id=$1 AND id=$2",
      [context.organizationId, row.id, correction ? "correction_issued" : "certified", next]);
    return { status: "accepted", aggregateVersion: next, eventType: correction ? "poll.corrected" : "poll.certified", eventPayload: {
      contractId: CERTIFICATION_CONTRACT_ID, pollId: row.id, certificationId, resultSha256: tally.result_sha256,
      methodVersion: tally.method_version, correctsCertificationId: current.rows[0]?.id ?? null, reason } };
  }
  if (command.operationType === "poll.void") {
    if (["voided", "certified", "correction_issued"].includes(row.status)) return fail("INVALID_TRANSITION", "This Poll cannot be voided.");
    const reason = typeof command.payload.reason === "string" ? command.payload.reason.trim() : "";
    if (reason === "") return fail("VALIDATION_FAILED", "A void reason is required.");
    await client.query("UPDATE voting.polls SET status='voided',version=$3,updated_at=transaction_timestamp() WHERE organization_id=$1 AND id=$2",
      [context.organizationId, row.id, next]);
    return { status: "accepted", aggregateVersion: next, eventType: "poll.voided", eventPayload: { pollId: row.id, reason } };
  }
  return fail("INVALID_TRANSITION", "The Poll Command is not supported.");
}

export async function executeVotingCommand(input: CommandExecutionContext): Promise<CommandDecision> {
  if (input.command.operationType === "poll.open") return openPoll(input);
  const poll = await readPoll(input.client, input.context, input.command.aggregateId, true);
  if (poll === undefined) return fail("TARGET_NOT_FOUND", "The Poll was not found.");
  return input.command.operationType === "ballot.cast" ? castBallot(input, poll) : managePoll(input, poll);
}

async function tally(client: PoolClient, context: SessionAccessContextV1, poll: PollRow): Promise<RuntimePollTallyV1 | null> {
  const row = (await client.query<{ ballot_set_sha256: string; result_sha256: string; method: "builtin_count"; method_version: string;
    counts: Record<string, number>; outcome: Omit<RuntimePollTallyV1, "ballotSetSha256" | "resultSha256" | "method" | "methodVersion" | "counts" | "computedAt">; computed_at: Date }>(
    "SELECT ballot_set_sha256,result_sha256,method,method_version,counts,outcome,computed_at FROM voting.tallies WHERE organization_id=$1 AND poll_id=$2 AND poll_revision=$3",
    [context.organizationId, poll.id, poll.definition_revision])).rows[0];
  return row === undefined ? null : { ballotSetSha256: row.ballot_set_sha256, resultSha256: row.result_sha256, method: row.method,
    methodVersion: row.method_version, counts: row.counts, ...row.outcome, computedAt: row.computed_at.toISOString() };
}
async function certification(client: PoolClient, context: SessionAccessContextV1, poll: PollRow): Promise<CertificationV1 | null> {
  const row = (await client.query<{ id: string; result_sha256: string; method_version: string; certified_at: Date;
    corrects_certification_id: string | null; reason: string | null }>(`SELECT id,result_sha256,method_version,certified_at,corrects_certification_id,reason
    FROM voting.certifications WHERE organization_id=$1 AND poll_id=$2 AND poll_revision=$3 AND is_current`,
    [context.organizationId, poll.id, poll.definition_revision])).rows[0];
  return row === undefined ? null : { contractId: CERTIFICATION_CONTRACT_ID, id: row.id, resultSha256: row.result_sha256,
    methodVersion: row.method_version, certifiedAt: row.certified_at.toISOString(), correctsCertificationId: row.corrects_certification_id, reason: row.reason };
}

export async function getPollProjection(client: PoolClient, context: SessionAccessContextV1): Promise<RuntimePollV1[]> {
  const release = await readDefinition(client, context.organizationId, context.activeReleaseId);
  const rows = (await client.query<PollRow>(`SELECT id,governing_release_id,definition_id,definition_revision,definition,status,deadline_at,version
    FROM voting.polls WHERE organization_id=$1 AND session_id=$2 AND status NOT IN ('draft','configured','scheduled','cancelled') ORDER BY created_at,id`,
    [context.organizationId, context.sessionId])).rows;
  return Promise.all(rows.map(async (row) => {
    const governingRelease = row.governing_release_id === context.activeReleaseId ? release :
      await readDefinition(client, context.organizationId, row.governing_release_id);
    const manage = canCertify(row.definition, context);
    const member = (await client.query<{ ballot_capability: string }>(`SELECT member.ballot_capability FROM voting.electorate_members member
      JOIN runtime.seat_assignments assignment ON assignment.organization_id=member.organization_id AND assignment.id=member.seat_assignment_id
      WHERE member.organization_id=$1 AND member.poll_id=$2 AND assignment.participant_id=$3 AND assignment.session_role_id=$4 AND assignment.valid_to IS NULL`,
      [context.organizationId, row.id, context.participantId, context.activeSessionRoleId])).rows[0];
    const receipt = (await client.query<{ command_id: string; accepted_at: Date; ballot_revision: number }>(`SELECT receipt.command_id,receipt.accepted_at,receipt.ballot_revision
      FROM voting.ballot_receipts receipt JOIN runtime.seat_assignments assignment ON assignment.organization_id=receipt.organization_id AND assignment.id=receipt.seat_assignment_id
      WHERE receipt.organization_id=$1 AND receipt.poll_id=$2 AND receipt.is_current AND assignment.participant_id=$3 AND assignment.session_role_id=$4`,
      [context.organizationId, row.id, context.participantId, context.activeSessionRoleId])).rows[0];
    const released = ["certified", "correction_issued"].includes(row.status) &&
      policyAllows(governingRelease, row.definition.resultVisibilityPolicyId, context, context.activeSessionRoleId, context.participantId, context.seatId);
    return { id: row.id, definitionId: row.definition_id, definitionRevision: row.definition_revision, question: row.definition.question,
      options: row.definition.options, pollType: row.definition.pollType, minSelections: row.definition.minSelections ?? null,
      maxSelections: row.definition.maxSelections ?? null, secrecy: row.definition.secrecy, status: row.status, version: Number(row.version),
      governingReleaseId: row.governing_release_id, deadlineAt: row.deadline_at?.toISOString() ?? null, eligible: member !== undefined,
      hasVoted: receipt !== undefined, ballotCapability: member?.ballot_capability ?? null,
      receipt: receipt === undefined ? null : { commandId: receipt.command_id, acceptedAt: receipt.accepted_at.toISOString(), ballotRevision: receipt.ballot_revision },
      canManage: manage, canCertify: manage, tally: manage || released ? await tally(client, context, row) : null,
      certification: manage || released ? await certification(client, context, row) : null };
  }));
}

export const getPolls = (pool: Pool, context: SessionAccessContextV1) => withOrganizationTransaction(pool, context.organizationId,
  async (client) => ({ polls: await getPollProjection(client, context) }));
export async function getPoll(pool: Pool, context: SessionAccessContextV1, id: string, correlationId: string): Promise<RuntimePollV1> {
  const poll = (await getPolls(pool, context)).polls.find((candidate) => candidate.id === id);
  if (poll === undefined) throw authorizationError("NOT_FOUND", "The Poll was not found.", correlationId);
  return poll;
}
export async function getMyReceipt(pool: Pool, context: SessionAccessContextV1, id: string, correlationId: string) {
  const receipt = (await getPoll(pool, context, id, correlationId)).receipt;
  if (receipt === null) throw authorizationError("NOT_FOUND", "No Ballot receipt was found.", correlationId);
  return receipt;
}
export async function getPollResult(pool: Pool, context: SessionAccessContextV1, id: string, correlationId: string) {
  const poll = await getPoll(pool, context, id, correlationId);
  if (poll.tally === null || poll.certification === null) throw authorizationError("RESULT_NOT_RELEASED", "The certified Poll result is not available.", correlationId);
  return { pollId: id, tally: poll.tally, certification: poll.certification };
}
export async function getPollAudit(pool: Pool, context: SessionAccessContextV1, id: string, correlationId: string) {
  const poll = await getPoll(pool, context, id, correlationId);
  if (!poll.canCertify) throw authorizationError("PERMISSION_DENIED", "Poll audit requires certification permission.", correlationId);
  return withOrganizationTransaction(pool, context.organizationId, async (client) => {
    const row = await readPoll(client, context, id);
    if (row === undefined) throw authorizationError("NOT_FOUND", "The Poll was not found.", correlationId);
    const chain = (await client.query<{ id: string; result_sha256: string; method_version: string; certified_at: Date;
      corrects_certification_id: string | null; reason: string | null; is_current: boolean }>(`SELECT id,result_sha256,method_version,certified_at,
      corrects_certification_id,reason,is_current FROM voting.certifications WHERE organization_id=$1 AND poll_id=$2 ORDER BY certified_at,id`,
      [context.organizationId, id])).rows;
    return { pollId: id, definitionSha256: digest(row.definition as unknown as JsonValue), tally: await tally(client, context, row),
      certifications: chain.map((item) => ({ id: item.id, resultSha256: item.result_sha256, methodVersion: item.method_version,
        certifiedAt: item.certified_at.toISOString(), correctsCertificationId: item.corrects_certification_id, reason: item.reason, current: item.is_current })) };
  });
}
