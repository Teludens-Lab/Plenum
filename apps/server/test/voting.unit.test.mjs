import assert from "node:assert/strict";
import test from "node:test";
import { computeBuiltInTally } from "../dist/index.js";

const poll = {
  id: "vote-fixture", scope: "session", question: "Adopt the resolution?",
  options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }, { id: "abstain", label: "Abstain" }],
  pollType: "yes_no_abstain", tallyMethod: "builtin_count", tallyMethodVersion: "builtin-count-v1",
  electoratePolicyId: "electorate", oneBallotPer: "seat_assignment", allowRevote: false, secrecy: "open",
  thresholdRule: { kind: "simple_majority", denominator: "valid_votes", abstentionCountsTowardDenominator: false },
  quorumRule: { basis: "electorate_at_open", minimum: 3, abstentionCountsTowardParticipation: true },
  weights: [], vetoRule: { holderSeatIds: ["seat-veto"] }, tieRule: "no_decision",
  openTrigger: { mode: "manual" }, closeTrigger: { mode: "manual" }, deadlinePolicy: { graceSeconds: 0 },
  resultVisibilityPolicyId: "results", certificationPolicy: { certifierSessionRoleIds: ["control"] }
};
const ballot = (id, sequence, choice, weight = 1, veto = false) => ({ id, ballot_revision: 1, choices: [choice],
  accepted_sequence: String(sequence), weight: String(weight), veto });

test("VOTE-07 deterministically applies weight, quorum, veto and tie rules", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const source = [ballot("b", 2, "no"), ballot("a", 1, "yes", 2)];
  const first = computeBuiltInTally(poll, source, 3, now);
  const recount = computeBuiltInTally(poll, [...source].reverse(), 3, now);
  assert.deepEqual(first.counts, { yes: 2, no: 1, abstain: 0 });
  assert.equal(first.quorumMet, true);
  assert.equal(first.passed, true);
  assert.equal(first.ballotSetSha256, recount.ballotSetSha256);
  assert.equal(first.resultSha256, recount.resultSha256);

  const vetoed = computeBuiltInTally(poll, [ballot("a", 1, "yes", 3), ballot("b", 2, "no", 1, true)], 4, now);
  assert.equal(vetoed.vetoExercised, true);
  assert.equal(vetoed.passed, false);

  const tied = computeBuiltInTally({ ...poll, quorumRule: { ...poll.quorumRule, minimum: 2 } },
    [ballot("a", 1, "yes"), ballot("b", 2, "no")], 2, now);
  assert.equal(tied.tied, true);
  assert.equal(tied.passed, false);
});
