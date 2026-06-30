# Invoicely Frontend

Next.js frontend for Invoicely — a shared expense / bill-splitting tracker.
Talks to the FastAPI backend at `NEXT_PUBLIC_API_URL`. Deploys to Cloudflare
Pages via `@opennextjs/cloudflare`.

## Tech Stack

- [Next.js](https://nextjs.org) 16 / React 19 — App Router
- [Tailwind CSS](https://tailwindcss.com) v4 — Styling
- shadcn/ui (Radix + Base UI primitives) — UI components
- [TanStack Query](https://tanstack.com/query) — Server state
- [Axios](https://axios-http.com) — HTTP client
- [React Hook Form](https://react-hook-form.com) + [Zod](https://zod.dev) — Forms & validation
- [Recharts](https://recharts.org) — Dashboard charts
- [Lucide](https://lucide.dev) — Icons

## Getting Started

```bash
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1/invoicely npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard is
auth-guarded; unauthenticated users are redirected to `/login`.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8000/api/v1/invoicely` |

> The session token is delivered via an **HttpOnly cookie** set by the backend,
> so no token env var is needed on the frontend. The axios client uses
> `withCredentials: true` to send the cookie. For **cross-domain** deployments
> (frontend and backend on different registrable domains), the backend must be
> configured with `COOKIE_CROSS_DOMAIN=true` (forces `SameSite=None; Secure`,
> requires HTTPS) and `CORS_ORIGINS` set to the frontend origin — see
> `backend/README.md`.

## Layout

```
src/
  app/
    layout.tsx               # Root layout, fonts, dark theme, favicon metadata; wraps app in Providers
    icon.svg                 # Favicon — black rounded-square badge with a white dollar sign
    globals.css              # Tailwind 4 entry
    login/                   # HYPER login page (email/password + error toast + "Unofficial" button)
      unofficial/page.tsx    # Dedicated email+password login for unofficial members
    join/                    # Public invite-acceptance page (/join?token=…): name + email + password + confirm
    (dashboard)/             # Authed route group (guarded by AuthGuard)
      page.tsx               # Dashboard (stats, recent bills, spending chart)
      bills/
        page.tsx             # Bill list with search (filtered server-side by the viewer's group)
        create/page.tsx      # Create bill — MemberPicker + expenses, live total/share; full-screen "Creating bill…" indicator
        [id]/
          view/page.tsx      # Bill detail, balances, settlements, Settle Up
          edit/page.tsx      # Edit bill (MemberPicker prefilled)
      members/page.tsx       # Members in two sections (Official / Unofficial); unofficial section hidden when empty; ban/unban dialog
      notifications/page.tsx # Notification feed with read/unread toggling
      settings/page.tsx      # Profile (read-only) + default currency (saved via /settings)
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
      app-sidebar.tsx        # Sidebar nav + user dropdown (HYPER user + logout)
      header.tsx             # Breadcrumb header with SidebarTrigger
    ui/                      # shadcn/ui primitives
      avatar, badge, breadcrumb, button, card, checkbox, collapsible,
      dialog, dropdown-menu, input, label, select, separator, sheet, sidebar,
      skeleton, textarea, tooltip
  lib/
    api.ts                   # Axios client (billApi, authApi, memberApi, notificationApi, settingsApi) + withCredentials cookie + 401 interceptor + authApi.logout
    utils.ts                 # cn, formatCurrency (NPR), date + balance math, greedy settlements
    validations.ts           # Zod schemas for forms
  hooks/
    use-mobile.ts
  types/
    index.ts                 # Member, MemberWithStats, Expense, Bill, BillGroup, Settlement, Notification, UserSetting, Duration, InviteResult
```

## Auth & member access

Authentication uses a **backend-issued HttpOnly session cookie** — the
session token is never exposed to JavaScript (which mitigates XSS token
theft). The axios client sends the cookie automatically via `withCredentials`;
there is no `Authorization` header and no token in `localStorage`.

The app supports two login paths:

- **HYPER login** (`/login`) — email/password → `POST /auth/login`. The
  backend verifies credentials with HYPER server-side, then sets the session
  cookie and returns the user. `useAuth().user.hyperId` is set → the user is
  **official** (admin) and sees member-management UI.
- **Unofficial login** (`/login/unofficial`, linked from the main login via
  the **"Unofficial"** button) — email + password →
  `POST /auth/login-unofficial`. Sets the session cookie; `hyperId` is empty
  → the user is **unofficial** and sees no admin UI. Banned/expired members
  get a clear error.
- **Invite join** (`/join?token=…`) — public. Name + email + **password** (+
  confirm) → `POST /members/join`, which stores the password hash and sets the
  session cookie. The password is what the member uses to log back in later
  via `/login/unofficial`. If the email already belongs to a HYPER member, the
  backend returns `alreadyOfficial: true` and no cookie is set; the UI prompts
  them to log in via HYPER instead.

`AuthProvider` caches the (non-secret) user object in `localStorage` for an
instant first paint, then re-validates against `GET /auth/me` (authenticated
via the cookie) so `hyperId` and other fields are always authoritative. If
`/me` returns `401`, the cached user is cleared.

`logout()` calls `POST /auth/logout` (which deletes the server session and
clears the cookie), then clears the cached user and redirects to `/login`.
The axios response interceptor also clears the cached user and redirects to
`/login` on a `401` from authed pages (public pages `/login*` and `/join` are
exempt so a stray 401 there doesn't bounce visitors). Banned/expired
unofficial members are blocked server-side (401) and bounced this way.

### Member management (official members only)

- **Add Member** button → `InviteDialog`: choose an access duration
  (hour/day/week/year) + amount **and a group** (`hyper` / `unofficial` /
  `private`), generate a copyable `/join?token=…` link.
- The members page is split into **Official members** and **Unofficial members**
  sections; the unofficial section is hidden entirely when there are no
  unofficial members.
- Each **unofficial** member card shows a group badge (Hyper / Unofficial /
  Private) and a 3-dot menu: **Extend** (opens `ExtendDialog`), **Make
  permanent**, **Ban**. When a member is already banned, the menu also shows
  **Unban**. Banning/unbanning opens a `BanDialog` confirmation popup (no native
  `confirm()` alert). Official members show no menu.
- Each card shows an access-status badge: Official / Active / Permanent /
  Expired / Banned.
- Banned members are excluded from the bill-splitting `MemberPicker`.

### Bill visibility

Bills are filtered server-side by the viewer's group (see `backend/README.md`):
`hyper` members see official-created bills, `unofficial` members see bills with
unofficial members, `private` members see only bills they're on. Officials see
all bills. Creating a bill shows a full-screen "Creating bill…" indicator until
the backend responds, then refetches the list so the new bill always appears.

## Favicon

`src/app/icon.svg` — a black (`#0a0a0a`) rounded-square badge with a white
dollar sign. Next.js's app router auto-detects `app/icon.svg` and serves it as
the favicon (also referenced in `layout.tsx` `metadata.icons`).

## Build

```bash
npm run build
```

## Deploy to Cloudflare Pages

```bash
npm run build
npx opennextjs-cloudflare
npx wrangler pages deploy .vercel/output/static
```

`wrangler.toml` holds the Cloudflare project config. The backend is hosted
separately (see `backend/README.md`) with a reachable `DATABASE_URL` and a
`FRONTEND_URL` pointing at this deployment so invite links resolve correctly.
