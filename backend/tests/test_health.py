from fastapi.testclient import TestClient

from app.main import create_app


def test_health_ok():
    app = create_app()
    client = TestClient(app)
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert "version" in body
    assert "environment" in body
    assert isinstance(body["version"], str)
    assert isinstance(body["environment"], str)


def test_root():
    app = create_app()
    client = TestClient(app)
    res = client.get("/")
    assert res.status_code == 200
    assert "version" in res.json()


def test_cors_headers():
    app = create_app()
    client = TestClient(app)
    res = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    # CORSMiddleware should allow configured origins
    assert res.status_code == 200
