# Invoicely Backend

FastAPI + SQLModel backend for Invoicely. Serves bills, members, notifications,
settings, and an access-management system for official (HYPER) vs unofficial
(invite-joined) members — including local passwords for unofficial logins,
group-based bill visibility, per-user notifications, and an HttpOnly-cookie
session model.

## Stack

- Python 3.13, FastAPI, SQLModel, psycopg2, PostgreSQL (Supabase)
- Alembic migrations (folder is `mighrations/` — intentional typo, see root README)
- httpx for the HYPER login proxy
- stdlib `hashlib.scrypt` for unofficial-member password hashing (no extra deps)
- In-process sliding-window rate limiter (no extra deps)

## Layout

```
src/
  main.py                  # App entry, env-driven CORS, security-headers middleware, mounts router at /api/v1
  api/
    __init__.py            # Aggregates v1 routes under /invoicely prefix
    v1/
      workflow.py          # GET /auth (legacy header-based key check, env-driven, disabled by default)
      auth.py              # HYPER login, unofficial login, /auth/me, /auth/logout — sets HttpOnly session cookie
      bills.py             # Bill CRUD + /settle (emits per-recipient notifications); group-based visibility; creator-or-official mutation authz
      members.py           # Members list/get (auth) + create/invite/join + ban/unban/extend/permanent; invite expiry + max-uses enforced
      notifications.py     # Per-user Notification CRUD + mark-all-read + push_notification helper
      settings.py          # Per-user settings (default currency), auth-required
  dependency/
    db.py                  # SQLModel engine + session_dep (DATABASE_URL validated at startup)
    auth.py                # validate_key dependency (Header 'access-key') — legacy, env-driven, fail-closed
    hyper_auth.py          # HYPER login proxy + Bearer-header helper + structured error mapping
    current_user.py        # current_user_dep (opaque session token from cookie or Bearer header) + require_official; access checks
    cookies.py             # HttpOnly/Secure/SameSite session cookie helpers; cross-domain preset
    access.py              # official/active/expired/banned helpers, duration→seconds, expiry extension, tz-safe datetime compare
    passwords.py           # scrypt hash_password / verify_password (stdlib hashlib.scrypt)
    ratelimit.py           # In-process IP rate limiting for login/join endpoints
  Schema/
    bill.py                # User (access + password_hash + group), Bill (created_by), BillMember, Expense
    notification.py        # Notification table (per-user via user_id; auto-generated on bill create/settle)
    settings.py            # UserSetting table (per-user default currency)
    invite.py              # Invite table (join links + access duration + group + expires_at + max_uses)
    session.py             # Session table (opaque session tokens for ALL members)
    api.py                 # Pydantic request/response schemas (EmailStr validation, non-negative amounts, invite caps)
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
    e2b3c4d5e6f7_per_user_notifications_and_invite_limits.py
```

## Auth model

Authentication is based **solely on backend-issued opaque session tokens**.
The backend never trusts a JWT presented by the client — the previous
"decode-the-HYPER-JWT-without-verification" path was removed (it allowed
forged tokens to authenticate as any user, including admins).

### How a session is issued

- **Official members** post `{ email, password }` to `POST /auth/login`. The
  backend forwards the credentials to HYPER **server-side**; if HYPER accepts,
  the backend upserts the local user, mints an opaque session token, stores it
  in the `session` table, sets it in an **HttpOnly cookie**, and returns the
  user. The HYPER access token is used only to confirm HYPER accepted the
  credentials and is then **discarded** — it is never sent to the client.
- **Unofficial members** set a password when accepting an invite
  (`POST /members/join`) and log back in via `POST /auth/login-unofficial`
  (email + scrypt-hashed password). The same opaque session token + cookie flow
  applies.

### How a session is presented

`dependency/current_user.py` resolves the current user from a token delivered
**either** via the `invoicely_session` HttpOnly cookie (preferred, set by the
backend) **or** — as a fallback for non-browser API clients — via an
`Authorization: Bearer <token>` header. The token is looked up in the
`session` table (the DB is the source of truth; the cookie is just a carrier).

Access is validated on every authenticated request: banned or expired
unofficial members get `401` (the frontend clears auth and redirects to
`/login`). Official members always pass. `require_official` is a stricter
dependency used by member-management endpoints.

### Logout

`POST /auth/logout` deletes the caller's `session` rows and clears the cookie.

### Cookies (cross-domain)

`dependency/cookies.py` sets an HttpOnly, Secure, SameSite cookie. For
**different registrable domains** (frontend and backend on different roots),
set `COOKIE_CROSS_DOMAIN=true` to force `SameSite=None; Secure` (required for
the browser to send the cookie cross-origin; needs HTTPS). Same-root
subdomains and localhost use the default `SameSite=Lax`. See the env table
below.

## Security

This backend was hardened against a security audit. Notable controls:

- **No client-trusted JWTs** — only backend-issued opaque session tokens are
  honored (forged JWTs are rejected with `401`).
