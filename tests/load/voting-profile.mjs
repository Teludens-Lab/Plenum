import assert from "node:assert/strict";

import { submitRuntimeCommand } from "../../apps/server/dist/index.js";
import {
  acceptance, actorContext, command, config, databaseSize, environment, fixture, latencyMetric,
  observeDatabaseRecovery, performance, randomUUID, round, runConcurrent, seedReferenceWorkload,
  startSaturationSampler
} from "./load-support.mjs";

const accepted = ({ ok, value }) => ok && value.status === "accepted";

export async function runVotingProfile(pool) {
  const started = performance.now();
  const bytesBefore = await databaseSize(pool);
  const workload = await seedReferenceWorkload(pool);
  let phase = "open";
  const stopSampler = startSaturationSampler(pool, () => phase);
  const polls = workload.sessions.map((session) => ({
    session,
    pollId: randomUUID(),
    control: session.actors.find(({ sessionRoleId }) => sessionRoleId === "white_cell")
  }));
  assert.equal(polls.every(({ control }) => control !== undefined), true);

  const opened = await runConcurrent(polls, config.sessions, ({ control, pollId }) =>
    submitRuntimeCommand(pool, actorContext(control), command(control, "poll.open", pollId, 0,
      { definitionId: "synthetic-resolution", definitionRevision: 1 }), randomUUID(), fixture.deploymentId));
  assert.equal(opened.every(accepted), true, opened.find((result) => !accepted(result))?.error);

  const members = (await pool.query(`SELECT member.poll_id,member.ballot_capability,assignment.id AS assignment_id
    FROM voting.electorate_members member
    JOIN runtime.seat_assignments assignment ON assignment.organization_id=member.organization_id
      AND assignment.id=member.seat_assignment_id
    WHERE member.poll_id=ANY($1::uuid[])`, [polls.map(({ pollId }) => pollId)])).rows;
  const actors = new Map(workload.allActors.map((actor) => [actor.assignmentId, actor]));
  const ballotsByPoll = polls.map(({ pollId }) => members.filter((member) => member.poll_id === pollId)
    .map((member, index) => ({ actor: actors.get(member.assignment_id), pollId, capability: member.ballot_capability,
      optionId: index % 5 === 0 ? "no" : "yes" })));
  const ballots = ballotsByPoll[0].flatMap((_, index) => ballotsByPoll.map((items) => items[index]));
  assert.equal(ballots.length, config.sessions * config.voting.ballotsPerSession);
  assert.equal(ballots.every(({ actor }) => actor !== undefined), true);
  phase = "ballots";
  const cast = await runConcurrent(ballots, config.voting.concurrency, ({ actor, pollId, capability, optionId }) =>
    submitRuntimeCommand(pool, actorContext(actor), command(actor, "ballot.cast", pollId, 1,
      { pollDefinitionRevision: 1, ballotCapability: capability, optionIds: [optionId] }), randomUUID(), fixture.deploymentId));
  assert.equal(cast.every(accepted), true, cast.find((result) => !accepted(result))?.error);

  const duplicate = ballots[0];
  const duplicateResult = await submitRuntimeCommand(pool, actorContext(duplicate.actor), command(duplicate.actor,
    "ballot.cast", duplicate.pollId, 1, { pollDefinitionRevision: 1, ballotCapability: duplicate.capability,
      optionIds: ["yes"] }), randomUUID(), fixture.deploymentId);
  assert.equal(duplicateResult.errorCode, "ALREADY_VOTED");

  const certification = [];
  let late;
  phase = "certification";
  for (const [pollIndex, { control, pollId }] of polls.entries()) {
    const close = await submitRuntimeCommand(pool, actorContext(control), command(control, "poll.close", pollId, 1, {}), randomUUID(), fixture.deploymentId);
    assert.equal(close.status, "accepted");
    const closedAt = performance.now();
    if (pollIndex === 0) {
      const ballot = ballots.find((item) => item.pollId === pollId);
      late = await submitRuntimeCommand(pool, actorContext(ballot.actor), command(ballot.actor, "ballot.cast", pollId, 2,
        { pollDefinitionRevision: 1, ballotCapability: ballot.capability, optionIds: ["yes"] }), randomUUID(), fixture.deploymentId);
      assert.equal(late.errorCode, "DEADLINE_EXPIRED");
    }
    const tally = await submitRuntimeCommand(pool, actorContext(control), command(control, "poll.tally", pollId, 2, {}), randomUUID(), fixture.deploymentId);
    assert.equal(tally.status, "accepted");
    const resultSha256 = (await pool.query("SELECT result_sha256 FROM voting.tallies WHERE organization_id=$1 AND poll_id=$2",
      [fixture.organizationId, pollId])).rows[0]?.result_sha256;
    assert.match(resultSha256, /^[0-9a-f]{64}$/u);
    const certified = await submitRuntimeCommand(pool, actorContext(control), command(control, "poll.certify", pollId, 3,
      { resultSha256 }), randomUUID(), fixture.deploymentId);
    assert.equal(certified.status, "accepted");
    certification.push({ ok: true, milliseconds: performance.now() - closedAt });
  }
  assert.equal(late?.errorCode, "DEADLINE_EXPIRED");

  const integrity = (await pool.query(`SELECT
    (SELECT count(*)::int FROM voting.ballots WHERE poll_id=ANY($1::uuid[])) AS ballots,
    (SELECT count(*)::int FROM voting.ballot_receipts WHERE poll_id=ANY($1::uuid[]) AND is_current) AS receipts,
    (SELECT count(*)::int FROM voting.certifications WHERE poll_id=ANY($1::uuid[]) AND is_current) AS certifications,
    (SELECT count(*)::int FROM evidence.events WHERE event_type='ballot.accepted' AND session_id=ANY($2::uuid[])
      AND body ? 'optionIds') AS leaked_ballot_choices`, [polls.map(({ pollId }) => pollId), workload.sessions.map(({ sessionId }) => sessionId)])).rows[0];
  assert.deepEqual(integrity, { ballots: ballots.length, receipts: ballots.length, certifications: polls.length, leaked_ballot_choices: 0 });
  const databaseRecovery = await observeDatabaseRecovery(pool);
  const saturation = await stopSampler();
  const bytesAfter = await databaseSize(pool);
  return {
    contractId: "load-profile-v1", profile: "voting", testId: "VOTE-14", status: "MEASURED",
    generatedAt: new Date().toISOString(), environment: await environment(pool),
    conditions: { seed: config.seed, sessions: config.sessions, electoratePerSession: config.participantsPerSession,
      ballots: ballots.length, concurrency: config.voting.concurrency },
    latencyMs: { ballotReceipt: latencyMetric(cast), certificationAfterClose: latencyMetric(certification) },
    integrity: { ...integrity, duplicateBallotError: duplicateResult.errorCode, lateBallotError: late.errorCode,
      lostAcceptedBallots: 0, duplicateAcceptedBallots: 0 },
    failureRecovery: { databaseBackend: databaseRecovery }, saturation,
    cost: { wallSeconds: round((performance.now() - started) / 1000), databaseGrowthMiB: round((bytesAfter - bytesBefore) / 1024 ** 2), externalSpendUsd: 0 },
    acceptance: acceptance()
  };
}
