/** Minutes are a display unit; Stage Commands still carry whole seconds. */
export function extensionSeconds(minutes: string): number {
  const value = Number(minutes);
  const seconds = value * 60;
  if (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(seconds)) {
    throw new Error("Enter additional minutes that resolve to a whole number of seconds.");
  }
  return seconds;
}
