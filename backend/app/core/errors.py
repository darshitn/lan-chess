from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    from fastapi.exceptions import RequestValidationError
    from sqlalchemy.exc import IntegrityError

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Use FastAPI's jsonable_encoder-friendly serialization: make ctx.error JSON-safe
        errors = exc.errors()
        safe_errors = []
        for err in errors:
            e = dict(err)
            ctx = e.get("ctx")
            if isinstance(ctx, dict) and "error" in ctx:
                # ValueError is not JSON serializable; stringify it
                ctx = dict(ctx)
                ctx["error"] = str(ctx["error"])
                e["ctx"] = ctx
            safe_errors.append(e)
        return JSONResponse(status_code=422, content={"detail": safe_errors, "code": "validation_error"})

    @app.exception_handler(IntegrityError)
    async def integrity_handler(request: Request, exc: IntegrityError) -> JSONResponse:
        logger.warning("Integrity error at %s: %s", request.url.path, exc)
        return JSONResponse(status_code=400, content={"detail": "Database constraint violated", "code": "integrity_error"})

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error at %s", request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "code": "internal_error"},
        )
