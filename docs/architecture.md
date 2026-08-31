# Architecture — Multi-Agent AI Workspace

## Overview

Local-first Windows application. React frontend talks to FastAPI backend via HTTP. SQLite for persistence. Provider abstraction isolates LLM integrations from core orchestration.

```
┌─────────────┐      HTTP/JSON       ┌──────────────────────┐
│  React/Vite │ ──────────────────► │  FastAPI (Python)    │
│  Frontend   │ ◄────────────────── │  + SQLite            │
└─────────────┘                      └──────────────────────┘
                                            │
                                     Providers (Claude API,
                                      Ollama, Demo, Web*)
```

*Claude web/desktop accounts are distinct from Claude API and require legitimate supported mechanisms only.

## Backend Layout

```
backend/
  app/
    main.py              # FastAPI app factory, middleware, router wiring
    api/
      routes/
        health.py        # GET /api/health
      deps.py            # Shared dependencies
    core/
      config.py          # Pydantic Settings (env, CORS, DB URL, version)
      logging.py         # Structured logging setup
      errors.py          # Exception handlers, error envelope
    db/
      base.py            # SQLAlchemy engine/session/Base
      session.py         # get_db dependency
    models/              # SQLAlchemy models (future: projects, agents, etc.)
    schemas/             # Pydantic request/response schemas
    services/            # Business logic (project-scoped)
    providers/           # Provider abstraction (interface + implementations)
      base.py
      demo.py
      claude_api.py      # stub
      ollama.py          # stub
    agents/              # Agent runtime (future)
    orchestration/       # DAG engine (future)
    workspace/           # File management, permissions (future)
    memory/              # Project-scoped memory (future)
    events/              # Event timeline (future)
    notifications/       # Notifications (future)
```

## Frontend Layout

```
frontend/
  src/
    components/   # Reusable UI (layout, health badge, etc.)
    pages/        # Route pages
    layouts/      # App shell, sidebar
    features/     # Feature slices (health, projects, agents, workflows…)
    hooks/        # Shared hooks
    services/     # API clients
    stores/       # Lightweight state (Zustand)
    types/        # Shared TS types
```

## Principles

1. **Provider independence** — orchestration and agents depend on a `Provider` interface, not concrete SDKs.
2. **Backend owns secrets** — API keys never leave backend; frontend receives only status/capabilities.
3. **Project isolation** — data, memory, workspace, and artifacts are scoped by `project_id`.
4. **Testability** — demo provider enables offline tests; each subsystem mockable.
5. **No premature infra** — SQLite + file workspace suffice for local use; no Postgres/Redis/Docker until proven needed.

## API Conventions

- Prefix: `/api`
- Health: `GET /api/health` → `{ status: "ok", version, environment }`
- Errors: `{ detail: string, code?: string }` with appropriate HTTP status.
- CORS: configurable via `CORS_ORIGINS` (default allows Vite dev server).

## Configuration

`app.core.config.Settings` loads from env / `.env`:

- `APP_ENV`, `APP_VERSION`, `LOG_LEVEL`
- `DATABASE_URL` (default `sqlite:///./data/app.db` relative to backend)
- `CORS_ORIGINS`
- `VITE_API_BASE_URL` is frontend-only.

## Security

- No browser cookie scraping, token extraction, CAPTCHA bypass, or account automation.
- Provider credentials via env/backend store, not frontend, not git.
- Distinguish: Claude API vs Claude web/desktop vs Ollama vs Demo — not interchangeable.

## Future Phases

Projects, agents, roles, team chat, artifacts + versions, DAG workflows (parallel, conditions, approval, variables, pause/resume, retry, run-from-node, history, context inspection), notifications, search, command palette, IDE dashboard, settings/diagnostics.
