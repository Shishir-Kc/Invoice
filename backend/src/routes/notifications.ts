import { ApiError } from "../lib/errors";
import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import type { Vars } from "../lib/auth";
import { authMiddleware, getDb, getUser } from "../lib/auth";
import { notificationToOut } from "../lib/serializers";
import { notifications } from "../db/schema";
import type { Env } from "../db/client";
import { notificationUpdateSchema } from "../schemas";

const app = new Hono<{ Variables: Vars; Bindings: Env }>();

// GET /notifications
app.get("/", authMiddleware, async (c) => {
  const db = getDb(c);
  const user = getUser(c);
  const unread = c.req.query("unread");

  let conds = eq(notifications.userId, user.id);
  if (unread === "true") conds = and(conds, eq(notifications.read, false)) as typeof conds;

  const rows = await db
    .select()
    .from(notifications)
    .where(conds)
    .orderBy(desc(notifications.createdAt))
    .all();

  return c.json({
    success: true,
    data: rows.map(notificationToOut),
    message: "Notifications",
  });
});

// POST /notifications/mark-all-read
app.post("/mark-all-read", authMiddleware, async (c) => {
  const db = getDb(c);
  const user = getUser(c);
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));
  return c.json({ success: true, data: null, message: "All notifications marked read" });
});

// PATCH /notifications/:id
app.patch("/:id", authMiddleware, async (c) => {
  const parsed = notificationUpdateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid request");

  const db = getDb(c);
  const user = getUser(c);
  const n = await db.select().from(notifications).where(eq(notifications.id, c.req.param("id"))).get();
  if (!n || n.userId !== user.id) throw new ApiError(404, "Notification not found");

  await db.update(notifications).set({ read: parsed.data.read }).where(eq(notifications.id, n.id));
  const updated = { ...n, read: parsed.data.read };
  return c.json({ success: true, data: notificationToOut(updated), message: "Notification updated" });
});

// DELETE /notifications/:id
app.delete("/:id", authMiddleware, async (c) => {
  const db = getDb(c);
  const user = getUser(c);
  const n = await db.select().from(notifications).where(eq(notifications.id, c.req.param("id"))).get();
  if (!n || n.userId !== user.id) throw new ApiError(404, "Notification not found");
  await db.delete(notifications).where(eq(notifications.id, n.id));
  return c.json({ success: true, data: null, message: "Notification deleted" });
});

// DELETE /notifications
app.delete("/", authMiddleware, async (c) => {
  const db = getDb(c);
  const user = getUser(c);
  await db.delete(notifications).where(eq(notifications.userId, user.id));
  return c.json({ success: true, data: null, message: "All notifications cleared" });
});

export default app;
