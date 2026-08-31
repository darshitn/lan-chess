from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbSession, PaginationDeps
from app.models.setting import Setting
from app.schemas.setting import SettingCreate, SettingOut, SettingUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


@router.post("", response_model=SettingOut, status_code=status.HTTP_201_CREATED)
def create_setting(payload: SettingCreate, db: DbSession) -> Setting:
    existing = db.get(Setting, payload.key)
    if existing:
        raise HTTPException(status_code=409, detail="Setting key already exists")
    obj = Setting(key=payload.key, value=payload.value, description=payload.description)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("", response_model=list[SettingOut])
def list_settings(db: DbSession, pagination: PaginationDeps) -> list[Setting]:
    stmt = select(Setting).order_by(Setting.key.asc()).offset(pagination["skip"]).limit(pagination["limit"])
    return list(db.execute(stmt).scalars().all())


@router.get("/{key}", response_model=SettingOut)
def get_setting(key: str, db: DbSession) -> Setting:
    obj = db.get(Setting, key)
    if not obj:
        raise HTTPException(status_code=404, detail="Setting not found")
    return obj


@router.put("/{key}", response_model=SettingOut)
def upsert_setting(key: str, payload: SettingUpdate, db: DbSession) -> Setting:
    obj = db.get(Setting, key)
    if not obj:
        obj = Setting(key=key, value=payload.value, description=payload.description)
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj
    obj.value = payload.value
    if payload.description is not None:
        obj.description = payload.description
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{key}", response_model=SettingOut)
def patch_setting(key: str, payload: SettingUpdate, db: DbSession) -> Setting:
    obj = db.get(Setting, key)
    if not obj:
        raise HTTPException(status_code=404, detail="Setting not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_setting(key: str, db: DbSession) -> None:
    obj = db.get(Setting, key)
    if not obj:
        raise HTTPException(status_code=404, detail="Setting not found")
    db.delete(obj)
    db.commit()
    return None
