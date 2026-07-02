import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type DB = DrizzleD1Database<typeof schema>;

export type Env = {
  DB: D1Database;
  // Rate-limit bindings (declared under wrangler.jsonc `unsafe.bindings`).
  LOGIN_RATE_LIMITER: RateLimit;
  JOIN_RATE_LIMITER: RateLimit;
  // vars
  FRONTEND_URL: string;
  HYPER_API_URL: string;
  COOKIE_NAME: string;
  COOKIE_DOMAIN: string;
  COOKIE_SAMESITE: string;
  COOKIE_SECURE: string;
  COOKIE_MAX_AGE: string;
  // secrets
  LEGACY_ACCESS_KEY?: string;
};

/** Build a Drizzle client bound to the request's D1 binding. */
export function dbFrom(env: Env): DB {
  return drizzle(env.DB, { schema });
}
