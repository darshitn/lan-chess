from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.api.deps import DbSession, PaginationDeps
from app.models.artifact import Artifact, ArtifactVersion
from app.models.project import Project
from app.schemas.artifact import ArtifactCreate, ArtifactOut, ArtifactUpdate, ArtifactVersionOut, ArtifactWithVersionsOut
from app.workspace.service import check_permission, ensure_workspace, resolve_safe

router = APIRouter(prefix="/projects/{project_id}/artifacts", tags=["artifacts"])


def _require_project(db: DbSession, project_id: str) -> Project:
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    ensure_workspace(project_id)
    return p


def _artifact_to_out(a: Artifact, db: DbSession) -> ArtifactOut:
    # Load current version if exists
    current = None
    if a.current_version_id:
        current = db.get(ArtifactVersion, a.current_version_id)
    return ArtifactOut(
        id=a.id,
        project_id=a.project_id,
        name=a.name,
        type=a.type,
        description=a.description,
        current_version_id=a.current_version_id,
        created_at=a.created_at,
        updated_at=a.updated_at,
        current_version=ArtifactVersionOut.model_validate(current) if current else None,
    )


@router.post("", response_model=ArtifactOut, status_code=status.HTTP_201_CREATED)
def create_artifact(project_id: str, payload: ArtifactCreate, db: DbSession, agent_id: str | None = Query(default=None)):
    _require_project(db, project_id)
    # Workspace file permission if content_path provided
    if payload.content_path:
        path = payload.content_path
        # Will validate path and permission
        check_permission(db, project_id, agent_id, "WRITE", path)
        # Validate path is inside workspace (resolve_safe)
        resolve_safe(project_id, path)
    else:
        if agent_id:
            check_permission(db, project_id, agent_id, "WRITE", payload.name)
    # Agent check (use content_path if present, else name)
    perm_target = payload.content_path or payload.name
    if payload.created_by_agent_id:
        check_permission(db, project_id, payload.created_by_agent_id, "WRITE", perm_target)
        # also ensure agent belongs to project (check_permission already does cross-project)
    artifact = Artifact(
        project_id=project_id,
        name=payload.name,
        type=payload.type,
        description=payload.description,
    )
    db.add(artifact)
    db.flush()  # get id
    # Create version 1
    content_text = payload.content_text or ""
    size = len(content_text.encode("utf-8")) if content_text else 0
    # If content_path provided, try to read file size if exists
    if payload.content_path and not content_text:
        try:
            p = resolve_safe(project_id, payload.content_path)
            if p.exists() and p.is_file():
                size = p.stat().st_size
                content_text = p.read_text(encoding="utf-8", errors="ignore")[:10000]  # store preview
        except Exception:
            pass
    version = ArtifactVersion(
        artifact_id=artifact.id,
        version=1,
        content_path=payload.content_path,
        content_text=content_text,
        mime_type=payload.mime_type,
        size_bytes=size,
        created_by_agent_id=payload.created_by_agent_id,
    )
    db.add(version)
    db.flush()
    artifact.current_version_id = version.id
    db.commit()
    db.refresh(artifact)
    return _artifact_to_out(artifact, db)


@router.get("", response_model=list[ArtifactOut])
def list_artifacts(project_id: str, db: DbSession, pagination: PaginationDeps, agent_id: str | None = Query(default=None)):
    _require_project(db, project_id)
    if agent_id:
        check_permission(db, project_id, agent_id, "READ", "")
    stmt = select(Artifact).where(Artifact.project_id == project_id).order_by(Artifact.created_at.desc()).offset(pagination["skip"]).limit(pagination["limit"])
    items = list(db.execute(stmt).scalars().all())
    return [_artifact_to_out(a, db) for a in items]


