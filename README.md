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
| Auth | Header-based on backend (`access_key: hello`); login UI is a HYPER OAuth stub |
| Deploy | Cloudflare Pages via `@opennextjs/cloudflare` + `wrangler` |

## Project Structure

```
backend/                       # FastAPI backend
  src/
    main.py                    # App entry, CORS, mounts router at /api/v1
    api/
      __init__.py              # Aggregates v1 routes under /invoicely prefix
      v1/
        workflow.py            # GET /auth (header-based key check)
        bills.py               # Bill CRUD + /settle
    dependency/
      db.py                    # SQLModel engine + session_dep (DATABASE_URL)
      auth.py                  # validate_key dependency (Header 'access_key')
      hyper_auth.py            # Placeholder for HYPER auth
    Schema/
      bill.py                  # User, Bill, BillMember, Expense SQLModel tables
      api.py                   # Pydantic request/response schemas
      user.py                  # Placeholder
  mighrations/                 # Alembic migrations (note: folder typo is intentional)
    env.py
    versions/
      682c44f7c128_initial_migration.py        # user table
      187295b79bae_chor_adding_bill_table.py   # bill, billmember, expense
      baebb5e7ca8c_add_status_and_timestamps.py # status + timestamps
  alembic.ini
  pyproject.toml
  .env                         # DATABASE_URL lives here

frontend/                      # Next.js frontend
  src/
    app/
      layout.tsx               # Root layout, fonts, dark theme
      globals.css              # Tailwind 4 entry
      login/                   # Standalone login page (UI-only stub)
      (dashboard)/             # Authed route group
        layout.tsx             # Wraps in Providers + DashboardShell
        page.tsx               # Dashboard (stats, recent bills, spending chart)
        bills/
          page.tsx             # Bill list with search
          create/page.tsx      # Create bill form
          [id]/
            view/page.tsx      # Bill detail with balances & settlements
            edit/page.tsx      # Edit bill form
        members/page.tsx       # Members directory (mock-data backed)
        notifications/page.tsx # Notification feed
        settings/page.tsx      # Profile + default currency
    components/
      providers.tsx            # Theme + Query + Notification providers; DashboardShell
      query-provider.tsx       # TanStack Query client
      theme-provider.tsx       # next-themes
      notification-provider.tsx# Mock + 60s live notification generator
      notification-toast.tsx   # Bottom-right toast popups
      layout/
        app-sidebar.tsx        # Sidebar nav + user dropdown
        header.tsx             # Breadcrumb header with SidebarTrigger
        sidebar.tsx
      ui/                      # shadcn/ui primitives
        avatar.tsx, badge.tsx, breadcrumb.tsx, button.tsx, card.tsx,
        collapsible.tsx, dropdown-menu.tsx, input.tsx, label.tsx,
        select.tsx, separator.tsx, sheet.tsx, sidebar.tsx, skeleton.tsx,
        textarea.tsx, tooltip.tsx
    lib/
      api.ts                   # Axios client (billApi, authApi)
      utils.ts                 # cn, formatCurrency (NPR), date + balance math
      validations.ts           # Zod schemas for forms
      mock-data.ts             # Mock bills, members, notifications
    hooks/
      use-mobile.ts
    types/
      index.ts                 # Member, Expense, Bill, Settlement, Notification
  components.json              # shadcn config
  next.config.ts
  wrangler.toml                # Cloudflare Pages config
  AGENTS.md                    # Frontend-specific agent rules + deploy commands
```

> Note: the backend directory is named `mighrations/` (not `migrations/`). The typo is preserved to keep Alembic's `alembic.ini` `script_location` path valid. Renaming it requires updating `alembic.ini` and the migration history.

## Data Model

SQLModel tables defined in `backend/src/Schema/bill.py`:

| Table | Columns | Relationships |
|---|---|---|
| `user` | `id` (uuid PK), `name`, `email` | has many `bill_members`, `expenses_paid` |
| `bill` | `id` (uuid PK), `title`, `description`, `status` (default `"open"`), `created_at`, `updated_at` | has many `bill_members`, `expenses` |
| `billmember` | `id` (uuid PK), `bill_id` (FK→bill), `user_id` (FK→user) | has many `expenses_paid` |
| `expense` | `id` (uuid PK), `description`, `amount` (Numeric(12,2)), `created_at`, `bill_id` (FK→bill), `paid_by_member_id` (FK→billmember), `paid_by_user_id` (FK→user) | belongs to `bill`, `paid_by_member`, `paid_by_user` |

`status` is a free-form string with two observed values: `open` and `settled`. Members are looked up by email — if a `User` with the given email does not exist, one is created on bill create/update.

## Backend API

Mounted at `/api/v1/invoicely` (see `backend/src/main.py:21` and `backend/src/api/__init__.py:5`).

