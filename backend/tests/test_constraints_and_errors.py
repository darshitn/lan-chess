from __future__ import annotations

import pytest
from sqlalchemy import text


def test_foreign_key_enforced(client):
    # Direct DB check: inserting agent with bad project_id should fail even without API validation
    from app.db.base import get_engine

    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys=ON"))
        # Use get_settings DB - try to insert via raw SQL with bad FK
        try:
            conn.execute(text("INSERT INTO agents (id, project_id, name, status, enabled, created_at, updated_at) VALUES ('x','bad-id','Bad','active',1, datetime('now'), datetime('now'))"))
            # If we reach here, FK not enforced -> fail
            assert False, "FK not enforced"
        except Exception as e:
            assert "FOREIGN KEY" in str(e) or "foreign key" in str(e).lower()


def test_database_indexes_exist(client):
    from app.db.base import get_engine

    engine = get_engine()
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT name FROM sqlite_master WHERE type='index'")).fetchall()
        names = {r[0] for r in rows}
        # Spot-check critical indexes
        assert "ix_projects_name" in names
        assert "ix_agents_project_id" in names
        assert "ix_providers_kind" in names
        assert "ix_profiles_provider" in names


def test_all_tables_exist(client):
    from app.db.base import get_engine
    import app.models  # noqa

    engine = get_engine()
    from app.db.base import Base

    expected = {"projects", "agents", "roles", "providers", "profiles", "workflows", "workflow_nodes", "workflow_edges", "workflow_runs", "workflow_node_runs", "messages", "artifacts", "artifact_versions", "agent_memories", "events", "notifications", "settings"}
    assert expected.issubset(set(Base.metadata.tables.keys()))
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
        db_tables = {r[0] for r in rows}
        for t in expected:
            assert t in db_tables, f"missing table {t}"


def test_error_handling_404_and_422(client):
    # 404 envelope
    r = client.get("/api/projects/not-exist")
    assert r.status_code == 404
    assert "detail" in r.json()

    # 422 validation envelope
    r = client.post("/api/projects", json={"name": ""})
    assert r.status_code == 422
    body = r.json()
    assert "detail" in body or "code" in body

    # Unknown route
    r = client.get("/api/unknown-route-xyz")
    assert r.status_code == 404


def test_pagination_validation(client):
    for _ in range(3):
        client.post("/api/projects", json={"name": "Paginate"})
    # limit out of range
    assert client.get("/api/projects", params={"limit": 999}).status_code == 422
    assert client.get("/api/projects", params={"skip": -1}).status_code == 422
    # valid pagination
    r = client.get("/api/projects", params={"skip": 1, "limit": 1})
    assert r.status_code == 200
    assert len(r.json()) == 1
