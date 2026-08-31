from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field

ArtifactTypeLiteral = Literal["file", "document", "image", "code", "other"]


class ArtifactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    type: ArtifactTypeLiteral = "file"
    description: str | None = Field(default=None, max_length=5000)
    content_text: str | None = Field(default=None)
    content_path: str | None = Field(default=None, max_length=1024)
    mime_type: str | None = Field(default=None, max_length=200)
    created_by_agent_id: str | None = Field(default=None, max_length=36)


class ArtifactUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    content_text: str | None = Field(default=None)
    content_path: str | None = Field(default=None, max_length=1024)
    mime_type: str | None = Field(default=None, max_length=200)
    created_by_agent_id: str | None = Field(default=None, max_length=36)


class ArtifactVersionOut(BaseModel):
    id: str
    artifact_id: str
    version: int
    content_path: str | None
    content_text: str | None
    mime_type: str | None
    size_bytes: int | None
    created_by_agent_id: str | None
    created_at: dt.datetime

    model_config = {"from_attributes": True}


class ArtifactOut(BaseModel):
    id: str
    project_id: str
    name: str
    type: str
    description: str | None
    current_version_id: str | None
    created_at: dt.datetime
    updated_at: dt.datetime
    current_version: ArtifactVersionOut | None = None

    model_config = {"from_attributes": True}


class ArtifactWithVersionsOut(ArtifactOut):
    versions: list[ArtifactVersionOut] = []
