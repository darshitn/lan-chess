from __future__ import annotations

import os

from app.providers.base import GenerateOptions, Provider, ProviderHealth, ProviderMessage, ProviderResponse

class ClaudeApiProvider(Provider):
    """Stub for Claude API provider. Real implementation will use ANTHROPIC_API_KEY backend-only."""

    kind = "claude"  # type: ignore[assignment]

    def is_configured(self) -> bool:
        return bool(os.getenv("ANTHROPIC_API_KEY"))

    async def health(self) -> ProviderHealth:
        if not self.is_configured():
            return ProviderHealth(available=False, provider="claude", error="ANTHROPIC_API_KEY not set")
        # Do not claim connected; report configured but not verified
        return ProviderHealth(available=False, provider="claude", error="Claude health check not implemented (requires API key)", details={"configured": True})

    async def list_models(self) -> list:
        # No models without real API; return empty or raise
        return []

    async def generate(
        self,
        messages: list[ProviderMessage],
        model: str | None = None,
        options: GenerateOptions | None = None,
    ) -> ProviderResponse:
        raise NotImplementedError("Claude API provider not configured for Phase 2 - use Demo or Ollama")

    # Backwards compat for older complete() callers
    async def complete(self, messages: list[ProviderMessage], model: str | None = None) -> ProviderResponse:  # type: ignore[override]
        return await self.generate(messages, model=model)
