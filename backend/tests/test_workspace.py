from __future__ import annotations

import os
import pytest
from pathlib import Path


def _proj(client, name="WProj"):
    r = client.post("/api/projects", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _role(client, name, perms):
    r = client.post("/api/roles", json={"name": name, "permissions": perms})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _agent(client, pid, role_id=None, perms=None):
    # perms unused here but role controls
    role_id = role_id
    r = client.post("/api/agents", json={"project_id": pid, "name": f"ag-{role_id or 'x'}", "role_id": role_id})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_workspace_creation(client):
    pid = _proj(client)
    # workspace should exist after project creation
    from app.workspace.service import get_project_workspace

    ws = get_project_workspace(pid)
    assert ws.exists()
    assert ws.is_dir()
    # ensure isolated
    pid2 = _proj(client, "WProj2")
    ws2 = get_project_workspace(pid2)
    assert ws2 != ws
    assert str(ws) in str(ws)
    # delete cleans
    r = client.delete(f"/api/projects/{pid}")
    assert r.status_code == 204
    assert not ws.exists()


def test_file_crud(client):
    pid = _proj(client)
    # create
    r = client.post(f"/api/projects/{pid}/workspace/create", json={"path": "hello.txt", "content": "hi"})
    assert r.status_code == 200, r.text
    # duplicate 409
    r = client.post(f"/api/projects/{pid}/workspace/create", json={"path": "hello.txt", "content": "hi"})
    assert r.status_code == 409
    # read
    r = client.get(f"/api/projects/{pid}/workspace/read", params={"path": "hello.txt"})
    assert r.status_code == 200
    assert r.json()["content"] == "hi"
    # write update
    r = client.post(f"/api/projects/{pid}/workspace/write", json={"path": "hello.txt", "content": "updated"})
    assert r.status_code == 200
    r = client.get(f"/api/projects/{pid}/workspace/read", params={"path": "hello.txt"})
    assert r.json()["content"] == "updated"
    # list
    r = client.get(f"/api/projects/{pid}/workspace/list", params={"path": ""})
    assert r.status_code == 200
    assert any(e["name"] == "hello.txt" for e in r.json()["entries"])
    # list recursive
    client.post(f"/api/projects/{pid}/workspace/create", json={"path": "src/app.py", "content": "print('x')"})
    r = client.get(f"/api/projects/{pid}/workspace/list", params={"path": "", "recursive": "true"})
    assert any(e["path"] == "src/app.py" for e in r.json()["entries"])
    # search
    r = client.get(f"/api/projects/{pid}/workspace/search", params={"q": "app.py"})
    assert r.status_code == 200
    assert any("app.py" in m["path"] for m in r.json()["matches"])
    # rename
    r = client.post(f"/api/projects/{pid}/workspace/rename", json={"from_path": "hello.txt", "to_path": "renamed.txt"})
    assert r.status_code == 200
    assert client.get(f"/api/projects/{pid}/workspace/read", params={"path": "hello.txt"}).status_code == 404
    assert client.get(f"/api/projects/{pid}/workspace/read", params={"path": "renamed.txt"}).status_code == 200
    # delete file
    r = client.post(f"/api/projects/{pid}/workspace/delete", json={"path": "renamed.txt"})
    assert r.status_code == 200
    assert client.get(f"/api/projects/{pid}/workspace/read", params={"path": "renamed.txt"}).status_code == 404
    # delete dir recursive
    r = client.post(f"/api/projects/{pid}/workspace/delete", json={"path": "src", "recursive": True})
    assert r.status_code == 200
    r = client.get(f"/api/projects/{pid}/workspace/list", params={"path": ""})
    assert not any(e["name"] == "src" for e in r.json()["entries"])


def test_path_traversal_blocked(client):
    pid = _proj(client)
    bad = ["../escape.txt", "../../etc/passwd", "/absolute.txt", "a/../../b", "C:\\windows\\file", "src/../..", "workspace/../other", "..", "../"]
    for p in bad:
        r = client.post(f"/api/projects/{pid}/workspace/create", json={"path": p, "content": "bad"})
        assert r.status_code in (400, 403, 422), f"should block {p}: {r.text}"
        r = client.get(f"/api/projects/{pid}/workspace/read", params={"path": p})
        assert r.status_code in (400, 403, 404, 422)
    # also traversal via rename
    client.post(f"/api/projects/{pid}/workspace/create", json={"path": "ok.txt", "content": "x"})
    r = client.post(f"/api/projects/{pid}/workspace/rename", json={"from_path": "ok.txt", "to_path": "../evil.txt"})
    assert r.status_code == 400


def test_cross_project_access_blocked(client):
    pid1 = _proj(client, "Cross1")
    pid2 = _proj(client, "Cross2")
    client.post(f"/api/projects/{pid1}/workspace/create", json={"path": "secret.txt", "content": "p1 secret"})
    # p2 should not see p1 file via its own workspace id (each isolated)
    r = client.get(f"/api/projects/{pid2}/workspace/read", params={"path": "secret.txt"})
    assert r.status_code == 404  # not found in p2
    # Ensure path cannot be crafted to escape via .. is already blocked
    # Agent cross-project via agent_id
    role_id = _role(client, "ReaderCross", {"READ": ["**"]})
    ag1 = _agent(client, pid1, role_id)
    # Try to use ag1 to read pid2 workspace -> should be 403
    r = client.get(f"/api/projects/{pid2}/workspace/read", params={"path": "secret.txt", "agent_id": ag1})
    # The file doesn't exist in p2 anyway, but even if it did, agent belongs to p1 not p2, should be cross-project denied before file check
    # So create same file in p2 and try
    client.post(f"/api/projects/{pid2}/workspace/create", json={"path": "secret.txt", "content": "p2 secret"})
    r = client.get(f"/api/projects/{pid2}/workspace/read", params={"path": "secret.txt", "agent_id": ag1})
    assert r.status_code == 403


def test_permissions_per_path(client):
    pid = _proj(client, "PermProj")
    # Roles as per spec
    planner_perms = {"WRITE": ["plan.md"], "READ": ["src/**", "plan.md"]}
    impl_perms = {"READ": ["src/**"], "WRITE": ["src/**"]}
    reviewer_perms = {"READ": ["src/**"]}
    tester_perms = {"READ": ["tests/**"], "WRITE": ["tests/**"]}
    r_planner = _role(client, "Planner", planner_perms)
    r_impl = _role(client, "Implementer", impl_perms)
    r_rev = _role(client, "Reviewer", reviewer_perms)
    r_test = _role(client, "Tester", tester_perms)
    ag_plan = _agent(client, pid, r_planner)
    ag_impl = _agent(client, pid, r_impl)
    ag_rev = _agent(client, pid, r_rev)
    ag_test = _agent(client, pid, r_test)
    # Seed files as user (no agent check)
    client.post(f"/api/projects/{pid}/workspace/create", json={"path": "plan.md", "content": "plan"})
    client.post(f"/api/projects/{pid}/workspace/create", json={"path": "src/app.py", "content": "code"})
    client.post(f"/api/projects/{pid}/workspace/create", json={"path": "tests/test_app.py", "content": "test"})
    # Planner: can WRITE plan.md, can READ src, cannot WRITE src
    assert client.post(f"/api/projects/{pid}/workspace/write", json={"path": "plan.md", "content": "new plan"}, params={"agent_id": ag_plan}).status_code == 200
    assert client.get(f"/api/projects/{pid}/workspace/read", params={"path": "src/app.py", "agent_id": ag_plan}).status_code == 200
    assert client.post(f"/api/projects/{pid}/workspace/write", json={"path": "src/app.py", "content": "bad"}, params={"agent_id": ag_plan}).status_code == 403
    # Implementer: READ/WRITE src, no access to plan.md write? Should be 403 for plan.md
    assert client.post(f"/api/projects/{pid}/workspace/write", json={"path": "src/new.py", "content": "x"}, params={"agent_id": ag_impl}).status_code == 200
    assert client.get(f"/api/projects/{pid}/workspace/read", params={"path": "src/app.py", "agent_id": ag_impl}).status_code == 200
    assert client.post(f"/api/projects/{pid}/workspace/write", json={"path": "plan.md", "content": "x"}, params={"agent_id": ag_impl}).status_code == 403
    # Reviewer: READ src only
    assert client.get(f"/api/projects/{pid}/workspace/read", params={"path": "src/app.py", "agent_id": ag_rev}).status_code == 200
    assert client.post(f"/api/projects/{pid}/workspace/write", json={"path": "src/app.py", "content": "x"}, params={"agent_id": ag_rev}).status_code == 403
    assert client.post(f"/api/projects/{pid}/workspace/delete", json={"path": "src/app.py"}, params={"agent_id": ag_rev}).status_code == 403
    # Tester: READ/WRITE tests
    assert client.post(f"/api/projects/{pid}/workspace/write", json={"path": "tests/test_app.py", "content": "new"}, params={"agent_id": ag_test}).status_code == 200
    assert client.get(f"/api/projects/{pid}/workspace/read", params={"path": "tests/test_app.py", "agent_id": ag_test}).status_code == 200
    assert client.post(f"/api/projects/{pid}/workspace/write", json={"path": "src/app.py", "content": "x"}, params={"agent_id": ag_test}).status_code == 403


def test_symlink_blocked(client, tmp_path):
    pid = _proj(client)
    from app.workspace.service import get_project_workspace

    ws = get_project_workspace(pid)
    # Create outside target
    outside = tmp_path / "outside.txt"
    outside.write_text("secret")
    # Try symlink inside workspace pointing outside
    link = ws / "link.txt"
    try:
        link.symlink_to(outside)
    except OSError:
        pytest.skip("symlink not supported")
    # Read via API should be blocked 400
    r = client.get(f"/api/projects/{pid}/workspace/read", params={"path": "link.txt"})
    assert r.status_code == 400
    # Also list should skip symlink? We filter, but direct read must be blocked
    r = client.get(f"/api/projects/{pid}/workspace/list", params={"path": ""})
    # link should not appear or be blocked
    assert not any(e["path"] == "link.txt" for e in r.json()["entries"])


def test_file_activity_recorded(client):
    pid = _proj(client)
    client.post(f"/api/projects/{pid}/workspace/create", json={"path": "a.txt", "content": "x"})
    # Check events table has file.write
    from app.db.base import get_sessionmaker
    from app.models.event import Event

    db = get_sessionmaker()()
    try:
        evs = db.query(Event).filter(Event.project_id == pid).all()
        assert any("a.txt" in (e.title or "") for e in evs)
    finally:
        db.close()
