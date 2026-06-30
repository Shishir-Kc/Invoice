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
| Auth | HYPER (Arcademia) OAuth for **official** members; **unofficial** members use a local email+password account set on invite acceptance |
| Deploy | Cloudflare Pages via `@opennextjs/cloudflare` + `wrangler` |

## Project Structure

```
backend/                       # FastAPI backend
  src/
    main.py                    # App entry, CORS, mounts router at /api/v1
    api/
      __init__.py              # Aggregates v1 routes under /invoicely prefix
      v1/
        workflow.py            # GET /auth (legacy header-based key check)
        auth.py                # HYPER login (/auth/login), unofficial login (/auth/login-unofficial) + /auth/me
        bills.py               # Bill CRUD + /settle (emits bill_added/bill_settled notifications); group-based visibility filtering
        members.py             # Members list (with stats + access + group) + create/invite/join + ban/unban/extend/permanent
        notifications.py       # Notification CRUD + mark-all-read + push_notification helper
        settings.py            # Per-user settings (default currency), auth-required
    dependency/
      db.py                    # SQLModel engine + session_dep (DATABASE_URL)
      auth.py                  # validate_key dependency (Header 'access_key') — legacy
      hyper_auth.py            # HYPER login proxy + JWT decode helpers
      current_user.py          # current_user_dep (HYPER JWT or local session token) + require_official; access checks
      access.py                # official/active/expired/banned helpers, duration→seconds, expiry extension
      passwords.py             # scrypt password hashing/verification for unofficial members (stdlib hashlib)
    Schema/
      bill.py                  # User (access + password_hash + group), Bill (created_by), BillMember, Expense
      notification.py          # Notification table
      settings.py              # UserSetting table (per-user default currency)
      invite.py                # Invite table (join links + access duration + group)
      session.py               # Session table (local session tokens for unofficial members)
      api.py                   # Pydantic request/response schemas
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
  alembic.ini
  pyproject.toml
  .env                         # DATABASE_URL lives here

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
      auth-provider.tsx        # AuthProvider + useAuth() (token/user in localStorage)
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
      api.ts                   # Axios client (billApi, authApi, memberApi, notificationApi, settingsApi) + Bearer token + 401 interceptors
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
| `notification` | `id` (uuid PK), `type`, `title`, `description`, `bill_id` (FK→bill, nullable), `read` (default `false`), `created_at` | belongs to `bill` (nullable). Auto-generated on bill create (`bill_added`) and settle (`bill_settled`); currently global (not per-user) |
| `usersetting` | `user_id` (uuid PK, FK→user), `default_currency` (default `"NPR"`) | belongs to `user` |
| `invite` | `id` (uuid PK), `token` (unique), `created_by` (FK→user), `access_duration_seconds` (int), `group` (default `"unofficial"`), `created_at`, `use_count` | Invite links generated by official members; joining via a token grants access for `access_duration_seconds` and assigns the invite's `group` |
| `session` | `token` (str PK), `user_id` (FK→user, indexed), `created_at` | Local session tokens for unofficial (invite-joined) members. Official members authenticate with their HYPER JWT instead |

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

`status` is a free-form string with two observed values: `open` and `settled`. Members are looked up by email — if a `User` with the given email does not exist, one is created on bill create/update. Deleting a bill also removes its `bill_members`, `expenses`, and any `notification`s referencing it.

## Backend API

Mounted at `/api/v1/invoicely` (see `backend/src/main.py` and `backend/src/api/__init__.py`).

| Method | Path | Description |
|---|---|---|
| `POST` | `/bills` | Create a bill with members and expenses; sets `created_by` to the caller (emits `bill_added`) |
| `GET` | `/bills` | List bills (paginated, searchable by `title`); **filtered by the viewer's group** for unofficial members |
| `GET` | `/bills/{id}` | Get a single bill; `403` if the viewer's group doesn't grant access |
| `PATCH` | `/bills/{id}` | Update title, description, status, members, expenses |
| `DELETE` | `/bills/{id}` | Delete bill (cascades `bill_members`, `expenses`, and related `notification`s) |
| `POST` | `/bills/{id}/settle` | Set `status = "settled"` (also emits a `bill_settled` notification) |
| `GET` | `/members` | List members with `billCount` + `totalPaid` + access info (`isOfficial`, `isKicked`, `accessExpiresAt`, `accessStatus`, `group`) — paginated, searchable |
| `GET` | `/members/{id}` | Get a single member with stats + access info |
| `POST` | `/members` | Add a standalone member by `{ name, email, group }` (official only; idempotent on email) |
| `POST` | `/members/invite` | Generate an invite link — body `{ amount, unit, group }` where unit is `hour`\|`day`\|`week`\|`year` (official only). Returns `{ token, link, accessDurationSeconds }` |
| `POST` | `/members/join` | **Public.** Join as an unofficial member — body `{ token, name, email, password }` (password ≥ 8 chars). Grants access for the invite duration, stores the invite's `group` and a scrypt `password_hash`; returns a local session `{ token, user }`. Refuses banned members. |
| `POST` | `/members/{id}/ban` | Revoke a member's access (`is_kicked = true`, sessions deleted); account kept (official only; cannot ban officials) |
| `POST` | `/members/{id}/unban` | Lift a ban (`is_kicked = false`); account + password retained (official only) |
| `POST` | `/members/{id}/extend` | Extend access by `{ amount, unit }`; refuses banned members (official only) |
| `POST` | `/members/{id}/permanent` | Grant permanent (non-expiring) access; refuses banned members (official only) |
| `GET` | `/notifications` | List notifications (newest first); optional `?unread=true` filter |
| `PATCH` | `/notifications/{id}` | Set `read` (body `{ "read": bool }`) |
| `POST` | `/notifications/mark-all-read` | Mark every notification as read |
| `DELETE` | `/notifications/{id}` | Delete one notification |
| `DELETE` | `/notifications` | Clear all notifications |
| `GET` | `/settings` | Get the current user's settings (Bearer token required) |
| `PUT` | `/settings` | Upsert the current user's settings (Bearer token required; body `{ "defaultCurrency": "NPR" }`) |
| `POST` | `/auth/login` | HYPER login proxy — upserts user, returns `{ token, user }` |
| `POST` | `/auth/login-unofficial` | Unofficial login — email + password; issues a fresh local session token. Rejects official accounts, banned/expired members, and accounts with no password set. |
| `GET` | `/auth/me` | Return the current user from the DB (works for HYPER JWT and local session tokens; includes `hyperId`) |
| `GET` | `/auth` | Legacy header-based key check (returns the supplied `access_key`) |

> Bill create (`POST /bills`) and settle (`POST /bills/{id}/settle`) automatically create a `notification` row (`bill_added` / `bill_settled`) describing the event.

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

### Official members — HYPER (Arcademia)

Authentication for official members is delegated to the external HYPER service at `https://api.arcademia.app/api/auth/login`. The backend proxies login, decodes the returned JWT, and mirrors HYPER users into the local `user` table.

