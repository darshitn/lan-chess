from __future__ import annotations

import datetime as dt
from typing import Any

from pydantic import BaseModel, Field, field_validator


class RoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=5000)
    system_prompt: str | None = Field(default=None, max_length=20000)
    default_provider: str | None = Field(default=None, max_length=32)
    default_model: str | None = Field(default=None, max_length=200)
    permissions: Any | None = None
    tools: Any | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v

    @field_validator("default_provider")
    @classmethod
    def validate_provider(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().lower()
        if v not in ("demo", "ollama", "claude"):
            raise ValueError("default_provider must be demo|ollama|claude")
        return v


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=5000)
    system_prompt: str | None = Field(default=None, max_length=20000)
    default_provider: str | None = Field(default=None, max_length=32)
    default_model: str | None = Field(default=None, max_length=200)
    permissions: Any | None = None
    tools: Any | None = None

    @field_validator("name")
    @classmethod
    def strip_name_opt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v

    @field_validator("default_provider")
    @classmethod
    def validate_provider(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().lower()
        if v not in ("demo", "ollama", "claude"):
            raise ValueError("default_provider must be demo|ollama|claude")
        return v


class RoleOut(BaseModel):
    id: str
    name: str
    description: str | None
    system_prompt: str | None
    default_provider: str | None
    default_model: str | None
    permissions: Any | None
    tools: Any | None
    created_at: dt.datetime
    updated_at: dt.datetime

    model_config = {"from_attributes": True}
