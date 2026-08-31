from __future__ import annotations

import pytest
from app.providers.base import ProviderMessage
from app.providers.demo import DemoProvider


def test_provider_crud_and_claude_not_connected_by_default(client):
    # create demo
    r = client.post("/api/providers", json={"kind": "demo", "display_name": "Demo Provider", "status": "available"})
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    assert r.json()["kind"] == "demo"
    assert r.json()["status"] == "available"
    # do not claim connected - status is explicit
    assert r.json()["status"] != "connected"

    # get
    assert client.get(f"/api/providers/{pid}").status_code == 200
    # list
    r = client.get("/api/providers")
    assert any(p["id"] == pid for p in r.json())

    # update
    r = client.patch(f"/api/providers/{pid}", json={"status": "disabled"})
    assert r.status_code == 200
    assert r.json()["status"] == "disabled"

    # duplicate kind
    r = client.post("/api/providers", json={"kind": "demo", "display_name": "Again"})
    assert r.status_code == 409

    # delete
    assert client.delete(f"/api/providers/{pid}").status_code == 204


def test_provider_claude_and_ollama(client):
    for kind in ["claude", "ollama"]:
        r = client.post("/api/providers", json={"kind": kind, "display_name": kind.title(), "status": "unavailable"})
        assert r.status_code == 201, r.text
        assert r.json()["status"] == "unavailable"


def test_provider_validation(client):
    assert client.post("/api/providers", json={"kind": "unknown", "display_name": "x"}).status_code == 422
    assert client.post("/api/providers", json={"kind": "demo", "display_name": ""}).status_code == 422
    assert client.post("/api/providers", json={"kind": "demo", "display_name": "ok", "status": "connected"}).status_code == 422


def test_provider_not_found(client):
    assert client.get("/api/providers/nope").status_code == 404
    assert client.patch("/api/providers/nope", json={"display_name": "x"}).status_code == 404
    assert client.delete("/api/providers/nope").status_code == 404


@pytest.mark.asyncio
async def test_demo_provider_echo():
    p = DemoProvider()
    assert p.is_configured() is True
    out = await p.complete([ProviderMessage(role="user", content="hello")], model="demo-model")
    assert "hello" in out.content
    assert out.provider == "demo"
    assert out.model == "demo-model"
