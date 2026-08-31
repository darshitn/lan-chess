from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DbSession, PaginationDeps
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from app.workspace.service import ensure_workspace, get_project_workspace
import shutil

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: DbSession) -> Project:
    obj = Project(
        name=payload.name,
        description=payload.description,
        workspace_path=payload.workspace_path,
        status=payload.status,
    )
    db.add(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to create project")
    db.refresh(obj)
    # Create isolated workspace
    try:
        ws = ensure_workspace(obj.id)
        # If workspace_path provided, store relative? Keep as requested but ensure workspace exists
        # Update project workspace_path to actual path if not set
        if not obj.workspace_path:
            obj.workspace_path = ws.as_posix()
            db.commit()
            db.refresh(obj)
    except Exception:
        pass
    return obj


@router.get("", response_model=list[ProjectOut])
def list_projects(
    db: DbSession,
    pagination: PaginationDeps,
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None, description="Search name/description"),
) -> list[Project]:
    stmt = select(Project)
    if status_filter:
        stmt = stmt.where(Project.status == status_filter)
    if q:
        like = f"%{q}%"
        stmt = stmt.where((Project.name.like(like)) | (Project.description.like(like)))
    stmt = stmt.order_by(Project.created_at.desc()).offset(pagination["skip"]).limit(pagination["limit"])
    return list(db.execute(stmt).scalars().all())


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: DbSession) -> Project:
    obj = db.get(Project, project_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Project not found")
    return obj


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, payload: ProjectUpdate, db: DbSession) -> Project:
    obj = db.get(Project, project_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Project not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to update project")
    db.refresh(obj)
    return obj


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, db: DbSession) -> None:
    obj = db.get(Project, project_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(obj)
    db.commit()
    # Optionally clean workspace (not auto-delete to allow forensic, but we clean if empty? Here we remove)
    try:
        ws = get_project_workspace(project_id)
        if ws.exists() and ws.is_dir():
            shutil.rmtree(ws, ignore_errors=True)
    except Exception:
        pass
    return None
