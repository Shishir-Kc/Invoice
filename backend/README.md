# Invoicely Backend

FastAPI + SQLModel backend for Invoicely. Serves bills, members, notifications,
settings, and an access-management system for official (HYPER) vs unofficial
(invite-joined) members — including local passwords for unofficial logins and
group-based bill visibility.

## Stack

- Python 3.13, FastAPI, SQLModel, psycopg2, PostgreSQL (Supabase)
- Alembic migrations (folder is `mighrations/` — intentional typo, see root README)
- httpx for the HYPER login proxy
- stdlib `hashlib.scrypt` for unofficial-member password hashing (no extra deps)

## Layout

```
src/
  main.py                  # App entry, CORS, mounts router at /api/v1
  api/
    __init__.py            # Aggregates v1 routes under /invoicely prefix
    v1/
      workflow.py          # GET /auth (legacy header-based key check)
      auth.py              # HYPER login, unofficial login (/auth/login-unofficial) + /auth/me
      bills.py             # Bill CRUD + /settle (emits notifications); group-based visibility filtering
      members.py           # Members list (stats + access + group) + create/invite/join + ban/unban/extend/permanent
      notifications.py     # Notification CRUD + mark-all-read + push_notification helper
      settings.py          # Per-user settings (default currency), auth-required
  dependency/
    db.py                  # SQLModel engine + session_dep (DATABASE_URL)
    auth.py                # validate_key dependency (Header 'access_key') — legacy
    hyper_auth.py          # HYPER login proxy + JWT decode helpers + error mapping
    current_user.py        # current_user_dep (HYPER JWT or local session token) + require_official; access checks
    access.py              # official/active/expired/banned helpers, duration→seconds, expiry extension
    passwords.py           # scrypt hash_password / verify_password (stdlib hashlib.scrypt)
  Schema/
    bill.py                # User (access + password_hash + group), Bill (created_by), BillMember, Expense
    notification.py        # Notification table (auto-generated on bill create/settle)
    settings.py            # UserSetting table (per-user default currency)
    invite.py              # Invite table (join links + access duration + group)
    session.py             # Session table (local session tokens for unofficial members)
    api.py                 # Pydantic request/response schemas
    user.py                # Placeholder
mighrations/               # Alembic migrations (folder typo is intentional)
  versions/
    682c44f7c128_initial_migration.py
    187295b79bae_chor_adding_bill_table.py
    baebb5e7ca8c_add_status_and_timestamps.py
    f1a2c3d4e5f6_add_hyper_id_and_account_type_to_user.py
    c0ffee123456_add_notifications_and_user_settings.py
    d1a1b2c3d4e5_add_access_control_invite_session.py
    a1b2c3d4e5f7_add_password_hash_to_user.py
    b2c3d4e5f6a8_add_group_to_bill.py
    c3d4e5f6a7b9_move_group_to_user_add_created_by.py
```

## Routes

All routes are mounted at `/api/v1/invoicely`. Authenticated routes accept a
`Authorization: Bearer <token>` header containing **either** a HYPER JWT
(official members) **or** a local session token (unofficial members).

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/login` | — | HYPER login proxy — upserts user, returns `{ token, user }` |
| `POST` | `/auth/login-unofficial` | — | Unofficial login — email + password; issues a fresh local session token. Rejects official accounts, banned/expired members, and accounts with no password set. |
| `GET` | `/auth/me` | Bearer | Return the current user from the DB (works for HYPER JWT **and** local session tokens; includes `hyperId`) |
| `GET` | `/auth` | header `access_key: hello` | Legacy header-based key check |

### Bills (auth required)

| Method | Path | Description |
|---|---|---|
| `POST` | `/bills` | Create a bill with members and expenses; sets `created_by` to the caller (emits `bill_added`) |
| `GET` | `/bills` | List bills (paginated, searchable by `title`); **filtered by the viewer's group** for unofficial members |
| `GET` | `/bills/{id}` | Get a single bill; `403` if the viewer's group doesn't grant access |
| `PATCH` | `/bills/{id}` | Update title, description, status, members, expenses |
| `DELETE` | `/bills/{id}` | Delete bill (cascades `bill_members`, `expenses`, related `notification`s) |
| `POST` | `/bills/{id}/settle` | Set `status = "settled"` (emits `bill_settled`) |

**Visibility rules for unofficial viewers** (officials see everything), based on
`user.group`:

| Member group | Bills visible |
|---|---|
| `hyper` | Bills created by official members (`bill.created_by` is an official) |
| `unofficial` | Bills that include at least one unofficial `billmember` |
| `private` | Only bills the viewer is a `billmember` of |

### Members

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/members` | Bearer | List members with `billCount`, `totalPaid`, and access info (`isOfficial`, `isKicked`, `accessExpiresAt`, `accessStatus`, `group`) — paginated, searchable |
| `GET` | `/members/{id}` | Bearer | Get a single member with stats + access info |
| `POST` | `/members` | Official | Add a standalone member by `{ name, email, group }` (idempotent on email) |
| `POST` | `/members/invite` | Official | Generate an invite link — body `{ amount, unit, group }` (unit: `hour`\|`day`\|`week`\|`year`; group: `hyper`\|`unofficial`\|`private`). Returns `{ token, link, accessDurationSeconds }` |
| `POST` | `/members/join` | — (public) | Join as an unofficial member — body `{ token, name, email, password }` (password ≥ 8 chars). Grants access for the invite duration, stores the invite's `group` and a scrypt `password_hash`; returns a local session `{ token, user }`. Refuses banned members. |
| `POST` | `/members/{id}/ban` | Official | Revoke access (`is_kicked = true`, sessions deleted); account kept. Refuses official members |
| `POST` | `/members/{id}/unban` | Official | Lift a ban (`is_kicked = false`); account + password retained |
| `POST` | `/members/{id}/extend` | Official | Extend access by `{ amount, unit }`; refuses banned members |
| `POST` | `/members/{id}/permanent` | Official | Grant permanent (non-expiring) access; refuses banned members |

