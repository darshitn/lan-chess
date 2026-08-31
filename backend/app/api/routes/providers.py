from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DbSession, PaginationDeps
from app.models.provider import Provider
from app.schemas.provider import ProviderCreate, ProviderOut, ProviderUpdate

router = APIRouter(prefix="/providers", tags=["providers"])


@router.post("", response_model=ProviderOut, status_code=status.HTTP_201_CREATED)
def create_provider(payload: ProviderCreate, db: DbSession) -> Provider:
    obj = Provider(
        kind=payload.kind,
        display_name=payload.display_name,
        description=payload.description,
        status=payload.status,
        config=payload.config,
        capabilities=payload.capabilities,
    )
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig) if hasattr(e, "orig") else str(e)
        if "UNIQUE" in msg or "unique" in msg.lower():
            raise HTTPException(status_code=409, detail="Provider kind already exists")
        raise HTTPException(status_code=400, detail="Failed to create provider")
    db.refresh(obj)
    return obj


@router.get("", response_model=list[ProviderOut])
def list_providers(db: DbSession, pagination: PaginationDeps) -> list[Provider]:
    stmt = select(Provider).order_by(Provider.created_at.asc()).offset(pagination["skip"]).limit(pagination["limit"])
    return list(db.execute(stmt).scalars().all())


@router.get("/{provider_id}", response_model=ProviderOut)
def get_provider(provider_id: str, db: DbSession) -> Provider:
    obj = db.get(Provider, provider_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Provider not found")
    return obj


@router.patch("/{provider_id}", response_model=ProviderOut)
def update_provider(provider_id: str, payload: ProviderUpdate, db: DbSession) -> Provider:
    obj = db.get(Provider, provider_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Provider not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to update provider")
    db.refresh(obj)
    return obj


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_provider(provider_id: str, db: DbSession) -> None:
    obj = db.get(Provider, provider_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Provider not found")
    db.delete(obj)
    db.commit()
    return None
