from __future__ import annotations


def test_profile_crud(client):
    # need a provider for linkage
    prov = client.post("/api/providers", json={"kind": "demo", "display_name": "Demo"}).json()
    pid = prov["id"]

    r = client.post("/api/profiles", json={"name": "My Claude", "provider": "claude", "provider_id": pid, "status": "NOT_CONFIGURED", "metadata": {"region": "us"}})
    # provider mismatch should fail because provider kind demo != claude
    assert r.status_code == 400

    # correct linkage
    r = client.post("/api/profiles", json={"name": "My Demo", "provider": "demo", "provider_id": pid, "status": "NOT_CONFIGURED", "metadata": {"region": "us"}})
    assert r.status_code == 201, r.text
    prof_id = r.json()["id"]
    assert r.json()["status"] == "NOT_CONFIGURED"
    assert r.json()["provider"] == "demo"

    # do not store fake credentials - credentials_ref is optional placeholder, not real secret
    assert r.json()["credentials_ref"] is None

    # list & filter
    r = client.get("/api/profiles", params={"provider": "demo"})
    assert any(p["id"] == prof_id for p in r.json())
    r = client.get("/api/profiles", params={"status": "NOT_CONFIGURED"})
    assert any(p["id"] == prof_id for p in r.json())

    # update status through lifecycle
    for st in ["AUTH_REQUIRED", "AUTHENTICATED", "SESSION_EXPIRED", "ERROR", "DISABLED", "UNAVAILABLE"]:
        r = client.patch(f"/api/profiles/{prof_id}", json={"status": st})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == st

    r = client.delete(f"/api/profiles/{prof_id}")
    assert r.status_code == 204
    assert client.get(f"/api/profiles/{prof_id}").status_code == 404


def test_profile_without_provider_id(client):
    r = client.post("/api/profiles", json={"name": "Standalone Claude", "provider": "claude", "status": "NOT_CONFIGURED"})
    assert r.status_code == 201, r.text
    assert r.json()["provider"] == "claude"
    assert r.json()["provider_id"] is None


def test_profile_validation(client):
    assert client.post("/api/profiles", json={"name": "", "provider": "demo"}).status_code == 422
    assert client.post("/api/profiles", json={"name": "x", "provider": "unknown"}).status_code == 422
    assert client.post("/api/profiles", json={"name": "x", "provider": "demo", "status": "BOGUS"}).status_code == 422
    # provider_id not found
    assert client.post("/api/profiles", json={"name": "x", "provider": "demo", "provider_id": "nope"}).status_code == 400


def test_profile_not_found(client):
    assert client.get("/api/profiles/nope").status_code == 404
    assert client.patch("/api/profiles/nope", json={"name": "x"}).status_code == 404
    assert client.delete("/api/profiles/nope").status_code == 404
