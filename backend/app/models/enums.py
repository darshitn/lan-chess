from __future__ import annotations

import enum


class ProjectStatus(str, enum.Enum):
    active = "active"
    archived = "archived"
    deleted = "deleted"


class AgentStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    error = "error"


class ProviderKind(str, enum.Enum):
    demo = "demo"
    ollama = "ollama"
    claude = "claude"


class ProviderStatus(str, enum.Enum):
    # Provider record status — NOT a fake "connected" flag
    available = "available"
    unavailable = "unavailable"
    misconfigured = "misconfigured"
    disabled = "disabled"


class ProfileStatus(str, enum.Enum):
    NOT_CONFIGURED = "NOT_CONFIGURED"
    AUTH_REQUIRED = "AUTH_REQUIRED"
    AUTHENTICATED = "AUTHENTICATED"
    SESSION_EXPIRED = "SESSION_EXPIRED"
    ERROR = "ERROR"
    DISABLED = "DISABLED"
    UNAVAILABLE = "UNAVAILABLE"


class WorkflowStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    archived = "archived"


class WorkflowRunStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    paused = "paused"
    awaiting_approval = "awaiting_approval"
    succeeded = "succeeded"
    failed = "failed"
    cancelled = "cancelled"


class WorkflowNodeRunStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    skipped = "skipped"
    awaiting_approval = "awaiting_approval"
    cancelled = "cancelled"


class MessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"
    tool = "tool"


class ArtifactType(str, enum.Enum):
    file = "file"
    document = "document"
    image = "image"
    code = "code"
    other = "other"


class EventType(str, enum.Enum):
    project_created = "project.created"
    project_updated = "project.updated"
    project_deleted = "project.deleted"
    agent_created = "agent.created"
    agent_updated = "agent.updated"
    workflow_created = "workflow.created"
    workflow_run_started = "workflow_run.started"
    workflow_run_completed = "workflow_run.completed"
    artifact_created = "artifact.created"
    notification_created = "notification.created"
    system = "system"


class NotificationType(str, enum.Enum):
    info = "info"
    warning = "warning"
    error = "error"
    approval_required = "approval_required"
