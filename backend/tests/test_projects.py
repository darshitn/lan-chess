from __future__ import annotations


def test_project_crud(client):
    # create
    r = client.post("/api/projects", json={"name": "Alpha", "description": "first"})
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    assert r.json()["name"] == "Alpha"
    assert r.json()["status"] == "active"

    # get
    r = client.get(f"/api/projects/{pid}")
    assert r.status_code == 200
    assert r.json()["id"] == pid

    # list
    r = client.get("/api/projects")
    assert r.status_code == 200
    assert any(p["id"] == pid for p in r.json())

    # update
    r = client.patch(f"/api/projects/{pid}", json={"name": "Alpha 2", "status": "archived"})
    assert r.status_code == 200
    assert r.json()["name"] == "Alpha 2"
    assert r.json()["status"] == "archived"

    # delete
    r = client.delete(f"/api/projects/{pid}")
    assert r.status_code == 204
    r = client.get(f"/api/projects/{pid}")
    assert r.status_code == 404


def test_project_validation(client):
    r = client.post("/api/projects", json={"name": ""})
    assert r.status_code == 422
    r = client.post("/api/projects", json={"name": "   "})
    assert r.status_code == 422
    r = client.post("/api/projects", json={"name": "x" * 201})
    assert r.status_code == 422
    r = client.post("/api/projects", json={"name": "Ok", "status": "bogus"})
    assert r.status_code == 422


def test_project_list_filters(client):
    client.post("/api/projects", json={"name": "P1", "status": "active"})
    client.post("/api/projects", json={"name": "P2", "status": "archived"})
    r = client.get("/api/projects", params={"status": "archived"})
    assert r.status_code == 200
    assert all(p["status"] == "archived" for p in r.json())
    r = client.get("/api/projects", params={"q": "P1"})
    assert any(p["name"] == "P1" for p in r.json())


def test_project_not_found(client):
    assert client.get("/api/projects/does-not-exist").status_code == 404
    assert client.patch("/api/projects/does-not-exist", json={"name": "x"}).status_code == 404
    assert client.delete("/api/projects/does-not-exist").status_code == 404
