from __future__ import annotations


def _create_project(client, name="Proj"):
    r = client.post("/api/projects", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_agent_crud_and_configurable(client):
    pid = _create_project(client, "Proj A")
    # create without hardcoding - agents are configurable
    role = client.post("/api/roles", json={"name": "Writer", "system_prompt": "write well"}).json()
    provider = client.post("/api/providers", json={"kind": "demo", "display_name": "Demo"}).json()
    profile = client.post("/api/profiles", json={"name": "Demo Prof", "provider": "demo", "provider_id": provider["id"]}).json()

    r = client.post("/api/agents", json={
        "project_id": pid,
        "name": "Agent One",
        "role_id": role["id"],
        "description": "first agent",
        "system_prompt": "custom prompt",
        "provider_id": provider["id"],
        "model": "demo-model",
        "profile_id": profile["id"],
        "status": "active",
        "enabled": True,
    })
    assert r.status_code == 201, r.text
    aid = r.json()["id"]
    assert r.json()["name"] == "Agent One"
    assert r.json()["model"] == "demo-model"

    # get
    assert client.get(f"/api/agents/{aid}").status_code == 200

    # list filtered by project
    r = client.get("/api/agents", params={"project_id": pid})
    assert any(a["id"] == aid for a in r.json())

    # update - change model, disable
    r = client.patch(f"/api/agents/{aid}", json={"model": "demo-model-2", "enabled": False})
    assert r.status_code == 200
    assert r.json()["model"] == "demo-model-2"
    assert r.json()["enabled"] is False

    # unique per project
    r = client.post("/api/agents", json={"project_id": pid, "name": "Agent One"})
    assert r.status_code == 409

    # same name in different project is allowed
    pid2 = _create_project(client, "Proj B")
    r = client.post("/api/agents", json={"project_id": pid2, "name": "Agent One"})
    assert r.status_code == 201

    # delete
    assert client.delete(f"/api/agents/{aid}").status_code == 204
    assert client.get(f"/api/agents/{aid}").status_code == 404


def test_agent_validation_and_fk(client):
    pid = _create_project(client, "Proj FK")
    assert client.post("/api/agents", json={"project_id": pid, "name": ""}).status_code == 422
    assert client.post("/api/agents", json={"project_id": "nope", "name": "x"}).status_code == 400
    assert client.post("/api/agents", json={"project_id": pid, "name": "ok", "role_id": "nope"}).status_code == 400
    assert client.post("/api/agents", json={"project_id": pid, "name": "ok2", "provider_id": "nope"}).status_code == 400
    assert client.post("/api/agents", json={"project_id": pid, "name": "ok3", "profile_id": "nope"}).status_code == 400
    assert client.post("/api/agents", json={"project_id": pid, "name": "ok4", "status": "bogus"}).status_code == 422


def test_agent_cascade_on_project_delete(client):
    pid = _create_project(client, "Cascade Proj")
    r = client.post("/api/agents", json={"project_id": pid, "name": "ToDelete"})
    assert r.status_code == 201
    aid = r.json()["id"]
    # deleting project should cascade delete agent
    assert client.delete(f"/api/projects/{pid}").status_code == 204
    assert client.get(f"/api/agents/{aid}").status_code == 404


def test_agent_not_found(client):
    assert client.get("/api/agents/nope").status_code == 404
    assert client.patch("/api/agents/nope", json={"name": "x"}).status_code == 404
    assert client.delete("/api/agents/nope").status_code == 404
