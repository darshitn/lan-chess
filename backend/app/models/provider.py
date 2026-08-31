from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import JSON, DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ProviderStatus


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # kind is the provider type: demo | ollama | claude (unique)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # status describes availability, not fake "connected" state
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=ProviderStatus.available.value)
    # config holds non-secret metadata (e.g., ollama host placeholder); secrets stay in env/backend store
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # capabilities: freeform metadata about models/tools
    capabilities: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    profiles: Mapped[list["Profile"]] = relationship("Profile", back_populates="provider_rel", cascade="all, delete-orphan", passive_deletes=True)

    __table_args__ = (
        Index("ix_providers_kind", "kind", unique=True),
        Index("ix_providers_status", "status"),
    )
