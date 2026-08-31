from __future__ import annotations

import time
from fastapi import APIRouter, Depends
from sqlalchemy import text

from app.core.config import Settings, get_settings
from app.schemas.health import DiagnosticsResponse, HealthResponse, ProviderHealthStatus

router = APIRouter(tags=["health"])


def _db_status() -> tuple[str, str | None]:
    try:
        from app.db.base import get_engine

        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return "ok", None
    except Exception as e:
        return "error", str(e)[:200]


async def _ollama_status() -> ProviderHealthStatus:
    try:
        from app.providers.ollama import OllamaProvider

        p = OllamaProvider()
        h = await p.health()
        if h.available:
            return ProviderHealthStatus(status="available", available=True, latency_ms=h.latency_ms, error=None)
        # distinguish not_configured vs unavailable is not needed for ollama (always has default), but report unavailable
        return ProviderHealthStatus(status="unavailable", available=False, latency_ms=h.latency_ms, error=h.error)
    except Exception as e:
        return ProviderHealthStatus(status="error", available=False, error=str(e)[:200])


def _claude_status() -> ProviderHealthStatus:
    import os

    key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    if not key:
        return ProviderHealthStatus(status="not_configured", available=False, error=None)
    # Don't validate key, just report configured; actual health would require API call
    return ProviderHealthStatus(status="available", available=True, error=None)


def _demo_status() -> ProviderHealthStatus:
    return ProviderHealthStatus(status="available", available=True, error=None)


@router.get("/health", response_model=HealthResponse, summary="Health check")
async def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    db_status, db_err = _db_status()
    ollama = await _ollama_status()
    claude = _claude_status()
    demo = _demo_status()

    providers = {
        "demo": demo.status,
        "ollama": ollama.status,
        "claude": claude.status,
    }

    # Never expose keys, tokens, cookies, sensitive env
    diagnostics = DiagnosticsResponse(
        status="ok" if db_status == "ok" else "error",
        version=settings.app_version,
        environment=settings.app_env,
        database=db_status,
        database_error=db_err,
        providers=providers,
        ollama=ollama,
        claude=claude,
        demo=demo,
    )

    # Backwards compatible top-level fields
    return HealthResponse(
        status=diagnostics.status,
        version=settings.app_version,
        environment=settings.app_env,
        database=db_status,
        providers=providers,
        details=diagnostics,
    )


@router.get("/diagnostics", response_model=DiagnosticsResponse, summary="Detailed diagnostics")
async def diagnostics(settings: Settings = Depends(get_settings)) -> DiagnosticsResponse:
    db_status, db_err = _db_status()
    ollama = await _ollama_status()
    claude = _claude_status()
    demo = _demo_status()
    return DiagnosticsResponse(
        status="ok" if db_status == "ok" else "error",
        version=settings.app_version,
        environment=settings.app_env,
        database=db_status,
        database_error=db_err,
        providers={"demo": demo.status, "ollama": ollama.status, "claude": claude.status},
        ollama=ollama,
        claude=claude,
        demo=demo,
    )
