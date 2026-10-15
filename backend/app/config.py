"""Application configuration via environment variables."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings

_ROOT = Path(__file__).resolve().parent.parent.parent  # repo root


class Settings(BaseSettings):
    """EngineSense configuration.

    All values can be overridden via environment variables or a .env file.
    """

    # ── Application ──────────────────────────────────────────────────
    APP_NAME: str = "EngineSense"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # ── Database ─────────────────────────────────────────────────────
    # Default: SQLite for quick local runs.
    # Docker-compose overrides to PostgreSQL + TimescaleDB.
    DATABASE_URL: str = Field(
        default=f"sqlite+aiosqlite:///{_ROOT / 'data' / 'enginesense.db'}",
        description="Async SQLAlchemy database URL",
    )
    DATABASE_ECHO: bool = False

    # ── BlobStore ────────────────────────────────────────────────────
    BLOB_STORE_ROOT: Path = Field(
        default=_ROOT / "data" / "blobs",
        description="Root directory for high-rate signal chunks (Parquet/NPZ)",
    )

    # ── MLflow ───────────────────────────────────────────────────────
    MLFLOW_TRACKING_URI: str = Field(
        default=f"sqlite:///{_ROOT / 'data' / 'mlflow.db'}",
        description="MLflow tracking URI",
    )

    # ── Simulator ────────────────────────────────────────────────────
    SIM_SEED: int = 42
    SIM_DEFAULT_DURATION_S: float = 300.0  # 5 minutes default

    # ── Pipeline ─────────────────────────────────────────────────────
    WINDOW_SIZE_S: float = 1.0
    WINDOW_OVERLAP: float = 0.5
    LTTB_MAX_POINTS: int = 2000

    # ── API ──────────────────────────────────────────────────────────
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    model_config = {
        "env_prefix": "ENGINESENSE_",
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


@lru_cache
def get_settings() -> Settings:
    """Return cached settings singleton."""
    return Settings()
