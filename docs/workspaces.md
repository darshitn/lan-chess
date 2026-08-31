# Workspaces

Project-isolated file storage under `workspace/<project-id>/`.

## Directory

- Each project gets `workspace/<project-id>/` created on `POST /api/projects` via `app/workspace/service.py:ensure_workspace` and `app/api/routes/projects.py`.
- Deleting a project `DELETE /api/projects/{id}` removes its workspace via `shutil.rmtree` (best-effort).
- Root is `workspace/` at repo root, or `WORKSPACE_ROOT` env override (`app/core/config.py:workspace_root`, `app/workspace/service.py:get_workspace_root`).

## File API

Base: `/api/projects/{project_id}/workspace` — all paths are POSIX relative to workspace root, caller supplies `path` or `from_path/to_path`. Every call:

1. Validates project exists (`_require_project`)
2. Resolves via `resolve_safe(project_id, path)` → absolute inside workspace or `400`
3. Checks `agent_id` permission if supplied (`check_permission` → `403` if lacking)
4. Records activity via `FileActivity.record` → `events` table (`file.read/write/delete`)

Endpoints — `app/api/routes/workspace.py`:

| Method | Path | Perm | Description |
|---|---|---|---|
| `GET` | `/list?path=&recursive=` | READ | Directory listing, sorted, skips symlinks |
| `GET` | `/read?path=` | READ | Text file read, 5MB limit, utf-8 only → `400` for binary |
| `POST` | `/create {path, content}` | WRITE | Fail `409` if exists, `create_dirs` default true |
| `POST` | `/write {path, content}` | WRITE | Create or overwrite |
| `POST` | `/rename {from_path, to_path}` | READ+WRITE+DELETE on source | `409` if dest exists |
| `POST` | `/delete {path, recursive}` | DELETE | `400` if non-empty dir without recursive |
| `GET` | `/search?q=&path=` | READ | Substring or glob (`*?[]`), max 100 hits |

Examples:

```bash
curl -X POST http://127.0.0.1:8000/api/projects/$PID/workspace/create -H 'Content-Type: application/json' -d '{"path":"src/app.py","content":"print(1)"}'
curl "http://127.0.0.1:8000/api/projects/$PID/workspace/list?path=src"
curl "http://127.0.0.1:8000/api/projects/$PID/workspace/search?q=*.py"
```

## Agent Permissions

Scoped per-path via `roles.permissions` JSON. Supported forms (`app/workspace/service.py:_parse_permissions`):

```json
{"READ": ["src/**"], "WRITE": ["src/**"], "DELETE": ["src/**"]}
[{"path":"plan.md","perm":"WRITE"}, {"path":"src","perm":"READ"}]
["READ","WRITE"]  // wildcard **
```

Resolver `_perm_matches` handles exact, prefix (`src` matches `src/file.txt`), and glob (`src/**`). Check `_parse_permissions` + `fnmatch`.

Example roles:

- Planner: `{"WRITE":["plan.md"],"READ":["src/**","plan.md"]}`
- Implementer: `{"READ":["src/**"],"WRITE":["src/**"]}`
- Reviewer: `{"READ":["src/**"]}`
- Tester: `{"READ":["tests/**"],"WRITE":["tests/**"]}`

`agent_id` query param on any workspace call triggers `check_permission` → also verifies agent belongs to that project (cross-project `403`). No `agent_id` → treated as workspace owner/user, allow all.

## Artifacts

`Artifact` + `ArtifactVersion` models (`app/models/artifact.py`), CRUD at `/api/projects/{pid}/artifacts`:

- `POST /artifacts {name,type,description,content_text,content_path,mime_type}` → creates `Artifact` + `Version 1`, `current_version_id` set. If `content_path` given, validates workspace path and stores preview (utf-8, 10KB).
- `GET /artifacts` list, `GET /artifacts/{id}` with `versions`, `GET /artifacts/{id}/versions`, `GET /artifacts/{id}/versions/{vid}`
- `PATCH /artifacts/{id} {content_text|content_path|mime_type}` → increments version, new `ArtifactVersion`

Artifacts are project-isolated (404 across projects), and version history is immutable.

## File Activity

Every successful operation writes `events` row (`type=file.read/write/delete`, `payload={agent_id,file,operation,ts}`) via `FileActivity.record`. Queryable via events API later.

## Testing

See `backend/tests/test_workspace.py` and `test_artifacts.py` — workspace creation, CRUD, traversal, cross-project, per-path permissions, artifacts/versions.

## Security

See `docs/file-security.md` for audit.
