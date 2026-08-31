from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DbSession, PaginationDeps
from app.models.profile import Profile
from app.models.provider import Provider
from app.schemas.profile import ProfileCreate, ProfileOut, ProfileUpdate

router = APIRouter(prefix="/profiles", tags=["profiles"])


def _validate_provider_exists(db: DbSession, provider_kind: str, provider_id: str | None) -> None:
    if provider_id:
        prov = db.get(Provider, provider_id)
        if not prov:
            raise HTTPException(status_code=400, detail="provider_id not found")
        # kind must match if both supplied
        if prov.kind != provider_kind:
            raise HTTPException(status_code=400, detail="provider mismatch between provider and provider_id")
    else:
        # No provider_id — still valid, but we note provider kind is known enum (validated by schema)
        pass


@router.post("", response_model=ProfileOut, status_code=status.HTTP_201_CREATED)
def create_profile(payload: ProfileCreate, db: DbSession) -> Profile:
    _validate_provider_exists(db, payload.provider, payload.provider_id)
    obj = Profile(
        name=payload.name,
        provider=payload.provider,
        provider_id=payload.provider_id,
        status=payload.status,
        metadata_json=payload.metadata,  # type: ignore[arg-type]
        credentials_ref=payload.credentials_ref,
    )
    db.add(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to create profile")
    db.refresh(obj)
    return obj


@router.get("", response_model=list[ProfileOut])
def list_profiles(
    db: DbSession,
    pagination: PaginationDeps,
    provider: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
) -> list[Profile]:
    stmt = select(Profile)
    if provider:
        stmt = stmt.where(Profile.provider == provider.lower())
    if status_filter:
        stmt = stmt.where(Profile.status == status_filter)
    stmt = stmt.order_by(Profile.created_at.desc()).offset(pagination["skip"]).limit(pagination["limit"])
    return list(db.execute(stmt).scalars().all())


@router.get("/{profile_id}", response_model=ProfileOut)
def get_profile(profile_id: str, db: DbSession) -> Profile:
    obj = db.get(Profile, profile_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Profile not found")
    return obj


@router.patch("/{profile_id}", response_model=ProfileOut)
def update_profile(profile_id: str, payload: ProfileUpdate, db: DbSession) -> Profile:
    obj = db.get(Profile, profile_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Profile not found")
    data = payload.model_dump(exclude_unset=True)
    # Handle alias
    if "metadata" in data:
        data["metadata_json"] = data.pop("metadata")
    # Validate provider linkage if changed
    new_provider = data.get("provider", obj.provider)
    new_provider_id = data.get("provider_id", obj.provider_id)
    if "provider" in data or "provider_id" in data:
        _validate_provider_exists(db, new_provider, new_provider_id)
    for k, v in data.items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to update profile")
    db.refresh(obj)
    return obj


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(profile_id: str, db: DbSession) -> None:
    obj = db.get(Profile, profile_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Profile not found")
    db.delete(obj)
    db.commit()
    return None
