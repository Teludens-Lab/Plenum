import { createHash } from "node:crypto";

const stable = (value) => value === null || typeof value !== "object" ? JSON.stringify(value) :
  Array.isArray(value) ? `[${value.map(stable).join(",")}]` :
    `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
const digest = (value) => createHash("sha256").update(stable(value)).digest("hex");
const copy = (value) => structuredClone(value);

export function reviewPliSeat(packet, input) {
  const before = copy(packet);
  const seat = before.seats?.[input.seatKey];
  if (seat === undefined) throw new Error("TARGET_NOT_FOUND");
  if (input.actorSessionRoleId !== seat.assignedSessionRoleId) throw new Error("PERMISSION_DENIED");
  if (seat.status === "finalized") throw new Error("INVALID_TRANSITION");
  if (input.decision === "override" && (typeof input.rationale !== "string" || input.rationale.trim().length < 3)) {
    throw new Error("RATIONALE_REQUIRED");
  }
  if (!new Set(["accept", "override"]).has(input.decision)) throw new Error("VALIDATION_FAILED");
  const reviewed = {
    ...seat,
    status: "finalized",
    finalValue: input.decision === "override" ? input.overrideValue : seat.engineValue,
    decision: input.decision,
    rationale: input.decision === "override" ? input.rationale.trim() : null
  };
  const seats = { ...before.seats, [input.seatKey]: reviewed };
  const result = { ...before, seats, macroUnlocked: input.seatKey === "macro" || before.macroUnlocked };
  return { packet: result, inputSha256: digest(input), outputSha256: digest(result) };
}

export function projectPliPacket(packet, actorSessionRoleId) {
  const matchingSeat = Object.values(packet.seats).find((seat) => seat.assignedSessionRoleId === actorSessionRoleId);
  return { packet: copy(packet), readOnly: matchingSeat === undefined, reviewSeatKey: matchingSeat?.key ?? null };
}

export function finalizePliCopyPacket(packet) {
  const seats = Object.values(packet.seats);
  if (!packet.macroUnlocked || seats.length === 0 || seats.some(({ status }) => status !== "finalized")) {
    throw new Error("FINALIZATION_INCOMPLETE");
  }
  const payload = {
    contractId: "pli-copy-packet-v1",
    packetId: packet.id,
    outputs: Object.fromEntries(seats.map((seat) => [seat.key, seat.finalValue])),
    reviews: seats.map((seat) => ({ seatKey: seat.key, decision: seat.decision, rationale: seat.rationale }))
  };
  return { ...payload, sha256: digest(payload) };
}
