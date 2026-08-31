from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Use a temp SQLite file per test session to keep isolation and avoid polluting data/app.db
@pytest.fixture(scope="session", autouse=True)
def _isolate_db():
    # Create temp dir/file for DB
    tmpdir = tempfile.mkdtemp(prefix="maw-test-")
    db_path = Path(tmpdir) / "test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
    # Clear settings cache so it picks up new env
    from app.core.config import get_settings

    get_settings.cache_clear()
    # Reset engine singleton
    import app.db.base as base

    base._engine = None
    base._SessionLocal = None
    yield
    # Cleanup after session
    try:
        if base._engine is not None:
            base._engine.dispose()
    except Exception:
        pass
    # Leave file for debugging; tmpdir will be cleaned by OS eventually


@pytest.fixture(autouse=True)
def _reset_db():
    """Ensure schema is clean before each test."""
    from app.db.base import get_engine, Base
    import app.models  # noqa: F401

    engine = get_engine()
    # Enable FK pragma on connection
    with engine.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys=ON"))
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    # Reset PRAGMA user_version for migrations check if needed
    with engine.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys=ON"))
        conn.execute(text("PRAGMA user_version=2"))
    # Clean workspace before each test to avoid cross-test pollution and pytest collection of stray test_*.py
    from app.workspace.service import get_workspace_root

    ws_root = get_workspace_root()
    if ws_root.exists():
        for child in ws_root.iterdir():
            if child.name == ".gitkeep":
                continue
            try:
                import shutil

                if child.is_dir():
                    shutil.rmtree(child, ignore_errors=True)
                else:
                    child.unlink(missing_ok=True)
            except Exception:
                pass
    yield
    # No teardown per test besides next reset


@pytest.fixture()
def client():
    from app.main import create_app

    app = create_app()
    with TestClient(app) as c:
        yield c
