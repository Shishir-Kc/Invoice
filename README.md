# Invoicely — Shared Expense Tracker

A splitwise-style web app for splitting bills and tracking shared expenses. Built with FastAPI (Python) and Next.js (TypeScript), deployable to Cloudflare Pages.

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.13, FastAPI, SQLModel, psycopg2, PostgreSQL (Supabase) |
| Migrations | Alembic |
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui (Radix + Base UI) |
| State / data | TanStack Query, React Hook Form, Zod |
| UI helpers | lucide-react, recharts, date-fns, clsx, tailwind-merge, class-variance-authority |
| Auth | HYPER (Arcademia) for **official** members; **unofficial** members use a local email+password account set on invite acceptance. Sessions are backend-issued **opaque tokens in HttpOnly cookies** (no client-trusted JWTs, no token in JS) |
| Deploy | Cloudflare Pages via `@opennextjs/cloudflare` + `wrangler` |

## Project Structure

```
backend/                       # FastAPI backend
  src/
    main.py                    # App entry, env-driven CORS, security-headers middleware, mounts router at /api/v1
    api/
      __init__.py              # Aggregates v1 routes under /invoicely prefix
      v1/
        workflow.py            # GET /auth (legacy header-based key check, env-driven, disabled by default)
        auth.py                # HYPER login (/auth/login), unofficial login (/auth/login-unofficial), /auth/me, /auth/logout — sets HttpOnly session cookie
        bills.py               # Bill CRUD + /settle (emits per-recipient notifications); group-based visibility filtering; creator-or-official mutation authz
        members.py             # Members list (auth) + create/invite/join + ban/unban/extend/permanent; invite expiry + max-uses enforced
        notifications.py       # Per-user Notification CRUD + mark-all-read + push_notification helper
        settings.py            # Per-user settings (default currency), auth-required
    dependency/
      db.py                    # SQLModel engine + session_dep (DATABASE_URL validated at startup)
      auth.py                  # validate_key dependency (Header 'access-key') — legacy, env-driven, fail-closed
      hyper_auth.py            # HYPER login proxy + Bearer-header helper + structured error mapping
      current_user.py          # current_user_dep (opaque session token from cookie or Bearer header) + require_official; access checks
      cookies.py               # HttpOnly/Secure/SameSite session cookie helpers; cross-domain preset
      access.py                # official/active/expired/banned helpers, duration→seconds, expiry extension, tz-safe datetime compare
      passwords.py             # scrypt password hashing/verification for unofficial members (stdlib hashlib)
      ratelimit.py             # In-process IP rate limiting for login/join endpoints
    Schema/
      bill.py                  # User (access + password_hash + group), Bill (created_by), BillMember, Expense
      notification.py          # Notification table (per-user via user_id)
      settings.py              # UserSetting table (per-user default currency)
      invite.py                # Invite table (join links + access duration + group + expires_at + max_uses)
      session.py               # Session table (opaque session tokens for ALL members)
      api.py                   # Pydantic request/response schemas (EmailStr validation, non-negative amounts, invite caps)
      user.py                  # Placeholder
  mighrations/                 # Alembic migrations (note: folder typo is intentional)
    env.py
    versions/
      682c44f7c128_initial_migration.py         # user table
      187295b79bae_chor_adding_bill_table.py    # bill, billmember, expense
      baebb5e7ca8c_add_status_and_timestamps.py # status + timestamps
      f1a2c3d4e5f6_add_hyper_id_and_account_type_to_user.py # hyper_id, account_type
      c0ffee123456_add_notifications_and_user_settings.py    # notification, usersetting tables
      d1a1b2c3d4e5_add_access_control_invite_session.py      # user access fields, invite, session tables
      a1b2c3d4e5f7_add_password_hash_to_user.py             # password_hash on user (unofficial logins)
      b2c3d4e5f6a8_add_group_to_bill.py                     # (superseded) group on bill
      c3d4e5f6a7b9_move_group_to_user_add_created_by.py     # group on user/invite, created_by on bill, drop bill.group
      e2b3c4d5e6f7_per_user_notifications_and_invite_limits.py # notification.user_id, invite.expires_at, invite.max_uses
  alembic.ini
  pyproject.toml
  .env                         # DATABASE_URL + CORS/cookie/ratelimit config live here

frontend/                      # Next.js frontend
  src/
    app/
      layout.tsx               # Root layout, fonts, dark theme, favicon metadata; wraps app in Providers
      icon.svg                 # Favicon — black rounded-square badge with a white dollar sign
      globals.css              # Tailwind 4 entry
      login/                   # HYPER login page (email/password + "Unofficial" button to /login/unofficial)
        unofficial/page.tsx    # Dedicated email+password login for unofficial members
      join/                    # Public invite-acceptance page (name + email + password + confirm)
      (dashboard)/             # Authed route group (guarded by AuthGuard)
        layout.tsx             # Wraps in DashboardShell (auth-guarded)
        page.tsx               # Dashboard (stats, recent bills, spending chart)
        bills/
          page.tsx             # Bill list with search
          create/page.tsx      # Create bill form (full-screen "Creating bill…" indicator while saving)
          [id]/
            view/page.tsx      # Bill detail with balances & settlements
            edit/page.tsx      # Edit bill form (MemberPicker prefilled from the bill)
        members/page.tsx       # Members in two sections (Official / Unofficial); unofficial section hidden when empty; ban/unban dialog
        notifications/page.tsx # Notification feed
        settings/page.tsx      # Profile + default currency
    components/
      providers.tsx            # Theme + Auth + Query + Notification providers; DashboardShell + AuthGuard
      auth-provider.tsx        # AuthProvider + useAuth() — HttpOnly cookie auth; caches the user (not the token) in localStorage
      auth-error-notification.tsx # Login error toast (invalid email / credentials / password)
      query-provider.tsx       # TanStack Query client
      theme-provider.tsx       # next-themes
      notification-provider.tsx# Backed by the real /notifications API via TanStack Query (polls every 15s)
      notification-toast.tsx   # Bottom-right toast popups
      member-picker.tsx        # Checkbox member selector (banned excluded) + inline add-new-member with group (official only)
      invite-dialog.tsx        # Add Member dialog — invite link with access expiry + group selector
      ban-dialog.tsx           # Confirmation popup for Ban / Unban (replaces native confirm)
      extend-dialog.tsx        # Extend an unofficial member's access by hour/day/week/year
      layout/
        app-sidebar.tsx        # Sidebar nav + user dropdown (shows real HYPER user + logout)
        header.tsx             # Breadcrumb header with SidebarTrigger
        sidebar.tsx
      ui/                      # shadcn/ui primitives
        avatar.tsx, badge.tsx, breadcrumb.tsx, button.tsx, card.tsx,
        collapsible.tsx, dropdown-menu.tsx, input.tsx, label.tsx,
        select.tsx, separator.tsx, sheet.tsx, sidebar.tsx, skeleton.tsx,
        textarea.tsx, tooltip.tsx
    lib/
      api.ts                   # Axios client (billApi, authApi, memberApi, notificationApi, settingsApi) + withCredentials cookie + authApi.logout + 401 interceptor
      utils.ts                 # cn, formatCurrency (NPR), date + balance math
      validations.ts           # Zod schemas for forms
    hooks/
      use-mobile.ts
    types/
      index.ts                 # Member, MemberWithStats, Expense, Bill, BillGroup, Settlement, Notification, UserSetting
  components.json              # shadcn config
  next.config.ts
  wrangler.toml                # Cloudflare Pages config
  AGENTS.md                    # Frontend-specific agent rules + deploy commands
```

