from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.db.base import get_sessionmaker
from app.db.session import get_db


def pagination_params(
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> dict[str, int]:
    return {"skip": skip, "limit": limit}


PaginationDeps = Annotated[dict[str, int], Depends(pagination_params)]
DbSession = Annotated[Session, Depends(get_db)]
