from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def _ensure_sqlite_dir(database_url: str) -> None:
    if database_url.startswith("sqlite"):
        # sqlite:///./data/app.db or sqlite:///D:/... or sqlite:///:memory:
        if ":memory:" in database_url:
            return
        # Extract path after sqlite:///
        path_part = database_url.split("sqlite:///")[-1].split("?")[0]
        if not path_part or path_part == ":memory:":
            return
        p = Path(path_part)
        # If relative, resolve against current working directory (sqlite engine does same)
        # Also handle the legacy "./data" which was relative to repo root vs backend
        if not p.is_absolute():
            p = (Path.cwd() / p).resolve()
        p.parent.mkdir(parents=True, exist_ok=True)


def create_db_engine(database_url: str | None = None):
    settings = get_settings()
    url = database_url or settings.database_url
    _ensure_sqlite_dir(url)
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}
    engine = create_engine(url, connect_args=connect_args, future=True)
    return engine


# Lazily created engine; tests can override via dependency
_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_db_engine()
    return _engine


def get_sessionmaker():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=get_engine(), autoflush=False, autocommit=False, future=True
        )
    return _SessionLocal


def init_db() -> None:
    # Deferred import to avoid circular deps; migrations handles model import + FK pragma
    from app.db.migrations import run_migrations

    run_migrations()
