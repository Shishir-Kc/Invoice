import { ApiError } from "../lib/errors";
import { Hono } from "hono";
import { and, eq, inArray, isNotNull, isNull, like, sql } from "drizzle-orm";
import type { Vars, } from "../lib/auth";
import { authMiddleware, getDb, getUser } from "../lib/auth";
import { isOfficial } from "../lib/access";
import { billToOut, dollarsToCents, type BillOut } from "../lib/serializers";
import { pushNotifications } from "../lib/notifications";
import { nowISO } from "../lib/time";
import { bills, billMembers, expenses, notifications, users } from "../db/schema";
import type { Env } from "../db/client";
import { createBillSchema, updateBillSchema } from "../schemas";

const app = new Hono<{ Variables: Vars; Bindings: Env }>();

function canMutateBill(bill: { createdBy: string | null }, user: { id: string; hyperId: string | null }): boolean {
  if (isOfficial(user)) return true;
  return bill.createdBy != null && bill.createdBy === user.id;
}

/** Distinct user ids that should be notified about a bill event. */
function billRecipientIds(
  bill: { createdBy: string | null },
  members: { userId: string }[],
): string[] {
  const ids = new Set<string>(members.map((m) => m.userId));
  if (bill.createdBy) ids.add(bill.createdBy);
  return [...ids];
}

/** Load members (with user name/email) and expenses for a set of bills. */
async function loadRelations(
  db: ReturnType<typeof getDb>,
  billIds: string[],
): Promise<{ membersByBill: Map<string, (typeof billMembers.$inferSelect & { userName: string; userEmail: string })[]>; expensesByBill: Map<string, typeof expenses.$inferSelect[]> }> {
  const membersByBill = new Map<string, (typeof billMembers.$inferSelect & { userName: string; userEmail: string })[]>();
  const expensesByBill = new Map<string, typeof expenses.$inferSelect[]>();
  if (!billIds.length) return { membersByBill, expensesByBill };

  const memberRows = await db
    .select({
      id: billMembers.id,
      billId: billMembers.billId,
      userId: billMembers.userId,
      paidCents: billMembers.paidCents,
      userName: users.name,
      userEmail: users.email,
    })
    .from(billMembers)
    .innerJoin(users, eq(billMembers.userId, users.id))
    .where(inArray(billMembers.billId, billIds))
    .all();
  for (const m of memberRows) {
    const arr = membersByBill.get(m.billId) ?? [];
    arr.push(m);
    membersByBill.set(m.billId, arr);
  }

  const expenseRows = await db.select().from(expenses).where(inArray(expenses.billId, billIds)).all();
  for (const e of expenseRows) {
    const arr = expensesByBill.get(e.billId) ?? [];
    arr.push(e);
    expensesByBill.set(e.billId, arr);
  }
  return { membersByBill, expensesByBill };
}

async function serializeBill(db: ReturnType<typeof getDb>, bill: typeof bills.$inferSelect): Promise<BillOut> {
  const { membersByBill, expensesByBill } = await loadRelations(db, [bill.id]);
  return billToOut(bill, membersByBill.get(bill.id) ?? [], expensesByBill.get(bill.id) ?? []);
}

