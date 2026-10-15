"""FastAPI application factory and main entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup (dev convenience; Alembic for production)."""
    settings = get_settings()
    if settings.DATABASE_URL.startswith("sqlite"):
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    yield


def create_app() -> FastAPI:
    """Build and return the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "Automobile engine signature extraction and pattern recognition. "
            "Multivariable sensor data analysis with CNN, SVM, and ANN classifiers."
        ),
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Register routers ──────────────────────────────────────────────
    from app.api.health import router as health_router
    from app.api.models_api import router as models_router
    from app.api.optimize import router as optimize_router
    from app.api.runs import router as runs_router
    from app.api.sensors import router as sensors_router
    from app.api.websocket import router as ws_router

    app.include_router(health_router, tags=["Health"])
    app.include_router(sensors_router, prefix="/sensors", tags=["Sensors"])
    app.include_router(runs_router, prefix="/runs", tags=["Runs"])
    app.include_router(models_router, prefix="/models", tags=["Models"])
    app.include_router(optimize_router, prefix="/optimize", tags=["Optimizer"])
    app.include_router(ws_router, tags=["WebSocket"])

    return app


app = create_app()
