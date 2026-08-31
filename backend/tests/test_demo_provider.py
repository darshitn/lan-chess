from __future__ import annotations

import pytest
from app.providers.base import ProviderMessage
from app.providers.demo import DemoProvider


@pytest.mark.asyncio
async def test_demo_deterministic():
    p = DemoProvider()
    msgs = [ProviderMessage(role="user", content="test input")]
    r1 = await p.generate(msgs, model="demo-model")
    r2 = await p.generate(msgs, model="demo-model")
    assert r1.content == r2.content
    assert r1.model == "demo-model"
    assert r1.provider == "demo"


@pytest.mark.asyncio
async def test_demo_labels_not_real_ai():
    p = DemoProvider()
    msgs = [ProviderMessage(role="user", content="hello")]
    r = await p.generate(msgs)
    assert r.content.startswith("[DEMO")
    assert "DEMO" in r.content
    # Must not be presented as real AI without label
    assert "[DEMO" in r.content or "DEMO" in r.content


@pytest.mark.asyncio
async def test_demo_models():
    p = DemoProvider()
    models = await p.list_models()
    ids = {m.id for m in models}
    assert "demo-model" in ids
    # list_models deterministic
    models2 = await p.list_models()
    assert ids == {m.id for m in models2}


@pytest.mark.asyncio
async def test_demo_stream():
    p = DemoProvider()
    msgs = [ProviderMessage(role="user", content="stream me")]
    # stream yields words
    chunks = [c async for c in p.stream(msgs, model="demo-small")]
    assert len(chunks) > 1
    joined = "".join(chunks).strip()
    full = (await p.generate(msgs, model="demo-small")).content.strip()
    assert joined == full


@pytest.mark.asyncio
async def test_demo_health():
    p = DemoProvider()
    h = await p.health()
    assert h.available is True
    assert h.provider == "demo"
