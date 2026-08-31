from __future__ import annotations

import datetime as dt
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse

from app.api.deps import DbSession
from app.models.project import Project
from app.schemas.workspace import (
    DeleteRequest,
    FileEntry,
    ListResponse,
    ReadResponse,
    RenameRequest,
    RenameResponse,
    SearchResponse,
    WriteRequest,
    WriteResponse,
)
from app.workspace.service import (
    FileActivity,
    check_permission,
    ensure_workspace,
    resolve_safe,
    safe_search_root,
)

router = APIRouter(prefix="/projects/{project_id}/workspace", tags=["workspace"])


def _require_project(db: DbSession, project_id: str) -> Project:
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    # ensure workspace exists on access
    ensure_workspace(project_id)
    return p


def _to_entry(root: Path, p: Path) -> FileEntry:
    rel = p.relative_to(root).as_posix() if p != root else ""
    # For root listing, rel will be e.g., "file.txt"; for dir, "subdir"
    # stat
    try:
        st = p.stat()
        mtime = dt.datetime.fromtimestamp(st.st_mtime, tz=dt.timezone.utc).isoformat()
        size = st.st_size if p.is_file() else None
    except Exception:
        mtime = None
        size = None
    typ = "dir" if p.is_dir() else "file"
    # name is last component
    name = p.name if p != root else ""
    # path for entry: relative posix
    path = rel
    return FileEntry(name=name, path=path, type=typ, size=size, modified_at=mtime)


