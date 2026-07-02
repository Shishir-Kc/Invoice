/** Shared time helpers. All timestamps are ISO-8601 UTC strings. */

export function nowISO(): string {
  return new Date().toISOString();
}

/** Parse a stored ISO string to a UTC-aware epoch-ms number for comparison.
 *  Returns NaN for null/empty. */
export function toUTCMillis(iso: string | null | undefined): number {
  if (!iso) return NaN;
  const ms = Date.parse(iso);
  return ms;
}

export function isExpired(iso: string | null | undefined): boolean {
  if (!iso) return false; // NULL = never expires
  const ms = toUTCMillis(iso);
  if (Number.isNaN(ms)) return false;
  return ms <= Date.now();
}

export function addSecondsISO(iso: string | null | undefined, seconds: number): string {
  const baseMs = iso && !isExpired(iso) ? toUTCMillis(iso) : Date.now();
  return new Date(baseMs + seconds * 1000).toISOString();
}

export function fromMaybeISO(iso: string | null | undefined): string {
  return iso ?? "";
}
