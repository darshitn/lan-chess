from __future__ import annotations

import pytest
import httpx
from unittest.mock import AsyncMock, patch


def test_provider_health_demo(client):
    prov = client.post("/api/providers", json={"kind": "demo", "display_name": "Demo"}).json()
    r = client.get(f"/api/providers/{prov['id']}/health")
    assert r.status_code == 200
    assert r.json()["available"] is True
    assert r.json()["provider"] == "demo"


def test_provider_models_demo(client):
    prov = client.post("/api/providers", json={"kind": "demo", "display_name": "Demo2"}).json()
    r = client.get(f"/api/providers/{prov['id']}/models")
    assert r.status_code == 200
    assert any(m["id"] == "demo-model" for m in r.json())


def test_provider_generate_demo(client):
    prov = client.post("/api/providers", json={"kind": "demo", "display_name": "Demo"}).json()
    r = client.post(f"/api/providers/{prov['id']}/generate", json={"messages": [{"role": "user", "content": "hello"}]})
    assert r.status_code == 200
    assert "[DEMO" in r.json()["content"]
    assert r.json()["provider"] == "demo"


def test_ollama_status_unavailable_mocked(client, monkeypatch):
    # Create ollama provider record with custom URL
    prov = client.post("/api/providers", json={"kind": "ollama", "display_name": "Ollama", "config": {"base_url": "http://127.0.0.1:11434"}}).json()

    async def fake_health(self):
        from app.providers.base import ProviderHealth
        return ProviderHealth(available=False, provider="ollama", error="connection refused", details={"url": self.base_url})

    monkeypatch.setattr("app.providers.ollama.OllamaProvider.health", fake_health)
    r = client.get(f"/api/providers/{prov['id']}/health")
    assert r.status_code == 200
    assert r.json()["available"] is False
    assert "connection" in (r.json()["error"] or "").lower()


def test_ollama_models_error_handling(client, monkeypatch):
    prov = client.post("/api/providers", json={"kind": "ollama", "display_name": "Ollama2", "config": {"base_url": "http://127.0.0.1:11434"}}).json()

    async def fake_list(self):
        from app.providers.base import ProviderUnavailableError
        raise ProviderUnavailableError("Ollama not reachable", provider="ollama")

    monkeypatch.setattr("app.providers.ollama.OllamaProvider.list_models", fake_list)
    r = client.get(f"/api/providers/{prov['id']}/models")
    assert r.status_code == 503  # do not crash, return proper code


def test_ollama_generate_timeout_handling(client, monkeypatch):
    prov = client.post("/api/providers", json={"kind": "ollama", "display_name": "Ollama3", "config": {"base_url": "http://127.0.0.1:11434"}}).json()

    async def fake_gen(self, messages, model=None, options=None):
        from app.providers.base import ProviderTimeoutError
        raise ProviderTimeoutError("timeout", provider="ollama")

    monkeypatch.setattr("app.providers.ollama.OllamaProvider.generate", fake_gen)
    r = client.post(f"/api/providers/{prov['id']}/generate", json={"messages": [{"role": "user", "content": "hi"}], "options": {"timeout_s": 1}})
    assert r.status_code == 408


def test_ollama_generate_model_not_found(client, monkeypatch):
    prov = client.post("/api/providers", json={"kind": "ollama", "display_name": "Ollama4", "config": {"base_url": "http://127.0.0.1:11434"}}).json()

    async def fake_gen(self, messages, model=None, options=None):
        from app.providers.base import ModelNotFoundError
        raise ModelNotFoundError(model or "missing", provider="ollama")

    monkeypatch.setattr("app.providers.ollama.OllamaProvider.generate", fake_gen)
    r = client.post(f"/api/providers/{prov['id']}/generate", json={"messages": [{"role": "user", "content": "hi"}], "model": "missing"})
    assert r.status_code == 404


def test_agent_generate_uses_demo_deterministically(client):
    proj = client.post("/api/projects", json={"name": "ProjX"}).json()
    prov = client.post("/api/providers", json={"kind": "demo", "display_name": "Demo"}).json()
    agent = client.post("/api/agents", json={"project_id": proj["id"], "name": "A1", "provider_id": prov["id"], "model": "demo-model"}).json()
    r = client.post(f"/api/agents/{agent['id']}/generate", json={"messages": [{"role": "user", "content": "ping"}]})
    assert r.status_code == 200
    assert "[DEMO" in r.json()["content"]


def test_provider_stream_demo(client):
    prov = client.post("/api/providers", json={"kind": "demo", "display_name": "Demo"}).json()
    # Use stream endpoint; it returns SSE; TestClient will collect
    r = client.post(f"/api/providers/{prov['id']}/stream", json={"messages": [{"role": "user", "content": "hello"}]})
    assert r.status_code == 200
    assert "text/event-stream" in r.headers.get("content-type", "")


def test_ollama_url_configurable_via_provider_config(client, monkeypatch):
    # Ensure provider config base_url is honored (not hardcoded)
    captured = {}

    async def fake_health2(self):
        captured["url"] = self.base_url
        from app.providers.base import ProviderHealth
        return ProviderHealth(available=True, provider="ollama")

    monkeypatch.setattr("app.providers.ollama.OllamaProvider.health", fake_health2)
    prov = client.post("/api/providers", json={"kind": "ollama", "display_name": "OllamaCustom", "config": {"base_url": "http://custom:11434"}}).json()
    r = client.get(f"/api/providers/{prov['id']}/health")
    assert r.status_code == 200
    assert captured["url"] == "http://custom:11434"
