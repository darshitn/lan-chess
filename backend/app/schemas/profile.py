from __future__ import annotations

import datetime as dt
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

ProviderLiteral = Literal["demo", "ollama", "claude"]
ProfileStatusLiteral = Literal[
    "NOT_CONFIGURED",
    "AUTH_REQUIRED",
    "AUTHENTICATED",
    "SESSION_EXPIRED",
    "ERROR",
    "DISABLED",
    "UNAVAILABLE",
]


class ProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    provider: ProviderLiteral
    provider_id: str | None = Field(default=None, max_length=36)
    status: ProfileStatusLiteral = "NOT_CONFIGURED"
    metadata: Any | None = Field(default=None, alias="metadata")
    credentials_ref: str | None = Field(default=None, max_length=512)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v

    @field_validator("provider")
    @classmethod
    def lower_provider(cls, v: str) -> str:
        return v.strip().lower()  # type: ignore[return-value]

    model_config = {"populate_by_name": True}


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    provider: ProviderLiteral | None = None
    provider_id: str | None = Field(default=None, max_length=36)
    status: ProfileStatusLiteral | None = None
    metadata: Any | None = None
    credentials_ref: str | None = Field(default=None, max_length=512)

    @field_validator("name")
    @classmethod
    def strip_name_opt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v

    @field_validator("provider")
    @classmethod
    def lower_provider_opt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return v.strip().lower()  # type: ignore[return-value]

    model_config = {"populate_by_name": True}


class ProfileOut(BaseModel):
    id: str
    name: str
    provider: str
    provider_id: str | None
    status: str
    metadata: Any | None = Field(default=None, alias="metadata_json")
    credentials_ref: str | None
    created_at: dt.datetime
    updated_at: dt.datetime

    model_config = {"from_attributes": True, "populate_by_name": True}
