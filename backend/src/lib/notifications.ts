import type { DB } from "../db/client";
import { notifications } from "../db/schema";

/**
 * Create one notification row per recipient. Notifications are strictly
 * per-user: each user only ever sees rows whose `user_id` matches their own.
 *
 * Caller is responsible for committing alongside its own changes (drizzle/d1
 * batches are atomic, so we just insert here and the surrounding batch
 * commits everything together).
 */
export async function pushNotifications(
  db: DB,
  opts: {
    userIds: string[];
    type: string;
    title: string;
    description: string;
    billId?: string | null;
  },
): Promise<void> {
  const seen = new Set<string>();
  const rows: typeof notifications.$inferInsert[] = [];
  for (const uid of opts.userIds) {
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    rows.push({
      id: crypto.randomUUID(),
      type: opts.type,
      title: opts.title,
      description: opts.description,
      billId: opts.billId ?? null,
      userId: uid,
      read: false,
    });
  }
  if (rows.length) await db.insert(notifications).values(rows);
}
