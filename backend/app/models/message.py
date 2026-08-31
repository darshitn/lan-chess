from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import MessageRole


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    agent_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default=MessageRole.user.value)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # workflow_run context optional
    run_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("workflow_runs.id", ondelete="SET NULL"), nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="messages")

    __table_args__ = (
        Index("ix_messages_project_id", "project_id"),
        Index("ix_messages_agent_id", "agent_id"),
        Index("ix_messages_run_id", "run_id"),
        Index("ix_messages_created_at", "created_at"),
        Index("ix_messages_role", "role"),
    )