| Method | Path | Description |
|---|---|---|
| `POST` | `/bills` | Create a bill with members and expenses |
| `GET` | `/bills` | List bills (paginated, searchable by `title`) |
| `GET` | `/bills/{id}` | Get a single bill |
| `PATCH` | `/bills/{id}` | Update title, description, status, members, expenses |
| `DELETE` | `/bills/{id}` | Delete bill (cascades `bill_members` and `expenses`) |
| `POST` | `/bills/{id}/settle` | Set `status = "settled"` |
| `GET` | `/auth` | Header-based key check (returns the supplied `access_key`) |

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

When `members` and `expenses` are both supplied, existing `bill_members` and `expenses` rows for the bill are deleted and recreated (see `bills.py:141`). Other fields update in place and bump `updated_at`.

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

The backend currently exposes a single header-based check at `GET /api/v1/invoicely/auth` (`backend/src/dependency/auth.py`):

```python
def validate_key(access_key: str = Header(...)):
    if access_key != "hello":
        raise HTTPException(status_code=401, detail="invalid acess_key ")
    return access_key
```

The frontend's `authApi` (`frontend/src/lib/api.ts`) defines `login`, `register`, and `me` methods, but no backend routes for them exist yet. `backend/src/dependency/hyper_auth.py` and the `Login via HYPER` button on `frontend/src/app/login/page.tsx` are UI-only stubs pending a real OAuth integration.

The CORS config in `backend/src/main.py` whitelists `http://localhost:3000`.

## Frontend Architecture

### Providers (`frontend/src/components/providers.tsx`)

```
ThemeProvider
  └─ QueryProvider            (TanStack Query)
       └─ NotificationProvider (mock + 60s live generator)
            └─ children
```

`DashboardShell` (used by the `(dashboard)` route group) wraps children in:
```
SidebarProvider
  ├─ Sidebar > AppSidebar     (nav + user dropdown)
  └─ SidebarInset
       ├─ Header              (breadcrumb + SidebarTrigger)
       ├─ main                (page content)
       └─ NotificationToast   (bottom-right toasts)
```

### Pages

| Route | File | Purpose |
|---|---|---|
| `/login` | `app/login/page.tsx` | Standalone login page (UI-only stub) |
| `/` | `app/(dashboard)/page.tsx` | Dashboard: total bills, total spent, members, settled % + recharts area chart + recent bills |
| `/bills` | `app/(dashboard)/bills/page.tsx` | Bill list with search |
| `/bills/create` | `app/(dashboard)/bills/create/page.tsx` | Create bill form (members + expenses rows, live total/share) |
| `/bills/{id}/view` | `app/(dashboard)/bills/[id]/view/page.tsx` | Bill detail, member balances, settlement suggestions, Settle Up action |
| `/bills/{id}/edit` | `app/(dashboard)/bills/[id]/edit/page.tsx` | Edit form prefilled from `billApi.get` |
| `/members` | `app/(dashboard)/members/page.tsx` | Members grid (mock-data) |
| `/notifications` | `app/(dashboard)/notifications/page.tsx` | Notification feed with read/unread toggling |
| `/settings` | `app/(dashboard)/settings/page.tsx` | Profile + default currency |

### Notifications

`NotificationProvider` (`frontend/src/components/notification-provider.tsx`) seeds from `mockNotifications` and emits a new notification every 60s. The bottom-right toast (`NotificationToast`) is auto-dismissed after 5s; the sidebar shows an unread badge (max `9+`).

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

`Member`, `Expense`, `Bill`, `BillStatus = "open" | "settled"`, `Settlement`, `ApiResponse<T>`, `PaginatedResponse<T>`, `CreateBillInput`, `UpdateBillInput`, `Notification`, `NotificationType = "bill_added" | "payment_received" | "member_joined" | "bill_settled"`.

## Environment Variables

| Var | Where | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | `backend/.env` | — | PostgreSQL DSN (e.g. Supabase connection string) |
| `NEXT_PUBLIC_API_URL` | `frontend` runtime | `http://localhost:8000/api/v1/invoicely` | Base URL for the axios client (`frontend/src/lib/api.ts:10`) |

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

- Create, edit, view, and delete bills with members and expenses
- Settle Up — flip a bill's status to `settled` in one click
- Per-member balance and greedy settlement suggestions on the bill detail page
- Dashboard with totals, recent bills, and a recharts spending area chart
- Members directory (currently mock-data backed)
- Notifications: live toast popups, unread badge in sidebar, full feed at `/notifications`
- Sidebar + breadcrumb header layout with collapsible icon mode
- shadcn/ui component library on top of Radix + Base UI primitives
- Dark mode by default (`<html class="dark">` in `app/layout.tsx`)
- Responsive layout (mobile sidebar, hidden email column on small screens)
- Zod-validated forms with React Hook Form
- Cloudflare Pages deploy via `opennextjs-cloudflare`
