from __future__ import annotations

import datetime as dt
from typing import Any

from pydantic import BaseModel, Field, field_validator


class SettingCreate(BaseModel):
    key: str = Field(min_length=1, max_length=200)
    value: Any | None = None
    description: str | None = Field(default=None, max_length=5000)

    @field_validator("key")
    @classmethod
    def strip_key(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("key must not be blank")
        # restrict to safe chars
        import re

        if not re.match(r"^[a-zA-Z0-9._-]+$", v):
            raise ValueError("key must match ^[a-zA-Z0-9._-]+$")
        return v


class SettingUpdate(BaseModel):
    value: Any | None = None
    description: str | None = Field(default=None, max_length=5000)


class SettingOut(BaseModel):
    key: str
    value: Any | None
    description: str | None
    created_at: dt.datetime
    updated_at: dt.datetime

    model_config = {"from_attributes": True}
