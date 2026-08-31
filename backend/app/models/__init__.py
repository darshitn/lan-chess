from __future__ import annotations

# Import models to register with Base.metadata
from app.models.enums import (  # noqa: F401
    AgentStatus,
    ArtifactType,
    EventType,
    MessageRole,
    NotificationType,
    ProfileStatus,
    ProjectStatus,
    ProviderKind,
    ProviderStatus,
    WorkflowRunStatus,
    WorkflowStatus,
    WorkflowNodeRunStatus,
)

from app.models.project import Project  # noqa: F401
from app.models.provider import Provider  # noqa: F401
from app.models.profile import Profile  # noqa: F401
from app.models.role import Role  # noqa: F401
from app.models.agent import Agent  # noqa: F401
from app.models.workflow import Workflow, WorkflowNode, WorkflowEdge  # noqa: F401
from app.models.workflow_run import WorkflowRun, WorkflowNodeRun  # noqa: F401
from app.models.message import Message  # noqa: F401
from app.models.artifact import Artifact, ArtifactVersion  # noqa: F401
from app.models.memory import AgentMemory  # noqa: F401
from app.models.event import Event  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.setting import Setting  # noqa: F401

__all__ = [
    "Project",
    "Provider",
    "Profile",
    "Role",
    "Agent",
    "Workflow",
    "WorkflowNode",
    "WorkflowEdge",
    "WorkflowRun",
    "WorkflowNodeRun",
    "Message",
    "Artifact",
    "ArtifactVersion",
    "AgentMemory",
    "Event",
    "Notification",
    "Setting",
]
