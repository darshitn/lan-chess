from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.agents import router as agents_router
from app.api.routes.agents_runtime import router as agents_runtime_router
from app.api.routes.artifacts import router as artifacts_router
from app.api.routes.health import router as health_router
from app.api.routes.profiles import router as profiles_router
from app.api.routes.projects import router as projects_router
from app.api.routes.providers import router as providers_router
from app.api.routes.providers_runtime import router as providers_runtime_router
from app.api.routes.roles import router as roles_router
from app.api.routes.settings import router as settings_router
from app.api.routes.workspace import router as workspace_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.db.base import init_db

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def _lifespan(_app: FastAPI):  # type: ignore[no-untyped-def]
        try:
            init_db()
            logger.info("Database initialized at %s", settings.database_url)
        except Exception:
            logger.exception("Failed to initialize database")
            raise
        yield

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Multi-Agent AI Workspace - Local-first orchestration platform",
        lifespan=_lifespan,
    )

    # CORS for local dev (Vite)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    # API routes
    app.include_router(health_router, prefix="/api")
    app.include_router(projects_router, prefix="/api")
    app.include_router(agents_router, prefix="/api")
    app.include_router(agents_runtime_router, prefix="/api")
    app.include_router(roles_router, prefix="/api")
    app.include_router(providers_router, prefix="/api")
    app.include_router(providers_runtime_router, prefix="/api")
    app.include_router(profiles_router, prefix="/api")
    app.include_router(settings_router, prefix="/api")
    app.include_router(workspace_router, prefix="/api")
    app.include_router(artifacts_router, prefix="/api")

    # Ensure tables exist even when lifespan is not triggered (e.g., TestClient without context manager)
    try:
        init_db()
    except Exception:
        logger.exception("Failed to initialize database eagerly")

    @app.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        return {"message": f"{settings.app_name} API", "version": settings.app_version}

    return app


app = create_app()
