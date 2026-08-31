from __future__ import annotations

from typing import Literal, Any

from pydantic import BaseModel, Field


class ProviderMessageIn(BaseModel):
    role: Literal["system", "user", "assistant", "tool"] = "user"
    content: str = Field(min_length=1)


class GenerateOptionsIn(BaseModel):
    temperature: float | None = Field(default=None, ge=0, le=2)
    num_predict: int | None = Field(default=None, ge=1, le=32768)
    timeout_s: float | None = Field(default=None, ge=1, le=300)
    extra: dict[str, Any] | None = None


class GenerateRequest(BaseModel):
    messages: list[ProviderMessageIn] = Field(min_length=1)
    model: str | None = Field(default=None, max_length=200)
    options: GenerateOptionsIn | None = None


class GenerateResponse(BaseModel):
    content: str
    model: str
    provider: str
    done_reason: str | None = None


class ProviderHealthOut(BaseModel):
    available: bool
    provider: str
    latency_ms: int | None = None
    error: str | None = None
    details: dict | None = None


class ProviderModelOut(BaseModel):
    id: str
    name: str
    provider: str
    size: int | None = None
    modified_at: str | None = None
    details: dict | None = None


class AgentGenerateRequest(BaseModel):
    messages: list[ProviderMessageIn] = Field(min_length=1)
    model: str | None = Field(default=None, max_length=200)
    options: GenerateOptionsIn | None = None
    # if True, use agent's configured model when model not supplied (default)
    use_agent_model: bool = True
