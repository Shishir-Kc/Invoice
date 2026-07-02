-- Invoicely initial schema for D1 (SQLite).
-- Mirrors backend/src/db/schema.ts (Drizzle). Apply with:
--   wrangler d1 migrations apply invoicely --local
--   wrangler d1 migrations apply invoicely --remote

-- ── users ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,                 -- uuid v4 string
  name               TEXT NOT NULL,
  email              TEXT NOT NULL,
  hyper_id           TEXT,                             -- non-null => official (admin)
  account_type       TEXT,
  access_expires_at  TEXT,                             -- ISO-8601 UTC; NULL = permanent
  is_kicked          INTEGER NOT NULL DEFAULT 0,       -- 0/1 boolean (ban)
  password_hash      TEXT,                             -- scrypt$...  (unofficial members only)
  "group"            TEXT NOT NULL DEFAULT 'unofficial', -- hyper | unofficial | private
  created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx    ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS users_hyper_id_idx ON users(hyper_id);

-- ── bills ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bills (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open',           -- open | settled
  created_by  TEXT,                                    -- -> users.id (nullable)
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS bills_created_by_idx  ON bills(created_by);
CREATE INDEX IF NOT EXISTS bills_created_at_idx  ON bills(created_at);

-- ── bill_members ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bill_members (
  id       TEXT PRIMARY KEY,
  bill_id  TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS bill_members_bill_idx ON bill_members(bill_id);
CREATE INDEX IF NOT EXISTS bill_members_user_idx ON bill_members(user_id);

-- ── expenses ─────────────────────────────────────────────────────────────
-- Money is stored as INTEGER cents (was Decimal(12,2) in Postgres) to avoid
-- floating-point drift.
CREATE TABLE IF NOT EXISTS expenses (
  id                TEXT PRIMARY KEY,
  description       TEXT NOT NULL,
  amount_cents      INTEGER NOT NULL,
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, -- date the expense was paid
  bill_id           TEXT NOT NULL,
  paid_by_member_id TEXT NOT NULL,                          -- -> bill_members.id
  paid_by_user_id   TEXT NOT NULL,                          -- -> users.id
  FOREIGN KEY (bill_id)           REFERENCES bills(id)        ON DELETE CASCADE,
  FOREIGN KEY (paid_by_member_id) REFERENCES bill_members(id) ON DELETE CASCADE,
  FOREIGN KEY (paid_by_user_id)   REFERENCES users(id)        ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS expenses_bill_idx          ON expenses(bill_id);
CREATE INDEX IF NOT EXISTS expenses_paid_by_user_idx  ON expenses(paid_by_user_id);

-- ── notifications ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,                              -- bill_added | bill_settled | ...
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  bill_id     TEXT,                                       -- -> bills.id (nullable)
  user_id     TEXT,                                       -- -> users.id (per-recipient scoping)
  read        INTEGER NOT NULL DEFAULT 0,                 -- 0/1 boolean
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_bill_idx ON notifications(bill_id);

-- ── invites ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invites (
  id                       TEXT PRIMARY KEY,
  token                    TEXT NOT NULL,
  created_by               TEXT NOT NULL,                -- -> users.id
  access_duration_seconds  INTEGER NOT NULL,
  "group"                  TEXT NOT NULL DEFAULT 'unofficial',
  created_at               TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  use_count                INTEGER NOT NULL DEFAULT 0,
  expires_at               TEXT,                         -- NULL = never expires
  max_uses                 INTEGER,                      -- NULL = unlimited
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS invites_token_idx ON invites(token);

-- ── sessions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,                          -- opaque backend-issued token
  user_id     TEXT NOT NULL,                             -- -> users.id
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- ── user_settings ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  user_id           TEXT PRIMARY KEY,                    -- -> users.id
  default_currency  TEXT NOT NULL DEFAULT 'NPR',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
