# Invoicely — Shared Expense Tracker

A splitwise-style web app for splitting bills and tracking shared expenses. Built with FastAPI (Python) and Next.js (TypeScript).

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.13, FastAPI, SQLModel, PostgreSQL (Supabase) |
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, TanStack Query |
| Migrations | Alembic |
| Auth | Header-based (simple, no JWT) |

## Project Structure

```
backend/               # FastAPI backend
  src/
    main.py            # App entry point, CORS config
    api/               # API routes
      __init__.py      # Router aggregation
      v1/
        workflow.py    # Auth endpoint
        bills.py       # Bill CRUD endpoints
    dependency/
      db.py            # DB session dependency
      auth.py          # Header auth
    Schema/
      bill.py          # SQLModel DB models
      api.py           # Pydantic request/response schemas
  mighrations/         # Alembic migrations
  pyproject.toml

frontend/              # Next.js frontend
  src/
    app/               # App router pages
      (dashboard)/
        page.tsx       # Dashboard
        bills/
          page.tsx     # Bill list
          create/      # Create bill form
          [id]/
            view/      # Bill detail
            edit/      # Edit bill
    lib/
      api.ts           # Axios client
      utils.ts         # Formatting, calculations
    types/             # TypeScript types
```

## Backend API

Prefix: `/api/v1/invoicely`

| Method | Path | Description |
|---|---|---|
| `POST` | `/bills` | Create a bill (with members and expenses) |
| `GET` | `/bills` | List bills (paginated, searchable) |
| `GET` | `/bills/{id}` | Get bill detail |
| `PATCH` | `/bills/{id}` | Update bill (title, description, members, expenses) |
| `DELETE` | `/bills/{id}` | Delete bill (cascades members and expenses) |
| `POST` | `/bills/{id}/settle` | Mark a bill as settled |
| `GET` | `/auth` | Simple header-based auth check |

### Create Bill Request Body

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

## Getting Started

### Prerequisites
- Python 3.13+ with [uv](https://docs.astral.sh/uv/)
- Node.js 20+
- PostgreSQL (or a Supabase connection string)

### Backend

```bash
cd backend
uv sync                    # Install dependencies
cp .env.example .env       # Configure DATABASE_URL
uv run alembic upgrade head  # Run migrations
uv run uvicorn main:server --reload --app-dir src
```

### Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1/invoicely npm run dev
```

The frontend starts at `http://localhost:3000` and the backend at `http://localhost:8000`.

## Database

The project uses Supabase PostgreSQL. Migrations are managed with Alembic:

```bash
cd backend
uv run alembic revision --autogenerate -m "description"  # Create migration
uv run alembic upgrade head                                # Apply
```

## Features

- Create bills with multiple members and expenses
- Track who paid what and calculate per-person shares
- Settle bills to mark them as paid
- Dashboard with spending overview
- Dark mode UI
- Responsive design