### Notifications (auth required)

| Method | Path | Description |
|---|---|---|
| `GET` | `/notifications` | List notifications (newest first); optional `?unread=true` |
| `PATCH` | `/notifications/{id}` | Set `read` (body `{ "read": bool }`) |
| `POST` | `/notifications/mark-all-read` | Mark every notification as read |
| `DELETE` | `/notifications/{id}` | Delete one notification |
| `DELETE` | `/notifications` | Clear all notifications |

### Settings (auth required)

| Method | Path | Description |
|---|---|---|
| `GET` | `/settings` | Get the current user's settings |
| `PUT` | `/settings` | Upsert settings (body `{ "defaultCurrency": "NPR" }`) |

## Auth & access model

### Two member types

- **Official member** — has a `hyper_id` (joined via HYPER). Admin: permanent
  access, sees every bill, and the only ones who can manage members.
- **Unofficial member** — no `hyper_id` (joined via an invite link). Access is
  time-limited by `user.access_expires_at`; `user.is_kicked` (a **ban**) revokes
  access without deleting the account. `access_expires_at = null` = permanent
  unofficial access. They set a `password_hash` on join so they can log back in
  via `POST /auth/login-unofficial`. A `user.group` of `hyper` \| `unofficial` \|
  `private` controls which bills they can see (see above).

### Credentials

`dependency/current_user.py` resolves the current user from a Bearer token by
trying, in order:

1. A **local session token** (unofficial members) — looked up in the `session` table.
2. A **HYPER JWT** (official members) — decoded via `hyper_auth`; the local user
   is found by the JWT's `email` claim.

Access is validated on every authenticated request: banned or expired
unofficial members get `401`/`403` (the frontend then clears auth and redirects
to `/login`). Official members always pass.

`require_official` is a stricter dependency used by the member-management
endpoints (invite / ban / unban / extend / permanent / direct create).

### Passwords (unofficial members)

`dependency/passwords.py` uses stdlib `hashlib.scrypt` (N=32768, r=8, p=1) with
a random 16-byte salt. Hashes are stored as
`scrypt$<n>$<r>$<p>$<salt-hex>$<hash-hex>` so params + salt travel with the hash.
`verify_password` uses `secrets.compare_digest` for constant-time comparison.

`POST /auth/login-unofficial` runs a dummy verify when the account doesn't exist
to avoid timing-based user enumeration, and rejects:
- official accounts (`400` — "use the main login page"),
- accounts with no `password_hash` (`400` — "join via an invite link first"),
- banned members (`403` — "contact an administrator"),
- expired members (`403` — "ask an administrator to renew").

### Ban / unban

- Banning sets `is_kicked = true` and **deletes all the member's `session` rows**
  (immediate logout).
- A ban sticks: `/join`, `/extend`, and `/permanent` all refuse banned members.
  The only way back in is `POST /members/{id}/unban` (official only), which
  flips `is_kicked = false` while keeping `password_hash`, so the member can log
  in again immediately.

### HYPER login error mapping

`POST /auth/login` normalizes HYPER's `errors` object into a structured
`detail` `{ code, message, fields }`. On HYPER rejection, **no user is created
and login is blocked**.

Codes: `invalid_email`, `password_required`, `invalid_credentials`,
`hyper_unreachable`, `hyper_error`.

## Environment

| Var | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL DSN (e.g. Supabase connection string) |
| `HYPER_API_URL` | `https://api.arcademia.app` | HYPER (Arcademia) auth base URL |
| `FRONTEND_URL` | `http://localhost:3000` | Origin used to build invite join links (`/join?token=…`) |

Configure in `backend/.env` (see `.env.example` if present).

## Getting started

```bash
cd backend
uv sync                                  # Install dependencies
cp .env.example .env                     # Configure DATABASE_URL
uv run alembic upgrade head              # Apply migrations
uv run uvicorn main:server --reload --app-dir src
```

The server starts at `http://localhost:8000`. The root (`GET /`) returns
`{ "status": "yup running" }`.

## Migrations

```bash
uv run alembic revision --autogenerate -m "description"  # Create migration
uv run alembic upgrade head                                # Apply
```

Migrations in order:

1. `682c44f7c128_initial_migration` — creates the `user` table
2. `187295b79bae_chor_adding_bill_table` — creates `bill`, `billmember`, `expense`
3. `baebb5e7ca8c_add_status_and_timestamps` — adds `status` and `created_at`/`updated_at` to `bill`, and `created_at` to `expense`
4. `f1a2c3d4e5f6_add_hyper_id_and_account_type_to_user` — adds `hyper_id` (unique) and `account_type` to `user`, and a unique constraint on `email`
5. `c0ffee123456_add_notifications_and_user_settings` — creates the `notification` and `usersetting` tables
6. `d1a1b2c3d4e5_add_access_control_invite_session` — adds `access_expires_at` + `is_kicked` to `user`, creates `invite` and `session` tables
7. `a1b2c3d4e5f7_add_password_hash_to_user` — adds `password_hash` to `user` (unofficial member logins)
8. `b2c3d4e5f6a8_add_group_to_bill` — *(superseded by #9)* added `group` to `bill`
9. `c3d4e5f6a7b9_move_group_to_user_add_created_by` — moves `group` to `user` + `invite`, adds `created_by` to `bill`, drops `bill.group`
