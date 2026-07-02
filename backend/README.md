# Invoicely API — Hono on Cloudflare Workers + D1

TypeScript port of the legacy FastAPI/Postgres backend, running on
**Cloudflare Workers** with **Hono**, **D1** (SQLite) via **Drizzle ORM**, and
the platform **Rate Limit** binding. Auth, access control, and the API
contract (request/response shapes + the `{ detail }` error envelope) are
preserved 1:1 so the existing Next.js frontend works unchanged.

## Stack

| Concern        | Choice                                                        |
| -------------- | ------------------------------------------------------------ |
| Runtime        | Cloudflare Workers (`nodejs_compat`)                          |
| Framework      | Hono                                                         |
| DB             | D1 (SQLite)                                                  |
| ORM            | Drizzle (`drizzle-orm/d1`)                                   |
| Validation     | Zod (shared-shape with frontend)                             |
| Auth           | Opaque session token in HttpOnly cookie (same as legacy)     |
| HYPER login    | Proxied server-side; HYPER JWT never sent to the client      |
| Passwords      | scrypt via `node:crypto` — same `scrypt$…` format as legacy  |
| Rate limiting  | Workers Rate Limit binding (per-IP, login + join)            |
| Money          | INTEGER cents (was `Decimal(12,2)`)                          |
| Timestamps     | TEXT ISO-8601 UTC                                            |

## Layout

```
src/
  index.ts            Hono app: CORS, security headers, error handler, route mounting
  db/
    schema.ts         Drizzle schema (port of legacy SQLModel tables)
    client.ts         Env types + Drizzle/D1 client factory
  lib/
    access.ts         isOfficial / hasAccess / accessStatus / extendExpiry
    auth.ts           withDb / authMiddleware / officialMiddleware + getUser/getDb
    cookies.ts        HttpOnly session cookie helpers (shared-domain aware)
    durations.ts      duration_to_seconds
    errors.ts         ApiError → serialized as { detail }
    hyper.ts          loginWithHyper (server-side proxy to api.arcademia.app)
    notifications.ts  pushNotifications (per-recipient rows)
    passwords.ts      scrypt hash/verify (legacy-format compatible)
    ratelimit.ts      Workers Rate Limit binding wrappers
    serializers.ts    DB rows → frontend-shaped DTOs (billOut, memberWithStats, …)
    time.ts           ISO helpers
  schemas.ts          Zod request schemas
  routes/
    auth.ts  bills.ts  members.ts  notifications.ts  settings.ts  workflow.ts
migrations/
  0001_initial_schema.sql
```

Routes mount under the legacy prefix `/api/v1/invoicely`.

## Domain model (unchanged)

- **Official** members log in via external **HYPER**; the Worker proxies the
  login, upserts the user, mints its **own opaque session token** in the
  `sessions` table, and sets it in an **HttpOnly cookie**. HYPER's JWT is
  never sent to the client.
- **Unofficial** members join via **invite links** (`/members/join`), set a
  local scrypt password, and log in via `/auth/login-unofficial`.
- Access control: `is_official = has hyper_id`. Unofficial users have
  `access_expires_at` (null = permanent), `is_kicked` (ban), and a visibility
  `group` (`hyper | unofficial | private`) controlling which bills they see.

## Deployment topology

Frontend and API share the registrable domain `shishirkhatri.com.np`:

- Frontend (Next.js on Cloudflare via OpenNext): `shishirkhatri.com.np`
- API (this Worker): `api.shishirkhatri.com.np`

The session cookie is scoped to `Domain=.shishirkhatri.com.np` with
`SameSite=Lax` (same-site, so it's sent cross-subdomain automatically). No
`SameSite=None` cross-domain dance needed. CORS still applies (different
subdomain origins), so the allowed frontend origin is whitelisted with
credentials.

## First-time setup

```bash
cd backend
bun install

# 1. Create the D1 databases (prod + dev)
bunx wrangler d1 create invoicely           # paste the id into wrangler.jsonc
bunx wrangler d1 create invoicely-dev       # paste the id into the `dev` env

# 2. Apply migrations
bunx wrangler d1 migrations apply invoicely --local
bunx wrangler d1 migrations apply invoicely --remote

# 3. Local dev secrets
cp .dev.vars.example .dev.vars

# 4. Set production secret(s)
bunx wrangler secret put LEGACY_ACCESS_KEY

# 5. Run locally
bun run dev            # wrangler dev (uses local D1)

# 6. Deploy
bun run deploy         # wrangler deploy
```

> **Important:** the legacy `backend-legacy/src/dependency/email_sender.py`
> had a hardcoded Gmail app password committed. **Rotate that app password
> immediately** in your Google account. Transactional email is not yet wired
> into the Worker — add Cloudflare Email Service when needed.

## Migrating existing data (optional)

If you want to carry over the Postgres data:

1. Export from Postgres: `pg_dump --data-only --column-inserts <dsn> > data.sql`.
2. Convert types by hand (UUIDs → strings, money DECIMAL → cents INTEGER,
   timestamps → ISO-8601 TEXT, booleans → 0/1). There's no automated tool.
3. Import into D1: `bunx wrangler d1 execute invoicely --remote --file=data-d1.sql`.

The scrypt password hashes are unchanged, so unofficial users keep working.