// POST /bills
app.post("/", authMiddleware, async (c) => {
  const parsed = createBillSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  const req = parsed.data;
  const db = getDb(c);
  const user = getUser(c);

  const billId = crypto.randomUUID();
  const now = nowISO();

  // Resolve member users by email (single query).
  const emails = [...new Set(req.members.map((m) => m.email))];
  const existingUsers = await db.select().from(users).where(inArray(users.email, emails)).all();
  const byEmail = new Map(existingUsers.map((u) => [u.email, u]));

  const clientIdToBmId = new Map<string, string>();
  const clientIdToUserId = new Map<string, string>();
  const memberInserts: (typeof billMembers.$inferInsert)[] = [];
  const userInserts: (typeof users.$inferInsert)[] = [];

  for (const m of req.members) {
    let mu = byEmail.get(m.email);
    if (!mu) {
      if (!isOfficial(user)) {
        throw new ApiError(400, `No member with email ${m.email}. Ask an administrator to add them first.`);
      }
      const newId = crypto.randomUUID();
      mu = {
        id: newId,
        name: m.name,
        email: m.email,
        hyperId: null,
        accountType: null,
        accessExpiresAt: null,
        isKicked: false,
        passwordHash: null,
        group: "unofficial",
        createdAt: now,
      } as typeof existingUsers[number];
      userInserts.push(mu);
      byEmail.set(m.email, mu);
    }
    const bmId = crypto.randomUUID();
    clientIdToBmId.set(m.id, bmId);
    clientIdToUserId.set(m.id, mu.id);
    memberInserts.push({ id: bmId, billId, userId: mu.id, paidCents: dollarsToCents(m.paidAmount ?? 0) });
  }

  const expenseInserts: (typeof expenses.$inferInsert)[] = [];
  for (const e of req.expenses) {
    const bmId = clientIdToBmId.get(e.paidBy);
    const userId = clientIdToUserId.get(e.paidBy);
    if (!bmId || !userId) {
      throw new ApiError(400, `Unknown member id ${e.paidBy} in expense`);
    }
    expenseInserts.push({
      id: crypto.randomUUID(),
      description: e.description,
      amountCents: dollarsToCents(e.amount),
      createdAt: e.date ? `${e.date}T00:00:00.000Z` : now,
      billId,
      paidByMemberId: bmId,
      paidByUserId: userId,
    });
  }

  // Total cost = sum of expense amounts, stored on the bill row.
  const totalCostCents = req.expenses.reduce((s, e) => s + dollarsToCents(e.amount), 0);
  const billRow = {
    id: billId,
    title: req.title,
    description: req.description ?? "",
    status: "open" as const,
    totalCostCents,
    createdBy: user.id,
    createdAt: now,
    updatedAt: now,
  };

  await db.batch([
    db.insert(bills).values(billRow),
    ...(userInserts.length ? [db.insert(users).values(userInserts)] : []),
    db.insert(billMembers).values(memberInserts),
    db.insert(expenses).values(expenseInserts),
  ]);

  // Reload members with names for notification recipients + response.
  const { membersByBill, expensesByBill } = await loadRelations(db, [billId]);
  const billOut = billToOut(billRow as typeof bills.$inferSelect, membersByBill.get(billId) ?? [], expensesByBill.get(billId) ?? []);

  const total = req.expenses.reduce((s, e) => s + e.amount, 0);
  await pushNotifications(db, {
    userIds: billRecipientIds(billRow, membersByBill.get(billId) ?? []),
    type: "bill_added",
    title: "New Bill Created",
    description: `"${billRow.title}" created — NPR ${total.toFixed(2)} total (${req.members.filter((m) => (m.paidAmount ?? 0) > 0).length}/${req.members.length} paid).`,
    billId,
  });

  return c.json({ success: true, data: billOut, message: "Bill created" });
});

