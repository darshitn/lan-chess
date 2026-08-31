from __future__ import annotations

import datetime as dt
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

ProviderKindLiteral = Literal["demo", "ollama", "claude"]
ProviderStatusLiteral = Literal["available", "unavailable", "misconfigured", "disabled"]


class ProviderCreate(BaseModel):
    kind: ProviderKindLiteral
    display_name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    status: ProviderStatusLiteral = "available"
    config: Any | None = None
    capabilities: Any | None = None

    @field_validator("kind")
    @classmethod
    def lower_kind(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("display_name")
    @classmethod
    def strip_display(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("display_name must not be blank")
        return v


class ProviderUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    status: ProviderStatusLiteral | None = None
    config: Any | None = None
    capabilities: Any | None = None

    @field_validator("display_name")
    @classmethod
    def strip_display_opt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("display_name must not be blank")
        return v


class ProviderOut(BaseModel):
    id: str
    kind: str
    display_name: str
    description: str | None
    status: str
    config: Any | None
    capabilities: Any | None
    created_at: dt.datetime
    updated_at: dt.datetime

    model_config = {"from_attributes": True}
