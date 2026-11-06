import { readFile } from "node:fs/promises";

const emailPattern = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u;
const senderPattern = /^.{1,80}<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$/u;

const requiredKeys = Object.freeze([
  "ALERT_RECIPIENT",
  "DATABASE_PASSWORD",
  "POSTMARK_FROM",
  "POSTMARK_SERVER_TOKEN"
]);
const optionalKeys = Object.freeze(["POSTMARK_MESSAGE_STREAM"]);

export function parseOperationsSecretBundle(raw) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("The operations secret bundle must be valid JSON.");
  }
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("The operations secret bundle must be a JSON object.");
  }
  const unknown = Object.keys(value).filter((key) => !requiredKeys.includes(key) && !optionalKeys.includes(key));
  if (unknown.length > 0) throw new Error(`Unknown operations secret keys: ${unknown.sort().join(", ")}`);
  const missing = requiredKeys.filter((key) => typeof value[key] !== "string" || value[key].trim() === "");
  if (missing.length > 0) throw new Error(`Missing operations secret keys: ${missing.join(", ")}`);
  if (value.DATABASE_PASSWORD.length < 32) throw new Error("The operations database password is too short.");
  if (value.POSTMARK_SERVER_TOKEN.length < 16) throw new Error("The Postmark server token is too short.");
  if (!senderPattern.test(value.POSTMARK_FROM)) throw new Error("POSTMARK_FROM must include a display name and verified address.");
  if (!emailPattern.test(value.ALERT_RECIPIENT)) throw new Error("ALERT_RECIPIENT must be one email address.");
  const messageStream = value.POSTMARK_MESSAGE_STREAM?.trim() || "outbound";
  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/u.test(messageStream)) throw new Error("POSTMARK_MESSAGE_STREAM is invalid.");
  return Object.freeze({
    ALERT_RECIPIENT: value.ALERT_RECIPIENT.trim().toLowerCase(),
    DATABASE_PASSWORD: value.DATABASE_PASSWORD,
    POSTMARK_FROM: value.POSTMARK_FROM.trim(),
    POSTMARK_SERVER_TOKEN: value.POSTMARK_SERVER_TOKEN,
    POSTMARK_MESSAGE_STREAM: messageStream
  });
}

export async function readOperationsSecretBundle(path = "/run/secrets/operations.json") {
  return parseOperationsSecretBundle(await readFile(path, "utf8"));
}