- **HttpOnly session cookie** — the token is never exposed to JavaScript
  (mitigates XSS token theft). `Secure` + `SameSite` are configurable.
- **Authorization on every endpoint** — `/members` list/get and all bill
  mutations are auth-gated; bill edit/delete/settle require the caller to be
  the **creator or an official** (closes IDOR).
- **Per-user notifications** — `notification.user_id` scopes reads/writes to
  the owner (closes cross-user IDOR).
- **Invite expiry + max-uses** — invite links default to 7-day expiry and
  single use; both caps are enforced on `/join`.
- **Rate limiting** — `/auth/login`, `/auth/login-unofficial`, and
  `/members/join` are throttled per IP (in-memory sliding window).
- **Input validation** — `EmailStr` on email fields, `amount >= 0` on
  expenses, length bounds on passwords/names, invite amount caps.
- **No new-user minting by unofficial members** — only officials can create
  `User` rows via bills (prevents pre-claiming arbitrary emails).
- **Security headers** — `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`, default CSP via middleware.
- **Env-driven CORS** — explicit origin list (no wildcard with credentials),
  restricted methods/headers.
- **Env-driven legacy key** — the old `GET /auth` key check reads
  `LEGACY_ACCESS_KEY` from env and is **disabled by default** (fail-closed).
- **Tz-safe datetime comparison** — naive DB datetimes are coerced to UTC
  before comparison (avoids `TypeError` on SQLite/Postgres edge cases).
- **Startup validation** — `DATABASE_URL` is checked at import time.
- **Generic error messages** — login failures and 404s avoid leaking whether
  an account exists.

## Routes

