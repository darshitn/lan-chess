from __future__ import annotations


def test_settings_crud(client):
    r = client.post("/api/settings", json={"key": "app.theme", "value": "dark"})
    assert r.status_code == 201, r.text
    assert r.json()["key"] == "app.theme"

    # duplicate
    assert client.post("/api/settings", json={"key": "app.theme", "value": "light"}).status_code == 409

    # get
    assert client.get("/api/settings/app.theme").status_code == 200

    # list
    r = client.get("/api/settings")
    assert any(s["key"] == "app.theme" for s in r.json())

    # upsert via PUT - create new
    r = client.put("/api/settings/app.language", json={"value": "en"})
    assert r.status_code == 200
    assert r.json()["value"] == "en"

    # upsert existing
    r = client.put("/api/settings/app.theme", json={"value": "light"})
    assert r.status_code == 200
    assert r.json()["value"] == "light"

    # patch
    r = client.patch("/api/settings/app.theme", json={"value": "dark", "description": "theme"})
    assert r.status_code == 200
    assert r.json()["value"] == "dark"

    # delete
    assert client.delete("/api/settings/app.theme").status_code == 204
    assert client.get("/api/settings/app.theme").status_code == 404


def test_settings_validation(client):
    assert client.post("/api/settings", json={"key": "", "value": 1}).status_code == 422
    assert client.post("/api/settings", json={"key": "bad key!", "value": 1}).status_code == 422
    assert client.get("/api/settings/nope").status_code == 404
    assert client.patch("/api/settings/nope", json={"value": 1}).status_code == 404
    assert client.delete("/api/settings/nope").status_code == 404
