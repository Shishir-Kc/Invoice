# Invoicely

A bill-splitting and shared expense tracker. Track who paid what, calculate fair shares, and settle up with friends.

## Features

- **Dashboard** — Overview of bills, spending, and member activity
- **Bills** — Create shared bills with members and expenses
- **Members** — Manage the people you split bills with
- **Settlements** — Automatic calculation of who owes whom
- **Status Tracking** — See who has paid and who hasn't

## Tech Stack

- [Next.js](https://nextjs.org) 16 — React framework
- [Tailwind CSS](https://tailwindcss.com) v4 — Styling
- [shadcn/ui](https://ui.shadcn.com) — UI component library
- [TanStack Query](https://tanstack.com/query) — Server state management
- [Axios](https://axios-http.com) — HTTP client
- [Zod](https://zod.dev) — Form validation
- [Lucide](https://lucide.dev) — Icons

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API endpoint | `http://localhost:8000/api` |

## Build

```bash
npm run build
```

## Deploy to Cloudflare Pages

```bash
npx opennextjs-cloudflare
npx wrangler pages deploy .vercel/output/static
```
