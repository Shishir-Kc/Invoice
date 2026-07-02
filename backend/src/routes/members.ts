import { ApiError } from "../lib/errors";
import { Hono } from "hono";
import { eq, inArray, sql } from "drizzle-orm";
import type { Vars } from "../lib/auth";
import { authMiddleware, getDb, getUser, officialMiddleware } from "../lib/auth";
import { extendExpiry, isOfficial } from "../lib/access";
import { durationToSeconds } from "../lib/durations";
import { setSessionCookie } from "../lib/cookies";
import { hashPassword } from "../lib/passwords";
import { rateLimitJoin } from "../lib/ratelimit";
import { isExpired, nowISO } from "../lib/time";
import { memberWithStats, userToDict } from "../lib/serializers";
import { billMembers, expenses, invites, sessions, users } from "../db/schema";
import type { Env } from "../db/client";
import { inviteCreateSchema, joinSchema, memberCreateSchema, durationSchema } from "../schemas";

const app = new Hono<{ Variables: Vars; Bindings: Env }>();

async function statsFor(db: ReturnType<typeof getDb>, userIds: string[]) {
  const billCounts = new Map<string, number>();
  const totalPaidCents = new Map<string, number>();
  if (!userIds.length) return { billCounts, totalPaidCents };

  const countRows = await db
    .select({ userId: billMembers.userId, c: sql<number>`count(*)` })
    .from(billMembers)
    .where(inArray(billMembers.userId, userIds))
    .groupBy(billMembers.userId)
    .all();
  for (const r of countRows) billCounts.set(r.userId, Number(r.c));

  const sumRows = await db
    .select({ userId: expenses.paidByUserId, s: sql<number>`coalesce(sum(${expenses.amountCents}), 0)` })
    .from(expenses)
    .where(inArray(expenses.paidByUserId, userIds))
    .groupBy(expenses.paidByUserId)
    .all();
  for (const r of sumRows) totalPaidCents.set(r.userId, Number(r.s));

  return { billCounts, totalPaidCents };
}

async function serializeMember(db: ReturnType<typeof getDb>, user: typeof users.$inferSelect) {
  const { billCounts, totalPaidCents } = await statsFor(db, [user.id]);
  return memberWithStats(user, billCounts.get(user.id) ?? 0, totalPaidCents.get(user.id) ?? 0);
}

