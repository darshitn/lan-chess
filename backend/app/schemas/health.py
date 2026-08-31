from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ProviderHealthStatus(BaseModel):
    status: Literal["available", "unavailable", "not_configured", "error", "unknown"] = "unknown"
    available: bool = False
    latency_ms: int | None = None
    error: str | None = None


class DiagnosticsResponse(BaseModel):
    status: str = Field(description="Overall status, ok when backend healthy (providers may be offline)")
    version: str
    environment: str
    database: Literal["ok", "error"] = "ok"
    database_error: str | None = None
    providers: dict[str, str] = Field(description="Simplified provider statuses, e.g., demo:available, ollama:unavailable")
    ollama: ProviderHealthStatus | None = None
    claude: ProviderHealthStatus | None = None
    demo: ProviderHealthStatus | None = None


class HealthResponse(BaseModel):
    status: str = Field(description="Service status, ok when healthy")
    version: str = Field(description="Application version")
    environment: str = Field(description="Runtime environment")
    database: str | None = Field(default=None, description="Database status")
    providers: dict[str, str] | None = Field(default=None, description="Provider availability")
    details: DiagnosticsResponse | None = None
