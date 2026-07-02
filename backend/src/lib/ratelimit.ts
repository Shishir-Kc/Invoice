import type { Context } from "hono";
import { ApiError } from "./errors";
import type { Env } from "../db/client";
import type { Vars } from "./auth";

/**
 * Per-IP rate limiting using the Workers Rate Limit binding.
 *
 * The legacy Python backend used an in-process sliding window — which doesn't
 * work on Workers (state isn't shared across isolates and evaporates between
 * requests). The platform Rate Limit binding is the correct primitive.
 *
 * Bindings are declared in wrangler.jsonc under `unsafe.bindings`:
 *   LOGIN_RATE_LIMITER  (10 / 60s)
 *   JOIN_RATE_LIMITER   (5  / 60s)
 *
 * `limit({ key })` returns { success: boolean }. We key by client IP.
 */

type Ctx = Context<{ Variables: Vars; Bindings: Env }>;

export function clientIp(c: Ctx): string {
  // Trust only the first hop of X-Forwarded-For. Behind Cloudflare this is the
  // real client IP (CF sets it). Fall back to the socket peer otherwise.
  const xff = c.req.header("x-forwarded-for") ?? c.req.header("CF-Connecting-IP");
  if (xff) return xff.split(",")[0]!.trim();
  return "unknown";
}

export async function rateLimitLogin(c: Ctx): Promise<void> {
  const { success } = await c.env.LOGIN_RATE_LIMITER.limit({ key: clientIp(c) });
  if (!success) {
    throw new ApiError(429, "Too many attempts. Please wait a minute and try again.");
  }
}

export async function rateLimitJoin(c: Ctx): Promise<void> {
  const { success } = await c.env.JOIN_RATE_LIMITER.limit({ key: clientIp(c) });
  if (!success) {
    throw new ApiError(429, "Too many attempts. Please wait a minute and try again.");
  }
}
