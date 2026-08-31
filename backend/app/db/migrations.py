from __future__ import annotations

import logging

from sqlalchemy import inspect, text

from app.db.base import Base, get_engine

logger = logging.getLogger(__name__)

# Simple versioned migration via app_settings table + create_all
# SQLite safe: create_all is idempotent, and we add indexes/columns if missing.

SCHEMA_VERSION = 2


def _get_user_version(conn) -> int:
    try:
        r = conn.execute(text("PRAGMA user_version")).fetchone()
        return int(r[0]) if r else 0
    except Exception:
        return 0


def _set_user_version(conn, v: int) -> None:
    conn.execute(text(f"PRAGMA user_version={v}"))


def run_migrations() -> None:
    """
    Safe schema management for SQLite:
    - Ensures foreign_keys on
    - Uses Base.metadata.create_all (idempotent) for schema creation
    - Tracks schema version via PRAGMA user_version
    - Future migrations can be added as versioned steps.
    """
    engine = get_engine()
    # Enable FK enforcement per connection for SQLite
    from sqlalchemy import event

    @event.listens_for(engine, "connect")
    def _set_fk(dbapi_conn, _rec):  # type: ignore[no-untyped-def]
        try:
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()
        except Exception:
            pass

    # Ensure all models are imported before create_all
    import app.models  # noqa: F401

    with engine.begin() as conn:
        # Enable FK for this connection
        conn.execute(text("PRAGMA foreign_keys=ON"))
        cur_ver = _get_user_version(conn)
        if cur_ver < SCHEMA_VERSION:
            logger.info("Running migrations: %s -> %s", cur_ver, SCHEMA_VERSION)
            # create_all is safe re-entrant
            Base.metadata.create_all(bind=conn)
            _set_user_version(conn, SCHEMA_VERSION)
            logger.info("Migrations complete at version %s", SCHEMA_VERSION)
        else:
            # Even if version current, ensure create_all for any new models
            Base.metadata.create_all(bind=conn)


def init_db() -> None:
    run_migrations()