> Note: the backend directory is named `mighrations/` (not `migrations/`). The typo is preserved to keep Alembic's `alembic.ini` `script_location` path valid. Renaming it requires updating `alembic.ini` and the migration history.

## Data Model

SQLModel tables defined in `backend/src/Schema/bill.py` and `Schema/invite.py`:

| Table | Columns | Relationships |
|---|---|---|
| `user` | `id` (uuid PK), `name`, `email` (unique), `hyper_id` (unique, nullable), `account_type` (nullable), `access_expires_at` (nullable; null = permanent), `is_kicked` (bool; a ban), `password_hash` (nullable; unofficial members only), `group` (default `"unofficial"`) | has many `bill_members`, `expenses_paid`; creates many `bill` (via `bill.created_by`) |
| `bill` | `id` (uuid PK), `title`, `description`, `status` (default `"open"`), `created_by` (FK→user, nullable), `created_at`, `updated_at` | has many `bill_members`, `expenses` |
| `billmember` | `id` (uuid PK), `bill_id` (FK→bill), `user_id` (FK→user) | has many `expenses_paid` |
| `expense` | `id` (uuid PK), `description`, `amount` (Numeric(12,2)), `created_at`, `bill_id` (FK→bill), `paid_by_member_id` (FK→billmember), `paid_by_user_id` (FK→user) | belongs to `bill`, `paid_by_member`, `paid_by_user` |
| `notification` | `id` (uuid PK), `type`, `title`, `description`, `bill_id` (FK→bill, nullable), `user_id` (FK→user, indexed; the recipient — notifications are per-user), `read` (default `false`), `created_at` | belongs to `bill` (nullable) + `user`. Auto-generated on bill create (`bill_added`) and settle (`bill_settled`), one row per recipient |
| `usersetting` | `user_id` (uuid PK, FK→user), `default_currency` (default `"NPR"`) | belongs to `user` |
| `invite` | `id` (uuid PK), `token` (unique), `created_by` (FK→user), `access_duration_seconds` (int), `group` (default `"unofficial"`), `created_at`, `use_count`, `expires_at` (nullable; when the link itself becomes invalid), `max_uses` (nullable; cap on joins) | Invite links generated by official members; joining via a token grants access for `access_duration_seconds` and assigns the invite's `group`. Links default to 7-day expiry + single use; both caps are enforced on `/join`. |
| `session` | `token` (str PK), `user_id` (FK→user, indexed), `created_at` | Opaque session tokens for **all** members (official and unofficial). The backend issues one on login/join and looks it up on every request; the token is delivered to the browser via an HttpOnly cookie, never via JS |

