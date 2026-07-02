import { ApiError } from "./errors";
import type { Context, MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import { dbFrom, type DB, type Env } from "../db/client";
import { sessions, users, type User } from "../db/schema";
import { getSessionToken } from "./cookies";
import { hasAccess, isOfficial } from "./access";

export type Vars = {
  db: DB;
  user: User;
};

/** Attaches a Drizzle/D1 client to the context for every request. */
export const withDb: MiddlewareHandler<{ Variables: Vars; Bindings: Env }> = async (c, next) => {
  c.set("db", dbFrom(c.env as Env));
  await next();
};

/**
 * Resolves the authenticated local user from the backend-issued opaque session
 * token (cookie preferred; `Authorization: Bearer` fallback for API clients).
 * Validates access on every request — banned or expired unofficial members
 * get 401. Official members always pass.
 *
 * The token is looked up in the `sessions` table; we never trust a client-
 * presented JWT. Sets `c.var.user` for downstream handlers.
 */
export const authMiddleware: MiddlewareHandler<{ Variables: Vars; Bindings: Env }> = async (c, next) => {
  const db = c.get("db");
  const token = getSessionToken(c);
  if (!token) {
    throw new ApiError(401, "Missing session cookie or Authorization header");
  }

  const sessionRow = await db.select().from(sessions).where(eq(sessions.token, token)).get();
  if (!sessionRow) {
    throw new ApiError(401, "Invalid or expired session");
  }

  const user = await db.select().from(users).where(eq(users.id, sessionRow.userId)).get();
  if (!user) {
    throw new ApiError(401, "Invalid or expired session");
  }

  if (!hasAccess(user)) {
    throw new ApiError(401, "Your access has expired or been revoked");
  }

  c.set("user", user);
  await next();
};

/** Only official (HYPER) members may pass. Must run after authMiddleware. */
export const officialMiddleware: MiddlewareHandler<{ Variables: Vars; Bindings: Env }> = async (c, next) => {
  const user = c.get("user");
  if (!isOfficial(user)) {
    throw new ApiError(403, "Only official members can manage members");
  }
  await next();
};

export type AppContext = Context<{ Variables: Vars; Bindings: Env }>;

export function getUser(c: AppContext): User {
  return c.get("user");
}

export function getDb(c: AppContext): DB {
  return c.get("db");
}
