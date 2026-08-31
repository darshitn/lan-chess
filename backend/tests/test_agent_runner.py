from __future__ import annotations

import pytest
from app.providers.base import ProviderMessage, ProviderResponse, GenerateOptions
from app.agents.runner import AgentRunner, AgentRunRequest


class FakeProvider:
    kind = "demo"

    def __init__(self):
        self.calls = []

    async def health(self):
        from app.providers.base import ProviderHealth
        return ProviderHealth(available=True, provider="demo")

    async def list_models(self):
        return []

    async def generate(self, messages, model=None, options=None):
        self.calls.append((messages, model, options))
        return ProviderResponse(content="[DEMO] fake", model=model or "demo-model", provider="demo")

    async def stream(self, messages, model=None, options=None):
        yield "[DEMO] chunk "

    async def cancel(self, task_id=None):
        return None

    def supports_streaming(self):
        return True

    def supports_cancellation(self):
        return True

    def is_configured(self):
        return True


def _make_project_and_agent(client, provider_kind="demo", model="demo-model", system_prompt="you are helpful"):
    proj = client.post("/api/projects", json={"name": "P1"}).json()
    prov = client.post("/api/providers", json={"kind": provider_kind, "display_name": provider_kind}).json()
    agent = client.post("/api/agents", json={
        "project_id": proj["id"],
        "name": "A1",
        "provider_id": prov["id"],
        "model": model,
        "system_prompt": system_prompt,
    }).json()
    return proj, prov, agent


@pytest.mark.asyncio
async def test_agent_runner_no_ollama_import(client):
    # Ensure runner module does not import ollama
    import app.agents.runner as m
    import pathlib
    src = pathlib.Path(m.__file__).read_text()
    assert "ollama" not in src.lower() or "resolve_provider" in src.lower()  # only via registry, no direct Ollama code
    # Strong check: file should not contain httpx or OllamaProvider
    assert "OllamaProvider" not in src
    assert "httpx" not in src


def _get_db():
    from app.db.base import get_sessionmaker

    return get_sessionmaker()()


@pytest.mark.asyncio
async def test_agent_runner_uses_agent_model_and_system_prompt(client):
    _, _, agent = _make_project_and_agent(client, provider_kind="demo", model="demo-small", system_prompt="sys prompt")
    fake = FakeProvider()
    runner = AgentRunner(provider_factory=lambda a: fake)
    req = AgentRunRequest(agent_id=agent["id"], messages=[ProviderMessage(role="user", content="hi")])
    db = _get_db()
    try:
        result = await runner.run(db, req)
    finally:
        db.close()
    # Should have injected system prompt
    assert fake.calls[0][0][0].role == "system"
    assert fake.calls[0][0][0].content == "sys prompt"
    assert fake.calls[0][1] == "demo-small"
    assert result.provider == "demo"


@pytest.mark.asyncio
async def test_agent_runner_model_selection_override(client):
    _, _, agent = _make_project_and_agent(client, provider_kind="demo", model="demo-small")
    fake = FakeProvider()
    runner = AgentRunner(provider_factory=lambda a: fake)
    # Override model via request
    req = AgentRunRequest(agent_id=agent["id"], messages=[ProviderMessage(role="user", content="hi")], model="demo-model")
    db = _get_db()
    try:
        await runner.run(db, req)
    finally:
        db.close()
    assert fake.calls[0][1] == "demo-model"


@pytest.mark.asyncio
async def test_agent_runner_stream(client):
    _, _, agent = _make_project_and_agent(client, provider_kind="demo")
    fake = FakeProvider()
    runner = AgentRunner(provider_factory=lambda a: fake)
    req = AgentRunRequest(agent_id=agent["id"], messages=[ProviderMessage(role="user", content="hi")])
    db = _get_db()
    try:
        chunks = [c async for c in runner.stream(db, req)]
    finally:
        db.close()
    assert "".join(chunks).strip().startswith("[DEMO]")


@pytest.mark.asyncio
async def test_agent_runner_via_api(client):
    _, _, agent = _make_project_and_agent(client, provider_kind="demo", model="demo-model")
    # Hit actual API endpoint which uses real DemoProvider (deterministic)
    r = client.post(f"/api/agents/{agent['id']}/generate", json={"messages": [{"role": "user", "content": "hello"}]})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "[DEMO" in data["content"]
    assert data["provider"] == "demo"
    assert data["model"] == "demo-model"

    # Model assignment via PATCH
    r = client.patch(f"/api/agents/{agent['id']}", json={"model": "demo-small"})
    assert r.status_code == 200
    assert r.json()["model"] == "demo-small"
    # Generate again should use new model
    r = client.post(f"/api/agents/{agent['id']}/generate", json={"messages": [{"role": "user", "content": "hello"}]})
    assert r.json()["model"] == "demo-small"
