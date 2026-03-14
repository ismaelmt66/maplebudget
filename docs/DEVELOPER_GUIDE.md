# NexLedger Developer Guide

## Architecture Overview

```
nexledger/
├── apps/
│   ├── api/          # FastAPI backend (Python 3.13+)
│   │   ├── main.py           # App entry point, middleware, routers
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   ├── auth.py           # JWT auth, password hashing, user dependency
│   │   ├── db.py             # Database engine & session factory
│   │   ├── settings.py       # Pydantic settings from env vars
│   │   ├── routers/          # API route handlers
│   │   ├── services/         # Business logic layer
│   │   ├── tests/            # Pytest test suite
│   │   └── alembic/          # Database migrations
│   └── web/          # Next.js frontend (TypeScript + TailwindCSS)
│       ├── src/app/          # App Router pages
│       ├── src/components/   # Reusable UI components
│       ├── src/lib/          # API client, auth, utilities
│       └── src/__tests__/    # Vitest test suite
├── docs/                     # Documentation
├── scripts/                  # Deploy scripts
└── docker-compose.yml        # Container orchestration
```

## Prerequisites

- **Python** 3.13+
- **Node.js** 20+
- **PostgreSQL** 16+ (or SQLite for local dev)
- **Docker** & Docker Compose (optional, for containerized setup)

## Local Development Setup

### 1. Clone and configure

```bash
git clone https://github.com/ismaelmt66/maplebudget.git
cd maplebudget
cp .env.example apps/api/.env
```

Edit `apps/api/.env`:
- Set `SECRET_KEY` (generate with `python -c "import secrets; print(secrets.token_urlsafe(64))"`)
- `DATABASE_URL` defaults to SQLite (`sqlite:///./app.db`)
- Optionally set `GROQ_API_KEY` for AI coach features

### 2. Backend setup

```bash
cd apps/api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start the API server
uvicorn main:app --reload --port 8000
```

### 3. Frontend setup

```bash
cd apps/web
npm install
npm run dev
```

The frontend runs at `http://localhost:3000`, API at `http://localhost:8000`.

### 4. Seed demo data

```bash
cd apps/api
python seed_data.py
```

This creates a demo user (`demo@nexledger.com` / `demo1234`) with 6 months of transactions, goals, and assets.

## Docker Setup

```bash
docker compose up -d
```

Services: PostgreSQL (5432), API (8000), Web (3000).

## Running Tests

### Backend tests

```bash
cd apps/api
pytest tests/ -v
```

### Frontend tests

```bash
cd apps/web
npm test
```

## Database Migrations

```bash
cd apps/api

# Create a new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1
```

## API Documentation

When running in DEBUG mode, Swagger UI is available at:
- **Swagger**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Project Conventions

### Backend
- **Routers** handle HTTP, **services** contain business logic
- All routes require authentication via `get_current_user` dependency
- Admin routes use `require_admin` dependency
- Date format: `YYYY-MM-DD` strings
- Currency: float with 2 decimal places

### Frontend
- **App Router** (Next.js 14+) with `"use client"` for interactive pages
- API calls go through `src/lib/api.ts` with automatic auth header injection
- Token management in `src/lib/auth.ts` (localStorage)
- UI components in `src/components/ui/` are generic; domain components are in `src/components/`

### Naming Conventions
- Python: `snake_case` for files, functions, variables
- TypeScript: `camelCase` for variables/functions, `PascalCase` for components/types
- API routes: kebab-case paths (e.g., `/budget-alerts/check`)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | Yes | — | JWT signing key |
| `DATABASE_URL` | No | `sqlite:///./app.db` | Database connection string |
| `DEBUG` | No | `false` | Enable debug mode + Swagger |
| `CORS_ORIGINS` | No | `["http://localhost:3000"]` | Allowed CORS origins |
| `GROQ_API_KEY` | No | — | Groq API key for AI coach |
| `ANTHROPIC_API_KEY` | No | — | Anthropic key (fallback AI) |
| `PLAID_CLIENT_ID` | No | — | Plaid API client ID |
| `PLAID_SECRET` | No | — | Plaid API secret |
| `ENCRYPTION_KEY` | No | — | Fernet key for encrypting bank tokens |
