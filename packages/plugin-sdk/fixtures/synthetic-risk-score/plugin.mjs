// Synthetic fixture only; it is not a production model or PLI implementation.
export function execute(input) {
  return { syntheticScore: Math.min(100, input.pressure + (input.seed % 7)) };
}
