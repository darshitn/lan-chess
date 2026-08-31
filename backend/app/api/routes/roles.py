from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DbSession, PaginationDeps
from app.models.role import Role
from app.schemas.role import RoleCreate, RoleOut, RoleUpdate

router = APIRouter(prefix="/roles", tags=["roles"])


@router.post("", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(payload: RoleCreate, db: DbSession) -> Role:
    obj = Role(
        name=payload.name,
        description=payload.description,
        system_prompt=payload.system_prompt,
        default_provider=payload.default_provider,
        default_model=payload.default_model,
        permissions=payload.permissions,
        tools=payload.tools,
    )
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig) if hasattr(e, "orig") else str(e)
        if "UNIQUE" in msg or "unique" in msg.lower():
            raise HTTPException(status_code=409, detail="Role name already exists")
        raise HTTPException(status_code=400, detail="Failed to create role")
    db.refresh(obj)
    return obj


@router.get("", response_model=list[RoleOut])
def list_roles(db: DbSession, pagination: PaginationDeps) -> list[Role]:
    stmt = select(Role).order_by(Role.created_at.desc()).offset(pagination["skip"]).limit(pagination["limit"])
    return list(db.execute(stmt).scalars().all())


@router.get("/{role_id}", response_model=RoleOut)
def get_role(role_id: str, db: DbSession) -> Role:
    obj = db.get(Role, role_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Role not found")
    return obj


@router.patch("/{role_id}", response_model=RoleOut)
def update_role(role_id: str, payload: RoleUpdate, db: DbSession) -> Role:
    obj = db.get(Role, role_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Role not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig) if hasattr(e, "orig") else str(e)
        if "UNIQUE" in msg or "unique" in msg.lower():
            raise HTTPException(status_code=409, detail="Role name already exists")
        raise HTTPException(status_code=400, detail="Failed to update role")
    db.refresh(obj)
    return obj


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(role_id: str, db: DbSession) -> None:
    obj = db.get(Role, role_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Role not found")
    try:
        db.delete(obj)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Cannot delete role in use")
    return None
