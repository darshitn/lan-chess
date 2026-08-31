from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field, field_validator

ProjectStatusLiteral = Literal["active", "archived", "deleted"]


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    workspace_path: str | None = Field(default=None, max_length=1024)
    status: ProjectStatusLiteral = "active"

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    workspace_path: str | None = Field(default=None, max_length=1024)
    status: ProjectStatusLiteral | None = None

    @field_validator("name")
    @classmethod
    def strip_name_opt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v


class ProjectOut(BaseModel):
    id: str
    name: str
    description: str | None
    workspace_path: str | None
    status: str
    created_at: dt.datetime
    updated_at: dt.datetime

    model_config = {"from_attributes": True}