@router.get("/list", response_model=ListResponse)
def list_tree(
    project_id: str,
    db: DbSession,
    path: str | None = Query(default="", description="posix relative dir, empty=root"),
    recursive: bool = Query(default=False),
    agent_id: str | None = Query(default=None),
):
    _require_project(db, project_id)
    check_permission(db, project_id, agent_id, "READ", path or "")
    target = resolve_safe(project_id, path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    if not target.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")
    root = ensure_workspace(project_id)
    entries: list[FileEntry] = []
    if recursive:
        for p in target.rglob("*"):
            # skip hidden .git etc already blocked by service but double-check
            if p == root:
                continue
            # Only include direct traversal-safe? resolve_safe already prevents escape, but rglob follows symlinks? we block symlinks
            if p.is_symlink():
                continue
            entries.append(_to_entry(root, p))
    else:
        for child in target.iterdir():
            if child.is_symlink():
                continue
            entries.append(_to_entry(root, child))
    entries.sort(key=lambda e: (e.type, e.name))
    FileActivity.record(db, project_id, agent_id, path or "", "READ")
    return ListResponse(path=path or "", entries=entries)


@router.get("/read", response_model=ReadResponse)
def read_file(
    project_id: str,
    db: DbSession,
    path: str = Query(..., min_length=1, max_length=1024),
    agent_id: str | None = Query(default=None),
):
    _require_project(db, project_id)
    check_permission(db, project_id, agent_id, "READ", path)
    target = resolve_safe(project_id, path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if target.is_dir():
        raise HTTPException(status_code=400, detail="Path is a directory")
    # limit size 5MB
    if target.stat().st_size > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")
    try:
        content = target.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Binary file not readable as text")
    FileActivity.record(db, project_id, agent_id, path, "READ")
    return ReadResponse(path=path, content=content, size=len(content.encode("utf-8")))


@router.post("/write", response_model=WriteResponse)
def write_file(project_id: str, payload: WriteRequest, db: DbSession, agent_id: str | None = Query(default=None)):
    _require_project(db, project_id)
    # create vs overwrite both need WRITE
    check_permission(db, project_id, agent_id, "WRITE", payload.path)
    target = resolve_safe(project_id, payload.path)
    if target.exists() and target.is_dir():
        raise HTTPException(status_code=400, detail="Target is a directory")
    if payload.create_dirs:
        target.parent.mkdir(parents=True, exist_ok=True)
    else:
        if not target.parent.exists():
            raise HTTPException(status_code=404, detail="Parent directory not found")
    # Write as utf-8
    target.write_text(payload.content, encoding="utf-8")
    FileActivity.record(db, project_id, agent_id, payload.path, "WRITE")
    return WriteResponse(path=payload.path, size=len(payload.content.encode("utf-8")))


@router.post("/create", response_model=WriteResponse)
def create_file(project_id: str, payload: WriteRequest, db: DbSession, agent_id: str | None = Query(default=None)):
    _require_project(db, project_id)
    check_permission(db, project_id, agent_id, "WRITE", payload.path)
    target = resolve_safe(project_id, payload.path)
    if target.exists():
        raise HTTPException(status_code=409, detail="File already exists")
    if payload.create_dirs:
        target.parent.mkdir(parents=True, exist_ok=True)
    else:
        if not target.parent.exists():
            raise HTTPException(status_code=404, detail="Parent directory not found")
    target.write_text(payload.content, encoding="utf-8")
    FileActivity.record(db, project_id, agent_id, payload.path, "WRITE")
    return WriteResponse(path=payload.path, size=len(payload.content.encode("utf-8")))


@router.post("/rename", response_model=RenameResponse)
def rename_file(project_id: str, payload: RenameRequest, db: DbSession, agent_id: str | None = Query(default=None)):
    _require_project(db, project_id)
    # Need READ on source and WRITE on dest, and DELETE on source? We'll require WRITE on both for simplicity, plus DELETE check on source
    check_permission(db, project_id, agent_id, "READ", payload.from_path)
    check_permission(db, project_id, agent_id, "WRITE", payload.to_path)
    # Also need DELETE on source if moving
    # If no explicit DELETE perm, WRITE is enough? But spec says DELETE permission exists, so check it
    try:
        check_permission(db, project_id, agent_id, "DELETE", payload.from_path)
    except HTTPException as e:
        if e.status_code == 403:
            # Fallback: if DELETE not explicitly granted but WRITE is, allow? Strict: require DELETE
            raise
    src = resolve_safe(project_id, payload.from_path)
    dst = resolve_safe(project_id, payload.to_path)
    if not src.exists():
        raise HTTPException(status_code=404, detail="Source not found")
    if dst.exists():
        raise HTTPException(status_code=409, detail="Destination already exists")
    dst.parent.mkdir(parents=True, exist_ok=True)
    src.rename(dst)
    FileActivity.record(db, project_id, agent_id, f"{payload.from_path} -> {payload.to_path}", "WRITE")
    return RenameResponse(from_path=payload.from_path, to_path=payload.to_path)


@router.post("/delete", status_code=200)
def delete_file(project_id: str, payload: DeleteRequest, db: DbSession, agent_id: str | None = Query(default=None)):
    _require_project(db, project_id)
    check_permission(db, project_id, agent_id, "DELETE", payload.path)
    target = resolve_safe(project_id, payload.path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    if target.is_dir():
        if not payload.recursive:
            # if directory not empty, require recursive
            try:
                next(target.iterdir())
                raise HTTPException(status_code=400, detail="Directory not empty, use recursive=true")
            except StopIteration:
                pass
        # remove recursively
        import shutil

        shutil.rmtree(target)
    else:
        target.unlink()
    FileActivity.record(db, project_id, agent_id, payload.path, "DELETE")
    return {"deleted": payload.path}


@router.get("/search", response_model=SearchResponse)
def search_files(
    project_id: str,
    db: DbSession,
    q: str = Query(..., min_length=1, max_length=200, description="substring or glob"),
    path: str | None = Query(default="", description="base dir"),
    agent_id: str | None = Query(default=None),
):
    _require_project(db, project_id)
    check_permission(db, project_id, agent_id, "READ", path or "")
    root = ensure_workspace(project_id)
    base = resolve_safe(project_id, path)
    if not base.exists() or not base.is_dir():
        raise HTTPException(status_code=404, detail="Base path not found")
    matches: list[FileEntry] = []
    # Support glob or substring
    is_glob = any(ch in q for ch in "*?[]")
    for p in base.rglob("*"):
        if p.is_symlink():
            continue
        rel = p.relative_to(root).as_posix()
        name = p.name
        if is_glob:
            import fnmatch

            if fnmatch.fnmatch(rel, q) or fnmatch.fnmatch(name, q):
                matches.append(_to_entry(root, p))
        else:
            if q.lower() in rel.lower() or q.lower() in name.lower():
                matches.append(_to_entry(root, p))
        if len(matches) >= 100:
            break
    FileActivity.record(db, project_id, agent_id, q, "READ")
    return SearchResponse(query=q, matches=matches)
