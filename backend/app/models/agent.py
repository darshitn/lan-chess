from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import AgentStatus


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    role_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("providers.id", ondelete="SET NULL"), nullable=True)
    model: Mapped[str | None] = mapped_column(String(200), nullable=True)
    profile_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=AgentStatus.active.value)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="agents")
    role: Mapped["Role | None"] = relationship("Role", back_populates="agents")
    provider: Mapped["Provider | None"] = relationship("Provider", foreign_keys=[provider_id])
    profile: Mapped["Profile | None"] = relationship("Profile", foreign_keys=[profile_id])

    __table_args__ = (
        Index("ix_agents_project_id", "project_id"),
        Index("ix_agents_role_id", "role_id"),
        Index("ix_agents_provider_id", "provider_id"),
        Index("ix_agents_profile_id", "profile_id"),
        Index("ix_agents_status", "status"),
        Index("ix_agents_name", "name"),
        # name unique per project
        Index("ix_agents_project_name_unique", "project_id", "name", unique=True),
    )
