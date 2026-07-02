import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Vars } from "../lib/auth";
import { authMiddleware, getDb, getUser } from "../lib/auth";
import { userSettingToOut } from "../lib/serializers";
import { userSettings } from "../db/schema";
import type { Env } from "../db/client";
import { userSettingUpdateSchema } from "../schemas";

const app = new Hono<{ Variables: Vars; Bindings: Env }>();

// GET /settings
app.get("/", authMiddleware, async (c) => {
  const db = getDb(c);
  const user = getUser(c);
  const s = await db.select().from(userSettings).where(eq(userSettings.userId, user.id)).get();
  return c.json({ success: true, data: userSettingToOut(s ?? undefined), message: "Settings" });
});

// PUT /settings
app.put("/", authMiddleware, async (c) => {
  const parsed = userSettingUpdateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ success: false, data: null, message: "Invalid currency" }, 400);
  }
  const db = getDb(c);
  const user = getUser(c);

  const existing = await db.select().from(userSettings).where(eq(userSettings.userId, user.id)).get();
  if (!existing) {
    await db.insert(userSettings).values({ userId: user.id, defaultCurrency: parsed.data.defaultCurrency });
  } else {
    await db
      .update(userSettings)
      .set({ defaultCurrency: parsed.data.defaultCurrency })
      .where(eq(userSettings.userId, user.id));
  }
  return c.json({
    success: true,
    data: { defaultCurrency: parsed.data.defaultCurrency },
    message: "Settings saved",
  });
});

export default app;