### Member access & groups

- **Official member** = has a `hyper_id` (joined via HYPER). Admin: permanent access, sees every bill, and the only ones who can manage members (invite / ban / unban / extend / permanent).
- **Unofficial member** = no `hyper_id` (joined via an invite link). Access is time-limited by `access_expires_at`; `is_kicked` (a **ban**) revokes access without deleting the account. `access_expires_at = null` = permanent unofficial access. They set a `password_hash` on join so they can log back in via the unofficial login page.
- Access is validated on every authenticated request (`dependency/current_user.py`); banned/expired unofficial members get `401`/`403`.
- **Visibility group** (`user.group`, one of `hyper` \| `unofficial` \| `private`) controls which bills an unofficial member can see:

  | Member group | Bills visible |
  |---|---|
  | `hyper` | All bills created by official members |
  | `unofficial` | Bills that include at least one unofficial member |
  | `private` | Only bills the member is a `billmember` of |

  Officials always see every bill. The group is assigned when the member is added (via the invite dialog or inline add-member form) and stored on the invite + the user.

### Ban / unban

- Banning sets `is_kicked = true` and **deletes all the member's `session` rows** (immediate logout).
- A ban sticks: `/join`, `/extend`, and `/permanent` all refuse banned members with a `403`/`400` ("contact an administrator / unban them first"). The only way back in is an official calling **Unban** (`POST /members/{id}/unban`), which flips `is_kicked = false` (their `password_hash` is retained, so they can log in again immediately).
- Banned members are excluded from the bill-splitting member picker on the frontend.

`status` is a free-form string with two observed values: `open` and `settled`. Bill members are looked up by email. **Only official members may mint new `User` rows** via bill create/update — an unofficial member referencing a non-existent email gets a `400` (this prevents any authenticated user from pre-claiming arbitrary emails / polluting the member directory). Deleting a bill also removes its `bill_members`, `expenses`, and any `notification`s referencing it.

## Backend API

Mounted at `/api/v1/invoicely` (see `backend/src/main.py` and `backend/src/api/__init__.py`).

| Method | Path | Description |
|---|---|---|
| `POST` | `/bills` | Create a bill with members and expenses; sets `created_by` to the caller (emits `bill_added` per recipient). Only officials may mint new `User` rows. |
| `GET` | `/bills` | List bills (paginated, searchable by `title`); **filtered by the viewer's group** for unofficial members |
| `GET` | `/bills/{id}` | Get a single bill; `403` if the viewer's group doesn't grant access |
| `PATCH` | `/bills/{id}` | Update title, description, status, members, expenses. **Creator or official only** (`403` otherwise) |
| `DELETE` | `/bills/{id}` | Delete bill (cascades `bill_members`, `expenses`, and related `notification`s). **Creator or official only** |
| `POST` | `/bills/{id}/settle` | Set `status = "settled"` (also emits a `bill_settled` notification per recipient). **Creator or official only** |
| `GET` | `/members` | List members with `billCount` + `totalPaid` + access info (`isOfficial`, `isKicked`, `accessExpiresAt`, `accessStatus`, `group`) — paginated, searchable. **Auth required** (was previously public) |
| `GET` | `/members/{id}` | Get a single member with stats + access info. **Auth required** |
| `POST` | `/members` | Add a standalone member by `{ name, email, group }` (official only; idempotent on email) |
| `POST` | `/members/invite` | Generate an invite link — body `{ amount, unit, group, expiresInSeconds?, maxUses? }` where unit is `hour`\|`day`\|`week`\|`year` (official only). Defaults: 7-day expiry, single use. Returns `{ token, link, accessDurationSeconds }` |
| `POST` | `/members/join` | **Public.** Join as an unofficial member — body `{ token, name, email, password }` (password ≥ 8 chars). Enforces the invite's `expires_at` and `max_uses`; grants access for the invite duration, stores the invite's `group` and a scrypt `password_hash`; sets a session cookie and returns `{ alreadyOfficial, user }`. Refuses banned members. Rate-limited. |
| `POST` | `/members/{id}/ban` | Revoke a member's access (`is_kicked = true`, sessions deleted); account kept (official only; cannot ban officials) |
| `POST` | `/members/{id}/unban` | Lift a ban (`is_kicked = false`); account + password retained (official only) |
| `POST` | `/members/{id}/extend` | Extend access by `{ amount, unit }`; refuses banned members (official only) |
| `POST` | `/members/{id}/permanent` | Grant permanent (non-expiring) access; refuses banned members (official only) |
| `GET` | `/notifications` | List the current user's notifications (newest first); optional `?unread=true` filter. Scoped to the caller (`user_id`). |
| `PATCH` | `/notifications/{id}` | Set `read` (body `{ "read": bool }`); `404` if the notification belongs to another user |
| `POST` | `/notifications/mark-all-read` | Mark the current user's unread notifications as read |
| `DELETE` | `/notifications/{id}` | Delete one of the current user's notifications |
| `DELETE` | `/notifications` | Clear all of the current user's notifications |
| `GET` | `/settings` | Get the current user's settings (session cookie / Bearer required) |
| `PUT` | `/settings` | Upsert the current user's settings (session cookie / Bearer required; body `{ "defaultCurrency": "NPR" }`) |
| `POST` | `/auth/login` | HYPER login proxy — upserts user, issues an opaque session token in an **HttpOnly cookie**, returns `{ user }` (the token is never in the body). The HYPER JWT is used only server-side to verify credentials and is then discarded. Rate-limited. |
| `POST` | `/auth/login-unofficial` | Unofficial login — email + password; issues a session cookie. Rejects official accounts, banned/expired members, and accounts with no password set. Rate-limited. |
| `POST` | `/auth/logout` | Delete the session row and clear the cookie |
| `GET` | `/auth/me` | Return the current user from the DB (authenticated via the session cookie / Bearer; includes `hyperId`) |
| `GET` | `/auth` | Legacy header-based key check (header `access-key: <LEGACY_ACCESS_KEY>`). **Disabled by default**; set `LEGACY_ACCESS_KEY` to enable. |

