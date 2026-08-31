# Phase Status

## Phase 0 — FOUNDATION: COMPLETE
- FastAPI + Vite + SQLite, health, CORS, logging, testing infra
- Verified: backend/frontend start, DB init, /api/health, typecheck, build

## Phase 1 — DATABASE AND CORE BACKEND: COMPLETE
- Models: Project, Agent, Role, Provider, Profile, Workflow, WorkflowNode, WorkflowEdge, WorkflowRun, WorkflowNodeRun, Message, Artifact, ArtifactVersion, AgentMemory, Event, Notification, Setting (FKs, indexes, timestamps)
- CRUD: /api/projects, /api/agents, /api/roles, /api/providers, /api/profiles, /api/settings
- Migrations: `app/db/migrations.py` + `init_db`, safe user_version, FK pragma
- Tests: 31 → 72 now, validation, relationships, error handling

## Phase 2 — PROVIDER ABSTRACTION: COMPLETE
- Interface: health/models/generate/stream/cancel (provider-independent, `app/providers/base.py`)
- DemoProvider deterministic `[DEMO]` (never real AI), OllamaProvider (configurable `OLLAMA_HOST`/`OLLAMA_URL` → `http://127.0.0.1:11434`, handles `0.0.0.0`→`127.0.0.1`), Claude stub
- AgentRunner provider-agnostic (`app/agents/runner.py` contains no Ollama code)
- APIs: `/providers/{id}/health/models/generate/stream/cancel`, `/agents/{id}/generate/stream`
- Docs: `docs/providers.md`, `docs/ollama.md`
- Tests mocked (no real Ollama required), typecheck/build pass

## Phase 3 — PROJECT WORKSPACE: COMPLETE (2026-08-31)

### Implementation
- **Isolated workspace** `workspace/<project-id>/` — `app/workspace/service.py:ensure_workspace` on project create, `shutil.rmtree` on delete, `get_workspace_root()` respects `WORKSPACE_ROOT` env
- **File API** `app/api/routes/workspace.py`: `GET /list?path=&recursive=`, `GET /read?path=`, `POST /create`, `POST /write`, `POST /rename`, `POST /delete`, `GET /search?q=` — all via `resolve_safe` + `check_permission` + `FileActivity.record`
- **Security**: `_normalize_user_path` blocks null, absolute, drive, `..`, `.git`; `resolve_safe` does `resolve()` + `relative_to` + symlink walk (intermediate + target) — blocks traversal, absolute, symlink escape, cross-project (`agent.project_id` vs `project_id` →403). `test_path_traversal_blocked`, `test_cross_project_access_blocked`, `test_symlink_blocked`
- **Permissions** `READ/WRITE/EXECUTE/DELETE` per-path via `roles.permissions` (`{"READ":["src/**"]}` or `[{"path","perm"}]`/`["READ"]→**`) parsed by `_parse_permissions`, matched by `_perm_matches` (prefix/glob). Example Planner/Implementer/Reviewer/Tester verified in `test_permissions_per_path`
- **File activity** `FileActivity.record` → `events` (`file.read/write/delete`, `agent, project, path, operation, timestamp`) — `test_file_activity_recorded`
- **Artifacts** `app/models/artifact.py` + `app/api/routes/artifacts.py`: `POST /projects/{pid}/artifacts`, `GET`, `GET /{id}`+versions, `PATCH` bump version, `GET /{id}/versions` — project-isolated, version history, `content_path` validated via `resolve_safe`
- **Docs**: `docs/workspaces.md`, `docs/file-security.md` (audit)

### Files Changed (Phase 3 delta + startup fixes)
- `backend/app/workspace/service.py` (new, 200+ lines, path validation, permissions, activity)
- `backend/app/schemas/workspace.py` (new), `schemas/artifact.py` (new)
- `backend/app/api/routes/workspace.py` (new, 7 endpoints), `api/routes/artifacts.py` (new, 6 endpoints), `api/routes/projects.py` (workspace create/delete)
- `backend/app/core/config.py` (CORS comma→JSON fix, OLLAMA_URL alias, workspace_root)
- `backend/app/db/base.py` (relative DB path fix), `app/main.py` (workspace+artifacts routers)
- `backend/app/providers/ollama.py` (0.0.0.0→127.0.0.1 fix), `app/api/routes/health.py` + `schemas/health.py` (detailed diagnostics)
- `backend/pyproject.toml` (norecursedirs), `backend/tests/conftest.py` (workspace clean), `tests/test_workspace.py` + `test_artifacts.py` (new)
- `frontend/vite.config.ts` (proxy), `src/types/health.ts` + `services/api.ts` + `components/HealthBadge.tsx` (centralized API, distinct statuses), `layouts/AppShell.tsx` + `pages/Dashboard.tsx` (Phase 2/3 UI)
- `package.json` (root, `npm run dev`), `start-dev.ps1`/`start-dev.bat`/`scripts/dev.ps1`, `.env.example` (JSON CORS, OLLAMA_URL, docs), `.env`/`frontend/.env` fixes, `README.md` (quick start), `docs/phase-status.md` (new)
- `.gitignore` already correct

### Tests
- `pytest -q` → **72 passed, 1 skipped** (Windows symlink privilege), 1 warning (Starlette deprecation)
  - Includes `test_workspace.py` (creation, CRUD, traversal 8 cases, cross-project, Planner/Implementer/Reviewer/Tester, symlink, activity)
  - `test_artifacts.py` (create/versions, file-path binding, isolation, permissions)
  - Phase 0-2 still pass (health, provider interface, demo, ollama mocked, agent runner)
- Frontend `npm --prefix frontend run test` → 3 passed, `typecheck` pass, `build` `200.57 kB ✓` (also root `npm run typecheck/build`)

### Known Issues
- Windows symlink test skipped without `SeCreateSymbolicLinkPrivilege` (expected)
- `0.0.0.0` Ollama env now translated to `127.0.0.1` — if user intentionally binds Ollama to `0.0.0.0` for remote, client still uses localhost (local-only design, correct)
- `EXECUTE` permission parsed but not enforced on file ops (reserved for workflow engine Phase 5)

### Manual Verification
- `GET /api/health` → `{status:ok, database:ok, providers:{demo:available, ollama:available, claude:not_configured}}` (Ollama running → available, else unavailable but `status:ok`)
- `GET /api/diagnostics` same + `ollama.latency_ms`
- With `ANTHROPIC_API_KEY` unset and Ollama stopped (mocked), health still `ok` → demo available, no crash (verified via `pytest` mocks + live with env cleared)
- Fresh checkout: `COPY .env.example .env`, `pip install -r backend/requirements.txt`, `npm --prefix frontend install`, `npm run dev` → backend 8000 + frontend 5173 both up, `workspace/<id>/` created on project POST, traversal `../../../` →400, cross-project →403/404
- File ops via Swagger `/docs` and `curl` for list/read/create/write/rename/delete/search (+ `agent_id` query)

### Security Verification
- All `../../../`, `/absolute`, `C:\`, symlink→outside, cross-project blocked per `docs/file-security.md` audit (9 categories, TOCTOU noted, 100-match cap, 5MB limit)

## Next Phase Recommendation
- **Phase 4 — Agents, Roles, Memory and Context** (per `MASTER_PLAN.md` §10) — custom roles already CRUD, need memory/context inspector + agent statuses (OFFLINE/READY/WORKING etc.) before DAG.