// GET /members
app.get("/", authMiddleware, async (c) => {
  const db = getDb(c);
  const search = c.req.query("search")?.trim() || "";
  const page = Math.max(1, Number(c.req.query("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query("pageSize") ?? "20") || 20));

  const conditions = search
    ? sql`(lower(${users.name}) LIKE ${`%${search.toLowerCase()}%`} OR lower(${users.email}) LIKE ${`%${search.toLowerCase()}%`})`
    : sql`1=1`;

  const totalRow = await db.select({ c: sql<number>`count(*)` }).from(users).where(conditions).get();
  const total = Number(totalRow?.c ?? 0);

  const userRows = await db
    .select()
    .from(users)
    .where(conditions)
    .orderBy(sql`${users.name} ASC`)
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  const { billCounts, totalPaidCents } = await statsFor(
    db,
    userRows.map((u) => u.id),
  );
  const data = userRows.map((u) =>
    memberWithStats(u, billCounts.get(u.id) ?? 0, totalPaidCents.get(u.id) ?? 0),
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return c.json({ data, total, page, pageSize, totalPages });
});

// GET /members/:id
app.get("/:id", authMiddleware, async (c) => {
  const db = getDb(c);
  const user = await db.select().from(users).where(eq(users.id, c.req.param("id"))).get();
  if (!user) throw new ApiError(404, "Member not found");
  return c.json(await serializeMember(db, user));
});

// POST /members  (official only)
app.post("/", authMiddleware, officialMiddleware, async (c) => {
  const parsed = memberCreateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  const req = parsed.data;
  const db = getDb(c);

  const existing = await db.select().from(users).where(eq(users.email, req.email)).get();
  if (existing) {
    return c.json({
      success: true,
      data: { id: existing.id, name: existing.name, email: existing.email },
      message: "Member already exists",
    });
  }

  const id = crypto.randomUUID();
  await db.insert(users).values({ id, name: req.name, email: req.email, group: req.group });
  return c.json({ success: true, data: { id, name: req.name, email: req.email }, message: "Member added" });
});

// POST /members/invite  (official only)
app.post("/invite", authMiddleware, officialMiddleware, async (c) => {
  const parsed = inviteCreateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  const req = parsed.data;
  const db = getDb(c);
  const admin = getUser(c);

  let seconds: number;
  try {
    seconds = durationToSeconds(req.amount, req.unit);
  } catch (e) {
    throw new ApiError(400, (e as Error).message);
  }

  const expiresAt = req.expiresInSeconds != null ? new Date(Date.now() + req.expiresInSeconds * 1000).toISOString() : null;
  const id = crypto.randomUUID();
  const token = crypto.randomUUID() + crypto.randomUUID(); // ~72 chars, URL-safe
  await db.insert(invites).values({
    id,
    token,
    createdBy: admin.id,
    accessDurationSeconds: seconds,
    group: req.group,
    expiresAt,
    maxUses: req.maxUses,
  });

  const frontend = (c.env as Env).FRONTEND_URL ?? "http://localhost:3000";
  const link = `${frontend.replace(/\/$/, "")}/join?token=${token}`;
  return c.json({
    success: true,
    data: { token, link, accessDurationSeconds: seconds, createdAt: nowISO() },
    message: "Invite link generated",
  });
});

// POST /members/join  (public, rate-limited)
app.post("/join", async (c) => {
  const parsed = joinSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  const req = parsed.data;

  await rateLimitJoin(c);
  const db = getDb(c);

  const invite = await db.select().from(invites).where(eq(invites.token, req.token)).get();
  if (!invite) throw new ApiError(404, "Invalid or unknown invite link");
  if (invite.expiresAt != null && isExpired(invite.expiresAt))
    throw new ApiError(410, "This invite link has expired");
  if (invite.maxUses != null && invite.useCount >= invite.maxUses)
    throw new ApiError(410, "This invite link is no longer valid");

  const email = req.email.trim();
  const name = req.name.trim();
  let user = await db.select().from(users).where(eq(users.email, email)).get();

  if (user && isOfficial(user)) {
    return c.json({
      success: true,
      data: { alreadyOfficial: true, user: userToDict(user) },
      message: "You already have an official HYPER account. Please log in via HYPER.",
    });
  }
  if (user && user.isKicked) {
    throw new ApiError(403, "This account has been banned. Please contact an administrator to restore access.");
  }

  const accessExpiresAt = new Date(Date.now() + invite.accessDurationSeconds * 1000).toISOString();
  const passwordHash = hashPassword(req.password);

  if (!user) {
    const id = crypto.randomUUID();
    const newUser = {
      id,
      name,
      email,
      accessExpiresAt,
      isKicked: false,
      passwordHash,
      group: invite.group ?? "unofficial",
    };
    await db.insert(users).values(newUser);
    user = { ...newUser, hyperId: null, accountType: null, createdAt: nowISO() } as typeof users.$inferSelect;
  } else {
    await db
      .update(users)
      .set({
        accessExpiresAt,
        passwordHash,
        group: invite.group ?? "unofficial",
        name: !user.name || user.name === user.email ? name : user.name,
      })
      .where(eq(users.id, user.id));
    user = { ...user, accessExpiresAt, passwordHash, group: invite.group ?? "unofficial" };
  }

  const sessionToken = crypto.randomUUID();
  await db.batch([
    db.delete(sessions).where(eq(sessions.userId, user.id)),
    db.insert(sessions).values({ token: sessionToken, userId: user.id }),
    db.update(invites).set({ useCount: invite.useCount + 1 }).where(eq(invites.id, invite.id)),
  ]);

  setSessionCookie(c, sessionToken);
  return c.json({
    success: true,
    data: { alreadyOfficial: false, user: userToDict(user) },
    message: "Welcome! You now have access to Invoicely.",
  });
});

// POST /members/:id/ban  (official only)
app.post("/:id/ban", authMiddleware, officialMiddleware, async (c) => {
  const db = getDb(c);
  const user = await db.select().from(users).where(eq(users.id, c.req.param("id"))).get();
  if (!user) throw new ApiError(404, "Member not found");
  if (isOfficial(user)) throw new ApiError(400, "Official (HYPER) members cannot be banned");

  await db.batch([
    db.update(users).set({ isKicked: true }).where(eq(users.id, user.id)),
    db.delete(sessions).where(eq(sessions.userId, user.id)),
  ]);
  const updated = { ...user, isKicked: true };
  return c.json({ success: true, data: await serializeMember(db, updated), message: "Member banned" });
});

// POST /members/:id/unban  (official only)
app.post("/:id/unban", authMiddleware, officialMiddleware, async (c) => {
  const db = getDb(c);
  const user = await db.select().from(users).where(eq(users.id, c.req.param("id"))).get();
  if (!user) throw new ApiError(404, "Member not found");
  if (isOfficial(user)) throw new ApiError(400, "Official members cannot be banned");

  await db.update(users).set({ isKicked: false }).where(eq(users.id, user.id));
  const updated = { ...user, isKicked: false };
  return c.json({ success: true, data: await serializeMember(db, updated), message: "Member unbanned" });
});

// POST /members/:id/extend  (official only)
app.post("/:id/extend", authMiddleware, officialMiddleware, async (c) => {
  const parsed = durationSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  const req = parsed.data;
  const db = getDb(c);
  const user = await db.select().from(users).where(eq(users.id, c.req.param("id"))).get();
  if (!user) throw new ApiError(404, "Member not found");
  if (isOfficial(user)) throw new ApiError(400, "Official members already have permanent access");
  if (user.isKicked) throw new ApiError(400, "This member is banned. Unban them first before extending access.");

  let newExpiry: string;
  try {
    newExpiry = extendExpiry(user, req.amount, req.unit);
  } catch (e) {
    throw new ApiError(400, (e as Error).message);
  }
  await db.update(users).set({ accessExpiresAt: newExpiry }).where(eq(users.id, user.id));
  const updated = { ...user, accessExpiresAt: newExpiry };
  return c.json({ success: true, data: await serializeMember(db, updated), message: "Access extended" });
});

// POST /members/:id/permanent  (official only)
app.post("/:id/permanent", authMiddleware, officialMiddleware, async (c) => {
  const db = getDb(c);
  const user = await db.select().from(users).where(eq(users.id, c.req.param("id"))).get();
  if (!user) throw new ApiError(404, "Member not found");
  if (isOfficial(user)) throw new ApiError(400, "Official members already have permanent access");
  if (user.isKicked) throw new ApiError(400, "This member is banned. Unban them first before granting permanent access.");

  await db.update(users).set({ accessExpiresAt: null }).where(eq(users.id, user.id));
  const updated = { ...user, accessExpiresAt: null };
  return c.json({ success: true, data: await serializeMember(db, updated), message: "Member granted permanent access" });
});

export default app;
