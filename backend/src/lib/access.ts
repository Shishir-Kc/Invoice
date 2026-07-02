import type { User } from "../db/schema";
import { UNIT_SECONDS, durationToSeconds } from "./durations";
import { addSecondsISO, isExpired } from "./time";

/** Official members joined via HYPER (have a hyper_id). They are admins. */
export function isOfficial(user: Pick<User, "hyperId">): boolean {
  return !!user.hyperId;
}

/** Whether a user may access Invoicely right now. */
export function hasAccess(user: Pick<User, "hyperId" | "isKicked" | "accessExpiresAt">): boolean {
  if (isOfficial(user)) return true;
  if (user.isKicked) return false;
  if (user.accessExpiresAt == null) return true; // permanent unofficial
  return !isExpired(user.accessExpiresAt);
}

/** Human-readable access status for display. */
export function accessStatus(
  user: Pick<User, "hyperId" | "isKicked" | "accessExpiresAt">,
): "official" | "active" | "expired" | "banned" | "permanent" {
  if (isOfficial(user)) return "official";
  if (user.isKicked) return "banned";
  if (user.accessExpiresAt == null) return "permanent";
  if (isExpired(user.accessExpiresAt)) return "expired";
  return "active";
}

/** New access_expires_at after extending by (amount, unit). If the current
 *  expiry is still in the future, time is added on top of it; otherwise the
 *  extension starts from now. */
export function extendExpiry(user: Pick<User, "accessExpiresAt">, amount: number, unit: string): string {
  return addSecondsISO(user.accessExpiresAt, durationToSeconds(amount, unit));
}

export { UNIT_SECONDS, durationToSeconds };