**Login flow:**
1. Frontend posts `{ email, password }` → `POST /auth/login` (from `/login`).
2. Backend (`dependency/hyper_auth.py`) forwards the credentials to HYPER.
   - **If HYPER rejects** (invalid email, wrong password, non-existent user, network error) the backend raises an `HTTPException` with a structured `detail` and **no user is created**.
   - **If HYPER succeeds**, the backend looks up a local `user` by `email` **or** `hyper_id`: found → syncs missing HYPER fields; not found → creates one.
3. Returns `{ token: <HYPER accessToken>, user }` wrapped in `ApiResponse`.

**HYPER error codes** (`code`/`message` in `detail`): `invalid_email`, `password_required`, `invalid_credentials`, `hyper_unreachable`, `hyper_error`.

### Unofficial members — local email + password

Unofficial members don't use HYPER. They set a password when accepting an invite (`/join`) and log back in via the dedicated unofficial login.

- `/join` (public): body `{ token, name, email, password }` (password ≥ 8 chars). Stores a scrypt `password_hash` (via `dependency/passwords.py`, stdlib `hashlib.scrypt` — no extra deps), assigns the invite's `group`, issues a local session token. Refuses banned members.
- `/auth/login-unofficial`: body `{ email, password }`. Verifies the password with `secrets.compare_digest` (runs a dummy verify when the account doesn't exist to avoid timing-based enumeration). Rejects official accounts ("use the main login page"), accounts with no password set, and banned/expired members (`403`). On success issues a fresh local session token.
- The `/login` page has an **"Unofficial"** button linking to `/login/unofficial`, the dedicated email+password form.

### Credentials & request auth

`dependency/current_user.py` resolves the current user from a `Authorization: Bearer <token>` header by trying, in order:
1. A **local session token** (unofficial members) — looked up in the `session` table.
2. A **HYPER JWT** (official members) — decoded via `hyper_auth`; the local user is found by the JWT's `email` claim.

Access is validated on every authenticated request: banned or expired unofficial members get `401`/`403` (the frontend clears auth and redirects to `/login`). Official members always pass. `require_official` is a stricter dependency used by member-management endpoints.

### Frontend auth

- `AuthProvider` (`frontend/src/components/auth-provider.tsx`) persists the token + user in `localStorage` (`invoicely_token`, `invoicely_user`) and exposes `useAuth()`.
- The axios client (`frontend/src/lib/api.ts`) attaches `Authorization: Bearer <token>` to every request and, on a `401`, clears the stored auth and redirects to `/login` (public pages `/login*` and `/join` are exempt).
- `DashboardShell` wraps the dashboard route group in an `AuthGuard`.
- `useAuth().user.hyperId` distinguishes official from unofficial on the client — only official users see member-management UI (Add Member dialog, ban/unban/extend/permanent menus).
- The sidebar shows the real user's name/email/initials and a "Log out" action.

### Legacy key check

The original header-based check is still mounted at `GET /api/v1/invoicely/auth` (`backend/src/dependency/auth.py`, `validate_key`), requiring header `access_key: hello`. It is unused by the frontend and retained for backwards compatibility.

The CORS config in `backend/src/main.py` whitelists `http://localhost:3000`.

## Frontend Architecture

### Providers (`frontend/src/components/providers.tsx`)

`Providers` (mounted in the root layout):
```
ThemeProvider
  └─ AuthProvider             (token/user in localStorage; useAuth())
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
| `DATABASE_URL` | `backend/.env` | — | PostgreSQL DSN (e.g. Supabase connection string) |
| `HYPER_API_URL` | `backend` env | `https://api.arcademia.app` | HYPER (Arcademia) auth base URL |
| `NEXT_PUBLIC_API_URL` | `frontend` runtime | `http://localhost:8000/api/v1/invoicely` | Base URL for the axios client (`frontend/src/lib/api.ts`) |
| `FRONTEND_URL` | `backend` env | `http://localhost:3000` | Origin used to build invite join links (`/join?token=…`) returned by `POST /members/invite` |

## Getting Started

### Prerequisites
- Python 3.13+ with [uv](https://docs.astral.sh/uv/)
- Node.js 20+
- PostgreSQL (or a Supabase connection string)

### Backend

```bash
cd backend
uv sync                                  # Install dependencies
cp .env.example .env                     # Configure DATABASE_URL
uv run alembic upgrade head              # Apply migrations
uv run uvicorn main:server --reload --app-dir src
```

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

## Deployment

The frontend is built for Cloudflare Pages via `@opennextjs/cloudflare`:

```bash
cd frontend
npm run build
npx opennextjs-cloudflare
npx wrangler pages deploy .vercel/output/static
```

`frontend/wrangler.toml` holds the Cloudflare project config. The backend is not part of the Pages deploy and must be hosted separately (e.g. Fly, Render, Railway, or a Supabase Edge function) with a reachable `DATABASE_URL`.

## Features

- HYPER (Arcademia) login for official members — email/password auth proxied to HYPER; users auto-created in the local DB on first successful login, with structured error toasts
- **Dedicated unofficial login** — invited members set a password on join and log back in via `/login/unofficial`; the main `/login` page exposes an "Unofficial" button
- Authenticated route guard — dashboard redirects to `/login` when unauthenticated; sidebar shows the real user and a working logout
- Create, edit, view, and delete bills with members and expenses
- **Bill-creation indicator** — a full-screen "Creating bill…" overlay shows while the backend processes the request, and the bills list is refetched fresh on success so the new bill always appears
- Settle Up — flip a bill's status to `settled` in one click
- Per-member balance and greedy settlement suggestions on the bill detail page
- Dashboard with totals, recent bills, and a recharts spending area chart
- Members directory in **two sections** (Official / Unofficial); the unofficial section is hidden when there are no unofficial members
- **Member access management (official-only):** "Add Member" opens a dialog to generate an invite link with an access expiry + a **group** selector; each unofficial member has a 3-dot menu to **Ban** / **Unban** (confirmation popup), Extend (add time), or Make permanent. Banned members are excluded from bill splitting.
- **Visibility groups** — each unofficial member is assigned `hyper` \| `unofficial` \| `private`, controlling which bills they can see (official-created / bills with unofficial members / only their own). Officials see all bills.
- **Invite join flow:** a public `/join?token=…` page lets unofficial members accept an invite by entering name + email + password; they receive a local session token and land on the dashboard
- Banned/expired members are blocked from all authenticated endpoints, from `/join`, and from `/extend`/`/permanent`; only an explicit **Unban** restores access
- Notifications: server-generated on bill create/settle, polled every 15s, live toast popups, unread badge in sidebar, full feed at `/notifications`
- Sidebar + breadcrumb header layout with collapsible icon mode
- shadcn/ui component library on top of Radix + Base UI primitives
- Dark mode by default; black dollar-sign favicon
- Responsive layout (mobile sidebar, hidden email column on small screens)
- Per-user settings: default currency saved server-side via `/settings` (name/email read-only, owned by HYPER)
- Zod-validated forms with React Hook Form
- Cloudflare Pages deploy via `opennextjs-cloudflare`
