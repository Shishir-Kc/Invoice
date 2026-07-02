import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";
import type { Env } from "../db/client";

/**
 * HttpOnly session-cookie helpers.
 *
 * Frontend (app.shishirkhatri.com.np) and API (api.shishirkhatri.com.np) share
 * the registrable domain `shishirkhatri.com.np`, so a single cookie scoped to
 * `Domain=.shishirkhatri.com.np` with `SameSite=Lax` is sent cross-subdomain
 * automatically. No `SameSite=None` / cross-domain dance required.
 *
 * Config (vars in wrangler.jsonc):
 *   COOKIE_NAME     — default invoicely_session
 *   COOKIE_DOMAIN   — e.g. .shishirkhatri.com.np  ("" = host-only, for local dev)
 *   COOKIE_SAMESITE — lax (default) | strict | none
 *   COOKIE_SECURE   — "true" to set Secure (HTTPS). Default "true" in prod.
 *   COOKIE_MAX_AGE  — seconds until the browser drops the cookie (default 30d).
 */

function env(c: Context): Env {
  return c.env as Env;
}

function bool(v: string | undefined, fallback = false): boolean {
  if (v == null) return fallback;
  return v.toLowerCase() === "true";
}

function sameSite(v: string | undefined): "lax" | "strict" | "none" {
  const s = (v ?? "lax").toLowerCase();
  return s === "strict" || s === "none" ? s : "lax";
}

export function setSessionCookie(c: Context, token: string): void {
  const e = env(c);
  const secure = bool(e.COOKIE_SECURE, false);
  const domain = e.COOKIE_DOMAIN ? e.COOKIE_DOMAIN : undefined;
  setCookie(c, e.COOKIE_NAME ?? "invoicely_session", token, {
    httpOnly: true,
    secure,
    sameSite: sameSite(e.COOKIE_SAMESITE),
    path: "/",
    domain,
    maxAge: Number(e.COOKIE_MAX_AGE ?? 2592000),
  });
}

export function clearSessionCookie(c: Context): void {
  const e = env(c);
  const domain = e.COOKIE_DOMAIN ? e.COOKIE_DOMAIN : undefined;
  deleteCookie(c, e.COOKIE_NAME ?? "invoicely_session", {
    path: "/",
    domain,
  });
}

/** Resolve the session token from the cookie, falling back to
 *  `Authorization: Bearer <token>` for non-browser API clients. Returns null
 *  if neither is present (caller turns that into a 401). */
export function getSessionToken(c: Context): string | null {
  const e = env(c);
  const cookie = getCookie(c, e.COOKIE_NAME ?? "invoicely_session");
  if (cookie) return cookie;
  const auth = c.req.header("authorization") ?? c.req.header("Authorization");
  if (auth) {
    const [scheme, value] = auth.split(" ");
    if (scheme?.toLowerCase() === "bearer" && value) return value;
  }
  return null;
}
