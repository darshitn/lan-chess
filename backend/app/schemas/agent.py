from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field, field_validator

AgentStatusLiteral = Literal["active", "inactive", "error"]


class AgentCreate(BaseModel):
    project_id: str = Field(min_length=1, max_length=36)
    name: str = Field(min_length=1, max_length=200)
    role_id: str | None = Field(default=None, max_length=36)
    description: str | None = Field(default=None, max_length=5000)
    system_prompt: str | None = Field(default=None, max_length=20000)
    provider_id: str | None = Field(default=None, max_length=36)
    model: str | None = Field(default=None, max_length=200)
    profile_id: str | None = Field(default=None, max_length=36)
    status: AgentStatusLiteral = "active"
    enabled: bool = True

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    role_id: str | None = Field(default=None, max_length=36)
    description: str | None = Field(default=None, max_length=5000)
    system_prompt: str | None = Field(default=None, max_length=20000)
    provider_id: str | None = Field(default=None, max_length=36)
    model: str | None = Field(default=None, max_length=200)
    profile_id: str | None = Field(default=None, max_length=36)
    status: AgentStatusLiteral | None = None
    enabled: bool | None = None

    @field_validator("name")
    @classmethod
    def strip_name_opt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v


class AgentOut(BaseModel):
    id: str
    project_id: str
    name: str
    role_id: str | None
    description: str | None
    system_prompt: str | None
    provider_id: str | None
    model: str | None
    profile_id: str | None
    status: str
    enabled: bool
    created_at: dt.datetime
    updated_at: dt.datetime

    model_config = {"from_attributes": True}
