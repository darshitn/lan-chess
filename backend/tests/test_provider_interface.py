from __future__ import annotations

import pytest
import inspect

from app.providers.base import Provider, ProviderHealth, ProviderModel
from app.providers.demo import DemoProvider
from app.providers.ollama import OllamaProvider


def test_provider_interface_has_required_ops():
    # Interface must support health/models/generate/stream/cancel without forcing unsupported
    assert hasattr(Provider, "health")
    assert hasattr(Provider, "list_models")
    assert hasattr(Provider, "generate")
    assert hasattr(Provider, "stream")
    assert hasattr(Provider, "cancel")
    # is_configured and capabilities remain
    assert hasattr(Provider, "is_configured")
    assert hasattr(Provider, "capabilities")
    # Check signatures exist and are async where expected
    assert inspect.iscoroutinefunction(Provider.health)
    assert inspect.iscoroutinefunction(Provider.generate)
    # stream is async generator, not coroutine
    assert inspect.isasyncgenfunction(Provider.stream) or inspect.iscoroutinefunction(Provider.stream)
    assert inspect.iscoroutinefunction(Provider.cancel)


@pytest.mark.asyncio
async def test_demo_implements_all_ops():
    p = DemoProvider()
    assert p.is_configured() is True
    h = await p.health()
    assert isinstance(h, ProviderHealth)
    assert h.available is True
    assert h.provider == "demo"
    models = await p.list_models()
    assert len(models) >= 1
    assert all(isinstance(m, ProviderModel) for m in models)
    # generate deterministic
    from app.providers.base import ProviderMessage

    resp = await p.generate([ProviderMessage(role="user", content="hello")], model="demo-model")
    assert "[DEMO" in resp.content  # labeled
    assert resp.provider == "demo"
    # stream produces chunks that join to same content
    chunks = []
    async for ch in p.stream([ProviderMessage(role="user", content="hello")], model="demo-model"):
        chunks.append(ch)
    assert "".join(chunks).strip() == resp.content.strip()
    # cancel no-op not raising
    await p.cancel()


@pytest.mark.asyncio
async def test_ollama_interface_not_forcing_unsupported():
    # Ollama should support all ops but configurable URL default
    p = OllamaProvider(base_url="http://127.0.0.1:11434")
    assert p.is_configured() is True
    # Should not raise on instantiation; health is attempted but may return unavailable - not crash
    # Mocked health tested separately; here just check methods exist
    assert hasattr(p, "health")
    assert hasattr(p, "list_models")
    assert p.supports_streaming() is True
    assert p.supports_cancellation() is True