// GET /bills
app.get("/", authMiddleware, async (c) => {
  const db = getDb(c);
  const user = getUser(c);
  const search = c.req.query("search")?.trim() || "";
  const page = Math.max(1, Number(c.req.query("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query("pageSize") ?? "10") || 10));

  // Visibility filtering for unofficial members based on their group.
  let visibility = sql`1=1`;
  if (!isOfficial(user)) {
    const g = user.group ?? "unofficial";
    if (g === "private") {
      const ids = db.select({ id: billMembers.billId }).from(billMembers).where(eq(billMembers.userId, user.id));
      visibility = inArray(bills.id, ids);
    } else if (g === "hyper") {
      const officialIds = db.select({ id: users.id }).from(users).where(isNotNull(users.hyperId));
      visibility = inArray(bills.createdBy, officialIds);
    } else {
      const unofficialBillIds = db
        .select({ id: billMembers.billId })
        .from(billMembers)
        .innerJoin(users, eq(billMembers.userId, users.id))
        .where(isNull(users.hyperId));
      visibility = inArray(bills.id, unofficialBillIds);
    }
  }

  const conditions = search ? and(visibility, like(bills.title, `%${search}%`)) : visibility;

  const totalRow = await db.select({ c: sql<number>`count(*)` }).from(bills).where(conditions).get();
  const total = Number(totalRow?.c ?? 0);

  const billRows = await db
    .select()
    .from(bills)
    .where(conditions)
    .orderBy(sql`${bills.createdAt} DESC`)
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  const { membersByBill, expensesByBill } = await loadRelations(
    db,
    billRows.map((b) => b.id),
  );
  const data = billRows.map((b) => billToOut(b, membersByBill.get(b.id) ?? [], expensesByBill.get(b.id) ?? []));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return c.json({ data, total, page, pageSize, totalPages });
});

// GET /bills/:id
app.get("/:id", authMiddleware, async (c) => {
  const db = getDb(c);
  const user = getUser(c);
  const billId = c.req.param("id");

  const bill = await db.select().from(bills).where(eq(bills.id, billId)).get();
  if (!bill) throw new ApiError(404, "Bill not found");

  if (!isOfficial(user)) {
    const g = user.group ?? "unofficial";
    const memberRows = await db
      .select({ userId: billMembers.userId, hyperId: users.hyperId })
      .from(billMembers)
      .innerJoin(users, eq(billMembers.userId, users.id))
      .where(eq(billMembers.billId, billId))
      .all();
    const isMember = memberRows.some((m) => m.userId === user.id);
    const hasUnofficialMember = memberRows.some((m) => !m.hyperId);
    const creator = bill.createdBy
      ? await db.select().from(users).where(eq(users.id, bill.createdBy)).get()
      : null;
    const creatorOfficial = !!creator?.hyperId;
    const allowed =
      (g === "hyper" && creatorOfficial) ||
      (g === "unofficial" && hasUnofficialMember) ||
      (g === "private" && isMember);
    if (!allowed) throw new ApiError(403, "You don't have access to this bill");
  }

  return c.json(await serializeBill(db, bill));
});

// PATCH /bills/:id
app.patch("/:id", authMiddleware, async (c) => {
  const parsed = updateBillSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  const req = parsed.data;
  const db = getDb(c);
  const user = getUser(c);
  const billId = c.req.param("id");

  const bill = await db.select().from(bills).where(eq(bills.id, billId)).get();
  if (!bill) throw new ApiError(404, "Bill not found");
  if (!canMutateBill(bill, user)) throw new ApiError(403, "You don't have permission to edit this bill");

  const patch: Partial<typeof bills.$inferInsert> = {};
  if (req.title !== undefined) patch.title = req.title;
  if (req.description !== undefined) patch.description = req.description;
  if (req.status !== undefined) patch.status = req.status;
  patch.updatedAt = nowISO();

  const batch: ReturnType<ReturnType<typeof getDb>["delete"]>[] = [];

  if (req.members && req.expenses) {
    const now = nowISO();
    // Wipe and re-create members + expenses.
    batch.push(db.delete(expenses).where(eq(expenses.billId, billId)) as any);
    batch.push(db.delete(billMembers).where(eq(billMembers.billId, billId)) as any);

    const emails = [...new Set(req.members.map((m) => m.email))];
    const existingUsers = await db.select().from(users).where(inArray(users.email, emails)).all();
    const byEmail = new Map(existingUsers.map((u) => [u.email, u]));

    const clientIdToBmId = new Map<string, string>();
    const clientIdToUserId = new Map<string, string>();
    const memberInserts: (typeof billMembers.$inferInsert)[] = [];
    const userInserts: (typeof users.$inferInsert)[] = [];

    for (const m of req.members) {
      let mu = byEmail.get(m.email);
      if (!mu) {
        if (!isOfficial(user)) {
          throw new ApiError(400, `No member with email ${m.email}. Ask an administrator to add them first.`);
        }
        const newId = crypto.randomUUID();
        mu = {
          id: newId,
          name: m.name,
          email: m.email,
          hyperId: null,
          accountType: null,
          accessExpiresAt: null,
          isKicked: false,
          passwordHash: null,
          group: "unofficial",
          createdAt: now,
        } as typeof existingUsers[number];
        userInserts.push(mu);
        byEmail.set(m.email, mu);
      }
      const bmId = crypto.randomUUID();
      clientIdToBmId.set(m.id, bmId);
      clientIdToUserId.set(m.id, mu.id);
      memberInserts.push({ id: bmId, billId, userId: mu.id, paidCents: dollarsToCents(m.paidAmount ?? 0) });
    }

    const expenseInserts: (typeof expenses.$inferInsert)[] = [];
    for (const e of req.expenses) {
      const bmId = clientIdToBmId.get(e.paidBy);
      const userId = clientIdToUserId.get(e.paidBy);
      if (!bmId || !userId) {
        throw new ApiError(400, `Unknown member id ${e.paidBy} in expense`);
      }
      expenseInserts.push({
        id: crypto.randomUUID(),
        description: e.description,
        amountCents: dollarsToCents(e.amount),
        createdAt: e.date ? `${e.date}T00:00:00.000Z` : now,
        billId,
        paidByMemberId: bmId,
        paidByUserId: userId,
      });
    }

    if (userInserts.length) batch.push(db.insert(users).values(userInserts) as any);
    batch.push(db.insert(billMembers).values(memberInserts) as any);
    batch.push(db.insert(expenses).values(expenseInserts) as any);

    // Recompute total cost from the new expense set.
    patch.totalCostCents = req.expenses.reduce((s, e) => s + dollarsToCents(e.amount), 0);
  }

  // Push the bills update after `patch` is fully populated so totalCostCents
  // (and any other late-set fields) are included.
  batch.push(db.update(bills).set(patch).where(eq(bills.id, billId)) as any);

  await db.batch(batch as any);

  const updated = await db.select().from(bills).where(eq(bills.id, billId)).get();
  return c.json({ success: true, data: await serializeBill(db, updated!), message: "Bill updated" });
});

// DELETE /bills/:id
app.delete("/:id", authMiddleware, async (c) => {
  const db = getDb(c);
  const user = getUser(c);
  const billId = c.req.param("id");

  const bill = await db.select().from(bills).where(eq(bills.id, billId)).get();
  if (!bill) throw new ApiError(404, "Bill not found");
  if (!canMutateBill(bill, user)) throw new ApiError(403, "You don't have permission to delete this bill");

  await db.batch([
    db.delete(expenses).where(eq(expenses.billId, billId)),
    db.delete(billMembers).where(eq(billMembers.billId, billId)),
    db.delete(notifications).where(eq(notifications.billId, billId)),
    db.delete(bills).where(eq(bills.id, billId)),
  ]);

  return c.json({ success: true, data: null, message: "Bill deleted" });
});

// POST /bills/:id/settle
app.post("/:id/settle", authMiddleware, async (c) => {
  const db = getDb(c);
  const user = getUser(c);
  const billId = c.req.param("id");

  const bill = await db.select().from(bills).where(eq(bills.id, billId)).get();
  if (!bill) throw new ApiError(404, "Bill not found");
  if (!canMutateBill(bill, user)) throw new ApiError(403, "You don't have permission to settle this bill");

  await db.update(bills).set({ status: "settled", updatedAt: nowISO() }).where(eq(bills.id, billId));

  const { membersByBill } = await loadRelations(db, [billId]);
  await pushNotifications(db, {
    userIds: billRecipientIds(bill, membersByBill.get(billId) ?? []),
    type: "bill_settled",
    title: "Bill Settled",
    description: `"${bill.title}" has been fully settled. Everyone is paid up.`,
    billId,
  });

  const updated = await db.select().from(bills).where(eq(bills.id, billId)).get();
  return c.json({ success: true, data: await serializeBill(db, updated!), message: "Bill settled" });
});

// PATCH /bills/:id/paid
// Set how much a particular member has paid toward their share (dollars).
// Body: { memberId: string, paidAmount: number }
app.patch("/:id/paid", authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const memberId = typeof body.memberId === "string" ? body.memberId : null;
  const paidAmount = typeof body.paidAmount === "number" && body.paidAmount >= 0 ? body.paidAmount : null;
  if (!memberId || paidAmount === null) throw new ApiError(400, "memberId and paidAmount (>= 0) are required");

  const db = getDb(c);
  const user = getUser(c);
  const billId = c.req.param("id");

  const bill = await db.select().from(bills).where(eq(bills.id, billId)).get();
  if (!bill) throw new ApiError(404, "Bill not found");
  if (!canMutateBill(bill, user)) throw new ApiError(403, "You don't have permission to update this bill");

  const bm = await db.select().from(billMembers).where(eq(billMembers.id, memberId)).get();
  if (!bm || bm.billId !== billId) throw new ApiError(404, "Member not part of this bill");

  const paidCents = dollarsToCents(paidAmount);
  await db.update(billMembers).set({ paidCents }).where(eq(billMembers.id, memberId));

  // Notify the member when this payment completes their share. "Fully paid"
  // uses integer math: paidCents * memberCount >= totalCostCents.
  const memberCount = await db.select({ c: sql<number>`count(*)` }).from(billMembers).where(eq(billMembers.billId, billId)).get();
  const n = Number(memberCount?.c ?? 0);
  const totalCents = bill.totalCostCents ?? 0;
  const nowFullyPaid = n > 0 && paidCents * n >= totalCents;
  const wasPaidBefore = n > 0 && (bm.paidCents ?? 0) * n >= totalCents;
  if (nowFullyPaid && !wasPaidBefore) {
    await pushNotifications(db, {
      userIds: [bm.userId],
      type: "payment_received",
      title: "Payment Recorded",
      description: `Your share of "${bill.title}" has been fully paid.`,
      billId,
    });
  }

  const updated = await db.select().from(bills).where(eq(bills.id, billId)).get();
  return c.json({ success: true, data: await serializeBill(db, updated!), message: "Paid status updated" });
});

export default app;
