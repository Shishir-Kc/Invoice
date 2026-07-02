-- Add explicit total cost to bills and a per-member "paid their share" flag.
-- Mirrors backend/src/db/schema.ts (Drizzle). Apply with:
--   wrangler d1 migrations apply invoicely --local
--   wrangler d1 migrations apply invoicely --remote

-- Total cost in integer cents (sum of expenses). 0 for bills created before
-- this migration; backfill is best-effort and left to the application layer.
ALTER TABLE bills ADD COLUMN total_cost_cents INTEGER NOT NULL DEFAULT 0;

-- Whether a given bill member has paid their share (0/1).
ALTER TABLE bill_members ADD COLUMN paid INTEGER NOT NULL DEFAULT 0;
