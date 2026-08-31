from __future__ import annotations

from typing import Generator

from sqlalchemy.orm import Session

from app.db.base import get_sessionmaker


def get_db() -> Generator[Session, None, None]:
    SessionLocal = get_sessionmaker()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
