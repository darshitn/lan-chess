from __future__ import annotations

from typing import Literal

from app.core.config import get_settings
from app.providers.base import Provider, ProviderKind
from app.providers.demo import DemoProvider
from app.providers.ollama import OllamaProvider

# Provider factory - provider-agnostic Agent uses this


def get_provider(kind: ProviderKind, *, base_url: str | None = None, timeout_s: float | None = None) -> Provider:
    settings = get_settings()
    if kind == "demo":
        return DemoProvider()
    if kind == "ollama":
        return OllamaProvider(
            base_url=base_url or settings.ollama_host,
            timeout_s=timeout_s or settings.ollama_timeout_s,
        )
    if kind == "claude":
        # Phase 2: claude uses same stub but via registry; real key still backend-only
        from app.providers.claude_api import ClaudeApiProvider

        return ClaudeApiProvider()  # type: ignore[return-value]
    raise ValueError(f"Unknown provider kind: {kind}")


def resolve_provider_for_agent(agent_provider_kind: str | None, provider_config_url: str | None = None) -> Provider:
    # Normalize legacy kinds
    kind = (agent_provider_kind or "demo").lower()
    if kind in ("claude_api", "claude_web"):
        kind = "claude"
    if kind not in ("demo", "ollama", "claude"):
        kind = "demo"
    return get_provider(kind, base_url=provider_config_url)  # type: ignore[arg-type]
