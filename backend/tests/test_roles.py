from __future__ import annotations


def test_role_crud(client):
    r = client.post("/api/roles", json={"name": "Reviewer", "description": "reviews code", "system_prompt": "you are reviewer", "default_provider": "demo"})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert r.json()["name"] == "Reviewer"

    r = client.get(f"/api/roles/{rid}")
    assert r.status_code == 200

    r = client.get("/api/roles")
    assert any(x["id"] == rid for x in r.json())

    r = client.patch(f"/api/roles/{rid}", json={"description": "updated"})
    assert r.status_code == 200
    assert r.json()["description"] == "updated"

    # duplicate name should conflict
    r = client.post("/api/roles", json={"name": "Reviewer"})
    assert r.status_code == 409

    r = client.delete(f"/api/roles/{rid}")
    assert r.status_code == 204
    assert client.get(f"/api/roles/{rid}").status_code == 404


def test_role_validation(client):
    assert client.post("/api/roles", json={"name": ""}).status_code == 422
    assert client.post("/api/roles", json={"name": "x", "default_provider": "bogus"}).status_code == 422


def test_role_not_found(client):
    assert client.get("/api/roles/nope").status_code == 404
    assert client.patch("/api/roles/nope", json={"description": "x"}).status_code == 404
    assert client.delete("/api/roles/nope").status_code == 404


def test_role_custom_tools_permissions(client):
    r = client.post("/api/roles", json={"name": "Custom", "permissions": {"can_write": True}, "tools": ["search", "code"]})
    assert r.status_code == 201
    data = r.json()
    assert data["permissions"] == {"can_write": True}
    assert data["tools"] == ["search", "code"]
