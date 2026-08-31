from __future__ import annotations

import asyncio
from typing import AsyncIterator

from app.providers.base import (
    GenerateOptions,
    Provider,
    ProviderHealth,
    ProviderMessage,
    ProviderModel,
    ProviderResponse,
)

DEMO_MODELS = [
    ProviderModel(id="demo-model", name="Demo Model", provider="demo", details={"description": "Deterministic echo model for tests"}),
    ProviderModel(id="demo-small", name="Demo Small", provider="demo"),
]


class DemoProvider(Provider):
    kind = "demo"  # type: ignore[assignment]

    def is_configured(self) -> bool:
        return True

    async def health(self) -> ProviderHealth:
        return ProviderHealth(available=True, provider="demo", details={"note": "Demo provider is always available. Responses are DEMO-labeled, not real AI."})

    async def list_models(self) -> list[ProviderModel]:
        return list(DEMO_MODELS)

    def supports_streaming(self) -> bool:
        return True

    def supports_cancellation(self) -> bool:
        return True

    async def generate(
        self,
        messages: list[ProviderMessage],
        model: str | None = None,
        options: GenerateOptions | None = None,
    ) -> ProviderResponse:
        # Deterministic: hash of input for test stability
        last = messages[-1].content if messages else ""
        # honor timeout simulation: if options.timeout_s is tiny, we still succeed quickly
        # optional extra flag to simulate delay
        delay = 0
        if options and options.extra.get("demo_delay_s"):
            delay = float(options.extra["demo_delay_s"])
            await asyncio.sleep(delay)
        chosen = model or "demo-model"
        # Verify model exists (optional strictness)
        # Allow any demo-* but warn
        content = f"[DEMO | {chosen}] echo: {last}"
        # Mark clearly as DEMO, never as real AI
        return ProviderResponse(content=content, model=chosen, provider="demo", done_reason="stop", raw={"demo": True})

    async def stream(
        self,
        messages: list[ProviderMessage],
        model: str | None = None,
        options: GenerateOptions | None = None,
    ) -> AsyncIterator[str]:
        resp = await self.generate(messages, model=model, options=options)
        # Chunk deterministically by words to simulate streaming
        words = resp.content.split(" ")
        for w in words:
            yield w + " "
            await asyncio.sleep(0.005)
        # Trim trailing space via caller handling

    async def cancel(self, task_id: str | None = None) -> None:
        # No-op but satisfies interface
        return None

    # Backwards compat: complete() used in Phase 1 tests
    async def complete(self, messages: list[ProviderMessage], model: str | None = None) -> ProviderResponse:  # type: ignore[override]
        return await self.generate(messages, model=model)
