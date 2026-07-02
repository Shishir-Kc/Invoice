export const UNIT_SECONDS: Record<string, number> = {
  hour: 3600,
  day: 86400,
  week: 7 * 86400,
  year: 365 * 86400,
};

export const VALID_UNITS = new Set(Object.keys(UNIT_SECONDS));

/** Convert a (amount, unit) duration to seconds. Throws on bad unit/amount. */
export function durationToSeconds(amount: number, unit: string): number {
  if (!UNIT_SECONDS[unit]) {
    throw new Error(
      `Invalid duration unit '${unit}'. Must be one of: ${[...VALID_UNITS].sort().join(", ")}`,
    );
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Duration amount must be positive");
  }
  return Math.floor(amount) * UNIT_SECONDS[unit];
}
