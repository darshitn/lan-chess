from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ProjectStatus


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    workspace_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=ProjectStatus.active.value)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    # Relationships
    agents: Mapped[list["Agent"]] = relationship("Agent", back_populates="project", cascade="all, delete-orphan", passive_deletes=True)
    workflows: Mapped[list["Workflow"]] = relationship("Workflow", back_populates="project", cascade="all, delete-orphan", passive_deletes=True)
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="project", cascade="all, delete-orphan", passive_deletes=True)
    artifacts: Mapped[list["Artifact"]] = relationship("Artifact", back_populates="project", cascade="all, delete-orphan", passive_deletes=True)

    __table_args__ = (
        Index("ix_projects_name", "name"),
        Index("ix_projects_status", "status"),
        Index("ix_projects_created_at", "created_at"),
    )