> Bill create (`POST /bills`) and settle (`POST /bills/{id}/settle`) automatically create **one `notification` row per recipient** (`bill_added` / `bill_settled`) describing the event; recipients are the bill's members + creator.

### Query parameters for `GET /bills`

| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | Case-insensitive `ilike` match on `title` |
| `page` | int | `1` | 1-indexed |
| `pageSize` | int | `10` | Max `100` |

Response shape (`PaginatedResponse` from `Schema/api.py`):
```json
{
  "data": [Bill, ...],
  "total": 0,
  "page": 1,
  "pageSize": 10,
  "totalPages": 1
}
```

### Create bill request body

`POST /api/v1/invoicely/bills` (`CreateBillRequest`):

```json
{
  "title": "Weekend Groceries",
  "description": "Costco run",
  "members": [
    { "id": "client-uuid", "name": "Alice", "email": "alice@example.com" }
  ],
  "expenses": [
    { "description": "Groceries", "amount": 156.73, "paidBy": "client-uuid", "date": "2026-06-08" }
  ]
}
```

> `members[].id` and `expenses[].paidBy` are client-side UUIDs (e.g. `crypto.randomUUID()` on the frontend). The backend maps them to the created `BillMember` ids internally. `expense.date` is optional; when omitted, `created_at` defaults to `now()`.

### Update bill request body

`PATCH /api/v1/invoicely/bills/{id}` (`UpdateBillRequest`) — all fields optional:

```json
{
  "title": "Renamed",
  "description": "...",
  "status": "open",
  "members": [ { "id": "client-uuid", "name": "Alice", "email": "alice@example.com" } ],
  "expenses": [ { "description": "Groceries", "amount": 156.73, "paidBy": "client-uuid", "date": "2026-06-08" } ]
}
```

When `members` and `expenses` are both supplied, existing `bill_members` and `expenses` rows for the bill are deleted and recreated. Other fields update in place and bump `updated_at`.

### Response shapes

`ApiResponse<T>` (used for create, update, delete, settle):
```json
{ "success": true, "data": { ... }, "message": "Bill created" }
```

`BillOut` (returned inside `data` / list entries):
```json
{
  "id": "uuid",
  "title": "...",
  "description": "...",
  "members": [{ "id": "uuid", "name": "Alice", "email": "alice@example.com" }],
  "expenses": [{ "id": "uuid", "description": "...", "amount": 156.73, "paidBy": "uuid", "date": "2026-06-08" }],
  "status": "open",
  "createdAt": "2026-06-08T10:00:00+00:00",
  "updatedAt": "2026-06-08T10:00:00+00:00"
}
```

## Auth

Authentication is based solely on **backend-issued opaque session tokens**
delivered to the browser via an **HttpOnly, Secure, SameSite cookie**. The
backend never trusts a JWT presented by the client — the previous
"decode-the-HYPER-JWT-without-verification" path was removed during a security
hardening pass (it allowed forged tokens to authenticate as any user,
including admins). The HYPER JWT is used only server-side, inside the login
proxy, to confirm HYPER accepted the credentials; it is then discarded and
never sent to the client.

### Official members — HYPER (Arcademia)

