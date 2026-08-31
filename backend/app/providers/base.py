from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator, Literal

ProviderKind = Literal["demo", "claude", "ollama"]
# Legacy alias for backwards compat with earlier models
ProviderKindLegacy = Literal["demo", "claude_api", "claude_web", "ollama"]


@dataclass(frozen=True)
class ProviderMessage:
    role: Literal["system", "user", "assistant", "tool"]
    content: str


@dataclass(frozen=True)
class ProviderModel:
    id: str  # model name e.g. "llama3.1:8b"
    name: str
    provider: ProviderKind
    size: int | None = None
    modified_at: str | None = None
    details: dict | None = None


@dataclass(frozen=True)
class ProviderHealth:
    available: bool
    provider: ProviderKind
    latency_ms: int | None = None
    error: str | None = None
    details: dict | None = None


@dataclass(frozen=True)
class GenerateOptions:
    temperature: float | None = None
    num_predict: int | None = None
    timeout_s: float | None = None
    extra: dict = field(default_factory=dict)


@dataclass(frozen=True)
class ProviderResponse:
    content: str
    model: str
    provider: ProviderKind
    # Optional token/usage info
    done_reason: str | None = None
    raw: dict | None = None


class ProviderError(Exception):
    def __init__(self, message: str, *, code: str = "provider_error", provider: ProviderKind | None = None, cause: Exception | None = None):
        super().__init__(message)
        self.code = code
        self.provider = provider
        self.cause = cause


class ProviderUnavailableError(ProviderError):
    def __init__(self, message: str, *, provider: ProviderKind | None = None, cause: Exception | None = None):
        super().__init__(message, code="provider_unavailable", provider=provider, cause=cause)


class ModelNotFoundError(ProviderError):
    def __init__(self, model: str, *, provider: ProviderKind | None = None):
        super().__init__(f"Model not found: {model}", code="model_not_found", provider=provider)
        self.model = model


class GenerationError(ProviderError):
    pass


class ProviderTimeoutError(ProviderError):
    def __init__(self, message: str = "Generation timed out", *, provider: ProviderKind | None = None, cause: Exception | None = None):
        super().__init__(message, code="timeout", provider=provider, cause=cause)


class Provider(ABC):
    """Common provider interface. Supports health/models/generate/stream/cancel without forcing unsupported ops."""

    kind: ProviderKind

    # --- capability probe ---
    @abstractmethod
    def is_configured(self) -> bool:
        """Whether provider has minimal config to attempt operations (e.g., URL for Ollama, always True for demo)."""
        ...

    def capabilities(self) -> dict[str, object]:
        return {"kind": self.kind, "configured": self.is_configured()}

    # --- health ---
    @abstractmethod
    async def health(self) -> ProviderHealth:
        """Check provider availability without claiming connected falsely."""
        ...

    # --- models ---
    async def list_models(self) -> list[ProviderModel]:
        """List available models. Default: unsupported."""
        raise ProviderError(f"list_models not supported for {self.kind}", code="unsupported", provider=self.kind)

    async def get_model(self, model_id: str) -> ProviderModel:
        models = await self.list_models()
        for m in models:
            if m.id == model_id:
                return m
        raise ModelNotFoundError(model_id, provider=self.kind)

    # --- generation ---
    @abstractmethod
    async def generate(
        self,
        messages: list[ProviderMessage],
        model: str | None = None,
        options: GenerateOptions | None = None,
    ) -> ProviderResponse:
        ...

    async def stream(
        self,
        messages: list[ProviderMessage],
        model: str | None = None,
        options: GenerateOptions | None = None,
    ) -> AsyncIterator[str]:
        """Streaming chunks. Default fallback: single chunk from generate()."""
        resp = await self.generate(messages, model=model, options=options)
        yield resp.content

    # --- cancellation ---
    async def cancel(self, task_id: str | None = None) -> None:
        """Cancel ongoing generation if supported; no-op otherwise."""
        return None

    # Optional: internal cancel token management for providers that support it
    def supports_streaming(self) -> bool:
        return False

    def supports_cancellation(self) -> bool:
        return False
