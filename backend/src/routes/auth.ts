import { ApiError } from "../lib/errors";
import { Hono } from "hono";
import { and, eq, or } from "drizzle-orm";
import type { Vars } from "../lib/auth";
import { getDb, getUser } from "../lib/auth";
import { authMiddleware } from "../lib/auth";
import { hasAccess, isOfficial } from "../lib/access";
import { clearSessionCookie, setSessionCookie } from "../lib/cookies";
import { loginWithHyper } from "../lib/hyper";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../lib/passwords";
import { rateLimitLogin } from "../lib/ratelimit";
import { userToDict } from "../lib/serializers";
import { sessions, users } from "../db/schema";
import type { Env } from "../db/client";
import { loginSchema, unofficialLoginSchema } from "../schemas";

const app = new Hono<{ Variables: Vars; Bindings: Env }>();

/** Replace any existing sessions for a user and return a fresh token. */
async function issueSession(db: ReturnType<typeof getDb>, userId: string): Promise<string> {
  const token = crypto.randomUUID();
  await db.batch([
    db.delete(sessions).where(eq(sessions.userId, userId)),
    db.insert(sessions).values({ token, userId }),
  ]);
  return token;
}

// POST /auth/login
app.post("/login", async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  const { email, password } = parsed.data;

  await rateLimitLogin(c);
  const db = getDb(c);

  const hyperUser = await loginWithHyper(c.env as Env, email, password);
  if (!hyperUser.email) throw new ApiError(400, "HYPER response missing email");

  // Look up by email OR hyper_id.
  const existing = await db
    .select()
    .from(users)
    .where(hyperUser.id ? or(eq(users.email, hyperUser.email), eq(users.hyperId, hyperUser.id)) : eq(users.email, hyperUser.email))
    .get();

  let dbUser: typeof users.$inferSelect;
  if (existing) {
    const patch: Partial<typeof users.$inferInsert> = {};
    if (!existing.hyperId && hyperUser.id) patch.hyperId = hyperUser.id;
    if (!existing.accountType && hyperUser.accountType) patch.accountType = hyperUser.accountType;
    if ((!existing.name || existing.name === existing.email) && hyperUser.name) patch.name = hyperUser.name;
    if (Object.keys(patch).length) {
      await db.update(users).set(patch).where(eq(users.id, existing.id));
      dbUser = { ...existing, ...patch };
    } else {
      dbUser = existing;
    }
  } else {
    const id = crypto.randomUUID();
    const inserted = {
      id,
      name: hyperUser.name || hyperUser.email,
      email: hyperUser.email,
      hyperId: hyperUser.id || null,
      accountType: hyperUser.accountType || null,
    };
    await db.insert(users).values(inserted);
    dbUser = {
      ...inserted,
      accessExpiresAt: null,
      isKicked: false,
      passwordHash: null,
      group: "unofficial",
      createdAt: new Date().toISOString(),
    } as typeof users.$inferSelect;
  }

  const token = await issueSession(db, dbUser.id);
  setSessionCookie(c, token);
  return c.json({ success: true, data: { user: userToDict(dbUser) }, message: "Login successful" });
});

// GET /auth/me
app.get("/me", authMiddleware, (c) => {
  return c.json({ success: true, data: userToDict(getUser(c)), message: "Authenticated" });
});

// POST /auth/logout
app.post("/logout", authMiddleware, async (c) => {
  const db = getDb(c);
  const user = getUser(c);
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  clearSessionCookie(c);
  return c.json({ success: true, data: null, message: "Logged out" });
});

// POST /auth/login-unofficial
app.post("/login-unofficial", async (c) => {
  const parsed = unofficialLoginSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  const { email, password } = parsed.data;

  await rateLimitLogin(c);
  const db = getDb(c);

  const user = await db.select().from(users).where(eq(users.email, email.trim())).get();
  // Always run a verify (against a dummy hash) to keep timing roughly constant.
  const ok = user ? verifyPassword(password, user.passwordHash ?? DUMMY_HASH) : verifyPassword(password, DUMMY_HASH);

  const invalid = "Invalid email or password";
  if (!user || !ok) throw new ApiError(401, invalid);
  if (isOfficial(user))
    throw new ApiError(400, "This account uses HYPER login. Please use the main login page.");
  if (!user.passwordHash)
    throw new ApiError(400, "This account has no password set. Please join via an invite link first.");
  if (!hasAccess(user)) {
    throw new ApiError(
      403,
      user.isKicked
        ? "This account has been banned. Please contact an administrator."
        : "Your access has expired. Please ask an administrator to renew it.",
    );
  }

  const token = await issueSession(db, user.id);
  setSessionCookie(c, token);
  return c.json({ success: true, data: { user: userToDict(user) }, message: "Login successful" });
});

export default app;
