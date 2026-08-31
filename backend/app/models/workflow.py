from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import WorkflowStatus


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=WorkflowStatus.draft.value)
    definition: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    variables: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="workflows")
    nodes: Mapped[list["WorkflowNode"]] = relationship("WorkflowNode", back_populates="workflow", cascade="all, delete-orphan", passive_deletes=True)
    edges: Mapped[list["WorkflowEdge"]] = relationship("WorkflowEdge", back_populates="workflow", cascade="all, delete-orphan", passive_deletes=True)
    runs: Mapped[list["WorkflowRun"]] = relationship("WorkflowRun", back_populates="workflow", cascade="all, delete-orphan", passive_deletes=True)

    __table_args__ = (
        Index("ix_workflows_project_id", "project_id"),
        Index("ix_workflows_status", "status"),
        Index("ix_workflows_name", "name"),
    )


class WorkflowNode(Base):
    __tablename__ = "workflow_nodes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id: Mapped[str] = mapped_column(String(36), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    position: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="nodes")

    __table_args__ = (
        UniqueConstraint("workflow_id", "key", name="uq_workflow_nodes_workflow_key"),
        Index("ix_workflow_nodes_workflow_id", "workflow_id"),
        Index("ix_workflow_nodes_type", "type"),
    )


class WorkflowEdge(Base):
    __tablename__ = "workflow_edges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id: Mapped[str] = mapped_column(String(36), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    from_node_id: Mapped[str] = mapped_column(String(36), ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False)
    to_node_id: Mapped[str] = mapped_column(String(36), ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False)
    condition: Mapped[dict | str | None] = mapped_column(JSON, nullable=True)
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)

    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="edges")

    __table_args__ = (
        Index("ix_workflow_edges_workflow_id", "workflow_id"),
        Index("ix_workflow_edges_from", "from_node_id"),
        Index("ix_workflow_edges_to", "to_node_id"),
    )
