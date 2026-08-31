from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_database_url() -> str:
    # Resolve to backend/data/app.db regardless of cwd
    backend_dir = Path(__file__).resolve().parents[2]
    data_dir = backend_dir / "data"
    return f"sqlite:///{(data_dir / 'app.db').as_posix()}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(default="Multi-Agent AI Workspace")
    app_version: str = Field(default="0.1.0")
    app_env: str = Field(default="development")
    log_level: str = Field(default="INFO")

    backend_host: str = Field(default="127.0.0.1")
    backend_port: int = Field(default=8000)

    database_url: str = Field(default_factory=_default_database_url)

    # Ollama - configurable, default local URL only as default
    ollama_host: str = Field(default="http://127.0.0.1:11434")
    ollama_timeout_s: float = Field(default=30.0)

    workspace_root: str | None = Field(default=None, description="Override workspace root, default repo/workspace")

    cors_origins: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors(cls, v: object) -> List[str]:
        if isinstance(v, str):
            # Support comma-separated env var
            parts = [p.strip() for p in v.split(",") if p.strip()]
            return parts
        if isinstance(v, list):
            return v
        return []

    @field_validator("app_env")
    @classmethod
    def _lower_env(cls, v: str) -> str:
        return v.lower()

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def is_test(self) -> bool:
        return self.app_env == "test"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    # Pre-process CORS_ORIGINS to handle comma-separated string (pydantic-settings expects JSON for List[str])
    # This makes both `http://a,http://b` and `["http://a","http://b"]` work on clean Windows
    import json

    raw_cors = os.getenv("CORS_ORIGINS")
    if raw_cors and raw_cors.strip() and not raw_cors.strip().startswith("["):
        # Looks like comma-separated, convert to JSON array for pydantic parsing
        parts = [p.strip() for p in raw_cors.split(",") if p.strip()]
        # Only rewrite if it looks like URLs (avoid breaking already-JSON)
        if parts and any("http" in p for p in parts):
            os.environ["CORS_ORIGINS"] = json.dumps(parts)
    # Also alias OLLAMA_URL -> OLLAMA_HOST if set
    if os.getenv("OLLAMA_URL") and not os.getenv("OLLAMA_HOST"):
        os.environ["OLLAMA_HOST"] = os.getenv("OLLAMA_URL", "")
    repo_env = Path(__file__).resolve().parents[3] / ".env"
    if repo_env.exists():
        pass
    return Settings()  # type: ignore[call-arg]


def get_settings_no_cache() -> Settings:
    # For tests that need fresh env
    get_settings.cache_clear()
    s = Settings()  # type: ignore[call-arg]
    return s