@router.get("/{artifact_id}", response_model=ArtifactWithVersionsOut)
def get_artifact(project_id: str, artifact_id: str, db: DbSession, agent_id: str | None = Query(default=None)):
    _require_project(db, project_id)
    if agent_id:
        check_permission(db, project_id, agent_id, "READ", "")
    a = db.get(Artifact, artifact_id)
    if not a or a.project_id != project_id:
        raise HTTPException(status_code=404, detail="Artifact not found")
    versions = db.execute(select(ArtifactVersion).where(ArtifactVersion.artifact_id == artifact_id).order_by(ArtifactVersion.version.asc())).scalars().all()
    out = _artifact_to_out(a, db)
    return ArtifactWithVersionsOut(
        id=out.id,
        project_id=out.project_id,
        name=out.name,
        type=out.type,
        description=out.description,
        current_version_id=out.current_version_id,
        created_at=out.created_at,
        updated_at=out.updated_at,
        current_version=out.current_version,
        versions=[ArtifactVersionOut.model_validate(v) for v in versions],
    )


@router.patch("/{artifact_id}", response_model=ArtifactOut)
def update_artifact(project_id: str, artifact_id: str, payload: ArtifactUpdate, db: DbSession, agent_id: str | None = Query(default=None)):
    _require_project(db, project_id)
    a = db.get(Artifact, artifact_id)
    if not a or a.project_id != project_id:
        raise HTTPException(status_code=404, detail="Artifact not found")
    # Permission: need WRITE on artifact name/path
    target_path = payload.content_path or payload.name or a.name
    if agent_id:
        check_permission(db, project_id, agent_id, "WRITE", target_path)
    if payload.created_by_agent_id and agent_id:
        check_permission(db, project_id, payload.created_by_agent_id, "WRITE", target_path)
    # Apply fields to artifact meta
    if payload.name is not None:
        a.name = payload.name
    if payload.description is not None:
        a.description = payload.description
    # Determine if we need new version (content changed)
    needs_version = payload.content_text is not None or payload.content_path is not None or payload.mime_type is not None
    if needs_version:
        # Find max version
        max_v = db.execute(select(ArtifactVersion.version).where(ArtifactVersion.artifact_id == artifact_id).order_by(ArtifactVersion.version.desc())).scalars().first()
        next_ver = (max_v or 0) + 1
        content_text = payload.content_text
        if payload.content_path and content_text is None:
            try:
                p = resolve_safe(project_id, payload.content_path)
                if p.exists() and p.is_file():
                    content_text = p.read_text(encoding="utf-8", errors="ignore")[:10000]
            except Exception:
                content_text = None
        size = len((content_text or "").encode("utf-8"))
        version = ArtifactVersion(
            artifact_id=artifact_id,
            version=next_ver,
            content_path=payload.content_path,
            content_text=content_text,
            mime_type=payload.mime_type,
            size_bytes=size,
            created_by_agent_id=payload.created_by_agent_id or agent_id,
        )
        db.add(version)
        db.flush()
        a.current_version_id = version.id
    db.commit()
    db.refresh(a)
    return _artifact_to_out(a, db)


@router.get("/{artifact_id}/versions", response_model=list[ArtifactVersionOut])
def list_versions(project_id: str, artifact_id: str, db: DbSession, agent_id: str | None = Query(default=None)):
    _require_project(db, project_id)
    if agent_id:
        check_permission(db, project_id, agent_id, "READ", "")
    a = db.get(Artifact, artifact_id)
    if not a or a.project_id != project_id:
        raise HTTPException(status_code=404, detail="Artifact not found")
    versions = db.execute(select(ArtifactVersion).where(ArtifactVersion.artifact_id == artifact_id).order_by(ArtifactVersion.version.asc())).scalars().all()
    return [ArtifactVersionOut.model_validate(v) for v in versions]


@router.get("/{artifact_id}/versions/{version_id}", response_model=ArtifactVersionOut)
def get_version(project_id: str, artifact_id: str, version_id: str, db: DbSession, agent_id: str | None = Query(default=None)):
    _require_project(db, project_id)
    if agent_id:
        check_permission(db, project_id, agent_id, "READ", "")
    v = db.get(ArtifactVersion, version_id)
    if not v or v.artifact_id != artifact_id:
        raise HTTPException(status_code=404, detail="Version not found")
    # Ensure project matches
    a = db.get(Artifact, artifact_id)
    if not a or a.project_id != project_id:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return ArtifactVersionOut.model_validate(v)
