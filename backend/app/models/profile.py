from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ProfileStatus


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # provider references Provider.kind but also FK to providers.id when using provider_id
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("providers.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=ProfileStatus.NOT_CONFIGURED.value)
    # metadata_ avoids collision with SQLAlchemy reserved "metadata"
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    # credentials placeholder — never store real secrets in plaintext; this is for structure only
    # actual secrets remain in env/backend store, not here
    credentials_ref: Mapped[str | None] = mapped_column(String(512), nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    provider_rel: Mapped["Provider | None"] = relationship("Provider", back_populates="profiles")

    __table_args__ = (
        Index("ix_profiles_provider", "provider"),
        Index("ix_profiles_status", "status"),
        Index("ix_profiles_provider_id", "provider_id"),
        Index("ix_profiles_name", "name"),
    )