Authentication for official members is delegated to the external HYPER service at `https://api.arcademia.app/api/auth/login`. The backend proxies login, verifies the HYPER response server-side, mirrors HYPER users into the local `user` table, and issues its own session token.

**Login flow:**
1. Frontend posts `{ email, password }` → `POST /auth/login` (from `/login`).
2. Backend (`dependency/hyper_auth.py`) forwards the credentials to HYPER.
   - **If HYPER rejects** (invalid email, wrong password, non-existent user, network error) the backend raises an `HTTPException` with a structured `detail` and **no user is created**.
   - **If HYPER succeeds**, the backend looks up a local `user` by `email` **or** `hyper_id`: found → syncs missing HYPER fields; not found → creates one. It then mints an opaque session token, stores it in the `session` table, and sets it in an HttpOnly cookie.
3. Returns `{ user }` wrapped in `ApiResponse`. **The token is not in the response body** — it lives only in the cookie.

**HYPER error codes** (`code`/`message` in `detail`): `invalid_email`, `password_required`, `invalid_credentials`, `hyper_unreachable`, `hyper_error`.

### Unofficial members — local email + password

Unofficial members don't use HYPER. They set a password when accepting an invite (`/join`) and log back in via the dedicated unofficial login.

- `/join` (public): body `{ token, name, email, password }` (password ≥ 8 chars). Enforces the invite's `expires_at` and `max_uses`; stores a scrypt `password_hash` (via `dependency/passwords.py`, stdlib `hashlib.scrypt` — no extra deps), assigns the invite's `group`, issues a session token in an HttpOnly cookie, and returns `{ alreadyOfficial, user }`. Refuses banned members. Rate-limited.
- `/auth/login-unofficial`: body `{ email, password }`. Verifies the password with `secrets.compare_digest` (runs a dummy verify when the account doesn't exist to avoid timing-based enumeration) and returns a single generic "Invalid email or password" on failure. Rejects official accounts ("use the main login page"), accounts with no password set, and banned/expired members (`403`). On success issues a session cookie. Rate-limited.
- `/auth/logout` deletes the session row and clears the cookie.
- The `/login` page has an **"Unofficial"** button linking to `/login/unofficial`, the dedicated email+password form.

### Credentials & request auth

`dependency/current_user.py` resolves the current user from an **opaque session token** delivered **either** via the `invoicely_session` HttpOnly cookie (preferred, set by the backend) **or** — as a fallback for non-browser API clients — an `Authorization: Bearer <token>` header. The token is looked up in the `session` table (the DB is the source of truth; the cookie is just a carrier). **There is no JWT decoding path** — client-presented JWTs are not trusted.

Access is validated on every authenticated request: banned or expired unofficial members get `401` (the frontend clears auth and redirects to `/login`). Official members always pass. `require_official` is a stricter dependency used by member-management endpoints.

### Cookies (cross-domain)

`dependency/cookies.py` sets an HttpOnly, Secure, SameSite cookie. For **different registrable domains** (frontend and backend on different roots, e.g. `invoicely.pages.dev` + `api.invoicely.dev`), set `COOKIE_CROSS_DOMAIN=true` on the backend to force `SameSite=None; Secure` (required for the browser to send the cookie cross-origin; needs HTTPS). Same-root subdomains and localhost use the default `SameSite=Lax`. Cookie name, domain, and max-age are configurable — see the env table below.

### Frontend auth

- `AuthProvider` (`frontend/src/components/auth-provider.tsx`) caches the (non-secret) **user** object in `localStorage` (`invoicely_user`) for an instant first paint, then re-validates against `GET /auth/me` (authenticated via the cookie). **The session token is never in JS** — it lives in the HttpOnly cookie. `useAuth()` exposes `login(user)` and an async `logout()`.
- The axios client (`frontend/src/lib/api.ts`) uses `withCredentials: true` so the browser sends the cookie; there is no `Authorization` header interceptor. On a `401` from authed pages, it clears the cached user and redirects to `/login` (public pages `/login*` and `/join` are exempt).
- `DashboardShell` wraps the dashboard route group in an `AuthGuard`.
- `useAuth().user.hyperId` distinguishes official from unofficial on the client — only official users see member-management UI (Add Member dialog, ban/unban/extend/permanent menus).
- The sidebar shows the real user's name/email/initials and a "Log out" action that calls `POST /auth/logout`.

### Legacy key check

The original header-based check is still mounted at `GET /api/v1/invoicely/auth` (`backend/src/dependency/auth.py`, `validate_key`). The key is now read from the `LEGACY_ACCESS_KEY` env var (no hardcoded secret) and the endpoint is **disabled by default** (fail-closed when the var is unset). It is unused by the frontend and retained for backwards compatibility.

The CORS config in `backend/src/main.py` is env-driven (`CORS_ORIGINS`, comma-separated, **no wildcards** — credentials require explicit origins) and restricts methods/headers. A security-headers middleware adds `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and a default CSP.

## Frontend Architecture

### Providers (`frontend/src/components/providers.tsx`)

`Providers` (mounted in the root layout):
```
ThemeProvider
  └─ AuthProvider             (HttpOnly cookie auth; caches user, not token, in localStorage; useAuth())
       └─ QueryProvider       (TanStack Query)
            └─ NotificationProvider (real /notifications API, polls every 15s)
                 └─ children
```

`DashboardShell` (used by the `(dashboard)` route group) wraps children in:
```
AuthGuard                      (redirects to /login when unauthenticated)
  └─ SidebarProvider
       ├─ Sidebar > AppSidebar (nav + user dropdown + logout)
       └─ SidebarInset
            ├─ Header          (breadcrumb + SidebarTrigger)
            ├─ main            (page content)
            └─ NotificationToast (bottom-right toasts)
```

### Pages

| Route | File | Purpose |
|---|---|---|
| `/login` | `app/login/page.tsx` | HYPER login form (email/password) + error toast; an **"Unofficial"** button links to the unofficial login. Redirects to `/` if already authenticated |
| `/login/unofficial` | `app/login/unofficial/page.tsx` | Dedicated email+password login for unofficial members (calls `/auth/login-unofficial`) |
| `/join` | `app/join/page.tsx` | **Public.** Invite-acceptance form (name + email + password + confirm) for unofficial members; stores a local session token and redirects to `/` |
| `/` | `app/(dashboard)/page.tsx` | Dashboard: total bills, total spent, members, settled % + recharts area chart + recent bills |
| `/bills` | `app/(dashboard)/bills/page.tsx` | Bill list with search (filtered server-side by the viewer's group) |
| `/bills/create` | `app/(dashboard)/bills/create/page.tsx` | Create bill form — MemberPicker, expense rows, live total/share; full-screen "Creating bill…" indicator while the backend processes the request; refetches the bills list on success |
| `/bills/{id}/view` | `app/(dashboard)/bills/[id]/view/page.tsx` | Bill detail, member balances, settlement suggestions, Settle Up action |
| `/bills/{id}/edit` | `app/(dashboard)/bills/[id]/edit/page.tsx` | Edit form prefilled from `billApi.get` |
| `/members` | `app/(dashboard)/members/page.tsx` | Members in two sections — **Official** and **Unofficial** (the unofficial section is hidden when empty); each unofficial member shows a group badge and a 3-dot menu (Extend / Make permanent / **Ban**, plus **Unban** when banned) |
| `/notifications` | `app/(dashboard)/notifications/page.tsx` | Notification feed with read/unread toggling (backed by /notifications) |
| `/settings` | `app/(dashboard)/settings/page.tsx` | Profile (read-only from HYPER) + default currency saved via /settings |

### Favicon

`frontend/src/app/icon.svg` — a black (`#0a0a0a`) rounded-square badge with a white dollar sign. Next.js's app router auto-detects `app/icon.svg` and serves it as the favicon (also referenced explicitly in `layout.tsx` `metadata.icons`).

### Notifications

`NotificationProvider` is backed by the real `/notifications` endpoint via TanStack Query (polling every 15s). The newest notification since mount is surfaced as a toast via `NotificationToast` (auto-dismissed after 5s); the sidebar shows an unread badge (max `9+`). Bill create and settle events generate `bill_added` / `bill_settled` notifications server-side.

### Key utilities (`frontend/src/lib/utils.ts`)

- `cn(...)` — Tailwind class merge via `clsx` + `tailwind-merge`
- `formatCurrency(amount, currency = "NPR")` — `Intl.NumberFormat("en-IN", ...)`
- `formatDate` / `formatDateShort` — `Intl.DateTimeFormat("en-US", ...)`
- `calculateTotalExpenses`, `calculateShare`, `calculateMemberBalance` — bill math
- `calculateSettlements` — greedy min-transaction settlement algorithm
- `debounce(fn, delay)` — generic trailing-edge debounce

### Validation (`frontend/src/lib/validations.ts`)

Zod schemas: `memberSchema`, `expenseSchema`, `createBillSchema`, `updateBillSchema` with inferred form-data types.

### Types (`frontend/src/types/index.ts`)

`Member`, `MemberWithStats` (with `accessStatus` including `banned` and a `group: BillGroup`), `Expense`, `Bill`, `BillStatus`, `BillGroup = "hyper" | "unofficial" | "private"`, `Settlement`, `ApiResponse<T>`, `PaginatedResponse<T>`, `CreateBillInput`, `UpdateBillInput`, `Notification`, `NotificationType`.

## Environment Variables

| Var | Where | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | `backend/.env` | — | PostgreSQL DSN (e.g. Supabase connection string). Required; app refuses to start without it. |
| `HYPER_API_URL` | `backend` env | `https://api.arcademia.app` | HYPER (Arcademia) auth base URL |
| `NEXT_PUBLIC_API_URL` | `frontend` runtime | `http://localhost:8000/api/v1/invoicely` | Base URL for the axios client (`frontend/src/lib/api.ts`) |
| `FRONTEND_URL` | `backend` env | `http://localhost:3000` | Origin used to build invite join links (`/join?token=…`) returned by `POST /members/invite` |
| `CORS_ORIGINS` | `backend` env | `http://localhost:3000` | Comma-separated allowed frontend origins. **No wildcards** (credentials require explicit origins). |
| `COOKIE_CROSS_DOMAIN` | `backend` env | `false` | `true` for different registrable domains → forces `SameSite=None; Secure` (needs HTTPS) |
| `COOKIE_SECURE` | `backend` env | `false` | `true` to set the `Secure` flag (HTTPS only). Implied by `COOKIE_CROSS_DOMAIN`. |
| `COOKIE_SAMESITE` | `backend` env | `lax` | `lax` \| `strict` \| `none` (ignored when `COOKIE_CROSS_DOMAIN=true`). `none` requires `Secure`. |
| `COOKIE_NAME` | `backend` env | `invoicely_session` | Session cookie name |
| `COOKIE_DOMAIN` | `backend` env | — | Optional shared parent domain (only when frontend+backend share a root) |
| `COOKIE_MAX_AGE` | `backend` env | `2592000` (30d) | Cookie max-age in seconds |
| `LEGACY_ACCESS_KEY` | `backend` env | — | Key for the legacy `GET /auth` route. **Unset = endpoint disabled (fail-closed).** |
| `RATELIMIT_LOGIN` / `RATELIMIT_LOGIN_WINDOW` | `backend` env | `10` / `60` | Login attempts per IP / window (seconds) |
| `RATELIMIT_JOIN` / `RATELIMIT_JOIN_WINDOW` | `backend` env | `5` / `60` | Join attempts per IP / window (seconds) |

## Getting Started

### Prerequisites
- Python 3.13+ with [uv](https://docs.astral.sh/uv/)
- Node.js 20+
- PostgreSQL (or a Supabase connection string)

### Backend

```bash
cd backend
uv sync                                  # Install dependencies
cp .env.example .env                     # Configure DATABASE_URL (+ CORS/cookies for prod)
uv run alembic upgrade head              # Apply migrations
uv run uvicorn main:server --reload --app-dir src
```

For local dev, `COOKIE_CROSS_DOMAIN` can stay unset (localhost shares a
registrable domain across ports, so `SameSite=Lax` works over HTTP). For
production where frontend and backend are on **different registrable domains**,
set `CORS_ORIGINS` to the frontend origin and `COOKIE_CROSS_DOMAIN=true` (needs
HTTPS) — see the env table above.```

### Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1/invoicely npm run dev
```

The frontend starts at `http://localhost:3000` and the backend at `http://localhost:8000`. The backend's root (`GET /`) returns `{ "status": "yup running" }` as a liveness check.

## Database

Migrations live in `backend/mighrations/versions/`:

```bash
cd backend
uv run alembic revision --autogenerate -m "description"  # Create migration
uv run alembic upgrade head                                # Apply
```

Existing migrations in order:
1. `682c44f7c128_initial_migration` — creates the `user` table
2. `187295b79bae_chor_adding_bill_table` — creates `bill`, `billmember`, `expense`
3. `baebb5e7ca8c_add_status_and_timestamps` — adds `status` and `created_at`/`updated_at` to `bill`, and `created_at` to `expense`
4. `f1a2c3d4e5f6_add_hyper_id_and_account_type_to_user` — adds `hyper_id` (unique) and `account_type` to `user`, and a unique constraint on `email`
5. `c0ffee123456_add_notifications_and_user_settings` — creates the `notification` and `usersetting` tables
6. `d1a1b2c3d4e5_add_access_control_invite_session` — adds `access_expires_at` + `is_kicked` to `user`, creates `invite` and `session` tables
7. `a1b2c3d4e5f7_add_password_hash_to_user` — adds `password_hash` to `user` (for unofficial member logins)
8. `b2c3d4e5f6a8_add_group_to_bill` — *(superseded by #9)* added `group` to `bill`
9. `c3d4e5f6a7b9_move_group_to_user_add_created_by` — moves `group` to `user` + `invite`, adds `created_by` to `bill`, drops `bill.group`
10. `e2b3c4d5e6f7_per_user_notifications_and_invite_limits` — adds `notification.user_id` (indexed + FK), `invite.expires_at`, `invite.max_uses`

## Deployment

The frontend is built for Cloudflare Pages via `@opennextjs/cloudflare`:

```bash
cd frontend
npm run build
npx opennextjs-cloudflare
npx wrangler pages deploy .vercel/output/static
```

`frontend/wrangler.toml` holds the Cloudflare project config. The backend is not part of the Pages deploy and must be hosted separately (e.g. Fly, Render, Railway, or a Supabase Edge function) with a reachable `DATABASE_URL`.

For a **cross-domain** deployment (frontend on Cloudflare Pages, backend elsewhere), configure the backend with `CORS_ORIGINS` set to the Pages origin and `COOKIE_CROSS_DOMAIN=true` (forces `SameSite=None; Secure`, requires HTTPS) so the session cookie is sent cross-origin.

## Features

- HYPER (Arcademia) login for official members — email/password auth proxied to HYPER **server-side**; users auto-created in the local DB on first successful login, with structured error toasts
- **Dedicated unofficial login** — invited members set a password on join and log back in via `/login/unofficial`; the main `/login` page exposes an "Unofficial" button
- **HttpOnly-cookie sessions** — the backend issues opaque session tokens in an HttpOnly, Secure, SameSite cookie; the token is never exposed to JavaScript (mitigates XSS token theft). No client-trusted JWTs.
- Authenticated route guard — dashboard redirects to `/login` when unauthenticated; sidebar shows the real user and a working logout (calls `/auth/logout`)
- Create, edit, view, and delete bills with members and expenses; **edit/delete/settle are restricted to the creator or an official**
- **Bill-creation indicator** — a full-screen "Creating bill…" overlay shows while the backend processes the request, and the bills list is refetched fresh on success so the new bill always appears
- Settle Up — flip a bill's status to `settled` in one click
- Per-member balance and greedy settlement suggestions on the bill detail page
- Dashboard with totals, recent bills, and a recharts spending area chart
- Members directory in **two sections** (Official / Unofficial); the unofficial section is hidden when there are no unofficial members
- **Member access management (official-only):** "Add Member" opens a dialog to generate an invite link with an access expiry + a **group** selector; each unofficial member has a 3-dot menu to **Ban** / **Unban** (confirmation popup), Extend (add time), or Make permanent. Banned members are excluded from bill splitting.
- **Visibility groups** — each unofficial member is assigned `hyper` \| `unofficial` \| `private`, controlling which bills they can see (official-created / bills with unofficial members / only their own). Officials see all bills.
- **Invite join flow:** a public `/join?token=…` page lets unofficial members accept an invite by entering name + email + password; invite links **expire** and are **single-use by default** (configurable); they receive a session cookie and land on the dashboard
- Banned/expired members are blocked from all authenticated endpoints, from `/join`, and from `/extend`/`/permanent`; only an explicit **Unban** restores access
- **Per-user notifications** — server-generated on bill create/settle (one row per recipient), polled every 15s, live toast popups, unread badge in sidebar, full feed at `/notifications`; users only ever see their own
- Sidebar + breadcrumb header layout with collapsible icon mode
- shadcn/ui component library on top of Radix + Base UI primitives
- Dark mode by default; black dollar-sign favicon
- Responsive layout (mobile sidebar, hidden email column on small screens)
- Per-user settings: default currency saved server-side via `/settings` (name/email read-only, owned by HYPER)
- Zod-validated forms with React Hook Form
- Cloudflare Pages deploy via `opennextjs-cloudflare`

## Security

This project was hardened against a security audit. Key controls:

- **No client-trusted JWTs** — the backend issues opaque session tokens and looks them up in the `session` table; forged JWTs are rejected with `401`. The HYPER JWT is used only server-side (in the login proxy) and is discarded.
- **HttpOnly session cookie** — the token is never exposed to JavaScript (mitigates XSS token theft). `Secure` + `SameSite` are configurable; a cross-domain preset forces `SameSite=None; Secure`.
- **Authorization everywhere** — `/members` list/get and all bill mutations are auth-gated; bill edit/delete/settle require the caller to be the **creator or an official** (closes IDOR).
- **Per-user notifications** — `notification.user_id` scopes reads/writes to the owner (closes cross-user IDOR).
- **Invite expiry + max-uses** — invite links default to 7-day expiry and single use; both caps are enforced on `/join`.
- **Rate limiting** — `/auth/login`, `/auth/login-unofficial`, and `/members/join` are throttled per IP.
- **Input validation** — `EmailStr` on email fields, `amount >= 0` on expenses, length bounds on passwords/names, invite amount caps.
- **No new-user minting by unofficial members** — only officials can create `User` rows via bills.
- **Security headers** — `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, default CSP via middleware.
- **Env-driven CORS** — explicit origin list (no wildcard with credentials), restricted methods/headers.
- **Env-driven legacy key** — the old `GET /auth` key check reads `LEGACY_ACCESS_KEY` from env and is **disabled by default** (fail-closed).
- **Tz-safe datetime comparison** — naive DB datetimes are coerced to UTC before comparison.
- **Startup validation** — `DATABASE_URL` is checked at import time.
- **Generic error messages** — login failures and 404s avoid leaking whether an account exists.

See `backend/README.md` for the full backend security notes and route-level auth requirements.
