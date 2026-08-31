# Development Guide

## Prerequisites

- Python 3.11+ (`python --version`)
- Node 18+ (`node --version`), npm 9+ (`npm --version`)
- PowerShell 5.1+ on Windows

## Setup

```powershell
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e "backend[dev]"
Set-Location frontend; npm install; Set-Location ..
```

If editable install fails, use:

```powershell
pip install -r backend/requirements.txt
pip install -r backend/requirements-dev.txt  # if present
# or
pip install fastapi uvicorn sqlalchemy pydantic pydantic-settings python-dotenv httpx pytest pytest-asyncio anyio
```

## Running

Backend (port 8000):

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

Frontend (port 5173):

```powershell
npm --prefix frontend run dev
```

Env overrides: `BACKEND_HOST`, `BACKEND_PORT`, `VITE_API_BASE_URL`, `CORS_ORIGINS`.

## Testing

```powershell
# Backend
pytest -q
pytest backend/tests -v --tb=short

# Frontend
npm --prefix frontend run test
npm --prefix frontend run test:watch
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

## Lint & Format

- Python: `ruff check backend` / `ruff format backend` (if configured)
- Frontend: `npm --prefix frontend run lint` (ESLint)

## Project Conventions

- Strict TypeScript (`strict: true`, no `any` without justification).
- Python typing with `mypy` where feasible.
- Business logic in `backend/app/services/` and `providers/`, not in routes or React components.
- Frontend state via Zustand (lightweight).
- Workflow visualization via React Flow when workflows land.

## Troubleshooting

- **CORS error in browser**: ensure `CORS_ORIGINS` includes `http://localhost:5173` and `http://127.0.0.1:5173`; restart backend.
- **SQLite locked**: stop duplicate uvicorn instances; delete `backend/data/*.db-wal` if stale (dev only).
- **Vite cannot reach API**: check `VITE_API_BASE_URL` and that backend health `GET /api/health` responds.
