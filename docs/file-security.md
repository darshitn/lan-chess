# File Security

Audit of `app/workspace/service.py` and `app/api/routes/workspace.py` / `artifacts.py`.

## Threat Model

Workspace must be confined to `workspace/<project-id>/`. Agents are untrusted per-path.

## Protections

### 1. Path Normalization (`_normalize_user_path`)

- Rejects `\x00` null bytes.
- Converts `\` → `/`, strips whitespace, rejects leading `/`, `~`, or `C:` drive letters.
- Rejects any `..` component before join; rebuilds cleaned path without `.` components.
- Blocks `.git`/`.hg`/`.svn` components.

### 2. Escape Prevention (`resolve_safe`)

- `ensure_workspace(project_id)` validates `project_id` (no `/\..`) and creates `workspace/<id>`; verifies `realpath` is inside `get_workspace_root()`.
- `target = (workspace / normalized).resolve()` then `target.relative_to(workspace.resolve())` — fails if `..` via encoded tricks or absolute after resolve.
- Symlink checks:
  - If `target.is_symlink()` → `target.resolve()` must be inside workspace.
  - Walk intermediate components `workspace/a/b/...` — any symlink on the way must resolve inside workspace.
  - `list`/`search` skip symlinks; `read`/`write` reject symlink targets outside.

Tested: `test_path_traversal_blocked` tries `../escape`, `/absolute`, `C:\windows`, `a/../../b`; `test_symlink_blocked` creates outside file + symlink → `400`.

### 3. Absolute / Traversal Vectors

- Absolute `/etc/passwd` → `400 Absolute paths not allowed`
- `../` anywhere → `400 Path traversal via ..`
- `//`, trailing spaces, drive letters → rejected.
- Double-encoded `%2e%2e` not decoded server-side (client sends raw string, not URL-decoded by us beyond FastAPI; `PurePosixPath` would treat `%2e` as literal, not `..`, so safe).

### 4. Cross-Project Access

- Every route calls `_require_project` (404 if unknown) then `resolve_safe` scoped to that `project_id`.
- `check_permission` verifies `agent.project_id == path project_id` → `403 Cross-project agent access denied`. Test `test_cross_project_access_blocked` creates file in P1, verifies P2 cannot read it, and P1's agent cannot read P2 even when file exists there.

### 5. Permissions

- `roles.permissions` parsed via `_parse_permissions` supporting dict `{READ:[...]}`, list `[{"path","perm"}]`, wildcard `"**"`.
- `_perm_matches` handles prefix (`src` → `src/file`), exact, and glob `src/**` via `fnmatch`.
- Enforcement points:
  - File API: `READ` for list/read/search, `WRITE` for create/write, `READ+WRITE+DELETE` for rename, `DELETE` for delete.
  - Artifacts: `WRITE` on `content_path` or `name` for create, `WRITE` on target for update, `READ` for list/get.
- If `agent_id` absent → owner, allow all. If role has `null` permissions → allow all (backward compat). Otherwise require explicit allow → `403 Agent lacks PERM`.

Tested: `test_permissions_per_path` covers Planner/Implementer/Reviewer/Tester matrix, including read-allowed but write-denied.

### 6. DoS / Size

- `read` rejects `>5MB` → `413 File too large`
- `read_text(utf-8)` → `400 Binary file not readable`
- `search` caps at 100 matches, `rglob` on limited tree.
- `write` writes utf-8 only, `create_dirs` guarded.

### 7. Artifact Isolation

- `artifact.project_id` checked on every get/patch/versions → cross-project `404`.
- `content_path` validated via `resolve_safe` (not just string) before version creation.

### 8. Activity & Audit

- `FileActivity.record` writes `events` with `agent, file, operation, ts`. Query via `SELECT * FROM events WHERE project_id = ?`. Validated in `test_file_activity_recorded`.

### 9. Test Coverage

- `test_workspace.py`: creation, CRUD, traversal, cross-project, per-path permissions, symlink (skipped on Windows without privilege), activity.
- `test_artifacts.py`: create/update/version history, file-path binding, cross-project isolation, permissions.
- `norecursedirs` in `backend/pyproject.toml` prevents pytest from collecting `workspace/**/test_*.py` files created during tests (previously caused `NameError` on `workspace/e0.../tests/test_app.py` with content `new`).

### 10. Residual Risks & Mitigations

- Windows symlink privilege `SeCreateSymbolicLinkPrivilege` — test skips if not held; server still blocks via `is_symlink` check when link exists (requires privilege to create, attacker without it cannot create link anyway).
- Time-of-check vs time-of-use (TOCTOU) between `resolve_safe` and `open` — mitigated by `resolve()` after mkdir; for high-security, consider `open` with `O_NOFOLLOW` (Unix) – out of scope for local Windows.
- Binary exfiltration via `read` blocked by utf-8 check; future binary endpoint should add content-type handling.
- `EXECUTE` permission parsed but not enforced on file ops (reserved for workflow engine Phase 4).

## Verification

```bash
pytest -q
# 72 passed, 1 skipped (symlink on Windows), 1 warning
```

All traversal, escape, and permission tests pass; file operations remain inside `workspace/<project-id>/` under audit.
