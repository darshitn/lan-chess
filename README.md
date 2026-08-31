# Multi-Agent AI Workspace

Professional local Windows IDE for multi-agent orchestration — projects, isolated workspaces, provider abstraction (Demo/Ollama/Claude), DAG workflows.

> **Phase 3 — Project Workspace live** (Phases 0-2 verified). Phases 4+ (DAG, IDE shell, memory) next per `MASTER_PLAN.md`.

## Quick Start (Windows)

```powershell
git clone <repo-url>
Set-Location Multi-Agent-Interface
# 1) Backend deps
python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r backend/requirements.txt
# 2) Frontend deps
npm --prefix frontend install
# 3) One command — starts backend + frontend, shows URLs, auto-creates .env
npm run dev
# or: powershell -ExecutionPolicy Bypass -File ./start-dev.ps1
# or: double-click start-dev.bat
```

Open:
- Frontend: http://localhost:5173
- Backend health: http://127.0.0.1:8000/api/health
- Swagger: http://127.0.0.1:8000/docs

If header shows `Backend: Offline — Failed to fetch`, backend didn't start → check the backend window for errors, ensure port 8000 free, then click **Retry**.

## How It Works

1. How to install? See Quick Start above. `npm run install:all` also works from root (needs concurrently).
2. How to start entire app? `npm run dev` (or `start-dev.ps1`/`start-dev.bat`) — starts FastAPI (`127.0.0.1:8000`) + Vite (`localhost:5173`), prints both URLs, shows backend/frontend status, shuts down by closing the two windows or `taskkill /F /IM python.exe; taskkill /F /IM node.exe`.
3. Backend only? `python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload` (from repo root, venv active) or `npm run dev:backend`.
4. Frontend only? `npm --prefix frontend run dev` or `npm run dev:frontend`.
5. How to stop? Close the windows started by `start-dev.ps1`, or `Ctrl+C` in each terminal.
6. Verify health? `curl.exe -s http://127.0.0.1:8000/api/health | ConvertFrom-Json` or visit `/api/health`. Expect `status:ok`, `database:ok`, `providers:{demo:available, ollama:unavailable, claude:not_configured}`. `GET /api/diagnostics` for detailed Ollama latency/error. Never exposes keys.
7. Configure Ollama? Set `OLLAMA_HOST` (or `OLLAMA_URL` alias) in `.env` — default `http://127.0.0.1:11434` only as default. Or per-provider `PATCH /api/providers/{id} {"config":{"base_url":"http://custom:11434"}}`. Health reports `ollama:unavailable` if daemon down — backend stays `ok`.
8. Configure Claude? Set `ANTHROPIC_API_KEY` in `.env` (backend-only, never committed). Without it, `/api/health` shows `claude:not_configured` and app still runs (`DemoProvider` handles tests).
9. Database? SQLite at `backend/data/app.db` (or `DATABASE_URL=sqlite:///./backend/data/app.db` from `.env`). Auto-created via `app/db/migrations.py` + `init_db` on startup; fresh checkout initializes without manual tables. Existing `app.db` never deleted.
10. Workspaces? `workspace/<project-id>/` per project, isolated, path-traversal protected — see `docs/workspaces.md`.

## Architecture

```
/
  frontend/   React + TypeScript + Vite (proxy /api -> 8000, centralized api.ts)
  backend/    FastAPI + SQLite + SQLAlchemy + Pydantic (provider-independent)
  docs/       architecture, development, providers, ollama, workspaces, file-security
  workspace/  per-project files (gitignored except .gitkeep)
```

- Provider independence, Demo always available, Ollama/Claude optional — app starts even if both down.
- See `docs/architecture.md` and `docs/development.md`.

## Development Commands

| Task | Command |
|------|---------|
| Install all | `npm run install:all` or manual above |
| Dev both | `npm run dev` (calls `start-dev.ps1`) |
| Backend only | `npm run dev:backend` |
| Frontend only | `npm run dev:frontend` |
| Backend tests | `pytest -q` (from root, venv) |
| Frontend tests | `npm --prefix frontend run test` |
| Typecheck | `npm run typecheck` |
| Build | `npm run build` |
| Health | `npm run health` or `curl http://127.0.0.1:8000/api/health` |

## Security

- No cookie/token scraping, no auth bypass — `docs/file-security.md` audit.
- `MASTER_PLAN.md` is authoritative; `.env` gitignored.

## Phase Status

See `docs/phase-status.md` — currently Phase 3 workspace complete.