All routes are mounted at `/api/v1/invoicely`. Authenticated routes accept the
`invoicely_session` HttpOnly cookie (preferred) **or** an
`Authorization: Bearer <opaque-session-token>` header.

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/login` | — | HYPER login proxy — upserts user, issues an opaque session token in an HttpOnly cookie, returns `{ user }` (the token is never in the body) |
| `POST` | `/auth/login-unofficial` | — | Unofficial login — email + password; issues a session cookie. Rejects official accounts, banned/expired members, and accounts with no password set. Rate-limited. |
| `POST` | `/auth/logout` | Cookie/Bearer | Delete the session row and clear the cookie |
| `GET` | `/auth/me` | Cookie/Bearer | Return the current user from the DB (includes `hyperId`) |
| `GET` | `/auth` | header `access-key: <LEGACY_ACCESS_KEY>` | Legacy header-based key check. **Disabled by default**; set `LEGACY_ACCESS_KEY` to enable. |

### Bills (auth required)

| Method | Path | Description |
|---|---|---|
| `POST` | `/bills` | Create a bill with members and expenses; sets `created_by` to the caller (emits `bill_added` per recipient). Only officials may mint new `User` rows. |
| `GET` | `/bills` | List bills (paginated, searchable by `title`); **filtered by the viewer's group** for unofficial members |
| `GET` | `/bills/{id}` | Get a single bill; `403` if the viewer's group doesn't grant access |
| `PATCH` | `/bills/{id}` | Update title, description, status, members, expenses. **Creator or official only** (`403` otherwise). |
| `DELETE` | `/bills/{id}` | Delete bill (cascades `bill_members`, `expenses`, related `notification`s). **Creator or official only.** |
| `POST` | `/bills/{id}/settle` | Set `status = "settled"` (emits `bill_settled` per recipient). **Creator or official only.** |

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
| `GET` | `/members` | Cookie/Bearer | List members with `billCount`, `totalPaid`, and access info (`isOfficial`, `isKicked`, `accessExpiresAt`, `accessStatus`, `group`) — paginated, searchable |
| `GET` | `/members/{id}` | Cookie/Bearer | Get a single member with stats + access info |
| `POST` | `/members` | Official | Add a standalone member by `{ name, email, group }` (idempotent on email) |
| `POST` | `/members/invite` | Official | Generate an invite link — body `{ amount, unit, group, expiresInSeconds?, maxUses? }` (unit: `hour`\|`day`\|`week`\|`year`; group: `hyper`\|`unofficial`\|`private`). Defaults: 7-day expiry, single use. Returns `{ token, link, accessDurationSeconds }`. |
| `POST` | `/members/join` | — (public) | Join as an unofficial member — body `{ token, name, email, password }` (password ≥ 8 chars). Enforces the invite's `expires_at` and `max_uses`; grants access for the invite duration; stores the invite's `group` and a scrypt `password_hash`; sets a session cookie and returns `{ alreadyOfficial, user }`. Refuses banned members. Rate-limited. |
| `POST` | `/members/{id}/ban` | Official | Revoke access (`is_kicked = true`, sessions deleted); account kept. Refuses official members |
| `POST` | `/members/{id}/unban` | Official | Lift a ban (`is_kicked = false`); account + password retained |
| `POST` | `/members/{id}/extend` | Official | Extend access by `{ amount, unit }`; refuses banned members |
| `POST` | `/members/{id}/permanent` | Official | Grant permanent (non-expiring) access; refuses banned members |

### Notifications (auth required — scoped to the current user)

| Method | Path | Description |
|---|---|---|
| `GET` | `/notifications` | List the current user's notifications (newest first); optional `?unread=true` |
| `PATCH` | `/notifications/{id}` | Set `read` (body `{ "read": bool }`); `404` if the notification belongs to another user |
| `POST` | `/notifications/mark-all-read` | Mark the current user's unread notifications as read |
| `DELETE` | `/notifications/{id}` | Delete one of the current user's notifications |
| `DELETE` | `/notifications` | Clear all of the current user's notifications |

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

`dependency/current_user.py` resolves the current user from an **opaque session
token** (delivered via the HttpOnly cookie or the `Authorization: Bearer`
header) by looking it up in the `session` table. There is **no JWT decoding
path** — client-presented JWTs are not trusted. Access is validated on every
authenticated request: banned or expired unofficial members get `401`. Official
members always pass. `require_official` is a stricter dependency used by the
member-management endpoints.

### Passwords (unofficial members)

`dependency/passwords.py` uses stdlib `hashlib.scrypt` (N=32768, r=8, p=1) with
a random 16-byte salt. Hashes are stored as
`scrypt$<n>$<r>$<p>$<salt-hex>$<hash-hex>` so params + salt travel with the hash.
`verify_password` uses `secrets.compare_digest` for constant-time comparison.

`POST /auth/login-unofficial` runs a dummy verify when the account doesn't exist
to avoid timing-based user enumeration, returns a single generic
`"Invalid email or password"` on failure, and rejects:
- official accounts (`400` — "use the main login page"),
- accounts with no `password_hash` (`400` — "join via an invite link first"),
- banned members (`403` — "contact an administrator"),
- expired members (`403` — "ask an administrator to renew").

### Ban / unban

- Banning sets `is_kicked = true` and **deletes all the member's `session` rows**
  (immediate logout, even for already-issued cookies).
- A ban sticks: `/join`, `/extend`, and `/permanent` all refuse banned members.
  The only way back in is `POST /members/{id}/unban` (official only), which
  flips `is_kicked = false` while keeping `password_hash`, so the member can log
  in again immediately.

### HYPER login error mapping

`POST /auth/login` normalizes HYPER's `errors` object into a structured
`detail` `{ code, message, fields }` and does **not** echo HYPER's raw body or
transport errors. On HYPER rejection, **no user is created and login is
blocked**.

Codes: `invalid_email`, `password_required`, `invalid_credentials`,
`hyper_unreachable`, `hyper_error`.

## Environment

Configure in `backend/.env` (see `.env.example`).

| Var | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL DSN (e.g. Supabase connection string). Required; app refuses to start without it. |
| `HYPER_API_URL` | `https://api.arcademia.app` | HYPER (Arcademia) auth base URL |
| `FRONTEND_URL` | `http://localhost:3000` | Origin used to build invite join links (`/join?token=…`) |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated list of allowed frontend origins. **No wildcards** (credentials require explicit origins). |
| `COOKIE_CROSS_DOMAIN` | `false` | `true` for different registrable domains → forces `SameSite=None; Secure` (needs HTTPS) |
| `COOKIE_SECURE` | `false` | `true` to set the `Secure` flag (HTTPS only). Implied by `COOKIE_CROSS_DOMAIN`. |
| `COOKIE_SAMESITE` | `lax` | `lax` \| `strict` \| `none` (ignored when `COOKIE_CROSS_DOMAIN=true`). `none` requires `Secure`. |
| `COOKIE_NAME` | `invoicely_session` | Session cookie name |
| `COOKIE_DOMAIN` | — | Optional shared parent domain (only when frontend+backend share a root) |
| `COOKIE_MAX_AGE` | `2592000` (30d) | Cookie max-age in seconds |
| `LEGACY_ACCESS_KEY` | — | Key for the legacy `GET /auth` route. **Unset = endpoint disabled (fail-closed).** |
| `RATELIMIT_LOGIN` | `10` | Login attempts per IP per window |
| `RATELIMIT_LOGIN_WINDOW` | `60` | Login rate-limit window (seconds) |
| `RATELIMIT_JOIN` | `5` | Join attempts per IP per window |
| `RATELIMIT_JOIN_WINDOW` | `60` | Join rate-limit window (seconds) |

## Getting started

```bash
cd backend
uv sync                                  # Install dependencies
cp .env.example .env                     # Configure DATABASE_URL (+ CORS/cookies for prod)
uv run alembic upgrade head              # Apply migrations
uv run uvicorn main:server --reload --app-dir src
```

The server starts at `http://localhost:8000`. The root (`GET /`) returns
`{ "status": "yup running" }`.

For local dev, `COOKIE_CROSS_DOMAIN` can stay unset (localhost shares a
registrable domain across ports, so `SameSite=Lax` works over HTTP).

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
10. `e2b3c4d5e6f7_per_user_notifications_and_invite_limits` — adds `notification.user_id` (indexed + FK), `invite.expires_at`, `invite.max_uses`
