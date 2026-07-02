-- Replace the boolean "paid" flag on bill_members with an amount (cents) so
-- we can track partial payments and compute exactly how much each member still
-- owes (e.g. total 3018 / 3 = 1006 share; C paid 0 => owes 1006).
-- Mirrors backend/src/db/schema.ts (Drizzle). Apply with:
--   wrangler d1 migrations apply invoicely --local
--   wrangler d1 migrations apply invoicely --remote

-- Amount this member has paid toward their share, in integer cents.
ALTER TABLE bill_members ADD COLUMN paid_cents INTEGER NOT NULL DEFAULT 0;

-- The old boolean flag (added in 0002) is superseded by paid_cents. Drop it.
-- SQLite (D1) supports DROP COLUMN since 3.35.0.
ALTER TABLE bill_members DROP COLUMN paid;
